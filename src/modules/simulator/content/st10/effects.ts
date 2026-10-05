import type { CardDefFilter, EffectSpec, PrimitiveCall, TargetRef } from "../../engine/effectSpec";
import { mainAndAction, stdAddToHandBurst, stdDeployThisBurst } from "../standardSpecs";

/**
 * Starter ST10 — EffectSpecs (W9). FAQ oficial do ST10 (12/06/2026, Q302–Q309).
 * Development N: "You may exile the specified number of (G Generation) cards in your trash from the game. If you do,
 * activate the following effect: ■…" — o exílio é a 1ª parte ("you may", o jogador escolhe quais, W9) e o ■ vira
 * continuação `Then:1` com a própria escolha; ativa mesmo sem alvo pro ■ (Q303/Q304).
 * "the number of enemy players" = 1 (o simulador é 1v1; Q305/Q306 são de multiplayer).
 */

const target: TargetRef = { kind: "named", name: "target" };
const G_GEN: CardDefFilter = { anyTrait: ["G Generation"] };

/** Development N: exila N (G Generation) do trash e segue pra `Then:1` */
function development(cardCode: string, trigger: string, n: number, sourceText: string): EffectSpec {
  const exile: PrimitiveCall = { op: "moveZone", target: { kind: "group", group: { kind: "firstNInTrash", count: n, filter: G_GEN } }, toZone: "exile" };
  return {
    id: `${cardCode}-${trigger.replace(/\s+/g, "")}`,
    cardCode,
    trigger,
    optional: true,
    condition: {
      predicate: `controllerTrashCardCountWithAnyTraitAtLeast:G Generation:${n}`,
      then: [exile, { op: "thenTrigger", trigger: "Then:1" }],
    },
    actions: [],
    sourceText,
  };
}

const DEV2 = "You may exile the specified number of (G Generation) cards in your trash from the game. If you do, activate the following effect:";

