import { describe, expect, it } from "vitest";
import { isCardPlayable, validateDeckPayload } from "./deckCoverageGate.ts";
import { GD01_TEST_DECKS } from "../src/modules/simulator/fixtures/gd01TestDecks.ts";
import { GD01_CARD_DEFS } from "../src/modules/simulator/content/gd01.ts";
import type { CardDef } from "../src/modules/simulator/engine/types.ts";
import type { DeckList } from "../src/modules/simulator/engine/setup.ts";

/**
 * server/deckCoverageGate.test.ts (docs/debates 2026-09-13, Etapa 1) —
 * cobertura unitária do gate de segurança que faltava: `validateDeckPayload`
 * já protege queue/join, training/new e o endpoint de debug, mas nunca tinha
 * teste dedicado. Achado desta bateria: sem checar o código contra o
 * catálogo oficial, um `cardCode` forjado (`GD01-999`) caía no fallback
 * "sem texto de efeito -> vanilla -> jogável" — corrigido em
 * `deckCoverageGate.ts` (`KNOWN_CODES`) junto com este teste.
 */

const GENERIC_RESOURCE: CardDef = { code: "GD01-RESOURCE", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" };

function deckOf(main: CardDef[]): DeckList {
  return { main, resources: [GENERIC_RESOURCE] };
}

describe("deckCoverageGate — decks válidos (90 cartas GD01)", () => {
  it("aprova os 4 decks de fixtures/gd01TestDecks.ts (só usam o pool jogável)", () => {
    for (const [key, deck] of Object.entries(GD01_TEST_DECKS)) {
      const validation = validateDeckPayload(deck.build());
      expect(validation.valid, `${key}: ${JSON.stringify(validation.unplayableCards)}`).toBe(true);
      expect(validation.unplayableCards).toEqual([]);
    }
  });

  it("isCardPlayable aprova individualmente uma carta vanilla e uma implementada", () => {
    expect(isCardPlayable(GD01_CARD_DEFS["GD01-035"])).toBe(true); // Zaku Ⅱ, vanilla
    expect(isCardPlayable(GD01_CARD_DEFS["GD01-008"])).toBe(true); // Guntank, implementada (EffectSpec real)
  });

  it("aprova a carta de recurso genérica (placeholder do motor, não catalogada de propósito)", () => {
    expect(isCardPlayable(GENERIC_RESOURCE)).toBe(true);
  });
});

describe("deckCoverageGate — decks com carta deferida (content/deferred.ts)", () => {
  it("rejeita um deck com 1 carta deferida (GD01-002 Unicorn Gundam Destroy Mode) misturada com cartas válidas", () => {
    const deck = deckOf([GD01_CARD_DEFS["GD01-008"], GD01_CARD_DEFS["GD01-035"], GD01_CARD_DEFS["GD01-002"]]);
    const validation = validateDeckPayload(deck);
    expect(validation.valid).toBe(false);
    expect(validation.unplayableCards).toEqual(["GD01-002"]);
  });

  it("relata TODAS as cartas deferidas do deck, não só a primeira", () => {
    const deck = deckOf([GD01_CARD_DEFS["GD01-002"], GD01_CARD_DEFS["GD01-003"], GD01_CARD_DEFS["GD01-044"]]);
    const validation = validateDeckPayload(deck);
    expect(validation.valid).toBe(false);
    expect(validation.unplayableCards).toEqual(["GD01-002", "GD01-003", "GD01-044"]);
  });

  it("isCardPlayable rejeita diretamente uma carta deferida", () => {
    expect(isCardPlayable(GD01_CARD_DEFS["GD01-002"])).toBe(false);
  });
});

describe("deckCoverageGate — códigos de carta inexistentes/fora do catálogo", () => {
  it("rejeita estritamente um cardCode que não existe em nenhum catálogo (GD01-999)", () => {
    const forged: CardDef = { code: "GD01-999", nameEn: "Carta Forjada", cardType: "UNIT", color: "blue" };
    expect(isCardPlayable(forged)).toBe(false);
    const validation = validateDeckPayload(deckOf([GD01_CARD_DEFS["GD01-008"], forged]));
    expect(validation.valid).toBe(false);
    expect(validation.unplayableCards).toEqual(["GD01-999"]);
  });

  it("rejeita um cardCode de outra wave sem cobertura no motor (GD02-001, real no catálogo mas 0% implementado)", () => {
    const gd02Card: CardDef = { code: "GD02-001", nameEn: "Psycho Gundam", cardType: "UNIT", color: "red" };
    expect(isCardPlayable(gd02Card)).toBe(false);
    const validation = validateDeckPayload(deckOf([GD01_CARD_DEFS["GD01-008"], gd02Card]));
    expect(validation.valid).toBe(false);
    expect(validation.unplayableCards).toEqual(["GD02-001"]);
  });
});
