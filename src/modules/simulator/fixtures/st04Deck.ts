import type { CardDef } from "../engine/types";
import type { DeckList } from "../engine/setup";

/**
 * Wave ST04 "Aile of Justice" (docs/41) — Strike Gundam / SEED / Kira & Athrun.
 *
 * Fonte dos dados: mesma de `st03Deck.ts` — stats de `data/apitcg-gundam.json`
 * (`attributes` de cada `ST04-0xx`), texto de efeito de
 * `data/gcg-official-cards.json`, tokens `T-008/T-009/T-010`. Conferido em
 * 2026-09-05. Quantidades de Main/Resource Deck são composição própria dentro
 * do limite de 4 cópias/code (docs/14); stats e texto SÃO oficiais.
 *
 * Efeitos bespoke: ver `content/st04.ts`. Aproximações/deferimentos conhecidos
 * (Athrun Zala 【When Linked】 alvo ativo; "can't attack this turn" de Archangel)
 * estão anotados lá e em `docs/41`.
 */

// —————————————————————————— Earth Alliance (branco) ——————————————————————————

const AILE_STRIKE_GUNDAM: CardDef = {
  code: "ST04-001",
  nameEn: "Aile Strike Gundam",
  cardType: "UNIT",
  color: "white",
  level: 5,
  cost: 4,
  ap: 4,
  hp: 4,
  traits: ["Earth Alliance"],
  link: { kind: "pilotName", values: ["Kira Yamato"] },
  effectKeywords: ["Blocker"],
  keywordTags: ["Blocker"],
  triggerKeywords: ["When Paired"],
};

const STRIKE_GUNDAM: CardDef = {
  code: "ST04-002",
  nameEn: "Strike Gundam",
  cardType: "UNIT",
  color: "white",
  level: 4,
  cost: 2,
  ap: 3,
  hp: 3,
  traits: ["Earth Alliance"],
  link: { kind: "pilotName", values: ["Kira Yamato"] },
  triggerKeywords: ["Deploy"],
};

const MOEBIUS_ZERO: CardDef = {
  code: "ST04-003",
  nameEn: "Moebius Zero",
  cardType: "UNIT",
  color: "white",
  level: 3,
  cost: 2,
  ap: 2,
  hp: 4,
  traits: ["Earth Alliance"],
  link: { kind: "pilotName", values: ["Mu La Flaga"] },
};

const MOEBIUS: CardDef = {
  code: "ST04-004",
  nameEn: "Moebius",
  cardType: "UNIT",
  color: "white",
  level: 1,
  cost: 1,
  ap: 1,
  hp: 1,
  traits: ["Earth Alliance"],
  effectKeywords: ["Blocker"],
  keywordTags: ["Blocker"],
};

const STRIKE_DAGGER: CardDef = {
  code: "ST04-005",
  nameEn: "Strike Dagger",
  cardType: "UNIT",
  color: "white",
  level: 2,
  cost: 2,
  ap: 3,
  hp: 2,
  traits: ["Earth Alliance"],
};

// —————————————————————————— ZAFT (vermelho) ——————————————————————————

const AEGIS_GUNDAM: CardDef = {
  code: "ST04-006",
  nameEn: "Aegis Gundam",
  cardType: "UNIT",
  color: "red",
  level: 4,
  cost: 3,
  ap: 4,
  hp: 3,
  traits: ["ZAFT"],
  link: { kind: "pilotName", values: ["Athrun Zala"] },
  triggerKeywords: ["Attack"],
};

const AEGIS_GUNDAM_MA_MODE: CardDef = {
  code: "ST04-007",
  nameEn: "Aegis Gundam (MA Mode)",
  cardType: "UNIT",
  color: "red",
  level: 4,
  cost: 3,
  ap: 3,
  hp: 4,
  traits: ["ZAFT"],
  link: { kind: "pilotName", values: ["Athrun Zala"] },
  effectKeywords: ["Breach"],
  keywordTags: ["Breach 3"],
};

const GINN: CardDef = {
  code: "ST04-008",
  nameEn: "Ginn",
  cardType: "UNIT",
  color: "red",
  level: 2,
  cost: 1,
  ap: 2,
  hp: 2,
  traits: ["ZAFT"],
};

