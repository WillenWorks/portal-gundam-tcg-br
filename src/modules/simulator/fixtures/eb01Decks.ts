import type { DeckList } from "../engine/setup";
import { buildDeckListFromUserDeck } from "../content/userDeckBuilder";
import { parseDecklistText } from "./metaDecksGd02Era";

/**
 * Decks de teste do EB01 (W11 — fechamento do set): entram no fuzz, no golden e nos presets. Juntos usam quase todo
 * texto novo da W11 (Development 2, "all players look", escopo "all Units", Lv. exato, Pilotos de Repair/Breach…).
 */
export interface Eb01TestDeck {
  id: string;
  label: string;
  list: string;
  build: () => DeckList;
}

function testDeck(id: string, label: string, list: string): Eb01TestDeck {
  return {
    id,
    label,
    list,
    build: () =>
      buildDeckListFromUserDeck({
        id,
        name: label,
        items: parseDecklistText(list).map((e) => ({ quantity: e.quantity, card: { code: e.code } })),
      }),
  };
}

export const EB01_TEST_DECKS: Record<string, Eb01TestDeck> = {
  "EB01-AZUL-BRANCO": testDeck(
    "EB01-AZUL-BRANCO",
    "G Generation Azul/Branco (EB01, teste)",
    `3x EB01-011 Beginning Gundam
3x EB01-013 Red Gundam(0085)
3x EB01-014 Gouf Vijayanta
3x EB01-016 Tornado Gundam
3x EB01-018 Gundam Astray Blue Frame Second L
3x EB01-020 Gundam Mk-Ⅲ
2x EB01-008 Gundam Delta Kai
3x EB01-010 Gundam Barbatos 6th Form
2x EB01-003 Narrative Gundam A-Packs (EX)
2x EB01-004 Gundam Barbatos Lupus Rex (EX)
2x EB01-062 Jona Basta
3x EB01-063 Io Fleming
2x EB01-064 Rondo Gina Sahaku
3x EB01-074 Eternal Road
2x EB01-075 Fierce Enemy Assault
3x EB01-051 Ze'Gok
2x EB01-053 Gundam GP00
2x EB01-055 Dom Gross Beil
2x EB01-058 Extreme Gundam
2x EB01-085 Kudelia Aina Bernstein & Isaribi`,
  ),
  "EB01-VERDE-BRANCO": testDeck(
    "EB01-VERDE-BRANCO",
    "G Generation Verde/Branco (EB01, teste)",
    `4x EB01-031 Oggo
3x EB01-032 Gundam Ez8 High Mobility Custom
3x EB01-033 Taurus (Sanc Kingdom)
3x EB01-036 Darilbalde
3x EB01-037 Zudah Unit 1
3x EB01-028 Gundam Plutone
2x EB01-029 Gundam Astaroth Rinascimento (EX)
2x EB01-023 Le Cygne (EX)
2x EB01-025 Tallgeese Ⅱ
2x EB01-039 Rising Freedom Gundam
3x EB01-066 Reiji
2x EB01-067 Asuna Elmarit
2x EB01-068 Chall Acustica
2x EB01-077 Master League Begins
2x EB01-078 Premium Unit Assembly
2x EB01-079 Modification
1x EB01-042 Psycho Haro (EX)
2x EB01-049 Pale Rider (Ground Heavy Equipment Type)
2x EB01-050 Saikoro Gundam
2x EB01-059 Psycho Zaku
2x EB01-071 Ittou Tsurugi
1x EB01-088 Miorine Rembran & Academy Ship`,
  ),
};
