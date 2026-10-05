import type { EffectSpec, TargetRef } from "../../engine/effectSpec";
import { mainAndAction, stdAddToHandBurst, stdDeployThisBurst } from "../standardSpecs";
import { development } from "./effectsW10a";

/**
 * W10b — EB01 046–090 que cabem no vocabulário atual: Pilotos, Commands e Bases (FAQ EB01 Q318–Q334). 1v1:
 * "each enemy player" = o oponente. "Choose 1 Unit" sem dono = qualquer Unit (Q326/Q332/Q333/Q334).
 */

const target: TargetRef = { kind: "named", name: "target" };
const self: TargetRef = { kind: "self" };
const shieldToHand = { op: "addShieldToHand" as const, player: "controller" as const, count: 1 };

const EB01_082_ACTION: EffectSpec = {
  id: "EB01-082-Action",
  cardCode: "EB01-082",
  trigger: "Action",
  actions: [{ op: "moveZone", target, toZone: "hand" }],
  targetScope: "enemyUnit",
  targetFilter: "level<=3",
  sourceText: "【Action】Choose 1 Unit that is Lv.3 or lower belonging to each enemy player. Return them to their owners' hands.",
};

export const EB01_W10B_EFFECT_SPECS: EffectSpec[] = [
  // 【Burst】 padrão das cartas cujo resto do texto fica pra W11
  ...["EB01-062", "EB01-063", "EB01-064", "EB01-066", "EB01-067", "EB01-068", "EB01-071", "EB01-077"].map(stdAddToHandBurst),
  stdDeployThisBurst("EB01-088"),

  // EB01-046 Striker Custom (EX)
  {
    id: "EB01-046-Attack",
    cardCode: "EB01-046",
    trigger: "Attack",
    duringPair: true,
    actions: [{ op: "modifyStat", target, stat: "ap", amount: -2, duration: "thisBattle" }],
    targetScope: "enemyUnit",
    targetFilter: "level>=4",
    sourceText: "【During Pair】【Attack】Choose 1 enemy Unit that is Lv.4 or higher. It gets AP-2 during this battle.",
  },

  // EB01-047 Casval's Gundam — 【When Paired･Development 1】
  development("EB01-047", "When Paired", 1),
  {
    id: "EB01-047-Then",
    cardCode: "EB01-047",
    trigger: "Then:1",
    actions: [{ op: "grantKeyword", target: self, keyword: "High-Maneuver", duration: "endOfTurn" }],
    sourceText: "■This Unit gains <High-Maneuver> during this turn.",
  },

  // EB01-052 Hildolfr
  {
    id: "EB01-052-Deploy",
    cardCode: "EB01-052",
    trigger: "Deploy",
    condition: { predicate: "enemyUnitCountAtLeast:3", then: [{ op: "moveZone", target, toZone: "hand" }] },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "hp<=2",
    sourceText: "【Deploy】If 3 or more enemy Units are in play, choose 1 enemy Unit with 2 or less HP. Return it to its owner's hand.",
  },

  // EB01-057 Gundam Geminass 02
  {
    id: "EB01-057-Deploy",
    cardCode: "EB01-057",
    trigger: "Deploy",
    optional: true,
    actions: [
      { op: "rest", target },
      { op: "thenTrigger", trigger: "Then:1" },
    ],
    targetScope: "friendlyUnit",
    targetFilter: "active;level<=3;level>=3",
    sourceText: "【Deploy】You may choose 1 active friendly Unit that is Lv.3. Rest it.",
  },
  {
    id: "EB01-057-Then",
    cardCode: "EB01-057",
    trigger: "Then:1",
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "level<=2",
    sourceText: "If you do, choose 1 enemy Unit that is Lv.2 or lower. Return it to its owner's hand.",
  },

  // EB01-060 Gundam Aquarius — 【When Paired･Development 3】 (Q324: ativa sem alvo)
  development("EB01-060", "When Paired", 3),
  {
    id: "EB01-060-Then",
    cardCode: "EB01-060",
    trigger: "Then:1",
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "level<=4",
    sourceText: "■Choose 1 enemy Unit that is Lv.4 or lower. Return it to its owner's hand.",
  },

  // EB01-061 Ellis Claude
  stdAddToHandBurst("EB01-061"),
  {
    id: "EB01-061-WhenPaired",
    cardCode: "EB01-061",
    trigger: "When Paired",
    condition: { predicate: "controllerUnitWithTraitInPlay:G Generation", then: [{ op: "rest", target }] },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "level<=3",
    sourceText: "【When Paired】If a friendly (G Generation) Unit is in play, choose 1 enemy Unit that is Lv.3 or lower. Rest it.",
  },

  // EB01-065 Meir Siva
  stdAddToHandBurst("EB01-065"),
  {
    id: "EB01-065-WhenLinked",
    cardCode: "EB01-065",
    trigger: "When Linked",
    actions: [{ op: "grantKeyword", target, keyword: "Breach 1", duration: "endOfTurn" }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:G Generation",
    sourceText: "【When Linked】Choose 1 friendly (G Generation) Unit. It gains <Breach 1> during this turn.",
  },

  // EB01-069 Beside Pain
  stdAddToHandBurst("EB01-069"),
  {
    id: "EB01-069-Attack",
    cardCode: "EB01-069",
    trigger: "Attack",
    actions: [{ op: "modifyStat", target, stat: "ap", amount: 2, duration: "endOfTurn" }],
    targetScope: "friendlyUnit",
    targetFilter: "hasKeyword:Blocker",
    sourceText: "【Attack】Choose 1 friendly Unit with <Blocker>. It gets AP+2 during this turn.",
  },

  // EB01-070 Daryl Lorenz (Q326: qualquer Unit)
  stdAddToHandBurst("EB01-070"),
  {
    id: "EB01-070-ActivateAction",
    cardCode: "EB01-070",
    trigger: "Activate·Action",
    duringLink: true,
    oncePerTurn: true,
    cost: [{ op: "payResourceCost", player: "controller", n: 1 }],
    condition: {
      predicate: "isOpponentTurn",
      then: [{ op: "modifyStat", target, stat: "ap", amount: 1, duration: "thisBattle" }],
    },
    actions: [],
    targetScope: "anyUnit",
    sourceText: "【During Link】【Activate･Action】【Once per Turn】①：If it is your opponent's turn, choose 1 Unit. It gets AP+1 during this battle.",
  },

  // EB01-072 Yuu Kajima (Q327: só ativa com os 2 alvos)
  stdAddToHandBurst("EB01-072"),
  {
    id: "EB01-072-WhenPaired",
    cardCode: "EB01-072",
    trigger: "When Paired",
    actions: [
      { op: "rest", target },
      { op: "rest", target: { kind: "named", name: "enemyTarget" } },
    ],
    targetScope: "friendlyUnit",
    targetFilter: "active;hasKeyword:Blocker",
    secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit", targetFilter: "level<=4" },
    sourceText: "【When Paired】Choose 1 active friendly Unit with <Blocker> and 1 enemy Unit that is Lv.4 or lower. Rest them.",
  },

  // EB01-073 Character Requests (Q328: Units dos dois lados)
  {
    id: "EB01-073-Burst",
    cardCode: "EB01-073",
    trigger: "Burst",
    actions: [{ op: "draw", player: "controller", n: 1 }],
    sourceText: "【Burst】Draw 1.",
  },
  {
    id: "EB01-073-Main",
    cardCode: "EB01-073",
    trigger: "Main",
    condition: { predicate: "restedUnitsInPlayAtLeast:6", then: [{ op: "draw", player: "controller", n: 2 }] },
    actions: [],
    sourceText: "【Main】If there are 6 or more rested Units in play, draw 2.",
  },

  // EB01-074 Eternal Road (Q329/Q330: o oponente escolhe a Unit dele)
  {
    id: "EB01-074-Burst",
    cardCode: "EB01-074",
    trigger: "Burst",
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=3",
    sourceText: "【Burst】Choose 1 enemy Unit with 3 or less HP. Rest it.",
  },
  ...mainAndAction({
    cardCode: "EB01-074",
    actions: [
      { op: "rest", target },
      { op: "thenTrigger", trigger: "Then:1", decidedBy: "opponent" },
    ],
    targetScope: "friendlyUnit",
    targetFilter: "active;trait:G Generation",
    sourceText: "【Main】/【Action】Choose 1 active friendly (G Generation) Unit. Rest it.",
  }),
  {
    id: "EB01-074-Then",
    cardCode: "EB01-074",
    trigger: "Then:1",
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "active",
    sourceText: "If you do, all enemy players each choose 1 of their active Units. Rest them.",
  },

  // EB01-075 Fierce Enemy Assault
  ...mainAndAction({
    cardCode: "EB01-075",
    actions: [{ op: "rest", target: { kind: "namedGroup", name: "target" } }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=2",
    targetCount: { min: 1, max: 2 },
    sourceText: "【Main】/【Action】Choose 1 to 2 enemy Units with 2 or less HP. Rest them.",
  }),

  // EB01-076 Gerbera Straight (【Pilot】[Lowe Guele] na CardDef)
  ...mainAndAction({
    cardCode: "EB01-076",
    actions: [{ op: "heal", target, amount: 3 }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:G Generation",
    sourceText: "【Main】/【Action】Choose 1 friendly (G Generation) Unit. It recovers 3 HP.",
  }),

  // EB01-080 Sturm Faust (Q332: qualquer Unit (G Generation); 【Pilot】[Jean Luc Duvall] na CardDef)
  ...mainAndAction({
    cardCode: "EB01-080",
    actions: [{ op: "grantAttackTargetRelax", target }],
    targetScope: "anyUnit",
    targetFilter: "trait:G Generation",
    sourceText: "【Main】/【Action】Choose 1 (G Generation) Unit. During this turn, it may choose an active enemy Unit as its attack target.",
  }),

  // EB01-081 MAP Weapon
  stdAddToHandBurst("EB01-081"),
  ...mainAndAction({
    cardCode: "EB01-081",
    actions: [{ op: "moveZone", target: { kind: "namedGroup", name: "target" }, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=2",
    targetCount: { min: 1, max: 2 },
    sourceText: "【Main】/【Action】Choose 1 to 2 enemy Units with 2 or less HP. Return them to their owners' hands.",
  }),

  // EB01-082 Warship Cruise
  EB01_082_ACTION,
  {
    id: "EB01-082-Burst",
    cardCode: "EB01-082",
    trigger: "Burst",
    actions: EB01_082_ACTION.actions,
    targetScope: EB01_082_ACTION.targetScope,
    targetFilter: EB01_082_ACTION.targetFilter,
    sourceText: "【Burst】Activate this card's 【Action】.",
  },

  // EB01-083 SP Conversion Chips (Q333: qualquer Unit)
  {
    id: "EB01-083-Action",
    cardCode: "EB01-083",
    trigger: "Action",
    condition: {
      predicate: "isOpponentTurn",
      then: [{ op: "modifyStat", target, stat: "ap", amount: 3, duration: "endOfTurn" }],
    },
    actions: [],
    targetScope: "anyUnit",
    sourceText: "【Action】If it is your opponent's turn, choose 1 Unit. It gets AP+3 during this turn.",
  },

  // EB01-084 30cm Cannon (APFSDS Round) (Q334: qualquer Unit; 【Pilot】[Demeziere Sonnen] na CardDef)
  ...mainAndAction({
    cardCode: "EB01-084",
    actions: [
      { op: "setActive", target },
      { op: "preventAttackThisTurn", target },
    ],
    targetScope: "anyUnit",
    targetFilter: "hasKeyword:Blocker",
    sourceText: "【Main】/【Action】Choose 1 Unit with <Blocker>. Set it as active. It can't attack during this turn.",
  }),

  // EB01-085 Kudelia Aina Bernstein & Isari
  stdDeployThisBurst("EB01-085"),
  {
    id: "EB01-085-Deploy",
    cardCode: "EB01-085",
    trigger: "Deploy",
    actions: [shieldToHand],
    sourceText: "【Deploy】Add 1 of your Shields to your hand.",
  },
  {
    id: "EB01-085-DeployRest",
    cardCode: "EB01-085",
    trigger: "Deploy",
    optional: true,
    actions: [
      { op: "rest", target },
      { op: "rest", target: { kind: "named", name: "enemyTarget" } },
    ],
    targetScope: "friendlyUnit",
    targetFilter: "active;color:blue;trait:G Generation",
    secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit" },
    sourceText: "Then, you may choose 1 active friendly blue (G Generation) Unit and 1 enemy Unit. Rest them.",
  },

  // EB01-086 Kycilia Zabi & Gwazine
  stdDeployThisBurst("EB01-086"),
  {
    id: "EB01-086-Deploy",
    cardCode: "EB01-086",
    trigger: "Deploy",
    actions: [shieldToHand],
    sourceText: "【Deploy】Add 1 of your Shields to your hand.",
  },
  {
    id: "EB01-086-UnitLinked",
    cardCode: "EB01-086",
    trigger: "Reaction:unitLinked",
    reaction: { event: "unitLinked", subject: "friendly", subjectFilter: "trait:G Generation" },
    oncePerTurn: true,
    actions: [{ op: "grantKeyword", target: { kind: "named", name: "reactionSubject" }, keyword: "Repair 2", duration: "endOfTurn" }],
    sourceText: "【Once per Turn】When a friendly (G Generation) Unit links, it gains <Repair 2> during this turn.",
  },

  // EB01-087 Marina Ismail & Ptolemaios 2
  stdDeployThisBurst("EB01-087"),
  {
    id: "EB01-087-Deploy",
    cardCode: "EB01-087",
    trigger: "Deploy",
    actions: [shieldToHand],
    sourceText: "【Deploy】Add 1 of your Shields to your hand.",
  },
  {
    id: "EB01-087-DestroyedEnemyInBattle",
    cardCode: "EB01-087",
    trigger: "Reaction:destroyedEnemyInBattle",
    reaction: { event: "destroyedEnemyInBattle", subject: "friendly", subjectFilter: "color:green;trait:G Generation", turn: "yours" },
    oncePerTurn: true,
    actions: [{ op: "heal", target, amount: 2 }],
    targetScope: "friendlyUnit",
    sourceText:
      "【Once per Turn】During your turn, when a friendly green (G Generation) Unit destroys an enemy Unit with battle damage, choose 1 friendly Unit. It recovers 2 HP.",
  },

  // EB01-089 Lacus Clyne & Eternal
  stdDeployThisBurst("EB01-089"),
  {
    id: "EB01-089-Deploy",
    cardCode: "EB01-089",
    trigger: "Deploy",
    actions: [shieldToHand, { op: "setActive", target }, { op: "preventAttackThisTurn", target }],
    targetScope: "friendlyUnit",
    targetFilter: "rested;color:white;trait:G Generation",
    sourceText:
      "【Deploy】Add 1 of your Shields to your hand. Then, choose 1 rested friendly white (G Generation) Unit. Set it as active. It can't attack during this turn.",
  },

  // EB01-090 Tiffa Adill & Freeden
  stdDeployThisBurst("EB01-090"),
  {
    id: "EB01-090-Deploy",
    cardCode: "EB01-090",
    trigger: "Deploy",
    actions: [shieldToHand],
    condition: { predicate: "isControllersTurn", then: [{ op: "moveZone", target, toZone: "hand" }] },
    targetScope: "enemyUnit",
    targetFilter: "hp<=2",
    sourceText:
      "【Deploy】Add 1 of your Shields to your hand. Then, if it is your turn, choose 1 Unit with 2 or less HP belonging to each enemy player. Return them to their owners' hands.",
  },
];
