/**
 * Importa resultados de torneio (Veda System) a partir de um arquivo de eventos normalizado (ver
 * scripts/meta-sources/egman.mjs): cria as temporadas GD01…GD05, cada Tournament (chave = sourceUrl) e as
 * inscrições com a decklist congelada num DeckSnapshot (que é o que as estatísticas leem). Idempotente: um
 * evento já importado tem as inscrições substituídas pelas da coleta nova.
 *
 *   node prisma/import-tournaments.mjs --file=events-egman.json            # simulação
 *   node prisma/import-tournaments.mjs --file=events-egman.json --apply
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Lançamento oficial (EN) de cada coleção; a temporada vai até a véspera da próxima.
export const SEASONS = [
  { code: "GD01", name: "GD01 — Newtype Rising", startDate: "2025-07-25" },
  { code: "GD02", name: "GD02 — Dual Impact", startDate: "2025-10-24" },
  { code: "GD03", name: "GD03 — Steel Requiem", startDate: "2026-01-30" },
  { code: "GD04", name: "GD04 — Phantom Aria", startDate: "2026-04-24" },
  { code: "GD05", name: "GD05 — Freedom Ascension", startDate: "2026-07-24" },
];

const DAY_MS = 86_400_000;
const slug = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

function candidateOf(t, deckBySnapshot = new Map()) {
  const champion = t.entries.find((e) => e.placement === 1);
  return {
    id: t.id,
    sourceUrl: t.sourceUrl,
    season: t.season,
    date: t.dateStart?.toISOString() ?? null,
    champion: champion?.playerName ?? null,
    championDeck: champion?.deckSnapshotId ? deckBySnapshot.get(champion.deckSnapshotId) ?? null : null,
    players: t.entries.map((e) => e.playerName),
    entries: t.entries.length,
    lists: t.entries.filter((e) => e.deckSnapshotId).length,
  };
}

const ANONYMOUS = new Set(["", "anonymous", "anonimo", "unknown"]);
const playerSet = (names) => new Set(names.map(slug).filter((n) => !ANONYMOUS.has(n)));

/** Jaccard entre os códigos de duas listas { código: cópias } (null quando falta uma delas) */
export function deckSimilarity(a, b) {
  const x = new Set(Object.keys(a ?? {}));
  const y = new Set(Object.keys(b ?? {}));
  if (!x.size || !y.size) return null;
  const inter = [...x].filter((c) => y.has(c)).length;
  return inter / (x.size + y.size - inter);
}

/**
 * Mesmo evento em outra fonte (ex.: um regional na Egman e na DigiLab): outro site, mesma temporada, data a até
 * 1 dia e o mesmo campeão — e mais uma confirmação, porque campeão e data sozinhos casam eventos diferentes
 * (apelidos curtos como "JP", ou a mesma loja com dois eventos no dia):
 *  - os dois lados com 2+ jogadores: metade dos jogadores do menor em comum (mínimo 2). Medido em 2026-10-16:
 *    os 22 duplicados reais Egman×DigiLab dividem 60–100% dos nomes; os falsos, só o campeão;
 *  - um lado só com o campeão: a lista do campeão parecida (Jaccard ≥ 0,6), quando as duas fontes a têm.
 * Entre vários candidatos, fica o com mais jogadores em comum.
 */
