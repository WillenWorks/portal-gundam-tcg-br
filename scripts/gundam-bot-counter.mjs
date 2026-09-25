#!/usr/bin/env node
/**
 * Fase B do spec bot-zero-system-forte: valida o counter do Zero System.
 *
 * 1. `--matrix=docs/bot/matchups-*.json --write-fixture` gera
 *    `src/modules/simulator/fixtures/zeroCounterMatchups.ts` a partir da matriz.
 * 2. Para cada deck D do pool: counter(D) × D e baseline × D (melhor deck médio),
 *    mesmo nível dos dois lados (default: difícil), assento alternado, seeds
 *    diferentes das da matriz (sem viés de seleção). Meta: counter ≥ 60% com
 *    Wilson > 50% no agregado e acima do baseline.
 *
 *   pnpm gundam:bot:counter -- --matrix=docs/bot/matchups-2026-09-24.json --write-fixture
 *   pnpm gundam:bot:counter -- --games=8 --level=dificil --seed=7
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

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const FIXTURE = path.join(ROOT, "src/modules/simulator/fixtures/zeroCounterMatchups.ts");
if (args.matrix) {
  const matrix = JSON.parse(fs.readFileSync(path.resolve(ROOT, String(args.matrix)), "utf8"));
  // matriz de um pool de arquivo (decks do banco): a fixture leva as listas, senão o
  // servidor não tem como montar esses decks
  const { BENCHMARK_POOLS } = await import(pathToFileURL(path.join(ROOT, "src/modules/simulator/fixtures/benchmarkDeckPools.ts")).href);
  let lists;
  if (!BENCHMARK_POOLS.includes(matrix.params.pool)) {
    const poolFile = JSON.parse(fs.readFileSync(path.resolve(ROOT, matrix.params.pool), "utf8"));
    lists = Object.fromEntries(poolFile.decks.filter((d) => matrix.decks.includes(d.id)).map((d) => [d.id, d.list]));
  }
  const body = `import type { MatchupTable } from "../engine/bot/zeroCounter";

/**
 * Matriz de confrontos que o counter do Zero System consulta (spec
 * bot-zero-system-forte). GERADA por \`pnpm gundam:bot:counter -- --matrix=… --write-fixture\`
 * a partir de ${path.basename(String(args.matrix))} (nível ${matrix.params.level},
 * ${matrix.params.gamesPerPair} partidas/par, commit ${matrix.commit}) — não editar à mão.
 */
