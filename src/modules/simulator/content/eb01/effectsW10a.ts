import type { CardDefFilter, EffectSpec, PrimitiveCall, TargetRef } from "../../engine/effectSpec";
import { EX_RESOURCE_TOKEN } from "../../engine/setup";
import { TOKEN_GUNDAM_EXIA_GGEN } from "./tokens";

/**
 * W10a — EB01 001–045 (FAQ oficial do EB01, Q310–Q334/Q480–Q482). O simulador é 1v1: "each enemy player"/"all enemy
 * players" = o oponente; "If there are 2 or more enemy players" nunca vale (exato, não aproximação).
 * "rested Units in play" conta os dois lados (Q310/Q316/Q317).
 */

const target: TargetRef = { kind: "named", name: "target" };
const self: TargetRef = { kind: "self" };
const G_GEN: CardDefFilter = { anyTrait: ["G Generation"] };
export const exileFromTrash = (count: number, filter: CardDefFilter): PrimitiveCall => ({
  op: "moveZone",
  target: { kind: "group", group: { kind: "firstNInTrash", count, filter } },
  toZone: "exile",
});
const DEV = "You may exile the specified number of (G Generation) cards in your trash from the game. If you do, activate the following effect:";

/** Development N: exílio opcional de (G Generation) com escolha e o ■ em `Then:1` (mesmo padrão do ST10) */
export function development(cardCode: string, trigger: string, n: number, label = trigger): EffectSpec {
  return {
    id: `${cardCode}-${trigger.replace(/\s+/g, "")}`,
    cardCode,
    trigger,
    optional: true,
    condition: {
      predicate: `controllerTrashCardCountWithAnyTraitAtLeast:G Generation:${n}`,
      then: [exileFromTrash(n, G_GEN), { op: "thenTrigger", trigger: "Then:1" }],
    },
    actions: [],
    sourceText: `【${label}･Development ${n}】${DEV}`,
  };
}

