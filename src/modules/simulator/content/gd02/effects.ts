import type { EffectSpec } from "../../engine/effectSpec";

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
export const GD02_EFFECT_SPECS: EffectSpec[] = [
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
  GD02_130_SLEIPNIR_DEPLOY
];
