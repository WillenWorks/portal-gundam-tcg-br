import type { CardDef } from "../engine/types";
import type { DeckList } from "../engine/setup";

/**
 * Passo 3 do plano incremental (docs/18), segundo deck real na ordem
 * histórica de lançamento (ST01 → **ST02** → ST03 → ST04 → GD01 → ...).
 * ST02 "Ruination Ablaze" (Wing Gundam / Gundam Wing).
 *
 * Mesma fonte e mesma ressalva de quantidade que `st01Deck.ts`: stats
 * conferidos página a página em `gundam-gcg.com/en/cards/detail.php?
 * detailSearch=<code>` (2026-08-28), texto de efeito e traits de
 * `data/gcg-official-cards.json`, `effectKeywords`/`triggerKeywords`/
 * `keywordTags`/`hasBurst`/`oncePerTurn` gerados rodando `parseCardEffects()`
 * sobre o texto oficial (não recriado à mão). Quantidade de cópias por
 * carta (2/2/4/3/4/3/4/4/4/3/3/4/3/3/2/2 = 50) é composição própria dentro
 * do limite de 4/code — não confirmada contra o produto físico.
 */

const WING_GUNDAM: CardDef = {
  code: "ST02-001",
  nameEn: "Wing Gundam",
  cardType: "UNIT",
  color: "green",
  level: 6,
  cost: 4,
  ap: 4,
  hp: 5,
  traits: ["Operation Meteor"],
  effectKeywords: ["Breach"],
  keywordTags: ["Breach 5"],
  link: { kind: "pilotName", values: ["Heero Yuy"] },
  // + "This Unit may choose an active enemy Unit that is Lv.4 or lower as
  // its attack target." — relaxamento da legalidade de alvo de ataque
  // (normalmente só Units inimigas rested); mesma categoria de lacuna que a
  // restrição de ST01-009 Zowort, só que na direção oposta. Ver docs/18.
};

const WING_GUNDAM_BIRD_MODE: CardDef = {
  code: "ST02-002",
  nameEn: "Wing Gundam (Bird Mode)",
  cardType: "UNIT",
  color: "green",
  level: 3,
  cost: 3,
  ap: 2,
  hp: 2,
  traits: ["Operation Meteor"],
  triggerKeywords: ["Deploy"],
  keywordTags: ["Deploy"],
  link: { kind: "pilotName", values: ["Heero Yuy"] },
  // + "【Deploy】Place 1 EX Resource." — fora de escopo: precisa da mesma
  // primitiva de "criar instância nova" que falta pro deploy de token de
  // ST01-015/016 (ver docs/18, lacuna #3).
};

const GUNDAM_HEAVYARMS: CardDef = {
  code: "ST02-003",
  nameEn: "Gundam Heavyarms",
  cardType: "UNIT",
  color: "green",
  level: 5,
  cost: 3,
  ap: 3,
  hp: 4,
  traits: ["Operation Meteor"],
  triggerKeywords: ["During Pair"],
  keywordTags: ["During Pair"],
  link: { kind: "pilotName", values: ["Trowa Barton"] },
  // + "【During Pair】During your turn, when this Unit destroys an enemy
  // Unit with battle damage, deal 1 damage to all enemy Units that are
  // Lv.3 or lower." — fora de escopo: "all enemy Units ..." é ação em
  // GRUPO de alvos, e `TargetRef`/`resolveTarget` só resolvem 1 instanceId
  // por primitiva hoje (ver docs/18, lacuna #5).
};

const GUNDAM_SANDROCK: CardDef = {
  code: "ST02-004",
  nameEn: "Gundam Sandrock",
  cardType: "UNIT",
  color: "green",
  level: 4,
  cost: 2,
  ap: 4,
  hp: 3,
  traits: ["Operation Meteor"],
  link: { kind: "pilotName", values: ["Quatre Raberba Winner"] },
};

const MAGANAC: CardDef = {
  code: "ST02-005",
  nameEn: "Maganac",
  cardType: "UNIT",
  color: "green",
  level: 2,
  cost: 2,
  ap: 3,
  hp: 2,
  traits: ["Maganac Corps"],
};

