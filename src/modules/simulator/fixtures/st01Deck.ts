import type { CardDef } from "../engine/types";
import type { DeckList } from "../engine/setup";

/**
 * Passo 3 do plano incremental (docs/18): primeiro deck de teste "real" do
 * catálogo, na ordem histórica de lançamento (ST01-04 → GD01 → ...) já
 * combinada com o Willen. ST01 "Heroic Beginnings" foi escolhido por ser
 * literalmente o primeiro produto da linha.
 *
 * Fonte dos dados:
 * - Stats (level/cost/AP/HP/color/trait): página oficial de cada carta em
 *   `gundam-gcg.com/en/cards/detail.php?detailSearch=<code>`, conferida em
 *   2026-08-28.
 * - Texto de efeito (`effect`, sempre em inglês — nunca a tradução, ver
 *   docs/18 "Cobertura de idioma"): `data/gcg-official-cards.json`
 *   (dataset local já versionado no repo, `source: gundam-gcg.com`).
 * - `effectKeywords`/`triggerKeywords`/`keywordTags`/`hasBurst` abaixo foram
 *   gerados rodando `parseCardEffects(card.effect, "")`
 *   (`src/lib/gundam-card-effects.ts`, o mesmo parser de produção — ver
 *   docs/18, "não recriar esse parsing") sobre o texto de cada carta e
 *   copiando o resultado aqui como dado estático (o motor do simulador não
 *   depende de rede nem chama o parser em runtime).
 *
 * Quantidades (2/2/4/4/4/3/3/4/4/3/3/4/3/3/2/2 = 50): a Bandai não publica
 * a lista exata de cópias por carta do preconstructed ST01 num lugar
 * facilmente verificável (só "16 cartas únicas, 2 Legend Rare + 14 Common"
 * foi confirmado via gundam-gcg.com/en/products/st01.html) — a distribuição
 * abaixo é uma composição própria dentro do limite de 4 cópias/code
 * (docs/14), não uma cópia exata do produto físico. Isso não compromete o
 * objetivo do passo 3 (validar a DSL de efeitos contra texto real de carta),
 * só marca que a *quantidade* de cada carta não é dado oficial verificado,
 * ao contrário dos stats e do texto de efeito.
 */

const GUNDAM: CardDef = {
  code: "ST01-001",
  nameEn: "Gundam",
  cardType: "UNIT",
  color: "blue",
  level: 4,
  cost: 3,
  ap: 3,
  hp: 4,
  traits: ["Earth Federation", "White Base Team"],
  effectKeywords: ["Repair"],
  triggerKeywords: ["During Pair"],
  keywordTags: ["Repair 2", "During Pair"],
  link: { kind: "pilotName", values: ["Amuro Ray"] },
};

const GUNDAM_MA_FORM: CardDef = {
  code: "ST01-002",
  nameEn: "Gundam (MA Form)",
  cardType: "UNIT",
  color: "blue",
  level: 5,
  cost: 3,
  ap: 4,
  hp: 3,
  traits: ["Earth Federation", "White Base Team"],
  triggerKeywords: ["When Paired"],
  keywordTags: ["When Paired"],
  link: { kind: "pilotName", values: ["Amuro Ray"] },
};

const GUNCANNON: CardDef = {
  code: "ST01-003",
  nameEn: "Guncannon",
  cardType: "UNIT",
  color: "blue",
  level: 3,
  cost: 2,
  ap: 2,
  hp: 4,
  traits: ["Earth Federation", "White Base Team"],
  link: { kind: "pilotName", values: ["Kai Shiden"] },
};

const GUNTANK: CardDef = {
  code: "ST01-004",
  nameEn: "Guntank",
  cardType: "UNIT",
  color: "blue",
  level: 3,
  cost: 2,
  ap: 2,
  hp: 3,
  traits: ["Earth Federation", "White Base Team"],
  triggerKeywords: ["Deploy"],
  keywordTags: ["Deploy"],
  link: { kind: "pilotName", values: ["Hayato Kobayashi"] },
};

const GM: CardDef = {
  code: "ST01-005",
  nameEn: "GM",
  cardType: "UNIT",
  color: "blue",
  level: 2,
  cost: 1,
  ap: 2,
  hp: 2,
  traits: ["Earth Federation"],
};

