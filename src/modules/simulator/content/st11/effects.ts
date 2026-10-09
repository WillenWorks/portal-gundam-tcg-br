import type { EffectSpec, TargetRef } from "../../engine/effectSpec";
import { mainAndAction, stdAddToHandBurst, stdDeployThisBurst } from "../standardSpecs";
import { TOKEN_GOOHN } from "./tokens";

/** W12 — ST11 "Aquatic Assault" (Marine), com o Q&A oficial das cartas (Q427–Q435). */

const target: TargetRef = { kind: "named", name: "target" };

export const ST11_EFFECT_SPECS: EffectSpec[] = [
  // ST11-001 Char's Z'Gok — "the bottom of its owner's deck": o Piloto pareado vai junto (Q427: o dono escolhe a ordem)
  {
    id: "ST11-001-Deploy",
    cardCode: "ST11-001",
    trigger: "Deploy",
    condition: { predicate: "controllerOtherUnitWithTrait:Marine", then: [{ op: "moveZone", target, toZone: "deck" }] },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "level<=2",
    sourceText:
      "【Deploy】If another friendly (Marine) Unit is in play, choose 1 enemy Unit that is Lv.2 or lower. Return it to the bottom of its owner's deck.",
  },

  // ST11-004 ZnO
  {
    id: "ST11-004-Deploy",
    cardCode: "ST11-004",
    trigger: "Deploy",
    actions: [{ op: "spawnToken", def: TOKEN_GOOHN, player: "controller", zone: "battleArea", count: 1, rested: true }],
    sourceText: "【Deploy】Deploy 1 rested [GOOhN]((ZAFT) (Marine)･AP1･HP1) Unit token.",
  },

  // ST11-006 Shamblo
  {
    id: "ST11-006-Deploy",
    cardCode: "ST11-006",
    trigger: "Deploy",
    actions: [{ op: "searchTrashToHand", player: "controller", filter: { cardType: "UNIT", anyTrait: ["Marine"] } }],
    sourceText: "【Deploy】Choose 1 (Marine) Unit card from your trash. Add it to your hand.",
  },

  // ST11-009 Kapool — Q432: vale mesmo sem OUTRA (Marine) em jogo (ela mesma conta)
  {
    id: "ST11-009-Destroyed",
    cardCode: "ST11-009",
    trigger: "Destroyed",
    condition: { predicate: "isOpponentTurn", then: [{ op: "draw", player: "controller", n: 1 }] },
    actions: [],
    sourceText: "【Destroyed】If it is your opponent's turn and a friendly (Marine) Unit is in play, draw 1.",
  },

  // ST11-011 Char Aznable
  stdAddToHandBurst("ST11-011"),
  {
    id: "ST11-011-WhenPaired",
    cardCode: "ST11-011",
    trigger: "When Paired",
    actions: [
      {
        op: "modifyStat",
        target: { kind: "group", group: { kind: "allFriendlyUnits", trait: "Marine" } },
        stat: "ap",
        amount: 1,
        duration: "endOfTurn",
      },
    ],
    sourceText: "【When Paired】All friendly (Marine) Units get AP+1 during this turn.",
  },

  // ST11-012 Loni Garvey
  stdAddToHandBurst("ST11-012"),
  {
    id: "ST11-012-WhenPaired",
    cardCode: "ST11-012",
    trigger: "When Paired",
    actions: [{ op: "grantDamageModifier", target, amount: 2, kind: "battle", scope: "turn", enemyOnly: true, sourceUnitOnly: true }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Marine",
    sourceText:
      "【When Paired】Choose 1 friendly (Marine) Unit. During this turn, when it receives battle damage from an enemy Unit, reduce it by 2.",
  },

  // ST11-013 Poorly Planned Offensive
  {
    id: "ST11-013-Burst",
    cardCode: "ST11-013",
    trigger: "Burst",
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "rested;hp<=3",
    sourceText: "【Burst】Choose 1 rested enemy Unit with 3 or less HP. Return it to its owner's hand.",
  },
  ...mainAndAction({
    cardCode: "ST11-013",
    actions: [
      { op: "moveZone", target, toZone: "hand" },
      { op: "draw", player: "controller", n: 1 },
    ],
    targetScope: "enemyUnit",
    targetFilter: "rested;hp<=3",
    // o "Choose … Return it …" é o mesmo texto do 【Burst】 (spec acima): aqui só o trecho que é só do 【Main】/【Action】
    sourceText: "Return it to its owner's hand. If you do, draw 1.",
  }),

  // ST11-014 The Orca of Red Sea
  {
    id: "ST11-014-Action",
    cardCode: "ST11-014",
    trigger: "Action",
    actions: [{ op: "preventBeingAttackTarget", target }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Marine",
    sourceText: "【Action】Choose 1 friendly (Marine) Unit. Enemy Units can't choose it as their attack target this turn.",
  },

  // ST11-015 A Twinkle from the Abyss — sem pagar o custo (Q434); o 【Deploy】 da Unit ativa (Q435)
  {
    id: "ST11-015-Main",
    cardCode: "ST11-015",
    trigger: "Main",
    actions: [
      {
        op: "deployFromTrashPayingCost",
        player: "controller",
        filter: { cardType: "UNIT", anyTrait: ["Marine"], maxLevel: 4 },
        free: true,
        rested: true,
      },
    ],
    sourceText: "【Main】Choose 1 (Marine) Unit card that is Lv.4 or lower from your trash. Deploy it rested.",
  },

  // ST11-016 Mad Angler
  stdDeployThisBurst("ST11-016"),
  {
    id: "ST11-016-Deploy",
    cardCode: "ST11-016",
    trigger: "Deploy",
    actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
    condition: { predicate: "enemyUnitCountAtLeast:4", then: [{ op: "damageUnit", target, amount: 2 }] },
    targetScope: "enemyUnit",
    targetFilter: "rested",
    sourceText:
      "【Deploy】Add 1 of your Shields to your hand. Then, if 4 or more enemy Units are in play, choose 1 rested enemy Unit. Deal 2 damage to it.",
  },
];
