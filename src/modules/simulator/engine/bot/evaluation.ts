import type { CardDef, CardInstance, GameState, PlayerId, PlayerState, StatKey, Zone } from "../types";
import { effectiveAp, effectiveHp, hasKeyword, otherPlayer } from "../types";
import type { EffectSpec, PredicateResolver, TargetFilterResolver } from "../effectSpec";
import type { LegalAction } from "../legalActions";
import type { Rng } from "../rng";
import { createRng } from "../rng";
import type { ViewCardInstance, ViewGameState } from "../viewState";
import { applyPlayerAction } from "../actions";
import { cloneState } from "../events";
import { attackIneligibilityReason } from "../combat";

/**
 * Peças de avaliação compartilhadas pelos bots que simulam (MCTS e lookahead de
 * efeitos): determinização da view (ver a "LIMITAÇÃO HONESTA" em `mctsPolicy.ts`
 * — toda carta oculta vira filler vanilla, nada da mão/deck real do oponente
 * entra), aplicação de ação no estado especulado e valor da posição.
 */

/** o que `applyForEval` precisa pra aplicar uma ação com efeitos reais */
export interface EvalDeps {
  specs: EffectSpec[];
  predicateResolver?: PredicateResolver;
  targetFilterResolver?: TargetFilterResolver;
}

const FILLER_UNIT: CardDef = {
  code: "MCTS-FILLER-UNIT",
  nameEn: "Unidade genérica",
  cardType: "UNIT",
  color: "colorless",
  level: 1,
  cost: 1,
  ap: 1,
  hp: 1,
};

const FILLER_RESOURCE: CardDef = {
  code: "MCTS-FILLER-RESOURCE",
  nameEn: "Recurso genérico",
  cardType: "RESOURCE",
  color: "colorless",
};

/** seed derivado do rng do chamador — mantém tudo determinístico e puro */
export function deriveRng(rng: Rng): Rng {
  const seed = Math.floor(rng() * 0x1_0000_0000) >>> 0;
  return createRng(seed === 0 ? 1 : seed);
}

function isReal(card: ViewCardInstance): card is CardInstance {
  return !("hidden" in card);
}

function fillerInstance(owner: PlayerId, zone: Zone, index: number, kind: "unit" | "resource"): CardInstance {
  return {
    instanceId: `mcts-${owner}-${zone}-${index}`,
    def: kind === "resource" ? FILLER_RESOURCE : FILLER_UNIT,
    owner,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: 0,
  };
}

function fillers(owner: PlayerId, zone: Zone, count: number, kind: "unit" | "resource"): CardInstance[] {
  const out: CardInstance[] = [];
  for (let i = 0; i < count; i++) out.push(fillerInstance(owner, zone, i, kind));
  return out;
}

/** só as cartas reais de uma zona pública da view (defensivo: qualquer `HiddenCard` numa zona que devia ser pública vira filler) */
function realOf(cards: ViewCardInstance[], owner: PlayerId, zone: Zone): CardInstance[] {
  return cards.map((c, i) => (isReal(c) ? c : fillerInstance(owner, zone, i, "unit")));
}

function reconstructPlayer(view: ViewGameState, pid: PlayerId): PlayerState {
  const vp = view.players[pid];
  const isViewer = pid === view.viewer;
  return {
    id: pid,
    deck: fillers(pid, "deck", vp.counts.deck, "unit"),
    resourceDeck: fillers(pid, "resourceDeck", vp.counts.resourceDeck, "resource"),
    shields: fillers(pid, "shields", vp.counts.shields, "unit"),
    resourceArea: realOf(vp.resourceArea, pid, "resourceArea"),
    battleArea: realOf(vp.battleArea, pid, "battleArea"),
    baseSection: realOf(vp.baseSection, pid, "baseSection"),
    trash: realOf(vp.trash, pid, "trash"),
    exile: realOf(vp.exile, pid, "exile"),
    hand: isViewer ? realOf(vp.hand, pid, "hand") : fillers(pid, "hand", vp.counts.hand, "unit"),
  };
}

