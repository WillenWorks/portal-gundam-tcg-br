import type { CardDef } from "../engine/types";
import type { DeckList } from "../engine/setup";

/**
 * Wave ST07 "Gundam 00 / Celestial Being" — Starter Deck 07.
 *
 * Contém o catálogo canônico das 15 cartas de ST07 e construtor de deck oficial.
 */

// —————————————————————————— Purple Cards (Celestial Being) ——————————————————————————

export const GUNDAM_EXIA_LR: CardDef = {
  code: "ST07-001",
  nameEn: "Gundam Exia",
  cardType: "UNIT",
  color: "purple",
  level: 5,
  cost: 4,
  ap: 4,
  hp: 4,
  traits: ["CB", "GN Drive"],
  link: { kind: "pilotName", values: ["Setsuna F. Seiei"] },
  triggerKeywords: ["When Paired"],
};

export const GUNDAM_EXIA_COMMON: CardDef = {
  code: "ST07-002",
  nameEn: "Gundam Exia",
  cardType: "UNIT",
  color: "purple",
  level: 4,
  cost: 2,
  ap: 4,
  hp: 3,
  traits: ["CB", "GN Drive"],
  link: { kind: "pilotName", values: ["Setsuna F. Seiei"] },
};

export const GUNDAM_VIRTUE_COMMON_LV5: CardDef = {
  code: "ST07-003",
  nameEn: "Gundam Virtue",
  cardType: "UNIT",
  color: "purple",
  level: 5,
  cost: 3,
  ap: 5,
  hp: 4,
  traits: ["CB", "GN Drive"],
  link: { kind: "pilotName", values: ["Tieria Erde"] },
};

export const GUNDAM_VIRTUE_BLOCKER: CardDef = {
  code: "ST07-004",
  structuredSourceText: {
    staticAbilities: "While you have a (CB) Pilot in play, this Unit gains <Blocker>.",
  },
  nameEn: "Gundam Virtue",
  cardType: "UNIT",
  color: "purple",
  level: 3,
  cost: 2,
  ap: 3,
  hp: 3,
  traits: ["CB", "GN Drive"],
  link: { kind: "pilotName", values: ["Tieria Erde"] },
  effectKeywords: ["Blocker"],
  staticAbilities: [
    {
      keyword: "Blocker",
      condition: "always",
      scope: "self",
      boardCondition: { kind: "friendlyUnitWithTraitCountAtLeast", trait: "CB", cardType: "PILOT", n: 1 },
    },
  ],
};

// —————————————————————————— Green Cards (Celestial Being) ——————————————————————————

export const GUNDAM_DYNAMES_LR: CardDef = {
  code: "ST07-005",
  nameEn: "Gundam Dynames",
  cardType: "UNIT",
  color: "green",
  level: 4,
  cost: 3,
  ap: 2,
  hp: 4,
  traits: ["CB", "GN Drive"],
  link: { kind: "pilotName", values: ["Lockon Stratos"] },
  staticAbilities: [
    {
      sourceText: "【During Link】This Unit gets AP+2.",
      stat: "ap",
      amount: 2,
      condition: "duringLink",
      scope: "self",
    },
  ],
  // W0.5 — faltava (a auditoria dava a cláusula como coberta pelo estático do 【During Link】)
  combatTriggers: [
    {
      sourceText: "During your turn, when this Unit destroys an enemy Unit with battle damage, this Unit recovers 2 HP.",
      condition: "always",
      on: "destroyEnemyInBattle",
      action: { kind: "healSelf", amount: 2 },
    },
  ],
};

export const GUNDAM_DYNAMES_COMMON: CardDef = {
  code: "ST07-006",
  nameEn: "Gundam Dynames",
  cardType: "UNIT",
  color: "green",
  level: 3,
  cost: 2,
  ap: 3,
  hp: 3,
  traits: ["CB", "GN Drive"],
  link: { kind: "pilotName", values: ["Lockon Stratos"] },
};

export const GUNDAM_KYRIOS_BUFF: CardDef = {
  code: "ST07-007",
  structuredSourceText: {
    staticAbilities: "During your turn, while you have a (CB) Pilot in play, this Unit gets AP+2.",
  },
  nameEn: "Gundam Kyrios",
  cardType: "UNIT",
  color: "green",
  level: 3,
  cost: 2,
  ap: 2,
  hp: 3,
  traits: ["CB", "GN Drive"],
  link: { kind: "pilotName", values: ["Allelujah Haptism", "Hallelujah Haptism"] },
  staticAbilities: [
    {
      stat: "ap",
      amount: 2,
      condition: "always",
      duringYourTurnOnly: true,
      scope: "self",
      boardCondition: { kind: "friendlyUnitWithTraitCountAtLeast", trait: "CB", cardType: "PILOT", n: 1 },
    },
  ],
};

export const GUNDAM_KYRIOS_FLIGHT: CardDef = {
  code: "ST07-008",
  nameEn: "Gundam Kyrios (Flight Mode)",
  cardType: "UNIT",
  color: "green",
  level: 2,
  cost: 2,
  ap: 3,
  hp: 1,
  traits: ["CB", "GN Drive"],
  link: { kind: "pilotName", values: ["Allelujah Haptism", "Hallelujah Haptism"] },
};

// —————————————————————————— Pilots ——————————————————————————

