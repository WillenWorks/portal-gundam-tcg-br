import type { CardDef } from "../engine/types";
import type { DeckList } from "../engine/setup";

/**
 * Wave ST03 "Zeon's Fangs" (docs/41) — Sinanju / Unicorn / Full Frontal.
 *
 * Fonte dos dados:
 * - Stats (level/cost/AP/HP/color/trait): `data/apitcg-gundam.json`
 *   (`attributes` de cada `ST03-0xx`), conferido em 2026-09-05.
 * - Texto de efeito (`effect`, sempre em inglês — nunca a tradução, ver
 *   docs/18 "Cobertura de idioma"): `data/gcg-official-cards.json`.
 * - Tokens: códigos oficiais `T-006`/`T-007` (`data/gcg-official-cards.json`),
 *   stats do texto que os invoca.
 *
 * Quantidades do Main Deck (50) e Resource Deck (10): a Bandai não publica a
 * lista exata de cópias do preconstructed num lugar verificável — a
 * distribuição abaixo é composição própria dentro do limite de 4 cópias/code
 * (docs/14), igual à nota em `st01Deck.ts`. Stats e texto de efeito SÃO dados
 * oficiais; a contagem de cópias não.
 *
 * Efeitos bespoke: ver `content/st03.ts`. Fechado nesta rodada (docs/43 §4):
 * gatilho de destruição de shield de Sinanju (`combatTriggers` abaixo) e
 * prevenção de dano por AP de The Blue Giant (`THE_BLUE_GIANT_ACTION`).
 * Aproximação MANTIDA: <High-Maneuver> "During Pair" de Sinanju como keyword
 * fixa (motivo em nota na carta).
 */

// —————————————————————————— Neo Zeon (vermelho) ——————————————————————————

const SINANJU: CardDef = {
  code: "ST03-001",
  nameEn: "Sinanju",
  cardType: "UNIT",
  color: "red",
  level: 6,
  cost: 5,
  ap: 5,
  hp: 4,
  traits: ["Neo Zeon"],
  link: { kind: "pilotName", values: ["Full Frontal"] },
  triggerKeywords: ["During Pair"],
  // 【During Pair】This Unit gains <High-Maneuver>. Aproximação MANTIDA: keyword
  // fixa (Sinanju tem Link e quase sempre ataca pareada; a diferença só
  // apareceria atacando sem Pilot). `hasKeyword` é consultado sem `state` em
  // vários pontos do motor — modelar isto como keyword condicional exigiria
  // propagar `state` por ~9 call sites por 1 carta; custo/benefício não fecha
  // (docs/43 §4).
  effectKeywords: ["High-Maneuver"],
  keywordTags: ["High-Maneuver"],
  // "During your turn, when this Unit destroys an enemy shield area card with
  // battle damage, choose 1 enemy Unit. Deal 2 damage to it." Não é 【During
  // Pair】 no texto oficial → `condition: "always"`. Resolvido em
  // combat.ts/combatTriggerEvents (auto-mira a 1ª Unit inimiga — docs/43 §4).
  combatTriggers: [{ condition: "always", on: "destroyEnemyShieldInBattle", action: { kind: "damageChosenEnemyUnit", amount: 2 } }],
};

const ANGELOS_GEARA_ZULU: CardDef = {
  code: "ST03-002",
  nameEn: "Angelo's Geara Zulu",
  cardType: "UNIT",
  color: "red",
  level: 4,
  cost: 3,
  ap: 3,
  hp: 3,
  traits: ["Neo Zeon"],
  link: { kind: "pilotName", values: ["Angelo Sauper"] },
  effectKeywords: ["Support"],
  keywordTags: ["Support 2"],
  oncePerTurn: true,
};

const GEARA_ZULU: CardDef = {
  code: "ST03-003",
  nameEn: "Geara Zulu",
  cardType: "UNIT",
  color: "red",
  level: 3,
  cost: 2,
  ap: 3,
  hp: 2,
  traits: ["Neo Zeon"],
  link: { kind: "trait", values: ["Neo Zeon"] },
};

const GAZA_D: CardDef = {
  code: "ST03-004",
  nameEn: "Gaza D",
  cardType: "UNIT",
  color: "red",
  level: 2,
  cost: 2,
  ap: 2,
  hp: 1,
  traits: ["Neo Zeon"],
  effectKeywords: ["Support"],
  keywordTags: ["Support 2"],
  oncePerTurn: true,
};

