import type { EffectSpec, PrimitiveCall } from "../engine/effectSpec";

/**
 * Passo 3 do plano incremental (docs/18): primeira leva real de EffectSpec,
 * autorada carta a carta contra o `effect` oficial em inglês de
 * `data/gcg-official-cards.json` (nunca a tradução — ver docs/18, "Cobertura
 * de idioma"). Cobre 10 das 16 cartas únicas do ST01 (as que têm efeito
 * bespoke E cabem no vocabulário de primitivas de hoje); as 3 vanilla
 * (Guncannon/GM/Aerial Bit Form) e as 2 só-keyword-automática (Demi
 * Trainer/Zowort, `<Blocker>`) não precisam de EffectSpec — o motor já
 * cobre sozinho. O que ficou de fora, e por quê, está documentado em
 * `st01Deck.ts` (comentários nos `CardDef` de ST01-001, 009, 012, 013, 015,
 * 016) e resumido em docs/18.
 *
 * Nenhum disparo automático existe ainda (nenhum "quando este Unit é
 * deployado, rode os EffectSpec de trigger Deploy dele" — isso é trabalho
 * de dispatcher, ortogonal a autoria de conteúdo). Cada `EffectSpec` aqui é
 * testado chamando `resolveEffectSpec` diretamente com um `EffectContext`
 * montado à mão, do mesmo jeito que `effectSpec.test.ts` já testava o
 * exemplo sintético — só que agora contra texto de carta real.
 */

// ST01-002 Gundam (MA Form) — 【When Paired･(White Base Team) Pilot】Draw 1.
export const GUNDAM_MA_FORM_WHEN_PAIRED: EffectSpec = {
  id: "ST01-002-WhenPaired",
  cardCode: "ST01-002",
  trigger: "When Paired",
  condition: {
    // resolvido externamente — checa se o Piloto pareado com esta Unit tem o trait "White Base Team"
    predicate: "pairedPilotHasTrait:White Base Team",
    then: [{ op: "draw", player: "controller", n: 1 }],
  },
  actions: [],
  sourceText: "【When Paired･(White Base Team) Pilot】Draw 1.",
};

// ST01-004 Guntank — 【Deploy】Choose 1 enemy Unit with 2 or less HP. Rest it.
export const GUNTANK_DEPLOY: EffectSpec = {
  id: "ST01-004-Deploy",
  cardCode: "ST01-004",
  trigger: "Deploy",
  // legalidade do alvo ("2 ou menos HP") é responsabilidade de quem resolve
  // ctx.targets.target antes de chamar resolveEffectSpec — o EffectSpec só
  // compila a ação em cima do alvo já escolhido, não valida a escolha.
  actions: [{ op: "rest", target: { kind: "named", name: "target" } }],
  sourceText: "【Deploy】Choose 1 enemy Unit with 2 or less HP. Rest it.",
};

// ST01-006 Gundam Aerial (Permet Score Six) — 【When Paired】Choose 1 enemy
// Unit that is Lv.5 or lower. It gets AP-3 during this turn.
export const AERIAL_SCORE_SIX_WHEN_PAIRED: EffectSpec = {
  id: "ST01-006-WhenPaired",
  cardCode: "ST01-006",
  trigger: "When Paired",
  actions: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: -3, duration: "endOfTurn" }],
  sourceText: "【When Paired】Choose 1 enemy Unit that is Lv.5 or lower. It gets AP-3 during this turn.",
};

// ST01-010 Amuro Ray — 【Burst】Add this card to your hand.
export const AMURO_RAY_BURST: EffectSpec = {
  id: "ST01-010-Burst",
  cardCode: "ST01-010",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST01-010 Amuro Ray — 【When Paired】Choose 1 enemy Unit with 5 or less HP. Rest it.
export const AMURO_RAY_WHEN_PAIRED: EffectSpec = {
  id: "ST01-010-WhenPaired",
  cardCode: "ST01-010",
  trigger: "When Paired",
  actions: [{ op: "rest", target: { kind: "named", name: "target" } }],
  sourceText: "【When Paired】Choose 1 enemy Unit with 5 or less HP. Rest it.",
};

// ST01-011 Suletta Mercury — 【Burst】Add this card to your hand.
export const SULETTA_MERCURY_BURST: EffectSpec = {
  id: "ST01-011-Burst",
  cardCode: "ST01-011",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST01-011 Suletta Mercury — 【Attack】【Once per Turn】Choose 1 of your
// Resources. Set it as active.
export const SULETTA_MERCURY_ATTACK: EffectSpec = {
  id: "ST01-011-Attack",
  cardCode: "ST01-011",
  trigger: "Attack",
  // 【Once per Turn】é responsabilidade de quem despacha o efeito (checar/
  // marcar usedKeywordsThisTurn na instância, igual `keywords.ts` já faz
  // pra `<Support N>`) — o EffectSpec em si não teria como se auto-impedir.
  actions: [{ op: "setActive", target: { kind: "named", name: "target" } }],
  sourceText: "【Attack】【Once per Turn】Choose 1 of your Resources. Set it as active.",
};

// ST01-012 Thoroughly Damaged — 【Main】Choose 1 rested enemy Unit. Deal 1 damage to it.
export const THOROUGHLY_DAMAGED_MAIN: EffectSpec = {
  id: "ST01-012-Main",
  cardCode: "ST01-012",
  trigger: "Main",
  // legalidade do alvo ("rested") e o requisito 【Pilot】[Hayato Kobayashi]
  // pra poder jogar a carta são responsabilidade de fora do EffectSpec.
  actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 }],
  sourceText: "【Main】Choose 1 rested enemy Unit. Deal 1 damage to it.",
};

