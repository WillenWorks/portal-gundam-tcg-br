import type { EffectSpec } from "../engine/effectSpec";

/**
 * Wave ST08 "Hathaway's Flash / Xi Gundam & Penelope" — Efeitos oficiais autorados
 * para o Starter Deck 08.
 */

// ST08-001 Xi Gundam — 【When Paired】Choose 1 enemy Unit with the highest Lv. Deal 3 damage to it.
export const XI_GUNDAM_WHEN_PAIRED: EffectSpec = {
  id: "ST08-001-WhenPaired",
  cardCode: "ST08-001",
  trigger: "When Paired",
  actions: [
    {
      op: "damageUnit",
      amount: 3,
      target: { kind: "named", name: "target" },
    },
  ],
  targetScope: "enemyUnit",
  targetFilter: "highestLevel",
  sourceText: "【When Paired】Choose 1 enemy Unit with the highest Lv. Deal 3 damage to it.",
};

// ST08-002 Xi Gundam — 【Deploy】Choose 1 enemy Unit. Deal 1 damage to it.
export const XI_GUNDAM_DEPLOY: EffectSpec = {
  id: "ST08-002-Deploy",
  cardCode: "ST08-002",
  trigger: "Deploy",
  actions: [
    {
      op: "damageUnit",
      amount: 1,
      target: { kind: "named", name: "target" },
    },
  ],
  targetScope: "enemyUnit",
  sourceText: "【Deploy】Choose 1 enemy Unit. Deal 1 damage to it.",
};

// ST08-004 Messer Type-F01 — 【Attack】If this Unit is attacking an enemy Unit,
// choose 1 enemy Unit. Deal 1 damage to it.
export const MESSER_F01_ATTACK: EffectSpec = {
  id: "ST08-004-Attack",
  cardCode: "ST08-004",
  trigger: "Attack",
  condition: {
    predicate: "attackingEnemyUnit",
    then: [
      {
        op: "damageUnit",
        amount: 1,
        target: { kind: "named", name: "target" },
      },
    ],
  },
  actions: [],
  targetScope: "enemyUnit",
  sourceText: "【Attack】If this Unit is attacking an enemy Unit, choose 1 enemy Unit. Deal 1 damage to it.",
};

// ST08-006 Penelope — 【During Pair】【Attack】【Once per Turn】If this Unit is attacking
// the enemy player, reveal 1 (Earth Federation) Unit card from your hand. Return to the bottom of your deck. If you do, draw 2.
export const PENELOPE_ATTACK: EffectSpec = {
  id: "ST08-006-Attack",
  cardCode: "ST08-006",
  trigger: "Attack",
  duringPair: true,
  condition: {
    predicate: "attackingPlayer",
    then: [{ op: "draw", player: "controller", n: 2 }],
  },
  actions: [],
  sourceText: "【During Pair】【Attack】【Once per Turn】If this Unit is attacking the enemy player, reveal 1 (Earth Federation) Unit card from your hand. Return to the bottom of your deck. If you do, draw 2.",
};