const DRA_C: CardDef = {
  code: "ST03-005",
  nameEn: "Dra-C",
  cardType: "UNIT",
  color: "red",
  level: 1,
  cost: 1,
  ap: 1,
  hp: 2,
  traits: ["Neo Zeon"],
};

// —————————————————————————— Zeon (verde) ——————————————————————————

const CHARS_ZAKU_II: CardDef = {
  code: "ST03-006",
  nameEn: "Char's Zaku II",
  cardType: "UNIT",
  color: "green",
  level: 3,
  cost: 2,
  ap: 3,
  hp: 2,
  traits: ["Zeon"],
  link: { kind: "pilotName", values: ["Char Aznable"] },
  triggerKeywords: ["Destroyed"],
};

const ZAKU_I: CardDef = {
  code: "ST03-007",
  nameEn: "Zaku I",
  cardType: "UNIT",
  color: "green",
  level: 1,
  cost: 1,
  ap: 1,
  hp: 2,
  traits: ["Zeon"],
};

const ZAKU_II: CardDef = {
  code: "ST03-008",
  nameEn: "Zaku II",
  cardType: "UNIT",
  color: "green",
  level: 2,
  cost: 1,
  ap: 1,
  hp: 2,
  traits: ["Zeon"],
  triggerKeywords: ["Attack"],
};

const GOUF: CardDef = {
  code: "ST03-009",
  nameEn: "Gouf",
  cardType: "UNIT",
  color: "green",
  level: 3,
  cost: 3,
  ap: 2,
  hp: 3,
  traits: ["Zeon"],
  link: { kind: "pilotName", values: ["Ramba Ral"] },
  triggerKeywords: ["Deploy"],
};

// —————————————————————————— Pilots ——————————————————————————

const FULL_FRONTAL: CardDef = {
  code: "ST03-010",
  nameEn: "Full Frontal",
  cardType: "PILOT",
  color: "red",
  level: 6,
  cost: 1,
  // modificador impresso do Pilot (AP+2/HP+2) enquanto pareado.
  ap: 2,
  hp: 2,
  traits: ["Neo Zeon", "Cyber Newtype"],
  triggerKeywords: ["Burst", "When Paired"],
  keywordTags: ["Burst", "When Paired"],
  hasBurst: true,
};

const CHAR_AZNABLE: CardDef = {
  code: "ST03-011",
  nameEn: "Char Aznable",
  cardType: "PILOT",
  color: "green",
  // Lv.3 na carta base (a variante SP/alt-art de apitcg diz Lv.4 e foi pega por
  // engano na 1a extracao — 4 de 5 registros dizem Lv.3). Auditado 2026-09-05.
  level: 3,
  cost: 1,
  ap: 1,
  hp: 1,
  traits: ["Zeon", "Newtype"],
  triggerKeywords: ["Burst", "Attack"],
  keywordTags: ["Burst", "Attack"],
  hasBurst: true,
};

// —————————————————————————— Commands ——————————————————————————

const INDIGNATION: CardDef = {
  code: "ST03-012",
  nameEn: "Indignation",
  cardType: "COMMAND",
  color: "red",
  level: 2,
  cost: 1,
  traits: ["Neo Zeon"],
  triggerKeywords: ["Main", "Action"],
  keywordTags: ["Main", "Action"],
  // 【Pilot】[Angelo Sauper] — modo Pilot alternativo, AP+1/HP+0.
  pilotMode: { pilotName: "Angelo Sauper", ap: 1, hp: 0 },
};

const CLOSE_COMBAT: CardDef = {
  code: "ST03-013",
  nameEn: "Close Combat",
  cardType: "COMMAND",
  color: "red",
  level: 2,
  cost: 2,
  triggerKeywords: ["Burst", "Main", "Action"],
  keywordTags: ["Burst", "Main", "Action"],
  hasBurst: true,
};

