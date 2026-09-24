import type { GameState, PlayerId } from "../types";
import type { LegalAction } from "../legalActions";
import { actionOwner, enumerateLegalActions } from "../legalActions";
import type { SelfPlayPolicy } from "../selfPlay";
import type { Rng } from "../rng";
import { createRng } from "../rng";
import type { ViewGameState } from "../viewState";
import { viewStateFor } from "../viewState";
import { applyForEval, determinize, evaluatePosition, type EvalDeps } from "./evaluation";

/**
 * Lookahead de efeitos (spec `.planning/specs/bot-lookahead-efeitos.md`): quanto
 * um `playCommand`/`activateAbility` vale pro bot, comparado a NÃO jogá-lo,
 * simulado no estado determinizado da VIEW do bot (nunca o `GameState` real —
 * nada da mão/deck do oponente entra, ver `determinize`).
 *
 * Mede o efeito pelo resultado, não por regra de carta: vale pra pump, compra,
 * cura, token, efeito em aliado, rest/bounce e cartas novas sem código novo.
 * No Action Step de combate, os dois lados passam até o combate acabar (com e
 * sem a ação) e o que se compara é o tabuleiro DEPOIS da batalha.
 */

/** ganho mínimo pra jogar — abaixo disso é ruído/efeito irrelevante (escala de `EVAL_WEIGHTS`) */
export const MIN_GAIN = 0.1;
/** teto por avaliação — estourou, `null` e o chamador usa a nota antiga da heurística */
export const DECISION_BUDGET_MS = 300;
/** limite de passos ao resolver decisões pendentes/combate na simulação — nunca entra em laço */
const MAX_SETTLE_STEPS = 40;
/** mesma fonte de 【Activate】 no mesmo turno — contém habilidade grátis repetível */
export const MAX_ACTIVATIONS_PER_SOURCE_PER_TURN = 2;

export interface LookaheadOptions extends EvalDeps {
  /** decide as escolhas que o próprio efeito abre (alvo 2º, topo do deck, descarte) — use a heurística SEM lookahead */
  settlePolicy: SelfPlayPolicy;
  budgetMs?: number;
  /** relógio injetável (teste); default `Date.now` */
  now?: () => number;
  seed?: number;
}

export interface ActionEvaluation {
  /** valor da posição com a ação − sem a ação, do ponto de vista do bot */
  delta: number;
}

class BudgetExceeded extends Error {}

function pickSettleAction(state: GameState, owner: PlayerId, opts: LookaheadOptions, rng: Rng): LegalAction | null {
  const legal = enumerateLegalActions(state, owner, opts.specs, {
    predicateResolver: opts.predicateResolver,
    targetFilterResolver: opts.targetFilterResolver,
  });
  if (legal.length === 0) return null;
  // No combate simulado ninguém joga mais nada: só queremos o resultado da batalha.
  const pass = legal.find((a) => a.kind === "passAction" || a.kind === "skipBlock");
  if (pass && !state.pendingDecision[owner]) return pass;
  return opts.settlePolicy(viewStateFor(state, owner), legal, rng);
}

/**
 * Avança o estado simulado até não haver decisão pendente e (se `untilCombatEnds`)
 * o combate corrente acabar. Para no fim do combate/decisões — não joga o resto do turno.
 */
function settle(start: GameState, untilCombatEnds: boolean, opts: LookaheadOptions, rng: Rng, checkBudget: () => void): GameState {
  let state = start;
  for (let i = 0; i < MAX_SETTLE_STEPS; i++) {
    checkBudget();
    if (state.gameOver) return state;
    const pending = state.pendingDecision.A || state.pendingDecision.B;
    const inCombat = untilCombatEnds && state.combat !== null;
    if (!pending && !inCombat) return state;
    const owner = actionOwner(state);
    if (!owner) return state;
    const action = pickSettleAction(state, owner, opts, rng);
    if (!action) return state;
    const next = applyForEval(action, state, owner, opts);
    if (!next) return state;
    state = next;
  }
  return state;
}

export function evaluateAction(view: ViewGameState, action: LegalAction, opts: LookaheadOptions): ActionEvaluation | null {
  const now = opts.now ?? Date.now;
  const deadline = now() + (opts.budgetMs ?? DECISION_BUDGET_MS);
  const checkBudget = () => {
    if (now() > deadline) throw new BudgetExceeded();
  };
  const seat = view.viewer;
  const inCombat = view.combat?.step === "action";

  try {
    const baselineStart = determinize(view);
    const afterAction = applyForEval(action, baselineStart, seat, opts);
    if (!afterAction) return null;
    checkBudget();

    // RNG próprio e igual pros dois ramos: o que difere entre eles é SÓ a ação.
    const baseline = settle(baselineStart, inCombat, opts, createRng(opts.seed ?? 1), checkBudget);
    const withAction = settle(afterAction, inCombat, opts, createRng(opts.seed ?? 1), checkBudget);
    return { delta: evaluatePosition(withAction, seat) - evaluatePosition(baseline, seat) };
  } catch (err) {
    if (err instanceof BudgetExceeded) return null;
    throw err;
  }
}

/**
 * Contador de 【Activate】 por fonte e turno. A ativação de habilidade repetível
 * (sem 【Once per Turn】) não deixa rastro no estado (`usedKeywordsThisTurn` só
 * marca as 【Once per Turn】), então quem guarda é a instância da policy.
 */
export class EffectActionBudget {
  private readonly counts = new Map<string, number>();
  private readonly maxPerSourcePerTurn: number;

  constructor(maxPerSourcePerTurn = MAX_ACTIVATIONS_PER_SOURCE_PER_TURN) {
    this.maxPerSourcePerTurn = maxPerSourcePerTurn;
  }

  private key(turn: number, action: LegalAction): string | null {
    return action.kind === "activateAbility" ? `${turn}:${action.sourceInstanceId}` : null;
  }

  allows(turn: number, action: LegalAction): boolean {
    const key = this.key(turn, action);
    return key === null || (this.counts.get(key) ?? 0) < this.maxPerSourcePerTurn;
  }

  record(turn: number, action: LegalAction): void {
    const key = this.key(turn, action);
    if (key !== null) this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }
}
