import type { CardDef } from "../engine/types";
import type { DeckList } from "../engine/setup";

/**
 * Wave ST05 "Iron-Blooded Struggle" (Mobile Suit Gundam: Iron-Blooded Orphans) —
 * Tekkadan (roxo) / Gjallarhorn (branco).
 *
 * Fonte dos dados: `attributes` de cada `ST05-0xx` em `data/apitcg-gundam.json`
 * (`set.code === "ST05"`) pros stats, texto oficial de `data/gcg-official-cards.json`
 * pro `effect` (nunca a tradução — docs/18). Conferido em 2026-09-14. Mesmo padrão
 * de `st04Deck.ts`: quantidades de Main/Resource Deck são composição própria
 * dentro do limite de 4 cópias/code (docs/14); stats e texto SÃO oficiais.
 *
 * Efeitos bespoke: ver `content/st05.ts`. ST05-011 Akihiro Altland tem 1 cláusula
 * deferida (retrieve de trash via combate) — ver `content/deferred.ts`.
 */

// —————————————————————————— Tekkadan (roxo) ——————————————————————————

const GUNDAM_BARBATOS_4TH_FORM: CardDef = {
  code: "ST05-001",
  structuredSourceText: {
    staticAbilities: "While this is damaged, it gains <Suppression>.",
  },
  nameEn: "Gundam Barbatos 4th Form",
  cardType: "UNIT",
  color: "purple",
  level: 6,
  cost: 4,
  ap: 4,
  hp: 5,
  traits: ["Tekkadan", "Gundam Frame"],
  link: { kind: "pilotName", values: ["Mikazuki Augus"] },
  triggerKeywords: ["Deploy"],
  // 【While this is damaged】gains <Suppression> — ver isTargetConditionMet "isDamaged".
  staticAbilities: [{ condition: "always", scope: "self", keyword: "Suppression", targetCondition: { kind: "isDamaged" } }],
};

const GUNDAM_BARBATOS_2ND_FORM: CardDef = {
  code: "ST05-002",
  structuredSourceText: {
    staticAbilities: "While this Unit is damaged, it gets AP+2.",
  },
  nameEn: "Gundam Barbatos 2nd Form",
  cardType: "UNIT",
  color: "purple",
  level: 4,
  cost: 2,
  ap: 2,
  hp: 4,
  traits: ["Tekkadan", "Gundam Frame"],
  link: { kind: "pilotName", values: ["Mikazuki Augus"] },
  // "While this Unit is damaged, it gets AP+2."
  staticAbilities: [{ condition: "always", scope: "self", stat: "ap", amount: 2, targetCondition: { kind: "isDamaged" } }],
};

const CGS_MOBILE_WORKER: CardDef = {
  code: "ST05-003",
  nameEn: "CGS Mobile Worker",
  cardType: "UNIT",
  color: "purple",
  level: 1,
  cost: 1,
  ap: 0,
  hp: 2,
  traits: ["Tekkadan"],
  triggerKeywords: ["Activate · Main"],
  effectKeywords: ["Activate · Main"],
  keywordTags: ["Activate · Main"],
};

const GRAZE_CUSTOM: CardDef = {
  code: "ST05-004",
  nameEn: "Graze Custom",
  cardType: "UNIT",
  color: "purple",
  level: 2,
  cost: 1,
  ap: 2,
  hp: 2,
  traits: ["Tekkadan"],
};

const GUNDAM_GUSION_REBAKE: CardDef = {
  code: "ST05-005",
  nameEn: "Gundam Gusion Rebake",
  cardType: "UNIT",
  color: "purple",
  level: 4,
  cost: 3,
  ap: 3,
  hp: 4,
  traits: ["Tekkadan", "Gundam Frame"],
  link: { kind: "pilotName", values: ["Akihiro Altland"] },
  triggerKeywords: ["Destroyed"],
};