const THE_BLUE_GIANT: CardDef = {
  code: "ST03-014",
  nameEn: "The Blue Giant",
  cardType: "COMMAND",
  color: "green",
  level: 4,
  cost: 1,
  traits: ["Zeon"],
  triggerKeywords: ["Action"],
  keywordTags: ["Action"],
  // 【Pilot】[Ramba Ral] — modo Pilot alternativo, AP+1/HP+1.
  pilotMode: { pilotName: "Ramba Ral", ap: 1, hp: 1 },
};

// —————————————————————————— Bases ——————————————————————————

const REWLOOLA: CardDef = {
  code: "ST03-015",
  nameEn: "Rewloola",
  cardType: "BASE",
  color: "red",
  level: 3,
  cost: 2,
  hp: 5,
  traits: ["Neo Zeon", "Warship"],
  triggerKeywords: ["Burst", "Deploy"],
  keywordTags: ["Burst", "Deploy"],
  hasBurst: true,
};

const FALMEL: CardDef = {
  code: "ST03-016",
  nameEn: "Falmel",
  cardType: "BASE",
  color: "green",
  level: 3,
  cost: 2,
  hp: 5,
  traits: ["Zeon", "Battleship"],
  triggerKeywords: ["Burst", "Deploy"],
  keywordTags: ["Burst", "Deploy"],
  hasBurst: true,
};

// —————————————————————————— Tokens ——————————————————————————

/** T-007 Zaku Ⅱ — invocado por ST03-009 Gouf ("(Zeon)･AP1･HP1"). */
export const TOKEN_ZAKU_II: CardDef = {
  code: "T-007",
  nameEn: "Zaku II",
  cardType: "UNIT",
  color: "green",
  ap: 1,
  hp: 1,
  traits: ["Zeon"],
  isToken: true,
};

/** T-006 Char's Zaku Ⅱ — invocado por ST03-016 Falmel ("(Zeon)･AP3･HP1"). */
export const TOKEN_CHARS_ZAKU_II: CardDef = {
  code: "T-006",
  nameEn: "Char's Zaku II",
  cardType: "UNIT",
  color: "green",
  ap: 3,
  hp: 1,
  traits: ["Zeon"],
  isToken: true,
};

const RESOURCE: CardDef = {
  code: "ST03-RESOURCE",
  nameEn: "Resource",
  cardType: "RESOURCE",
  color: "colorless",
};

function copies(def: CardDef, n: number): CardDef[] {
  return Array.from({ length: n }, () => def);
}

/** 50 cartas — distribuição própria dentro do limite de 4 cópias/code (ver nota de fonte acima). Todas as 16 cartas únicas presentes ao menos 1x. */
export function buildSt03MainDeck(): CardDef[] {
  return [
    ...copies(SINANJU, 2),
    ...copies(ANGELOS_GEARA_ZULU, 4),
    ...copies(GEARA_ZULU, 4),
    ...copies(GAZA_D, 4),
    ...copies(DRA_C, 4),
    ...copies(CHARS_ZAKU_II, 4),
    ...copies(ZAKU_I, 4),
    ...copies(ZAKU_II, 4),
    ...copies(GOUF, 4),
    ...copies(FULL_FRONTAL, 3),
    ...copies(CHAR_AZNABLE, 3),
    ...copies(INDIGNATION, 2),
    ...copies(CLOSE_COMBAT, 2),
    ...copies(THE_BLUE_GIANT, 2),
    ...copies(REWLOOLA, 2),
    ...copies(FALMEL, 2),
  ];
}

/** 10 cartas — resource deck genérico (igual ao produto físico). */
export function buildSt03ResourceDeck(): CardDef[] {
  return copies(RESOURCE, 10);
}

export function buildSt03DeckList(): DeckList {
  return { main: buildSt03MainDeck(), resources: buildSt03ResourceDeck() };
}

export const ST03_CARD_DEFS = {
  SINANJU,
  ANGELOS_GEARA_ZULU,
  GEARA_ZULU,
  GAZA_D,
  DRA_C,
  CHARS_ZAKU_II,
  ZAKU_I,
  ZAKU_II,
  GOUF,
  FULL_FRONTAL,
  CHAR_AZNABLE,
  INDIGNATION,
  CLOSE_COMBAT,
  THE_BLUE_GIANT,
  REWLOOLA,
  FALMEL,
  RESOURCE,
  TOKEN_ZAKU_II,
  TOKEN_CHARS_ZAKU_II,
};
