import type { CardDef } from "../engine/types";
import { ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { ST02_CARD_DEFS } from "../fixtures/st02Deck";
import { ST03_CARD_DEFS } from "../fixtures/st03Deck";
import { ST04_CARD_DEFS } from "../fixtures/st04Deck";

/**
 * Catálogo canônico de todas as definições de cartas (CardDef) oficiais
 * atualmente implementadas no motor do simulador (ST01, ST02, ST03 e ST04).
 *
 * Indexado pelo código oficial da carta em maiúsculas (ex: "ST01-001", "ST02-004").
 */
export const ALL_CARD_DEFS: Record<string, CardDef> = {
  ...Object.values(ST01_CARD_DEFS).reduce((acc, c) => ({ ...acc, [c.code.toUpperCase()]: c }), {}),
  ...Object.values(ST02_CARD_DEFS).reduce((acc, c) => ({ ...acc, [c.code.toUpperCase()]: c }), {}),
  ...Object.values(ST03_CARD_DEFS).reduce((acc, c) => ({ ...acc, [c.code.toUpperCase()]: c }), {}),
  ...Object.values(ST04_CARD_DEFS).reduce((acc, c) => ({ ...acc, [c.code.toUpperCase()]: c }), {}),
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
