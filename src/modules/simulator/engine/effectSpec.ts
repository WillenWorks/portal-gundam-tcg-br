import type { CardDef, CardInstance, Duration, GameEvent, GameState, PlayerId, StatKey, Zone } from "./types";
import { effectiveHp, effectivePilotDef, otherPlayer, satisfiesLinkCondition } from "./types";
import { findCard, findCardOwner } from "./events";
import { payResourceCostEvents } from "./costs";

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
  /** grupo de alvo nomeado, resolvido antes pelo seletor de UI/IA e colocado em EffectContext.targets — sempre usa só group[0], mesmo que o array tenha mais de 1 entrada (ver docs/18, escopo do seletor de UI). */
  | { kind: "named"; name: string }
  /** grupo de alvo COLETIVO, computado dinamicamente a partir de `ctx.state` — não precisa de escolha externa, porque o próprio padrão já define quem entra (ex.: "toda Unit amiga com Link ativo agora"). Ver docs/18, lacuna #5. */
  | { kind: "group"; group: TargetGroup };

/**
 * Padrões de alvo em grupo hoje usados por cartas reais: ST01-016 Asticassia
 * ("All friendly Link Units") e ST02-003 Gundam Heavyarms ("all enemy Units
 * that are Lv.3 or lower"). Novo padrão = novo membro desta union, não uma
 * reescrita do desenho — mesma filosofia dos outros campos estruturados do
 * DSL (`link`, `staticAbilities`).
 */
export type TargetGroup = { kind: "allFriendlyLinkUnits" } | { kind: "allEnemyUnits"; maxLevel?: number };

function isLinkUnit(state: GameState, unit: CardInstance): boolean {
  if (!unit.pairedPilotId) return false;
  const pilot = findCard(state, unit.pairedPilotId);
  return satisfiesLinkCondition(effectivePilotDef(pilot), unit.def);
}

function resolveTargetGroup(group: TargetGroup, ctx: EffectContext): string[] {
  if (group.kind === "allFriendlyLinkUnits") {
    const owner = ctx.state.players[ctx.controller];
    return owner.battleArea.filter((u) => u.def.cardType === "UNIT" && isLinkUnit(ctx.state, u)).map((u) => u.instanceId);
  }
  const opponent = ctx.state.players[otherPlayer(ctx.controller)];
  return opponent.battleArea
    .filter((u) => u.def.cardType === "UNIT" && (group.maxLevel === undefined || (u.def.level ?? 0) <= group.maxLevel))
    .map((u) => u.instanceId);
}

