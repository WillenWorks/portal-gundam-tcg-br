import type { CardDef } from "../engine/types";
import type { DeckList } from "../engine/setup";

/**
 * Deck de teste "vanilla" — passo 2 do plano incremental (docs/18): valida
 * turno/zonas/combate usando só stats + keywords oficiais (que já são dado
 * estruturado hoje, ver `CardModel.effectKeywords`/`keywordTags`), sem
 * nenhum efeito bespoke de texto livre. Cobre as 8 keywords/mecânicas da
 * tabela de docs/18: Blocker, First Strike, High-Maneuver, Support N,
 * Repair N, Breach N, Suppression, 【Once per Turn】.
 *
 * Não é um deck real do catálogo — são `CardDef` sintéticos, propositalmente
 * simples, só pra exercitar o motor. Cartas de efeito bespoke (a maioria de
 * ST01-04+GD01, ~174 de 216 cartas por contagem ao vivo do banco) ficam pro
 * passo 3, quando um deck de teste real for escolhido.
 */

function unit(code: string, cost: number, level: number, ap: number, hp: number, opts: Partial<CardDef> = {}): CardDef {
  return { code, nameEn: code, cardType: "UNIT", color: "blue", cost, level, ap, hp, ...opts };
}

const VANILLA_01 = unit("VANILLA-01", 1, 1, 1, 1);
const VANILLA_02 = unit("VANILLA-02", 2, 2, 2, 2);
const VANILLA_03 = unit("VANILLA-03", 3, 3, 3, 2);
const VANILLA_04 = unit("VANILLA-04", 4, 4, 3, 4);

const BLOCKER_01 = unit("BLOCKER-01", 2, 2, 1, 3, { effectKeywords: ["Blocker"] });
const FIRST_STRIKE_01 = unit("FIRSTSTRIKE-01", 3, 3, 2, 2, { effectKeywords: ["First Strike"] });
const HIGH_MANEUVER_01 = unit("HIGHMANEUVER-01", 3, 3, 3, 2, { effectKeywords: ["High-Maneuver"] });
const SUPPORT_01 = unit("SUPPORT-01", 2, 2, 1, 2, {
  effectKeywords: ["Support"],
  keywordTags: ["Support 1"],
  oncePerTurn: true,
});
const REPAIR_01 = unit("REPAIR-01", 3, 3, 2, 3, { effectKeywords: ["Repair"], keywordTags: ["Repair 1"] });
const BREACH_01 = unit("BREACH-01", 4, 4, 3, 3, { effectKeywords: ["Breach"], keywordTags: ["Breach 1"] });
const SUPPRESSION_01 = unit("SUPPRESSION-01", 5, 5, 4, 4, { effectKeywords: ["Suppression"] });
const HEAVY_01 = unit("HEAVY-01", 5, 5, 5, 5);

const PILOT_01: CardDef = { code: "PILOT-01", nameEn: "PILOT-01", cardType: "PILOT", color: "blue", cost: 1, level: 1 };
const BASE_01: CardDef = { code: "BASE-01", nameEn: "BASE-01", cardType: "BASE", color: "blue", cost: 2, hp: 4 };
const RESOURCE_01: CardDef = { code: "RESOURCE-01", nameEn: "RESOURCE-01", cardType: "RESOURCE", color: "blue" };

function copies(def: CardDef, n: number): CardDef[] {
  return Array.from({ length: n }, () => def);
}

/** 50 cartas — dentro do limite de 4 cópias por code (docs/14). */
export function buildVanillaMainDeck(): CardDef[] {
  return [
    ...copies(VANILLA_01, 4),
    ...copies(VANILLA_02, 4),
    ...copies(VANILLA_03, 4),
    ...copies(VANILLA_04, 4),
    ...copies(BLOCKER_01, 4),
    ...copies(FIRST_STRIKE_01, 4),
    ...copies(HIGH_MANEUVER_01, 4),
    ...copies(SUPPORT_01, 4),
    ...copies(REPAIR_01, 4),
    ...copies(BREACH_01, 3),
    ...copies(SUPPRESSION_01, 2),
    ...copies(PILOT_01, 4),
    ...copies(BASE_01, 3),
    ...copies(HEAVY_01, 2),
  ];
}

/** 10 cartas — resource deck não tem limite de cópia entre si (docs/14). */
export function buildVanillaResourceDeck(): CardDef[] {
  return copies(RESOURCE_01, 10);
}

export function buildVanillaDeckList(): DeckList {
  return { main: buildVanillaMainDeck(), resources: buildVanillaResourceDeck() };
}

export const VANILLA_CARD_DEFS = {
  VANILLA_01,
  VANILLA_02,
  VANILLA_03,
  VANILLA_04,
  BLOCKER_01,
  FIRST_STRIKE_01,
  HIGH_MANEUVER_01,
  SUPPORT_01,
  REPAIR_01,
  BREACH_01,
  SUPPRESSION_01,
  HEAVY_01,
  PILOT_01,
  BASE_01,
  RESOURCE_01,
};
