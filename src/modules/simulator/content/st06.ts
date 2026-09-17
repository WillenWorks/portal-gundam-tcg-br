import type { EffectSpec } from "../engine/effectSpec";

/**
 * Wave ST06 "GQuuuuuuX / Red Gundam" — Efeitos oficiais autorados
 * para o Starter Deck 06.
 */

// ST06-001 GQuuuuuuX (Omega Psycommu) — 【When Linked】If another friendly (Clan) Unit
// is in play, this gains <First Strike> during this turn.
export const GQUUUUUUX_WHEN_LINKED: EffectSpec = {
  id: "ST06-001-WhenLinked",
  cardCode: "ST06-001",
  trigger: "When Linked",
  condition: {
    predicate: "controllerOtherUnitWithTrait:Clan",
    then: [{ op: "grantKeyword", keyword: "First Strike", duration: "endOfTurn", target: { kind: "self" } }],
  },
  actions: [],
  sourceText: "【When Linked】If another friendly (Clan) Unit is in play, this gains <First Strike> during this turn.",
};

// ST06-002 GQuuuuuuX (Omega Psycommu) — 【Deploy】If another friendly (Clan) Unit
// is in play, choose 1 enemy Unit. Deal 1 damage to it.
export const GQUUUUUUX_DEPLOY: EffectSpec = {
  id: "ST06-002-Deploy",
  cardCode: "ST06-002",
  trigger: "Deploy",
  condition: {
    predicate: "controllerOtherUnitWithTrait:Clan",
    then: [{ op: "damageUnit", amount: 1, target: { kind: "named", name: "target" } }],
  },
  actions: [],
  targetScope: "enemyUnit",
  sourceText: "【Deploy】If another friendly (Clan) Unit is in play, choose 1 enemy Unit. Deal 1 damage to it.",
};

// ST06-005 Red Gundam — 【Attack】Choose 1 or 2 friendly (Clan) Units. They get AP+2 during this turn.
export const RED_GUNDAM_ATTACK: EffectSpec = {
  id: "ST06-005-Attack",
  cardCode: "ST06-005",
  trigger: "Attack",
  actions: [
    {
      op: "modifyStat",
      stat: "ap",
      amount: 2,
      duration: "endOfTurn",
      target: { kind: "namedGroup", name: "targets" },
    },
  ],
  targetScope: "friendlyUnit",
  targetFilter: "trait:Clan",
  targetCount: { min: 1, max: 2 },
  sourceText: "【Attack】Choose 1 or 2 friendly (Clan) Units. They get AP+2 during this turn.",
};

// ST06-007 Ortega's Rick Dom (GQ) — 【Deploy】Choose 1 of your other (Clan) Units.
// During this turn, it may choose an active enemy Unit with 3 or less AP as its attack target.
export const ORTEGA_RICK_DOM_DEPLOY: EffectSpec = {
  id: "ST06-007-Deploy",
  cardCode: "ST06-007",
  trigger: "Deploy",
  actions: [
    {
      op: "grantAttackTargetRelax",
      target: { kind: "named", name: "target" },
      maxAp: 3,
    },
  ],
  targetScope: "friendlyUnit",
  targetFilter: "trait:Clan;isNotSelf",
  sourceText: "【Deploy】Choose 1 of your other (Clan) Units. During this turn, it may choose an active enemy Unit with 3 or less AP as its attack target.",
};

// ST06-009 Amate Yuzuriha (Machu) — 【When Linked】Look at the top card of your deck.
// If it is a (Clan) card, you may reveal it and add it to your hand.
export const AMATE_YUZURIHA_WHEN_LINKED: EffectSpec = {
  id: "ST06-009-WhenLinked",
  cardCode: "ST06-009",
  trigger: "When Linked",
  actions: [
    {
      op: "lookAtTopFilterReveal",
      player: "controller",
      count: 1,
      filter: { anyTrait: ["Clan"] },
    },
  ],
  sourceText: "【When Linked】Look at the top card of your deck. If it is a (Clan) card, you may reveal it and add it to your hand. Return any remaining card to the bottom of your deck.",
};

// ST06-010 Shuji Ito — 【During Link】【Attack】If you have a (Clan) Unit in play,
// look at the top card of your deck. Return it to the top or bottom of your deck.
export const SHUJI_ITO_ATTACK: EffectSpec = {
  id: "ST06-010-Attack",
  cardCode: "ST06-010",
  trigger: "Attack",
  duringLink: true,
  condition: {
    predicate: "controllerUnitWithTraitInPlay:Clan",
    then: [{ op: "moveTopCardToChosenPosition", player: "controller", optionsKey: "shujiTopCard" }],
  },
  actions: [],
  sourceText: "【During Link】【Attack】If you have a (Clan) Unit in play, look at the top card of your deck. Return it to the top or bottom of your deck.",
};

