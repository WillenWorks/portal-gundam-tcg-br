import type { CardDef } from "../engine/types";
import type { DeckList } from "../engine/setup";

/**
 * Wave ST06 "Gundam GQuuuuuuX / Red Gundam" (Clan / GQ) — Starter Deck 06.
 *
 * Contém o catálogo canônico das 15 cartas de ST06 e construtor de deck oficial.
 */

// —————————————————————————— Red Cards (GQ / Clan) ——————————————————————————

export const GQUUUUUUX_OMEGA_PSYCOMMU: CardDef = {
  code: "ST06-001",
  nameEn: "GQuuuuuuX (Omega Psycommu)",
  cardType: "UNIT",
  color: "red",
  level: 3,
  cost: 3,
  ap: 4,
  hp: 4,
  traits: ["Clan"],
  link: { kind: "pilotName", values: ["Amate Yuzuriha"] },
  triggerKeywords: ["When Linked"],
};

export const GQUUUUUUX_OMEGA_PSYCOMMU_EVENT: CardDef = {
  code: "ST06-002",
  nameEn: "GQuuuuuuX (Omega Psycommu)",
  cardType: "UNIT",
  color: "red",
  level: 3,
  cost: 3,
  ap: 4,
  hp: 2,
  traits: ["Clan"],
  link: { kind: "pilotName", values: ["Amate Yuzuriha"] },
  triggerKeywords: ["Deploy"],
};

export const GAIAS_RICK_DOM: CardDef = {
  code: "ST06-003",
  nameEn: "Gaia's Rick Dom (GQ)",
  cardType: "UNIT",
  color: "red",
  level: 2,
  cost: 2,
  ap: 2,
  hp: 2,
  traits: ["Clan"],
  effectKeywords: ["Support"],
  keywordTags: ["Support 1"],
  triggerKeywords: ["Activate: Main"],
};

export const GELGOOG_GQ: CardDef = {
  code: "ST06-004",
  nameEn: "Gelgoog (GQ)",
  cardType: "UNIT",
  color: "red",
  level: 1,
  cost: 1,
  ap: 2,
  hp: 2,
  traits: ["Zeon"],
};

// —————————————————————————— Green Cards (GQ / Clan) ——————————————————————————

export const RED_GUNDAM: CardDef = {
  code: "ST06-005",
  nameEn: "Red Gundam",
  cardType: "UNIT",
  color: "green",
  level: 3,
  cost: 3,
  ap: 4,
  hp: 3,
  traits: ["Clan"],
  link: { kind: "pilotName", values: ["Shuji Ito"] },
  effectKeywords: ["Breach"],
  keywordTags: ["Breach 1"],
  triggerKeywords: ["Attack"],
};

export const RED_GUNDAM_BOOST: CardDef = {
  code: "ST06-006",
  nameEn: "Red Gundam",
  cardType: "UNIT",
  color: "green",
  level: 2,
  cost: 2,
  ap: 3,
  hp: 4,
  traits: ["Clan"],
};

export const ORTEGAS_RICK_DOM: CardDef = {
  code: "ST06-007",
  nameEn: "Ortega's Rick Dom (GQ)",
  cardType: "UNIT",
  color: "green",
  level: 2,
  cost: 2,
  ap: 3,
  hp: 2,
  traits: ["Clan"],
  triggerKeywords: ["Deploy"],
};

export const SUGAIS_GELGOOG: CardDef = {
  code: "ST06-008",
  nameEn: "Sugai's Gelgoog (GQ)",
  cardType: "UNIT",
  color: "green",
  level: 2,
  cost: 2,
  ap: 3,
  hp: 3,
  traits: ["Clan"],
};

// —————————————————————————— Pilots ——————————————————————————

export const AMATE_YUZURIHA: CardDef = {
  code: "ST06-009",
  nameEn: "Amate Yuzuriha (Machu)",
  cardType: "PILOT",
  color: "red",
  level: 4,
  cost: 1,
  ap: 2,
  hp: 1,
  traits: ["Clan", "Newtype"],
  triggerKeywords: ["Burst", "When Linked"],
  hasBurst: true,
};

export const SHUJI_ITO: CardDef = {
  code: "ST06-010",
  nameEn: "Shuji Ito",
  cardType: "PILOT",
  color: "green",
  level: 4,
  cost: 1,
  ap: 1,
  hp: 2,
  traits: ["Clan", "Newtype"],
  triggerKeywords: ["Burst", "During Link", "Attack"],
  hasBurst: true,
};

