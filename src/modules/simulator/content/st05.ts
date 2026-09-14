import type { EffectSpec, PrimitiveCall } from "../engine/effectSpec";

/**
 * Wave ST05 "Iron-Blooded Struggle" — EffectSpec real, autorada carta a carta
 * contra o `effect` oficial em inglês de `data/gcg-official-cards.json` (nunca
 * a tradução — docs/18). Mesmo padrão de `content/st01.ts`..`content/st04.ts`.
 *
 * Cobertura das 15 cartas únicas:
 * - Vanilla / só-keyword-automática: ST05-004 Graze Custom, ST05-006 Hyakuren,
 *   ST05-008 Graze Commander Type <Blocker>, ST05-009 Graze (ver st05Deck.ts).
 * - Static-only (sem EffectSpec, só `CardDef.staticAbilities`): ST05-002
 *   Gundam Barbatos 2nd Form (ver st05Deck.ts).
 * - Bespoke via EffectSpec: abaixo.
 *
 * GAP DE MOTOR FECHADO NESTA WAVE: `StaticTargetCondition.isDamaged`
 * (`engine/types.ts`) — condição "While this Unit is damaged" sobre a própria
 * carta (scope "self"), usada por ST05-001 (concede <Suppression>) e ST05-002
 * (AP+2). Antes só existiam `apAtLeast`/`colorIs`/`traitIs`/`hasKeyword`.
 *
 * DEFERIDO: ST05-011 Akihiro Altland 【During Link】"choose 1 (Tekkadan) Unit
 * card that is Lv.2 or lower from your trash. Add it to your hand." — não há
 * `CombatTrigger.action` pra buscar carta no trash (só `draw`/
 * `damageAllEnemyUnits`/`damageChosenEnemyUnit`). Ver `content/deferred.ts`.
 *
 * DEFERIDO: ST05-010 Mikazuki Augus 【When Paired】"Choose 1 of your Units and
 * 1 enemy Unit. Deal 1 damage to them." — `EffectSpec.secondaryTarget` só é
 * resolvido no caminho especial de Command 【Main】 jogada da mão
 * (`legalActions.ts` `mainPhaseCandidates`, precedente GD01-103/112); o
 * dispatcher genérico de gatilho automático (`abilityDispatch.ts` →
 * `pendingDecision.abilityResolution`) NÃO carrega um 2º alvo nomeado na fila
 * — achado no fuzzing desta wave (partida travava com a fila pedindo só o
 * alvo primário). Fechar isso exige estender `PendingDecision`,
 * `abilityDispatch.ts`, `legalActions.ts` E `actions.ts` (resolveAbility) pra
 * um 2º `TargetRef` nomeado por entrada de fila — fora do escopo desta wave.
 * Ver `content/deferred.ts`.
 */

// ST05-001 Gundam Barbatos 4th Form — 【Deploy】Choose 1 of your other Units.
// Deal 1 damage to it. It gets AP+1 during this turn.
export const BARBATOS_4TH_FORM_DEPLOY: EffectSpec = {
  id: "ST05-001-Deploy",
  cardCode: "ST05-001",
  trigger: "Deploy",
  actions: [
    { op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 },
    { op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: 1, duration: "endOfTurn" },
  ],
  targetScope: "friendlyUnit",
  targetFilter: "notSelf",
  sourceText: "【Deploy】Choose 1 of your other Units. Deal 1 damage to it. It gets AP+1 during this turn.",
};

// ST05-003 CGS Mobile Worker — 【Activate･Main】Rest this Unit：Choose 1 of your
// Units. Deal 1 damage to it. It gets AP+1 during this turn.
export const CGS_MOBILE_WORKER_ACTIVATE_MAIN: EffectSpec = {
  id: "ST05-003-ActivateMain",
  cardCode: "ST05-003",
  trigger: "Activate·Main",
  cost: [{ op: "rest", target: { kind: "self" } }],
  actions: [
    { op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 },
    { op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: 1, duration: "endOfTurn" },
  ],
  targetScope: "friendlyUnit",
  sourceText: "【Activate･Main】Rest this Unit：Choose 1 of your Units. Deal 1 damage to it. It gets AP+1 during this turn.",
};

// ST05-005 Gundam Gusion Rebake — 【Destroyed】Choose 1 enemy Unit with 4 or
// less AP. Rest it.
export const GUSION_REBAKE_DESTROYED: EffectSpec = {
  id: "ST05-005-Destroyed",
  cardCode: "ST05-005",
  trigger: "Destroyed",
  actions: [{ op: "rest", target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "ap<=4",
  sourceText: "【Destroyed】Choose 1 enemy Unit with 4 or less AP. Rest it.",
};

// ST05-007 McGillis' Schwalbe Graze — 【When Paired】Choose 1 enemy Unit that
// is Lv.3 or lower. It gets AP-2 during this turn. (<Blocker> é keyword fixa,
// ver st05Deck.ts.)
export const SCHWALBE_GRAZE_WHEN_PAIRED: EffectSpec = {
  id: "ST05-007-WhenPaired",
  cardCode: "ST05-007",
  trigger: "When Paired",
  actions: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: -2, duration: "endOfTurn" }],
  targetScope: "enemyUnit",
  targetFilter: "level<=3",
  sourceText: "【When Paired】Choose 1 enemy Unit that is Lv.3 or lower. It gets AP-2 during this turn.",
};

