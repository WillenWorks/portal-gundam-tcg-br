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

export function resolvePlayerRef(ref: PlayerRef, controller: PlayerId): PlayerId {
  if (ref === "controller") return controller;
  if (ref === "opponent") return otherPlayer(controller);
  return ref;
}

export type TargetRef =
  | { kind: "self" }
  /** a Unit pareada com a fonte — se a fonte JÁ é Unit, é ela mesma; se é Pilot,
   *  é `pairedUnitId`. Usado por efeito de Pilot cujo texto diz "this Unit"
   *  (ex. ST03-011 Char Aznable 【Attack】). Lança se a fonte é Pilot sem par. */
  | { kind: "pairedUnit" }
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

/** Resolve pra exatamente 1 instanceId — usado por quem sabe que o alvo é sempre singular ("self", "pairedUnit", "instance", "named"). */
function resolveTarget(ref: Exclude<TargetRef, { kind: "group" }>, ctx: EffectContext): string {
  switch (ref.kind) {
    case "self":
      return ctx.sourceInstanceId;
    case "pairedUnit": {
      const source = findCard(ctx.state, ctx.sourceInstanceId);
      if (source.def.cardType === "UNIT") return ctx.sourceInstanceId;
      if (source.pairedUnitId) return source.pairedUnitId;
      throw new Error("Alvo \"pairedUnit\": a fonte não é Unit e não tem Unit pareada");
    }
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
  /** "discard N" onde a(s) carta(s) são escolha do jogador — lê `ctx.targets[name]`
   *  (mesmo padrão de alvo nomeado). Ex.: ST04-002 Strike Gundam "Draw 1. Then,
   *  discard 1." No-op se nada foi escolhido (o dispatcher pausa pra escolha). */
  | { op: "discardNamed"; player: PlayerRef; name: string; n: number }
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
  /** reordena 1 carta já revelada (via peekAndReorderDeck) de volta pro topo ou pro fundo do próprio deck, sem trocar de zona. Ex.: ST02-015 Saint Gabriel Institute. Com `target.kind: "named"` é interativo (camada de decisão, `deckReorder`). */
  | { op: "moveWithinDeck"; target: TargetRef; position: "top" | "bottom" }
  /**
   * "deploy 1 [A] or 1 [B] Unit token" — o jogador escolhe QUAL token invocar
   * (ex. ST04-012 Striker Pack 【Main】: Sword Strike ou Launcher Strike). A
   * escolha vem em `ctx.targets[key]` (0 ou 1 valor de `options[].value`),
   * resolvida pela camada de decisão (`enumChoice`). Sem escolha → `options[0]`
   * (default defensivo — a camada de decisão sempre força a escolha). */
  | { op: "spawnTokenChoice"; player: PlayerRef; zone: Zone; key: string; options: { value: string; label: string; def: CardDef }[] }
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
  | { op: "preventShieldDamage"; maxAttackerLevel: number }
  /**
   * ST03-014 The Blue Giant 【Action】 — "Choose 1 friendly Unit. It can't receive
   * battle damage from enemy Units with 2 or less AP during this battle." Instala
   * `CombatState.unitDamageProtection` pra a Unit escolhida (`target` nomeado).
   * Não-op fora de combate. `maxAttackerAp` inclusivo.
   */
  | { op: "preventUnitBattleDamage"; target: TargetRef; maxAttackerAp: number }
  /**
   * ST04-011 Athrun Zala 【When Linked】 — "During this turn, this Unit may choose
   * an active enemy Unit that is Lv.5 or lower as its attack target." Instala
   * `CardInstance.attackTargetRelaxUntilTurn` na Unit alvo (normalmente
   * `{ kind: "pairedUnit" }` — "this Unit" no texto do Pilot), válido só no
   * turno atual.
   */
  | { op: "grantAttackTargetRelax"; target: TargetRef; maxLevel: number }
  /**
   * ST04-015 Archangel 【Activate･Main】 — "It can't attack during this turn."
   * Marca `CardInstance.cannotAttackUntilTurn = turno atual` na Unit alvo;
   * `declareAttack` barra enquanto for o mesmo turno.
   */
  | { op: "preventAttackThisTurn"; target: TargetRef }
  /**
   * "Look at the top N cards of your deck. You may reveal 1 <filtro> card among
   * them and add it to your hand. Return the remaining cards randomly to the
   * bottom of your deck." — ST03-006 Char's Zaku Ⅱ 【Destroyed】 (docs/41,
   * primitiva nova). A carta revelada vem em `ctx.targets[revealName]` (0 ou 1
   * instanceId, escolhido antes pela camada de decisão — mesmo padrão de
   * `peekAndReorderDeck` + "named"); precisa estar no topo N e casar `filter`,
   * senão lança. Sem escolha (`optional`, jogador declina) → todas as N vão pro
   * fundo. Ordenação pro fundo segue a ordem do topo (mesma limitação de
   * `moveWithinDeck`; a aleatoriedade só esconde info de quem já olhou). */
  | { op: "lookAtTopFilterReveal"; player: PlayerRef; count: number; filter: CardDefFilter; revealName?: string }
  /**
   * "You may deploy 1 <filtro> card from your hand." disparado por gatilho
   * (【When Paired】 de ST03-010 Full Frontal, docs/41) — deploy SEM pagar custo
   * de ação nem de recurso, mas validando que a carta escolhida
   * (`ctx.targets[deployName]`) está na mão, é Unit e casa `filter` (trait/level).
   * O limite de 6 Units NÃO bloqueia (igual a `deployCard`: excesso resolvido
   * depois por rules management). Sem escolha → no-op. */
  | { op: "deployFromHandTriggered"; player: PlayerRef; filter: CardDefFilter; deployName?: string }
  /**
   * "【Burst】Deploy this card." — coloca a PRÓPRIA carta (BASE → baseSection,
   * UNIT → battleArea) em campo, aplicando a regra de 1 Base (a Base atual vai
   * pro trash, ou pro exílio se for token). Depois disso o `dispatcher.ts`
   * ENCADEIA o 【Deploy】 da carta (Add 1 Shield / token / dano). Sem esta
   * primitiva o Burst usava `moveZone self → baseSection`, que não trocava a
   * Base nem disparava o 【Deploy】 (docs/47 Classe B). */
  | { op: "deployThisCard" };

/**
 * Filtro sobre um `CardDef` — usado pelas primitivas que escolhem carta por
 * característica (não por instância já em campo). `anyTrait` casa se o def tem
 * QUALQUER um dos traits (traits do dataset vêm como "Zeon", "Neo Zeon"; o
 * texto oficial usa "(Zeon)/(Neo Zeon)" — normalize os parênteses ao montar o
 * spec). `maxLevel`/`minLevel` inclusivos.
 */
export interface CardDefFilter {
  cardType?: CardDef["cardType"];
  anyTrait?: string[];
  maxLevel?: number;
  minLevel?: number;
}

export function matchesCardDefFilter(def: CardDef, filter: CardDefFilter): boolean {
  if (filter.cardType && def.cardType !== filter.cardType) return false;
  if (filter.anyTrait && filter.anyTrait.length > 0) {
    const traits = def.traits ?? [];
    if (!filter.anyTrait.some((t) => traits.includes(t))) return false;
  }
  if (filter.maxLevel !== undefined && (def.level ?? 0) > filter.maxLevel) return false;
  if (filter.minLevel !== undefined && (def.level ?? 0) < filter.minLevel) return false;
  return true;
}

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
    case "discardNamed": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const chosen = (ctx.targets[call.name] ?? []).slice(0, call.n);
      if (chosen.length === 0) return [];
      return [{ type: "DISCARD_TO_HAND_LIMIT", player, instanceIds: chosen }];
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
      // Reordenar o topo do deck é uma decisão de quem controla (ver
      // `peekAndReorderDeck`): se ninguém decidiu (`ctx.targets` sem a entrada
      // nomeada — ex. Burst→Base Deploy, que não passa pela camada de decisão),
      // é no-op, o deck fica como está — resultado legal, não erro.
      if (call.target.kind === "named" && !ctx.targets[call.target.name]?.length) return [];
      return resolveTargetIds(call.target, ctx).map((instanceId): GameEvent => ({ type: "MOVE_WITHIN_DECK", instanceId, position: call.position }));
    }
    case "spawnTokenChoice": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const chosen = ctx.targets[call.key]?.[0];
      const match = call.options.find((o) => o.value === chosen) ?? call.options[0];
      return [{ type: "SPAWN_TOKEN", player, def: match.def, zone: call.zone }];
    }
    case "preventShieldDamage": {
      return [{ type: "SET_SHIELD_PROTECTION", maxAttackerLevel: call.maxAttackerLevel }];
    }
    case "preventUnitBattleDamage": {
      return resolveTargetIds(call.target, ctx).map(
        (instanceId): GameEvent => ({ type: "SET_UNIT_DAMAGE_PROTECTION", instanceId, maxAttackerAp: call.maxAttackerAp }),
      );
    }
    case "grantAttackTargetRelax": {
      return resolveTargetIds(call.target, ctx).map(
        (instanceId): GameEvent => ({ type: "GRANT_ATTACK_TARGET_RELAX", instanceId, maxLevel: call.maxLevel, turn: ctx.turnNumber }),
      );
    }
    case "preventAttackThisTurn": {
      return resolveTargetIds(call.target, ctx).map(
        (instanceId): GameEvent => ({ type: "SET_CANNOT_ATTACK", instanceId, turn: ctx.turnNumber }),
      );
    }
    case "addShieldToHand": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const shields = ctx.state.players[player].shields;
      const chosen = ctx.targets.shield?.length
        ? ctx.targets.shield.slice(0, call.count)
        : shields.slice(0, call.count).map((s) => s.instanceId);
      return chosen.map((instanceId): GameEvent => ({ type: "MOVE_CARD", instanceId, toZone: "hand" }));
    }
    case "lookAtTopFilterReveal": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const top = ctx.state.players[player].deck.slice(0, call.count);
      const revealed = ctx.targets[call.revealName ?? "reveal"]?.[0];
      const events: GameEvent[] = [];
      if (revealed) {
        const card = top.find((c) => c.instanceId === revealed);
        if (!card) throw new Error(`lookAtTopFilterReveal: carta revelada "${revealed}" não está no topo ${call.count} do deck`);
        if (!matchesCardDefFilter(card.def, call.filter)) {
          throw new Error(`lookAtTopFilterReveal: carta revelada "${card.def.code}" não casa o filtro exigido pelo efeito`);
        }
        events.push({ type: "MOVE_CARD", instanceId: revealed, toZone: "hand" });
      }
      for (const card of top) {
        if (card.instanceId === revealed) continue;
        events.push({ type: "MOVE_WITHIN_DECK", instanceId: card.instanceId, position: "bottom" });
      }
      return events;
    }
    case "deployThisCard": {
      const source = findCard(ctx.state, ctx.sourceInstanceId);
      if (source.def.cardType === "BASE") {
        const events: GameEvent[] = [];
        const existing = ctx.state.players[source.owner].baseSection[0];
        if (existing && existing.instanceId !== ctx.sourceInstanceId) {
          events.push(
            existing.def.isToken
              ? { type: "REMOVE_CARD_FROM_GAME", instanceId: existing.instanceId }
              : { type: "MOVE_CARD", instanceId: existing.instanceId, toZone: "trash" },
          );
        }
        events.push({ type: "MOVE_CARD", instanceId: ctx.sourceInstanceId, toZone: "baseSection" });
        return events;
      }
      if (source.def.cardType === "UNIT") {
        return [{ type: "MOVE_CARD", instanceId: ctx.sourceInstanceId, toZone: "battleArea" }];
      }
      throw new Error(`deployThisCard: ${source.def.code} não é BASE nem UNIT`);
    }
    case "deployFromHandTriggered": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const chosen = ctx.targets[call.deployName ?? "deploy"]?.[0];
      if (!chosen) return [];
      const card = ctx.state.players[player].hand.find((c) => c.instanceId === chosen);
      if (!card) throw new Error(`deployFromHandTriggered: carta "${chosen}" não está na mão de ${player}`);
      if (card.def.cardType !== "UNIT") throw new Error(`deployFromHandTriggered: "${card.def.code}" não é Unit`);
      if (!matchesCardDefFilter(card.def, call.filter)) {
        throw new Error(`deployFromHandTriggered: "${card.def.code}" não casa o filtro do efeito`);
      }
      return [{ type: "MOVE_CARD", instanceId: chosen, toZone: "battleArea" }];
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
   * `true` quando o texto oficial prefixa o gatilho com 【During Pair】 (ex.
   * ST04-009 Miguel's Ginn 【During Pair】【Destroyed】) — quem despacha só ativa
   * o efeito se a Unit fonte estava PAREADA no momento do gatilho. Hoje só
   * consultado por `dispatchDestroyedTriggers` (via `DestroyedInBattle.wasPaired`).
   */
  duringPair?: boolean;
  /**
   * O que `ctx.targets.target` deve ser — a UI usa pra montar a lista de alvos
   * possíveis quando o efeito pausa pra escolha. Default `"enemyUnit"`.
   */
  targetScope?: "enemyUnit" | "ownResource" | "friendlyUnit";
  /**
   * Restrição do texto oficial ALÉM da categoria ampla de `targetScope` — ex.
   * "with 2 or less HP" (Guntank), "Lv.5 or lower" (Aerial), "rested"
   * (Thoroughly Damaged, Suletta Mercury — "Set 1 Resource as active" só faz
   * sentido num Recurso descansado). Resolvido por CANDIDATO (uma instância
   * por vez), não pelo `EffectContext` inteiro — ver `TargetFilterResolver`
   * e `computeLegalTargets`. Ausente = qualquer card do `targetScope` é
   * legal (comportamento de antes do V0, docs/24).
   */
  targetFilter?: string;
}

