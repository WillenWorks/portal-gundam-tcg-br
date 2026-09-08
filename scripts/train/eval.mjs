/*
 * train:eval — O GATE (docs/50). Avalia `neuralPolicy` contra `heuristic` e
 * contra `mcts` (ou `randomLegal` se a Lane 4A ainda não mergeou), em 200
 * partidas de seed fixo por par de decks validados.
 *
 * Critério de promoção (documentado — NÃO roda em todo PR, é caro; rodar
 * nightly / on-demand):
 *   1. winrate(neural vs heuristic) > 55%  (agregado)
 *   2. `pnpm gundam:golden` continua verde  (neuralPolicy não toca o motor —
 *      passa trivial; confirmar à parte)
 *
 * Uso:
 *   pnpm train:eval --model=services/sim-trainer/models/<sha>
 *   pnpm train:eval --model=<dir> --games=50 --decks=ST01,ST02
 *   pnpm train:eval --model=<dir> --strict     # exit 1 se REPROVADO (pra nightly)
 */

import path from "node:path";
import process from "node:process";

import {
  ENGINE_ROOT,
  runSelfPlay,
  heuristicPolicy,
  neuralPolicy,
  randomLegal,
  mctsPolicy,
  ALL_EFFECT_SPECS,
  defaultPredicateResolver,
  defaultTargetFilterResolver,
  validatedDeckList,
  validatedDeckPairs,
} from "./engine.mjs";
import { readModelArtifacts } from "./model.mjs";

const PROMOTION_THRESHOLD = 0.55;
const MAX_TURNS = 60;
const BASE_SEED = 20260907;

function parseArgs(argv) {
  const args = { model: null, games: 200, decks: null, strict: false };
  for (const a of argv) {
    if (a === "--strict") {
      args.strict = true;
      continue;
    }
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "model") args.model = v;
    else if (k === "games") args.games = Number(v);
    else if (k === "decks") args.decks = v.split(",").map((s) => s.trim().toUpperCase());
  }
  return args;
}

/** roda `games` partidas do par, alternando o assento do bot neural. Devolve winrate + turnos médios. */
function playMatchup(deckA, deckB, neuralFn, oppFn, games) {
  let neuralWins = 0;
  let decided = 0;
  let turnsSum = 0;
  for (let g = 0; g < games; g++) {
    const neuralIsA = g % 2 === 0;
    const result = runSelfPlay({
      deckA: deckA.build(),
      deckB: deckB.build(),
      seed: BASE_SEED + g,
      maxTurns: MAX_TURNS,
      specs: ALL_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
      policyA: neuralIsA ? neuralFn : oppFn,
      policyB: neuralIsA ? oppFn : neuralFn,
    });
    turnsSum += result.turns;
    if (result.winner === null) continue;
    decided++;
    const neuralSeat = neuralIsA ? "A" : "B";
    if (result.winner === neuralSeat) neuralWins++;
  }
  return {
    winrate: decided > 0 ? neuralWins / decided : 0,
    decided,
    games,
    avgTurns: turnsSum / games,
  };
}

async function runSuite(label, neuralFn, oppFn, pairs, games) {
  console.log(`\n[train:eval] === neural vs ${label} (${games} partidas/par) ===`);
  let wSum = 0;
  let dSum = 0;
  let tSum = 0;
  for (const [deckA, deckB] of pairs) {
    const r = playMatchup(deckA, deckB, neuralFn, oppFn, games);
    wSum += r.winrate * r.decided;
    dSum += r.decided;
    tSum += r.avgTurns;
    console.log(
      `[train:eval]   ${deckA.id} x ${deckB.id}: winrate ${(r.winrate * 100).toFixed(1)}% (${r.decided}/${r.games} decididas) | ${r.avgTurns.toFixed(1)} turnos`,
    );
  }
  const agg = dSum > 0 ? wSum / dSum : 0;
  console.log(`[train:eval]   AGREGADO: winrate ${(agg * 100).toFixed(1)}% | ${(tSum / pairs.length).toFixed(1)} turnos médios`);
  return agg;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.model) {
    console.error("[train:eval] faltou --model=<dir do modelo>");
    process.exit(2);
  }
  const modelDir = path.resolve(ENGINE_ROOT, args.model);

  const handle = await neuralPolicy({
    modelDir,
    loadArtifacts: (dir) => readModelArtifacts(dir),
    fallbackLevel: "normal",
  });
  if (handle.usingFallback) {
    console.warn(`[train:eval] AVISO: modelo em ${modelDir} não carregou — rodando com o fallback heurístico.`);
  }
  const neuralFn = (view, legal, rng) => handle.chooseAction(view, legal, rng);

  const deckList = validatedDeckList();
  const byId = Object.fromEntries(deckList.map((d) => [d.id, d]));
  let pairs;
  if (args.decks) {
    const [a, b = a] = args.decks;
    if (!byId[a] || !byId[b]) {
      console.error(`Deck desconhecido: ${args.decks.join(",")}`);
      process.exit(2);
    }
    pairs = [[byId[a], byId[b]]];
  } else {
    pairs = validatedDeckPairs();
  }

  const heuristicFn = heuristicPolicy({ level: "normal" });
  const secondLabel = mctsPolicy ? "mcts" : "randomLegal";
  const secondFn = mctsPolicy ? mctsPolicy({ iterations: 80 }) : randomLegal;

  const started = Date.now();
  const vsHeuristic = await runSuite("heuristic (normal)", neuralFn, heuristicFn, pairs, args.games);
  const vsSecond = await runSuite(secondLabel, neuralFn, secondFn, pairs, args.games);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  const approved = vsHeuristic > PROMOTION_THRESHOLD;
  console.log(`\n[train:eval] ---------------------------------------------`);
  console.log(`[train:eval] tempo: ${elapsed}s`);
  console.log(`[train:eval] neural vs heuristic: ${(vsHeuristic * 100).toFixed(1)}%  (limiar de promoção: ${(PROMOTION_THRESHOLD * 100).toFixed(0)}%)`);
  console.log(`[train:eval] neural vs ${secondLabel}: ${(vsSecond * 100).toFixed(1)}%`);
  console.log(`[train:eval] VEREDITO: ${approved ? "APROVADO ✅" : "REPROVADO ❌"} (regra 1/2 — confirmar 'pnpm gundam:golden' verde para a regra 2/2)`);
  console.log(`[train:eval] ---------------------------------------------`);

  handle.dispose();
  if (args.strict && !approved) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
