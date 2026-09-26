import type { CardDef } from "../engine/types";
import type { DeckList } from "../engine/setup";

/**
 * Wave ST08 "Hathaway's Flash / Xi Gundam & Penelope" (Mafty & Federation) — Starter Deck 08.
 *
 * Contém o catálogo canônico das 15 cartas de ST08 e construtor de deck oficial.
 */

// —————————————————————————— Red Cards (Mafty) ——————————————————————————

export const XI_GUNDAM_LR: CardDef = {
  code: "ST08-001",
  structuredSourceText: {
    dynamicCost: "While you have no Units that are Lv.6 or higher in play, this card in your hand gets Lv. -1 and cost -1 for each enemy Unit in play.",
  },
  nameEn: "Xi Gundam",
  cardType: "UNIT",
  color: "red",
  level: 9,
  cost: 8,
  ap: 5,
  hp: 5,
  traits: ["Mafty"],
  link: { kind: "pilotName", values: ["Hathaway Noa"] },
  dynamicCost: {
    condition: { kind: "noUnitLevelAtLeast", maxLevel: 6 },
    amount: -1,
    perEnemyUnit: true,
  },
  dynamicLevel: {
    condition: { kind: "noUnitLevelAtLeast", maxLevel: 6 },
    amount: -1,
    perEnemyUnit: true,
  },
  triggerKeywords: ["When Paired"],
};

export const XI_GUNDAM_COMMON: CardDef = {
  code: "ST08-002",
  nameEn: "Xi Gundam",
  cardType: "UNIT",
  color: "red",
  level: 5,
  cost: 4,
  ap: 4,
  hp: 4,
  traits: ["Mafty"],
  link: { kind: "pilotName", values: ["Hathaway Noa"] },
  triggerKeywords: ["Deploy"],
};

export const MESSER_TYPE_F_NAKED: CardDef = {
  code: "ST08-003",
  nameEn: "Messer (Type-F Naked) (Commander Type)",
  cardType: "UNIT",
  color: "red",
  level: 4,
  cost: 2,
  ap: 4,
  hp: 3,
  traits: ["Mafty"],
  link: { kind: "trait", values: ["Mafty"] },
};

export const MESSER_TYPE_F01: CardDef = {
  code: "ST08-004",
  nameEn: "Messer Type-F01",
  cardType: "UNIT",
  color: "red",
  level: 2,
  cost: 2,
  ap: 2,
  hp: 1,
  traits: ["Mafty"],
  link: { kind: "trait", values: ["Mafty"] },
  triggerKeywords: ["Attack"],
};

export const MESSER_TYPE_F02_MINELAYER: CardDef = {
  code: "ST08-005",
  nameEn: "Messer Type-F02 Minelayer",
  cardType: "UNIT",
  color: "red",
  level: 3,
  cost: 2,
  ap: 4,
  hp: 3,
  traits: ["Mafty"],
};

// —————————————————————————— Blue Cards (Earth Federation) ——————————————————————————

export const PENELOPE_LR: CardDef = {
  code: "ST08-006",
  nameEn: "Penelope",
  cardType: "UNIT",
  color: "blue",
  level: 7,
  cost: 6,
  ap: 5,
  hp: 5,
  traits: ["Earth Federation"],
  link: { kind: "pilotName", values: ["Lane Aim"] },
  triggerKeywords: ["During Pair", "Attack"],
  oncePerTurn: true,
};

export const PENELOPE_COMMON: CardDef = {
  code: "ST08-007",
  nameEn: "Penelope",
  cardType: "UNIT",
  color: "blue",
  level: 5,
  cost: 3,
  ap: 5,
  hp: 4,
  traits: ["Earth Federation"],
  link: { kind: "pilotName", values: ["Lane Aim"] },
};

export const GUSTAV_KARL_TYPE_00: CardDef = {
  code: "ST08-008",
  structuredSourceText: {
    staticAbilities: "While 3 or more enemy Units are in play, this Unit gains <Blocker>.",
  },
  nameEn: "Gustav Karl Type-00",
  cardType: "UNIT",
  color: "blue",
  level: 3,
  cost: 3,
  ap: 3,
  hp: 4,
  traits: ["Earth Federation"],
  effectKeywords: ["Blocker"],
  staticAbilities: [
    {
      keyword: "Blocker",
      condition: "always",
      scope: "self",
      boardCondition: { kind: "enemyUnitCountAtLeast", n: 3 },
    },
  ],
};

export const JEGAN_GROUND_TYPE_A: CardDef = {
  code: "ST08-009",
  nameEn: "Jegan Ground Type-A (Man Hunter)",
  cardType: "UNIT",
  color: "blue",
  level: 1,
  cost: 1,
  ap: 0,
  hp: 1,
  traits: ["Earth Federation"],
  triggerKeywords: ["Deploy"],
};