const MIGUELS_GINN: CardDef = {
  code: "ST04-009",
  nameEn: "Miguel's Ginn",
  cardType: "UNIT",
  color: "red",
  level: 2,
  cost: 2,
  ap: 3,
  hp: 1,
  traits: ["ZAFT"],
  link: { kind: "pilotName", values: ["Miguel Ayman"] },
  // 【During Pair】【Destroyed】If you have another Link Unit in play, draw 1.
  triggerKeywords: ["During Pair", "Destroyed"],
};

// —————————————————————————— Pilots ——————————————————————————

const KIRA_YAMATO: CardDef = {
  code: "ST04-010",
  nameEn: "Kira Yamato",
  cardType: "PILOT",
  color: "white",
  level: 4,
  cost: 1,
  ap: 2,
  hp: 1,
  traits: ["Earth Alliance", "Coordinator"],
  triggerKeywords: ["Burst", "Attack"],
  keywordTags: ["Burst", "Attack"],
  hasBurst: true,
};

const ATHRUN_ZALA: CardDef = {
  code: "ST04-011",
  nameEn: "Athrun Zala",
  cardType: "PILOT",
  color: "red",
  level: 4,
  cost: 1,
  ap: 1,
  hp: 2,
  traits: ["ZAFT", "Coordinator"],
  triggerKeywords: ["Burst", "When Linked"],
  keywordTags: ["Burst", "When Linked"],
  hasBurst: true,
};

// —————————————————————————— Commands ——————————————————————————

const STRIKER_PACK: CardDef = {
  code: "ST04-012",
  nameEn: "Striker Pack",
  cardType: "COMMAND",
  color: "white",
  level: 4,
  cost: 2,
  triggerKeywords: ["Burst", "Main"],
  keywordTags: ["Burst", "Main"],
  hasBurst: true,
};

const HAWK_OF_ENDYMION: CardDef = {
  code: "ST04-013",
  nameEn: "Hawk of Endymion",
  cardType: "COMMAND",
  color: "white",
  level: 2,
  cost: 1,
  traits: ["Earth Alliance"],
  triggerKeywords: ["Main", "Action"],
  keywordTags: ["Main", "Action"],
  // 【Pilot】[Mu La Flaga] — modo Pilot alternativo, AP+1/HP+0.
  pilotMode: { pilotName: "Mu La Flaga", ap: 1, hp: 0 },
};

const THE_MAGIC_BULLET_OF_DUSK: CardDef = {
  code: "ST04-014",
  nameEn: "The Magic Bullet of Dusk",
  cardType: "COMMAND",
  color: "red",
  level: 3,
  cost: 1,
  traits: ["ZAFT", "Coordinator"],
  triggerKeywords: ["Main", "Action"],
  keywordTags: ["Main", "Action"],
  // 【Pilot】[Miguel Ayman] — modo Pilot alternativo, AP+0/HP+1.
  pilotMode: { pilotName: "Miguel Ayman", ap: 0, hp: 1 },
};

// —————————————————————————— Bases ——————————————————————————

const ARCHANGEL: CardDef = {
  code: "ST04-015",
  nameEn: "Archangel",
  cardType: "BASE",
  color: "white",
  level: 3,
  cost: 1,
  hp: 5,
  traits: ["Earth Alliance", "Battleship"],
  triggerKeywords: ["Burst", "Deploy"],
  effectKeywords: ["Activate · Main", "Once per Turn"],
  keywordTags: ["Burst", "Deploy", "Activate · Main", "Once per Turn"],
  hasBurst: true,
  oncePerTurn: true,
};

const VESALIUS: CardDef = {
  code: "ST04-016",
  nameEn: "Vesalius",
  cardType: "BASE",
  color: "red",
  level: 3,
  cost: 1,
  hp: 5,
  traits: ["ZAFT", "Warship"],
  triggerKeywords: ["Burst", "Deploy"],
  effectKeywords: ["Activate · Main"],
  keywordTags: ["Burst", "Deploy", "Activate · Main"],
  hasBurst: true,
};

