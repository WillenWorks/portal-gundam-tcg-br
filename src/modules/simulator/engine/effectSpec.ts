import type { Duration, GameEvent, GameState, PlayerId, StatKey, Zone } from "./types";
import { effectiveHp, otherPlayer } from "./types";
import { findCard, findCardOwner } from "./events";

/**
 * "Effect Spec" — formalização da Camada 3 (texto livre → lógica) proposta
 * em docs/18: uma estrutura declarativa intermediária entre o `effectEn`
 * bruto do `CardModel` e os eventos executáveis do motor, em vez de pular
 * direto pra uma closure JS opaca.
 *
 * Por que isso importa: dá pra revisar um `EffectSpec` lado a lado com o
 * texto oficial da carta (mesma lógica de "validável e confiável" já usada
 * no motor de estatísticas), e dá um checkpoint natural de cobertura por
 * carta/por wave (ex.: "174 cartas de ST01-04+GD01 precisam de EffectSpec,
 * X já têm"). Autoria carta a carta é trabalho da Fase 1, passo 3
 * ("Escolher 1 deck de teste") — este arquivo só define a forma, ainda não
 * tem nenhum `EffectSpec` de carta real.
 *
 * Toda keyword oficial (Blocker, First Strike, Support, Repair, Breach,
 * Suppression, High-Maneuver, Once per Turn) já é tratada automaticamente
 * pelo motor (combat.ts / keywords.ts) — não precisa de EffectSpec. Isso
 * fica só pro texto bespoke dentro de `textSectionsJson[].text`.
 */

export type PlayerRef = PlayerId | "controller" | "opponent";

function resolvePlayerRef(ref: PlayerRef, controller: PlayerId): PlayerId {
  if (ref === "controller") return controller;
  if (ref === "opponent") return otherPlayer(controller);
  return ref;
}

export type TargetRef =
  | { kind: "self" }
  | { kind: "instance"; instanceId: string }
  /** grupo de alvo nomeado, resolvido antes pelo seletor de UI/IA e colocado em EffectContext.targets */
  | { kind: "named"; name: string };

function resolveTarget(ref: TargetRef, ctx: EffectContext): string {
  switch (ref.kind) {
    case "self":
      return ctx.sourceInstanceId;
    case "instance":
      return ref.instanceId;
    case "named": {
      const group = ctx.targets[ref.name];
      if (!group || group.length === 0) {
        throw new Error(`Alvo nomeado "${ref.name}" não foi resolvido antes da execução do efeito`);
      }
      return group[0];
    }
  }
}

export type PrimitiveCall =
  | { op: "draw"; player: PlayerRef; n: number }
  | { op: "discard"; player: PlayerRef; instanceIds: string[] }
  | { op: "damageShield"; player: PlayerRef; count: number }
  | { op: "destroy"; target: TargetRef }
  | { op: "moveZone"; target: TargetRef; toZone: Zone }
  | { op: "modifyStat"; target: TargetRef; stat: StatKey; amount: number; duration: Duration }
  | { op: "grantKeyword"; target: TargetRef; keyword: string; duration: Duration }
  | { op: "rest"; target: TargetRef }
  | { op: "setActive"; target: TargetRef }
  | { op: "heal"; target: TargetRef; amount: number }
  /** dano direto numa Unit/Base (ex.: "Deal 1 damage to it") — destrói automaticamente se o dano acumulado bater o HP efetivo (Comprehensive Rules 5-5-2), igual à checagem já feita em combat.ts pro dano de batalha */
  | { op: "damageUnit"; target: TargetRef; amount: number };

export interface EffectContext {
  state: GameState;
  controller: PlayerId;
  sourceInstanceId: string;
  turnNumber: number;
  /** grupos de alvo já resolvidos (por seletor externo) antes de rodar o efeito */
  targets: Record<string, string[]>;
}

/**
 * Traduz uma única primitiva em 0+ GameEvent. Não muta nada — só lê
 * `ctx.state` pra resolver referência (ex.: saber quem é dono de uma
 * instância) e devolve eventos, que quem chama aplica com `applyEvents`.
 */
