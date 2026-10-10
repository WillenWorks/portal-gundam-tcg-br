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
    const missingCodes = new Set();
    for (const ev of data.events) {
      const prepared = ev.entries.map((e) => ({ ...e, ...snapshotItems(e.main, printByCode) }));
      for (const e of prepared) for (const c of e.missing) missingCodes.add(c);
      const existing = await prisma.tournament.findFirst({ where: { sourceUrl: ev.sourceUrl }, select: { id: true } });
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
    console.log(`Torneios novos: ${created} · atualizados: ${updated}`);
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
