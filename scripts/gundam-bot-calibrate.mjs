#!/usr/bin/env node
/**
 * Fase A do spec bot-zero-system-forte: calibra os pesos da avaliação de posição
 * (`EvalWeights`) por busca de coordenadas. Cada candidato = pesos atuais com UM peso
 * multiplicado por um fator; mede o planejador de turno com o candidato contra o
 * planejador com os pesos atuais (proxy barato do Zero System: ~5 s/partida vs ~60 s
 * do MCTS), no pool `calib`, assento e decks alternados. Aceita o candidato se
 * vencer em ≥ `--accept` (default 0,57). Grava `docs/bot/calib-AAAA-MM-DD.json`.
 *
 *   pnpm gundam:bot:calibrate
 *   pnpm gundam:bot:calibrate -- --games=60 --sweeps=2 --factors=0.5,1.6 --seed=11
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
const { deckPool } = await import(sim("fixtures/benchmarkDeckPools.ts"));
const { runLadder } = await import(sim("engine/bot/ladder.ts"));
const { EVAL_WEIGHTS } = await import(sim("engine/bot/evaluation.ts"));
const { heuristicPolicy } = await import(sim("engine/bot/heuristicPolicy.ts"));
const { turnPlannerPolicy } = await import(sim("engine/bot/turnPlanner.ts"));

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const games = Number(args.games ?? 60);
const sweeps = Number(args.sweeps ?? 2);
const factors = String(args.factors ?? "0.5,1.6").split(",").map(Number);
const accept = Number(args.accept ?? 0.57);
const pool = String(args.pool ?? "calib");
let seed = Number(args.seed ?? 11);
const maxTurns = Number(args.maxTurns ?? 40);

const opts = { specs: ALL_EFFECT_SPECS, predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };
const decks = deckPool(pool);
const planner = (weights) => turnPlannerPolicy(heuristicPolicy({ level: "normal", lookahead: opts }), { ...opts, weights });

/** taxa do candidato contra os pesos atuais */
function duel(current, candidate) {
  const result = runLadder({
    levels: ["current", "candidate"],
    decks,
    gamesPerLevelPair: games,
    maxTurns,
    seed: seed++,
    ...opts,
    policyFactory: (level) => planner(level === "candidate" ? candidate : current),
  });
  const rate = result.neighborRates[0];
  return { rate: rate.rate, score: rate.upperScore, games: rate.games, wilson: rate.wilson, excluded: result.excluded.length };
}

const started = Date.now();
let best = { ...EVAL_WEIGHTS };
const history = [];
const keys = Object.keys(best);
console.log(`[calibrate] pool=${pool} (${decks.length} decks) partidas/candidato=${games} fatores=${factors.join(",")} aceite≥${accept}`);
console.log(`[calibrate] início: ${JSON.stringify(best)}`);
for (let sweep = 1; sweep <= sweeps; sweep++) {
  let changed = false;
  for (const key of keys) {
    for (const factor of factors) {
      const candidate = { ...best, [key]: Math.round(best[key] * factor * 1000) / 1000 };
      const r = duel(best, candidate);
      const accepted = r.rate >= accept;
      history.push({ sweep, key, factor, candidate, ...r, accepted });
      console.log(`  sweep ${sweep} ${key}×${factor} → ${(r.rate * 100).toFixed(1)}% (${r.score}/${r.games})${accepted ? " ACEITO" : ""}  (${((Date.now() - started) / 1000).toFixed(0)}s)`);
      if (accepted) {
        best = candidate;
        changed = true;
        break; // próximo peso a partir do novo ponto
      }
    }
  }
  if (!changed) {
    console.log(`[calibrate] sweep ${sweep} sem mudança — parou`);
    break;
  }
}
console.log(`\n[calibrate] pesos finais: ${JSON.stringify(best)}`);

let commit = "desconhecido";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
} catch {
  console.warn("[calibrate] não foi possível ler o commit — gravando 'desconhecido'");
}
const date = new Date().toISOString().slice(0, 10);
const outPath = path.resolve(ROOT, String(args.out ?? `docs/bot/calib-${date}.json`));
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify({ date, commit, params: { pool, games, sweeps, factors, accept, maxTurns }, durationSeconds: Math.round((Date.now() - started) / 1000), start: EVAL_WEIGHTS, best, history }, null, 2)}\n`);
console.log(`[calibrate] relatório: ${path.relative(ROOT, outPath)}`);