export const ZERO_COUNTER_MATCHUPS: MatchupTable = ${JSON.stringify({ decks: matrix.decks, gamesPerPair: matrix.params.gamesPerPair, rate: matrix.rate.map((row) => row.map((r) => (r === null ? null : Math.round(r * 1000) / 1000))), ...(lists ? { lists } : {}) }, null, 2)};
`;
  if (args["write-fixture"]) {
    fs.writeFileSync(FIXTURE, body);
    console.log(`[counter] fixture gravada: ${path.relative(ROOT, FIXTURE)}`);
  }
  if (!args.games) process.exit(0);
}

const { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } = await import(sim("content/index.ts"));
const { ZERO_COUNTER_MATCHUPS } = await import(sim("fixtures/zeroCounterMatchups.ts"));
const { counterForPlayerDeck, poolForTable } = await import(sim("engine/bot/zeroCounter.ts"));
const { wilsonInterval } = await import(sim("engine/bot/ladder.ts"));
const { runSelfPlay } = await import(sim("engine/selfPlay.ts"));
const { MEASURABLE_LEVELS, policyForLevel } = await import(sim("engine/bot/levelPolicies.ts"));

if (ZERO_COUNTER_MATCHUPS.decks.length === 0) {
  console.error("[counter] matriz vazia — rode com --matrix=… --write-fixture primeiro");
  process.exit(2);
}
const level = String(args.level ?? "dificil");
if (!MEASURABLE_LEVELS.includes(level)) {
  console.error(`[counter] nível desconhecido "${level}"`);
  process.exit(2);
}
const games = Number(args.games ?? 8);
const seed = Number(args.seed ?? 7);
const maxTurns = Number(args.maxTurns ?? 40);
const opts = { specs: ALL_EFFECT_SPECS, predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };
// os decks da matriz (pool fixo ou listas embutidas na fixture)
const pool = poolForTable(ZERO_COUNTER_MATCHUPS);
const byId = new Map(pool.map((d) => [d.id, d]));
let gameIndex = 0;
const started = Date.now();

/** vitórias do deck `ours` contra `theirs` em `games` partidas, assento alternado */
function play(ours, theirs) {
  let score = 0;
  let valid = 0;
  for (let g = 0; g < games; g++) {
    const oursIsA = g % 2 === 0;
    const result = runSelfPlay({
      deckA: (oursIsA ? ours : theirs).build(),
      deckB: (oursIsA ? theirs : ours).build(),
      seed: seed * 1_000_003 + gameIndex++,
      maxTurns,
      policyA: policyForLevel(level, opts),
      policyB: policyForLevel(level, opts),
      ...opts,
    });
    if (result.crashed || result.illegalState) continue;
    valid++;
    const ourSeat = oursIsA ? "A" : "B";
    score += result.winner === ourSeat ? 1 : result.winner === null ? 0.5 : 0;
  }
  return { score, valid };
}

const rows = [];
let counterScore = 0;
let counterGames = 0;
let baselineScore = 0;
let baselineGames = 0;
console.log(`[counter] nível=${level} partidas por confronto=${games} decks=${pool.length}`);
for (const d of pool) {
  const { summary } = counterForPlayerDeck(d.build(), ZERO_COUNTER_MATCHUPS, pool);
  const counter = play(byId.get(summary.counterDeckId), d);
  // counter = baseline: o mesmo confronto serve pros dois (não joga duas vezes)
  const baseline = summary.fallback ? counter : play(byId.get(summary.baselineDeckId), d);
  counterScore += counter.score;
  counterGames += counter.valid;
  baselineScore += baseline.score;
  baselineGames += baseline.valid;
  rows.push({ deck: d.id, counter: summary.counterDeckId, fallback: summary.fallback, expected: summary.expectedRate, counterRate: counter.valid ? counter.score / counter.valid : null, baselineRate: baseline.valid ? baseline.score / baseline.valid : null, games: counter.valid });
  console.log(`  ${d.id.padEnd(28)} counter ${summary.counterDeckId.padEnd(26)} ${(100 * counter.score / Math.max(1, counter.valid)).toFixed(0)}%  baseline ${(100 * baseline.score / Math.max(1, baseline.valid)).toFixed(0)}%  (${((Date.now() - started) / 1000).toFixed(0)}s)`);
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const cw = wilsonInterval(counterScore, counterGames);
const bw = wilsonInterval(baselineScore, baselineGames);
const counterRate = counterScore / Math.max(1, counterGames);
const baselineRate = baselineScore / Math.max(1, baselineGames);
const meets = counterRate >= 0.6 && cw.low > 0.5 && counterRate > baselineRate;
console.log(`\n[counter] counter:  ${pct(counterRate)} (${counterScore}/${counterGames}) Wilson [${pct(cw.low)}, ${pct(cw.high)}]`);
console.log(`[counter] baseline: ${pct(baselineRate)} (${baselineScore}/${baselineGames}) Wilson [${pct(bw.low)}, ${pct(bw.high)}]`);
console.log(`[counter] meta (≥ 60%, Wilson > 50%, acima do baseline): ${meets ? "OK" : "ABAIXO"}`);

let commit = "desconhecido";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
} catch {
  console.warn("[counter] não foi possível ler o commit — gravando 'desconhecido'");
}
const date = new Date().toISOString().slice(0, 10);
const outPath = path.resolve(ROOT, String(args.out ?? `docs/bot/counter-${date}.json`));
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify({ date, commit, params: { level, games, seed, maxTurns }, durationSeconds: Math.round((Date.now() - started) / 1000), counter: { rate: counterRate, score: counterScore, games: counterGames, wilson: cw }, baseline: { rate: baselineRate, score: baselineScore, games: baselineGames, wilson: bw }, meetsGoal: meets, rows }, null, 2)}\n`);
console.log(`[counter] relatório: ${path.relative(ROOT, outPath)}`);