export function compilePrimitive(call: PrimitiveCall, ctx: EffectContext): GameEvent[] {
  switch (call.op) {
    case "draw": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const events: GameEvent[] = [];
      const deck = ctx.state.players[player].deck;
      for (let i = 0; i < call.n && i < deck.length; i++) {
        events.push({ type: "DRAW_CARD", player, from: "deck", instanceId: deck[i]?.instanceId ?? null });
      }
      return events;
    }
    case "discard": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      return [{ type: "DISCARD_TO_HAND_LIMIT", player, instanceIds: call.instanceIds }];
    }
    case "damageShield": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      return [{ type: "DAMAGE_SHIELD", player, count: call.count }];
    }
    case "destroy": {
      const instanceId = resolveTarget(call.target, ctx);
      return [{ type: "DESTROY_CARD", instanceId }];
    }
    case "moveZone": {
      const instanceId = resolveTarget(call.target, ctx);
      return [{ type: "MOVE_CARD", instanceId, toZone: call.toZone }];
    }
    case "modifyStat": {
      const instanceId = resolveTarget(call.target, ctx);
      return [
        {
          type: "MODIFY_STAT",
          instanceId,
          modifier: { stat: call.stat, amount: call.amount, duration: call.duration, appliedOnTurn: ctx.turnNumber },
        },
      ];
    }
    case "grantKeyword": {
      const instanceId = resolveTarget(call.target, ctx);
      return [
        {
          type: "GRANT_KEYWORD",
          instanceId,
          grant: { keyword: call.keyword, duration: call.duration, appliedOnTurn: ctx.turnNumber },
        },
      ];
    }
    case "rest": {
      const instanceId = resolveTarget(call.target, ctx);
      return [{ type: "REST_CARD", instanceId }];
    }
    case "setActive": {
      const instanceId = resolveTarget(call.target, ctx);
      return [{ type: "SET_ACTIVE", instanceId }];
    }
    case "heal": {
      const instanceId = resolveTarget(call.target, ctx);
      return [{ type: "HEAL_UNIT", instanceId, amount: call.amount }];
    }
    case "damageUnit": {
      const instanceId = resolveTarget(call.target, ctx);
      const events: GameEvent[] = [{ type: "DAMAGE_UNIT", instanceId, amount: call.amount }];
      const card = findCard(ctx.state, instanceId);
      if (card.damage + call.amount >= effectiveHp(card)) {
        events.push({ type: "DESTROY_CARD", instanceId });
      }
      return events;
    }
  }
}

export function compileActions(calls: PrimitiveCall[], ctx: EffectContext): GameEvent[] {
  return calls.flatMap((call) => compilePrimitive(call, ctx));
}

/**
 * Uma condição if/then/else. `predicate` é um id/descrição avaliado por um
 * `PredicateResolver` registrado externamente — a Fase 1 ainda não define
 * nenhum predicado real (isso nasce junto com o primeiro efeito bespoke
 * autorado, passo 3 do plano incremental).
 */
export interface EffectCondition {
  predicate: string;
  then: PrimitiveCall[];
  else?: PrimitiveCall[];
}

export type PredicateResolver = (predicate: string, ctx: EffectContext) => boolean;

/** Um efeito bespoke de uma carta específica, revisável lado a lado com o texto oficial. */
export interface EffectSpec {
  /** id legível — "<code>-<trigger>", ex.: "GD01-001-Deploy" */
  id: string;
  cardCode: string;
  /** rótulo do textSectionsJson correspondente — "Deploy" | "Attack" | "Destroyed" | "Burst" | "Activate·Main" | "Activate·Action" | etc. */
  trigger: string;
  cost?: PrimitiveCall[];
  condition?: EffectCondition;
  actions: PrimitiveCall[];
  /** effectEn da seção correspondente — nunca effectPt (ver docs/18, cobertura de idioma) */
  sourceText: string;
}

export function resolveEffectSpec(spec: EffectSpec, ctx: EffectContext, resolvePredicate?: PredicateResolver): GameEvent[] {
  const events: GameEvent[] = [];
  if (spec.cost) events.push(...compileActions(spec.cost, ctx));

  if (spec.condition) {
    if (!resolvePredicate) {
      throw new Error(`EffectSpec "${spec.id}" tem condição mas nenhum PredicateResolver foi passado`);
    }
    const result = resolvePredicate(spec.condition.predicate, ctx);
    events.push(...compileActions(result ? spec.condition.then : spec.condition.else ?? [], ctx));
  }

  events.push(...compileActions(spec.actions, ctx));
  return events;
}

// re-exportado por conveniência pra quem só quer inspecionar dono/zona de um alvo antes de montar uma primitiva
export { findCard, findCardOwner };
