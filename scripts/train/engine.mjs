/*
 * Carregador do motor puro do simulador para os scripts de treino ML
 * (docs/50). Registra o loader `tsx` e reexporta o que `dataset`/`fit`/`eval`
 * consomem do motor TS — mesmo padrão de `scripts/gundam-fuzz.mjs`.
 */

import { register } from "tsx/esm/api";
import path from "node:path";
import { pathToFileURL } from "node:url";

register();

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const sim = (p) => pathToFileURL(path.join(ROOT, "src/modules/simulator", p)).href;

export const ENGINE_ROOT = ROOT;

const selfPlay = await import(sim("engine/selfPlay.ts"));
const legalActions = await import(sim("engine/legalActions.ts"));
const viewState = await import(sim("engine/viewState.ts"));
const setup = await import(sim("engine/setup.ts"));
const actions = await import(sim("engine/actions.ts"));
const rng = await import(sim("engine/rng.ts"));
const features = await import(sim("engine/bot/features.ts"));
const heuristic = await import(sim("engine/bot/heuristicPolicy.ts"));
const neural = await import(sim("engine/bot/neuralPolicy.ts"));
const content = await import(sim("content/index.ts"));

/** `mctsPolicy` da Lane 4A — import opcional, `null` se ainda não mergeou. */
let mcts = null;
try {
  mcts = await import(sim("engine/bot/mctsPolicy.ts"));
} catch {
  mcts = null;
}

export const runSelfPlay = selfPlay.runSelfPlay;
export const randomLegal = selfPlay.randomLegal;
export const enumerateLegalActions = legalActions.enumerateLegalActions;
export const actionOwner = legalActions.actionOwner;
export const viewStateFor = viewState.viewStateFor;
export const createGame = setup.createGame;
export const applyPlayerAction = actions.applyPlayerAction;
export const createRng = rng.createRng;

export const extractFeatures = features.extractFeatures;
export const encodeAction = features.encodeAction;
export const decodeActionIndex = features.decodeActionIndex;
export const legalActionMask = features.legalActionMask;
export const FEATURE_SIZE = features.FEATURE_SIZE;
export const ACTION_SPACE = features.ACTION_SPACE;

export const heuristicPolicy = heuristic.heuristicPolicy;
export const neuralPolicy = neural.neuralPolicy;

export const ALL_EFFECT_SPECS = content.ALL_EFFECT_SPECS;
export const defaultPredicateResolver = content.defaultPredicateResolver;
export const defaultTargetFilterResolver = content.defaultTargetFilterResolver;
export const VALIDATED_DECKS = content.VALIDATED_DECKS;
export const validatedDeckList = content.validatedDeckList;

/** `mctsPolicy({...})` se a Lane 4A já forneceu; senão `null`. */
export const mctsPolicy = mcts?.mctsPolicy ?? null;

/** Pares de decks validados (i <= j), como `gundam-golden.mjs`. */
export function validatedDeckPairs() {
  const decks = validatedDeckList();
  const pairs = [];
  for (let i = 0; i < decks.length; i++) {
    for (let j = i; j < decks.length; j++) {
      pairs.push([decks[i], decks[j]]);
    }
  }
  return pairs;
}
