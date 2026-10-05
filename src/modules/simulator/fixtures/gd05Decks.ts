import type { DeckList } from "../engine/setup";
import { buildDeckListFromUserDeck } from "../content/userDeckBuilder";
import { parseDecklistText } from "./metaDecksGd02Era";

/**
 * Decks do GD05 "Freedom Ascension" (W8 — fechamento do set): as 5 receitas oficiais publicadas no lançamento
 * (gundam-gcg.com/en/decks/deck-036 a 040). Entram no fuzz, no golden e nos presets. Misturam GD05 com reimpressões
 * de sets que já estão no gate.
 *
 * Resource deck: as receitas não trazem; completa com 10 recursos da cor principal (regra de `buildDeckListFromUserDeck`).
 */
export interface Gd05Deck {
  id: string;
  label: string;
  source: string;
  list: string;
  build: () => DeckList;
}

const OFFICIAL = "https://www.gundam-gcg.com/en/decks";

function officialDeck(id: string, label: string, source: string, list: string): Gd05Deck {
  return {
    id,
    label,
    source,
    list,
    build: () =>
      buildDeckListFromUserDeck({
        id,
        name: label,
        items: parseDecklistText(list).map((e) => ({ quantity: e.quantity, card: { code: e.code } })),
      }),
  };
}

export const GD05_DECKS: Record<string, Gd05Deck> = {
  "GD05-ORB": officialDeck(
    "GD05-ORB",
    "Orb Azul/Branco (GD05, oficial)",
    `${OFFICIAL}/deck-036.php`,
    `4x GD01-118
4x GD05-002
4x GD05-003
4x GD05-004
4x GD05-005
4x GD05-010
4x GD05-015
4x GD05-016
4x GD05-081
4x GD05-082
4x GD05-123
4x ST04-001
2x ST04-010`,
  ),
  "GD05-LONDO-BELL": officialDeck(
    "GD05-LONDO-BELL",
    "Londo Bell Azul/Verde (GD05, oficial)",
    `${OFFICIAL}/deck-037.php`,
    `4x GD01-008
2x GD01-100
4x GD05-017
4x GD05-019
4x GD05-020
4x GD05-023
4x GD05-027
4x GD05-028
4x GD05-029
4x GD05-085
4x GD05-125
4x ST01-001
4x ST01-010`,
  ),
  "GD05-NEO-ZEON": officialDeck(
    "GD05-NEO-ZEON",
    "Neo Zeon Vermelho/Roxo (GD05, oficial)",
    `${OFFICIAL}/deck-038.php`,
    `4x GD01-056
2x GD02-036
2x GD02-047
2x GD04-033
2x GD05-049
2x GD05-052
4x GD05-053
4x GD05-061
4x GD05-062
4x GD05-093
4x GD05-095
4x GD05-110
4x GD05-111
4x GD05-114
4x GD05-129`,
  ),
  "GD05-G-GUNDAM": officialDeck(
    "GD05-G-GUNDAM",
    "G Gundam Vermelho/Branco (GD05, oficial)",
    `${OFFICIAL}/deck-039.php`,
    `4x GD05-033
3x GD05-035
4x GD05-066
4x GD05-069
4x GD05-072
4x GD05-075
4x GD05-089
4x GD05-097
4x GD05-110
3x GD05-112
4x GD05-120
4x GD05-121
4x GD05-128`,
  ),
  "GD05-WING": officialDeck(
    "GD05-WING",
    "Wing Branco/Verde (GD05, oficial)",
    `${OFFICIAL}/deck-040.php`,
    `4x GD01-024
4x GD01-086
4x GD01-118
4x GD02-025
4x GD02-079
4x GD03-125
4x GD05-067
4x GD05-070
4x GD05-071
4x GD05-098
4x GD05-100
4x ST02-001
2x ST02-010`,
  ),
};
