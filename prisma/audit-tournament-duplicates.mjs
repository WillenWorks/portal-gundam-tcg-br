/**
 * Auditoria (só leitura): torneios que continuam no banco em duas fontes ao mesmo tempo (ex.: o mesmo regional
 * vindo da Egman e da DigiLab), pela mesma regra do importador (crossSourceDuplicate). Só avisa (::warning:: no
 * Actions): não para o resto da coleta.
 *
 *   node --env-file=.env prisma/audit-tournament-duplicates.mjs
 */
import { pathToFileURL } from "node:url";
import { crossSourceDuplicate } from "./import-tournaments.mjs";

const DAY_MS = 86_400_000;

/** pares [a, b] de torneios do banco que são o mesmo evento em fontes diferentes */
export function findDuplicatePairs(tournaments) {
  const rows = tournaments.filter((t) => t.dateStart).sort((a, b) => a.dateStart - b.dateStart);
  const pairs = [];
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i];
    const nearby = [];
    for (let j = i + 1; j < rows.length && rows[j].dateStart - t.dateStart <= DAY_MS; j++) nearby.push(rows[j]);
    if (!nearby.length) continue;
    const ev = {
      sourceUrl: t.sourceUrl,
      format: t.season,
      date: t.dateStart.toISOString().slice(0, 10),
      entries: t.entries.map((e) => ({ player: e.playerName, placement: e.placement })),
    };
    const candidates = nearby.map((c) => ({
      id: c.id,
      sourceUrl: c.sourceUrl,
      season: c.season,
      date: c.dateStart.toISOString(),
      champion: c.entries.find((e) => e.placement === 1)?.playerName ?? null,
      players: c.entries.map((e) => e.playerName),
    }));
    const dup = crossSourceDuplicate(ev, candidates);
    if (dup) pairs.push([t, rows.find((r) => r.id === dup.id)]);
  }
  return pairs;
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const tournaments = await prisma.tournament.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sourceUrl: true, season: true, dateStart: true, entries: { select: { playerName: true, placement: true } } },
    });
    const pairs = findDuplicatePairs(tournaments);
    console.log(`Torneios ativos: ${tournaments.length} · mesmo evento em duas fontes: ${pairs.length}`);
    for (const [a, b] of pairs.slice(0, 30)) console.log(`  ${a.dateStart.toISOString().slice(0, 10)} ${a.name} (${a.sourceUrl}) = ${b.name} (${b.sourceUrl})`);
    if (pairs.length) console.log(`::warning::${pairs.length} torneio(s) em duas fontes — ver a lista acima`);
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
