import type { DeckList } from "../engine/setup";
import { buildDeckListFromUserDeck } from "../content/userDeckBuilder";
import { parseDecklistText } from "./metaDecksGd02Era";

/**
 * Decks do ST09 "Destiny Ignition" (W6 — fechamento do set): entram no fuzz, no golden e nos presets.
 * O ST09 é um Ultimate Deck: só 10 cartas novas, completadas por reimpressões de ST04/GD01/GD02, e o
 * produto monta dois decks. As listas são as duas receitas oficiais desses decks (deck-026 e deck-027,
 * publicadas com o lançamento de 27/03/2026); juntas usam as 10 cartas do ST09.
 *
 * Resource deck: as receitas não trazem; completa com 10 recursos da cor principal (regra de
 * `buildDeckListFromUserDeck`).
 */
export interface St09Deck {
  id: string;
  label: string;
  source: string;
  list: string;
  build: () => DeckList;
}

const OFFICIAL = "https://www.gundam-gcg.com/en/decks";

function officialDeck(id: string, label: string, source: string, list: string): St09Deck {
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

export const ST09_DECKS: Record<string, St09Deck> = {
  "ST09-PURPLE-WHITE": officialDeck(
    "ST09-PURPLE-WHITE",
    "Minerva Squad Roxo/Branco (ST09, oficial)",
    `${OFFICIAL}/deck-026.php`,
    `4x ST09-001 Impulse Gundam
4x ST09-002 Force Impulse Gundam
4x ST09-004 Freedom Gundam
4x ST09-005 Zaku Warrior
4x ST09-006 Sword Impulse Gundam
4x ST09-007 Blast Impulse Gundam
4x ST09-008 Shinn Asuka
4x ST09-010 Minerva
3x ST04-002 Strike Gundam
4x ST04-010 Kira Yamato
2x ST04-015 Archangel
2x GD02-076 Buster Gundam
3x GD02-110 Awakened Power
4x GD01-118 Overflowing Affection`,
  ),
  "ST09-RED-PURPLE": officialDeck(
    "ST09-RED-PURPLE",
    "Minerva Squad Vermelho/Roxo (ST09, oficial)",
    `${OFFICIAL}/deck-027.php`,
    `4x ST09-001 Impulse Gundam
4x ST09-002 Force Impulse Gundam
4x ST09-003 Saviour Gundam
4x ST09-005 Zaku Warrior
4x ST09-006 Sword Impulse Gundam
4x ST09-007 Blast Impulse Gundam
4x ST09-008 Shinn Asuka
2x ST09-009 Giant Killing
3x ST09-010 Minerva
4x ST04-007 Aegis Gundam (MA Mode)
4x ST04-011 Athrun Zala
2x ST04-016 Vesalius
3x GD01-049 Blitz Gundam
4x GD01-054 Duel Gundam`,
  ),
};
