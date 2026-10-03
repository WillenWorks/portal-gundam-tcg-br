#!/usr/bin/env node
/**
 * Junta as fatias (`--shard=i/n`) de uma matriz de confrontos num relatório só, no mesmo formato
 * do `gundam-bot-matchups.mjs`. As fatias precisam ter a mesma lista de decks e os mesmos parâmetros.
 *
 *   node scripts/gundam-bot-merge.mjs --out=docs/bot/matchups-head.json parte-0.json parte-1.json …
 */
import { register } from "tsx/esm/api";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

register();

const ROOT = path.resolve(import.meta.dirname, "..");
const { aggregateMatchups } = await import(pathToFileURL(path.join(ROOT, "src/modules/simulator/engine/bot/matchupPlan.ts")).href);

const argv = process.argv.slice(2);
const outArg = argv.find((a) => a.startsWith("--out="));
const files = argv.filter((a) => !a.startsWith("--"));
if (!outArg || files.length === 0) {
  console.error("uso: gundam-bot-merge.mjs --out=saida.json parte-0.json [parte-1.json …]");
  process.exit(2);
}

const parts = files.map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
const first = parts[0];
const sameParams = (p) => {
  const { shard: _a, workers: _b, ...rest } = p.params;
  const { shard: _c, workers: _d, ...ref } = first.params;
  return JSON.stringify(rest) === JSON.stringify(ref);
};
for (const [i, p] of parts.entries()) {
  if (!Array.isArray(p.results)) throw new Error(`${files[i]}: sem "results" — gere com a versão atual do gundam-bot-matchups.mjs`);
  if (JSON.stringify(p.decks) !== JSON.stringify(first.decks)) throw new Error(`${files[i]}: lista de decks diferente da 1ª fatia`);
  if (!sameParams(p)) throw new Error(`${files[i]}: parâmetros diferentes da 1ª fatia`);
}

const byIndex = new Map();
for (const p of parts) for (const r of p.results) byIndex.set(r.index, r);
const results = [...byIndex.values()].sort((x, y) => x.index - y.index);
const ids = first.decks;
const aggregate = aggregateMatchups(ids.length, results);
const average = ids.map((id, i) => {
  const rates = aggregate.rate[i].filter((r) => r !== null);
  return { id, average: rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : null };
});
average.sort((x, y) => (y.average ?? -1) - (x.average ?? -1));
const excluded = aggregate.excluded.map((r) => ({ deckA: ids[r.a], deckB: ids[r.b], seed: r.seed, error: r.error }));

const out = path.resolve(outArg.slice("--out=".length));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  `${JSON.stringify(
    {
      date: first.date,
      commit: first.commit,
      params: { ...first.params, shard: null, shards: parts.length, workers: null },
      durationSeconds: Math.max(...parts.map((p) => p.durationSeconds)),
      decks: ids,
      wins: aggregate.wins,
      played: aggregate.played,
      rate: aggregate.rate,
      average,
      excluded,
      results,
    },
    null,
    2,
  )}\n`,
);
console.log(`[bot-merge] ${parts.length} fatia(s), ${results.length} partida(s) → ${path.relative(process.cwd(), out)}`);
