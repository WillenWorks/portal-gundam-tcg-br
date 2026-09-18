import type { CardDef } from "../engine/types";
import { ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { ST02_CARD_DEFS } from "../fixtures/st02Deck";
import { ST03_CARD_DEFS } from "../fixtures/st03Deck";
import { ST04_CARD_DEFS } from "../fixtures/st04Deck";
import { ST05_CARD_DEFS } from "../fixtures/st05Deck";
import { ST06_CARD_DEFS } from "../fixtures/st06Deck";
import { ST07_CARD_DEFS } from "../fixtures/st07Deck";
import { ST08_CARD_DEFS } from "../fixtures/st08Deck";
import { GD01_CARD_DEFS } from "./gd01";
import { GD02_CARD_DEFS } from "./gd02";
import { GD03_CARD_DEFS } from "./gd03";

/**
 * Catálogo canônico de todas as definições de cartas (CardDef) oficiais
 * atualmente implementadas no motor do simulador (ST01..ST08, GD01..GD03).
 *
 * Indexado pelo código oficial da carta em maiúsculas (ex: "ST01-001", "GD01-001", "GD02-001", "GD03-001").
 */
export const ALL_CARD_DEFS: Record<string, CardDef> = {
  ...Object.values(ST01_CARD_DEFS).reduce((acc, c) => ({ ...acc, [c.code.toUpperCase()]: c }), {}),
  ...Object.values(ST02_CARD_DEFS).reduce((acc, c) => ({ ...acc, [c.code.toUpperCase()]: c }), {}),
  ...Object.values(ST03_CARD_DEFS).reduce((acc, c) => ({ ...acc, [c.code.toUpperCase()]: c }), {}),
  ...Object.values(ST04_CARD_DEFS).reduce((acc, c) => ({ ...acc, [c.code.toUpperCase()]: c }), {}),
  ...Object.values(ST05_CARD_DEFS).reduce((acc, c) => ({ ...acc, [c.code.toUpperCase()]: c }), {}),
  ...Object.values(ST06_CARD_DEFS).reduce((acc, c) => ({ ...acc, [c.code.toUpperCase()]: c }), {}),
  ...Object.values(ST07_CARD_DEFS).reduce((acc, c) => ({ ...acc, [c.code.toUpperCase()]: c }), {}),
  ...Object.values(ST08_CARD_DEFS).reduce((acc, c) => ({ ...acc, [c.code.toUpperCase()]: c }), {}),
  ...Object.values(GD01_CARD_DEFS).reduce((acc, c) => ({ ...acc, [c.code.toUpperCase()]: c }), {}),
  ...Object.values(GD02_CARD_DEFS).reduce((acc, c) => ({ ...acc, [c.code.toUpperCase()]: c }), {}),
  ...Object.values(GD03_CARD_DEFS).reduce((acc, c) => ({ ...acc, [c.code.toUpperCase()]: c }), {}),
};

/**
 * Busca a CardDef correspondente pelo código da carta (case-insensitive).
 */
export function getCardDefByCode(code: string): CardDef | undefined {
  if (!code) return undefined;
  return ALL_CARD_DEFS[code.toUpperCase()];
}

/**
 * Verifica se um código de carta possui implementação no motor do simulador.
 */
export function isCardSupportedInSimulator(code: string): boolean {
  if (!code) return false;
  return Boolean(ALL_CARD_DEFS[code.toUpperCase()]);
}
