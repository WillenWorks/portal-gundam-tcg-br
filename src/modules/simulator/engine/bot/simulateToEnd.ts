import type { GameState, PlayerId } from "../types";
import type { EffectSpec, PredicateResolver, TargetFilterResolver } from "../effectSpec";
import type { Rng } from "../rng";
import type { SelfPlayPolicy } from "../selfPlay";
import { applyPlayerAction } from "../actions";
import { cloneState } from "../events";
import { actionOwner, enumerateLegalActions } from "../legalActions";
import { viewStateFor } from "../viewState";

/**
 * Rollout do MCTS raso (docs/44, Fase 5 — §7.2). Roda uma partida a partir de
 * um `GameState` arbitrário (não só o inicial) até `gameOver` ou `maxTurns`,
 * aplicando `policyA`/`policyB` a cada ponto de decisão via `applyPlayerAction`.
 *
 * PURA e determinística dado o `rng` recebido: nenhuma outra fonte de
 * aleatoriedade (sem `Math.random()`, sem `Date.now()`). Duas chamadas com o
 * mesmo estado, as mesmas policies e um `rng` na mesma posição dão o mesmo
 * resultado.
 *
 * Nunca muta o estado do chamador — `isolateInput` (default `true`) clona a
 * fundo na entrada. `applyPlayerAction` já não muta o argumento (todo caminho
 * passa por `cloneState` no topo do `applyEvent`), então o clone de entrada é
 * só cinto-de-segurança contra um caminho futuro que passe a mutar.
 *
 * Garantia de terminação: além do teto de `maxTurns` (mesmo contrato do
 * `runSelfPlay`), há um teto de PASSOS (`maxTurns * STEP_BUDGET_PER_TURN`) que
 * corta qualquer laço de motor antes de virar loop infinito. Se o motor lançar
 * ao enumerar ou aplicar uma ação num estado especulado, o erro PROPAGA (não é
 * engolido) — é um achado de motor de verdade, não algo pra mascarar aqui.
 */

export interface SimulateResolvers {
  predicateResolver?: PredicateResolver;
  targetFilterResolver?: TargetFilterResolver;
}

export interface SimulateToEndOptions {
  policyA: SelfPlayPolicy;
  policyB: SelfPlayPolicy;
  /** turno-limite: acima disso a simulação para e devolve `winner: null` */
  maxTurns: number;
  rng: Rng;
  /** default `true` — clona o estado de entrada antes de simular */
  isolateInput?: boolean;
  /**
   * default `false`. `true` = enumera candidatos SEM validar (`validate: false`)
   * e valida só a ação escolhida, re-escolhendo se ela cair como ilegal. ~2-4x
   * mais rápido em rollout (não re-aplica todo candidato a cada passo). Só um
   * erro de legalidade "plano" (`Error` puro, mesmo critério do
   * `enumerateLegalActions`) é tratado como "candidato ilegal" — qualquer outro
   * PROPAGA (achado de motor).
   */
  fastLegal?: boolean;
}

/** mesmo critério do `isPlainLegalityError` interno do `legalActions.ts` */
function isPlainLegalityError(err: unknown): boolean {
  return err instanceof Error && err.name === "Error";
}

export interface SimulateToEndResult {
  winner: PlayerId | null;
  turns: number;
  /** estado final da simulação (referência, não cópia) — útil pro MCTS avaliar
   *  a posição quando o rollout é truncado por `maxTurns` sem vencedor */
  finalState: GameState;
}

/** Cada ação avança o estado por um passo lógico; um jogo real termina MUITO
 *  antes disso. Acima = laço de motor — corta e devolve o que tiver. */
const STEP_BUDGET_PER_TURN = 400;

export function simulateToEnd(
  state: GameState,
  seat: PlayerId,
  specs: EffectSpec[],
  resolvers: SimulateResolvers,
  opts: SimulateToEndOptions,
): SimulateToEndResult {
  // `seat` = assento sob avaliação (contrato simétrico ao `enumerateLegalActions`);
  // quem controla cada lado no rollout é decidido por `actionOwner`, não por ele.
  const { policyA, policyB, maxTurns, rng } = opts;
  let current = opts.isolateInput === false ? state : cloneState(state);

  const maxSteps = maxTurns * STEP_BUDGET_PER_TURN;
  for (let step = 0; step < maxSteps; step++) {
    if (current.gameOver) {
      return { winner: current.gameOver.winner, turns: current.turnNumber, finalState: current };
    }
    if (current.turnNumber > maxTurns) {
      return { winner: null, turns: current.turnNumber, finalState: current };
    }

    const owner = actionOwner(current);
    if (!owner) {
      // ninguém pode agir e o jogo não acabou — estado degenerado; não é laço
      return { winner: null, turns: current.turnNumber, finalState: current };
    }

    const legal = enumerateLegalActions(current, owner, specs, {
      predicateResolver: resolvers.predicateResolver,
      targetFilterResolver: resolvers.targetFilterResolver,
      validate: opts.fastLegal ? false : undefined,
    });
    if (legal.length === 0) {
      return { winner: null, turns: current.turnNumber, finalState: current };
    }

    const policy = owner === "A" ? policyA : policyB;
    const view = viewStateFor(current, owner);

    if (!opts.fastLegal) {
      const action = policy(view, legal, rng);
      current = applyPlayerAction(
        current,
        owner,
        action,
        specs,
        resolvers.predicateResolver,
        resolvers.targetFilterResolver,
      );
      continue;
    }

    // fastLegal: candidatos crus; valida só a escolha, re-escolhe se ilegal
    let pool = legal;
    let advanced = false;
    while (pool.length > 0) {
      const action = policy(view, pool, rng);
      try {
        current = applyPlayerAction(
          current,
          owner,
          action,
          specs,
          resolvers.predicateResolver,
          resolvers.targetFilterResolver,
        );
        advanced = true;
        break;
      } catch (err) {
        if (!isPlainLegalityError(err)) throw err;
        pool = pool.filter((a) => a !== action);
      }
    }
    if (!advanced) {
      return { winner: null, turns: current.turnNumber, finalState: current };
    }
  }

  return { winner: null, turns: current.turnNumber, finalState: current };
}