// —————————————————————————— Tokens ——————————————————————————

/** T-008 Aile Strike Gundam — invocado por ST04-012 Striker Pack ("(Earth Alliance)･AP3･HP3･<Blocker>"). */
export const TOKEN_AILE_STRIKE: CardDef = {
  code: "T-008",
  nameEn: "Aile Strike Gundam",
  cardType: "UNIT",
  color: "white",
  ap: 3,
  hp: 3,
  traits: ["Earth Alliance"],
  effectKeywords: ["Blocker"],
  keywordTags: ["Blocker"],
  isToken: true,
};

/** T-010 Sword Strike Gundam — Striker Pack 【Main】 ("(Earth Alliance)･AP4･HP2･<Blocker>"). */
export const TOKEN_SWORD_STRIKE: CardDef = {
  code: "T-010",
  nameEn: "Sword Strike Gundam",
  cardType: "UNIT",
  color: "white",
  ap: 4,
  hp: 2,
  traits: ["Earth Alliance"],
  effectKeywords: ["Blocker"],
  keywordTags: ["Blocker"],
  isToken: true,
};

/** T-009 Launcher Strike Gundam — Striker Pack 【Main】 ("(Earth Alliance)･AP2･HP4･<Blocker>"). */
export const TOKEN_LAUNCHER_STRIKE: CardDef = {
  code: "T-009",
  nameEn: "Launcher Strike Gundam",
  cardType: "UNIT",
  color: "white",
  ap: 2,
  hp: 4,
  traits: ["Earth Alliance"],
  effectKeywords: ["Blocker"],
  keywordTags: ["Blocker"],
  isToken: true,
};

const RESOURCE: CardDef = {
  code: "ST04-RESOURCE",
  nameEn: "Resource",
  cardType: "RESOURCE",
  color: "colorless",
};

function copies(def: CardDef, n: number): CardDef[] {
  return Array.from({ length: n }, () => def);
}

/** 50 cartas — distribuição própria (limite de 4 cópias/code). Todas as 16 cartas únicas presentes. */
export function buildSt04MainDeck(): CardDef[] {
  return [
    ...copies(AILE_STRIKE_GUNDAM, 2),
    ...copies(STRIKE_GUNDAM, 4),
    ...copies(MOEBIUS_ZERO, 4),
    ...copies(MOEBIUS, 4),
    ...copies(STRIKE_DAGGER, 4),
    ...copies(AEGIS_GUNDAM, 4),
    ...copies(AEGIS_GUNDAM_MA_MODE, 4),
    ...copies(GINN, 4),
    ...copies(MIGUELS_GINN, 4),
    ...copies(KIRA_YAMATO, 3),
    ...copies(ATHRUN_ZALA, 3),
    ...copies(STRIKER_PACK, 2),
    ...copies(HAWK_OF_ENDYMION, 2),
    ...copies(THE_MAGIC_BULLET_OF_DUSK, 2),
    ...copies(ARCHANGEL, 2),
    ...copies(VESALIUS, 2),
  ];
}

/** 10 cartas — resource deck genérico. */
export function buildSt04ResourceDeck(): CardDef[] {
  return copies(RESOURCE, 10);
}

export function buildSt04DeckList(): DeckList {
  return { main: buildSt04MainDeck(), resources: buildSt04ResourceDeck() };
}

export const ST04_CARD_DEFS = {
  AILE_STRIKE_GUNDAM,
  STRIKE_GUNDAM,
  MOEBIUS_ZERO,
  MOEBIUS,
  STRIKE_DAGGER,
  AEGIS_GUNDAM,
  AEGIS_GUNDAM_MA_MODE,
  GINN,
  MIGUELS_GINN,
  KIRA_YAMATO,
  ATHRUN_ZALA,
  STRIKER_PACK,
  HAWK_OF_ENDYMION,
  THE_MAGIC_BULLET_OF_DUSK,
  ARCHANGEL,
  VESALIUS,
  RESOURCE,
  TOKEN_AILE_STRIKE,
  TOKEN_SWORD_STRIKE,
  TOKEN_LAUNCHER_STRIKE,
};