export function crossSourceDuplicate(ev, candidates) {
  const champion = slug(ev.entries.find((e) => e.placement === 1)?.player);
  if (!champion || ANONYMOUS.has(champion) || !ev.date) return null;
  const day = Date.parse(`${ev.date}T00:00:00Z`);
  const ours = playerSet(ev.entries.map((e) => e.player));
  const ourDeck = ev.entries.find((e) => e.placement === 1)?.main ?? null;
  let best = null;
  for (const c of candidates) {
    if (hostOf(c.sourceUrl) === hostOf(ev.sourceUrl)) continue;
    if (c.season && ev.format && c.season !== ev.format) continue;
    if (!c.date || Math.abs(Date.parse(c.date) - day) > DAY_MS) continue;
    if (slug(c.champion) !== champion) continue;
    const theirs = playerSet(c.players ?? [c.champion]);
    const shared = [...ours].filter((p) => theirs.has(p)).length;
    const smaller = Math.min(ours.size, theirs.size);
    if (smaller >= 2) {
      if (shared < Math.max(2, Math.ceil(smaller / 2))) continue;
    } else {
      const sim = deckSimilarity(ourDeck, c.championDeck);
      if (sim != null && sim < 0.6) continue;
    }
    if (!best || shared > best.shared) best = { candidate: c, shared };
  }
  return best?.candidate ?? null;
}

/** Qual coleta fica quando o evento existe nas duas fontes: a com mais listas; empate, a com mais jogadores. */
export function keepsExisting(prepared, dup) {
  const lists = prepared.filter((e) => e.items.length).length;
  if (lists !== dup.lists) return lists < dup.lists;
  return prepared.length <= (dup.entries ?? 0);
}

export function seasonRows() {
  return SEASONS.map((s, i) => {
    const next = SEASONS[i + 1];
    const end = next ? new Date(Date.parse(`${next.startDate}T00:00:00Z`) - 86_400_000) : null;
    return { ...s, startDate: new Date(`${s.startDate}T00:00:00Z`), endDate: end, isCurrent: !next };
  });
}