const AERIAL_SCORE_SIX: CardDef = {
  code: "ST01-006",
  nameEn: "Gundam Aerial (Permet Score Six)",
  cardType: "UNIT",
  color: "white",
  level: 5,
  cost: 4,
  ap: 4,
  hp: 4,
  traits: ["Academy"],
  triggerKeywords: ["When Paired"],
  keywordTags: ["When Paired"],
  link: { kind: "pilotName", values: ["Suletta Mercury"] },
};

const AERIAL_BIT_FORM: CardDef = {
  code: "ST01-007",
  nameEn: "Gundam Aerial (Bit on Form)",
  cardType: "UNIT",
  color: "white",
  level: 4,
  cost: 2,
  ap: 3,
  hp: 4,
  traits: ["Academy"],
  link: { kind: "pilotName", values: ["Suletta Mercury"] },
};

const DEMI_TRAINER: CardDef = {
  code: "ST01-008",
  nameEn: "Demi Trainer",
  cardType: "UNIT",
  color: "white",
  level: 1,
  cost: 1,
  ap: 1,
  hp: 1,
  traits: ["Academy"],
  effectKeywords: ["Blocker"],
  keywordTags: ["Blocker"],
};

const ZOWORT: CardDef = {
  code: "ST01-009",
  nameEn: "Zowort",
  cardType: "UNIT",
  color: "white",
  level: 2,
  cost: 2,
  ap: 3,
  hp: 2,
  traits: ["Academy"],
  effectKeywords: ["Blocker"],
  keywordTags: ["Blocker"],
  // + "This Unit can't choose the enemy player as its attack target." — restrição
  // estática de alvo de ataque, não modelada ainda (nem keyword de motor nem
  // EffectSpec cobrem "restringir a legalidade da própria declaração de
  // ataque" hoje — ver docs/18, tabela de cobertura ST01).
};

const AMURO_RAY: CardDef = {
  code: "ST01-010",
  nameEn: "Amuro Ray",
  cardType: "PILOT",
  color: "blue",
  level: 4,
  cost: 1,
  traits: ["Earth Federation", "White Base Team", "Newtype"],
  triggerKeywords: ["Burst", "When Paired"],
  keywordTags: ["Burst", "When Paired"],
  hasBurst: true,
};

const SULETTA_MERCURY: CardDef = {
  code: "ST01-011",
  nameEn: "Suletta Mercury",
  cardType: "PILOT",
  color: "white",
  level: 4,
  cost: 1,
  traits: ["Academy"],
  triggerKeywords: ["Burst", "Attack"],
  effectKeywords: ["Once per Turn"],
  keywordTags: ["Burst", "Attack", "Once per Turn"],
  hasBurst: true,
  oncePerTurn: true,
};

const THOROUGHLY_DAMAGED: CardDef = {
  code: "ST01-012",
  nameEn: "Thoroughly Damaged",
  cardType: "COMMAND",
  color: "blue",
  level: 2,
  cost: 1,
  triggerKeywords: ["Main"],
  keywordTags: ["Main"],
  // + "【Pilot】[Hayato Kobayashi]" — exige Hayato Kobayashi pareado pra poder
  // jogar a carta; é uma restrição de legalidade de jogo (não um efeito que
  // produz GameEvent), fora do escopo do EffectSpec — ver docs/18.
};

const KAIS_RESOLVE: CardDef = {
  code: "ST01-013",
  nameEn: "Kai's Resolve",
  cardType: "COMMAND",
  color: "blue",
  level: 3,
  cost: 1,
  triggerKeywords: ["Main"],
  keywordTags: ["Main"],
  // + "【Pilot】[Kai Shiden]" — mesma observação de ST01-012.
};

const UNFORESEEN_INCIDENT: CardDef = {
  code: "ST01-014",
  nameEn: "Unforeseen Incident",
  cardType: "COMMAND",
  color: "white",
  level: 3,
  cost: 1,
  triggerKeywords: ["Burst", "Main", "Action"],
  keywordTags: ["Burst", "Main", "Action"],
  hasBurst: true,
};

