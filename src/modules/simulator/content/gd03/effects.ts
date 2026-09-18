import type { EffectSpec } from "../../engine/effectSpec";

/**
 * Wave GD03 "Crossfire" — Catálogo de EffectSpecs Oficiais.
 */

// —————————————————————————— Bases: Deploy & Burst ——————————————————————————

export const GD03_BASE_EFFECT_SPECS: EffectSpec[] = [];

const BASE_CODES = [
  "GD03-123", "GD03-124", "GD03-125", "GD03-126", "GD03-127",
  "GD03-128", "GD03-129", "GD03-130", "GD03-131", "GD03-132"
];

for (const code of BASE_CODES) {
  GD03_BASE_EFFECT_SPECS.push(
    {
      id: `${code}-Burst`,
      cardCode: code,
      trigger: "Burst",
      actions: [{ op: "deployThisCard" }],
      sourceText: "【Burst】Deploy this card.",
    },
    {
      id: `${code}-Deploy`,
      cardCode: code,
      trigger: "Deploy",
      actions: [{ op: "addShieldToHand", player: "controller", count: 1 }],
      sourceText: "【Deploy】Add 1 of your Shields to your hand.",
    },
  );
}

// —————————————————————————— Pilots: Burst ——————————————————————————

export const GD03_PILOT_BURST_SPECS: EffectSpec[] = [];

for (let i = 84; i <= 100; i++) {
  const code = `GD03-0${i}`;
  GD03_PILOT_BURST_SPECS.push({
    id: `${code}-Burst`,
    cardCode: code,
    trigger: "Burst",
    actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
    sourceText: "【Burst】Add this card to your hand.",
  });
}

// —————————————————————————— Commands: Burst ——————————————————————————

export const GD03_COMMAND_BURST_SPECS: EffectSpec[] = [
  {
    id: "GD03-102-Burst",
    cardCode: "GD03-102",
    trigger: "Burst",
    actions: [{ op: "draw", player: "controller", n: 1 }],
    sourceText: "【Burst】Draw 1.",
  },
  {
    id: "GD03-103-Burst",
    cardCode: "GD03-103",
    trigger: "Burst",
    actions: [{ op: "rest", target: { kind: "named", name: "target" } }],
    targetScope: "enemyUnit",
    targetFilter: "hp<=2",
    sourceText: "【Burst】Choose 1 enemy Unit with 2 or less HP. Rest it.",
  },
  {
    id: "GD03-105-Burst",
    cardCode: "GD03-105",
    trigger: "Burst",
    actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
    sourceText: "【Burst】Add this card to your hand.",
  },
  {
    id: "GD03-112-Burst",
    cardCode: "GD03-112",
    trigger: "Burst",
    actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
    sourceText: "【Burst】Add this card to your hand.",
  },
  {
    id: "GD03-118-Burst",
    cardCode: "GD03-118",
    trigger: "Burst",
    actions: [{ op: "moveZone", target: { kind: "self" }, toZone: "hand" }],
    sourceText: "【Burst】Add this card to your hand.",
  },
];

// —————————————————————————— Bespoke Unit / Pilot / Command Effects ——————————————————————————

// GD03-001 Gundam NT-1 — 【When Paired】Choose 1 rested enemy Unit. Deal 1 damage to it.
export const GD03_001_GUNDAM_NT1_WHEN_PAIRED: EffectSpec = {
  id: "GD03-001-WhenPaired",
  cardCode: "GD03-001",
  trigger: "When Paired",
  actions: [
    { op: "damageUnit", amount: 1, target: { kind: "named", name: "target" } },
  ],
  targetScope: "enemyUnit",
  targetFilter: "rested",
  sourceText: "【When Paired】Choose 1 rested enemy Unit. Deal 1 damage to it. When this effect destroys an enemy Unit, draw 1.",
};

// GD03-005 Kshatriya Besserung — 【Deploy】Draw 1.
export const GD03_005_KSHATRIYA_DEPLOY: EffectSpec = {
  id: "GD03-005-Deploy",
  cardCode: "GD03-005",
  trigger: "Deploy",
  actions: [{ op: "draw", player: "controller", n: 1 }],
  sourceText: "【Deploy】Draw 1.",
};

