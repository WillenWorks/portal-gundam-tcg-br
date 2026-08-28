import type { EffectSpec } from "../engine/effectSpec";

/**
 * Passo 3 do plano incremental (docs/18), segundo deck real (ST02 "Ruination
 * Ablaze"). Mesmo padrão de `content/st01.ts`: cada `EffectSpec` é testado
 * chamando `resolveEffectSpec` direto, sem dispatcher automático ainda.
 *
 * Cobre 7 das 16 cartas únicas: Tallgeese, Heero Yuy (só Burst — ver nota
 * abaixo), Zechs Merquise (só Burst), Simultaneous Fire, Siege Ploy, Saint
 * Gabriel Institute (parcial) e Corsica Base (parcial). O resto está
 * documentado em `st02Deck.ts` (comentários por carta) e resumido em
 * docs/18.
 *
 * Nota sobre 【During Link】 (Heero Yuy / Zechs Merquise / Gundam
 * Heavyarms/Wing Gundam via trait): **não autorado nesta wave**. Ao
 * contrário de 【When Paired】+ trait (ST01-002, onde o trait do Piloto
 * pareado é dado real em `CardDef.traits`), "Link" depende da condição de
 * link declarada na Unit (`link`/`linkRefs` do dataset oficial, ex. Wing
 * Gundam → [Heero Yuy]) — e essa condição não é um campo estruturado em
 * `CardDef` (é o risco "Link condition não estruturada" já registrado em
 * docs/18 antes mesmo do passo 3 começar). Autorar um `EffectSpec` com
 * `condition: {predicate: "isLinked", ...}` sem ter como testar contra dado
 * real seria só teatro — melhor deixar de fora e não fingir cobertura.
 */

// ST02-006 Tallgeese — 【Activate･Main】【Once per Turn】④：Set this Unit as active.
export const TALLGEESE_ACTIVATE_MAIN: EffectSpec = {
  id: "ST02-006-ActivateMain",
  cardCode: "ST02-006",
  trigger: "Activate·Main",
  // custo "④" (4 recursos) não é cobrado — falta primitiva de "pagar custo
  // de recurso genérico" (docs/18, lacuna #4). 【Once per Turn】é
  // responsabilidade de quem despacha, igual nas outras cartas com essa tag.
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
// 【During Link】This Unit gets AP+1 and HP+1. — fora de escopo, ver nota no
// topo do arquivo (Link não estruturado) + é efeito contínuo (lacuna #2).

// ST02-011 Zechs Merquise — 【Burst】Add this card to your hand.
export const ZECHS_MERQUISE_BURST: EffectSpec = {
  id: "ST02-011-Burst",
  cardCode: "ST02-011",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};
// 【During Link】During your turn, when this Unit destroys an enemy Unit
// with battle damage, draw 1. — fora de escopo, ver nota no topo do arquivo.

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
  sourceText: "【Burst】Activate this card's 【Main】.",
};

export const SIEGE_PLOY_MAIN: EffectSpec = {
  id: "ST02-014-Main",
  cardCode: "ST02-014",
  trigger: "Main",
  actions: SIEGE_PLOY_ACTIONS,
  sourceText: "【Main】/【Action】Choose 1 enemy Unit with 5 or less HP. Rest it.",
};

export const SIEGE_PLOY_ACTION: EffectSpec = {
  id: "ST02-014-Action",
  cardCode: "ST02-014",
  trigger: "Action",
  actions: SIEGE_PLOY_ACTIONS,
  sourceText: "【Main】/【Action】Choose 1 enemy Unit with 5 or less HP. Rest it.",
};

// ST02-015 Saint Gabriel Institute — 【Burst】Deploy this card. (mesmo
// padrão de ST01-015/016: shield revelada por Burst se deploya na Base
// Section)
export const SAINT_GABRIEL_INSTITUTE_BURST: EffectSpec = {
  id: "ST02-015-Burst",
  cardCode: "ST02-015",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "baseSection" }],
  sourceText: "【Burst】Deploy this card.",
};

// ST02-015 Saint Gabriel Institute — só a 1ª cláusula do Deploy (add 1
// shield à mão); "look at the top 2 cards... return 1 to the top and 1 to
// the bottom" fica de fora — informação oculta, lacuna #8.
export const SAINT_GABRIEL_INSTITUTE_DEPLOY: EffectSpec = {
  id: "ST02-015-Deploy",
  cardCode: "ST02-015",
  trigger: "Deploy",
  actions: [{ op: "moveZone", target: { kind: "named", name: "shield" }, toZone: "hand" }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand. Then, look at the top 2 cards of your deck and return 1 to the top and 1 to the bottom.",
};

// ST02-016 Corsica Base — 【Burst】Deploy this card.
export const CORSICA_BASE_BURST: EffectSpec = {
  id: "ST02-016-Burst",
  cardCode: "ST02-016",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "baseSection" }],
  sourceText: "【Burst】Deploy this card.",
};

// ST02-016 Corsica Base — só a 1ª cláusula do Deploy; o deploy condicional
// de token (Tallgeese ou 2x Leo) fica de fora — lacuna #3 (criar instância
// nova via efeito) + predicado de "carta no trash" que também não existe.
export const CORSICA_BASE_DEPLOY: EffectSpec = {
  id: "ST02-016-Deploy",
  cardCode: "ST02-016",
  trigger: "Deploy",
  actions: [{ op: "moveZone", target: { kind: "named", name: "shield" }, toZone: "hand" }],
  sourceText:
    '【Deploy】Add 1 of your Shields to your hand. Then, if it is your turn, deploy 1 [Tallgeese]((OZ)･AP4･HP2) Unit token. If it is your turn and a card with "Corsica Base" in its card name is in your trash, deploy 2 [Leo]((OZ)･AP1･HP1) Unit tokens instead.',
};

export const ST02_EFFECT_SPECS: EffectSpec[] = [
  TALLGEESE_ACTIVATE_MAIN,
  HEERO_YUY_BURST,
  ZECHS_MERQUISE_BURST,
  SIMULTANEOUS_FIRE_MAIN,
  SIEGE_PLOY_BURST,
  SIEGE_PLOY_MAIN,
  SIEGE_PLOY_ACTION,
  SAINT_GABRIEL_INSTITUTE_BURST,
  SAINT_GABRIEL_INSTITUTE_DEPLOY,
  CORSICA_BASE_BURST,
  CORSICA_BASE_DEPLOY,
];