export const EB01_W10A_EFFECT_SPECS: EffectSpec[] = [
  // EB01-001 Gundam Astray Red Frame Custom (EX)
  {
    id: "EB01-001-ActivateMain",
    cardCode: "EB01-001",
    trigger: "Activate·Main",
    oncePerTurn: true,
    cost: [exileFromTrash(2, { cardType: "COMMAND" })],
    actions: [
      { op: "rest", target },
      { op: "preventActivationNextTurn", target },
    ],
    targetScope: "enemyUnit",
    targetFilter: "damaged;level<=7",
    sourceText:
      "【Activate･Main】【Once per Turn】Exile 2 Command cards from your trash from the game：Choose 1 damaged enemy Unit that is Lv.7 or lower. Rest it. It won't be set as active during the start phase of your opponent's next turn.",
  },

  // EB01-002 Hi-Nu Gundam (EX)
  {
    id: "EB01-002-Deploy",
    cardCode: "EB01-002",
    trigger: "Deploy",
    condition: { predicate: "controllerOtherUnitWithTrait:G Generation", then: [{ op: "rest", target }] },
    actions: [],
    targetScope: "enemyUnit",
    sourceText: "【Deploy】If another friendly (G Generation) Unit is in play, choose 1 Unit belonging to each enemy player. Rest them.",
  },
  {
    id: "EB01-002-Attack",
    cardCode: "EB01-002",
    trigger: "Attack",
    duringLink: true,
    oncePerTurn: true,
    condition: { predicate: "otherRestedUnitsInPlayAtLeast:3", then: [{ op: "setActive", target: self }] },
    actions: [],
    sourceText: "【During Link】【Attack】【Once per Turn】If 3 or more other rested Units are in play, set this Unit as active.",
  },

  // EB01-005 Zeta Gundam Ⅲ P2 Type
  {
    id: "EB01-005-Deploy",
    cardCode: "EB01-005",
    trigger: "Deploy",
    actions: [
      { op: "setActive", target },
      { op: "draw", player: "controller", n: 1 },
    ],
    targetScope: "enemyUnit",
    targetFilter: "rested",
    sourceText: "【Deploy】Choose 1 rested Unit belonging to another player. Set it as active. Draw 1.",
  },

  // EB01-006 Gundam Astray Gold Frame Amatsu
  {
    id: "EB01-006-Deploy",
    cardCode: "EB01-006",
    trigger: "Deploy",
    actions: [{ op: "grantKeyword", target, keyword: "Repair 1", duration: "endOfTurn" }],
    targetScope: "friendlyUnit",
    sourceText: "【Deploy】Choose 1 of your Units. It gains <Repair 1> during this turn.",
  },

  // EB01-008 Gundam Delta Kai — Development 1
  development("EB01-008", "Deploy", 1),
  {
    id: "EB01-008-Then",
    cardCode: "EB01-008",
    trigger: "Then:1",
    actions: [{ op: "heal", target, amount: 2 }],
    targetScope: "friendlyUnit",
    sourceText: "■Choose 1 friendly Unit. It recovers 2 HP.",
  },

  // EB01-009 Gundam Full Armor (Thunderbolt) (EX) — o oponente escolhe a Unit dele (Q313)
  {
    id: "EB01-009-Deploy",
    cardCode: "EB01-009",
    trigger: "Deploy",
    actions: [{ op: "thenTrigger", trigger: "Then:1", decidedBy: "opponent" }],
    sourceText: "【Deploy】All enemy players each choose 1 of their active Units.",
  },
  {
    id: "EB01-009-Then",
    cardCode: "EB01-009",
    trigger: "Then:1",
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "active",
    sourceText: "Rest them.",
  },

  // EB01-010 Gundam Barbatos 6th Form — Development 3 (Q315: ativa sem alvo)
  development("EB01-010", "Deploy", 3),
  {
    id: "EB01-010-Then",
    cardCode: "EB01-010",
    trigger: "Then:1",
    actions: [{ op: "damageUnit", target, amount: 2 }],
    targetScope: "enemyUnit",
    targetFilter: "rested",
    sourceText: "■Choose 1 rested enemy Unit. Deal 2 damage to it.",
  },

  // EB01-013 Red Gundam (0085)
  {
    id: "EB01-013-Attack",
    cardCode: "EB01-013",
    trigger: "Attack",
    condition: {
      predicate: "opponentHandCountAtLeast:6",
      then: [{ op: "modifyStat", target: self, stat: "ap", amount: 2, duration: "endOfTurn" }],
    },
    actions: [],
    sourceText: "【Attack】If an enemy player has 6 or more cards in their hand, this Unit gets AP+2 during this turn.",
  },

  // EB01-015 Prototype Asshimar TR-3 "Kehaar" (Q316: Units dos dois lados; ela já saiu de jogo)
  {
    id: "EB01-015-Destroyed",
    cardCode: "EB01-015",
    trigger: "Destroyed",
    condition: { predicate: "restedUnitsInPlayAtLeast:2", then: [{ op: "damageUnit", target, amount: 1 }] },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "rested",
    sourceText: "【Destroyed】If there are 2 or more other rested Units in play, choose 1 rested enemy Unit. Deal 1 damage to it.",
  },

  // EB01-017 Haro — no 1v1, quem destrói em batalha é o oponente
  {
    id: "EB01-017-Destroyed",
    cardCode: "EB01-017",
    trigger: "Destroyed",
    condition: {
      predicate: "duringDamageStep",
      then: [
        { op: "draw", player: "controller", n: 1 },
        { op: "draw", player: "opponent", n: 1 },
      ],
    },
    actions: [],
    sourceText: "【Destroyed】If this Unit is destroyed with battle damage, you and the player who destroyed this Unit draw 1.",
  },

  // EB01-018 Gundam Astray Blue Frame Second L
  {
    id: "EB01-018-Attack",
    cardCode: "EB01-018",
    trigger: "Attack",
    actions: [{ op: "heal", target, amount: 1 }],
    targetScope: "friendlyUnit",
    sourceText: "【Attack】Choose 1 friendly Unit. It recovers 1 HP.",
  },

  // EB01-019 Gundam Pixy (Q317)
  {
    id: "EB01-019-Attack",
    cardCode: "EB01-019",
    trigger: "Attack",
    condition: {
      predicate: "otherRestedUnitsInPlayAtLeast:2",
      then: [{ op: "grantKeyword", target: self, keyword: "High-Maneuver", duration: "thisBattle" }],
    },
    actions: [],
    sourceText: "【Attack】If there are 2 or more other rested Units in play, this Unit gains <High-Maneuver> during this battle.",
  },

  // EB01-020 Gundam Mk-Ⅲ (Q318: qualquer Unit)
  {
    id: "EB01-020-ActivateAction",
    cardCode: "EB01-020",
    trigger: "Activate·Action",
    duringLink: true,
    oncePerTurn: true,
    actions: [{ op: "heal", target, amount: 1 }],
    targetScope: "anyUnit",
    sourceText: "【During Link】【Activate･Action】【Once per Turn】Choose 1 Unit. It recovers 1 HP.",
  },

  // EB01-021 Build Strike Gundam (Full Package) (EX)
  {
    id: "EB01-021-WhenPaired",
    cardCode: "EB01-021",
    trigger: "When Paired",
    condition: {
      predicate: "pairedPilotHasTrait:G Generation;controllerTrashUnitCountWithAnyTraitAtLeast:G Generation:2",
      then: [{ op: "placeResourceFromDeck", player: "controller", rested: true }],
    },
    actions: [],
    sourceText: "【When Paired･(G Generation) Pilot】If there are 2 or more (G Generation) Unit cards in your trash, place 1 rested Resource.",
  },

  // EB01-022 Gundam Exia (EX)
  {
    id: "EB01-022-EndOfTurn",
    cardCode: "EB01-022",
    trigger: "Reaction:endOfTurn",
    reaction: { event: "endOfTurn", subject: "self", turn: "yours" },
    duringPair: true,
    optional: true,
    condition: {
      predicate: "pairedPilotHasTrait:G Generation",
      then: [
        { op: "destroy", target: self },
        { op: "spawnToken", def: TOKEN_GUNDAM_EXIA_GGEN, player: "controller", zone: "battleArea", count: 3 },
      ],
    },
    actions: [],
    sourceText:
      "【During Pair･(G Generation) Pilot】At the end of your turn, you may destroy this Unit. If you do, deploy 3 [Gundam Exia]((G Generation)･AP2･HP2) Unit tokens.",
  },

  // EB01-024 GQuuuuuuX (Omega Psycommu)
  {
    id: "EB01-024-Attack",
    cardCode: "EB01-024",
    trigger: "Attack",
    actions: [{ op: "damageUnit", target, amount: 2 }],
    targetScope: "enemyUnit",
    targetFilter: "hasKeyword:Blocker;level<=5",
    sourceText: "【Attack】Choose 1 enemy Unit with <Blocker> that is Lv.5 or lower. Deal 2 damage to it.",
  },

  // EB01-027 Tallgeese — Development 2
  development("EB01-027", "Deploy", 2),
  {
    id: "EB01-027-Then",
    cardCode: "EB01-027",
    trigger: "Then:1",
    actions: [{ op: "grantKeyword", target, keyword: "Breach 1", duration: "endOfTurn" }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:G Generation",
    sourceText: "■Choose 1 friendly (G Generation) Unit. It gains <Breach 1> during this turn.",
  },

  // EB01-030 Big-Rang (Q480: olhar é obrigatório)
  {
    id: "EB01-030-Deploy",
    cardCode: "EB01-030",
    trigger: "Deploy",
    actions: [
      {
        op: "lookAtTopFilterReveal",
        player: "controller",
        count: 3,
        filter: { cardType: "UNIT", anyTrait: ["G Generation"], minLevel: 3, maxLevel: 3 },
      },
    ],
    sourceText:
      "【Deploy】Look at the top 3 cards of your deck. You may reveal 1 (G Generation) Unit card that is Lv.3 among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
  },

  // EB01-034 Gundam Lfrith Ur (Q481)
  {
    id: "EB01-034-WhenLinked",
    cardCode: "EB01-034",
    trigger: "When Linked",
    actions: [
      {
        op: "lookAtTopFilterReveal",
        player: "controller",
        count: 3,
        filter: { cardType: "UNIT", anyTrait: ["G Generation"], minLevel: 3, maxLevel: 3 },
      },
    ],
    sourceText:
      "【When Linked】Look at the top 3 cards of your deck. You may reveal 1 (G Generation) Unit card that is Lv.3 among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
  },

  // EB01-035 Gundam Lfrith Thorn
  {
    id: "EB01-035-UnitDeployed",
    cardCode: "EB01-035",
    trigger: "Reaction:unitDeployed",
    reaction: { event: "unitDeployed", subject: "friendlyOther", subjectFilter: "trait:G Generation;level<=3;level>=3" },
    actions: [{ op: "grantKeyword", target: self, keyword: "Breach 1", duration: "endOfTurn" }],
    sourceText: "When another friendly (G Generation) Unit that is Lv.3 is deployed, this Unit gains <Breach 1> during this turn.",
  },

  // EB01-038 G-Self
  {
    id: "EB01-038-Deploy",
    cardCode: "EB01-038",
    trigger: "Deploy",
    actions: [{ op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea", count: 1 }],
    sourceText: "【Deploy】Place 1 EX Resource.",
  },

  // EB01-041 Strike Freedom Gundam (EX)
  {
    id: "EB01-041-Deploy",
    cardCode: "EB01-041",
    trigger: "Deploy",
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=4",
    sourceText: "【Deploy】Choose 1 Unit with 4 or less HP belonging to each enemy player. Return them to their owners' hands.",
  },

  // EB01-043 Blue Destiny Unit-1 (EX)
  {
    id: "EB01-043-Attack",
    cardCode: "EB01-043",
    trigger: "Attack",
    condition: {
      predicate: "controllerUnitWithKeywordInPlay:Blocker",
      then: [{ op: "modifyStat", target, stat: "ap", amount: -2, duration: "thisBattle" }],
    },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "level<=5",
    sourceText: "【Attack】If a friendly Unit with <Blocker> is in play, choose 1 enemy Unit that is Lv.5 or lower. It gets AP-2 during this battle.",
  },

  // EB01-045 Psycho Zaku (EX)
  {
    id: "EB01-045-WhenPaired",
    cardCode: "EB01-045",
    trigger: "When Paired",
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "hasKeyword:Repair",
    sourceText: "【When Paired】Choose 1 enemy Unit with <Repair>. Return it to its owner's hand.",
  },
];