// ST06-011 Ruthless Tactics — 【Main】/【Action】Choose 1 to 2 friendly (Clan) Units. They get AP+2 during this turn.
export const RUTHLESS_TACTICS_MAIN: EffectSpec = {
  id: "ST06-011-Main",
  cardCode: "ST06-011",
  trigger: "Main",
  actions: [
    {
      op: "modifyStat",
      stat: "ap",
      amount: 2,
      duration: "endOfTurn",
      target: { kind: "namedGroup", name: "targets" },
    },
  ],
  targetScope: "friendlyUnit",
  targetFilter: "trait:Clan",
  targetCount: { min: 1, max: 2 },
  sourceText: "【Main】Choose 1 to 2 friendly (Clan) Units. They get AP+2 during this turn.",
};

export const RUTHLESS_TACTICS_ACTION: EffectSpec = {
  id: "ST06-011-Action",
  cardCode: "ST06-011",
  trigger: "Action",
  actions: [
    {
      op: "modifyStat",
      stat: "ap",
      amount: 2,
      duration: "endOfTurn",
      target: { kind: "namedGroup", name: "targets" },
    },
  ],
  targetScope: "friendlyUnit",
  targetFilter: "trait:Clan",
  targetCount: { min: 1, max: 2 },
  sourceText: "【Action】Choose 1 to 2 friendly (Clan) Units. They get AP+2 during this turn.",
};

// ST06-012 Schoolgirl and Smuggler — 【Main】Look at the top 3 cards of your deck.
// You may reveal 1 (Clan) Unit card/Pilot card among them and add it to your hand.
export const SCHOOLGIRL_AND_SMUGGLER_MAIN: EffectSpec = {
  id: "ST06-012-Main",
  cardCode: "ST06-012",
  trigger: "Main",
  actions: [
    {
      op: "lookAtTopFilterReveal",
      player: "controller",
      count: 3,
      filter: { anyTrait: ["Clan"], anyCardType: ["UNIT", "PILOT"] },
    },
  ],
  sourceText: "【Main】Look at the top 3 cards of your deck. You may reveal 1 (Clan) Unit card/Pilot card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
};

// ST06-013 Fierce Unity — 【Action】Choose 1 to 2 friendly (Clan) Units.
// They can't receive battle damage from enemy Units that are Lv.2 or lower during this turn.
export const FIERCE_UNITY_ACTION: EffectSpec = {
  id: "ST06-013-Action",
  cardCode: "ST06-013",
  trigger: "Action",
  actions: [
    {
      op: "preventUnitBattleDamage",
      target: { kind: "namedGroup", name: "targets" },
      maxAttackerLevel: 2,
    },
  ],
  targetScope: "friendlyUnit",
  targetFilter: "trait:Clan",
  targetCount: { min: 1, max: 2 },
  sourceText: "【Action】Choose 1 to 2 friendly (Clan) Units. They can't receive battle damage from enemy Units that are Lv.2 or lower during this turn.",
};

// ST06-014 Clan Battle — 【Deploy】Add 1 of your Shields to your hand.
export const CLAN_BATTLE_DEPLOY: EffectSpec = {
  id: "ST06-014-Deploy",
  cardCode: "ST06-014",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// ST06-014 Clan Battle — 【Activate: Main】Rest this Base: If a friendly (Clan) Link Unit
// is in play, choose 1 friendly Unit. It gets AP+2 during this turn.
export const CLAN_BATTLE_ACTIVATE_MAIN: EffectSpec = {
  id: "ST06-014-ActivateMain",
  cardCode: "ST06-014",
  trigger: "Activate: Main",
  condition: {
    predicate: "controllerLinkUnitWithTraitInPlay:Clan",
    then: [
      {
        op: "modifyStat",
        stat: "ap",
        amount: 2,
        duration: "endOfTurn",
        target: { kind: "named", name: "target" },
      },
    ],
  },
  actions: [{ op: "rest", target: { kind: "self" } }],
  targetScope: "friendlyUnit",
  sourceText: "【Activate: Main】Rest this Base: If a friendly (Clan) Link Unit is in play, choose 1 friendly Unit. It gets AP+2 during this turn.",
};

// ST06-015 Kaneban Co., Ltd. — 【Deploy】Add 1 of your Shields to your hand.
export const KANEBAN_DEPLOY: EffectSpec = {
  id: "ST06-015-Deploy",
  cardCode: "ST06-015",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

export const ST06_EFFECT_SPECS: EffectSpec[] = [
  GQUUUUUUX_WHEN_LINKED,
  GQUUUUUUX_DEPLOY,
  RED_GUNDAM_ATTACK,
  ORTEGA_RICK_DOM_DEPLOY,
  AMATE_YUZURIHA_WHEN_LINKED,
  SHUJI_ITO_ATTACK,
  RUTHLESS_TACTICS_MAIN,
  RUTHLESS_TACTICS_ACTION,
  SCHOOLGIRL_AND_SMUGGLER_MAIN,
  FIERCE_UNITY_ACTION,
  CLAN_BATTLE_DEPLOY,
  CLAN_BATTLE_ACTIVATE_MAIN,
  KANEBAN_DEPLOY,
];
