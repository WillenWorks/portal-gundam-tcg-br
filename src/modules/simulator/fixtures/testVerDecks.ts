import type { DeckList } from "../engine/setup";
import { buildDeckListFromUserDeck } from "../content/userDeckBuilder";
import { parseDecklistText } from "./metaDecksGd02Era";

/**
 * Os 2 decks "Test ver." (GD05 + ST11/ST13/ST14), montados para exercitar na tela o que a fase de assertividade
 * cobre: <Blocker>, 【Burst】, 【Activate･Action】 no Action Step (Gundam Aerial), vários ataques no mesmo turno,
 * Base com 【Activate･Main】/【Destroyed】. Pareiam entre si. São fixos no modo contra o bot (e nos presets das
 * outras modalidades) — as cópias salvas no Hangar das contas admin são as mesmas listas.
 *
 * Resource deck: completa com 10 recursos da cor principal (regra de `buildDeckListFromUserDeck`).
 */
export interface TestVerDeck {
  id: string;
  label: string;
  list: string;
  build: () => DeckList;
}

function testDeck(id: string, label: string, list: string): TestVerDeck {
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

export const TEST_VER_DECKS: Record<string, TestVerDeck> = {
  "TEST-LONDO-BELL-ORB": testDeck(
    "TEST-LONDO-BELL-ORB",
    "Londo Bell & Orb Azul/Verde - Test ver.",
    `4x GD05-027
3x GD05-013
4x GD05-029
2x GD05-028
3x GD05-016
3x GD05-005
3x GD05-019
2x GD05-020
2x GD05-021
2x GD05-017
3x GD05-085
2x GD05-086
2x GD05-083
3x GD05-105
3x ST11-013
2x GD05-103
2x GD05-106
3x GD05-125
2x GD05-123`,
  ),
  "TEST-SHUFFLE-ALLIANCE": testDeck(
    "TEST-SHUFFLE-ALLIANCE",
    "Shuffle Alliance Vermelho/Branco - Test ver.",
    `4x GD05-042
3x GD05-075
3x GD05-069
3x GD05-044
3x GD05-066
2x GD05-076
2x GD05-035
2x ST13-006
2x GD05-033
2x ST14-002
3x GD05-097
2x GD05-089
2x ST13-012
3x GD05-110
3x GD05-120
2x GD05-121
2x GD05-111
2x ST13-015
3x GD05-128
2x GD05-130`,
  ),
};
