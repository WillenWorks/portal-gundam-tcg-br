import { describe, expect, it } from "vitest";
import {
  analyzeOpponentDeck,
  buildZeroCounterDeck,
  recommendCounterPersona,
  validateGeneratedDeckLegality,
} from "./zeroCounterDeckBuilder";
import { buildSt01DeckList } from "../../fixtures/st01Deck";
import { buildSt02DeckList } from "../../fixtures/st02Deck";
import { buildSt03DeckList } from "../../fixtures/st03Deck";
import { buildSt07DeckList } from "../../fixtures/st07Deck";
import { buildSt08DeckList } from "../../fixtures/st08Deck";
import type { CardDef } from "../types";

describe("Zero Pilot Nível 4: zeroCounterDeckBuilder", () => {
  it("analisa oponente ST03 (Zeon Rush) e classifica corretamente como aggro", () => {
    const st03 = buildSt03DeckList();
    const profile = analyzeOpponentDeck(st03);

    expect(profile.archetype).toBe("aggro");
    expect(profile.primaryColor).toBe("red");
    expect(profile.keywords.rush).toBeGreaterThanOrEqual(2);

    const recommended = recommendCounterPersona(profile);
    // Para aggro, o Zero System recomenda contenção e blockers (Amuro Ray)
    expect(recommended).toBe("amuro");
  });

  it("analisa oponente ST08 (Hathaway's Flash / Xi Gundam) e identifica curva alta / controle", () => {
    const st08 = buildSt08DeckList();
    const profile = analyzeOpponentDeck(st08);

    expect(["control", "midrange_synergy"]).toContain(profile.archetype);
    expect(["red", "blue"]).toContain(profile.primaryColor);
    expect(profile.curve.high).toBeGreaterThan(0);
  });

  it("gera counter-deck legal para a persona Amuro Ray", () => {
    const result = buildZeroCounterDeck({ persona: "amuro" });

    expect(result.persona).toBe("amuro");
    expect(result.deck.main.length).toBe(50);
    expect(result.deck.resources.length).toBe(10);

    const legality = validateGeneratedDeckLegality(result.deck);
    expect(legality.valid).toBe(true);
    expect(legality.issues).toHaveLength(0);

    // Contém Mobile Suits e pilotos icônicos da Federação
    const rx78 = result.deck.main.filter((c) => c.code === "ST01-001" || c.code === "ST01-002");
    expect(rx78.length).toBeGreaterThan(0);
  });

  it("gera counter-deck legal para a persona Char Aznable", () => {
    const result = buildZeroCounterDeck({ persona: "char" });

    expect(result.persona).toBe("char");
    expect(result.deck.main.length).toBe(50);
    expect(result.deck.resources.length).toBe(10);

    const legality = validateGeneratedDeckLegality(result.deck);
    expect(legality.valid).toBe(true);
    expect(legality.issues).toHaveLength(0);

    // Deck Red + Green de Zeon
    const zeonCards = result.deck.main.filter((c) => c.color === "red" || c.color === "green");
    expect(zeonCards.length).toBe(50);
  });

  it("gera counter-deck legal para a persona Heero Yuy", () => {
    const result = buildZeroCounterDeck({ persona: "heero" });

    expect(result.persona).toBe("heero");
    expect(result.deck.main.length).toBe(50);
    expect(result.deck.resources.length).toBe(10);

    const legality = validateGeneratedDeckLegality(result.deck);
    expect(legality.valid).toBe(true);
    expect(legality.issues).toHaveLength(0);

    const wing = result.deck.main.filter((c) => c.code === "ST02-001" || c.code === "ST02-002");
    expect(wing.length).toBeGreaterThan(0);
  });

  it("gera counter-deck legal para a persona Treize Khushrenada com Mobile Suits de Elite", () => {
    const result = buildZeroCounterDeck({ persona: "treize" });

    expect(result.persona).toBe("treize");
    expect(result.deck.main.length).toBe(50);
    expect(result.deck.resources.length).toBe(10);

    const legality = validateGeneratedDeckLegality(result.deck);
    expect(legality.valid).toBe(true);
    expect(legality.issues).toHaveLength(0);

    // Deve conter os Mobile Suits de elite (Xi Gundam ST08-001, Penelope ST08-006)
    const xiGundam = result.deck.main.filter((c) => c.code === "ST08-001");
    const penelope = result.deck.main.filter((c) => c.code === "ST08-006");

    expect(xiGundam.length).toBe(2);
    expect(penelope.length).toBe(2);

    // Notas táticas expressando cavalheirismo e nobreza aristocrática
    expect(result.tacticalNotes.some((note) => note.includes("Treize Khushrenada") && note.includes("gloriosos"))).toBe(true);
  });

  it("adaptação dinâmica: escolhe persona e counter-deck adequado contra oponente Aggro", () => {
    const st03 = buildSt03DeckList();
    const result = buildZeroCounterDeck({
      persona: "adaptive",
      opponentDeck: st03,
    });

    expect(result.persona).toBe("amuro");
    expect(result.deck.main.length).toBe(50);
    expect(result.deck.resources.length).toBe(10);

    const legality = validateGeneratedDeckLegality(result.deck);
    expect(legality.valid).toBe(true);
  });

  it("garante que nenhuma carta no deck gerado ultrapasse o limite de 4 cópias", () => {
    const personas: Array<"amuro" | "char" | "heero" | "treize"> = ["amuro", "char", "heero", "treize"];

    for (const p of personas) {
      const { deck } = buildZeroCounterDeck({ persona: p });
      const counts: Record<string, number> = {};

      for (const card of deck.main) {
        counts[card.code] = (counts[card.code] ?? 0) + 1;
        expect(counts[card.code]).toBeLessThanOrEqual(4);
      }

      expect(deck.main.length).toBe(50);
      expect(deck.resources.length).toBe(10);
    }
  });
});
