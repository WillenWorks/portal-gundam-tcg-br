import type { EffectSpec } from "../engine/effectSpec";

/**
 * Wave ST07 "Gundam 00 / Celestial Being" — Efeitos oficiais autorados
 * para o Starter Deck 07.
 */

// ST07-001 Gundam Exia — 【When Paired】Place the top 2 cards of your deck into your trash.
// If you place a (CB) card with this effect, draw 1.
export const GUNDAM_EXIA_WHEN_PAIRED: EffectSpec = {
  id: "ST07-001-WhenPaired",
  cardCode: "ST07-001",
  trigger: "When Paired",
  actions: [
    {
      op: "millToTrash",
      player: "controller",
      count: 2,
      drawIfTraitMilled: "CB",
    },
  ],
  sourceText: "【When Paired】Place the top 2 cards of your deck into your trash. If you place a (CB) card with this effect, draw 1.",
};

// ST07-001 Gundam Exia — End of Turn: if 7+ (CB) cards in trash, set 1 of your Resources as active.
export const GUNDAM_EXIA_END_OF_TURN: EffectSpec = {
  id: "ST07-001-EndOfTurn",
  cardCode: "ST07-001",
  trigger: "EndOfTurn",
  condition: {
    predicate: "controllerTrashCardCountWithTraitAtLeast:CB:7",
    then: [{ op: "setActive", target: { kind: "named", name: "target" } }],
  },
  actions: [],
  targetScope: "ownResource",
  targetFilter: "rested",
  sourceText: "At the end of your turn, if there are 7 or more (CB) cards in your trash, choose 1 of your Resources. Set it as active.",
};

// ST07-009 Setsuna F. Seiei — 【Burst】Add this card to your hand.
export const SETSUNA_BURST: EffectSpec = {
  id: "ST07-009-Burst",
  cardCode: "ST07-009",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST07-009 Setsuna F. Seiei — 【Attack】This Unit gets AP+1 during this turn.
// If there are 7 or more (CB) cards in your trash, all your (CB) Units get AP+1 instead.
export const SETSUNA_ATTACK: EffectSpec = {
  id: "ST07-009-Attack",
  cardCode: "ST07-009",
  trigger: "Attack",
  condition: {
    predicate: "controllerTrashCardCountWithTraitAtLeast:CB:7",
    then: [
      {
        op: "modifyStat",
        stat: "ap",
        amount: 1,
        duration: "endOfTurn",
        target: { kind: "group", group: { kind: "allFriendlyUnits", trait: "CB" } },
      },
    ],
    else: [
      {
        op: "modifyStat",
        stat: "ap",
        amount: 1,
        duration: "endOfTurn",
        target: { kind: "pairedUnit" },
      },
    ],
  },
  actions: [],
  sourceText: "【Attack】This Unit gets AP+1 during this turn. If there are 7 or more (CB) cards in your trash, all your (CB) Units get AP+1 instead.",
};

// ST07-010 Tieria Erde — 【Burst】Add this card to your hand.
export const TIERIA_BURST: EffectSpec = {
  id: "ST07-010-Burst",
  cardCode: "ST07-010",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST07-010 Tieria Erde — 【Destroyed】If it is your opponent's turn and this is a (CB) Unit, draw 1.
export const TIERIA_DESTROYED: EffectSpec = {
  id: "ST07-010-Destroyed",
  cardCode: "ST07-010",
  trigger: "Destroyed",
  condition: {
    predicate: "isOpponentTurn",
    then: [{ op: "draw", player: "controller", n: 1 }],
  },
  actions: [],
  sourceText: "【Destroyed】If it is your opponent's turn and this is a (CB) Unit, draw 1.",
};

// ST07-011 Lockon Stratos (Neil) — 【Burst】Add this card to your hand.
export const LOCKON_BURST: EffectSpec = {
  id: "ST07-011-Burst",
  cardCode: "ST07-011",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST07-011 Lockon Stratos (Neil) — 【When Paired】If this is a (CB) Unit, it may choose
// an active enemy Unit whose Lv. is equal to or lower than this Unit as its attack target during this turn.
export const LOCKON_WHEN_PAIRED: EffectSpec = {
  id: "ST07-011-WhenPaired",
  cardCode: "ST07-011",
  trigger: "When Paired",
  actions: [
    {
      op: "grantAttackTargetRelax",
      target: { kind: "pairedUnit" },
    },
  ],
  sourceText: "【When Paired】If this is a (CB) Unit, it may choose an active enemy Unit whose Lv. is equal to or lower than this Unit as its attack target during this turn.",
};

// ST07-012 Allelujah Haptism — 【Burst】Add this card to your hand.
export const ALLELUJAH_BURST: EffectSpec = {
  id: "ST07-012-Burst",
  cardCode: "ST07-012",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// ST07-013 Armed Intervention — 【Burst】Draw 1.
export const ARMED_INTERVENTION_BURST: EffectSpec = {
  id: "ST07-013-Burst",
  cardCode: "ST07-013",
  trigger: "Burst",
  actions: [{ op: "draw", player: "controller", n: 1 }],
  sourceText: "【Burst】Draw 1.",
};

// ST07-013 Armed Intervention — 【Action】Choose 1 rested friendly (CB) Unit.
// Change the attack target of the battling enemy Unit to it.
export const ARMED_INTERVENTION_ACTION: EffectSpec = {
  id: "ST07-013-Action",
  cardCode: "ST07-013",
  trigger: "Action",
  actions: [],
  targetScope: "friendlyUnit",
  targetFilter: "trait:CB;rested",
  sourceText: "【Action】Choose 1 rested friendly (CB) Unit. Change the attack target of the battling enemy Unit to it.",
};

// ST07-014 Tactical Visionary — 【Main】Look at the top 3 cards of your deck.
// You may reveal 1 (CB) Unit card / Pilot card among them and add it to your hand.
export const TACTICAL_VISIONARY_MAIN: EffectSpec = {
  id: "ST07-014-Main",
  cardCode: "ST07-014",
  trigger: "Main",
  actions: [
    {
      op: "lookAtTopFilterReveal",
      player: "controller",
      count: 3,
      filter: { anyTrait: ["CB"], anyCardType: ["UNIT", "PILOT"] },
    },
  ],
  sourceText: "【Main】Look at the top 3 cards of your deck. You may reveal 1 (CB) Unit card/Pilot card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
};

// ST07-015 Ptolemaios — 【Burst】Deploy this card.
export const PTOLEMAIOS_BURST: EffectSpec = {
  id: "ST07-015-Burst",
  cardCode: "ST07-015",
  trigger: "Burst",
  actions: [{ op: "deployThisCard" }],
  sourceText: "【Burst】Deploy this card.",
};

// ST07-015 Ptolemaios — 【Deploy】Add 1 of your Shields to your hand.
export const PTOLEMAIOS_DEPLOY: EffectSpec = {
  id: "ST07-015-Deploy",
  cardCode: "ST07-015",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

export const ST07_EFFECT_SPECS: EffectSpec[] = [
  GUNDAM_EXIA_WHEN_PAIRED,
  GUNDAM_EXIA_END_OF_TURN,
  SETSUNA_BURST,
  SETSUNA_ATTACK,
  TIERIA_BURST,
  TIERIA_DESTROYED,
  LOCKON_BURST,
  LOCKON_WHEN_PAIRED,
  ALLELUJAH_BURST,
  ARMED_INTERVENTION_BURST,
  ARMED_INTERVENTION_ACTION,
  TACTICAL_VISIONARY_MAIN,
  PTOLEMAIOS_BURST,
  PTOLEMAIOS_DEPLOY,
];
