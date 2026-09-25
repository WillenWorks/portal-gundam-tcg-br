#!/usr/bin/env node
/**
 * Matriz de confrontos entre os decks do pool (spec bot-zero-system-forte): para
 * cada par de decks, N partidas com o mesmo nível nos dois lados (assento
 * alternado), taxa do deck da linha contra o da coluna. Base do counter do Zero
 * System (escolhe o melhor deck contra o deck do jogador) e do baseline "melhor
 * deck meta fixo". Grava `docs/bot/matchups-AAAA-MM-DD.json`.
 *
 *   pnpm gundam:bot:matchups
 *   pnpm gundam:bot:matchups -- --level=normal --games=10 --pool=all --seed=1
 */
import { register } from "tsx/esm/api";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

register();

const ROOT = path.resolve(import.meta.dirname, "..");
const sim = (p) => pathToFileURL(path.join(ROOT, "src/modules/simulator", p)).href;

const { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } = await import(sim("content/index.ts"));
const { deckPool, BENCHMARK_POOLS } = await import(sim("fixtures/benchmarkDeckPools.ts"));
const { runSelfPlay } = await import(sim("engine/selfPlay.ts"));
const { MEASURABLE_LEVELS, policyForLevel } = await import(sim("engine/bot/levelPolicies.ts"));

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const level = String(args.level ?? "normal");
const pool = String(args.pool ?? "all");
const games = Number(args.games ?? 10);
const seed = Number(args.seed ?? 1);
const maxTurns = Number(args.maxTurns ?? 40);
if (!MEASURABLE_LEVELS.includes(level)) {
  console.error(`[matchups] nível desconhecido "${level}" — use ${MEASURABLE_LEVELS.join(", ")}`);
  process.exit(2);
}
if (!BENCHMARK_POOLS.includes(pool)) {
  console.error(`[matchups] pool desconhecido "${pool}" — use ${BENCHMARK_POOLS.join(", ")}`);
  process.exit(2);
}

const opts = { specs: ALL_EFFECT_SPECS, predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };
const decks = deckPool(pool);
const ids = decks.map((d) => d.id);
// wins[i][j] = vitórias do deck i contra o j (empate = 0,5); games[i][j] = partidas válidas
const wins = ids.map(() => ids.map(() => 0));
const played = ids.map(() => ids.map(() => 0));
const excluded = [];
const pairs = (ids.length * (ids.length - 1)) / 2;
const total = pairs * games;
const started = Date.now();
let done = 0;
let gameIndex = 0;
console.log(`[matchups] nível=${level} pool=${pool} (${ids.length} decks) partidas/par=${games} total=${total}`);

for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    for (let g = 0; g < games; g++) {
      // assento alternado: metade das partidas o deck i começa como A
      const iIsA = g % 2 === 0;
      const [a, b] = iIsA ? [i, j] : [j, i];
      const s = seed * 100_003 + gameIndex++;
      const result = runSelfPlay({
        deckA: decks[a].build(),
        deckB: decks[b].build(),
        seed: s,
        maxTurns,
        policyA: policyForLevel(level, opts),
        policyB: policyForLevel(level, opts),
        ...opts,
      });
      done++;
      if (result.crashed || result.illegalState) {
        excluded.push({ a: ids[a], b: ids[b], seed: s, error: result.crashed?.error ?? result.illegalState });
      } else {
        const scoreA = result.winner === "A" ? 1 : result.winner === "B" ? 0 : 0.5;
        wins[a][b] += scoreA;
        wins[b][a] += 1 - scoreA;
        played[a][b]++;
        played[b][a]++;
      }
      if (done % 20 === 0 || done === total) console.log(`[matchups] ${done}/${total} — ${((Date.now() - started) / 1000).toFixed(0)}s`);
    }
  }
}

const rate = ids.map((_, i) => ids.map((_, j) => (i === j || played[i][j] === 0 ? null : wins[i][j] / played[i][j])));
const average = ids.map((id, i) => {
  const rates = rate[i].filter((r) => r !== null);
  return { id, average: rates.reduce((s, r) => s + r, 0) / rates.length };
});
average.sort((x, y) => y.average - x.average);
console.log("\n[matchups] taxa média contra o pool:");
for (const a of average) console.log(`  ${a.id.padEnd(28)} ${(a.average * 100).toFixed(1)}%`);

let commit = "desconhecido";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
} catch {
  console.warn("[matchups] não foi possível ler o commit — gravando 'desconhecido'");
}
const date = new Date().toISOString().slice(0, 10);
const outPath = path.resolve(ROOT, String(args.out ?? `docs/bot/matchups-${date}.json`));
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  `${JSON.stringify({ date, commit, params: { level, pool, gamesPerPair: games, seed, maxTurns }, durationSeconds: Math.round((Date.now() - started) / 1000), decks: ids, wins, played, rate, average, excluded }, null, 2)}\n`,
);
console.log(`\n[matchups] relatório: ${path.relative(ROOT, outPath)}`);