/**
 * Resolve um `targetFilter` (string) contra UM candidato — mesmo padrão de
 * extensão do `PredicateResolver` (id-string + resolver registrado), só que
 * por instância em vez de pelo `EffectContext` inteiro. Implementação real
 * em `content/predicates.ts` (`defaultTargetFilterResolver`) — mesmo motivo
 * do `defaultPredicateResolver`: única fonte, reusada por testes e servidor.
 */
export type TargetFilterResolver = (filter: string, candidate: CardInstance, ctx: { state: GameState }) => boolean;

/**
 * Enumera os alvos LEGAIS de `spec.targetScope` (+ `spec.targetFilter`, se
 * houver) no estado ATUAL — única fonte de verdade, chamada tanto pra montar
 * a lista que a UI mostra quanto pra VALIDAR o que o cliente manda de volta
 * (nunca confiar só na UI escondendo a opção ilegal — ver `docs/25`). Pool
 * sempre pequeno (Battle Area ≤6 Units, Resource Area ≤~15 cartas) — o custo
 * é desprezível; o cuidado real é só chamar isto nos pontos de DECISÃO
 * (`deferOrDispatchAbilities`, `resolveAbility`, `playCommand`/
 * `activateAbility`), nunca dentro de um loop de render.
 *
 * Lança se o spec declara `targetFilter` mas nenhum `resolveFilter` foi
 * passado — mesma postura de `resolveEffectSpec` pra `condition` (falhar
 * alto em vez de aplicar o filtro em silêncio).
 */