/** Resolve pra exatamente 1 instanceId — usado por quem sabe que o alvo é sempre singular ("self", "instance", "named"). */
function resolveTarget(ref: Exclude<TargetRef, { kind: "group" }>, ctx: EffectContext): string {
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

/** Resolve pra 0+ instanceIds — usado por toda primitiva que consome `TargetRef` (única fonte de verdade pra aplicar a mesma ação a um GRUPO inteiro de alvos, não só a 1). */
function resolveTargetIds(ref: TargetRef, ctx: EffectContext): string[] {
  if (ref.kind === "group") return resolveTargetGroup(ref.group, ctx);
  return [resolveTarget(ref, ctx)];
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
  | { op: "damageUnit"; target: TargetRef; amount: number }
  /** custo de recurso genérico (docs/18, lacuna #4) — resta N Recursos active do controller (ou os instanceIds dados), EX Resource sai do jogo (mesma regra de deploy.ts/costs.ts). Ex.: ST02-006 Tallgeese "④", ST01-015 White Base "②". */
  | { op: "payResourceCost"; player: PlayerRef; n: number; resourceInstanceIds?: string[] }
  /** cria 1+ instância nova a partir de um CardDef (docs/18, lacuna #3 — "criar instância nova"). Ex.: ST02-002 Wing Gundam (Bird Mode) "Place 1 EX Resource". */
  | { op: "spawnToken"; def: CardDef; player: PlayerRef; zone: Zone; count?: number; rested?: boolean }
  /** variante de spawnToken que escolhe QUAL CardDef instanciar contando as próprias Units em campo (ex.: ST01-015 White Base — Gundam/Guncannon/Guntank token conforme 0/1/2+ Units já em jogo). `thresholds` é avaliado em ordem crescente de `maxUnits`; o 1º cuja contagem atual seja <= maxUnits vence. */
  | { op: "spawnTokenByOwnUnitCount"; player: PlayerRef; zone: Zone; thresholds: { maxUnits: number; def: CardDef }[] }
  /** reordena 1 carta já revelada (via peekAndReorderDeck) de volta pro topo ou pro fundo do próprio deck, sem trocar de zona. Ex.: ST02-015 Saint Gabriel Institute. */
  | { op: "moveWithinDeck"; target: TargetRef; position: "top" | "bottom" }
  /**
   * "Add N of your Shields to your hand" — o 【Deploy】 que TODA Base do jogo
   * tem (91/91 no dataset oficial, sem exceção; ver docs/18). Como shields
   * são face-down e o dono não vê a identidade (`viewState.ts`), a escolha de
   * "qual shield" não carrega informação nenhuma: usa `ctx.targets.shield` se
   * vier (permite a UI oferecer a escolha no futuro), senão pega os N
   * primeiros. **No-op se o jogador não tem shield — a Base ainda é
   * deployada normalmente** (o texto não é "may", mas "não dá pra fazer" =
   * pula).
   */
  | { op: "addShieldToHand"; player: PlayerRef; count: number }
  /** ST02-013 Peaceful Timbre — impede que shields recebam dano de Units inimigas até o level dado, durante esta batalha (docs/18, lacuna #7). Não-op fora de combate. */
  | { op: "preventShieldDamage"; maxAttackerLevel: number };

export interface EffectContext {
  state: GameState;
  controller: PlayerId;
  sourceInstanceId: string;
  turnNumber: number;
  /** grupos de alvo já resolvidos (por seletor externo) antes de rodar o efeito */
  targets: Record<string, string[]>;
  /**
   * Recursos escolhidos pelo jogador pra pagar `payResourceCost` de uma
   * habilidade ativada (`activateAbility`) — evita o motor pegar os N primeiros
   * active (que inclui o EX Resource, sempre no índice 0). `undefined` =
   * comportamento antigo (auto-pick). O `resourceInstanceIds` da própria
   * primitiva (raro) ainda tem prioridade.
   */
  costResourceIds?: string[];
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
      return resolveTargetIds(call.target, ctx).map((instanceId): GameEvent => ({ type: "DESTROY_CARD", instanceId }));
    }
    case "moveZone": {
      return resolveTargetIds(call.target, ctx).map((instanceId): GameEvent => ({ type: "MOVE_CARD", instanceId, toZone: call.toZone }));
    }
    case "modifyStat": {
      return resolveTargetIds(call.target, ctx).map(
        (instanceId): GameEvent => ({
          type: "MODIFY_STAT",
          instanceId,
          modifier: { stat: call.stat, amount: call.amount, duration: call.duration, appliedOnTurn: ctx.turnNumber },
        }),
      );
    }
    case "grantKeyword": {
      return resolveTargetIds(call.target, ctx).map(
        (instanceId): GameEvent => ({
          type: "GRANT_KEYWORD",
          instanceId,
          grant: { keyword: call.keyword, duration: call.duration, appliedOnTurn: ctx.turnNumber },
        }),
      );
    }
    case "rest": {
      return resolveTargetIds(call.target, ctx).map((instanceId): GameEvent => ({ type: "REST_CARD", instanceId }));
    }
    case "setActive": {
      return resolveTargetIds(call.target, ctx).map((instanceId): GameEvent => ({ type: "SET_ACTIVE", instanceId }));
    }
    case "heal": {
      return resolveTargetIds(call.target, ctx).map((instanceId): GameEvent => ({ type: "HEAL_UNIT", instanceId, amount: call.amount }));
    }
    case "damageUnit": {
      const events: GameEvent[] = [];
      for (const instanceId of resolveTargetIds(call.target, ctx)) {
        events.push({ type: "DAMAGE_UNIT", instanceId, amount: call.amount });
        const card = findCard(ctx.state, instanceId);
        if (card.damage + call.amount >= effectiveHp(card, ctx.state)) {
          events.push({ type: "DESTROY_CARD", instanceId });
        }
      }
      return events;
    }
    case "payResourceCost": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      return payResourceCostEvents(ctx.state, player, call.n, call.resourceInstanceIds ?? ctx.costResourceIds);
    }
    case "spawnToken": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const count = call.count ?? 1;
      return Array.from({ length: count }, (): GameEvent => ({ type: "SPAWN_TOKEN", player, def: call.def, zone: call.zone, rested: call.rested }));
    }
    case "spawnTokenByOwnUnitCount": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const unitCount = ctx.state.players[player].battleArea.filter((c) => c.def.cardType === "UNIT").length;
      const sorted = [...call.thresholds].sort((a, b) => a.maxUnits - b.maxUnits);
      const match = sorted.find((t) => unitCount <= t.maxUnits);
      if (!match) return [];
      return [{ type: "SPAWN_TOKEN", player, def: match.def, zone: call.zone }];
    }
    case "moveWithinDeck": {
      // Reordenar o topo do deck é uma decisão OPCIONAL de quem controla (ver
      // `peekAndReorderDeck`): se ninguém decidiu (`ctx.targets` sem a entrada
      // nomeada — ex. dispatcher do servidor antes da camada de decisão da
      // Sessão 2), é no-op, o deck fica como está — resultado legal, não erro.
      if (call.target.kind === "named" && !ctx.targets[call.target.name]?.length) return [];
      return resolveTargetIds(call.target, ctx).map((instanceId): GameEvent => ({ type: "MOVE_WITHIN_DECK", instanceId, position: call.position }));
    }
    case "preventShieldDamage": {
      return [{ type: "SET_SHIELD_PROTECTION", maxAttackerLevel: call.maxAttackerLevel }];
    }
    case "addShieldToHand": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const shields = ctx.state.players[player].shields;
      const chosen = ctx.targets.shield?.length
        ? ctx.targets.shield.slice(0, call.count)
        : shields.slice(0, call.count).map((s) => s.instanceId);
      return chosen.map((instanceId): GameEvent => ({ type: "MOVE_CARD", instanceId, toZone: "hand" }));
    }
  }
}