// ST08-009 Jegan Ground Type-A (Man Hunter) — 【Deploy】Choose 1 rested enemy Unit that is Lv.2 or lower.
export const JEGAN_DEPLOY: EffectSpec = {
  id: "ST08-009-Deploy",
  cardCode: "ST08-009",
  trigger: "Deploy",
  actions: [{ op: "rest", target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "rested;level<=2",
  sourceText: "【Deploy】Choose 1 rested enemy Unit that is Lv.2 or lower. It won't be set as active during the start phase of your opponent's next turn.",
};

// ST08-010 Hathaway Noa — 【Burst】Add this card to your hand.
export const HATHAWAY_BURST: EffectSpec = {
  id: "ST08-010-Burst",
  cardCode: "ST08-010",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST08-010 Hathaway Noa — 【When Paired】If this is a (Mafty) Unit, choose 1 of your (Mafty) Units.
// During this turn, it may choose a damaged active enemy Unit as its attack target.
export const HATHAWAY_WHEN_PAIRED: EffectSpec = {
  id: "ST08-010-WhenPaired",
  cardCode: "ST08-010",
  trigger: "When Paired",
  actions: [
    {
      op: "grantAttackTargetRelax",
      target: { kind: "named", name: "target" },
    },
  ],
  targetScope: "friendlyUnit",
  targetFilter: "trait:Mafty",
  sourceText: "【When Paired】If this is a (Mafty) Unit, choose 1 of your (Mafty) Units. During this turn, it may choose a damaged active enemy Unit as its attack target.",
};

// ST08-011 Lane Aim — 【Burst】Add this card to your hand.
export const LANE_AIM_BURST: EffectSpec = {
  id: "ST08-011-Burst",
  cardCode: "ST08-011",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST08-012 Words for Hathaway — 【Main】Choose 1 friendly Link Unit. It gains [Breach 1] during this turn.
export const WORDS_FOR_HATHAWAY_MAIN: EffectSpec = {
  id: "ST08-012-Main",
  cardCode: "ST08-012",
  trigger: "Main",
  actions: [
    {
      op: "grantKeyword",
      keyword: "Breach 1",
      duration: "endOfTurn",
      target: { kind: "named", name: "target" },
    },
  ],
  targetScope: "friendlyUnit",
  targetFilter: "linkUnit",
  sourceText: "【Main】Choose 1 friendly Link Unit. It gains [Breach 1] during this turn.",
};

// ST08-013 Lady Luck — 【Main】/【Action】Choose 1 enemy Unit. Deal 1 damage to it.
// If a friendly (Mafty) Link Unit is in play, deal 2 damage instead.
export const LADY_LUCK_MAIN: EffectSpec = {
  id: "ST08-013-Main",
  cardCode: "ST08-013",
  trigger: "Main",
  condition: {
    predicate: "controllerHasLinkUnitWithTrait:Mafty",
    then: [{ op: "damageUnit", amount: 2, target: { kind: "named", name: "target" } }],
    else: [{ op: "damageUnit", amount: 1, target: { kind: "named", name: "target" } }],
  },
  actions: [],
  targetScope: "enemyUnit",
  sourceText: "【Main】Choose 1 enemy Unit. Deal 1 damage to it. If a friendly (Mafty) Link Unit is in play, deal 2 damage instead.",
};

export const LADY_LUCK_ACTION: EffectSpec = {
  id: "ST08-013-Action",
  cardCode: "ST08-013",
  trigger: "Action",
  condition: {
    predicate: "controllerHasLinkUnitWithTrait:Mafty",
    then: [{ op: "damageUnit", amount: 2, target: { kind: "named", name: "target" } }],
    else: [{ op: "damageUnit", amount: 1, target: { kind: "named", name: "target" } }],
  },
  actions: [],
  targetScope: "enemyUnit",
  sourceText: "【Action】Choose 1 enemy Unit. Deal 1 damage to it. If a friendly (Mafty) Link Unit is in play, deal 2 damage instead.",
};

// ST08-014 Valiant — 【Burst】Deploy this card.
export const VALIANT_BURST: EffectSpec = {
  id: "ST08-014-Burst",
  cardCode: "ST08-014",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};

// ST08-014 Valiant — 【Deploy】Add 1 of your Shields to your hand. Then, choose 1 of your Units. It gets AP+2 during this turn.
export const VALIANT_DEPLOY: EffectSpec = {
  id: "ST08-014-Deploy",
  cardCode: "ST08-014",
  trigger: "Deploy",
  actions: [
    { op: "addShieldToHand", player: "controller", count: 1 },
    {
      op: "modifyStat",
      stat: "ap",
      amount: 2,
      duration: "endOfTurn",
      target: { kind: "named", name: "target" },
    },
  ],
  targetScope: "friendlyUnit",
  sourceText: "【Deploy】Add 1 of your Shields to your hand. Then, choose 1 of your Units. It gets AP+2 during this turn.",
};

// ST08-015 Davao — 【Burst】Deploy this card.
export const DAVAO_BURST: EffectSpec = {
  id: "ST08-015-Burst",
  cardCode: "ST08-015",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};

// ST08-015 Davao — 【Deploy】Add 1 of your Shields to your hand.
export const DAVAO_DEPLOY: EffectSpec = {
  id: "ST08-015-Deploy",
  cardCode: "ST08-015",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// ST08-015 Davao — 【Activate: Main】[Once per Turn] (2): Choose 1 of your Units. It recovers 2 HP.
export const DAVAO_ACTIVATE_MAIN: EffectSpec = {
  id: "ST08-015-ActivateMain",
  cardCode: "ST08-015",
  trigger: "Activate: Main",
  cost: [{ op: "payResourceCost", player: "controller", n: 2 }],
  actions: [{ op: "heal", amount: 2, target: { kind: "named", name: "target" } }],
  targetScope: "friendlyUnit",
  sourceText: "【Activate: Main】[Once per Turn] (2): Choose 1 of your Units. It recovers 2 HP.",
};

export const ST08_EFFECT_SPECS: EffectSpec[] = [
  XI_GUNDAM_WHEN_PAIRED,
  XI_GUNDAM_DEPLOY,
  MESSER_F01_ATTACK,
  PENELOPE_ATTACK,
  JEGAN_DEPLOY,
  HATHAWAY_BURST,
  HATHAWAY_WHEN_PAIRED,
  LANE_AIM_BURST,
  WORDS_FOR_HATHAWAY_MAIN,
  LADY_LUCK_MAIN,
  LADY_LUCK_ACTION,
  VALIANT_BURST,
  VALIANT_DEPLOY,
  DAVAO_BURST,
  DAVAO_DEPLOY,
  DAVAO_ACTIVATE_MAIN,
];