const HYAKUREN: CardDef = {
  code: "ST05-006",
  nameEn: "Hyakuren",
  cardType: "UNIT",
  color: "purple",
  level: 3,
  cost: 2,
  ap: 4,
  hp: 3,
  traits: ["Teiwaz"],
};

// —————————————————————————— Gjallarhorn (branco) ——————————————————————————

const MCGILLIS_SCHWALBE_GRAZE: CardDef = {
  code: "ST05-007",
  nameEn: "McGillis' Schwalbe Graze",
  cardType: "UNIT",
  color: "white",
  level: 4,
  cost: 3,
  ap: 4,
  hp: 2,
  traits: ["Gjallarhorn"],
  link: { kind: "pilotName", values: ["McGillis Fareed"] },
  effectKeywords: ["Blocker"],
  keywordTags: ["Blocker"],
  triggerKeywords: ["When Paired"],
};

const GRAZE_COMMANDER_TYPE: CardDef = {
  code: "ST05-008",
  nameEn: "Graze Commander Type",
  cardType: "UNIT",
  color: "white",
  level: 3,
  cost: 2,
  ap: 3,
  hp: 2,
  traits: ["Gjallarhorn"],
  link: { kind: "trait", values: ["Gjallarhorn"] },
  effectKeywords: ["Blocker"],
  keywordTags: ["Blocker"],
};

const GRAZE: CardDef = {
  code: "ST05-009",
  nameEn: "Graze",
  cardType: "UNIT",
  color: "white",
  level: 2,
  cost: 1,
  ap: 2,
  hp: 2,
  traits: ["Gjallarhorn"],
};

// —————————————————————————— Pilots ——————————————————————————

const MIKAZUKI_AUGUS: CardDef = {
  code: "ST05-010",
  nameEn: "Mikazuki Augus",
  cardType: "PILOT",
  color: "purple",
  level: 4,
  cost: 1,
  ap: 2,
  hp: 1,
  traits: ["Tekkadan", "Alaya-Vijnana"],
  triggerKeywords: ["Burst", "When Paired"],
  keywordTags: ["Burst", "When Paired"],
  hasBurst: true,
};

const AKIHIRO_ALTLAND: CardDef = {
  code: "ST05-011",
  structuredSourceText: {
    combatTriggers: "【During Link】During your turn, when this Unit destroys an enemy Unit with battle damage, choose 1 (Tekkadan) Unit card that is Lv.2 or lower from your trash. Add it to your hand.",
  },
  nameEn: "Akihiro Altland",
  cardType: "PILOT",
  color: "purple",
  level: 3,
  cost: 1,
  ap: 1,
  hp: 1,
  traits: ["Tekkadan", "Alaya-Vijnana"],
  triggerKeywords: ["Burst", "During Link"],
  keywordTags: ["Burst", "During Link"],
  hasBurst: true,
  // "【During Link】During your turn, when this Unit destroys an enemy Unit with
  // battle damage, choose 1 (Tekkadan) Unit card that is Lv.2 or lower from your
  // trash. Add it to your hand." Fechada na revalidação (docs/47 Fase 6) — "this
  // Unit" é a Unit pareada/linkada (mesmo padrão de ST02-003/ST02-011: gatilho
  // definido no Piloto, procurado via `combatTriggerEvents` em ambos os lados do
  // pareamento). "During your turn" já é garantido por `combatTriggerEvents` só
  // rodar pro atacante ativo — `condition: "duringLink"` cobre o resto do texto.
  combatTriggers: [
    { condition: "duringLink", on: "destroyEnemyInBattle", action: { kind: "retrieveFromTrash", filter: { cardType: "UNIT", anyTrait: ["Tekkadan"], maxLevel: 2 } } },
  ],
};

const MCGILLIS_FAREED: CardDef = {
  code: "ST05-012",
  nameEn: "McGillis Fareed",
  cardType: "PILOT",
  color: "white",
  level: 4,
  cost: 1,
  ap: 2,
  hp: 1,
  traits: ["Gjallarhorn"],
  triggerKeywords: ["Burst", "When Paired"],
  keywordTags: ["Burst", "When Paired"],
  hasBurst: true,
};