// —————————————————————————— Pilots ——————————————————————————

export const HATHAWAY_NOA: CardDef = {
  code: "ST08-010",
  nameEn: "Hathaway Noa",
  cardType: "PILOT",
  color: "red",
  level: 4,
  cost: 1,
  ap: 2,
  hp: 1,
  traits: ["Mafty", "Newtype"],
  triggerKeywords: ["Burst", "When Paired"],
  hasBurst: true,
};

export const LANE_AIM: CardDef = {
  code: "ST08-011",
  nameEn: "Lane Aim",
  cardType: "PILOT",
  color: "blue",
  level: 4,
  cost: 1,
  ap: 2,
  hp: 1,
  traits: ["Earth Federation"],
  triggerKeywords: ["Burst"],
  hasBurst: true,
};

// —————————————————————————— Commands ——————————————————————————

export const WORDS_FOR_HATHAWAY: CardDef = {
  code: "ST08-012",
  nameEn: "Words for Hathaway",
  cardType: "COMMAND",
  color: "red",
  level: 3,
  cost: 1,
  traits: ["Mafty"],
  triggerKeywords: ["Main"],
  pilotMode: { pilotName: "Gawman Nobile", ap: 1, hp: 0 },
};

export const LADY_LUCK: CardDef = {
  code: "ST08-013",
  nameEn: "Lady Luck",
  cardType: "COMMAND",
  color: "red",
  level: 5,
  cost: 1,
  traits: ["Mafty"],
  triggerKeywords: ["Main", "Action"],
};

// —————————————————————————— Bases ——————————————————————————

export const VALIANT: CardDef = {
  code: "ST08-014",
  nameEn: "Valiant",
  cardType: "BASE",
  color: "red",
  level: 2,
  cost: 1,
  ap: 0,
  hp: 5,
  traits: ["Mafty", "Warship"],
  triggerKeywords: ["Burst", "Deploy"],
  hasBurst: true,
};

export const DAVAO: CardDef = {
  code: "ST08-015",
  nameEn: "Davao",
  cardType: "BASE",
  color: "blue",
  level: 3,
  cost: 1,
  ap: 0,
  hp: 5,
  traits: ["Earth Federation", "Stronghold"],
  triggerKeywords: ["Burst", "Deploy", "Activate: Main"],
  hasBurst: true,
  oncePerTurn: true,
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

/** 50 cartas — distribuição canônica de Starter Deck 08. */
export function buildSt08MainDeck(): CardDef[] {
  return [
    ...copies(XI_GUNDAM_LR, 2),
    ...copies(XI_GUNDAM_COMMON, 4),
    ...copies(MESSER_TYPE_F_NAKED, 4),
    ...copies(MESSER_TYPE_F01, 4),
    ...copies(MESSER_TYPE_F02_MINELAYER, 4),
    ...copies(PENELOPE_LR, 2),
    ...copies(PENELOPE_COMMON, 4),
    ...copies(GUSTAV_KARL_TYPE_00, 4),
    ...copies(JEGAN_GROUND_TYPE_A, 4),
    ...copies(HATHAWAY_NOA, 4),
    ...copies(LANE_AIM, 4),
    ...copies(WORDS_FOR_HATHAWAY, 3),
    ...copies(LADY_LUCK, 3),
    ...copies(VALIANT, 2),
    ...copies(DAVAO, 2),
  ];
}

/** 10 cartas — resource deck genérico. */
export function buildSt08ResourceDeck(): CardDef[] {
  return copies(RESOURCE, 10);
}

export function buildSt08DeckList(): DeckList {
  return { main: buildSt08MainDeck(), resources: buildSt08ResourceDeck() };
}

export const ST08_CARD_DEFS: Record<string, CardDef> = {
  "ST08-001": XI_GUNDAM_LR,
  "ST08-002": XI_GUNDAM_COMMON,
  "ST08-003": MESSER_TYPE_F_NAKED,
  "ST08-004": MESSER_TYPE_F01,
  "ST08-005": MESSER_TYPE_F02_MINELAYER,
  "ST08-006": PENELOPE_LR,
  "ST08-007": PENELOPE_COMMON,
  "ST08-008": GUSTAV_KARL_TYPE_00,
  "ST08-009": JEGAN_GROUND_TYPE_A,
  "ST08-010": HATHAWAY_NOA,
  "ST08-011": LANE_AIM,
  "ST08-012": WORDS_FOR_HATHAWAY,
  "ST08-013": LADY_LUCK,
  "ST08-014": VALIANT,
  "ST08-015": DAVAO,
};
