import type { GameState, PlayerId } from "../types";
import type { LegalAction } from "../legalActions";
import { actionOwner, enumerateLegalActions } from "../legalActions";
import type { SelfPlayPolicy } from "../selfPlay";
import { createRng } from "../rng";
import type { ViewGameState } from "../viewState";
import { viewStateFor } from "../viewState";
import { applyForEval, determinize, evaluatePosition, type EvalDeps, type EvalWeights } from "./evaluation";
import { EffectActionBudget } from "./actionLookahead";
import { heuristicPolicy } from "./heuristicPolicy";

/**
 * Planejador de turno (spec `.planning/specs/bot-planejamento-turno.md`): na Main
 * Phase do bot, cada jogada legal agora é aplicada no estado determinizado da VIEW
 * (nada oculto entra — ver `determinize`) e o resto do turno é jogado pela
 * heurística `normal` pelos DOIS lados (bloqueio, Action Step) até o FIM DO TURNO
 * SEGUINTE DO OPONENTE. A melhor posição final decide a jogada; a próxima decisão
 * replaneja.
 *
 * O horizonte inclui o contra-ataque de propósito: parando no fim do meu turno,
 * quebrar um escudo sempre parece melhor que destruir uma Unit ou segurar o
 * <Blocker> que protege a Base (medido no banco de situações).
 *
 * É o que falta pra "preparar e depois atacar": a continuação já sabe atacar, o
 * planejador só passa a enxergar o que a preparação (rest, remoção, Pilot) rende
 * nesse ataque.
 */

/** orçamento por decisão — cabe no "tempo de pensar" de 1–2s do bot */
export const PLAN_BUDGET_MS = 700;
/** teto de passos por continuação — um turno real fica bem abaixo; nunca entra em laço */
const MAX_ROLLOUT_STEPS = 400;
/** empate técnico: só troca a jogada da policy base por outra estritamente melhor */
const EPSILON = 1e-6;

export interface TurnPlannerOptions extends EvalDeps {
  budgetMs?: number;
  seed?: number;
  /** relógio injetável (teste); default `Date.now` */
  now?: () => number;
  /** log de debug: plano escolhido e o ranking das alternativas avaliadas */
  onPlan?: (plan: TurnPlan) => void;
  /** a jogada que a policy base faria — avaliada primeiro e mantida em empate */
  preferred?: LegalAction;
  /** pesos da avaliação da posição final (default `EVAL_WEIGHTS`; o Zero System passa os calibrados) */
  weights?: EvalWeights;
}

export interface RankedAction {
  action: LegalAction;
  /** `evaluatePosition` no horizonte, do ponto de vista do bot */
  value: number;
}

export interface TurnPlan {
  best: RankedAction;
  /** avaliadas, melhor primeiro */
  ranked: RankedAction[];
  /** candidatas que ficaram sem avaliação (tempo) */
  skipped: number;
}

class BudgetExceeded extends Error {}

function isOwnMainPhase(view: ViewGameState): boolean {
  return (
    !view.gameOver &&
    view.phase === "main" &&
    view.activePlayer === view.viewer &&
    !view.combat &&
    !view.endPhaseAction &&
    !view.pendingDecision.A &&
    !view.pendingDecision.B
  );
}

function sameAction(a: LegalAction, b: LegalAction): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function rollout(
  start: GameState,
  seat: PlayerId,
  stopAfterTurn: number,
  continuation: SelfPlayPolicy,
  opts: TurnPlannerOptions,
  seed: number,
  checkBudget: () => void,
): number {
  const rng = createRng(seed);
  let state = start;
  for (let i = 0; i < MAX_ROLLOUT_STEPS; i++) {
    checkBudget();
    if (state.gameOver || state.turnNumber > stopAfterTurn) break;
    const owner = actionOwner(state);
    if (!owner) break;
    const legal = enumerateLegalActions(state, owner, opts.specs, {
      predicateResolver: opts.predicateResolver,
      targetFilterResolver: opts.targetFilterResolver,
    });
    if (legal.length === 0) break;
    const next = applyForEval(continuation(viewStateFor(state, owner), legal, rng), state, owner, opts);
    if (!next) break;
    state = next;
  }
  return evaluatePosition(state, seat, opts.weights);
}

/** `null` fora da Main Phase do bot, com uma jogada só, ou sem nada avaliado no orçamento */
export function planTurn(view: ViewGameState, legal: LegalAction[], opts: TurnPlannerOptions): TurnPlan | null {
  if (!isOwnMainPhase(view) || legal.length < 2) return null;
  const now = opts.now ?? Date.now;
  const deadline = now() + (opts.budgetMs ?? PLAN_BUDGET_MS);
  const checkBudget = () => {
    if (now() > deadline) throw new BudgetExceeded();
  };
  const seat = view.viewer;
  // turno atual (meu) + o do oponente
  const stopAfterTurn = view.turnNumber + 1;
  const seed = opts.seed ?? 1;
  // continuação barata e fixa: heurística sem lookahead (o planejador nunca roda dentro de si mesmo)
  const continuation = heuristicPolicy({ level: "normal" });
  const start = determinize(view);

  const preferred = opts.preferred;
  const candidates = preferred ? [preferred, ...legal.filter((a) => !sameAction(a, preferred))] : legal;
  const ranked: RankedAction[] = [];
  let skipped = 0;
  for (const action of candidates) {
    try {
      checkBudget();
      const after = applyForEval(action, start, seat, opts);
      if (!after) continue;
      // mesma semente em toda candidata: o que muda entre elas é SÓ a jogada
      ranked.push({ action, value: rollout(after, seat, stopAfterTurn, continuation, opts, seed, checkBudget) });
    } catch (err) {
      if (!(err instanceof BudgetExceeded)) throw err;
      skipped = candidates.length - ranked.length;
      break;
    }
  }
  if (ranked.length === 0) return null;

  // ordenação estável: em empate fica a ordem de avaliação (a jogada da base vem primeiro)
  const sorted = ranked
    .map((r, i) => ({ r, i }))
    .sort((x, y) => (Math.abs(y.r.value - x.r.value) > EPSILON ? y.r.value - x.r.value : x.i - y.i))
    .map(({ r }) => r);
  return { best: sorted[0], ranked: sorted, skipped };
}

export interface TurnPlannerConfig extends Omit<TurnPlannerOptions, "preferred"> {
  maxActivationsPerSourcePerTurn?: number;
}

/**
 * Envolve uma policy: na Main Phase do bot joga a melhor jogada do plano; no resto
 * (bloqueio, Action Step, decisões) e quando o planejador não decide, a `base`.
 * Opt-in — nunca usar como continuação de rollout (MCTS, lookahead, o próprio planejador).
 */
export function turnPlannerPolicy(base: SelfPlayPolicy, config: TurnPlannerConfig): SelfPlayPolicy {
  // 【Activate】 repetível não deixa rastro no estado: sem isto o planejador poderia repeti-la sem fim
  const activations = new EffectActionBudget(config.maxActivationsPerSourcePerTurn);
  return (view, legal, rng) => {
    const baseChoice = base(view, legal, rng);
    const allowed = legal.filter((a) => activations.allows(view.turnNumber, a));
    const plan = planTurn(view, allowed, { ...config, preferred: allowed.some((a) => sameAction(a, baseChoice)) ? baseChoice : undefined });
    const choice = plan ? plan.best.action : baseChoice;
    if (plan) config.onPlan?.(plan);
    activations.record(view.turnNumber, choice);
    return choice;
  };
}
