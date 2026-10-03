import type { EffectSpec, TargetRef } from "../../engine/effectSpec";
import { mainAndAction, stdAddToHandBurst, stdDeployThisBurst } from "../standardSpecs";

const target: TargetRef = { kind: "named", name: "target" };

/** Starter ST09 — EffectSpecs (W6). */
export const ST09_EFFECT_SPECS: EffectSpec[] = [
  {
    id: "ST09-001-ActivateMain",
    cardCode: "ST09-001",
    trigger: "Activate·Main",
    // CR 3-3-6: o Piloto pareado vai junto para o fundo do deck
    cost: [
      { op: "payResourceCost", player: "controller", n: 2 },
      { op: "moveZone", target: { kind: "self" }, toZone: "deck" },
    ],
    actions: [
      {
        op: "deployFromTrashPayingCost",
        player: "controller",
        filter: { cardType: "UNIT", nameContains: "Impulse Gundam", minLevel: 4 },
        free: true,
      },
    ],
    sourceText:
      "【Activate･Main】②, return this Unit to the bottom of its owner's deck：Choose 1 Unit card with \"Impulse Gundam\" in its card name that is Lv.4 or higher from your trash. Deploy it.",
  },
  {
    id: "ST09-002-Destroyed",
    cardCode: "ST09-002",
    trigger: "Destroyed",
    actions: [
      {
        op: "searchTrashToHand",
        player: "controller",
        filter: { cardType: "UNIT", anyTrait: ["Minerva Squad"], notNameContains: "Force Impulse Gundam" },
      },
    ],
    sourceText: "【Destroyed】Choose 1 (Minerva Squad) Unit card without \"Force Impulse Gundam\" in its card name from your trash. Add it to your hand.",
  },
  {
    id: "ST09-003-WhenLinked",
    cardCode: "ST09-003",
    trigger: "When Linked",
    condition: {
      predicate: "controllerTrashColorCountAtLeast:purple:5",
      then: [{ op: "damageUnit", target: { kind: "group", group: { kind: "allUnits", maxAp: 5 } }, amount: 2 }],
    },
    actions: [],
    sourceText: "【When Linked】If there are 5 or more purple cards in your trash, deal 2 damage to all Units with 5 or less AP.",
  },
  {
    id: "ST09-006-Deploy",
    cardCode: "ST09-006",
    trigger: "Deploy",
    condition: { predicate: "selfDeployedFromTrash", then: [{ op: "destroy", target }] },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "level<=3",
    sourceText: "【Deploy】If you deploy this Unit from your trash, choose 1 enemy Unit that is Lv.3 or lower. Destroy it.",
  },
  stdAddToHandBurst("ST09-008"),
  {
    id: "ST09-008-Attack",
    cardCode: "ST09-008",
    trigger: "Attack",
    condition: { predicate: "selfHasTrait:Minerva Squad", then: [{ op: "setActive", target }] },
    actions: [],
    targetScope: "ownResource",
    targetFilter: "rested",
    sourceText: "【Attack】If this is a (Minerva Squad) Unit, choose 1 of your Resources. Set it as active.",
  },
  ...mainAndAction({
    cardCode: "ST09-009",
    actions: [{ op: "destroy", target }],
    targetScope: "enemyUnit",
    targetFilter: "active;ap<=4",
    sourceText: "【Main】/【Action】Choose 1 active enemy Unit with 4 or less AP. Destroy it.",
  }),
  stdDeployThisBurst("ST09-010"),
  {
    id: "ST09-010-Deploy",
    cardCode: "ST09-010",
    trigger: "Deploy",
    actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
    // 【Burst】 deploya a Base no turno do oponente — aí o "Then, if it is your turn" não acontece
    condition: {
      predicate: "isControllersTurn",
      then: [
        { op: "moveWithinDeck", target: { kind: "named", name: "toTop" }, position: "top" },
        { op: "moveWithinDeck", target: { kind: "named", name: "toTrash" }, position: "trash" },
      ],
    },
    sourceText:
      "【Deploy】Add 1 of your Shields to your hand. Then, if it is your turn, look at the top 2 cards of your deck and return 1 to the top. Place the remaining card into your trash.",
  },
];
