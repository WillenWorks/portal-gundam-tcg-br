import type { DeckList } from "../engine/setup";
import { buildDeckListFromUserDeck } from "../content/userDeckBuilder";
import { parseDecklistText } from "./metaDecksGd02Era";

/**
 * Decks de teste do ST10 (W9 — fechamento do set): entram no fuzz, no golden e nos presets. As receitas oficiais com
 * ST10 (deck-032/033/035) dependem do EB01, que ainda não está no motor — por isso 2 decks de teste: o ST10 puro
 * (Development N, Barbatos, Zeta) e o ST10 com o ST01 (azul/branco) por cima.
 */
export interface St10TestDeck {
  id: string;
  label: string;
  list: string;
  build: () => DeckList;
}

function testDeck(id: string, label: string, list: string): St10TestDeck {
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

export const ST10_TEST_DECKS: Record<string, St10TestDeck> = {
  "ST10-G-GENERATION": testDeck(
    "ST10-G-GENERATION",
    "G Generation Azul/Branco (ST10, teste)",
    `3x ST10-001 Zeta Gundam (EX)
4x ST10-002 Zeta Gundam
3x ST10-003 Gundam Mk-II (AEUG)
3x ST10-004 Super Gundam
3x ST10-005 Nemo
3x ST10-006 Phoenix Gundam (Power Unleashed) (EX)
4x ST10-007 Gundam Barbatos 4th Form
4x ST10-008 Gundam Barbatos 1st Form
3x ST10-009 Graze Duel Type
3x ST10-010 Mobile Worker (Tekkadan)
4x ST10-011 Kamille Bidan
4x ST10-012 Mark Guilder
3x ST10-013 Tactical Training
3x ST10-014 Unlocking the Development Diagram
2x ST10-015 Diffuse Beam Cannon
1x ST10-016 Luna Mana & Carry Base`,
  ),
  "ST10-ST01-MISTO": testDeck(
    "ST10-ST01-MISTO",
    "G Generation + White Base (ST10/ST01, teste)",
    `4x ST10-002 Zeta Gundam
4x ST10-006 Phoenix Gundam (Power Unleashed) (EX)
3x ST10-007 Gundam Barbatos 4th Form
4x ST10-008 Gundam Barbatos 1st Form
4x ST10-011 Kamille Bidan
3x ST10-012 Mark Guilder
3x ST10-014 Unlocking the Development Diagram
2x ST10-016 Luna Mana & Carry Base
4x ST01-001 Gundam
4x ST01-005 GM
3x ST01-003 Guncannon
4x ST01-010 Amuro Ray
3x ST01-008 Demi Trainer
3x ST01-013 Kai's Resolve
2x ST01-015 White Base`,
  ),
};