const TALLGEESE: CardDef = {
  code: "ST02-006",
  nameEn: "Tallgeese",
  cardType: "UNIT",
  color: "blue",
  level: 5,
  cost: 4,
  ap: 4,
  hp: 4,
  traits: ["OZ"],
  effectKeywords: ["Activate · Main", "Once per Turn"],
  keywordTags: ["Activate · Main", "Once per Turn"],
  oncePerTurn: true,
  link: { kind: "pilotName", values: ["Zechs Merquise"] },
  // 【Activate･Main】【Once per Turn】④：Set this Unit as active. — a ação
  // (setActive em si) é autorada, mas o custo "④" (pagar 4 recursos) não é
  // cobrado — falta primitiva de "pagar custo de recurso genérico" (ver
  // docs/18, lacuna #4).
};

const LEO: CardDef = {
  code: "ST02-007",
  nameEn: "Leo",
  cardType: "UNIT",
  color: "blue",
  level: 2,
  cost: 2,
  ap: 2,
  hp: 2,
  traits: ["OZ"],
  // link "(OZ) Trait" — qualquer Pilot com o trait OZ (não um nome específico),
  // ex. Zechs Merquise (ST02-011); Heero Yuy (Operation Meteor) não qualifica.
  link: { kind: "trait", values: ["OZ"] },
};

const ARIES: CardDef = {
  code: "ST02-008",
  nameEn: "Aries",
  cardType: "UNIT",
  color: "blue",
  level: 2,
  cost: 2,
  ap: 2,
  hp: 1,
  traits: ["OZ"],
  effectKeywords: ["Blocker"],
  keywordTags: ["Blocker"],
};

const TRAGOS: CardDef = {
  code: "ST02-009",
  nameEn: "Tragos",
  cardType: "UNIT",
  color: "blue",
  level: 1,
  cost: 1,
  ap: 1,
  hp: 1,
  traits: ["OZ"],
  effectKeywords: ["Blocker"],
  keywordTags: ["Blocker"],
};

const HEERO_YUY: CardDef = {
  code: "ST02-010",
  nameEn: "Heero Yuy",
  cardType: "PILOT",
  color: "green",
  level: 4,
  cost: 1,
  traits: ["Operation Meteor"],
  triggerKeywords: ["Burst", "During Link"],
  keywordTags: ["Burst", "During Link"],
  hasBurst: true,
  // + "【During Link】This Unit gets AP+1 and HP+1." — efeito contínuo
  // condicionado a permanecer com Link ativo; mesma lacuna de ST01-001
  // "During Pair" (ver docs/18, lacuna #2 — cobre tanto Pair quanto Link).
};

const ZECHS_MERQUISE: CardDef = {
  code: "ST02-011",
  nameEn: "Zechs Merquise",
  cardType: "PILOT",
  color: "blue",
  level: 5,
  cost: 1,
  traits: ["OZ"],
  triggerKeywords: ["Burst", "During Link"],
  keywordTags: ["Burst", "During Link"],
  hasBurst: true,
};

const SIMULTANEOUS_FIRE: CardDef = {
  code: "ST02-012",
  nameEn: "Simultaneous Fire",
  cardType: "COMMAND",
  color: "green",
  level: 4,
  cost: 1,
  triggerKeywords: ["Main"],
  keywordTags: ["Main"],
  // + "【Pilot】[Trowa Barton]" — mesma observação de ST01-012/013: requisito
  // de jogo, não efeito, fora do escopo do EffectSpec.
};

const PEACEFUL_TIMBRE: CardDef = {
  code: "ST02-013",
  nameEn: "Peaceful Timbre",
  cardType: "COMMAND",
  color: "green",
  level: 4,
  cost: 1,
  triggerKeywords: ["Action"],
  keywordTags: ["Action"],
  // + "【Action】During this battle, your shield area cards can't receive
  // damage from enemy Units that are Lv.4 or lower." — efeito de prevenção/
  // substituição de dano condicional; nenhuma primitiva modela "impedir
  // dano sob uma condição" hoje (nova lacuna, #7 — ver docs/18).
  // + "【Pilot】[Quatre Raberba Winner]" — requisito de jogo, fora de escopo.
};

