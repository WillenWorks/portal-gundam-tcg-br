import { describe, expect, it } from "vitest";
import {
  validateDeckWithSideboard,
  applySideboardSwap,
  type DeckListWithSideboard,
} from "./sideboard";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { ST02_CARD_DEFS } from "../fixtures/st02Deck";
import { ST04_CARD_DEFS } from "../fixtures/st04Deck";
import { GD02_CARD_DEFS } from "../content/gd02";

function createMonoBlueSideboardDeck(): DeckListWithSideboard {
  // Main deck: GD02-001 até GD02-012 (4 cópias cada = 48) + GD02-013 (2 cópias) = 50 cartas
  const main: any[] = [];
  for (let i = 1; i <= 12; i++) {
    const code = `GD02-${String(i).padStart(3, "0")}`;
    const def = GD02_CARD_DEFS[code];
    for (let c = 0; c < 4; c++) main.push(def);
  }
  const def13 = GD02_CARD_DEFS["GD02-013"];
  main.push(def13, def13); // 50 cartas 100% azuis

  // Sideboard: GD02-014 (4 cópias) + GD02-015 (4 cópias) + GD02-016 (2 cópias) = 10 cartas
  const sideboard = [
    GD02_CARD_DEFS["GD02-014"],
    GD02_CARD_DEFS["GD02-014"],
    GD02_CARD_DEFS["GD02-014"],
    GD02_CARD_DEFS["GD02-014"],
    GD02_CARD_DEFS["GD02-015"],
    GD02_CARD_DEFS["GD02-015"],
    GD02_CARD_DEFS["GD02-015"],
    GD02_CARD_DEFS["GD02-015"],
    GD02_CARD_DEFS["GD02-016"],
    GD02_CARD_DEFS["GD02-016"],
  ];

  return {
    main,
    resources: [...buildSt01DeckList().resources],
    sideboard,
  };
}

describe("Sideboard — validação estrita de regras", () => {
  it("valida com sucesso um deck com 50 cartas principais, 10 recursos e até 10 no sideboard", () => {
    const deck = createMonoBlueSideboardDeck();
    const result = validateDeckWithSideboard(deck);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.colors).toEqual(["blue"]);
  });

  it("rejeita deck principal com tamanho diferente de 50", () => {
    const deck = createMonoBlueSideboardDeck();
    deck.main = deck.main.slice(0, 49); // 49 cartas
    const result = validateDeckWithSideboard(deck);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "MAIN_DECK_SIZE_INVALID")).toBe(true);
  });

  it("rejeita sideboard com mais de 10 cartas", () => {
    const deck = createMonoBlueSideboardDeck();
    deck.sideboard.push(GD02_CARD_DEFS["GD02-017"]); // 11 cartas
    const result = validateDeckWithSideboard(deck);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "SIDEBOARD_SIZE_EXCEEDED")).toBe(true);
  });

  it("rejeita deck de recursos com tamanho diferente de 10", () => {
    const deck = createMonoBlueSideboardDeck();
    deck.resources = deck.resources.slice(0, 8);
    const result = validateDeckWithSideboard(deck);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "RESOURCES_SIZE_INVALID")).toBe(true);
  });

  it("rejeita quando a soma de cópias entre Main e Sideboard ultrapassa 4", () => {
    const deck = createMonoBlueSideboardDeck();
    // GD02-001 já tem 4 cópias no main
    deck.sideboard[0] = GD02_CARD_DEFS["GD02-001"]; // 4 no main + 1 no side = 5 cópias
    const result = validateDeckWithSideboard(deck);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "TOO_MANY_COPIES")).toBe(true);
  });

  it("permite até 2 cores somadas entre Main e Sideboard", () => {
    const deck = createMonoBlueSideboardDeck();
    // Substitui 2 cartas do sideboard por cartas verdes (ST02)
    deck.sideboard[0] = ST02_CARD_DEFS.WING_GUNDAM;
    deck.sideboard[1] = ST02_CARD_DEFS.HEERO_YUY;
    const result = validateDeckWithSideboard(deck);
    expect(result.valid).toBe(true);
    expect(result.colors).toEqual(["blue", "green"]);
  });

  it("rejeita quando Main + Sideboard ultrapassam 2 cores (ex: Azul + Verde + Vermelho)", () => {
    const deck = createMonoBlueSideboardDeck();
    // Deck principal azul
    // Coloca carta verde no sideboard
    deck.sideboard[0] = ST02_CARD_DEFS.WING_GUNDAM;
    // Coloca carta vermelha/amarela (ST04) no sideboard
    deck.sideboard[1] = ST04_CARD_DEFS.AILE_STRIKE_GUNDAM;
    const result = validateDeckWithSideboard(deck);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "TOO_MANY_COLORS")).toBe(true);
  });
});

describe("Sideboard — trocas táticas (applySideboardSwap)", () => {
  it("realiza troca válida de cartas mantendo 50 cartas no Main Deck", () => {
    const deck = createMonoBlueSideboardDeck();
    const mainCardToOut = deck.main.find((c) => c.code === "GD02-001")!;
    const sideCardToIn = deck.sideboard.find((c) => c.code === "GD02-014")!;

    const newDeck = applySideboardSwap(deck, {
      mainOut: [mainCardToOut.code],
      sideIn: [sideCardToIn.code],
    });

    expect(newDeck.main).toHaveLength(50);
    expect(newDeck.sideboard).toHaveLength(10);
    expect(newDeck.main.filter((c) => c.code === sideCardToIn.code).length).toBe(1);
    expect(newDeck.sideboard.filter((c) => c.code === mainCardToOut.code).length).toBe(1);
  });

  it("rejeita troca com quantidade assimétrica (ex: 2 fora, 1 dentro)", () => {
    const deck = createMonoBlueSideboardDeck();
    expect(() =>
      applySideboardSwap(deck, {
        mainOut: ["GD02-001", "GD02-002"],
        sideIn: ["GD02-014"],
      }),
    ).toThrow(/quantidade retirada/);
  });

  it("rejeita troca se carta a retirar não estiver no Main Deck", () => {
    const deck = createMonoBlueSideboardDeck();
    expect(() =>
      applySideboardSwap(deck, {
        mainOut: ["INEXISTENTE-999"],
        sideIn: [deck.sideboard[0].code],
      }),
    ).toThrow(/não foi encontrada no Main Deck/);
  });

  it("rejeita troca se carta a adicionar não estiver no Sideboard", () => {
    const deck = createMonoBlueSideboardDeck();
    expect(() =>
      applySideboardSwap(deck, {
        mainOut: [deck.main[0].code],
        sideIn: ["INEXISTENTE-999"],
      }),
    ).toThrow(/não foi encontrada no Sideboard/);
  });
});