/**
 * `ViewGameState` → `GameState` especulado. Sem `rng` — os fillers são fixos,
 * então a determinização é uma função pura do view. `cloneState` no final
 * isola as `CardInstance` reais que vieram por referência do view do chamador.
 */
export function determinize(view: ViewGameState): GameState {
  const state: GameState = {
    turnNumber: view.turnNumber,
    activePlayer: view.activePlayer,
    phase: view.phase,
    combat: view.combat,
    endPhaseAction: view.endPhaseAction,
    pendingDecision: view.pendingDecision,
    players: {
      A: reconstructPlayer(view, "A"),
      B: reconstructPlayer(view, "B"),
    },
    eventLog: [...view.eventLog],
    gameOver: view.gameOver,
    // acima de qualquer seq real (`${owner}-${n}`, n na casa das centenas) e dos ids `mcts-*`
    nextInstanceSeq: 1_000_000,
    seed: 1,
    engineVersion: view.engineVersion,
  };
  return cloneState(state);
}

/** força de um lado: shields e Base pesam (é como se ganha/perde), tabuleiro e mão entram diluídos */
export function sideStrength(state: GameState, pid: PlayerId): number {
  const p = state.players[pid];
  const shields = p.shields.length;
  const baseHp = p.baseSection
    .filter((c) => c.def.cardType === "BASE")
    .reduce((s, c) => s + Math.max(0, effectiveHp(c, state) - c.damage), 0);
  const board = p.battleArea
    .filter((c) => c.def.cardType === "UNIT")
    .reduce((s, c) => s + effectiveAp(c, state) + Math.max(0, effectiveHp(c, state) - c.damage), 0);
  return shields * 3 + baseHp * 1.2 + board * 0.5 + p.hand.length * 0.25;
}

/** valor da posição pro `seat` em [0,1] — usado quando o rollout é truncado sem vencedor */
export function positionValue(state: GameState, seat: PlayerId): number {
  const diff = sideStrength(state, seat) - sideStrength(state, otherPlayer(seat));
  return 0.5 + 0.5 * Math.tanh(diff / 9);
}

/** mesmo critério do `isPlainLegalityError` interno do `legalActions.ts` */
function isPlainLegalityError(err: unknown): boolean {
  return err instanceof Error && err.name === "Error";
}

/**
 * Aplica `action` no estado determinizado. Devolve `null` quando a ação é legal
 * na VIEW real mas não no estado especulado — acontece com efeitos que mexem em
 * zona oculta (ex. "olhe o topo 3 e revele", `lookAtTopFilterReveal`): a carta
 * escolhida de verdade não está no deck de fillers. O MCTS simplesmente não
 * avalia essas ações (fica com a âncora da heurística). Erro que NÃO é de
 * legalidade "plana" propaga — é achado de motor.
 */
export function applyForEval(action: LegalAction, determinized: GameState, seat: PlayerId, cfg: EvalDeps): GameState | null {
  try {
    return applyPlayerAction(determinized, seat, action, cfg.specs, cfg.predicateResolver, cfg.targetFilterResolver);
  } catch (err) {
    if (isPlainLegalityError(err)) return null;
    throw err;
  }
}

/**
 * Pesos da avaliação estendida (lookahead de efeitos). Mesma escala de
 * `sideStrength` (shield = 3). Calibrados no benchmark — mexer aqui muda o
 * quanto o bot valoriza cada coisa ao decidir se um efeito vale a pena.
 *
 * Recurso ativo NÃO entra de propósito: ele desvira todo turno, então gastá-lo
 * no Action Step/fim de turno/turno do oponente não custa nada, e na Main o custo
 * de oportunidade já vem da ordem das notas da policy (deploy > Comando pega os
 * recursos primeiro). Pesar recurso aqui fazia "Draw 2" por ③ parecer ruim mesmo
 * com os recursos sobrando.
 */
