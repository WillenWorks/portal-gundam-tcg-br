import type { EffectSpec } from "../engine/effectSpec";
import { EX_RESOURCE_TOKEN } from "../engine/setup";
import { TOKEN_LEO, TOKEN_TALLGEESE } from "../fixtures/st02Deck";

/**
 * Passo 3 do plano incremental (docs/18), segundo deck real (ST02 "Ruination
 * Ablaze"). Mesmo padrão de `content/st01.ts`: cada `EffectSpec` é testado
 * chamando `resolveEffectSpec` direto, sem dispatcher automático ainda.
 *
 * Cobertura 100% das 16 cartas únicas: as 5 vanilla/só-keyword-automática
 * (Sandrock, Maganac, Leo, Aries, Tragos) não precisam de EffectSpec, o
 * motor já cobre sozinho; as 11 restantes têm efeito bespoke — cobertas via
 * `EffectSpec` (abaixo) OU via campo estruturado de `CardDef`
 * (`staticAbilities`/`combatTriggers`/`attackTargetRules`, ver
 * `st02Deck.ts`) pra efeito contínuo/combate-condicional/legalidade de
 * alvo, que não são "gatilho pontual → ação" e por isso não cabem no
 * `EffectSpec` (ver docs/18, "8 lacunas", agora todas fechadas).
 *
 * Nota sobre 【During Link】 (Heero Yuy, Zechs Merquise): resolvido via
 * `satisfiesLinkCondition()` (já estruturado em `CardDef.link`, ver
 * types.ts) — o "risco" registrado antes do passo 3 ("Link não
 * estruturado") já tinha sido corrigido durante a implementação da Link
 * condition em si (docs/18, "Link condition"); só faltava o motor saber
 * REAGIR a isso fora do contexto de "pode atacar ao ser deployada"
 * (`staticAbilities`/`combatTriggers` fecham essa parte agora).
 */