// ST05-010 Mikazuki Augus — 【Burst】Add this card to your hand.
export const MIKAZUKI_AUGUS_BURST: EffectSpec = {
  id: "ST05-010-Burst",
  cardCode: "ST05-010",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST05-011 Akihiro Altland — 【Burst】Add this card to your hand. (a cláusula
// 【During Link】 está deferida — ver `content/deferred.ts`.)
export const AKIHIRO_ALTLAND_BURST: EffectSpec = {
  id: "ST05-011-Burst",
  cardCode: "ST05-011",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST05-012 McGillis Fareed — 【Burst】Add this card to your hand.
export const MCGILLIS_FAREED_BURST: EffectSpec = {
  id: "ST05-012-Burst",
  cardCode: "ST05-012",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST05-012 McGillis Fareed — 【When Paired】If you have 2 or more other
// (Gjallarhorn)/(Tekkadan) Units in play, choose 1 enemy Unit with 3 or less
// HP. Rest it. Condição avaliada ANTES de abrir escolha de alvo (docs/48) —
// `condition.then` carrega a ação com alvo nomeado, `actions` fica vazio.
export const MCGILLIS_FAREED_WHEN_PAIRED: EffectSpec = {
  id: "ST05-012-WhenPaired",
  cardCode: "ST05-012",
  trigger: "When Paired",
  condition: {
    predicate: "controllerOtherUnitCountWithAnyTraitAtLeast:Gjallarhorn,Tekkadan:2",
    then: [{ op: "rest", target: { kind: "named", name: "target" } }],
  },
  actions: [],
  targetScope: "enemyUnit",
  targetFilter: "hp<=3",
  sourceText:
    "【When Paired】If you have 2 or more other (Gjallarhorn)/(Tekkadan) Units in play, choose 1 enemy Unit with 3 or less HP. Rest it.",
};

// ST05-013 With Iron and Blood — 【Main】/【Action】Choose 1 of your Units. Deal
// 1 damage to it. It gets AP+3 during this turn. Mesmo padrão de ST04-013/014
// (Main／Action = mesmo efeito, 2 EffectSpec via spread).
const WITH_IRON_AND_BLOOD_ACTIONS: PrimitiveCall[] = [
  { op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 },
  { op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: 3, duration: "endOfTurn" },
];
export const WITH_IRON_AND_BLOOD_MAIN: EffectSpec = {
  id: "ST05-013-Main",
  cardCode: "ST05-013",
  trigger: "Main",
  actions: WITH_IRON_AND_BLOOD_ACTIONS,
  targetScope: "friendlyUnit",
  sourceText: "【Main】/【Action】Choose 1 of your Units. Deal 1 damage to it. It gets AP+3 during this turn.",
};
export const WITH_IRON_AND_BLOOD_ACTION: EffectSpec = { ...WITH_IRON_AND_BLOOD_MAIN, id: "ST05-013-Action", trigger: "Action" };

// ST05-014 Fatal Strike — 【Burst】Choose 1 enemy Unit. Deal 1 damage to it.
export const FATAL_STRIKE_BURST: EffectSpec = {
  id: "ST05-014-Burst",
  cardCode: "ST05-014",
  trigger: "Burst",
  actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 }],
  targetScope: "enemyUnit",
  sourceText: "【Burst】Choose 1 enemy Unit. Deal 1 damage to it.",
};

// ST05-014 Fatal Strike — 【Main】Choose 1 enemy Unit that is Lv.3 or lower.
// Destroy it.
export const FATAL_STRIKE_MAIN: EffectSpec = {
  id: "ST05-014-Main",
  cardCode: "ST05-014",
  trigger: "Main",
  actions: [{ op: "destroy", target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "level<=3",
  sourceText: "【Main】Choose 1 enemy Unit that is Lv.3 or lower. Destroy it.",
};

// ST05-015 Isaribi — 【Burst】Deploy this card. / 【Deploy】Add 1 of your Shields
// to your hand. / 【Activate･Main】Rest this Base：Choose 1 of your damaged
// Units. It gets AP+2 during this turn.
export const ISARIBI_BURST: EffectSpec = {
  id: "ST05-015-Burst",
  cardCode: "ST05-015",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};
export const ISARIBI_DEPLOY: EffectSpec = {
  id: "ST05-015-Deploy",
  cardCode: "ST05-015",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};
export const ISARIBI_ACTIVATE_MAIN: EffectSpec = {
  id: "ST05-015-ActivateMain",
  cardCode: "ST05-015",
  trigger: "Activate·Main",
  cost: [{ op: "rest", target: { kind: "self" } }],
  actions: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: 2, duration: "endOfTurn" }],
  targetScope: "friendlyUnit",
  targetFilter: "damaged",
  sourceText: "【Activate･Main】Rest this Base：Choose 1 of your damaged Units. It gets AP+2 during this turn.",
};

export const ST05_EFFECT_SPECS: EffectSpec[] = [
  BARBATOS_4TH_FORM_DEPLOY,
  CGS_MOBILE_WORKER_ACTIVATE_MAIN,
  GUSION_REBAKE_DESTROYED,
  SCHWALBE_GRAZE_WHEN_PAIRED,
  MIKAZUKI_AUGUS_BURST,
  AKIHIRO_ALTLAND_BURST,
  MCGILLIS_FAREED_BURST,
  MCGILLIS_FAREED_WHEN_PAIRED,
  WITH_IRON_AND_BLOOD_MAIN,
  WITH_IRON_AND_BLOOD_ACTION,
  FATAL_STRIKE_BURST,
  FATAL_STRIKE_MAIN,
  ISARIBI_BURST,
  ISARIBI_DEPLOY,
  ISARIBI_ACTIVATE_MAIN,
];