/** decklist { código: cópias } → itens do snapshot, com a impressão principal de cada código */
export function snapshotItems(main, printByCode) {
  const items = [];
  const missing = [];
  for (const [code, qty] of Object.entries(main ?? {})) {
    const cardId = printByCode.get(code);
    if (!cardId) missing.push(code);
    else items.push({ cardId, quantity: Number(qty), section: "main" });
  }
  return { items, missing };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
  const apply = args.apply === "true";
  const data = JSON.parse(fs.readFileSync(path.resolve(String(args.file)), "utf8"));
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const lists = data.events.reduce((n, e) => n + e.entries.length, 0);
    console.log(`${apply ? "APLICANDO" : "SIMULAÇÃO (nada é gravado)"} — fonte ${data.source}: ${data.events.length} eventos, ${lists} listas`);

    const seasons = new Map();
    for (const s of seasonRows()) {
      if (apply) {
        const row = await prisma.season.upsert({
          where: { code: s.code },
          update: { name: s.name, startDate: s.startDate, endDate: s.endDate, isCurrent: s.isCurrent },
          create: s,
        });
        seasons.set(s.code, row.id);
      } else {
        seasons.set(s.code, `(${s.code})`);
      }
    }
    if (apply) await prisma.season.updateMany({ where: { code: { notIn: SEASONS.map((s) => s.code) } }, data: { isCurrent: false } });

    const prints = await prisma.card.findMany({
      where: { isActive: true },
      select: { id: true, code: true, isPrimaryPrint: true, createdAt: true },
      orderBy: [{ isPrimaryPrint: "desc" }, { createdAt: "asc" }],
    });
    const printByCode = new Map();
    for (const p of prints) if (!printByCode.has(p.code)) printByCode.set(p.code, p.id);

    let created = 0;
    let updated = 0;
    let replaced = 0;
    const skipped = [];
    const missingCodes = new Set();
    for (const ev of data.events) {
      const prepared = ev.entries.map((e) => ({ ...e, ...snapshotItems(e.main, printByCode) }));
      for (const e of prepared) for (const c of e.missing) missingCodes.add(c);
      let existing = await prisma.tournament.findFirst({ where: { sourceUrl: ev.sourceUrl }, select: { id: true } });
      if (!existing && ev.date) {
        // o mesmo evento vindo de outra fonte (ex.: um regional na Egman e na DigiLab) entra uma vez só
        const day = Date.parse(`${ev.date}T00:00:00Z`);
        const nearby = await prisma.tournament.findMany({
          where: { isActive: true, sourceUrl: { not: ev.sourceUrl }, dateStart: { gte: new Date(day - DAY_MS), lte: new Date(day + DAY_MS) } },
          select: { id: true, sourceUrl: true, season: true, dateStart: true, entries: { select: { playerName: true, placement: true, deckSnapshotId: true } } },
        });
        const championSnaps = nearby.flatMap((t) => t.entries.filter((e) => e.placement === 1 && e.deckSnapshotId).map((e) => e.deckSnapshotId));
        const decks = championSnaps.length
          ? await prisma.deckSnapshot.findMany({ where: { id: { in: championSnaps } }, select: { id: true, compactListJson: true } })
          : [];
        const deckBySnapshot = new Map(decks.map((d) => [d.id, d.compactListJson]));
        const dup = crossSourceDuplicate(ev, nearby.map((t) => candidateOf(t, deckBySnapshot)));
        if (dup) {
          if (keepsExisting(prepared, dup)) {
            skipped.push(`${ev.name} (${ev.date}) = ${dup.sourceUrl}`);
            continue;
          }
          existing = { id: dup.id }; // a coleta nova é mais completa: substitui a outra fonte
          replaced += 1;
        }
      }
      if (existing) updated += 1;
      else created += 1;
      if (!apply) continue;

      await prisma.$transaction(async (tx) => {
        const fields = {
          name: ev.name,
          organizer: ev.organizer ?? null,
          country: ev.country ?? null,
          city: ev.city ?? null,
          format: "constructed",
          season: ev.format ?? null,
          seasonId: seasons.get(ev.format) ?? null,
          sourceUrl: ev.sourceUrl,
          participantCount: ev.participantCount ?? null,
          tier: ev.tier,
          dateStart: ev.date ? new Date(`${ev.date}T00:00:00Z`) : null,
          dateEnd: ev.date ? new Date(`${ev.date}T00:00:00Z`) : null,
        };
        let tournamentId = existing?.id;
        if (tournamentId) {
          const old = await tx.tournamentEntry.findMany({ where: { tournamentId }, select: { deckSnapshotId: true } });
          await tx.tournamentEntry.deleteMany({ where: { tournamentId } });
          const snapIds = old.map((o) => o.deckSnapshotId).filter(Boolean);
          if (snapIds.length) await tx.deckSnapshot.deleteMany({ where: { id: { in: snapIds } } });
          await tx.tournament.update({ where: { id: tournamentId }, data: fields });
        } else {
          tournamentId = (await tx.tournament.create({ data: fields })).id;
        }
        for (const e of prepared) {
          let deckSnapshotId = null;
          if (e.items.length) {
            const snap = await tx.deckSnapshot.create({
              data: {
                name: `${e.player} — ${e.archetype ?? "Deck"}`,
                format: ev.format ?? null,
                compactListJson: e.main,
                items: { createMany: { data: e.items } },
              },
            });
            deckSnapshotId = snap.id;
          }
          await tx.tournamentEntry.create({
            data: {
              tournamentId,
              playerName: e.player,
              placement: e.placement ?? null,
              wins: e.wins ?? null,
              losses: e.losses ?? null,
              draws: e.draws ?? null,
              archetype: e.archetype ?? null,
              deckSnapshotId,
            },
          });
        }
      }, { timeout: 60_000 });
    }
    console.log(`Torneios novos: ${created} · atualizados: ${updated}${replaced ? ` (${replaced} vindos de outra fonte, substituídos por esta coleta mais completa)` : ""}`);
    if (skipped.length) console.log(`Já importados por outra fonte (ignorados): ${skipped.length}\n  ${skipped.slice(0, 20).join("\n  ")}`);
    if (missingCodes.size) console.log(`Códigos fora do catálogo (cartas ignoradas nas listas): ${[...missingCodes].sort().join(", ")}`);
    if (!apply) console.log("Para gravar: node prisma/import-tournaments.mjs --file=… --apply");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