/**
 * "Look at the top N cards of your deck" (ex.: ST02-015 Saint Gabriel
 * Institute) — leitura pura, sem evento: só devolve as N cartas do topo pra
 * quem for decidir a reordenação (UI/IA/teste) montar `ctx.targets` antes de
 * chamar `resolveEffectSpec` (mesmo padrão de "named" já usado por
 * "target"/"shield" em toda carta com escolha externa). A reordenação em si
 * é feita depois, via a primitiva `moveWithinDeck` (docs/18, lacuna #8).
 */
export function peekAndReorderDeck(state: GameState, player: PlayerId, n: number): CardInstance[] {
  return state.players[player].deck.slice(0, n);
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
  /**
   * `true` quando o texto oficial diz "You may ..." (o jogador escolhe ativar
   * ou pular). Default `false` = mandatório (resolve, ou não faz nada se não há
   * alvo legal). Nenhum efeito de ST01/ST02 é opcional.
   */
  optional?: boolean;
  /**
   * O que `ctx.targets.target` deve ser — a UI usa pra montar a lista de alvos
   * possíveis quando o efeito pausa pra escolha. Default `"enemyUnit"`.
   */
  targetScope?: "enemyUnit" | "ownResource" | "friendlyUnit";
}

/**
 * `true` se algum `PrimitiveCall` do spec (em `actions`, `condition.then` ou
 * `condition.else`) consome o alvo nomeado `"target"` (`ctx.targets.target`).
 * Usado pra decidir se um gatilho precisa de interação do jogador.
 */
export function specNeedsNamedTarget(spec: EffectSpec): boolean {
  const uses = (calls: PrimitiveCall[] | undefined) =>
    (calls ?? []).some((call) => {
      const target = (call as { target?: { kind?: string; name?: string } }).target;
      return target?.kind === "named" && target.name === "target";
    });
  return uses(spec.actions) || uses(spec.condition?.then) || uses(spec.condition?.else);
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
