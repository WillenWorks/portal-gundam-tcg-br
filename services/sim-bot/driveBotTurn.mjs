import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { applyPlayerAction } from "../../src/modules/simulator/engine/actions.ts";
import { actionOwner, enumerateLegalActions } from "../../src/modules/simulator/engine/legalActions.ts";
import { viewStateFor } from "../../src/modules/simulator/engine/viewState.ts";
import { createRng } from "../../src/modules/simulator/engine/rng.ts";
import { neuralPolicy } from "../../src/modules/simulator/engine/bot/index.ts";
import { policyForLevel } from "../../src/modules/simulator/engine/bot/levelPolicies.ts";
import {
  ALL_EFFECT_SPECS,
  defaultPredicateResolver,
  defaultTargetFilterResolver,
} from "../../src/modules/simulator/content/index.ts";

function loadPromotedArtifacts(modelDir) {
  if (!modelDir) return null;
  const modelJsonPath = path.join(modelDir, "model.json");
  const weightsPath = path.join(modelDir, "weights.bin");
  if (!fs.existsSync(modelJsonPath) || !fs.existsSync(weightsPath)) return null;
  try {
    const modelJSON = JSON.parse(fs.readFileSync(modelJsonPath, "utf8"));
    const weightBuffer = fs.readFileSync(weightsPath);
    const weightSpecs = modelJSON.weightsManifest.flatMap((group) => group.weights);
    return {
      modelTopology: modelJSON.modelTopology,
      weightSpecs,
      weightData: weightBuffer.buffer.slice(
        weightBuffer.byteOffset,
        weightBuffer.byteOffset + weightBuffer.byteLength,
      ),
      format: modelJSON.format,
      generatedBy: modelJSON.generatedBy,
      convertedBy: modelJSON.convertedBy,
    };
  } catch {
    return null;
  }
}

/**
 * Núcleo do worker do bot de treino (docs/44 Fase 2 §10.2, Fase 5 Lane 4A). Puro e testável:
 * dado o `GameState` autoritativo (já hidratado) e o assento do bot, roda a
 * policy (heurística, MCTS ou neural) EM LOOP até o turno do bot acabar, e para cada ação chama
 * `commit(action)` — que é o caminho autoritativo de verdade (`POST
 * /matches/:id/actions` em produção, `matchStore.applyAction` no teste).
 *
 * Depois de cada `commit`, aplica a MESMA ação numa cópia local do estado
 * (`applyPlayerAction` é puro e determinístico — o `GameState` carrega o próprio
 * RNG) só pra decidir a próxima. Se o servidor e a cópia local divergirem, o
 * próximo `commit` é recusado pelo motor autoritativo e o erro sobe — o worker
 * marca o turno como falho e não fica num laço com estado fantasma.
 *
 * A aleatoriedade da policy (só desempate entre ações de valor igual) vem de um
 * `rng` seedado passado pelo chamador — nada de `Math.random()` aqui.
 */

const DEFAULT_MAX_ACTIONS = 400;

/**
 * "Tempo de pensar" do bot entre ações (1–2s) — só ritmo de apresentação, pra
 * partida contra o bot parecer contra uma pessoa. NÃO afeta a decisão da
 * policy, por isso pode usar `Math.random` (a policy continua seedada).
 */
export const BOT_THINK_DELAY_MIN_MS = 1000;
export const BOT_THINK_DELAY_MAX_MS = 2000;

/** @param {() => number} [random] */
export function humanizedThinkDelayMs(random = Math.random) {
  return Math.round(BOT_THINK_DELAY_MIN_MS + random() * (BOT_THINK_DELAY_MAX_MS - BOT_THINK_DELAY_MIN_MS));
}

/**
 * Espera um `humanizedThinkDelayMs()` MENOS o tempo que a policy já gastou decidindo
 * (`thinkingMs`) — o difícil calcula ~1,5s e não deve somar outros 1–2s de espera.
 * Passar como `beforeCommit` nos drivers reais (servidor/worker).
 * @param {{ thinkingMs?: number }} [ctx]
 */