// —————————————————————————— Commands ——————————————————————————

export const RUTHLESS_TACTICS: CardDef = {
  code: "ST06-011",
  nameEn: "Ruthless Tactics",
  cardType: "COMMAND",
  color: "red",
  level: 2,
  cost: 1,
  traits: ["Clan"],
  triggerKeywords: ["Main", "Action"],
  pilotMode: { pilotName: "Gaia (GQ)", ap: 1, hp: 0 },
};

export const SCHOOLGIRL_AND_SMUGGLER: CardDef = {
  code: "ST06-012",
  nameEn: "Schoolgirl and Smuggler",
  cardType: "COMMAND",
  color: "green",
  level: 2,
  cost: 1,
  triggerKeywords: ["Main"],
};

export const FIERCE_UNITY: CardDef = {
  code: "ST06-013",
  nameEn: "Fierce Unity",
  cardType: "COMMAND",
  color: "green",
  level: 2,
  cost: 1,
  traits: ["Clan"],
  triggerKeywords: ["Action"],
  pilotMode: { pilotName: "Ortega (GQ)", ap: 1, hp: 0 },
};

// —————————————————————————— Bases ——————————————————————————

export const CLAN_BATTLE: CardDef = {
  code: "ST06-014",
  nameEn: "Clan Battle",
  cardType: "BASE",
  color: "red",
  level: 1,
  cost: 1,
  ap: 0,
  hp: 5,
  traits: ["Clan", "Stronghold"],
  triggerKeywords: ["Burst", "Deploy", "Activate: Main"],
  hasBurst: true,
};

export const KANEBAN_CO_LTD: CardDef = {
  code: "ST06-015",
  nameEn: "Kaneban Co., Ltd.",
  cardType: "BASE",
  color: "green",
  level: 2,
  cost: 2,
  ap: 0,
  hp: 5,
  traits: ["Clan", "Stronghold"],
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

/** 50 cartas — distribuição oficial de Starter Deck 06. */
export function buildSt06MainDeck(): CardDef[] {
  return [
    ...copies(GQUUUUUUX_OMEGA_PSYCOMMU, 2),
    ...copies(GQUUUUUUX_OMEGA_PSYCOMMU_EVENT, 4),
    ...copies(GAIAS_RICK_DOM, 4),
    ...copies(GELGOOG_GQ, 4),
    ...copies(RED_GUNDAM, 2),
    ...copies(RED_GUNDAM_BOOST, 4),
    ...copies(ORTEGAS_RICK_DOM, 4),
    ...copies(SUGAIS_GELGOOG, 4),
    ...copies(AMATE_YUZURIHA, 3),
    ...copies(SHUJI_ITO, 3),
    ...copies(RUTHLESS_TACTICS, 4),
    ...copies(SCHOOLGIRL_AND_SMUGGLER, 4),
    ...copies(FIERCE_UNITY, 4),
    ...copies(CLAN_BATTLE, 2),
    ...copies(KANEBAN_CO_LTD, 2),
  ];
}

/** 10 cartas — resource deck genérico. */
export function buildSt06ResourceDeck(): CardDef[] {
  return copies(RESOURCE, 10);
}

export function buildSt06DeckList(): DeckList {
  return { main: buildSt06MainDeck(), resources: buildSt06ResourceDeck() };
}

export const ST06_CARD_DEFS: Record<string, CardDef> = {
  "ST06-001": GQUUUUUUX_OMEGA_PSYCOMMU,
  "ST06-002": GQUUUUUUX_OMEGA_PSYCOMMU_EVENT,
  "ST06-003": GAIAS_RICK_DOM,
  "ST06-004": GELGOOG_GQ,
  "ST06-005": RED_GUNDAM,
  "ST06-006": RED_GUNDAM_BOOST,
  "ST06-007": ORTEGAS_RICK_DOM,
  "ST06-008": SUGAIS_GELGOOG,
  "ST06-009": AMATE_YUZURIHA,
  "ST06-010": SHUJI_ITO,
  "ST06-011": RUTHLESS_TACTICS,
  "ST06-012": SCHOOLGIRL_AND_SMUGGLER,
  "ST06-013": FIERCE_UNITY,
  "ST06-014": CLAN_BATTLE,
  "ST06-015": KANEBAN_CO_LTD,
};
