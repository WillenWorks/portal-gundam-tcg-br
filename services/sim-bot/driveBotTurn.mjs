import { applyPlayerAction } from "../../src/modules/simulator/engine/actions.ts";
import { actionOwner, enumerateLegalActions } from "../../src/modules/simulator/engine/legalActions.ts";
import { viewStateFor } from "../../src/modules/simulator/engine/viewState.ts";
import { createRng } from "../../src/modules/simulator/engine/rng.ts";
import { heuristicPolicy } from "../../src/modules/simulator/engine/bot/index.ts";
import {
  ALL_EFFECT_SPECS,
  defaultPredicateResolver,
  defaultTargetFilterResolver,
} from "../../src/modules/simulator/content/index.ts";

/**
 * Núcleo do worker do bot de treino (docs/44 Fase 2 §10.2). Puro e testável:
 * dado o `GameState` autoritativo (já hidratado) e o assento do bot, roda a
 * heurística EM LOOP até o turno do bot acabar, e para cada ação chama
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
 * @param {"facil"|"normal"} opts.level
 * @param {number} opts.seed
 * @param {(action: unknown) => (void | Promise<void>)} opts.commit
 * @param {number} [opts.maxActions]
 * @returns {Promise<{ actionsApplied: number, finalState: object, done: boolean }>}
 */
export async function driveBotTurn({ initialState, seat, level, seed, commit, maxActions = DEFAULT_MAX_ACTIONS }) {
  const policy = heuristicPolicy({ level: level === "facil" ? "facil" : "normal" });
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