// —————————————————————————— Commands ——————————————————————————

const WITH_IRON_AND_BLOOD: CardDef = {
  code: "ST05-013",
  nameEn: "With Iron and Blood",
  cardType: "COMMAND",
  color: "purple",
  level: 2,
  cost: 1,
  traits: ["Tekkadan"],
  triggerKeywords: ["Main", "Action"],
  keywordTags: ["Main", "Action"],
};

const FATAL_STRIKE: CardDef = {
  code: "ST05-014",
  nameEn: "Fatal Strike",
  cardType: "COMMAND",
  color: "purple",
  level: 4,
  cost: 2,
  traits: ["Tekkadan"],
  triggerKeywords: ["Burst", "Main"],
  keywordTags: ["Burst", "Main"],
  hasBurst: true,
};

// —————————————————————————— Bases ——————————————————————————

const ISARIBI: CardDef = {
  code: "ST05-015",
  nameEn: "Isaribi",
  cardType: "BASE",
  color: "purple",
  level: 3,
  cost: 1,
  hp: 5,
  traits: ["Tekkadan", "Warship"],
  triggerKeywords: ["Burst", "Deploy", "Activate · Main"],
  effectKeywords: ["Activate · Main"],
  keywordTags: ["Burst", "Deploy", "Activate · Main"],
  hasBurst: true,
};

// —————————————————————————— Resource ——————————————————————————

const RESOURCE: CardDef = {
  code: "ST05-RESOURCE",
  nameEn: "Resource",
  cardType: "RESOURCE",
  color: "colorless",
};

function copies(def: CardDef, n: number): CardDef[] {
  return Array.from({ length: n }, () => def);
}

/** 50 cartas — distribuição própria (limite de 4 cópias/code). Todas as 15 cartas únicas presentes. */
export function buildSt05MainDeck(): CardDef[] {
  return [
    ...copies(GUNDAM_BARBATOS_4TH_FORM, 2),
    ...copies(GUNDAM_BARBATOS_2ND_FORM, 4),
    ...copies(CGS_MOBILE_WORKER, 4),
    ...copies(GRAZE_CUSTOM, 4),
    ...copies(GUNDAM_GUSION_REBAKE, 3),
    ...copies(HYAKUREN, 4),
    ...copies(MCGILLIS_SCHWALBE_GRAZE, 2),
    ...copies(GRAZE_COMMANDER_TYPE, 4),
    ...copies(GRAZE, 4),
    ...copies(MIKAZUKI_AUGUS, 4),
    ...copies(AKIHIRO_ALTLAND, 3),
    ...copies(MCGILLIS_FAREED, 3),
    ...copies(WITH_IRON_AND_BLOOD, 4),
    ...copies(FATAL_STRIKE, 3),
    ...copies(ISARIBI, 2),
  ];
}

/** 10 cartas — resource deck genérico. */
export function buildSt05ResourceDeck(): CardDef[] {
  return copies(RESOURCE, 10);
}

export function buildSt05DeckList(): DeckList {
  return { main: buildSt05MainDeck(), resources: buildSt05ResourceDeck() };
}

export const ST05_CARD_DEFS = {
  GUNDAM_BARBATOS_4TH_FORM,
  GUNDAM_BARBATOS_2ND_FORM,
  CGS_MOBILE_WORKER,
  GRAZE_CUSTOM,
  GUNDAM_GUSION_REBAKE,
  HYAKUREN,
  MCGILLIS_SCHWALBE_GRAZE,
  GRAZE_COMMANDER_TYPE,
  GRAZE,
  MIKAZUKI_AUGUS,
  AKIHIRO_ALTLAND,
  MCGILLIS_FAREED,
  WITH_IRON_AND_BLOOD,
  FATAL_STRIKE,
  ISARIBI,
  RESOURCE,
};