export const EVAL_WEIGHTS = {
  shield: 3,
  baseHp: 1.2,
  durableBoard: 0.5,
  handCard: 0.25,
  attackReadyAp: 0.4,
  // <Blocker> ativo do lado que DEFENDE (não é o jogador ativo): é a defesa que o
  // ataque deste turno encontra — sem isto, dar rest num bloqueador valeria 0.
  readyBlockerHp: 0.3,
} as const;

/** fim de jogo domina qualquer diferença de tabuleiro; finito pra `delta` entre dois fins de jogo nunca virar NaN */
export const GAME_OVER_VALUE = 1_000_000;

/** stat sem os modificadores que expiram ("durante este turno"/"nesta batalha") — o que sobra no tabuleiro depois */
function durableStat(card: CardInstance, stat: StatKey, effective: number): number {
  const temporary = card.statModifiers
    .filter((m) => m.stat === stat && m.duration !== "permanent")
    .reduce((sum, m) => sum + m.amount, 0);
  return Math.max(0, effective - temporary);
}

/**
 * AP ATUAL (com pump) das Units de `pid` que ainda podem atacar neste turno — é o
 * que dá valor a um pump de Main Phase e zera o de uma Unit que já atacou.
 */
function attackReadyApOf(state: GameState, pid: PlayerId): number {
  return state.players[pid].battleArea
    .filter((c) => c.def.cardType === "UNIT" && attackIneligibilityReason(state, c) === null)
    .reduce((s, c) => s + effectiveAp(c, state), 0);
}

function extendedStrength(state: GameState, pid: PlayerId): number {
  const p = state.players[pid];
  const shields = p.shields.length;
  const baseHp = p.baseSection
    .filter((c) => c.def.cardType === "BASE")
    .reduce((s, c) => s + Math.max(0, durableStat(c, "hp", effectiveHp(c, state)) - c.damage), 0);
  const units = p.battleArea.filter((c) => c.def.cardType === "UNIT");
  const durableBoard = units.reduce(
    (s, c) => s + durableStat(c, "ap", effectiveAp(c, state)) + Math.max(0, durableStat(c, "hp", effectiveHp(c, state)) - c.damage),
    0,
  );
  const attackReadyAp = attackReadyApOf(state, pid);
  const readyBlockerHp =
    pid === state.activePlayer
      ? 0
      : Math.min(
          units
            .filter((c) => !c.rested && hasKeyword(c, "Blocker", state))
            .reduce((s, c) => s + Math.max(0, effectiveHp(c, state) - c.damage), 0),
          // bloqueador só "defende" o que existe pra ser bloqueado neste turno
          attackReadyApOf(state, state.activePlayer),
        );
  return (
    shields * EVAL_WEIGHTS.shield +
    baseHp * EVAL_WEIGHTS.baseHp +
    durableBoard * EVAL_WEIGHTS.durableBoard +
    p.hand.length * EVAL_WEIGHTS.handCard +
    attackReadyAp * EVAL_WEIGHTS.attackReadyAp +
    readyBlockerHp * EVAL_WEIGHTS.readyBlockerHp
  );
}

/**
 * Valor da posição pro `seat` (diferença crua, sem `tanh` — o lookahead compara
 * deltas pequenos e precisa de sensibilidade linear). Positivo = melhor pro `seat`.
 * Diferente de `positionValue` (usado nos rollouts do MCTS, que não muda aqui).
 */
export function evaluatePosition(state: GameState, seat: PlayerId): number {
  if (state.gameOver) {
    if (state.gameOver.winner === seat) return GAME_OVER_VALUE;
    if (state.gameOver.winner === otherPlayer(seat)) return -GAME_OVER_VALUE;
    return 0;
  }
  return extendedStrength(state, seat) - extendedStrength(state, otherPlayer(seat));
}
