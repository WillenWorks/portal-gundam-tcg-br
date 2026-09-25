#!/usr/bin/env node
/**
 * Pool de decks do bot a partir do banco (spec bot-dados-pool) — SÓ LEITURA.
 * Listas de torneio (`TournamentEntry → DeckSnapshot`) + decks `PUBLIC`, com o
 * mesmo gate de cobertura do Treino Solo; dedupe por lista; opcionalmente soma os
 * pools fixos. Grava `docs/bot/pool-db-AAAA-MM-DD.json` (entrada de
 * `gundam:bot:matchups --pool-file=` e da fixture do counter).
 *
 *   pnpm gundam:bot:pool-export
 *   pnpm gundam:bot:pool-export -- --max=40 --with-fixed --no-public
 */
import { register } from "tsx/esm/api";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

register();

const ROOT = path.resolve(import.meta.dirname, "..");
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const max = Number(args.max ?? 40);
const withFixed = Boolean(args["with-fixed"]);
const includePublic = !args["no-public"];

const { buildBotDeckPool } = await import(pathToFileURL(path.join(ROOT, "server/botDeckPool.ts")).href);
const { deckPool, toPoolFileDeck } = await import(pathToFileURL(path.join(ROOT, "src/modules/simulator/fixtures/benchmarkDeckPools.ts")).href);

const prisma = new PrismaClient();
const itemInclude = { items: { include: { card: { select: { code: true } } } } };
let candidates = [];
try {
  const entries = await prisma.tournamentEntry.findMany({
    where: { deckSnapshotId: { not: null }, tournament: { deletedAt: null } },
    include: { tournament: { select: { name: true } }, deckSnapshot: { include: itemInclude } },
  });
  for (const e of entries) {
    if (!e.deckSnapshot) continue;
    candidates.push({
      id: `T-${e.id}`,
      label: `${e.archetype ?? e.deckSnapshot.name} — ${e.tournament.name}${e.placement ? ` #${e.placement}` : ""}`,
      source: "tournament",
      archetype: e.archetype,
      placement: e.placement,
      deck: { name: e.deckSnapshot.name, items: e.deckSnapshot.items },
    });
  }
  if (includePublic) {
    const decks = await prisma.deck.findMany({ where: { visibility: "PUBLIC" }, include: itemInclude });
    for (const d of decks) candidates.push({ id: `D-${d.id}`, label: d.name, source: "public", deck: { name: d.name, items: d.items } });
  }
} catch (err) {
  console.error(`[pool-export] falha ao ler o banco (nada foi gravado): ${err instanceof Error ? err.message : err}`);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}

const result = buildBotDeckPool(candidates, { max });
const decks = [...(withFixed ? deckPool("all").map((d) => toPoolFileDeck(d)) : []), ...result.decks];
console.log(`[pool-export] candidatos=${candidates.length} aceitos=${result.decks.length} duplicados=${result.duplicates} rejeitados=${result.rejected.length}${withFixed ? ` + ${decks.length - result.decks.length} fixos` : ""}`);
for (const r of result.rejected.slice(0, 20)) console.log(`  rejeitado ${r.label}: ${r.reason}`);
const pairs = (decks.length * (decks.length - 1)) / 2;
console.log(`[pool-export] matriz: ${decks.length} decks → ${pairs} pares (10 partidas/par ≈ ${Math.round((pairs * 10 * 5) / 60)} min de CPU no nível normal)`);

const date = new Date().toISOString().slice(0, 10);
const outPath = path.resolve(ROOT, String(args.out ?? `docs/bot/pool-db-${date}.json`));
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify({ date, decks, rejected: result.rejected, duplicates: result.duplicates }, null, 2)}\n`);
console.log(`[pool-export] relatório: ${path.relative(ROOT, outPath)}`);
