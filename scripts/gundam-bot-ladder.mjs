#!/usr/bin/env node
/**
 * Escada de Elo do bot (spec bot-avaliacao-forca): round-robin entre níveis sobre
 * um pool de decks, Elo (Bradley–Terry, random = 0) com intervalo de confiança,
 * taxa entre degraus vizinhos e contra o random. Grava `docs/bot/ladder-AAAA-MM-DD.json`.
 *
 *   pnpm gundam:bot:ladder                                  # padrão (ver DEFAULTS)
 *   pnpm gundam:bot:ladder -- --levels=random,facil,normal  # só alguns níveis
 *   pnpm gundam:bot:ladder -- --pool=meta-gd02 --games=40
 *   pnpm gundam:bot:ladder -- --rollouts=4                  # MCTS (difícil) mais barato
 *   pnpm gundam:bot:ladder -- --out=docs/bot/x.json --seed=2
 *
 * Metas (spec): cada degrau vence o anterior em ≥ 60% com o intervalo de Wilson
 * acima de 50%; todo nível vence o random em ≥ 95%.
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
const { runLadder } = await import(sim("engine/bot/ladder.ts"));
const { BOT_LEVELS, MEASURABLE_LEVELS, DIFICIL_ROLLOUTS } = await import(sim("engine/bot/levelPolicies.ts"));

const DEFAULTS = { levels: BOT_LEVELS.join(","), pool: "all", games: 20, maxTurns: 40, seed: 1 };
const STEP_GOAL = 0.6;
const VS_RANDOM_GOAL = 0.95;

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const levels = String(args.levels ?? DEFAULTS.levels).split(",");
const unknown = levels.filter((l) => !MEASURABLE_LEVELS.includes(l));
if (unknown.length) {
  console.error(`[ladder] nível desconhecido: ${unknown.join(", ")} — use ${MEASURABLE_LEVELS.join(", ")}`);
  process.exit(2);
}
const pool = String(args.pool ?? DEFAULTS.pool);
if (!BENCHMARK_POOLS.includes(pool)) {
  console.error(`[ladder] pool desconhecido "${pool}" — use ${BENCHMARK_POOLS.join(", ")}`);
  process.exit(2);
}
const games = Number(args.games ?? DEFAULTS.games);
const maxTurns = Number(args.maxTurns ?? DEFAULTS.maxTurns);
const seed = Number(args.seed ?? DEFAULTS.seed);
const rollouts = args.rollouts ? Number(args.rollouts) : undefined;
const decks = deckPool(pool);

const total = (levels.length * (levels.length - 1) / 2) * games;
let done = 0;
const started = Date.now();
console.log(`[ladder] níveis=${levels.join(",")} pool=${pool} (${decks.length} decks) partidas/par=${games} total=${total}`);

const result = runLadder({
  levels,
  decks,
  gamesPerLevelPair: games,
  maxTurns,
  seed,
  specs: ALL_EFFECT_SPECS,
  predicateResolver: defaultPredicateResolver,
  targetFilterResolver: defaultTargetFilterResolver,
  mctsRollouts: rollouts,
  onGame: (g) => {
    done++;
    if (g.error) console.error(`[ladder] EXCLUÍDA ${g.levelA} x ${g.levelB} (${g.deckA} x ${g.deckB}) seed ${g.seed}: ${g.error}`);
    if (done % 10 === 0 || done === total) {
      console.log(`[ladder] ${done}/${total} partidas — ${((Date.now() - started) / 1000).toFixed(0)}s`);
    }
  },
});

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const steps = result.neighborRates.map((r) => ({
  ...r,
  meetsGoal: r.rate >= STEP_GOAL && r.wilson.low > 0.5,
}));
const vsRandom = result.vsAnchor.map((r) => ({ ...r, meetsGoal: r.rate >= VS_RANDOM_GOAL }));

console.log("\n[ladder] Elo (random = 0), IC 95% por bootstrap:");
for (const level of levels) {
  const ci = result.ci[level];
  console.log(`  ${level.padEnd(12)} ${String(Math.round(result.elo[level] ?? NaN)).padStart(6)}   [${Math.round(ci?.low ?? NaN)}, ${Math.round(ci?.high ?? NaN)}]`);
}
console.log("\n[ladder] Degraus (meta ≥ 60% e Wilson > 50%):");
for (const s of steps) {
  console.log(`  ${s.upper} sobre ${s.lower}: ${pct(s.rate)} (${s.upperScore}/${s.games}) Wilson [${pct(s.wilson.low)}, ${pct(s.wilson.high)}] ${s.meetsGoal ? "OK" : "ABAIXO"}`);
}
console.log("\n[ladder] Contra random (meta ≥ 95%):");
for (const s of vsRandom) console.log(`  ${s.upper}: ${pct(s.rate)} (${s.upperScore}/${s.games}) ${s.meetsGoal ? "OK" : "ABAIXO"}`);
if (result.excluded.length) console.log(`\n[ladder] ${result.excluded.length} partida(s) excluída(s) por crash/estado ilegal — ver acima.`);

let commit = "desconhecido";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
} catch {
  console.warn("[ladder] não foi possível ler o commit (git indisponível) — gravando 'desconhecido'");
}
const date = new Date().toISOString().slice(0, 10);
const outPath = path.resolve(ROOT, String(args.out ?? `docs/bot/ladder-${date}.json`));
const report = {
  date,
  commit,
  params: {
    levels,
    pool,
    decks: decks.map((d) => ({ id: d.id, knownGaps: d.knownGaps })),
    gamesPerLevelPair: games,
    maxTurns,
    seed,
    dificilRollouts: rollouts ?? DIFICIL_ROLLOUTS,
  },
  durationSeconds: Math.round((Date.now() - started) / 1000),
  elo: result.elo,
  ci: result.ci,
  steps,
  vsRandom,
  excluded: result.excluded,
  undecided: result.games.filter((g) => !g.error && g.winnerLevel === null).length,
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\n[ladder] relatório: ${path.relative(ROOT, outPath)}`);
