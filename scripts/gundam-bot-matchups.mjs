#!/usr/bin/env node
/**
 * Matriz de confrontos entre os decks do pool (spec bot-zero-system-forte /
 * bot-dados-pool): para cada par de decks, N partidas com o mesmo nível nos dois
 * lados (assento alternado), taxa do deck da linha contra o da coluna. Base do
 * counter do Zero System. Em paralelo com `--workers` — mesmo resultado que em
 * série (cada partida tem seed e assento fixos). Grava `docs/bot/matchups-AAAA-MM-DD.json`.
 *
 *   pnpm gundam:bot:matchups
 *   pnpm gundam:bot:matchups -- --pool=all --games=10 --workers=4
 *   pnpm gundam:bot:matchups -- --pool=docs/bot/pool-db-2026-09-25.json
 */
import { register } from "tsx/esm/api";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

register();

const ROOT = path.resolve(import.meta.dirname, "..");
const sim = (p) => pathToFileURL(path.join(ROOT, "src/modules/simulator", p)).href;
const runnerUrl = pathToFileURL(path.join(ROOT, "scripts/lib/matchupRunner.mjs")).href;

const { MEASURABLE_LEVELS } = await import(sim("engine/bot/levelPolicies.ts"));
const { planMatchupGames, splitForWorkers, aggregateMatchups, defaultWorkerCount } = await import(sim("engine/bot/matchupPlan.ts"));
const { resolvePool, runPlannedGames } = await import(runnerUrl);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const level = String(args.level ?? "normal");
const poolSpec = String(args.pool ?? "all");
const games = Number(args.games ?? 10);
const seed = Number(args.seed ?? 1);
const maxTurns = Number(args.maxTurns ?? 40);
const workers = args.workers ? Number(args.workers) : defaultWorkerCount({ cpus: os.cpus().length, freeMemBytes: os.freemem() });
if (!MEASURABLE_LEVELS.includes(level)) {
  console.error(`[matchups] nível desconhecido "${level}" — use ${MEASURABLE_LEVELS.join(", ")}`);
  process.exit(2);
}

let decks;
try {
  decks = resolvePool(poolSpec);
} catch (err) {
  console.error(`[matchups] ${err instanceof Error ? err.message : err}`);
  process.exit(2);
}
const ids = decks.map((d) => d.id);
const plan = planMatchupGames({ decks: ids.length, gamesPerPair: games, seed });
const parts = splitForWorkers(plan, workers);
const started = Date.now();
const results = [];
const onResult = (r) => {
  results.push(r);
  if (results.length % 20 === 0 || results.length === plan.length) {
    console.log(`[matchups] ${results.length}/${plan.length} — ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
};
console.log(`[matchups] nível=${level} pool=${poolSpec} (${ids.length} decks) partidas/par=${games} total=${plan.length} workers=${parts.length}`);

if (parts.length === 1) {
  runPlannedGames({ poolSpec, level, maxTurns, games: plan }, onResult);
} else {
  const workerUrl = new URL(pathToFileURL(path.join(ROOT, "scripts/lib/matchupWorker.mjs")));
  await Promise.all(
    parts.map(
      (part) =>
        new Promise((resolve, reject) => {
          const worker = new Worker(workerUrl, { workerData: { runnerUrl, poolSpec, level, maxTurns, games: part } });
          worker.on("message", (msg) => {
            if (msg.type === "result") onResult(msg.result);
            else if (msg.type === "done") resolve();
          });
          worker.on("error", reject);
          worker.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker saiu com código ${code}`))));
        }),
    ),
  );
}

const { wins, played, rate, excluded } = aggregateMatchups(ids.length, results);
const average = ids.map((id, i) => {
  const rates = rate[i].filter((r) => r !== null);
  return { id, average: rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : null };
});
average.sort((x, y) => (y.average ?? -1) - (x.average ?? -1));
console.log("\n[matchups] taxa média contra o pool:");
for (const a of average) console.log(`  ${a.id.padEnd(28)} ${a.average === null ? "-" : `${(a.average * 100).toFixed(1)}%`}`);
if (excluded.length) console.log(`[matchups] ${excluded.length} partida(s) excluída(s) (crash/estado ilegal)`);

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
  `${JSON.stringify({ date, commit, params: { level, pool: poolSpec, gamesPerPair: games, seed, maxTurns, workers: parts.length }, durationSeconds: Math.round((Date.now() - started) / 1000), decks: ids, wins, played, rate, average, excluded }, null, 2)}\n`,
);
console.log(`\n[matchups] relatório: ${path.relative(ROOT, outPath)}`);
