import type { EffectSpec } from "../../engine/effectSpec";
import { EX_RESOURCE_TOKEN } from "../../engine/setup";
import { TOKEN_DAUGHTRESS } from "../gd02/effects";
import { mainAndAction } from "../standardSpecs";
import { TOKEN_GFRED, TOKEN_GQUUUUUUX_OMEGA, TOKEN_HY_GOGG, TOKEN_RED_GUNDAM } from "./tokens";

/**
 * Wave W1 (GD03) — cláusulas que o vocabulário atual do motor já cobre. As que dependem
 * de capacidade nova (provocação, exilar do trash, gatilhos reativos, quantidade por
 * contagem, "instead", dano em Base) ficam pra W2.
 */

const target = { kind: "named", name: "target" } as const;

export const GD03_W1_EFFECT_SPECS: EffectSpec[] = [
  // GD03-004 Hambrabi
  {
    id: "GD03-004-Attack",
    cardCode: "GD03-004",
    trigger: "Attack",
    condition: {
      predicate: "controllerOtherUnitCountWithAnyTraitAtLeast:Titans:2",
      then: [{ op: "rest", target }],
    },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "hp<=5",
    sourceText: "【Attack】If you have 2 or more other (Titans) Units in play, choose 1 enemy Unit with 5 or less HP. Rest it.",
  },
  // GD03-017 Kämpfer
  {
    id: "GD03-017-Burst",
    cardCode: "GD03-017",
    trigger: "Burst",
    actions: [{ op: "searchTrashToHand", player: "controller", filter: { cardType: "PILOT", anyTrait: ["Cyclops Team"] } }],
    sourceText: "【Burst】Choose 1 (Cyclops Team) Pilot card from your trash. Add it to your hand.",
  },
  {
    id: "GD03-017-WhenPaired",
    cardCode: "GD03-017",
    trigger: "When Paired",
    condition: {
      predicate: "pairedPilotHasTrait:Cyclops Team",
      then: [
        {
          op: "grantAttackTargetRelax",
          target: { kind: "group", group: { kind: "allFriendlyUnits", trait: "Cyclops Team" } },
          maxAp: 5,
        },
      ],
    },
    actions: [],
    sourceText:
      "【When Paired·(Cyclops Team) Pilot】All your (Cyclops Team) Units may choose an active enemy Unit with 5 or less AP as their attack target during this turn.",
  },
  // GD03-018 Altron Gundam
  {
    id: "GD03-018-Attack",
    cardCode: "GD03-018",
    trigger: "Attack",
    actions: [{ op: "damageUnit", amount: 5, target }],
    targetScope: "enemyUnit",
    targetFilter: "hasKeyword:Blocker",
    sourceText: "【Attack】Choose 1 enemy Unit with <Blocker>. Deal 5 damage to it.",
  },
  // GD03-019 Gundam AGE-2 Normal (o 【During Pair】 de provocação fica pra W2)
  {
    id: "GD03-019-WhenLinked",
    cardCode: "GD03-019",
    trigger: "When Linked",
    actions: [{ op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea" }],
    sourceText: "【When Linked】Place 1 EX Resource.",
  },
  // GD03-024 Hy-Gogg
  {
    id: "GD03-024-WhenLinked",
    cardCode: "GD03-024",
    trigger: "When Linked",
    condition: {
      predicate: "controllerOtherUnitWithTrait:Cyclops Team",
      then: [{ op: "spawnToken", def: TOKEN_HY_GOGG, player: "controller", zone: "battleArea", rested: true }],
    },
    actions: [],
    sourceText: "【When Linked】If you have another (Cyclops Team) Unit in play, deploy 1 rested [Hy-Gogg]((Cyclops Team)·AP2·HP1) Unit token.",
  },
  // GD03-028 Auda's Maganac (a provocação dos (Maganac Corps) é da GD03-025, W2)
  {
    id: "GD03-028-Attack",
    cardCode: "GD03-028",
    trigger: "Attack",
    condition: {
      predicate: "attackingEnemyUnit",
      then: [{ op: "modifyStat", stat: "ap", amount: 2, duration: "thisBattle", target: { kind: "self" } }],
    },
    actions: [],
    sourceText: "【Attack】If you are attacking an enemy Unit, this Unit gets AP+2 during this battle.",
  },
  // GD03-034 GQuuuuuuX (Omega Psycommu)
  {
    id: "GD03-034-Deploy",
    cardCode: "GD03-034",
    trigger: "Deploy",
    actions: [{ op: "damageUnit", amount: 3, target }],
    targetScope: "enemyUnit",
    sourceText: "【Deploy】Choose 1 enemy Unit. Deal 3 damage to it.",
  },
  // GD03-036 Ξ Gundam (Flight Form)
  {
    id: "GD03-036-WhenLinked",
    cardCode: "GD03-036",
    trigger: "When Linked",
    actions: [{ op: "damageUnit", amount: 1, target: { kind: "group", group: { kind: "allEnemyUnits" } } }],
    sourceText: "【When Linked】Deal 1 damage to all enemy Units.",
  },
  // GD03-043 Messer Type-F02
  {
    id: "GD03-043-WhenPaired",
    cardCode: "GD03-043",
    trigger: "When Paired",
    actions: [{ op: "damageUnit", amount: 1, target }],
    targetScope: "enemyUnit",
    sourceText: "【When Paired】Choose 1 enemy Unit. Deal 1 damage to it.",
  },
  // GD03-044 Daughtress Flyer
  {
    id: "GD03-044-Deploy",
    cardCode: "GD03-044",
    trigger: "Deploy",
    actions: [{ op: "spawnToken", def: TOKEN_DAUGHTRESS, player: "controller", zone: "battleArea", rested: true }],
    sourceText: "【Deploy】Deploy 1 rested [Daughtress]((New UNE)·AP0·HP1) Unit token.",
  },
  // GD03-048 GFreD
  {
    id: "GD03-048-Burst",
    cardCode: "GD03-048",
    trigger: "Burst",
    condition: {
      predicate: "enemyShieldCountAtMost:3",
      then: [{ op: "spawnToken", def: TOKEN_GFRED, player: "controller", zone: "battleArea", rested: true }],
    },
    actions: [],
    sourceText: "【Burst】If there are 3 or less enemy Shields, deploy 1 rested [GFreD]((Zeon)·AP4·HP3) Unit token.",
  },
  // GD03-051 Gundam X Divider
  {
    id: "GD03-051-WhenLinked",
    cardCode: "GD03-051",
    trigger: "When Linked",
    optional: true,
    actions: [{ op: "deployFromTrashPayingCost", player: "controller", filter: { cardType: "UNIT", maxLevel: 4 } }],
    sourceText: "【When Linked】You may choose 1 Unit card that is Lv.4 or lower from your trash. Pay its cost to deploy it.",
  },
  // GD03-055 Gundam Hajiroboshi (2nd Form)
  {
    id: "GD03-055-WhenPaired",
    cardCode: "GD03-055",
    trigger: "When Paired",
    condition: { predicate: "pairedPilotColorIs:purple", then: [{ op: "destroy", target }] },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "level<=2",
    sourceText: "【When Paired·Purple Pilot】Choose 1 enemy Unit that is Lv.2 or lower. Destroy it.",
  },
  // GD03-056 Gundam Barbatos Adapt
  {
    id: "GD03-056-Deploy",
    cardCode: "GD03-056",
    trigger: "Deploy",
    actions: [
      { op: "damageUnit", amount: 1, target },
      { op: "damageUnit", amount: 1, target: { kind: "named", name: "enemyTarget" } },
    ],
    targetScope: "friendlyUnit",
    secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit" },
    sourceText: "【Deploy】Choose 1 of your Units and 1 enemy Unit. Deal 1 damage to them.",
  },
  // GD03-067 Rouei
  {
    id: "GD03-067-Deploy",
    cardCode: "GD03-067",
    trigger: "Deploy",
    optional: true,
    actions: [
      { op: "damageUnit", amount: 1, target },
      { op: "modifyStat", stat: "ap", amount: 1, duration: "endOfTurn", target },
    ],
    targetScope: "friendlyUnit",
    sourceText: "【Deploy】You may choose 1 of your Units. Deal 1 damage to it. It gets AP+1 during this turn.",
  },
  // GD03-072 Aile Strike Gundam
  {
    id: "GD03-072-Deploy",
    cardCode: "GD03-072",
    trigger: "Deploy",
    condition: {
      predicate: "controllerOtherUnitWithTrait:Triple Ship Alliance",
      then: [
        { op: "draw", player: "controller", n: 1 },
        { op: "discardNamed", player: "controller", name: "discardTarget", n: 1 },
      ],
    },
    actions: [],
    sourceText: "【Deploy】If you have another (Triple Ship Alliance) Unit in play, draw 1. Then, discard 1.",
  },
  // GD03-075 Super Gundam
  {
    id: "GD03-075-Attack",
    cardCode: "GD03-075",
    trigger: "Attack",
    duringLink: true,
    actions: [{ op: "modifyStat", stat: "ap", amount: -2, duration: "endOfTurn", target }],
    targetScope: "enemyUnit",
    targetFilter: "unpaired",
    sourceText: "【During Link】【Attack】Choose 1 enemy Unit with no paired Pilot. It gets AP-2 during this turn.",
  },
  // GD03-077 Justice Gundam (METEOR)
  {
    id: "GD03-077-WhenLinked",
    cardCode: "GD03-077",
    trigger: "When Linked",
    actions: [{ op: "moveZone", target: { kind: "namedGroup", name: "target" }, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=3",
    targetCount: { min: 1, max: 3 },
    sourceText: "【When Linked】Choose 1 to 3 enemy Units with 3 or less HP. Return them to their owners'hands.",
  },
  // GD03-080 Gundam Kimaris Trooper (Trooper Mode)
  {
    id: "GD03-080-WhenLinked",
    cardCode: "GD03-080",
    trigger: "When Linked",
    actions: [{ op: "searchTrashToHand", player: "controller", filter: { cardType: "COMMAND", anyTrait: ["Gjallarhorn"] } }],
    sourceText: "【When Linked】Choose 1 (Gjallarhorn) Command card from your trash. Add it to your hand.",
  },
  // GD03-086 Yazan Gable (Piloto: "this Unit" = a Unit pareada)
  {
    id: "GD03-086-Attack",
    cardCode: "GD03-086",
    trigger: "Attack",
    actions: [{ op: "modifyStat", stat: "ap", amount: 1, duration: "endOfTurn", target }],
    targetScope: "friendlyUnit",
    targetFilter: "trait:Titans;level<=self",
    sourceText: "【Attack】Choose 1 of your (Titans) Units whose Lv. is equal to or lower than this Unit. It gets AP+1 during this turn.",
  },
  // GD03-091 Rau Le Creuset
  {
    id: "GD03-091-WhenLinked",
    cardCode: "GD03-091",
    trigger: "When Linked",
    actions: [{ op: "searchTrashToHand", player: "controller", filter: { cardType: "BASE", anyTrait: ["ZAFT"] } }],
    sourceText: "【When Linked】Choose 1 (ZAFT) Base card from your trash. Add it to your hand.",
  },
  // GD03-096 Jamil Neate
  {
    id: "GD03-096-Attack",
    cardCode: "GD03-096",
    trigger: "Attack",
    duringLink: true,
    optional: true,
    condition: { predicate: "chosenNonEmpty:discard", then: [{ op: "draw", player: "controller", n: 1 }] },
    actions: [{ op: "discardNamed", player: "controller", name: "discard", n: 1 }],
    sourceText: "【During Link】【Attack】You may discard 1. If you do, draw 1.",
  },
  // GD03-100 Soma Peries
  {
    id: "GD03-100-Destroyed",
    cardCode: "GD03-100",
    trigger: "Destroyed",
    actions: [{ op: "modifyStat", stat: "ap", amount: -3, duration: "endOfTurn", target }],
    targetScope: "enemyUnit",
    sourceText: "【Destroyed】Choose 1 enemy Unit. It gets AP-3 during this turn.",
  },
  // GD03-103 Field Directive
  {
    id: "GD03-103-Main",
    cardCode: "GD03-103",
    trigger: "Main",
    condition: { predicate: "enemyUnitCountAtLeast:3", then: [{ op: "damageUnit", amount: 2, target }] },
    actions: [],
    targetScope: "enemyUnit",
    targetFilter: "rested",
    sourceText: "【Main】If 3 or more enemy Units are in play, choose 1 rested enemy Unit. Deal 2 damage to it.",
  },
  // GD03-106 M.A.V. Tactics
  {
    id: "GD03-106-Main",
    cardCode: "GD03-106",
    trigger: "Main",
    actions: [
      { op: "spawnToken", def: TOKEN_GQUUUUUUX_OMEGA, player: "controller", zone: "battleArea", rested: true },
      { op: "spawnToken", def: TOKEN_RED_GUNDAM, player: "controller", zone: "battleArea", rested: true },
    ],
    sourceText:
      "【Main】Deploy 1 rested [GQuuuuuuX (Omega Psycommu)]((Clan)·AP3·HP2) Unit token and 1 rested [Red Gundam]((Clan)·AP2·HP3) Unit token.",
  },
  // GD03-108 How Many Miles to the Battlefield?
  {
    id: "GD03-108-Main",
    cardCode: "GD03-108",
    trigger: "Main",
    actions: [{ op: "spawnToken", def: TOKEN_HY_GOGG, player: "controller", zone: "battleArea" }],
    sourceText: "【Main】Deploy 1 [Hy-Gogg]((Cyclops Team)·AP2·HP1) Unit token.",
  },
  // GD03-112 Warped Intent
  ...mainAndAction({
    cardCode: "GD03-112",
    actions: [
      {
        op: "modifyStat",
        stat: "ap",
        amount: 2,
        duration: "endOfTurn",
        target: { kind: "group", group: { kind: "allUnits", paired: true } },
      },
    ],
    sourceText: "【Main】/【Action】During this turn, all Units paired with a Pilot get AP+2.",
  }),
  // GD03-119 Awkward Approach
  {
    id: "GD03-119-Main",
    cardCode: "GD03-119",
    trigger: "Main",
    condition: {
      predicate: "chosenNonEmpty:target",
      then: [
        {
          op: "modifyStat",
          stat: "ap",
          amount: -1,
          duration: "endOfTurn",
          target: { kind: "group", group: { kind: "allEnemyUnits" } },
        },
      ],
    },
    actions: [{ op: "setActive", target }],
    targetScope: "friendlyBase",
    targetFilter: "rested",
    sourceText: "【Main】Choose 1 rested friendly Base. Set it as active. If you do, all enemy Units get AP-1 during this turn.",
  },
  // GD03-121 Unheralded Attack
  {
    id: "GD03-121-Action",
    cardCode: "GD03-121",
    trigger: "Action",
    actions: [
      { op: "rest", target },
      { op: "rest", target: { kind: "named", name: "enemyTarget" } },
    ],
    targetScope: "friendlyBase",
    secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit", targetFilter: "hp<=3" },
    sourceText: "【Action】Choose 1 friendly Base and 1 enemy Unit with 3 or less HP. Rest them.",
  },
  // GD03-122 Veteran Tactics
  {
    id: "GD03-122-Action",
    cardCode: "GD03-122",
    trigger: "Action",
    actions: [{ op: "moveZone", target, toZone: "hand" }],
    targetScope: "enemyUnit",
    targetFilter: "level<=3",
    sourceText: "【Action】Choose 1 enemy Unit that is Lv.3 or lower. Return it to its owner's hand.",
  },
];