// ST02-002 Wing Gundam (Bird Mode) — 【Deploy】Place 1 EX Resource.
export const WING_GUNDAM_BIRD_MODE_DEPLOY: EffectSpec = {
  id: "ST02-002-Deploy",
  cardCode: "ST02-002",
  trigger: "Deploy",
  actions: [{ op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea" }],
  sourceText: "【Deploy】Place 1 EX Resource.",
};

// ST02-006 Tallgeese — 【Activate･Main】【Once per Turn】④：Set this Unit as active.
export const TALLGEESE_ACTIVATE_MAIN: EffectSpec = {
  id: "ST02-006-ActivateMain",
  cardCode: "ST02-006",
  trigger: "Activate·Main",
  // custo "④" (4 recursos) — docs/18, lacuna #4, agora fechada via
  // `payResourceCost`. 【Once per Turn】continua responsabilidade de quem
  // despacha (dispatcher.ts), igual nas outras cartas com essa tag.
  cost: [{ op: "payResourceCost", player: "controller", n: 4 }],
  actions: [{ op: "setActive", target: { kind: "self" } }],
  sourceText: "【Activate･Main】【Once per Turn】④：Set this Unit as active.",
};

// ST02-010 Heero Yuy — 【Burst】Add this card to your hand.
export const HEERO_YUY_BURST: EffectSpec = {
  id: "ST02-010-Burst",
  cardCode: "ST02-010",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};
// 【During Link】This Unit gets AP+1 and HP+1. — ver `staticAbilities` em
// HEERO_YUY (st02Deck.ts): modificador contínuo, não gatilho pontual, por
// isso vive no CardDef em vez de num EffectSpec (docs/18, lacuna #2).

// ST02-011 Zechs Merquise — 【Burst】Add this card to your hand.
export const ZECHS_MERQUISE_BURST: EffectSpec = {
  id: "ST02-011-Burst",
  cardCode: "ST02-011",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};
// 【During Link】During your turn, when this Unit destroys an enemy Unit
// with battle damage, draw 1. — ver `combatTriggers` em ZECHS_MERQUISE
// (st02Deck.ts), resolvido em combat.ts/combatTriggerEvents.

// ST02-012 Simultaneous Fire — 【Main】Choose 1 of your Units. It gains
// <Breach 3> during this turn. Motivou a correção de `keywordValue()` em
// types.ts (não lia `keywordGrants`, só `def.keywordTags` — uma keyword
// numérica concedida em tempo de jogo nunca teria seu valor lido de volta
// pelo combate). Ver teste dedicado em `st02.test.ts` provando o fluxo
// completo (Grant -> combate real -> dano de shield correto).
export const SIMULTANEOUS_FIRE_MAIN: EffectSpec = {
  id: "ST02-012-Main",
  cardCode: "ST02-012",
  trigger: "Main",
  actions: [{ op: "grantKeyword", target: { kind: "named", name: "target" }, keyword: "Breach 3", duration: "endOfTurn" }],
  // bug real achado na auditoria V0 (docs/25): faltava declarar o escopo —
  // sem isso caía no default `enemyUnit`, deixando escolher Unit INIMIGA
  // num efeito que o texto diz ser "of YOUR Units".
  targetScope: "friendlyUnit",
  sourceText: "【Main】Choose 1 of your Units. It gains <Breach 3> during this turn.",
};

// ST02-014 Siege Ploy — mesmo padrão de 3 seções de ST01-014 Unforeseen
// Incident: Burst ativa o Main, e Main/Action compilam pra mesma ação.
const SIEGE_PLOY_ACTIONS = [{ op: "rest" as const, target: { kind: "named" as const, name: "target" } }];

export const SIEGE_PLOY_BURST: EffectSpec = {
  id: "ST02-014-Burst",
  cardCode: "ST02-014",
  trigger: "Burst",
  actions: SIEGE_PLOY_ACTIONS,
  targetFilter: "hp<=5",
  sourceText: "【Burst】Activate this card's 【Main】.",
};

export const SIEGE_PLOY_MAIN: EffectSpec = {
  id: "ST02-014-Main",
  cardCode: "ST02-014",
  trigger: "Main",
  actions: SIEGE_PLOY_ACTIONS,
  targetFilter: "hp<=5",
  sourceText: "【Main】/【Action】Choose 1 enemy Unit with 5 or less HP. Rest it.",
};

export const SIEGE_PLOY_ACTION: EffectSpec = {
  id: "ST02-014-Action",
  cardCode: "ST02-014",
  trigger: "Action",
  actions: SIEGE_PLOY_ACTIONS,
  targetFilter: "hp<=5",
  sourceText: "【Main】/【Action】Choose 1 enemy Unit with 5 or less HP. Rest it.",
};

// ST02-013 Peaceful Timbre — 【Action】During this battle, your shield area
// cards can't receive damage from enemy Units that are Lv.4 or lower.
// Fecha docs/18 lacuna #7 (prevenção de dano condicional) via
// `preventShieldDamage` (`CombatState.shieldProtection`, ver combat.ts).
export const PEACEFUL_TIMBRE_ACTION: EffectSpec = {
  id: "ST02-013-Action",
  cardCode: "ST02-013",
  trigger: "Action",
  actions: [{ op: "preventShieldDamage", maxAttackerLevel: 4 }],
  sourceText: "【Action】During this battle, your shield area cards can't receive damage from enemy Units that are Lv.4 or lower.",
};

// ST02-015 Saint Gabriel Institute — 【Burst】Deploy this card. (mesmo
// padrão de ST01-015/016: shield revelada por Burst se deploya na Base
// Section)
export const SAINT_GABRIEL_INSTITUTE_BURST: EffectSpec = {
  id: "ST02-015-Burst",
  cardCode: "ST02-015",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};

// ST02-015 Saint Gabriel Institute — 【Deploy】Add 1 Shield to hand, then
// look at the top 2 cards of your deck and return 1 to the top and 1 to the
// bottom. Fecha docs/18 lacuna #8 (informação oculta) via
// `peekAndReorderDeck()` (chamada por quem despacha o efeito, ANTES de
// montar `ctx.targets.toTop`/`ctx.targets.toBottom` com a escolha de quem
// controla — o `EffectSpec` em si só compila a reordenação já decidida,
// igual ao padrão "named" já usado por "target"/"shield").
export const SAINT_GABRIEL_INSTITUTE_DEPLOY: EffectSpec = {
  id: "ST02-015-Deploy",
  cardCode: "ST02-015",
  trigger: "Deploy",
  actions: [
    { op: "addShieldToHand", player: "controller", count: 1 },
    { op: "moveWithinDeck", target: { kind: "named", name: "toTop" }, position: "top" },
    { op: "moveWithinDeck", target: { kind: "named", name: "toBottom" }, position: "bottom" },
  ],
  sourceText: "【Deploy】Add 1 of your Shields to your hand. Then, look at the top 2 cards of your deck and return 1 to the top and 1 to the bottom.",
};

// ST02-016 Corsica Base — 【Burst】Deploy this card.
export const CORSICA_BASE_BURST: EffectSpec = {
  id: "ST02-016-Burst",
  cardCode: "ST02-016",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};

// ST02-016 Corsica Base — 【Deploy】Add 1 Shield to hand, then deploy 1
// Tallgeese token (or 2 Leo tokens instead, if a card named "Corsica Base"
// is in the trash). "If it is your turn" é sempre verdadeiro pro trigger
// Deploy — `deployCard()` (deploy.ts) só roda quando `state.activePlayer
// === player`, então a cláusula não precisa de checagem própria aqui.
// Fecha docs/18 lacuna #3 (criar instância nova) via `spawnToken` + o
// predicado `cardInTrashNamed` (predicates.ts).
export const CORSICA_BASE_DEPLOY: EffectSpec = {
  id: "ST02-016-Deploy",
  cardCode: "ST02-016",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  condition: {
    predicate: "cardInTrashNamed:Corsica Base",
    then: [{ op: "spawnToken", def: TOKEN_LEO, player: "controller", zone: "battleArea", count: 2 }],
    else: [{ op: "spawnToken", def: TOKEN_TALLGEESE, player: "controller", zone: "battleArea" }],
  },
  sourceText:
    '【Deploy】Add 1 of your Shields to your hand. Then, if it is your turn, deploy 1 [Tallgeese]((OZ)･AP4･HP2) Unit token. If it is your turn and a card with "Corsica Base" in its card name is in your trash, deploy 2 [Leo]((OZ)･AP1･HP1) Unit tokens instead.',
};

export const ST02_EFFECT_SPECS: EffectSpec[] = [
  WING_GUNDAM_BIRD_MODE_DEPLOY,
  TALLGEESE_ACTIVATE_MAIN,
  HEERO_YUY_BURST,
  ZECHS_MERQUISE_BURST,
  SIMULTANEOUS_FIRE_MAIN,
  PEACEFUL_TIMBRE_ACTION,
  SIEGE_PLOY_BURST,
  SIEGE_PLOY_MAIN,
  SIEGE_PLOY_ACTION,
  SAINT_GABRIEL_INSTITUTE_BURST,
  SAINT_GABRIEL_INSTITUTE_DEPLOY,
  CORSICA_BASE_BURST,
  CORSICA_BASE_DEPLOY,
];
