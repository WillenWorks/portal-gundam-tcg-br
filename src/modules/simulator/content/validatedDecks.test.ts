import { describe, expect, it } from "vitest";
import {
  VALIDATED_DECKS,
  checkDeckListLegality,
  deckListToLegalityItems,
  isValidatedDeck,
  validatedDeckList,
} from "./validatedDecks";

describe("VALIDATED_DECKS", () => {
  it("registra exatamente ST01..ST04", () => {
    expect(Object.keys(VALIDATED_DECKS).sort()).toEqual(["ST01", "ST02", "ST03", "ST04"]);
  });

  it("isValidatedDeck reconhece os ids registrados e recusa os demais", () => {
    expect(isValidatedDeck("ST01")).toBe(true);
    expect(isValidatedDeck("ST04")).toBe(true);
    expect(isValidatedDeck("GD01")).toBe(false);
    expect(isValidatedDeck("")).toBe(false);
    expect(isValidatedDeck("toString")).toBe(false);
  });

  for (const deck of validatedDeckList()) {
    describe(deck.label, () => {
      it("constrói 50 cartas no deck principal e 10 no de recursos", () => {
        const list = deck.build();
        expect(list.main).toHaveLength(50);
        expect(list.resources).toHaveLength(10);
      });

      it("passa computeDeckLegality (estrutura, cores, limite de cópias)", () => {
        const result = checkDeckListLegality(deck.build());
        expect(result.issues).toEqual([]);
        expect(result.valid).toBe(true);
      });

      it("nenhuma carta do deck principal excede 4 cópias", () => {
        const items = deckListToLegalityItems(deck.build()).filter((i) => i.section === "deck");
        for (const item of items) {
          expect(item.quantity).toBeLessThanOrEqual(4);
        }
      });
    });
  }
});
