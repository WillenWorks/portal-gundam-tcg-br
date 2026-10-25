/* Spec simulador-animacao-pelo-log, fase 2: os eventos que o motor aplicou (`MatchView.eventsSince`) viram passos de
 * animação, na ordem. A tela toca os passos em vez de deduzir o que aconteceu comparando visões. Puro/testável.
 *
 * O mapeamento é um registro com TODOS os tipos de `GameEvent`: evento novo no motor não compila até alguém decidir
 * aqui se ele anima (e como) ou se é só registro (`null`). */
import type { AttackTarget, CardDef, GameEvent, Phase, PlayerId, Zone } from "../engine/types";

export type AnimationStep =
  | { kind: "turn"; turnNumber: number; activePlayer: PlayerId }
  | { kind: "phase"; phase: Phase }
  | { kind: "draw"; player: PlayerId; from: "deck" | "resourceDeck"; instanceId: string | null }
  | { kind: "cardPlayed"; player: PlayerId; instanceId: string; as: "unit" | "base" | "pilot" | "command"; trigger?: "Main" | "Action" }
  | { kind: "abilityActivated"; player: PlayerId; instanceId: string; trigger: string }
  /** carta mudou de zona; de onde saiu a tela lê na visão anterior */
  | { kind: "move"; instanceId: string; toZone: Zone }
  | { kind: "pair"; pilotId: string; unitId: string }
  | { kind: "token"; player: PlayerId; def: CardDef; zone: Zone }
  | { kind: "attack"; attackerId: string; attackingPlayer: PlayerId; defendingPlayer: PlayerId; target: AttackTarget }
  | { kind: "retarget"; unitId: string }
  | { kind: "block"; blockerId: string; target: AttackTarget }
  | { kind: "damage"; instanceId: string; amount: number; on: "unit" | "base" }
  | { kind: "heal"; instanceId: string; amount: number }
  | { kind: "destroy"; instanceId: string }
  | { kind: "exile"; instanceId: string }
  | { kind: "shieldBreak"; player: PlayerId; count: number }
  | { kind: "rest"; instanceId: string }
  | { kind: "active"; instanceId: string }
  | { kind: "discard"; player: PlayerId; instanceIds: string[] }
  /** marca de efeito sobre uma carta (stat, keyword, proteção, trava) — vira o "cue" do EffectResolutionOverlay */
  | { kind: "cue"; instanceId: string; cue: "buff" | "debuff" | "keyword" | "protect" | "lock" }
  | { kind: "combatEnd" }
  /** decisão aberta para `player` — a tela para aqui se for a do próprio assento (Burst, alvo) */
  | { kind: "decision"; player: PlayerId }
  | { kind: "gameOver"; winner: PlayerId | null };

type Mapper = { [K in GameEvent["type"]]: (event: Extract<GameEvent, { type: K }>) => AnimationStep | null };