const WHITE_BASE: CardDef = {
  code: "ST01-015",
  nameEn: "White Base",
  cardType: "BASE",
  color: "blue",
  level: 3,
  cost: 2,
  hp: 5,
  traits: ["Earth Federation", "White Base Team", "Warship"],
  triggerKeywords: ["Burst", "Deploy"],
  effectKeywords: ["Activate · Main", "Once per Turn"],
  keywordTags: ["Burst", "Deploy", "Activate · Main", "Once per Turn"],
  hasBurst: true,
  oncePerTurn: true,
  // 【Activate･Main】【Once per Turn】②：deploy token condicional por
  // quantidade de Units em campo — fora do escopo desta wave: precisa de (a)
  // uma primitiva de "criar instância nova a partir de um CardDef" (hoje só
  // `setup.ts` instancia carta, e só no setup inicial — nenhum GameEvent
  // cobre "criar token"), e (b) uma primitiva de "pagar custo de recurso
  // genérico" (hoje só existe custo expresso como PrimitiveCall[], sem
  // noção de gastar recurso). Ver docs/18, tabela de cobertura ST01.
};

const ASTICASSIA: CardDef = {
  code: "ST01-016",
  nameEn: "Asticassia School of Technology, Earth House",
  cardType: "BASE",
  color: "white",
  level: 2,
  cost: 1,
  hp: 5,
  traits: ["Academy", "Stronghold"],
  triggerKeywords: ["Burst", "Deploy"],
  effectKeywords: ["Activate · Main"],
  keywordTags: ["Burst", "Deploy", "Activate · Main"],
  hasBurst: true,
  // 【Activate･Main】Rest this Base：All friendly Link Units get AP+1 during
  // this turn — fora do escopo desta wave: `TargetRef`/`resolveTarget` hoje
  // só resolvem 1 instanceId por primitiva (mesmo `{kind:"named"}` usa só
  // `group[0]`), não têm um jeito de aplicar a mesma primitiva a um GRUPO
  // inteiro de alvos ("all friendly Link Units"). Ver docs/18, tabela de
  // cobertura ST01.
};

const RESOURCE: CardDef = {
  code: "ST01-RESOURCE",
  nameEn: "Resource",
  cardType: "RESOURCE",
  color: "colorless",
};

function copies(def: CardDef, n: number): CardDef[] {
  return Array.from({ length: n }, () => def);
}

/** 50 cartas — distribuição própria dentro do limite de 4 cópias/code (ver nota de fonte acima). */
export function buildSt01MainDeck(): CardDef[] {
  return [
    ...copies(GUNDAM, 2),
    ...copies(GUNDAM_MA_FORM, 2),
    ...copies(GUNCANNON, 4),
    ...copies(GUNTANK, 4),
    ...copies(GM, 4),
    ...copies(AERIAL_SCORE_SIX, 3),
    ...copies(AERIAL_BIT_FORM, 3),
    ...copies(DEMI_TRAINER, 4),
    ...copies(ZOWORT, 4),
    ...copies(AMURO_RAY, 3),
    ...copies(SULETTA_MERCURY, 3),
    ...copies(THOROUGHLY_DAMAGED, 4),
    ...copies(KAIS_RESOLVE, 3),
    ...copies(UNFORESEEN_INCIDENT, 3),
    ...copies(WHITE_BASE, 2),
    ...copies(ASTICASSIA, 2),
  ];
}

/** 10 cartas — resource deck genérico, igual ao que vem fisicamente no produto (10 Resource Cards). */
export function buildSt01ResourceDeck(): CardDef[] {
  return copies(RESOURCE, 10);
}

export function buildSt01DeckList(): DeckList {
  return { main: buildSt01MainDeck(), resources: buildSt01ResourceDeck() };
}

export const ST01_CARD_DEFS = {
  GUNDAM,
  GUNDAM_MA_FORM,
  GUNCANNON,
  GUNTANK,
  GM,
  AERIAL_SCORE_SIX,
  AERIAL_BIT_FORM,
  DEMI_TRAINER,
  ZOWORT,
  AMURO_RAY,
  SULETTA_MERCURY,
  THOROUGHLY_DAMAGED,
  KAIS_RESOLVE,
  UNFORESEEN_INCIDENT,
  WHITE_BASE,
  ASTICASSIA,
  RESOURCE,
};
