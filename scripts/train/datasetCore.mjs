/*
 * Núcleo de geração de dataset para treino de self-play.
 * Compartilhado entre dataset.mjs e datasetWorker.mjs.
 */

import fs from "node:fs";
import {
  createGame,
  actionOwner,
  enumerateLegalActions,
  applyPlayerAction,
  viewStateFor,
  createRng,
  extractFeatures,
  encodeAction,
  legalActionMask,
  heuristicPolicy,
  randomLegal,
  mctsPolicy,
  ALL_EFFECT_SPECS,
  defaultPredicateResolver,
  defaultTargetFilterResolver,
} from "./engine.mjs";

export const HYPER = {
  maxTurns: 60,
  maxSteps: 60 * 400,
};

/**
 * Pool de policies sorteadas por partida.
 * Se rapido === true, não inclui mcts pesado (ou usa iterações reduzidas) para execução ágil.
 */
export function policyPool(rapido = false) {
  const pool = [
    { name: "random", make: () => randomLegal },
    { name: "heuristic-facil", make: () => heuristicPolicy({ level: "facil" }) },
    { name: "heuristic-normal", make: () => heuristicPolicy({ level: "normal" }) },
  ];
  if (mctsPolicy && !rapido) {
    pool.push({ name: "mcts", make: () => mctsPolicy({ iterations: 60 }) });
  }
  return pool;
}

export function pick(pool, rng) {
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * Roda uma partida e grava cada decisão relevante para o dataset.
 */
export function playAndRecord(deckA, deckB, seed, policyA, policyB, nameA, nameB) {
  const rng = createRng((seed ^ 0x5eed1234) >>> 0);
  let state = createGame(deckA, deckB, { seed, firstPlayer: "A", interactiveMulligan: true });
  const samples = [];

  for (let step = 0; step < HYPER.maxSteps; step++) {
    if (state.gameOver) break;
    if (state.turnNumber > HYPER.maxTurns) return { samples: [], winner: null };

    const owner = actionOwner(state);
    if (!owner) return { samples: [], winner: null };

    let legal;
    try {
      legal = enumerateLegalActions(state, owner, ALL_EFFECT_SPECS, {
        predicateResolver: defaultPredicateResolver,
        targetFilterResolver: defaultTargetFilterResolver,
      });
    } catch {
      return { samples: [], winner: null };
    }
    if (legal.length === 0) return { samples: [], winner: null };

    const view = viewStateFor(state, owner);
    const policy = owner === "A" ? policyA : policyB;
    const policyName = owner === "A" ? nameA : nameB;
    const action = policy(view, legal, rng);

    if (legal.length >= 2 && policyName !== "random") {
      samples.push({
        seat: owner,
        features: Array.from(extractFeatures(view, owner)),
        actionIndex: encodeAction(action, view),
        legalMask: Array.from(legalActionMask(legal, view)),
      });
    }

    try {
      state = applyPlayerAction(
        state,
        owner,
        action,
        ALL_EFFECT_SPECS,
        defaultPredicateResolver,
        defaultTargetFilterResolver,
      );
    } catch {
      return { samples: [], winner: null };
    }
  }

  if (!state.gameOver) return { samples: [], winner: null };
  return { samples, winner: state.gameOver.winner };
}

/**
 * Executa uma lista de partidas planejadas e grava no stream/arquivo de saída.
 * plannedGames: Array<{ deckA: { id, build }, deckB: { id, build }, seed: number }>
 */
export async function runPlannedDatasetGames(plannedGames, outPath, options = {}) {
  const { rapido = false, onProgress = null } = options;
  const pool = policyPool(rapido);
  const stream = fs.createWriteStream(outPath);

  let totalGames = 0;
  let kept = 0;
  let discarded = 0;
  let rows = 0;

  for (let i = 0; i < plannedGames.length; i++) {
    const item = plannedGames[i];
    const selectRng = createRng((item.seed ^ 0xabcdef) >>> 0);
    const poolA = pick(pool, selectRng);
    const poolB = pick(pool, selectRng);
    const shortName = (n) => (n === "random" ? "random" : "policy");

    totalGames++;
    const { samples, winner } = playAndRecord(
      item.deckA.build(),
      item.deckB.build(),
      item.seed,
      poolA.make(),
      poolB.make(),
      shortName(poolA.name),
      shortName(poolB.name),
    );

    if (winner === null || samples.length === 0) {
      discarded++;
    } else {
      kept++;
      for (const s of samples) {
        const outcome = s.seat === winner ? 1 : -1;
        stream.write(
          JSON.stringify({
            features: s.features,
            actionIndex: s.actionIndex,
            legalMask: s.legalMask,
            outcome,
          }) + "\n",
        );
        rows++;
      }
    }

    if (onProgress && (i + 1) % 10 === 0) {
      onProgress(i + 1, plannedGames.length);
    }
  }

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
    stream.end();
  });

  return { totalGames, kept, discarded, rows };
}