/** `null` = só registro (contabilidade do motor, nada para animar) */
const STEP_OF: Mapper = {
  TURN_CHANGE: (e) => ({ kind: "turn", turnNumber: e.turnNumber, activePlayer: e.activePlayer }),
  PHASE_CHANGE: (e) => ({ kind: "phase", phase: e.phase }),
  DRAW_CARD: (e) => ({ kind: "draw", player: e.player, from: e.from, instanceId: e.instanceId }),
  CARD_PLAYED: (e) => ({ kind: "cardPlayed", player: e.player, instanceId: e.instanceId, as: e.as, ...(e.trigger ? { trigger: e.trigger } : {}) }),
  ABILITY_ACTIVATED: (e) => ({ kind: "abilityActivated", player: e.player, instanceId: e.instanceId, trigger: e.trigger }),
  MOVE_CARD: (e) => ({ kind: "move", instanceId: e.instanceId, toZone: e.toZone }),
  DEPLOY_AS_UNIT: (e) => ({ kind: "move", instanceId: e.instanceId, toZone: "battleArea" }),
  PAIR_CARDS: (e) => ({ kind: "pair", pilotId: e.pilotId, unitId: e.unitId }),
  SPAWN_TOKEN: (e) => ({ kind: "token", player: e.player, def: e.def, zone: e.zone }),
  ATTACK_DECLARED: (e) => ({ kind: "attack", attackerId: e.attackerId, attackingPlayer: e.attackingPlayer, defendingPlayer: e.defendingPlayer, target: e.target }),
  BEGIN_DAMAGE_ONLY_BATTLE: (e) => ({
    kind: "attack",
    attackerId: e.attackerId,
    attackingPlayer: e.attackingPlayer,
    defendingPlayer: e.defendingPlayer,
    target: { unitId: e.targetId },
  }),
  ATTACK_TARGET_CHANGED: (e) => ({ kind: "retarget", unitId: e.unitId }),
  BLOCK_DECLARED: (e) => ({ kind: "block", blockerId: e.blockerId, target: e.newTarget }),
  DAMAGE_UNIT: (e) => (e.amount > 0 ? { kind: "damage", instanceId: e.instanceId, amount: e.amount, on: "unit" } : null),
  DAMAGE_BASE: (e) => (e.amount > 0 ? { kind: "damage", instanceId: e.instanceId, amount: e.amount, on: "base" } : null),
  HEAL_UNIT: (e) => (e.amount > 0 ? { kind: "heal", instanceId: e.instanceId, amount: e.amount } : null),
  DESTROY_CARD: (e) => ({ kind: "destroy", instanceId: e.instanceId }),
  REMOVE_CARD_FROM_GAME: (e) => ({ kind: "exile", instanceId: e.instanceId }),
  DAMAGE_SHIELD: (e) => (e.count > 0 ? { kind: "shieldBreak", player: e.player, count: e.count } : null),
  REST_CARD: (e) => ({ kind: "rest", instanceId: e.instanceId }),
  SET_ACTIVE: (e) => ({ kind: "active", instanceId: e.instanceId }),
  DISCARD_TO_HAND_LIMIT: (e) => ({ kind: "discard", player: e.player, instanceIds: e.instanceIds }),
  MODIFY_STAT: (e) => ({ kind: "cue", instanceId: e.instanceId, cue: e.modifier.amount >= 0 ? "buff" : "debuff" }),
  GRANT_KEYWORD: (e) => ({ kind: "cue", instanceId: e.instanceId, cue: "keyword" }),
  GRANT_DAMAGE_MODIFIER: (e) => ({ kind: "cue", instanceId: e.instanceId, cue: "protect" }),
  GRANT_BATTLE_DAMAGE_IMMUNITY_UNTIL_TURN: (e) => ({ kind: "cue", instanceId: e.instanceId, cue: "protect" }),
  SET_UNIT_DAMAGE_PROTECTION: (e) => ({ kind: "cue", instanceId: e.instanceId, cue: "protect" }),
  GRANT_ATTACK_TARGET_RELAX: (e) => ({ kind: "cue", instanceId: e.instanceId, cue: "keyword" }),
  SET_CANNOT_ATTACK: (e) => ({ kind: "cue", instanceId: e.instanceId, cue: "lock" }),
  SET_CANNOT_ACTIVATE: (e) => ({ kind: "cue", instanceId: e.instanceId, cue: "lock" }),
  PREVENT_BEING_ATTACK_TARGET: (e) => ({ kind: "cue", instanceId: e.instanceId, cue: "protect" }),
  COMBAT_ENDED: () => ({ kind: "combatEnd" }),
  SET_PENDING_DECISION: (e) => ({ kind: "decision", player: e.player }),
  GAME_OVER: (e) => ({ kind: "gameOver", winner: e.winner }),

  // contabilidade do motor: passes, passos do combate, marcas de turno, reordenação oculta do deck
  ACTION_PASS: () => null,
  COMBAT_STEP_CHANGE: () => null,
  BEGIN_END_PHASE_ACTION_STEP: () => null,
  END_PHASE_ACTION_PASS: () => null,
  END_END_PHASE_ACTION_STEP: () => null,
  CLEAR_PENDING_DECISION: () => null,
  CLEAR_TURN_MODIFIERS: () => null,
  MARK_KEYWORD_USED: () => null,
  MARK_COMMAND_PAYMENT: () => null,
  MARK_COMMAND_TRAITS_ACTIVATED: () => null,
  MARK_OWN_UNIT_DESTROYED_BY_OWN_EFFECT: () => null,
  MARK_RESOURCE_SET_ACTIVE_BY_EFFECT: () => null,
  ADD_DELAYED_REACTION: () => null,
  SET_INDESTRUCTIBLE_BY_ENEMY_EFFECTS: () => null,
  SET_SHIELD_AREA_EFFECT_REDUCTION: () => null,
  SET_SHIELD_PROTECTION: () => null,
  SET_BATTLE_DAMAGE_REDIRECT: () => null,
  MOVE_WITHIN_DECK: () => null,
  RETURN_TRASH_TO_DECK_SHUFFLE: () => null,
};

export function stepOf(event: GameEvent): AnimationStep | null {
  return (STEP_OF[event.type] as (e: GameEvent) => AnimationStep | null)(event);
}

/** os passos de animação dos eventos, na ordem em que o motor os aplicou */
export function timelineFromEvents(events: readonly GameEvent[]): AnimationStep[] {
  return events.flatMap((event) => {
    const step = stepOf(event);
    return step ? [step] : [];
  });
}
