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
 *
 * Para comparar versões e não gastar a máquina (ver `gundam-bot-bench-compare.mjs` e `.github/workflows/bot-bench.yml`):
 *   --listDecks          imprime os ids do pool em JSON e sai
 *   --decks=a,b,c        joga só esses decks, nesta ordem (mesma lista nos 2 lados = mesmas seeds)
 *   --focus=a,b          só os pares que envolvem esses decks (as seeds não mudam: filtra o plano)
 *   --shard=i/n          só a fatia i (0-based) de n do plano — para dividir entre máquinas/jobs
 *   --nice               prioridade baixa do processo (e dos workers): a máquina continua usável
 *   --out=caminho.json   onde gravar (o relatório leva as partidas cruas, `results`, para o merge)
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
const { resolvePool, selectDecks, runPlannedGames } = await import(runnerUrl);

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
if (args.nice === "true") {
  // antes de criar os workers: as threads novas herdam a prioridade
  try {
    os.setPriority(0, os.constants.priority.PRIORITY_LOW);
  } catch (err) {
    console.warn(`[matchups] não consegui baixar a prioridade: ${err instanceof Error ? err.message : err}`);
  }
}
if (!MEASURABLE_LEVELS.includes(level)) {
  console.error(`[matchups] nível desconhecido "${level}" — use ${MEASURABLE_LEVELS.join(", ")}`);
  process.exit(2);
}

const deckIds = args.decks ? String(args.decks).split(",").filter(Boolean) : undefined;
let decks;
try {
  decks = selectDecks(resolvePool(poolSpec), deckIds);
} catch (err) {
  console.error(`[matchups] ${err instanceof Error ? err.message : err}`);
  process.exit(2);
}
const ids = decks.map((d) => d.id);
if (args.listDecks === "true") {
  console.log(JSON.stringify(ids));
  process.exit(0);
}
const focus = args.focus ? String(args.focus).split(",").filter(Boolean) : [];
for (const id of focus) {
  if (!ids.includes(id)) {
    console.error(`[matchups] --focus: deck "${id}" não está no pool`);
    process.exit(2);
  }
}
const shardMatch = args.shard ? /^(\d+)\/(\d+)$/.exec(String(args.shard)) : null;
if (args.shard && (!shardMatch || Number(shardMatch[1]) >= Number(shardMatch[2]))) {
  console.error(`[matchups] --shard deve ser i/n com 0 <= i < n (recebi "${args.shard}")`);
  process.exit(2);
}
const plan = planMatchupGames({ decks: ids.length, gamesPerPair: games, seed })
  .filter((g) => focus.length === 0 || focus.includes(ids[g.a]) || focus.includes(ids[g.b]))
  .filter((_, k) => !shardMatch || k % Number(shardMatch[2]) === Number(shardMatch[1]));
const parts = splitForWorkers(plan, workers);
const started = Date.now();
const results = [];
const onResult = (r) => {
  results.push(r);
  if (results.length % 20 === 0 || results.length === plan.length) {
    console.log(`[matchups] ${results.length}/${plan.length} — ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
};
console.log(
  `[matchups] nível=${level} pool=${poolSpec} (${ids.length} decks) partidas/par=${games} total=${plan.length} workers=${parts.length}` +
    (focus.length ? ` foco=${focus.join(",")}` : "") +
    (shardMatch ? ` shard=${args.shard}` : ""),
);

if (parts.length === 1) {
  runPlannedGames({ poolSpec, deckIds: ids, level, maxTurns, games: plan }, onResult);
} else {
  const workerUrl = new URL(pathToFileURL(path.join(ROOT, "scripts/lib/matchupWorker.mjs")));
  const workerList = [];
  await Promise.all(
    parts.map(
      (part) =>
        new Promise((resolve, reject) => {
          const worker = new Worker(workerUrl, { workerData: { runnerUrl, poolSpec, deckIds: ids, level, maxTurns, games: part } });
          workerList.push(worker);
          worker.on("message", (msg) => {
            if (msg.type === "result") onResult(msg.result);
            else if (msg.type === "done") resolve();
          });
          worker.on("error", reject);
          worker.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker saiu com código ${code}`))));
        }),
    ),
  ).catch(async (err) => {
    // um worker falhou: para os outros em vez de deixá-los gastando CPU
    await Promise.all(workerList.map((w) => w.terminate()));
    console.error(`[matchups] ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
}

const aggregate = aggregateMatchups(ids.length, results);
const { wins, played, rate } = aggregate;
// no relatório, decks pelo id (não pelo índice) + seed, como a escada faz
const excluded = aggregate.excluded.map((r) => ({ deckA: ids[r.a], deckB: ids[r.b], seed: r.seed, error: r.error }));
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
  `${JSON.stringify({ date, commit, params: { level, pool: poolSpec, gamesPerPair: games, seed, maxTurns, workers: parts.length, focus, shard: args.shard ?? null }, durationSeconds: Math.round((Date.now() - started) / 1000), decks: ids, wins, played, rate, average, excluded, results: [...results].sort((x, y) => x.index - y.index) }, null, 2)}\n`,
);
console.log(`\n[matchups] relatório: ${path.relative(ROOT, outPath)}`);
