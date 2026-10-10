import type { EffectSpec, TargetRef } from "../../engine/effectSpec";
import { EX_RESOURCE_TOKEN } from "../../engine/setup";
import { mainAndAction, stdAddToHandBurst, stdBaseDeployShield, stdDeployThisBurst } from "../standardSpecs";

/** W12 — ST14 (com o Q&A oficial das cartas, Q462–Q469). 1v1: "the number of enemy players" = 1. */

const target: TargetRef = { kind: "named", name: "target" };
const MODE_HEADER = "When playing this card, choose 1 of the following effects and activate it:";
const placeEx = { op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea", count: 1 } as const;

export const ST14_EFFECT_SPECS: EffectSpec[] = [
  // ST14-003 Palace Athene — o OPONENTE escolhe as 2 do trash dele
  {
    id: "ST14-003-Deploy",
    cardCode: "ST14-003",
    trigger: "Deploy",
    actions: [{ op: "thenTrigger", trigger: "Then:1", decidedBy: "opponent" }],
    sourceText: "【Deploy】Choose 1 enemy player.",
  },
  {
    id: "ST14-003-Then",
    cardCode: "ST14-003",
    trigger: "Then:1",
    actions: [
      {
        op: "moveZone",
        target: { kind: "group", group: { kind: "firstNInTrash", count: 2, filter: { cardType: "UNIT" }, player: "opponent" } },
        toZone: "exile",
      },
    ],
    sourceText: "That player chooses 2 Unit cards from their trash. Exile them from the game.",
  },

  // ST14-005 G-Falcon DX — vale numa Unit já descansada (Q466)
  {
    id: "ST14-005-Deploy",
    cardCode: "ST14-005",
    trigger: "Deploy",
    actions: [{ op: "rest", target }],
    condition: {
      predicate: "controllerTrashCountAtLeast:7",
      then: [{ op: "modifyStat", target, stat: "ap", amount: -2, duration: "endOfTurn" }],
    },
    targetScope: "enemyUnit",
    targetFilter: "level<=6",
    sourceText:
      "【Deploy】Choose 1 enemy Unit that is Lv.6 or lower. Rest it. Then, if there are 7 or more cards in your trash, it gets AP-2 during this turn.",
  },

  // ST14-006 Full Armor Unicorn Gundam (Destroy Mode) — olhar é obrigatório (Q467); 1 jogador inimigo = 1 carta
  {
    id: "ST14-006-Deploy",
    cardCode: "ST14-006",
    trigger: "Deploy",
    actions: [{ op: "lookAtTopFilterReveal", player: "controller", count: 3, filter: {} }],
    sourceText:
      "【Deploy】Look at the top 3 cards of your deck. You may reveal a number of cards equal to the number of enemy players among them and add them to your hand. Return the remaining cards randomly to the bottom of your deck.",
  },

  // ST14-009 Duel Gundam (Assault Shroud)
  {
    id: "ST14-009-Destroyed",
    cardCode: "ST14-009",
    trigger: "Destroyed",
    actions: [placeEx],
    sourceText: "【Destroyed】Place 1 EX Resource.",
  },

  // ST14-011 Paptimus Scirocco
  stdAddToHandBurst("ST14-011"),
  {
    id: "ST14-011-Attack",
    cardCode: "ST14-011",
    trigger: "Attack",
    actions: [{ op: "modifyStat", target, stat: "ap", amount: -1, amountFrom: { kind: "enemyRestedUnitCount" }, duration: "thisBattle" }],
    targetScope: "enemyUnit",
    sourceText: "【Attack】Choose 1 enemy Unit. Reduce its AP during this battle by an amount equal to the number of rested enemy Units.",
  },

  // ST14-012 Banagher Links
  stdAddToHandBurst("ST14-012"),
  {
    id: "ST14-012-WhenPaired",
    cardCode: "ST14-012",
    trigger: "When Paired",
    actions: [{ op: "grantAttackTargetRelax", target, maxAp: 5 }],
    targetScope: "friendlyUnit",
    targetFilter: "level>=5",
    sourceText:
      "【When Paired】Choose 1 friendly Unit that is Lv.5 or higher. During this turn, it may choose an active enemy Unit with 5 or less AP as its attack target.",
  },

  // ST14-013 Natural Talent — só modos com alvo escolhível (Q468/Q469)
  {
    id: "ST14-013-Burst",
    cardCode: "ST14-013",
    trigger: "Burst",
    actions: [{ op: "modifyStat", target, stat: "ap", amount: -3, duration: "endOfTurn" }],
    targetScope: "enemyUnit",
    sourceText: "【Burst】Choose 1 enemy Unit. It gets AP-3 during this turn.",
  },
  ...mainAndAction({
    cardCode: "ST14-013",
    actions: [
      {
        op: "chooseMode",
        key: "mode",
        options: [
          { value: "1", label: "Descansar 1 a 2 Units inimigas com 3 ou menos de HP" },
          { value: "2", label: "1 Unit inimiga recebe AP-3 neste turno" },
        ],
      },
    ],
    sourceText: `【Main】/【Action】${MODE_HEADER}`,
  }),
  {
    id: "ST14-013-Mode1",
    cardCode: "ST14-013",
    trigger: "Mode:1",
    actions: [{ op: "rest", target: { kind: "namedGroup", name: "target" } }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=3",
    targetCount: { min: 1, max: 2 },
    sourceText: "■Choose 1 to 2 enemy Units with 3 or less HP. Rest them.",
  },
  {
    id: "ST14-013-Mode2",
    cardCode: "ST14-013",
    trigger: "Mode:2",
    actions: [{ op: "modifyStat", target, stat: "ap", amount: -3, duration: "endOfTurn" }],
    targetScope: "enemyUnit",
    sourceText: "■Choose 1 enemy Unit. It gets AP-3 during this turn.",
  },

  // ST14-014 Blazing Mobile Suit Rider — com 4+ Commands no trash, qualquer Unit inimiga
  ...mainAndAction({
    cardCode: "ST14-014",
    actions: [{ op: "modifyStat", target, stat: "ap", amount: -3, duration: "endOfTurn" }],
    targetScope: "enemyUnit",
    targetFilter: "cond(controllerTrashCardTypeCountAtLeast:COMMAND:4||level<=5)",
    sourceText:
      "【Main】/【Action】Choose 1 enemy Unit that is Lv.5 or lower. It gets AP-3 during this turn. If there are 4 or more Command cards in your trash, choose 1 enemy Unit instead.",
  }),

  // ST14-015 Battlefield Emotions
  {
    id: "ST14-015-Burst",
    cardCode: "ST14-015",
    trigger: "Burst",
    actions: [placeEx],
    sourceText: "【Burst】Place 1 EX Resource.",
  },
  {
    id: "ST14-015-Main",
    cardCode: "ST14-015",
    trigger: "Main",
    actions: [{ op: "placeResourceFromDeck", player: "controller", rested: true }, { op: "thenTrigger", trigger: "Then:1" }],
    sourceText: "【Main】Place 1 rested Resource.",
  },
  {
    id: "ST14-015-Then",
    cardCode: "ST14-015",
    trigger: "Then:1",
    condition: {
      predicate: "controllerSetResourceActiveByEffectThisTurn",
      then: [],
      else: [{ op: "setActive", target: { kind: "group", group: { kind: "firstRestedResourceOf", player: "controller" } } }],
    },
    actions: [],
    sourceText:
      "Then, if you have not set one of your Resources as active with an effect this turn, choose a number of your Resources equal to the number of enemy players. Set them as active.",
  },

  // ST14-016 Gryphios 2
  stdDeployThisBurst("ST14-016"),
  stdBaseDeployShield("ST14-016"),
  {
    id: "ST14-016-UnitLinked",
    cardCode: "ST14-016",
    trigger: "Reaction:unitLinked",
    reaction: { event: "unitLinked", subject: "friendly", turn: "yours" },
    oncePerTurn: true,
    actions: [{ op: "modifyStat", target, stat: "ap", amount: -1, duration: "endOfTurn" }],
    targetScope: "enemyUnit",
    targetFilter: "level<=5",
    sourceText: "【Once per Turn】During your turn, when a friendly Unit links, choose 1 enemy Unit that is Lv.5 or lower. It gets AP-1 during this turn.",
  },
];
