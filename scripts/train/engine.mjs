/*
 * Carregador do motor puro do simulador para os scripts de treino ML
 * (docs/50). Registra o loader `tsx` e reexporta o que `dataset`/`fit`/`eval`
 * consomem do motor TS — mesmo padrão de `scripts/gundam-fuzz.mjs`.
 */

import { register } from "tsx/esm/api";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { computeEngineSha } from "./engineHash.mjs";

register();

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const sim = (p) => pathToFileURL(path.join(ROOT, "src/modules/simulator", p)).href;

export const ENGINE_ROOT = ROOT;

export function getEngineSha() {
  return computeEngineSha(ROOT);
}

const selfPlay = await import(sim("engine/selfPlay.ts"));
const legalActions = await import(sim("engine/legalActions.ts"));
const viewState = await import(sim("engine/viewState.ts"));
const setup = await import(sim("engine/setup.ts"));
const actions = await import(sim("engine/actions.ts"));
const rng = await import(sim("engine/rng.ts"));
const features = await import(sim("engine/bot/features.ts"));
const heuristic = await import(sim("engine/bot/heuristicPolicy.ts"));
const neural = await import(sim("engine/bot/neuralPolicy.ts"));
const ladder = await import(sim("engine/bot/ladder.ts"));
const content = await import(sim("content/index.ts"));
const pools = await import(sim("fixtures/benchmarkDeckPools.ts"));

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
export const wilsonInterval = ladder.wilsonInterval;

export const ALL_EFFECT_SPECS = content.ALL_EFFECT_SPECS;
export const defaultPredicateResolver = content.defaultPredicateResolver;
export const defaultTargetFilterResolver = content.defaultTargetFilterResolver;
export const VALIDATED_DECKS = content.VALIDATED_DECKS;
export const validatedDeckList = content.validatedDeckList;

/** `mctsPolicy({...})` se a Lane 4A já forneceu; senão `null`. */
export const mctsPolicy = mcts?.mctsPolicy ?? null;

// Treino com decks de torneio: TRAIN_POOL_FILE aponta para um pool (formato de scripts/gundam-bot-season-pool.mjs).
// Variável de ambiente, e não argumento, porque as etapas do pipeline e os workers a herdam sem mudar cada chamada.
const POOL_FILE = process.env.TRAIN_POOL_FILE || null;
const POOL_MAX_PAIRS = Number(process.env.TRAIN_POOL_MAX_PAIRS || 60);

/** Decks do treino: os validados (ST01–ST04) ou os do pool de torneio. */
export function trainingDeckList() {
  if (!POOL_FILE) return content.validatedDeckList();
  return pools.poolFromFile(JSON.parse(fs.readFileSync(POOL_FILE, "utf8")));
}

/** Pares do treino. Com pool, espelhos ficam de fora e os pares são amostrados em passo fixo (determinístico)
 *  até TRAIN_POOL_MAX_PAIRS, para o tempo não crescer com o quadrado do número de decks. */
export function trainingDeckPairs() {
  if (!POOL_FILE) return validatedDeckPairs();
  const decks = trainingDeckList();
  const all = [];
  for (let i = 0; i < decks.length; i++) for (let j = i + 1; j < decks.length; j++) all.push([decks[i], decks[j]]);
  if (all.length <= POOL_MAX_PAIRS) return all;
  const step = all.length / POOL_MAX_PAIRS;
  return Array.from({ length: POOL_MAX_PAIRS }, (_, k) => all[Math.floor(k * step)]);
}

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