// ST01-013 Kai's Resolve — 【Main】Choose 1 friendly Unit. It recovers 3 HP.
export const KAIS_RESOLVE_MAIN: EffectSpec = {
  id: "ST01-013-Main",
  cardCode: "ST01-013",
  trigger: "Main",
  actions: [{ op: "heal", target: { kind: "named", name: "target" }, amount: 3 }],
  sourceText: "【Main】Choose 1 friendly Unit. It recovers 3 HP.",
};

// ST01-014 Unforeseen Incident — as 3 seções (Burst/Main/Action) resolvem
// pra exatamente a mesma ação ("【Burst】Activate this card's 【Main】" +
// "【Main】/【Action】... AP-3 during this turn"), então compartilham o mesmo
// array de PrimitiveCall.
const UNFORESEEN_INCIDENT_ACTIONS: PrimitiveCall[] = [
  { op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: -3, duration: "endOfTurn" },
];

export const UNFORESEEN_INCIDENT_BURST: EffectSpec = {
  id: "ST01-014-Burst",
  cardCode: "ST01-014",
  trigger: "Burst",
  actions: UNFORESEEN_INCIDENT_ACTIONS,
  sourceText: "【Burst】Activate this card's 【Main】.",
};

export const UNFORESEEN_INCIDENT_MAIN: EffectSpec = {
  id: "ST01-014-Main",
  cardCode: "ST01-014",
  trigger: "Main",
  actions: UNFORESEEN_INCIDENT_ACTIONS,
  sourceText: "【Main】/【Action】Choose 1 enemy Unit. It gets AP-3 during this turn.",
};

export const UNFORESEEN_INCIDENT_ACTION: EffectSpec = {
  id: "ST01-014-Action",
  cardCode: "ST01-014",
  trigger: "Action",
  actions: UNFORESEEN_INCIDENT_ACTIONS,
  sourceText: "【Main】/【Action】Choose 1 enemy Unit. It gets AP-3 during this turn.",
};

// ST01-015 White Base — 【Burst】Deploy this card.
export const WHITE_BASE_BURST: EffectSpec = {
  id: "ST01-015-Burst",
  cardCode: "ST01-015",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "baseSection" }],
  sourceText: "【Burst】Deploy this card.",
};

// ST01-015 White Base — 【Deploy】Add 1 of your Shields to your hand.
export const WHITE_BASE_DEPLOY: EffectSpec = {
  id: "ST01-015-Deploy",
  cardCode: "ST01-015",
  trigger: "Deploy",
  actions: [{ op: "moveZone", target: { kind: "named", name: "shield" }, toZone: "hand" }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};
// 【Activate･Main】【Once per Turn】②：deploy de token condicional — fora do
// escopo desta wave, ver comentário em st01Deck.ts (WHITE_BASE).

// ST01-016 Asticassia — 【Burst】Deploy this card.
export const ASTICASSIA_BURST: EffectSpec = {
  id: "ST01-016-Burst",
  cardCode: "ST01-016",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "baseSection" }],
  sourceText: "【Burst】Deploy this card.",
};

// ST01-016 Asticassia — 【Deploy】Add 1 of your Shields to your hand.
export const ASTICASSIA_DEPLOY: EffectSpec = {
  id: "ST01-016-Deploy",
  cardCode: "ST01-016",
  trigger: "Deploy",
  actions: [{ op: "moveZone", target: { kind: "named", name: "shield" }, toZone: "hand" }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};
// 【Activate･Main】Rest this Base：All friendly Link Units get AP+1 — fora
// do escopo desta wave, ver comentário em st01Deck.ts (ASTICASSIA).

export const ST01_EFFECT_SPECS: EffectSpec[] = [
  GUNDAM_MA_FORM_WHEN_PAIRED,
  GUNTANK_DEPLOY,
  AERIAL_SCORE_SIX_WHEN_PAIRED,
  AMURO_RAY_BURST,
  AMURO_RAY_WHEN_PAIRED,
  SULETTA_MERCURY_BURST,
  SULETTA_MERCURY_ATTACK,
  THOROUGHLY_DAMAGED_MAIN,
  KAIS_RESOLVE_MAIN,
  UNFORESEEN_INCIDENT_BURST,
  UNFORESEEN_INCIDENT_MAIN,
  UNFORESEEN_INCIDENT_ACTION,
  WHITE_BASE_BURST,
  WHITE_BASE_DEPLOY,
  ASTICASSIA_BURST,
  ASTICASSIA_DEPLOY,
];