export function humanizedThinkDelay(ctx) {
  const remaining = Math.max(0, humanizedThinkDelayMs() - (ctx?.thinkingMs ?? 0));
  return new Promise((resolve) => setTimeout(resolve, remaining));
}

/**
 * @param {object} opts
 * @param {import("../../src/modules/simulator/engine/types.ts").GameState} opts.initialState
 * @param {"A"|"B"} opts.seat
 * @param {"facil"|"normal"|"dificil"|"zero_system"} opts.level
 * @param {"amuro"|"char"|"heero"|"treize"|"adaptive"} [opts.persona]
 * @param {number} opts.seed
 * @param {(action: unknown) => unknown} opts.commit — pode devolver o `GameState` autoritativo atualizado
 * @param {(ctx: { thinkingMs: number }) => (void | Promise<void>)} [opts.beforeCommit] — "tempo de pensar" antes de cada commit (ex. `humanizedThinkDelay`, que desconta `thinkingMs`); testes omitem
 * @param {number} [opts.maxActions]
 * @returns {Promise<{ actionsApplied: number, finalState: object, done: boolean }>}
 */
export async function driveBotTurn({ initialState, seat, level, persona = "adaptive", seed, commit, beforeCommit, maxActions = DEFAULT_MAX_ACTIONS }) {
  let policy;
  let neuralHandle = null;
  // Config por nível vem de `policyForLevel` (fonte única, também usada pela escada
  // de Elo). Só o modo neural do `normal` (dev, lê arquivo) fica aqui.
  const levelOpts = {
    specs: ALL_EFFECT_SPECS,
    predicateResolver: defaultPredicateResolver,
    targetFilterResolver: defaultTargetFilterResolver,
    persona,
  };

  if (level === "normal") {
    // Machine Learning fica restrito ao ambiente de desenvolvimento sob flag explícita
    // para treinamento e testes práticos antes da promoção definitiva.
    const enableNeural =
      process.env.NODE_ENV !== "production" &&
      process.env.SIM_BOT_ENABLE_ML === "true";

    if (enableNeural) {
      const modelDir =
        process.env.SIM_BOT_MODEL_DIR ||
        path.resolve(process.cwd(), "services/sim-trainer/models/promoted");
      const artifacts = loadPromotedArtifacts(modelDir);
      if (artifacts) {
        neuralHandle = await neuralPolicy({ artifacts, fallbackLevel: "normal" });
        policy = (view, legal, rng) => neuralHandle.chooseAction(view, legal, rng);
      }
    }
  }
  if (!policy) {
    const productLevel = level === "adaptive" ? "zero_system" : level === "normal" || level === "dificil" || level === "zero_system" ? level : "facil";
    policy = policyForLevel(productLevel, levelOpts);
  }
  const rng = createRng((seed ?? 1) >>> 0);
  let state = initialState;
  let actionsApplied = 0;

  for (let i = 0; i < maxActions; i += 1) {
    if (state.gameOver) break;
    if (actionOwner(state) !== seat) break;

    const legal = enumerateLegalActions(state, seat, ALL_EFFECT_SPECS, {
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });
    if (legal.length === 0) break;

    const view = viewStateFor(state, seat);
    const thinkStart = Date.now();
    const action = policy(view, legal, rng);

    if (beforeCommit) await beforeCommit({ thinkingMs: Date.now() - thinkStart });
    const committedState = await commit(action); // caminho autoritativo — pode lançar (motor recusou / rede)
    if (committedState && typeof committedState === "object" && committedState.players) {
      state = committedState;
    } else {
      state = applyPlayerAction(
        state,
        seat,
        action,
        ALL_EFFECT_SPECS,
        defaultPredicateResolver,
        defaultTargetFilterResolver,
      );
    }
    actionsApplied += 1;
  }

  return {
    actionsApplied,
    finalState: state,
    done: Boolean(state.gameOver) || actionOwner(state) !== seat,
  };
}