export function computeLegalTargets(
  state: GameState,
  spec: Pick<EffectSpec, "targetScope" | "targetFilter">,
  controller: PlayerId,
  resolveFilter?: TargetFilterResolver,
): string[] {
  const scope = spec.targetScope ?? "enemyUnit";
  const pool: CardInstance[] =
    scope === "enemyUnit"
      ? state.players[otherPlayer(controller)].battleArea.filter((c) => c.def.cardType === "UNIT")
      : scope === "friendlyUnit"
        ? state.players[controller].battleArea.filter((c) => c.def.cardType === "UNIT")
        : state.players[controller].resourceArea;

  if (!spec.targetFilter) return pool.map((c) => c.instanceId);
  if (!resolveFilter) {
    throw new Error(`EffectSpec com targetFilter "${spec.targetFilter}" mas nenhum TargetFilterResolver foi passado`);
  }
  return pool.filter((c) => resolveFilter(spec.targetFilter!, c, { state })).map((c) => c.instanceId);
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

/**
 * Primitivas que exigem uma ESCOLHA feita fora do "alvo em campo"
 * (`ctx.targets.target`, uma Unit/Recurso visível no tabuleiro):
 *  - `deployFromHandTriggered` (ST03-010) / `discardNamed` (ST04-002) → carta da MÃO
 *  - `lookAtTopFilterReveal` (ST03-006) / `moveWithinDeck` nomeado (ST02-015) → topo do DECK
 *  - `spawnTokenChoice` (ST04-012) → escolha ENUM (Sword / Launcher)
 * A camada de decisão (`abilityDispatch.ts`) monta `handChoice`/`deckTopReveal`/
 * `handDiscard`/`deckReorder`/`enumChoice` na fila da `PendingDecision` e marca
 * o gatilho como interativo mesmo quando `optional` é `false`.
 */
export type ChoicePrimitive =
  | Extract<PrimitiveCall, { op: "deployFromHandTriggered" }>
  | Extract<PrimitiveCall, { op: "lookAtTopFilterReveal" }>
  | Extract<PrimitiveCall, { op: "discardNamed" }>
  | Extract<PrimitiveCall, { op: "spawnTokenChoice" }>
  | Extract<PrimitiveCall, { op: "moveWithinDeck" }>;

export function isChoicePrimitive(call: PrimitiveCall): call is ChoicePrimitive {
  switch (call.op) {
    case "deployFromHandTriggered":
    case "lookAtTopFilterReveal":
    case "discardNamed":
    case "spawnTokenChoice":
      return true;
    case "moveWithinDeck":
      return call.target.kind === "named";
    default:
      return false;
  }
}

function specPrimitives(spec: EffectSpec): PrimitiveCall[] {
  return [...(spec.cost ?? []), ...(spec.condition?.then ?? []), ...(spec.condition?.else ?? []), ...spec.actions];
}

export function specChoicePrimitive(spec: EffectSpec): ChoicePrimitive | undefined {
  return specPrimitives(spec).find(isChoicePrimitive);
}

/** TODAS as primitivas de escolha do spec (ST02-015 tem 2 `moveWithinDeck` = 1 reordenação). */
export function specChoicePrimitives(spec: EffectSpec): ChoicePrimitive[] {
  return specPrimitives(spec).filter(isChoicePrimitive);
}

/** `true` se o spec consome uma escolha de carta / enum (ver `specChoicePrimitive`). */
export function specNeedsChoice(spec: EffectSpec): boolean {
  return specChoicePrimitive(spec) !== undefined;
}

/**
 * IDs de carta elegíveis pra o `discardNamed` de um spec: a mão atual de
 * `player` MAIS as cartas que serão compradas por `draw` ANTES do
 * `discardNamed` (ST04-002 "Draw 1. Then, discard 1." — dá pra descartar a
 * recém-comprada). A ordem do `draw` é determinística (topo do deck) e o
 * estado não muda entre montar a fila e resolver.
 */
export function discardCandidateHandIds(spec: EffectSpec, state: GameState, player: PlayerId): string[] {
  const hand = state.players[player].hand.map((c) => c.instanceId);
  let drawn = 0;
  for (const call of spec.actions) {
    if (call.op === "draw") drawn += call.n;
    if (call.op === "discardNamed") break;
  }
  const deckIds = state.players[player].deck.slice(0, Math.min(drawn, state.players[player].deck.length)).map((c) => c.instanceId);
  return [...hand, ...deckIds];
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