// GD03-006 Penelope (Middle Form) — 【Deploy】Choose 1 to 2 enemy Units with 3 or less HP. Rest them.
export const GD03_006_PENELOPE_DEPLOY: EffectSpec = {
  id: "GD03-006-Deploy",
  cardCode: "GD03-006",
  trigger: "Deploy",
  actions: [{ op: "rest", target: { kind: "namedGroup", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "hp<=3",
  targetCount: { min: 1, max: 2 },
  sourceText: "【Deploy】Choose 1 to 2 enemy Units with 3 or less HP. Rest them.",
};

// GD03-007 Gundam NT-1 Full Armor — 【Destroyed】Choose 1 enemy Unit with 3 or less HP. Rest it.
export const GD03_007_GUNDAM_NT1_FA_DESTROYED: EffectSpec = {
  id: "GD03-007-Destroyed",
  cardCode: "GD03-007",
  trigger: "Destroyed",
  actions: [{ op: "rest", target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "hp<=3",
  sourceText: "【Destroyed】Choose 1 enemy Unit with 3 or less HP. Rest it.",
};

// GD03-021 Gundam Deathscythe Hell — 【Deploy】Choose 1 enemy Unit. Rest it.
export const GD03_021_DEATHSCYTHE_DEPLOY: EffectSpec = {
  id: "GD03-021-Deploy",
  cardCode: "GD03-021",
  trigger: "Deploy",
  actions: [{ op: "rest", target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  sourceText: "【Deploy】Choose 1 enemy Unit. Rest it.",
};

// GD03-023 Gundam Heavyarms Custom — 【Deploy】Choose 1 enemy Unit. Deal 2 damage to it.
export const GD03_023_HEAVYARMS_DEPLOY: EffectSpec = {
  id: "GD03-023-Deploy",
  cardCode: "GD03-023",
  trigger: "Deploy",
  actions: [{ op: "damageUnit", amount: 2, target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  sourceText: "【Deploy】Choose 1 enemy Unit. Deal 2 damage to it.",
};

// GD03-087 Sarah Zabiarov — 【When Linked】Choose 1 enemy Unit that is Lv.3 or lower. Rest it.
export const GD03_087_SARAH_WHEN_LINKED: EffectSpec = {
  id: "GD03-087-WhenLinked",
  cardCode: "GD03-087",
  trigger: "When Linked",
  actions: [{ op: "rest", target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  targetFilter: "level<=3",
  sourceText: "【When Linked】Choose 1 enemy Unit that is Lv.3 or lower. Rest it.",
};

// GD03-090 Mikhail Kaminsky — 【Attack】Choose 1 of your (Cyclops Team) Units. It gains <Breach 1> during this turn.
export const GD03_090_MIKHAIL_ATTACK: EffectSpec = {
  id: "GD03-090-Attack",
  cardCode: "GD03-090",
  trigger: "Attack",
  actions: [
    { op: "grantKeyword", keyword: "Breach 1", duration: "endOfTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  targetFilter: "trait:Cyclops Team",
  sourceText: "【Attack】Choose 1 of your (Cyclops Team) Units. It gains <Breach 1> during this turn.",
};

// GD03-101 A Healthy Curiosity — 【Main】Draw 1.
export const GD03_101_HEALTHY_CURIOSITY_MAIN: EffectSpec = {
  id: "GD03-101-Main",
  cardCode: "GD03-101",
  trigger: "Main",
  actions: [{ op: "draw", player: "controller", n: 1 }],
  sourceText: "【Main】Draw 1.",
};

// GD03-111 Infiltrator Present — 【Main】/【Action】Choose 1 friendly (Mafty) Unit. It gets AP+3 during this turn.
export const GD03_111_INFILTRATOR_MAIN: EffectSpec = {
  id: "GD03-111-Main",
  cardCode: "GD03-111",
  trigger: "Main",
  actions: [
    { op: "modifyStat", stat: "ap", amount: 3, duration: "endOfTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  targetFilter: "trait:Mafty",
  sourceText: "【Main】Choose 1 friendly (Mafty) Unit. It gets AP+3 during this turn.",
};

export const GD03_111_INFILTRATOR_ACTION: EffectSpec = {
  id: "GD03-111-Action",
  cardCode: "GD03-111",
  trigger: "Action",
  actions: [
    { op: "modifyStat", stat: "ap", amount: 3, duration: "endOfTurn", target: { kind: "named", name: "target" } },
  ],
  targetScope: "friendlyUnit",
  targetFilter: "trait:Mafty",
  sourceText: "【Action】Choose 1 friendly (Mafty) Unit. It gets AP+3 during this turn.",
};

// GD03-116 Towards Destiny — 【Main】/【Action】Choose 1 enemy Unit. Deal 2 damage to it.
export const GD03_116_TOWARDS_DESTINY_MAIN: EffectSpec = {
  id: "GD03-116-Main",
  cardCode: "GD03-116",
  trigger: "Main",
  actions: [{ op: "damageUnit", amount: 2, target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  sourceText: "【Main】Choose 1 enemy Unit. Deal 2 damage to it.",
};

export const GD03_116_TOWARDS_DESTINY_ACTION: EffectSpec = {
  id: "GD03-116-Action",
  cardCode: "GD03-116",
  trigger: "Action",
  actions: [{ op: "damageUnit", amount: 2, target: { kind: "named", name: "target" } }],
  targetScope: "enemyUnit",
  sourceText: "【Action】Choose 1 enemy Unit. Deal 2 damage to it.",
};

export const GD03_EFFECT_SPECS: EffectSpec[] = [
  ...GD03_BASE_EFFECT_SPECS,
  ...GD03_PILOT_BURST_SPECS,
  ...GD03_COMMAND_BURST_SPECS,
  GD03_001_GUNDAM_NT1_WHEN_PAIRED,
  GD03_005_KSHATRIYA_DEPLOY,
  GD03_006_PENELOPE_DEPLOY,
  GD03_007_GUNDAM_NT1_FA_DESTROYED,
  GD03_021_DEATHSCYTHE_DEPLOY,
  GD03_023_HEAVYARMS_DEPLOY,
  GD03_087_SARAH_WHEN_LINKED,
  GD03_090_MIKHAIL_ATTACK,
  GD03_101_HEALTHY_CURIOSITY_MAIN,
  GD03_111_INFILTRATOR_MAIN,
  GD03_111_INFILTRATOR_ACTION,
  GD03_116_TOWARDS_DESTINY_MAIN,
  GD03_116_TOWARDS_DESTINY_ACTION,
];
