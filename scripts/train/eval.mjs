/*
 * train:eval — O GATE (docs/50). Avalia `neuralPolicy` contra `heuristic` e
 * contra `mcts` (ou `randomLegal` se a Lane 4A ainda não mergeou), em N
 * partidas de seed fixo por par de decks validados.
 *
 * Critério de promoção (documentado — NÃO roda em todo PR, é caro; rodar
 * nightly / on-demand):
 *   1. winrate(neural vs heuristic) > 55% (agregado) e Wilson low > 50%
 *   2. `pnpm gundam:golden` continua verde (neuralPolicy não toca o motor —
 *      passa trivial; confirmar à parte)
 *
 * Uso:
 *   pnpm train:eval --model=services/sim-trainer/models/<sha>
 *   pnpm train:eval --model=<dir> --games=50 --decks=ST01,ST02
 *   pnpm train:eval --model=<dir> --strict     # exit 1 se REPROVADO (pra nightly)
 *   pnpm train:eval --model=<dir> --out=<path> # salva relatório em JSON
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  ENGINE_ROOT,
  runSelfPlay,
  heuristicPolicy,
  neuralPolicy,
  randomLegal,
  mctsPolicy,
  wilsonInterval,
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
  const args = {
    model: null,
    games: 200,
    decks: null,
    strict: false,
    out: null,
    nice: false,
  };
  for (const a of argv) {
    if (a === "--strict") {
      args.strict = true;
      continue;
    }
    if (a === "--nice") {
      args.nice = true;
      continue;
    }
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "model") args.model = v;
    else if (k === "games") args.games = Number(v);
    else if (k === "decks") args.decks = v.split(",").map((s) => s.trim().toUpperCase());
    else if (k === "out") args.out = v;
    else if (k === "nice") args.nice = v === "true";
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
    wins: neuralWins,
    decided,
    games,
    avgTurns: turnsSum / games,
  };
}

async function runSuite(label, neuralFn, oppFn, pairs, games) {
  console.log(`\n[train:eval] === neural vs ${label} (${games} partidas/par) ===`);
  let totalWins = 0;
  let dSum = 0;
  let tSum = 0;
  const matchupDetails = [];

  for (const [deckA, deckB] of pairs) {
    const r = playMatchup(deckA, deckB, neuralFn, oppFn, games);
    totalWins += r.wins;
    dSum += r.decided;
    tSum += r.avgTurns;
    const pairWilson = wilsonInterval(r.wins, r.decided);
    matchupDetails.push({
      pair: `${deckA.id} x ${deckB.id}`,
      winrate: r.winrate,
      wins: r.wins,
      decided: r.decided,
      games: r.games,
      avgTurns: r.avgTurns,
      wilson: pairWilson,
    });
    console.log(
      `[train:eval]   ${deckA.id} x ${deckB.id}: winrate ${(r.winrate * 100).toFixed(1)}% (${r.wins}/${r.decided} decididas) Wilson [${(pairWilson.low * 100).toFixed(1)}%, ${(pairWilson.high * 100).toFixed(1)}%] | ${r.avgTurns.toFixed(1)} turnos`,
    );
  }
  const agg = dSum > 0 ? totalWins / dSum : 0;
  const wilson = wilsonInterval(totalWins, dSum);
  console.log(
    `[train:eval]   AGREGADO: winrate ${(agg * 100).toFixed(1)}% (${totalWins}/${dSum}) Wilson [${(wilson.low * 100).toFixed(1)}%, ${(wilson.high * 100).toFixed(1)}%] | ${(tSum / pairs.length).toFixed(1)} turnos médios`,
  );
  return {
    winrate: agg,
    wins: totalWins,
    decided: dSum,
    totalGames: pairs.length * games,
    avgTurns: Number((tSum / pairs.length).toFixed(1)),
    wilson,
    details: matchupDetails,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.model) {
    console.error("[train:eval] faltou --model=<dir do modelo>");
    process.exit(2);
  }

  if (args.nice) {
    try {
      os.setPriority(0, os.constants.priority.PRIORITY_LOW);
    } catch (err) {
      console.warn(`[train:eval] aviso: não foi possível definir prioridade baixa: ${err instanceof Error ? err.message : err}`);
    }
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
  const elapsed = Number(((Date.now() - started) / 1000).toFixed(1));

  // Critério de promoção: taxa > 55% e, para amostras significativas (>= 30 partidas), limite inferior de Wilson > 50%
  const approved =
    vsHeuristic.winrate > PROMOTION_THRESHOLD &&
    (vsHeuristic.decided < 30 || vsHeuristic.wilson.low > 0.5);

  console.log(`\n[train:eval] ---------------------------------------------`);
  console.log(`[train:eval] tempo: ${elapsed}s`);
  console.log(
    `[train:eval] neural vs heuristic: ${(vsHeuristic.winrate * 100).toFixed(1)}% Wilson [${(vsHeuristic.wilson.low * 100).toFixed(1)}%, ${(vsHeuristic.wilson.high * 100).toFixed(1)}%] (limiar: ${(PROMOTION_THRESHOLD * 100).toFixed(0)}%)`,
  );
  console.log(
    `[train:eval] neural vs ${secondLabel}: ${(vsSecond.winrate * 100).toFixed(1)}% Wilson [${(vsSecond.wilson.low * 100).toFixed(1)}%, ${(vsSecond.wilson.high * 100).toFixed(1)}%]`,
  );
  console.log(
    `[train:eval] VEREDITO: ${approved ? "APROVADO ✅" : "REPROVADO ❌"} (regra 1/2 — confirmar 'pnpm gundam:golden' verde para a regra 2/2)`,
  );
  console.log(`[train:eval] ---------------------------------------------`);

  if (args.out) {
    const outData = {
      modelDir: path.relative(ENGINE_ROOT, modelDir),
      elapsedSeconds: elapsed,
      pairsCount: pairs.length,
      vsHeuristic,
      vsSecond: {
        label: secondLabel,
        ...vsSecond,
      },
      promotionThreshold: PROMOTION_THRESHOLD,
      approved,
    };
    const outPath = path.resolve(ENGINE_ROOT, args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(outData, null, 2) + "\n");
    console.log(`[train:eval] -> ${path.relative(ENGINE_ROOT, outPath)}`);
  }

  handle.dispose();
  if (args.strict && !approved) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