export const SETSUNA_F_SEIEI: CardDef = {
  code: "ST07-009",
  nameEn: "Setsuna F. Seiei",
  cardType: "PILOT",
  color: "purple",
  level: 4,
  cost: 1,
  ap: 2,
  hp: 1,
  traits: ["CB"],
  triggerKeywords: ["Burst", "Attack"],
  hasBurst: true,
};

export const TIERIA_ERDE: CardDef = {
  code: "ST07-010",
  nameEn: "Tieria Erde",
  cardType: "PILOT",
  color: "purple",
  level: 4,
  cost: 1,
  ap: 1,
  hp: 1,
  traits: ["CB", "Innovade"],
  triggerKeywords: ["Burst", "Destroyed"],
  hasBurst: true,
};

export const LOCKON_STRATOS: CardDef = {
  code: "ST07-011",
  nameEn: "Lockon Stratos (Neil)",
  cardType: "PILOT",
  color: "green",
  level: 4,
  cost: 1,
  ap: 1,
  hp: 2,
  traits: ["CB"],
  triggerKeywords: ["Burst", "When Paired"],
  hasBurst: true,
};

export const ALLELUJAH_HAPTISM: CardDef = {
  code: "ST07-012",
  structuredSourceText: {
    innateDamageProtection: "During your turn, while you have a (CB) Link Unit in play, this Unit can't receive battle damage from enemy Units with 3 or less AP.",
  },
  nameEn: "Allelujah Haptism",
  cardType: "PILOT",
  color: "green",
  level: 3,
  cost: 1,
  ap: 1,
  hp: 1,
  traits: ["CB", "Super Soldier"],
  triggerKeywords: ["Burst"],
  hasBurst: true,
  innateDamageProtection: {
    maxAttackerAp: 3,
    duringYourTurnOnly: true,
  },
};

// —————————————————————————— Commands ——————————————————————————

export const ARMED_INTERVENTION: CardDef = {
  code: "ST07-013",
  nameEn: "Armed Intervention",
  cardType: "COMMAND",
  color: "purple",
  level: 4,
  cost: 1,
  traits: ["CB"],
  triggerKeywords: ["Burst", "Action"],
  hasBurst: true,
};

export const TACTICAL_VISIONARY: CardDef = {
  code: "ST07-014",
  nameEn: "Tactical Visionary",
  cardType: "COMMAND",
  color: "green",
  level: 1,
  cost: 1,
  traits: ["CB"],
  triggerKeywords: ["Main"],
};

// —————————————————————————— Bases ——————————————————————————

export const PTOLEMAIOS: CardDef = {
  code: "ST07-015",
  nameEn: "Ptolemaios",
  cardType: "BASE",
  color: "purple",
  level: 2,
  cost: 1,
  ap: 0,
  hp: 5,
  traits: ["CB", "Warship"],
  triggerKeywords: ["Burst", "Deploy"],
  hasBurst: true,
};

const RESOURCE: CardDef = {
  code: "RESOURCE",
  nameEn: "Resource",
  cardType: "RESOURCE",
  color: "colorless",
};

function copies(def: CardDef, n: number): CardDef[] {
  return Array.from({ length: n }, () => def);
}

/** 50 cartas — distribuição oficial de Starter Deck 07. */
export function buildSt07MainDeck(): CardDef[] {
  return [
    ...copies(GUNDAM_EXIA_LR, 2),
    ...copies(GUNDAM_EXIA_COMMON, 4),
    ...copies(GUNDAM_VIRTUE_COMMON_LV5, 4),
    ...copies(GUNDAM_VIRTUE_BLOCKER, 4),
    ...copies(GUNDAM_DYNAMES_LR, 2),
    ...copies(GUNDAM_DYNAMES_COMMON, 4),
    ...copies(GUNDAM_KYRIOS_BUFF, 4),
    ...copies(GUNDAM_KYRIOS_FLIGHT, 4),
    ...copies(SETSUNA_F_SEIEI, 3),
    ...copies(TIERIA_ERDE, 3),
    ...copies(LOCKON_STRATOS, 3),
    ...copies(ALLELUJAH_HAPTISM, 3),
    ...copies(ARMED_INTERVENTION, 3),
    ...copies(TACTICAL_VISIONARY, 4),
    ...copies(PTOLEMAIOS, 3),
  ];
}

/** 10 cartas — resource deck genérico. */
export function buildSt07ResourceDeck(): CardDef[] {
  return copies(RESOURCE, 10);
}

export function buildSt07DeckList(): DeckList {
  return { main: buildSt07MainDeck(), resources: buildSt07ResourceDeck() };
}

export const ST07_CARD_DEFS: Record<string, CardDef> = {
  "ST07-001": GUNDAM_EXIA_LR,
  "ST07-002": GUNDAM_EXIA_COMMON,
  "ST07-003": GUNDAM_VIRTUE_COMMON_LV5,
  "ST07-004": GUNDAM_VIRTUE_BLOCKER,
  "ST07-005": GUNDAM_DYNAMES_LR,
  "ST07-006": GUNDAM_DYNAMES_COMMON,
  "ST07-007": GUNDAM_KYRIOS_BUFF,
  "ST07-008": GUNDAM_KYRIOS_FLIGHT,
  "ST07-009": SETSUNA_F_SEIEI,
  "ST07-010": TIERIA_ERDE,
  "ST07-011": LOCKON_STRATOS,
  "ST07-012": ALLELUJAH_HAPTISM,
  "ST07-013": ARMED_INTERVENTION,
  "ST07-014": TACTICAL_VISIONARY,
  "ST07-015": PTOLEMAIOS,
};