const SIEGE_PLOY: CardDef = {
  code: "ST02-014",
  nameEn: "Siege Ploy",
  cardType: "COMMAND",
  color: "blue",
  level: 3,
  cost: 1,
  triggerKeywords: ["Burst", "Main", "Action"],
  keywordTags: ["Burst", "Main", "Action"],
  hasBurst: true,
};

const SAINT_GABRIEL_INSTITUTE: CardDef = {
  code: "ST02-015",
  nameEn: "Saint Gabriel Institute",
  cardType: "BASE",
  color: "green",
  level: 2,
  cost: 2,
  hp: 5,
  traits: ["Academy", "Stronghold"],
  triggerKeywords: ["Burst", "Deploy"],
  keywordTags: ["Burst", "Deploy"],
  hasBurst: true,
  // + "Then, look at the top 2 cards of your deck and return 1 to the top
  // and 1 to the bottom." — efeito de informação oculta ("olhe N cartas do
  // topo"), já sinalizado como Risco/desconhecido em docs/18 antes mesmo do
  // passo 3 começar; nova lacuna #8 (peek-and-reorder no deck).
};

const CORSICA_BASE: CardDef = {
  code: "ST02-016",
  nameEn: "Corsica Base",
  cardType: "BASE",
  color: "blue",
  level: 3,
  cost: 3,
  hp: 5,
  traits: ["OZ", "Stronghold"],
  triggerKeywords: ["Burst", "Deploy"],
  effectKeywords: ["Tallgeese", "Leo"],
  keywordTags: ["Burst", "Deploy", "Tallgeese", "Leo"],
  hasBurst: true,
  // + deploy condicional de token (Tallgeese ou 2x Leo, dependendo de carta
  // "Corsica Base" no trash) — mesma lacuna #3 de ST01-015/016 (criar
  // instância nova via efeito), mais um predicado extra ("carta com nome X
  // no trash") que também não existe ainda.
};

const RESOURCE: CardDef = {
  code: "ST02-RESOURCE",
  nameEn: "Resource",
  cardType: "RESOURCE",
  color: "colorless",
};

function copies(def: CardDef, n: number): CardDef[] {
  return Array.from({ length: n }, () => def);
}

/** 50 cartas — distribuição própria dentro do limite de 4 cópias/code. */
export function buildSt02MainDeck(): CardDef[] {
  return [
    ...copies(WING_GUNDAM, 2),
    ...copies(WING_GUNDAM_BIRD_MODE, 2),
    ...copies(GUNDAM_HEAVYARMS, 4),
    ...copies(GUNDAM_SANDROCK, 3),
    ...copies(MAGANAC, 4),
    ...copies(TALLGEESE, 3),
    ...copies(LEO, 4),
    ...copies(ARIES, 4),
    ...copies(TRAGOS, 4),
    ...copies(HEERO_YUY, 3),
    ...copies(ZECHS_MERQUISE, 3),
    ...copies(SIMULTANEOUS_FIRE, 4),
    ...copies(PEACEFUL_TIMBRE, 3),
    ...copies(SIEGE_PLOY, 3),
    ...copies(SAINT_GABRIEL_INSTITUTE, 2),
    ...copies(CORSICA_BASE, 2),
  ];
}

/** 10 cartas — resource deck genérico. */
export function buildSt02ResourceDeck(): CardDef[] {
  return copies(RESOURCE, 10);
}

export function buildSt02DeckList(): DeckList {
  return { main: buildSt02MainDeck(), resources: buildSt02ResourceDeck() };
}

export const ST02_CARD_DEFS = {
  WING_GUNDAM,
  WING_GUNDAM_BIRD_MODE,
  GUNDAM_HEAVYARMS,
  GUNDAM_SANDROCK,
  MAGANAC,
  TALLGEESE,
  LEO,
  ARIES,
  TRAGOS,
  HEERO_YUY,
  ZECHS_MERQUISE,
  SIMULTANEOUS_FIRE,
  PEACEFUL_TIMBRE,
  SIEGE_PLOY,
  SAINT_GABRIEL_INSTITUTE,
  CORSICA_BASE,
  RESOURCE,
};
