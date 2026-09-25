import type { EffectSpec } from "../../engine/effectSpec";
import type { CardDef } from "../../engine/types";
import { EX_RESOURCE_TOKEN } from "../../engine/setup";
import { stdAddToHandBurst, stdDeployThisBurst } from "../standardSpecs";

/**
 * Wave GD02 "Dual Impact" — Catálogo de EffectSpecs Oficiais.
 */

// GD02-014 Galbaldy Beta — 【Deploy】AP+1
export const GD02_014_GALBALDY_BETA_DEPLOY: EffectSpec = {
  id: "GD02-014-Deploy",
  cardCode: "GD02-014",
  trigger: "Deploy",
  actions: [
    { op: "modifyStat", stat: "ap", amount: 1, duration: "endOfTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  sourceText: "[Deploy] Choose 1 of your (Titans) Units. It gets AP+1 during this turn.",
};

// GD02-016 Barzam — 【Deploy】AP+1
export const GD02_016_BARZAM_DEPLOY: EffectSpec = {
  id: "GD02-016-Deploy",
  cardCode: "GD02-016",
  trigger: "Deploy",
  actions: [
    { op: "modifyStat", stat: "ap", amount: 1, duration: "endOfTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  sourceText: "[Deploy] Choose 1 of your (Titans) Units. It gets AP+1 during this turn.",
};

// GD02-020 Elmeth — 【Deploy】Look at top 5
export const GD02_020_ELMETH_DEPLOY: EffectSpec = {
  id: "GD02-020-Deploy",
  cardCode: "GD02-020",
  trigger: "Deploy",
  actions: [
    { op: "lookAtTopFilterReveal", player: "controller", count: 5, filter: { anyTrait: ["Zeon"] } },
  ],
  sourceText: "[Deploy] Look at the top 5 cards of your deck. You may reveal 1 green (Zeon) Pilot card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck. \n  \n[During Link] This unit gets AP+2.",
};

// GD02-020 Elmeth — 【During Link】AP+2
export const GD02_020_ELMETH_DURING_LINK: EffectSpec = {
  id: "GD02-020-DuringLink",
  cardCode: "GD02-020",
  trigger: "DuringLink",
  actions: [
    { op: "modifyStat", stat: "ap", amount: 2, duration: "endOfTurn", target: { kind: "self" } },
  ],
  sourceText: "[During Link] This unit gets AP+2.",
};

// GD02-023 Gundam AGE-1 Spallow — 【Main】gains <First Strike>
export const GD02_023_GUNDAM_AGE_1_SPALLOW_GRANT_FIRST_STRIKE: EffectSpec = {
  id: "GD02-023-Main-GrantFIRST_STRIKE",
  cardCode: "GD02-023",
  trigger: "Main",
  actions: [
    { op: "grantKeyword", keyword: "First Strike", duration: "endOfTurn", target: { kind: "self" } },
  ],
  sourceText: "[During Link] While you are Lv.7 or higher, this Unit gains <First Strike>. \n(While this Unit is attacking, it deals damage before the enemy Unit.)",
};

// GD02-026 Genoace Custom — 【Deploy】AP+2
export const GD02_026_GENOACE_CUSTOM_DEPLOY: EffectSpec = {
  id: "GD02-026-Deploy",
  cardCode: "GD02-026",
  trigger: "Deploy",
  actions: [
    { op: "modifyStat", stat: "ap", amount: 2, duration: "endOfTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  sourceText: "[Deploy] If you are Lv.7 or higher, choose 1 of your (AGE System) Units. It gets AP+2 during this turn.",
};

// GD02-031 Gundam AGE-1 Titus — 【Main】AP+2
export const GD02_031_GUNDAM_AGE_1_TITUS_MAIN: EffectSpec = {
  id: "GD02-031-Main",
  cardCode: "GD02-031",
  trigger: "Main",
  actions: [
    { op: "modifyStat", stat: "ap", amount: 2, duration: "endOfTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  sourceText: "While you are Lv.7 or higher, this Unit gets AP+2.",
};

// GD02-033 Kikeroga (MA Mode) (GQ) — 【Main】gains <Breach 5>
export const GD02_033_KIKEROGA_MA_MODE_GQ_GRANT_BREACH_5: EffectSpec = {
  id: "GD02-033-Main-GrantBREACH_5",
  cardCode: "GD02-033",
  trigger: "Main",
  actions: [
    { op: "grantKeyword", keyword: "Breach 5", duration: "endOfTurn", target: { kind: "self" } },
  ],
  sourceText: "While another friendly (Zeon) Link Unit is in play, this Unit gains <Breach 5>. \n(When this Unit's attack destroys an enemy Unit, deal the specified amount of damage to the first card in that opponent's shield area.)",
};

// GD02-034 GQuuuuuuX — 【Main】AP+2
export const GD02_034_GQUUUUUUX_MAIN: EffectSpec = {
  id: "GD02-034-Main",
  cardCode: "GD02-034",
  trigger: "Main",
  actions: [
    { op: "modifyStat", stat: "ap", amount: 2, duration: "endOfTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  sourceText: "[During Pair: Red Pilot] This Unit gets AP+2.",
};

// GD02-036 Qubeley — 【When Linked】gains <Suppression>
export const GD02_036_QUBELEY_GRANT_SUPPRESSION: EffectSpec = {
  id: "GD02-036-When Linked-GrantSUPPRESSION",
  cardCode: "GD02-036",
  trigger: "When Linked",
  actions: [
    { op: "grantKeyword", keyword: "Suppression", duration: "endOfTurn", target: { kind: "self" } },
  ],
  sourceText: "[When Linked] This Unit gains <Suppression> during this turn. \n(Damage to Shields by an attack is dealt to the first 2 cards simultaneously.) \n[During Pair: (Neo Zeon) Pilot] [Attack] Choose 1 damaged enemy Unit. Deal 2 damage to it.",
};

// GD02-038 GQuuuuuuX (Omega Psycommu) — 【Deploy】Look at top 3
export const GD02_038_GQUUUUUUX_OMEGA_PSYCOMMU_DEPLOY: EffectSpec = {
  id: "GD02-038-Deploy",
  cardCode: "GD02-038",
  trigger: "Deploy",
  actions: [
    { op: "lookAtTopFilterReveal", player: "controller", count: 3, filter: { anyTrait: ["Clan"] } },
  ],
  sourceText: "[Deploy] Look at the top 3 cards of your deck. You may deploy 1 (Clan) Unit card that is Lv.4 or lower among them. Return the remaining cards randomly to the bottom of your deck.",
};

// GD02-058 Ryusei-Go (Graze Custom II) — 【Deploy】Draw 1, discard 1
export const GD02_058_RYUSEI_GO_GRAZE_CUSTOM_II_DEPLOY: EffectSpec = {
  id: "GD02-058-Deploy",
  cardCode: "GD02-058",
  trigger: "Deploy",
  actions: [
    { op: "draw", player: "controller", n: 1 },
    { op: "discardNamed", player: "controller", name: "discard", n: 1 },
  ],
  sourceText: "[Deploy] Choose 1 of your Units. Deal 1 damage to it. If you do, draw 1. Then, discard 1.",
};

// GD02-068 Gundam Barbatos 3rd Form — 【Deploy】Deal 2 damage
export const GD02_068_GUNDAM_BARBATOS_3RD_FORM_DEPLOY: EffectSpec = {
  id: "GD02-068-Deploy",
  cardCode: "GD02-068",
  trigger: "Deploy",
  actions: [{ op: "damageUnit", amount: 2, target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  sourceText: "[Deploy] Deal 2 damage to this Unit.",
};

// GD02-073 Carta's Graze Ritter (Ground Type) — 【Main】gains <First Strike>
export const GD02_073_CARTA_S_GRAZE_RITTER_GROUND_TYPE_GRANT_FIRST_STRIKE: EffectSpec = {
  id: "GD02-073-Main-GrantFIRST_STRIKE",
  cardCode: "GD02-073",
  trigger: "Main",
  actions: [
    { op: "grantKeyword", keyword: "First Strike", duration: "endOfTurn", target: { kind: "self" } },
  ],
  sourceText: "During your opponent's turn, the enemy Unit battling this Unit gains <First Strike>. \n(While this Unit is attacking, it deals damage before the enemy Unit.)",
};

// GD02-082 Gaelio's Schwalbe Graze — 【Main】gains <Blocker>
export const GD02_082_GAELIO_S_SCHWALBE_GRAZE_GRANT_BLOCKER: EffectSpec = {
  id: "GD02-082-Main-GrantBLOCKER",
  cardCode: "GD02-082",
  trigger: "Main",
  actions: [
    { op: "grantKeyword", keyword: "Blocker", duration: "endOfTurn", target: { kind: "self" } },
  ],
  sourceText: "While you have another (Gjallarhorn) Unit in play, this Unit gains <Blocker>. \n(Rest this Unit to change the attack target to it.)",
};

// GD02-086 Jerid Messa — 【Main】AP+1
export const GD02_086_JERID_MESSA_MAIN: EffectSpec = {
  id: "GD02-086-Main",
  cardCode: "GD02-086",
  trigger: "Main",
  actions: [
    { op: "modifyStat", stat: "ap", amount: 1, duration: "endOfTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  sourceText: "[Burst] Add this card to your hand. \nWhile you have another (Titans) Unit in play, this gets AP+1.",
};

// GD02-088 Flit Asuno — 【When Linked】Look at top 3
export const GD02_088_FLIT_ASUNO_WHEN_LINKED: EffectSpec = {
  id: "GD02-088-When Linked",
  cardCode: "GD02-088",
  trigger: "When Linked",
  actions: [
    { op: "lookAtTopFilterReveal", player: "controller", count: 3, filter: { anyTrait: ["Earth Federation"] } },
  ],
  sourceText: "[Burst] Add this card to your hand. \n  \n[When Linked] Look at the top 3 cards of your deck. You may reveal 1 green (Earth Federation) Unit card/1 card with \"AGE Device\" in its card name among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
};

// GD02-090 Challia Bull (GQ) — 【Main】AP+1
export const GD02_090_CHALLIA_BULL_GQ_MAIN: EffectSpec = {
  id: "GD02-090-Main",
  cardCode: "GD02-090",
  trigger: "Main",
  actions: [
    { op: "modifyStat", stat: "ap", amount: 1, duration: "endOfTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  sourceText: "[Burst] Add this card to your hand.\n While you have another Unit with [High-Maneuver] in play, this Unit gets AP+1.",
};

// GD02-092 Shagia Frost — 【Attack】AP+2
export const GD02_092_SHAGIA_FROST_ATTACK: EffectSpec = {
  id: "GD02-092-Attack",
  cardCode: "GD02-092",
  trigger: "Attack",
  actions: [
    { op: "modifyStat", stat: "ap", amount: 2, duration: "endOfTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  sourceText: "[Burst] Add this card to your hand. \n[During Link] [Attack] Choose 1 of your (New UNE) Units. It gets AP+2 during this turn.",
};

// GD02-094 Garrod Ran & Tiffa Adill — 【When Paired】Look at top 3
export const GD02_094_GARROD_RAN_TIFFA_ADILL_WHEN_PAIRED: EffectSpec = {
  id: "GD02-094-When Paired",
  cardCode: "GD02-094",
  trigger: "When Paired",
  actions: [
    { op: "lookAtTopFilterReveal", player: "controller", count: 3, filter: { anyTrait: ["Vulture"] } },
  ],
  sourceText: "[Burst] Add this card to your hand.\n [When Paired] You may discard 1. If you do, look at the top 3 cards of your deck. You may reveal 1 (Vulture) Unit card among them and add it to your hand. Return the remaining cards randomly to the bottom of your deck.",
};

// GD02-097 Kamille Bidan — 【Main】AP+2
export const GD02_097_KAMILLE_BIDAN_MAIN: EffectSpec = {
  id: "GD02-097-Main",
  cardCode: "GD02-097",
  trigger: "Main",
  actions: [
    { op: "modifyStat", stat: "ap", amount: 2, duration: "endOfTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  sourceText: "[Burst] Add this card to your hand. \n  \nWhile there is a friendly white Base in play, this Unit gets AP+2.",
};

// GD02-102 Mouar's Determination — 【Action】AP+2
export const GD02_102_MOUAR_S_DETERMINATION_ACTION: EffectSpec = {
  id: "GD02-102-Action",
  cardCode: "GD02-102",
  trigger: "Action",
  actions: [
    { op: "modifyStat", stat: "ap", amount: 2, duration: "endOfTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  sourceText: "[Main] / [Action] Choose 1 friendly (Titans) Unit. It gets AP+2 during this turn. \n[Pilot] [Mouar Pharaoh]",
};

// GD02-104 Turning Point of History — 【Main】Look at top 3
export const GD02_104_TURNING_POINT_OF_HISTORY_MAIN: EffectSpec = {
  id: "GD02-104-Main",
  cardCode: "GD02-104",
  trigger: "Main",
  actions: [
    { op: "lookAtTopFilterReveal", player: "controller", count: 3, filter: {} },
  ],
  sourceText: "[Main] Look at the top 3 cards of your deck and return 1 to the top. Return the remaining cards to the bottom of your deck. Then, if you have a (Newtype) Pilot in play, draw 1.",
};

// GD02-114 It's Name is Ryusei-Go — 【Action】AP+2
export const GD02_114_IT_S_NAME_IS_RYUSEI_GO_ACTION: EffectSpec = {
  id: "GD02-114-Action",
  cardCode: "GD02-114",
  trigger: "Action",
  actions: [
    { op: "modifyStat", stat: "ap", amount: 2, duration: "endOfTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  sourceText: "[Main] / [Action] Choose 1 damaged friendly Unit. It gets AP+2 during this turn. \n[Pilot] [Norba Shino]",
};

// GD02-115 Familial Devotion — 【Action】AP+2
export const GD02_115_FAMILIAL_DEVOTION_ACTION: EffectSpec = {
  id: "GD02-115-Action",
  cardCode: "GD02-115",
  trigger: "Action",
  actions: [
    { op: "modifyStat", stat: "ap", amount: 2, duration: "endOfTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  sourceText: "[Main] / [Action] Choose 1 friendly (Vulture) Unit. It gets AP+2 during this turn. \n[Pilot] [Witz Sou]",
};

// GD02-117 A New Sign — 【Burst】Draw 3, discard 2
export const GD02_117_A_NEW_SIGN_BURST: EffectSpec = {
  id: "GD02-117-Burst",
  cardCode: "GD02-117",
  trigger: "Burst",
  actions: [
    { op: "draw", player: "controller", n: 3 },
    { op: "discardNamed", player: "controller", name: "discard", n: 2 },
  ],
  sourceText: "[Burst] Choose 1 (AEUG) Base card from your trash. Add it to your hand. \n  \n[Main] Draw 3. Then, discard 2.",
};

// GD02-121 Dominion — 【Deploy】Add 1 of your Shields to your hand.
export const GD02_121_DOMINION_DEPLOY: EffectSpec = {
  id: "GD02-121-Deploy",
  cardCode: "GD02-121",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// GD02-122 Alexandria — 【Deploy】Add 1 of your Shields to your hand.
export const GD02_122_ALEXANDRIA_DEPLOY: EffectSpec = {
  id: "GD02-122-Deploy",
  cardCode: "GD02-122",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// GD02-123 Sodon — 【Deploy】Add 1 of your Shields to your hand.
export const GD02_123_SODON_DEPLOY: EffectSpec = {
  id: "GD02-123-Deploy",
  cardCode: "GD02-123",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// GD02-124 Diva — 【Deploy】Add 1 of your Shields to your hand.
export const GD02_124_DIVA_DEPLOY: EffectSpec = {
  id: "GD02-124-Deploy",
  cardCode: "GD02-124",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// GD02-125 Gwadan — 【Deploy】Add 1 of your Shields to your hand.
export const GD02_125_GWADAN_DEPLOY: EffectSpec = {
  id: "GD02-125-Deploy",
  cardCode: "GD02-125",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// GD02-126 Shuji's Hideout — 【Deploy】Add 1 of your Shields to your hand.
export const GD02_126_SHUJI_S_HIDEOUT_DEPLOY: EffectSpec = {
  id: "GD02-126-Deploy",
  cardCode: "GD02-126",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// GD02-127 Freeden — 【Deploy】Add 1 of your Shields to your hand.
export const GD02_127_FREEDEN_DEPLOY: EffectSpec = {
  id: "GD02-127-Deploy",
  cardCode: "GD02-127",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// GD02-128 Hammerhead — 【Deploy】Add 1 of your Shields to your hand.
export const GD02_128_HAMMERHEAD_DEPLOY: EffectSpec = {
  id: "GD02-128-Deploy",
  cardCode: "GD02-128",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// GD02-129 Argama — 【Deploy】Add 1 of your Shields to your hand.
export const GD02_129_ARGAMA_DEPLOY: EffectSpec = {
  id: "GD02-129-Deploy",
  cardCode: "GD02-129",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// GD02-130 Sleipnir — 【Deploy】Add 1 of your Shields to your hand.
export const GD02_130_SLEIPNIR_DEPLOY: EffectSpec = {
  id: "GD02-130-Deploy",
  cardCode: "GD02-130",
  trigger: "Deploy",
  actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
  sourceText: "【Deploy】Add 1 of your Shields to your hand.",
};

// ─────────────────────────────────────────────────────────────────────────
// Sprint 2 (docs/debates 2026-09-18) — 1º lote de fechamento do backlog de
// cobertura de GD02 (achado no P0-1: 69 cartas "faltando"). Todos os
// primitivos usados abaixo já existiam (mesmo padrão de GD01-039 Dopp pro
// `moveTopCardToChosenPosition`, ST01-009 Zowort pro `cannotTargetPlayer` —
// ver unitsBlue/Green/Purple.ts) -- pura autoria de EffectSpec, sem gap de
// motor novo.
// ─────────────────────────────────────────────────────────────────────────

// GD02-025 Gundam Heavyarms — 【Deploy】Look at the top card of your deck. Return
// it to the top or bottom of your deck. (mesmo texto de GD01-039 Dopp.)
export const GD02_025_GUNDAM_HEAVYARMS_DEPLOY: EffectSpec = {
  id: "GD02-025-Deploy",
  cardCode: "GD02-025",
  trigger: "Deploy",
  actions: [{ op: "moveTopCardToChosenPosition", player: "controller", optionsKey: "position" }],
  sourceText: "【Deploy】Look at the top card of your deck. Return it to the top or bottom of your deck.",
};

// GD02-039 Haman Karn's Gaza C — 【When Paired】Choose 1 enemy Unit that is Lv.3 or lower. Deal 1 damage to it.
export const GD02_039_HAMAN_KARN_S_GAZA_C_WHEN_PAIRED: EffectSpec = {
  id: "GD02-039-WhenPaired",
  cardCode: "GD02-039",
  trigger: "When Paired",
  actions: [{ op: "damageUnit", amount: 1, target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "level<=3",
  sourceText: "【When Paired】Choose 1 enemy Unit that is Lv.3 or lower. Deal 1 damage to it.",
};

// GD02-041 Sugai's Gelgoog (GQ) — 【Deploy】Choose 1 enemy Unit that is Lv.5 or higher. Deal 2 damage to it.
export const GD02_041_SUGAI_S_GELGOOG_GQ_DEPLOY: EffectSpec = {
  id: "GD02-041-Deploy",
  cardCode: "GD02-041",
  trigger: "Deploy",
  actions: [{ op: "damageUnit", amount: 2, target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "level>=5",
  sourceText: "【Deploy】Choose 1 enemy Unit that is Lv.5 or higher. Deal 2 damage to it.",
};

// GD02-008 Gabthley — 【When Linked】Choose 1 rested enemy Unit. Deal 1 damage to it.
export const GD02_008_GABTHLEY_WHEN_LINKED: EffectSpec = {
  id: "GD02-008-WhenLinked",
  cardCode: "GD02-008",
  trigger: "When Linked",
  actions: [{ op: "damageUnit", amount: 1, target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "rested",
  sourceText: "【When Linked】Choose 1 rested enemy Unit. Deal 1 damage to it.",
};

// GD02-045 GINN Long-Range Reconnaissance Type — 【Attack】If this Unit has 5 or more AP and it
// is attacking an enemy Unit, draw 1. (mesmo predicate composto de GD01-050 LaGOWE.)
export const GD02_045_GINN_LONG_RANGE_RECONNAISSANCE_TYPE_ATTACK: EffectSpec = {
  id: "GD02-045-Attack",
  cardCode: "GD02-045",
  trigger: "Attack",
  condition: {
    predicate: "selfApAtLeast:5;attackingEnemyUnit",
    then: [{ op: "draw", player: "controller", n: 1 }],
  },
  actions: [],
  sourceText: "【Attack】If this Unit has 5 or more AP and it is attacking an enemy Unit, draw 1.",
};

// GD02-060 Gundam Leopard — 【Deploy】If there are 7 or more cards in your trash, choose 1 enemy
// Unit that is Lv.4 or lower. Rest it.
export const GD02_060_GUNDAM_LEOPARD_DEPLOY: EffectSpec = {
  id: "GD02-060-Deploy",
  cardCode: "GD02-060",
  trigger: "Deploy",
  condition: {
    predicate: "controllerTrashCountAtLeast:7",
    then: [{ op: "rest", target: { kind: "named", name: "target" } }],
  },
  actions: [],
  targetScope: "enemyUnit",
  targetFilter: "level<=4",
  sourceText: "【Deploy】If there are 7 or more cards in your trash, choose 1 enemy Unit that is Lv.4 or lower. Rest it.",
};

// GD02-046 Sayla's Light-Type Guncannon — 【Deploy】Choose 1 enemy Unit token. Deal 2 damage to it.
export const GD02_046_SAYLA_S_LIGHT_TYPE_GUNCANNON_DEPLOY: EffectSpec = {
  id: "GD02-046-Deploy",
  cardCode: "GD02-046",
  trigger: "Deploy",
  actions: [{ op: "damageUnit", amount: 2, target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "isToken",
  sourceText: "【Deploy】Choose 1 enemy Unit token. Deal 2 damage to it.",
};
// GD02-054 Gundam Barbatos 1st Form — 【Attack】If this Unit is damaged, draw 1.
export const GD02_054_GUNDAM_BARBATOS_1ST_FORM_ATTACK: EffectSpec = {
  id: "GD02-054-Attack",
  cardCode: "GD02-054",
  trigger: "Attack",
  condition: {
    predicate: "selfIsDamaged",
    then: [{ op: "draw", player: "controller", n: 1 }],
  },
  actions: [],
  sourceText: "【Attack】If this Unit is damaged, draw 1.",
};

// GD02-070 Gundam Kimaris — 【Deploy】If there are 4 or more (Gjallarhorn) cards in your trash,
// draw 2. If you do, discard 2. (mesmo par draw+discardNamed de GD02-046 Burst / GD01 Lote 3.)
export const GD02_070_GUNDAM_KIMARIS_DEPLOY: EffectSpec = {
  id: "GD02-070-Deploy",
  cardCode: "GD02-070",
  trigger: "Deploy",
  condition: {
    predicate: "controllerTrashCardCountWithTraitAtLeast:Gjallarhorn:4",
    then: [
      { op: "draw", player: "controller", n: 2 },
      { op: "discardNamed", player: "controller", name: "discard", n: 2 },
    ],
  },
  actions: [],
  sourceText: "【Deploy】If there are 4 or more (Gjallarhorn) cards in your trash, draw 2. If you do, discard 2.",
};

// GD02-081 Methuss — 【Deploy】If a friendly white Base is in play, choose 1 enemy Unit. It gets
// AP-2 during this turn.
export const GD02_081_METHUSS_DEPLOY: EffectSpec = {
  id: "GD02-081-Deploy",
  cardCode: "GD02-081",
  trigger: "Deploy",
  condition: {
    predicate: "controllerHasBaseColor:white",
    then: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: -2, duration: "endOfTurn" }],
  },
  actions: [],
  targetScope: "enemyUnit",
  sourceText: "【Deploy】If a friendly white Base is in play, choose 1 enemy Unit. It gets AP-2 during this turn.",
};

// GD02-004 Byarlant — 【When Paired】Choose 1 rested enemy Unit with 3 or less HP. It won't be
// set as active during the start phase of your opponent's next turn.
export const GD02_004_BYARLANT_WHEN_PAIRED: EffectSpec = {
  id: "GD02-004-WhenPaired",
  cardCode: "GD02-004",
  trigger: "When Paired",
  actions: [
    { op: "rest", target: { kind: "named", name: "target" } },
    { op: "preventActivationNextTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "enemyUnit",
  targetFilter: "rested;hp<=3",
  sourceText: "【When Paired】Choose 1 rested enemy Unit with 3 or less HP. It won't be set as active during the start phase of your opponent's next turn.",
};

// GD02-061 Hyakuri — 【When Paired･Purple Pilot】If there are 3 or more (Teiwaz)/(Tekkadan)
// cards in your trash, choose 1 enemy Unit with 3 or less AP. Rest it.
export const GD02_061_HYAKURI_WHEN_PAIRED: EffectSpec = {
  id: "GD02-061-WhenPaired",
  cardCode: "GD02-061",
  trigger: "When Paired",
  condition: {
    predicate: "pairedPilotColorIs:purple;controllerTrashUnitCountWithAnyTraitAtLeast:Teiwaz,Tekkadan:3",
    then: [{ op: "rest", target: { kind: "named", name: "target" } }],
  },
  actions: [],
  targetScope: "enemyUnit",
  targetFilter: "ap<=3",
  sourceText: "【When Paired･Purple Pilot】If there are 3 or more (Teiwaz)/(Tekkadan) cards in your trash, choose 1 enemy Unit with 3 or less AP. Rest it.",
};

// GD02-089 Lalah Sune — 【Burst】Add this card to your hand.
export const GD02_089_LALAH_SUNE_BURST: EffectSpec = {
  id: "GD02-089-Burst",
  cardCode: "GD02-089",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};
// GD02-089 Lalah Sune — 【When Paired】Choose 1 of your other (Zeon) Link Units. It gains
// <Breach 1> during this turn.
export const GD02_089_LALAH_SUNE_WHEN_PAIRED: EffectSpec = {
  id: "GD02-089-WhenPaired",
  cardCode: "GD02-089",
  trigger: "When Paired",
  actions: [{ op: "grantKeyword", target: { kind: "named", name: "target" }, keyword: "Breach 1", duration: "endOfTurn" }],
  targetScope: "friendlyUnit",
  targetFilter: "trait:Zeon;linkUnit",
  sourceText: "【When Paired】Choose 1 of your other (Zeon) Link Units. It gains <Breach 1> during this turn.",
};

// GD02-091 Haman Karn — 【Burst】Add this card to your hand.
export const GD02_091_HAMAN_KARN_BURST: EffectSpec = {
  id: "GD02-091-Burst",
  cardCode: "GD02-091",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};
// GD02-091 Haman Karn — 【When Paired】If this Unit is red, choose 1 enemy Unit whose Lv. is
// equal to or lower than this Unit. Deal 1 damage to it. ("this Unit" = a Unit pareada.)
export const GD02_091_HAMAN_KARN_WHEN_PAIRED: EffectSpec = {
  id: "GD02-091-WhenPaired",
  cardCode: "GD02-091",
  trigger: "When Paired",
  condition: {
    predicate: "selfColorIs:red",
    then: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 }],
  },
  actions: [],
  targetScope: "enemyUnit",
  targetFilter: "level<=self",
  sourceText: "【When Paired】If this Unit is red, choose 1 enemy Unit whose Lv. is equal to or lower than this Unit. Deal 1 damage to it.",
};

// GD02-095 Lafter Frankland — 【Burst】Add this card to your hand.
export const GD02_095_LAFTER_FRANKLAND_BURST: EffectSpec = {
  id: "GD02-095-Burst",
  cardCode: "GD02-095",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};
// GD02-095 Lafter Frankland — 【Attack】If this Unit is damaged and Lv.5 or lower, it gains
// <High-Maneuver> during this battle. ("this Unit" = a Unit pareada.)
export const GD02_095_LAFTER_FRANKLAND_ATTACK: EffectSpec = {
  id: "GD02-095-Attack",
  cardCode: "GD02-095",
  trigger: "Attack",
  condition: {
    predicate: "selfIsDamaged;selfLevelAtMost:5",
    then: [{ op: "grantKeyword", target: { kind: "pairedUnit" }, keyword: "High-Maneuver", duration: "thisBattle" }],
  },
  actions: [],
  sourceText: "【Attack】If this Unit is damaged and Lv.5 or lower, it gains <High-Maneuver> during this battle.",
};

// GD02-099 Gaelio Bauduin — 【Burst】Add this card to your hand.
export const GD02_099_GAELIO_BAUDUIN_BURST: EffectSpec = {
  id: "GD02-099-Burst",
  cardCode: "GD02-099",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};
// GD02-099 Gaelio Bauduin — 【When Paired】If there are 4 or more (Gjallarhorn) cards in your
// trash, choose 1 enemy Unit. It gets AP-2 during this turn.
export const GD02_099_GAELIO_BAUDUIN_WHEN_PAIRED: EffectSpec = {
  id: "GD02-099-WhenPaired",
  cardCode: "GD02-099",
  trigger: "When Paired",
  condition: {
    predicate: "controllerTrashCardCountWithTraitAtLeast:Gjallarhorn:4",
    then: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: -2, duration: "endOfTurn" }],
  },
  actions: [],
  targetScope: "enemyUnit",
  sourceText: "【When Paired】If there are 4 or more (Gjallarhorn) cards in your trash, choose 1 enemy Unit. It gets AP-2 during this turn.",
};

// GD02-100 Dramatic Turnabout — 【Burst】Draw 1.
export const GD02_100_DRAMATIC_TURNABOUT_BURST: EffectSpec = {
  id: "GD02-100-Burst",
  cardCode: "GD02-100",
  trigger: "Burst",
  actions: [{ op: "draw", player: "controller", n: 1 }],
  sourceText: "【Burst】Draw 1.",
};
// GD02-100 Dramatic Turnabout — 【Main】Choose 1 friendly damaged Unit. It recovers 2 HP.
// Then, draw 1.
export const GD02_100_DRAMATIC_TURNABOUT_MAIN: EffectSpec = {
  id: "GD02-100-Main",
  cardCode: "GD02-100",
  trigger: "Main",
  actions: [
    { op: "heal", target: { kind: "named", name: "target" }, amount: 2 },
    { op: "draw", player: "controller", n: 1 },
  ],
  targetScope: "friendlyUnit",
  targetFilter: "damaged",
  sourceText: "【Main】Choose 1 friendly damaged Unit. It recovers 2 HP. Then, draw 1.",
};

// GD02-101 Beneath the Mask — 【Main】/【Action】Choose 1 to 2 enemy Units that are Lv.2 or
// lower. Rest them.
const BENEATH_THE_MASK_ACTIONS = [{ op: "rest" as const, target: { kind: "namedGroup" as const, name: "target" } }];
export const GD02_101_BENEATH_THE_MASK_MAIN: EffectSpec = {
  id: "GD02-101-Main",
  cardCode: "GD02-101",
  trigger: "Main",
  actions: BENEATH_THE_MASK_ACTIONS,
  targetScope: "enemyUnit",
  targetFilter: "level<=2",
  targetCount: { min: 1, max: 2 },
  sourceText: "【Main】/【Action】Choose 1 to 2 enemy Units that are Lv.2 or lower. Rest them.",
};
export const GD02_101_BENEATH_THE_MASK_ACTION: EffectSpec = {
  id: "GD02-101-Action",
  cardCode: "GD02-101",
  trigger: "Action",
  actions: BENEATH_THE_MASK_ACTIONS,
  targetScope: "enemyUnit",
  targetFilter: "level<=2",
  targetCount: { min: 1, max: 2 },
  sourceText: "【Main】/【Action】Choose 1 to 2 enemy Units that are Lv.2 or lower. Rest them.",
};

// GD02-103 AGE Device — 【Burst】Choose 1 (Asuno Family) Pilot card from your trash. Add it to
// your hand.
export const GD02_103_AGE_DEVICE_BURST: EffectSpec = {
  id: "GD02-103-Burst",
  cardCode: "GD02-103",
  trigger: "Burst",
  actions: [{ op: "searchTrashToHand", player: "controller", filter: { cardType: "PILOT", anyTrait: ["Asuno Family"] } }],
  sourceText: "【Burst】Choose 1 (Asuno Family) Pilot card from your trash. Add it to your hand.",
};
// GD02-103 AGE Device — 【Main】If you have an (AGE System) Unit in play, place 1 EX Resource.
export const GD02_103_AGE_DEVICE_MAIN: EffectSpec = {
  id: "GD02-103-Main",
  cardCode: "GD02-103",
  trigger: "Main",
  condition: {
    predicate: "controllerUnitWithTraitInPlay:AGE System",
    then: [{ op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea" }],
  },
  actions: [],
  sourceText: "【Main】If you have an (AGE System) Unit in play, place 1 EX Resource.",
};

// GD02-107 All-Range Attack — 【Burst】Choose 1 enemy Unit. Deal 1 damage to it.
export const GD02_107_ALL_RANGE_ATTACK_BURST: EffectSpec = {
  id: "GD02-107-Burst",
  cardCode: "GD02-107",
  trigger: "Burst",
  actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 }],
  targetScope: "enemyUnit",
  sourceText: "【Burst】Choose 1 enemy Unit. Deal 1 damage to it.",
};
// GD02-107 All-Range Attack — 【Main】Deal 1 damage to all enemy Units other than Link Units.
export const GD02_107_ALL_RANGE_ATTACK_MAIN: EffectSpec = {
  id: "GD02-107-Main",
  cardCode: "GD02-107",
  trigger: "Main",
  actions: [{ op: "damageUnit", target: { kind: "group", group: { kind: "allEnemyUnits", excludeLinkUnits: true } }, amount: 1 }],
  sourceText: "【Main】Deal 1 damage to all enemy Units other than Link Units.",
};

// GD02-108 That One Looks A Lot Stronger? — 【Main】Choose 1 friendly (Clan) Unit. During this
// turn, it may choose an active enemy Unit that is Lv.4 or lower as its attack target.
export const GD02_108_THAT_ONE_LOOKS_A_LOT_STRONGER_MAIN: EffectSpec = {
  id: "GD02-108-Main",
  cardCode: "GD02-108",
  trigger: "Main",
  actions: [{ op: "grantAttackTargetRelax", target: { kind: "named", name: "target" }, maxLevel: 4 }],
  targetScope: "friendlyUnit",
  targetFilter: "trait:Clan",
  sourceText: "【Main】Choose 1 friendly (Clan) Unit. During this turn, it may choose an active enemy Unit that is Lv.4 or lower as its attack target.",
};

// GD02-109 Undying Persistence — 【Main】/【Action】Choose 1 enemy Unit. Deal 1 damage to it.
const UNDYING_PERSISTENCE_ACTIONS = [{ op: "damageUnit" as const, target: { kind: "named" as const, name: "target" }, amount: 1 }];
export const GD02_109_UNDYING_PERSISTENCE_MAIN: EffectSpec = {
  id: "GD02-109-Main",
  cardCode: "GD02-109",
  trigger: "Main",
  actions: UNDYING_PERSISTENCE_ACTIONS,
  targetScope: "enemyUnit",
  sourceText: "【Main】/【Action】Choose 1 enemy Unit. Deal 1 damage to it.",
};
export const GD02_109_UNDYING_PERSISTENCE_ACTION: EffectSpec = {
  id: "GD02-109-Action",
  cardCode: "GD02-109",
  trigger: "Action",
  actions: UNDYING_PERSISTENCE_ACTIONS,
  targetScope: "enemyUnit",
  sourceText: "【Main】/【Action】Choose 1 enemy Unit. Deal 1 damage to it.",
};

// GD02-112 Momentary Respite — 【Burst】Draw 1.
export const GD02_112_MOMENTARY_RESPITE_BURST: EffectSpec = {
  id: "GD02-112-Burst",
  cardCode: "GD02-112",
  trigger: "Burst",
  actions: [{ op: "draw", player: "controller", n: 1 }],
  sourceText: "【Burst】Draw 1.",
};
// GD02-112 Momentary Respite — 【Main】Choose 1 purple Pilot card from your trash. Add it to
// your hand.
export const GD02_112_MOMENTARY_RESPITE_MAIN: EffectSpec = {
  id: "GD02-112-Main",
  cardCode: "GD02-112",
  trigger: "Main",
  actions: [{ op: "searchTrashToHand", player: "controller", filter: { cardType: "PILOT", color: "purple" } }],
  sourceText: "【Main】Choose 1 purple Pilot card from your trash. Add it to your hand.",
};

// GD02-113 Sisterly Care — 【Main】/【Action】If a friendly (Teiwaz) Link Unit is in play,
// choose 1 enemy Unit with 2 or less AP. Destroy it.
const SISTERLY_CARE_CONDITION = {
  predicate: "controllerHasLinkUnitWithTrait:Teiwaz",
  then: [{ op: "destroy" as const, target: { kind: "named" as const, name: "target" } }],
};
export const GD02_113_SISTERLY_CARE_MAIN: EffectSpec = {
  id: "GD02-113-Main",
  cardCode: "GD02-113",
  trigger: "Main",
  condition: SISTERLY_CARE_CONDITION,
  actions: [],
  targetScope: "enemyUnit",
  targetFilter: "ap<=2",
  sourceText: "【Main】/【Action】If a friendly (Teiwaz) Link Unit is in play, choose 1 enemy Unit with 2 or less AP. Destroy it.",
};
export const GD02_113_SISTERLY_CARE_ACTION: EffectSpec = {
  id: "GD02-113-Action",
  cardCode: "GD02-113",
  trigger: "Action",
  condition: SISTERLY_CARE_CONDITION,
  actions: [],
  targetScope: "enemyUnit",
  targetFilter: "ap<=2",
  sourceText: "【Main】/【Action】If a friendly (Teiwaz) Link Unit is in play, choose 1 enemy Unit with 2 or less AP. Destroy it.",
};

// GD02-116 Comrades Come First — 【Main】If there are 7 or more cards in your trash, choose 1
// friendly (Vulture) Unit. During this turn, it may choose an active enemy Unit that is Lv.4
// or lower as its attack target.
export const GD02_116_COMRADES_COME_FIRST_MAIN: EffectSpec = {
  id: "GD02-116-Main",
  cardCode: "GD02-116",
  trigger: "Main",
  condition: {
    predicate: "controllerTrashCountAtLeast:7",
    then: [{ op: "grantAttackTargetRelax", target: { kind: "named", name: "target" }, maxLevel: 4 }],
  },
  actions: [],
  targetScope: "friendlyUnit",
  targetFilter: "trait:Vulture",
  sourceText: "【Main】If there are 7 or more cards in your trash, choose 1 friendly (Vulture) Unit. During this turn, it may choose an active enemy Unit that is Lv.4 or lower as its attack target.",
};

// GD02-119 Persistent and Fortudinous — 【Action】If you have a (Gjallarhorn) Link Unit in
// play, choose 1 enemy Unit. It gets AP-3 during this battle.
export const GD02_119_PERSISTENT_AND_FORTUDINOUS_ACTION: EffectSpec = {
  id: "GD02-119-Action",
  cardCode: "GD02-119",
  trigger: "Action",
  condition: {
    predicate: "controllerHasLinkUnitWithTrait:Gjallarhorn",
    then: [{ op: "modifyStat", target: { kind: "named", name: "target" }, stat: "ap", amount: -3, duration: "thisBattle" }],
  },
  actions: [],
  targetScope: "enemyUnit",
  sourceText: "【Action】If you have a (Gjallarhorn) Link Unit in play, choose 1 enemy Unit. It gets AP-3 during this battle.",
};

// T-012 Daughtress — token [Daughtress]((New UNE)・AP0・HP1) gerado por GD02-043/044.
export const TOKEN_DAUGHTRESS: CardDef = {
  code: "T-012",
  nameEn: "Daughtress",
  cardType: "UNIT",
  color: "red",
  ap: 0,
  hp: 1,
  traits: ["New UNE"],
  isToken: true,
};

// GD02-005 Tallgeese — 【During Link】【Attack】Choose 1 enemy Unit with 2 or less HP. Rest it.
export const GD02_005_TALLGEESE_ATTACK: EffectSpec = {
  id: "GD02-005-Attack",
  cardCode: "GD02-005",
  trigger: "Attack",
  condition: {
    predicate: "selfIsLinkUnit",
    then: [{ op: "rest", target: { kind: "named", name: "target" } }],
  },
  actions: [],
  targetScope: "enemyUnit",
  targetFilter: "hp<=2",
  sourceText: "【During Link】【Attack】Choose 1 enemy Unit with 2 or less HP. Rest it.",
};

// GD02-037 Gundam Virsago — 【Deploy】If there are 3 or less enemy Shields, choose 1 enemy Unit
// with 5 or less AP. Deal 2 damage to it.
export const GD02_037_GUNDAM_VIRSAGO_DEPLOY: EffectSpec = {
  id: "GD02-037-Deploy",
  cardCode: "GD02-037",
  trigger: "Deploy",
  condition: {
    predicate: "enemyShieldCountAtMost:3",
    then: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 2 }],
  },
  actions: [],
  targetScope: "enemyUnit",
  targetFilter: "ap<=5",
  sourceText: "【Deploy】If there are 3 or less enemy Shields, choose 1 enemy Unit with 5 or less AP. Deal 2 damage to it.",
};

// GD02-042 Gundam Ashtaron (MA Mode) — 【Deploy】Choose 1 of your (New UNE) Units. It gains
// <High-Maneuver> during this turn.
export const GD02_042_GUNDAM_ASHTARON_MA_MODE_DEPLOY: EffectSpec = {
  id: "GD02-042-Deploy",
  cardCode: "GD02-042",
  trigger: "Deploy",
  actions: [{ op: "grantKeyword", target: { kind: "named", name: "target" }, keyword: "High-Maneuver", duration: "endOfTurn" }],
  targetScope: "friendlyUnit",
  targetFilter: "trait:New UNE",
  sourceText: "【Deploy】Choose 1 of your (New UNE) Units. It gains <High-Maneuver> during this turn.",
};

// GD02-043 Daughtress Weapon — 【Deploy】If you have another (New UNE) Unit in play, deploy 1
// rested [Daughtress]((New UNE)・AP0・HP1) Unit token.
export const GD02_043_DAUGHTRESS_WEAPON_DEPLOY: EffectSpec = {
  id: "GD02-043-Deploy",
  cardCode: "GD02-043",
  trigger: "Deploy",
  condition: {
    predicate: "controllerOtherUnitCountWithAnyTraitAtLeast:New UNE:1",
    then: [{ op: "spawnToken", def: TOKEN_DAUGHTRESS, player: "controller", zone: "battleArea", rested: true }],
  },
  actions: [],
  sourceText: "【Deploy】If you have another (New UNE) Unit in play, deploy 1 rested [Daughtress]((New UNE)・AP0・HP1) Unit token.",
};

// GD02-044 Daughtress Command — 【Destroyed】If you have another (New UNE) Unit in play, deploy
// 1 rested [Daughtress]((New UNE)・AP0・HP1) Unit token.
export const GD02_044_DAUGHTRESS_COMMAND_DESTROYED: EffectSpec = {
  id: "GD02-044-Destroyed",
  cardCode: "GD02-044",
  trigger: "Destroyed",
  condition: {
    predicate: "controllerOtherUnitCountWithAnyTraitAtLeast:New UNE:1",
    then: [{ op: "spawnToken", def: TOKEN_DAUGHTRESS, player: "controller", zone: "battleArea", rested: true }],
  },
  actions: [],
  sourceText: "【Destroyed】If you have another (New UNE) Unit in play, deploy 1 rested [Daughtress]((New UNE)・AP0・HP1) Unit token.",
};

// GD02-055 Gundam Gusion Rebake — 【Deploy】Choose 1 of your Units and 1 enemy Unit. Deal 1
// damage to them.
export const GD02_055_GUNDAM_GUSION_REBAKE_DEPLOY: EffectSpec = {
  id: "GD02-055-Deploy",
  cardCode: "GD02-055",
  trigger: "Deploy",
  actions: [
    { op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 },
    { op: "damageUnit", target: { kind: "named", name: "enemyTarget" }, amount: 1 },
  ],
  targetScope: "friendlyUnit",
  secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit" },
  sourceText: "【Deploy】Choose 1 of your Units and 1 enemy Unit. Deal 1 damage to them.",
};

// GD02-083 Graze Ritter (Ground Type) — 【Destroyed】If it is your opponent's turn, choose 1 of
// your (Gjallarhorn) Units. Set it as active.
export const GD02_083_GRAZE_RITTER_GROUND_TYPE_DESTROYED: EffectSpec = {
  id: "GD02-083-Destroyed",
  cardCode: "GD02-083",
  trigger: "Destroyed",
  condition: {
    predicate: "isOpponentTurn",
    then: [{ op: "setActive", target: { kind: "named", name: "target" } }],
  },
  actions: [],
  targetScope: "friendlyUnit",
  targetFilter: "trait:Gjallarhorn",
  sourceText: "【Destroyed】If it is your opponent's turn, choose 1 of your (Gjallarhorn) Units. Set it as active.",
};

// GD02-087 Orga, Crot, and Shani — 【Burst】Add this card to your hand.
export const GD02_087_ORGA_CROT_AND_SHANI_BURST: EffectSpec = {
  id: "GD02-087-Burst",
  cardCode: "GD02-087",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};
// GD02-087 Orga, Crot, and Shani — 【When Linked】If this is a blue Unit, choose 1 enemy Unit
// with <Blocker>. Rest it. ("this" = a Unit pareada/Link.)
export const GD02_087_ORGA_CROT_AND_SHANI_WHEN_LINKED: EffectSpec = {
  id: "GD02-087-WhenLinked",
  cardCode: "GD02-087",
  trigger: "When Linked",
  condition: {
    predicate: "selfColorIs:blue",
    then: [{ op: "rest", target: { kind: "named", name: "target" } }],
  },
  actions: [],
  targetScope: "enemyUnit",
  targetFilter: "hasKeyword:Blocker",
  sourceText: "【When Linked】If this is a blue Unit, choose 1 enemy Unit with <Blocker>. Rest it.",
};

// GD02-106 White Wolf — 【Action】During this battle, your shield area cards can't receive
// damage from enemy Units that are Lv.3 or lower.
export const GD02_106_WHITE_WOLF_ACTION: EffectSpec = {
  id: "GD02-106-Action",
  cardCode: "GD02-106",
  trigger: "Action",
  actions: [{ op: "preventShieldDamage", maxAttackerLevel: 3 }],
  sourceText: "【Action】During this battle, your shield area cards can't receive damage from enemy Units that are Lv.3 or lower.",
};

// GD02-075 Rick Dias (Red) — 【Attack】Choose 1 active friendly Base. Rest it. If you do, choose
// 1 enemy Unit that is Lv.4 or lower. It gets AP-2 during this battle.
export const GD02_075_RICK_DIAS_RED_ATTACK: EffectSpec = {
  id: "GD02-075-Attack",
  cardCode: "GD02-075",
  trigger: "Attack",
  condition: {
    predicate: "chosenNonEmpty:target",
    then: [{ op: "modifyStat", target: { kind: "named", name: "enemyTarget" }, stat: "ap", amount: -2, duration: "thisBattle" }],
  },
  actions: [{ op: "rest", target: { kind: "named", name: "target" } }],
  targetScope: "friendlyBase",
  targetFilter: "active",
  secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit", targetFilter: "level<=4" },
  sourceText: "【Attack】Choose 1 active friendly Base. Rest it. If you do, choose 1 enemy Unit that is Lv.4 or lower. It gets AP-2 during this battle.",
};

// GD02-069 Zeta Gundam — 【During Link】【Activate･Main】【Once per Turn】Choose 1 active friendly
// Base. Rest it. If you do, set this Unit as active. It can't choose the enemy player as its
// attack target during this turn.
export const GD02_069_ZETA_GUNDAM_ACTIVATE_MAIN: EffectSpec = {
  id: "GD02-069-ActivateMain",
  cardCode: "GD02-069",
  trigger: "Activate·Main",
  condition: {
    predicate: "selfIsLinkUnit;chosenNonEmpty:target",
    then: [
      { op: "rest", target: { kind: "named", name: "target" } },
      { op: "setActive", target: { kind: "self" } },
      { op: "grantKeyword", target: { kind: "self" }, keyword: "CannotTargetPlayer", duration: "endOfTurn" },
    ],
  },
  actions: [],
  targetScope: "friendlyBase",
  targetFilter: "active",
  sourceText: "【During Link】【Activate･Main】【Once per Turn】Choose 1 active friendly Base. Rest it. If you do, set this Unit as active. It can't choose the enemy player as its attack target during this turn.",
};

// GD02-047 Gaza C — 【Activate･Main】Rest this Unit：Destroy this and choose 1 enemy Unit that
// is Lv.5 or lower. Deal 1 damage to it.
export const GD02_047_GAZA_C_ACTIVATE_MAIN: EffectSpec = {
  id: "GD02-047-ActivateMain",
  cardCode: "GD02-047",
  trigger: "Activate·Main",
  actions: [
    { op: "rest", target: { kind: "self" } },
    { op: "destroy", target: { kind: "self" } },
    { op: "damageUnit", target: { kind: "named", name: "target" }, amount: 1 },
  ],
  targetScope: "enemyUnit",
  targetFilter: "level<=5",
  sourceText: "【Activate･Main】Rest this Unit：Destroy this and choose 1 enemy Unit that is Lv.5 or lower. Deal 1 damage to it.",
};

// GD02-105 Valedictorian — 【Action】Choose 1 of your Unit tokens. It can't receive battle
// damage from enemy Units during this battle.
export const GD02_105_VALEDICTORIAN_ACTION: EffectSpec = {
  id: "GD02-105-Action",
  cardCode: "GD02-105",
  trigger: "Action",
  actions: [{ op: "preventUnitBattleDamage", target: { kind: "named", name: "target" }, unconditional: true }],
  targetScope: "friendlyUnit",
  targetFilter: "isToken",
  sourceText: "【Action】Choose 1 of your Unit tokens. It can't receive battle damage from enemy Units during this battle.",
};

// GD02-120 Aspiring Pilot — 【Action】Choose 1 of your (AEUG) Units/Bases. It recovers 2 HP.
export const GD02_120_ASPIRING_PILOT_ACTION: EffectSpec = {
  id: "GD02-120-Action",
  cardCode: "GD02-120",
  trigger: "Action",
  actions: [{ op: "heal", target: { kind: "named", name: "target" }, amount: 2 }],
  targetScope: "friendlyUnitOrBase",
  targetFilter: "trait:AEUG",
  sourceText: "【Action】Choose 1 of your (AEUG) Units/Bases. It recovers 2 HP.",
};

// GD02-056 Gundam X — 【During Pair･(Vulture) Pilot】【Destroyed】Choose 1 (Vulture) Unit card
// that is Lv.5 or higher from your trash. Add it to your hand.
export const GD02_056_GUNDAM_X_DESTROYED: EffectSpec = {
  id: "GD02-056-Destroyed",
  cardCode: "GD02-056",
  trigger: "Destroyed",
  duringPair: true,
  condition: {
    predicate: "formerPairedPilotHasTrait:Vulture",
    then: [{ op: "searchTrashToHand", player: "controller", filter: { cardType: "UNIT", anyTrait: ["Vulture"], minLevel: 5 } }],
  },
  actions: [],
  sourceText: "【During Pair･(Vulture) Pilot】【Destroyed】Choose 1 (Vulture) Unit card that is Lv.5 or higher from your trash. Add it to your hand.",
};

// GD02-040 Gundam Ashtaron — 【Deploy】Choose 1 of your other (New UNE) Units. It can't receive
// battle damage from enemy Units with 2 or less HP during this turn.
export const GD02_040_GUNDAM_ASHTARON_DEPLOY: EffectSpec = {
  id: "GD02-040-Deploy",
  cardCode: "GD02-040",
  trigger: "Deploy",
  actions: [{ op: "grantBattleDamageImmunityUntilTurn", target: { kind: "named", name: "target" }, maxAttackerHp: 2 }],
  targetScope: "friendlyUnit",
  targetFilter: "trait:New UNE;isNotSelf",
  sourceText: "【Deploy】Choose 1 of your other (New UNE) Units. It can't receive battle damage from enemy Units with 2 or less HP during this turn.",
};

// GD02-118 Heart Set on Revenge — 【Action】Choose 1 enemy Unit with 4 or less HP battling a
// friendly Unit with <Blocker>. Return it to its owner's hand.
export const GD02_118_HEART_SET_ON_REVENGE_ACTION: EffectSpec = {
  id: "GD02-118-Action",
  cardCode: "GD02-118",
  trigger: "Action",
  actions: [{ op: "moveZone", target: { kind: "named", name: "target" }, toZone: "hand" }],
  targetScope: "enemyUnit",
  targetFilter: "hp<=4;battlingFriendlyHasKeyword:Blocker",
  sourceText: "【Action】Choose 1 enemy Unit with 4 or less HP battling a friendly Unit with <Blocker>. Return it to its owner's hand.",
};

// GD02-093 Olba Frost — 【Burst】Add this card to your hand.
export const GD02_093_OLBA_FROST_BURST: EffectSpec = {
  id: "GD02-093-Burst",
  cardCode: "GD02-093",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// GD02-021 Gundam AGE-1 Normal — 【Deploy】You may discard 1 green (Earth Federation) Unit
// card. If you do, place 1 EX Resource. Then, if you are Lv.7 or higher, draw 1.
export const GD02_021_GUNDAM_AGE_1_NORMAL_DEPLOY: EffectSpec = {
  id: "GD02-021-Deploy",
  cardCode: "GD02-021",
  trigger: "Deploy",
  condition: {
    predicate: "chosenNonEmpty:discard",
    then: [{ op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea" }],
  },
  condition2: {
    predicate: "controllerLevelAtLeast:7",
    then: [{ op: "draw", player: "controller", n: 1 }],
  },
  actions: [{ op: "discardNamed", player: "controller", name: "discard", n: 1, filter: { cardType: "UNIT", color: "green", anyTrait: ["Earth Federation"] } }],
  sourceText: "【Deploy】You may discard 1 green (Earth Federation) Unit card. If you do, place 1 EX Resource. Then, if you are Lv.7 or higher, draw 1.",
};

// GD02-085 Four Murasame — 【Burst】Add this card to your hand.
export const GD02_085_FOUR_MURASAME_BURST: EffectSpec = {
  id: "GD02-085-Burst",
  cardCode: "GD02-085",
  trigger: "Burst",
  actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
  sourceText: "【Burst】Add this card to your hand.",
};

// GD02-071 Gundam Mk-II (AEUG) — 【Deploy】If a friendly white Base is in play, you may pair 1
// (AEUG) Pilot card from your hand with this Unit.
export const GD02_071_GUNDAM_MK_II_AEUG_DEPLOY: EffectSpec = {
  id: "GD02-071-Deploy",
  cardCode: "GD02-071",
  trigger: "Deploy",
  condition: {
    predicate: "controllerHasBaseColor:white",
    then: [{ op: "pairFromHandSearch", player: "controller", filter: { cardType: "PILOT", anyTrait: ["AEUG"] } }],
  },
  actions: [],
  sourceText: "【Deploy】If a friendly white Base is in play, you may pair 1 (AEUG) Pilot card from your hand with this Unit.",
};

// GD02-003 Gundam Mk-II (Titans) — 【During Pair･Lv.3 or Lower Pilot】【Destroyed】You may discard
// 1 Unit card. If you do, return the card paired with this Unit to your hand.
export const GD02_003_GUNDAM_MK_II_TITANS_DESTROYED: EffectSpec = {
  id: "GD02-003-Destroyed",
  cardCode: "GD02-003",
  trigger: "Destroyed",
  duringPair: true,
  condition: {
    predicate: "formerPairedPilotLevelAtMostAndChosenNonEmpty:3:discard",
    then: [{ op: "moveZone", target: { kind: "named", name: "formerPairedPilot" }, toZone: "hand" }],
  },
  actions: [{ op: "discardNamed", player: "controller", name: "discard", n: 1, filter: { cardType: "UNIT" } }],
  sourceText: "【During Pair･Lv.3 or Lower Pilot】【Destroyed】You may discard 1 Unit card. If you do, return the card paired with this Unit to your hand.",
};

// GD02-057 Zedas — 【During Pair】【Attack】You may choose 1 of your other Units. Destroy it. If
// you do, choose 1 enemy Unit that is Lv.4 or lower. Deal 2 damage to it.
export const GD02_057_ZEDAS_ATTACK: EffectSpec = {
  id: "GD02-057-Attack",
  cardCode: "GD02-057",
  trigger: "Attack",
  duringPair: true,
  optional: true,
  condition: {
    predicate: "chosenNonEmpty:target",
    then: [{ op: "damageUnit", target: { kind: "named", name: "enemyTarget" }, amount: 2 }],
  },
  actions: [{ op: "destroy", target: { kind: "namedGroup", name: "target" } }],
  targetScope: "friendlyUnit",
  targetFilter: "notSelf",
  secondaryTarget: { name: "enemyTarget", targetScope: "enemyUnit", targetFilter: "level<=4" },
  sourceText: "【During Pair】【Attack】You may choose 1 of your other Units. Destroy it. If you do, choose 1 enemy Unit that is Lv.4 or lower. Deal 2 damage to it.",
};

// GD02-098 Quattro Bajeena — This card's name is also treated as [Char Aznable].
// 【When Linked】If this is an (AEUG) Unit, draw 1. If you do, discard 1.
export const GD02_098_QUATTRO_BAJEENA_WHEN_LINKED: EffectSpec = {
  id: "GD02-098-WhenLinked",
  cardCode: "GD02-098",
  trigger: "When Linked",
  condition: {
    predicate: "selfHasTrait:AEUG",
    then: [
      { op: "draw", player: "controller", n: 1 },
      { op: "discardNamed", player: "controller", name: "discard", n: 1 },
    ],
  },
  actions: [],
  sourceText:
    "This card's name is also treated as [Char Aznable].\n\n【Burst】Add this card to your hand.\n【When Linked】If this is an (AEUG) Unit, draw 1. If you do, discard 1.",
};

// GD02-111 Decisive Last Resort — 【Burst】Choose 1 enemy Unit that is Lv.3 or lower. Deal 2
// damage to it.
export const GD02_111_DECISIVE_LAST_RESORT_BURST: EffectSpec = {
  id: "GD02-111-Burst",
  cardCode: "GD02-111",
  trigger: "Burst",
  actions: [{ op: "damageUnit", target: { kind: "named", name: "target" }, amount: 2 }],
  targetScope: "enemyUnit",
  targetFilter: "level<=3",
  sourceText: "【Burst】Choose 1 enemy Unit that is Lv.3 or lower. Deal 2 damage to it.",
};

// GD02-111 Decisive Last Resort — 【Main】Choose 6 purple Unit cards from your trash. Exile them
// from the game. If you do, choose 1 enemy Unit. Destroy it.
export const GD02_111_DECISIVE_LAST_RESORT_MAIN: EffectSpec = {
  id: "GD02-111-Main",
  cardCode: "GD02-111",
  trigger: "Main",
  condition: {
    predicate: "controllerTrashUnitColorCountAtLeast:purple:6",
    then: [
      { op: "moveZone", target: { kind: "group", group: { kind: "firstNInTrash", count: 6, filter: { cardType: "UNIT", color: "purple" } } }, toZone: "exile" },
      { op: "destroy", target: { kind: "named", name: "target" } },
    ],
  },
  actions: [],
  targetScope: "enemyUnit",
  sourceText: "【Main】Choose 6 purple Unit cards from your trash. Exile them from the game. If you do, choose 1 enemy Unit. Destroy it.",
};

// GD02-011 Moebius (Peacemaker Team) — 【Activate･Action】Destroy this Unit：Choose 1 enemy
// Base/enemy Shield this Unit is battling. Deal 6 damage to it.
export const GD02_011_MOEBIUS_ACTIVATE_ACTION: EffectSpec = {
  id: "GD02-011-ActivateAction",
  cardCode: "GD02-011",
  trigger: "Activate·Action",
  cost: [{ op: "destroy", target: { kind: "self" } }],
  actions: [{ op: "damageBattlingBaseOrShield", target: { kind: "named", name: "target" }, amount: 6 }],
  targetScope: "battlingBaseOrShield",
  sourceText: "【Activate･Action】Destroy this Unit：Choose 1 enemy Base/enemy Shield this Unit is battling. Deal 6 damage to it.",
};

// GD02-096 Desil Galette — 【Burst】Add this card to your hand.
// 【When Linked】You may choose 1 (Vagan) Unit card that is Lv.2 or lower from your trash.
// Pay its cost to deploy it.
export const GD02_096_DESIL_GALETTE_WHEN_LINKED: EffectSpec = {
  id: "GD02-096-WhenLinked",
  cardCode: "GD02-096",
  trigger: "When Linked",
  actions: [{ op: "deployFromTrashPayingCost", player: "controller", filter: { cardType: "UNIT", anyTrait: ["Vagan"], maxLevel: 2 } }],
  sourceText:
    "【Burst】Add this card to your hand.\n【When Linked】You may choose 1 (Vagan) Unit card that is Lv.2 or lower from your trash. Pay its cost to deploy it.",
};

// GD02-110 Awakened Power — 【Main】Choose 1 Unit card that is Lv.5 or lower from your trash.
// Pay its cost to deploy it.
export const GD02_110_AWAKENED_POWER_MAIN: EffectSpec = {
  id: "GD02-110-Main",
  cardCode: "GD02-110",
  trigger: "Main",
  actions: [{ op: "deployFromTrashPayingCost", player: "controller", filter: { cardType: "UNIT", maxLevel: 5 } }],
  sourceText: "【Main】Choose 1 Unit card that is Lv.5 or lower from your trash. Pay its cost to deploy it.",
};

export const GD02_EFFECT_SPECS: EffectSpec[] = [
  // auditoria por cláusula (W0.3): 【Burst】 padrão que faltava (pilotos e Bases)
  ...["GD02-086", "GD02-088", "GD02-090", "GD02-092", "GD02-094", "GD02-096", "GD02-097", "GD02-098"].map(stdAddToHandBurst),
  ...["GD02-121", "GD02-122", "GD02-123", "GD02-124", "GD02-125", "GD02-126", "GD02-127", "GD02-128", "GD02-129", "GD02-130"].map(stdDeployThisBurst),
  GD02_014_GALBALDY_BETA_DEPLOY,
  GD02_016_BARZAM_DEPLOY,
  GD02_020_ELMETH_DEPLOY,
  GD02_023_GUNDAM_AGE_1_SPALLOW_GRANT_FIRST_STRIKE,
  GD02_026_GENOACE_CUSTOM_DEPLOY,
  GD02_031_GUNDAM_AGE_1_TITUS_MAIN,
  GD02_033_KIKEROGA_MA_MODE_GQ_GRANT_BREACH_5,
  GD02_034_GQUUUUUUX_MAIN,
  GD02_036_QUBELEY_GRANT_SUPPRESSION,
  GD02_038_GQUUUUUUX_OMEGA_PSYCOMMU_DEPLOY,
  GD02_058_RYUSEI_GO_GRAZE_CUSTOM_II_DEPLOY,
  GD02_068_GUNDAM_BARBATOS_3RD_FORM_DEPLOY,
  GD02_073_CARTA_S_GRAZE_RITTER_GROUND_TYPE_GRANT_FIRST_STRIKE,
  GD02_082_GAELIO_S_SCHWALBE_GRAZE_GRANT_BLOCKER,
  GD02_086_JERID_MESSA_MAIN,
  GD02_088_FLIT_ASUNO_WHEN_LINKED,
  GD02_090_CHALLIA_BULL_GQ_MAIN,
  GD02_092_SHAGIA_FROST_ATTACK,
  GD02_094_GARROD_RAN_TIFFA_ADILL_WHEN_PAIRED,
  GD02_097_KAMILLE_BIDAN_MAIN,
  GD02_102_MOUAR_S_DETERMINATION_ACTION,
  GD02_104_TURNING_POINT_OF_HISTORY_MAIN,
  GD02_114_IT_S_NAME_IS_RYUSEI_GO_ACTION,
  GD02_115_FAMILIAL_DEVOTION_ACTION,
  GD02_117_A_NEW_SIGN_BURST,
  GD02_121_DOMINION_DEPLOY,
  GD02_122_ALEXANDRIA_DEPLOY,
  GD02_123_SODON_DEPLOY,
  GD02_124_DIVA_DEPLOY,
  GD02_125_GWADAN_DEPLOY,
  GD02_126_SHUJI_S_HIDEOUT_DEPLOY,
  GD02_127_FREEDEN_DEPLOY,
  GD02_128_HAMMERHEAD_DEPLOY,
  GD02_129_ARGAMA_DEPLOY,
  GD02_130_SLEIPNIR_DEPLOY,
  GD02_025_GUNDAM_HEAVYARMS_DEPLOY,
  GD02_039_HAMAN_KARN_S_GAZA_C_WHEN_PAIRED,
  GD02_041_SUGAI_S_GELGOOG_GQ_DEPLOY,
  GD02_046_SAYLA_S_LIGHT_TYPE_GUNCANNON_DEPLOY,
  GD02_008_GABTHLEY_WHEN_LINKED,
  GD02_045_GINN_LONG_RANGE_RECONNAISSANCE_TYPE_ATTACK,
  GD02_060_GUNDAM_LEOPARD_DEPLOY,
  GD02_054_GUNDAM_BARBATOS_1ST_FORM_ATTACK,
  GD02_070_GUNDAM_KIMARIS_DEPLOY,
  GD02_081_METHUSS_DEPLOY,
  GD02_004_BYARLANT_WHEN_PAIRED,
  GD02_061_HYAKURI_WHEN_PAIRED,
  GD02_089_LALAH_SUNE_BURST,
  GD02_089_LALAH_SUNE_WHEN_PAIRED,
  GD02_091_HAMAN_KARN_BURST,
  GD02_091_HAMAN_KARN_WHEN_PAIRED,
  GD02_095_LAFTER_FRANKLAND_BURST,
  GD02_095_LAFTER_FRANKLAND_ATTACK,
  GD02_099_GAELIO_BAUDUIN_BURST,
  GD02_099_GAELIO_BAUDUIN_WHEN_PAIRED,
  GD02_100_DRAMATIC_TURNABOUT_BURST,
  GD02_100_DRAMATIC_TURNABOUT_MAIN,
  GD02_101_BENEATH_THE_MASK_MAIN,
  GD02_101_BENEATH_THE_MASK_ACTION,
  GD02_103_AGE_DEVICE_BURST,
  GD02_103_AGE_DEVICE_MAIN,
  GD02_107_ALL_RANGE_ATTACK_BURST,
  GD02_107_ALL_RANGE_ATTACK_MAIN,
  GD02_108_THAT_ONE_LOOKS_A_LOT_STRONGER_MAIN,
  GD02_109_UNDYING_PERSISTENCE_MAIN,
  GD02_109_UNDYING_PERSISTENCE_ACTION,
  GD02_112_MOMENTARY_RESPITE_BURST,
  GD02_112_MOMENTARY_RESPITE_MAIN,
  GD02_113_SISTERLY_CARE_MAIN,
  GD02_113_SISTERLY_CARE_ACTION,
  GD02_116_COMRADES_COME_FIRST_MAIN,
  GD02_119_PERSISTENT_AND_FORTUDINOUS_ACTION,
  GD02_005_TALLGEESE_ATTACK,
  GD02_037_GUNDAM_VIRSAGO_DEPLOY,
  GD02_042_GUNDAM_ASHTARON_MA_MODE_DEPLOY,
  GD02_043_DAUGHTRESS_WEAPON_DEPLOY,
  GD02_044_DAUGHTRESS_COMMAND_DESTROYED,
  GD02_055_GUNDAM_GUSION_REBAKE_DEPLOY,
  GD02_083_GRAZE_RITTER_GROUND_TYPE_DESTROYED,
  GD02_087_ORGA_CROT_AND_SHANI_BURST,
  GD02_087_ORGA_CROT_AND_SHANI_WHEN_LINKED,
  GD02_106_WHITE_WOLF_ACTION,
  GD02_075_RICK_DIAS_RED_ATTACK,
  GD02_069_ZETA_GUNDAM_ACTIVATE_MAIN,
  GD02_047_GAZA_C_ACTIVATE_MAIN,
  GD02_105_VALEDICTORIAN_ACTION,
  GD02_120_ASPIRING_PILOT_ACTION,
  GD02_056_GUNDAM_X_DESTROYED,
  GD02_040_GUNDAM_ASHTARON_DEPLOY,
  GD02_118_HEART_SET_ON_REVENGE_ACTION,
  GD02_093_OLBA_FROST_BURST,
  GD02_021_GUNDAM_AGE_1_NORMAL_DEPLOY,
  GD02_085_FOUR_MURASAME_BURST,
  GD02_071_GUNDAM_MK_II_AEUG_DEPLOY,
  GD02_003_GUNDAM_MK_II_TITANS_DESTROYED,
  GD02_057_ZEDAS_ATTACK,
  GD02_098_QUATTRO_BAJEENA_WHEN_LINKED,
  GD02_111_DECISIVE_LAST_RESORT_BURST,
  GD02_111_DECISIVE_LAST_RESORT_MAIN,
  GD02_011_MOEBIUS_ACTIVATE_ACTION,
  GD02_096_DESIL_GALETTE_WHEN_LINKED,
  GD02_110_AWAKENED_POWER_MAIN
];
