import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { applyPlayerAction } from "../../src/modules/simulator/engine/actions.ts";
import { actionOwner, enumerateLegalActions } from "../../src/modules/simulator/engine/legalActions.ts";
import { viewStateFor } from "../../src/modules/simulator/engine/viewState.ts";
import { createRng } from "../../src/modules/simulator/engine/rng.ts";
import { heuristicPolicy, mctsPolicy, neuralPolicy } from "../../src/modules/simulator/engine/bot/index.ts";
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
 * @param {object} opts
 * @param {import("../../src/modules/simulator/engine/types.ts").GameState} opts.initialState
 * @param {"A"|"B"} opts.seat
 * @param {"facil"|"normal"|"dificil"} opts.level
 * @param {number} opts.seed
 * @param {(action: unknown) => (void | Promise<void>)} opts.commit
 * @param {number} [opts.maxActions]
 * @returns {Promise<{ actionsApplied: number, finalState: object, done: boolean }>}
 */
export async function driveBotTurn({ initialState, seat, level, seed, commit, maxActions = DEFAULT_MAX_ACTIONS }) {
  let policy;
  let neuralHandle = null;

  if (level === "dificil") {
    policy = mctsPolicy({
      rollouts: 16,
      depthTurns: 8,
      specs: ALL_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });
  } else if (level === "normal") {
    // Machine Learning fica restrito ao ambiente de desenvolvimento sob flag explícita
    // para treinamento e testes práticos antes da promoção definitiva.
    // Em produção (e por padrão sem a flag), usa a política heurística testada e estável.
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

    if (!policy) {
      policy = heuristicPolicy({ level: "normal" });
    }
  } else {
    policy = heuristicPolicy({ level: "facil" });
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
    const action = policy(view, legal, rng);

    await commit(action); // caminho autoritativo — pode lançar (motor recusou / rede)
    state = applyPlayerAction(
      state,
      seat,
      action,
      ALL_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    actionsApplied += 1;
  }

  return {
    actionsApplied,
    finalState: state,
    done: Boolean(state.gameOver) || actionOwner(state) !== seat,
  };
}
