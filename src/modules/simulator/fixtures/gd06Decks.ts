import type { DeckList } from "../engine/setup";
import { buildDeckListFromUserDeck } from "../content/userDeckBuilder";
import { parseDecklistText } from "./metaDecksGd02Era";

/**
 * Decks de teste do GD06 (W13b — fechamento do set): entram no fuzz, no golden e nos presets. Juntos usam quase todo
 * texto novo da W13 (tokens do Turn X, Hamma-Hamma, Qubeley que redireciona dano, Alphacide, ZZ +1 de dano, Neo Core
 * Fighter, Argama, Eagail, Harry Ord, Duo Maxwell, Infinite Variations…).
 */
export interface Gd06TestDeck {
  id: string;
  label: string;
  list: string;
  build: () => DeckList;
}

function testDeck(id: string, label: string, list: string): Gd06TestDeck {
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

export const GD06_TEST_DECKS: Record<string, Gd06TestDeck> = {
  "GD06-VERDE-ROXO": testDeck(
    "GD06-VERDE-ROXO",
    "Ghingnham / Neo Zeon Verde/Roxo (GD06, teste)",
    `3x GD06-023 Galluss J
3x GD06-032 Bellona
3x GD06-018 Elpeo Ple's Qubeley Mk-Ⅱ
3x GD06-020 Hamma-Hamma
3x GD06-030 Mahiroo
3x GD06-021 Turn X (Top)
3x GD06-026 Stero's Mahiroo
2x GD06-022 Merrybell's Bandit
2x GD06-019 Turn X
2x GD06-063 GFreD
2x GD06-051 GFreD
2x GD06-050 Legend Gundam
2x GD06-084 Elpeo Ple
2x GD06-085 Gym Ghingnham
2x GD06-086 Mashymre Cello
2x GD06-093 Anavel Gato
2x GD06-106 Presence Detected
2x GD06-107 Wheel Spoke Formation
3x GD06-109 God of War Ghingnham
2x GD06-114 Alphaciders
2x GD06-124 Aspite`,
  ),
  "GD06-VERMELHO-BRANCO": testDeck(
    "GD06-VERMELHO-BRANCO",
    "AEUG / Dianna Counter Vermelho/Branco (GD06, teste)",
    `3x GD06-078 WaD
3x GD06-039 Neo Core Fighter
3x GD06-044 Core Top
3x GD06-045 Core Base
3x GD06-077 Cannon Illfuto
3x GD06-046 Hyaku-Shiki
3x GD06-035 Zeta Gundam
2x GD06-037 Reginlaze Julia
3x GD06-070 Eagail
2x GD06-065 SUMO Gold Type
2x GD06-033 ZZ Gundam
2x GD06-088 Judau Ashta
2x GD06-091 Roux Louka
2x GD06-090 Vidar
2x GD06-097 Harry Ord
2x GD06-098 Duo Maxwell
2x GD06-110 Familial Love
2x GD06-112 Rivalry with Roux
2x GD06-118 Infinite Variations
2x GD06-120 Hoping for Peace
2x GD06-125 Argama`,
  ),
};