export const ST10_EFFECT_SPECS: EffectSpec[] = [
  // ST10-001 Zeta Gundam (EX)
  {
    id: "ST10-001-DestroyedShieldInBattle",
    cardCode: "ST10-001",
    trigger: "Reaction:destroyedShieldInBattle",
    reaction: { event: "destroyedShieldInBattle", subject: "self" },
    actions: [
      { op: "setActive", target: { kind: "self" } },
      { op: "grantKeyword", target: { kind: "self" }, keyword: "CannotTargetPlayer", duration: "endOfTurn" },
    ],
    sourceText:
      "When this Unit destroys an enemy shield area card with battle damage, set it as active. It can't choose the same enemy player or enemy team as its attack target during this turn.",
  },

  // ST10-002 Zeta Gundam — 【Deploy･Development 2】
  development("ST10-002", "Deploy", 2, `【Deploy･Development 2】${DEV2}`),
  {
    id: "ST10-002-Then",
    cardCode: "ST10-002",
    trigger: "Then:1",
    actions: [{ op: "rest", target }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=4",
    sourceText: "■Choose 1 enemy Unit with 4 or less HP. Rest it.",
  },

  // ST10-006 Phoenix Gundam (Power Unleashed) (EX)
  {
    id: "ST10-006-DestroyedEnemyInBattle",
    cardCode: "ST10-006",
    trigger: "Reaction:destroyedEnemyInBattle",
    reaction: { event: "destroyedEnemyInBattle", subject: "self", turn: "yours" },
    duringPair: true,
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=3",
    sourceText:
      "【During Pair】During your turn, when this Unit destroys an enemy Unit with battle damage, choose 1 enemy Unit with 3 or less HP. Return it to its owner's hand.",
  },

  // ST10-007 Gundam Barbatos 4th Form — 【When Linked･Development 2】
  development("ST10-007", "When Linked", 2, `【When Linked･Development 2】${DEV2}`),
  {
    id: "ST10-007-Then",
    cardCode: "ST10-007",
    trigger: "Then:1",
    actions: [{ op: "searchTrashToHand", player: "controller", filter: { cardType: "COMMAND", maxLevel: 4 } }],
    sourceText: "■Choose 1 Command card that is Lv.4 or lower from your trash. Add it to your hand.",
  },

  // ST10-008 Gundam Barbatos 1st Form — 【Deploy･Development 2】
  development("ST10-008", "Deploy", 2, `【Deploy･Development 2】${DEV2}`),
  {
    id: "ST10-008-Then",
    cardCode: "ST10-008",
    trigger: "Then:1",
    actions: [
      { op: "draw", player: "controller", n: 1 },
      { op: "discardNamed", player: "controller", name: "discard", n: 1 },
    ],
    sourceText: "■Draw a number of cards equal to the number of enemy players. Then, discard the same number of cards you drew with this effect.",
  },

  // ST10-011 Kamille Bidan
  stdAddToHandBurst("ST10-011"),
  {
    id: "ST10-011-WhenLinked",
    cardCode: "ST10-011",
    trigger: "When Linked",
    // Q307: Units descansadas de qualquer lado; Q308: Lv. da Unit pareada
    condition: { predicate: "restedUnitsInPlayAtLeast:2", then: [{ op: "rest", target }] },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "level<=self",
    sourceText: "【When Linked】If 2 or more rested Units are in play, choose 1 enemy Unit whose Lv. is equal to or lower than this Unit. Rest it.",
  },

  // ST10-012 Mark Guilder
  stdAddToHandBurst("ST10-012"),
  {
    id: "ST10-012-WhenPaired",
    cardCode: "ST10-012",
    trigger: "When Paired",
    actions: [{ op: "modifyStat", target, stat: "ap", amount: -2, duration: "endOfTurn" }],
    targetScope: "enemyUnit",
    targetFilter: "level<=5",
    sourceText: "【When Paired】Choose 1 enemy Unit that is Lv.5 or lower. It gets AP-2 during this turn.",
  },

  // ST10-013 Tactical Training — qualquer Unit (Q309)
  stdAddToHandBurst("ST10-013"),
  ...mainAndAction({
    cardCode: "ST10-013",
    actions: [
      { op: "heal", target, amount: 2 },
      { op: "modifyStat", target, stat: "ap", amount: 2, duration: "endOfTurn" },
    ],
    targetScope: "anyUnit",
    targetFilter: "trait:G Generation;level>=5",
    sourceText: "【Main】/【Action】Choose 1 (G Generation) Unit that is Lv.5 or higher. It recovers 2 HP and gets AP+2 during this turn.",
  }),

  // ST10-014 Unlocking the Development Diagram — o custo alternativo está na CardDef (`altPlayByDiscard`)
  {
    id: "ST10-014-Main",
    cardCode: "ST10-014",
    trigger: "Main",
    actions: [{ op: "draw", player: "controller", n: 2 }],
    sourceText: "【Main】Draw 2.",
  },

  // ST10-015 Diffuse Beam Cannon
  {
    id: "ST10-015-Action",
    cardCode: "ST10-015",
    trigger: "Action",
    condition: {
      predicate: "controllerUnitWithTraitInPlay:G Generation",
      then: [{ op: "modifyStat", target, stat: "ap", amount: -3, duration: "thisBattle" }],
    },
    actions: [],
    targetScope: "enemyUnit",
    sourceText: "【Action】If a friendly (G Generation) Unit is in play, choose 1 enemy Unit. It gets AP-3 during this battle.",
  },

  // ST10-016 Luna Mana & Carry Base
  stdDeployThisBurst("ST10-016"),
  {
    id: "ST10-016-Deploy",
    cardCode: "ST10-016",
    trigger: "Deploy",
    actions: [
      { op: "addShieldToHand", player: "controller", count: 1 },
      { op: "heal", target: { kind: "group", group: { kind: "allFriendlyUnits", trait: "G Generation" } }, amount: 1 },
    ],
    sourceText: "【Deploy】Add 1 of your Shields to your hand. Then, all friendly (G Generation) Units recover 1 HP.",
  },
];
