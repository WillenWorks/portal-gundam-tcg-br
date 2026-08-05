import { describe, expect, it } from "vitest";
import { computeDeckLegality, type DeckLegalityData, type DeckLegalityItem } from "./deck-legality.ts";

const emptyLegality: DeckLegalityData = { banned: new Set(), restricted: new Map(), banGroups: new Map() };

function legalMain(overrides: Partial<DeckLegalityItem> = {}): DeckLegalityItem {
  return { cardModelId: "m1", cardType: "UNIT", color: "Blue", quantity: 4, section: "main", ...overrides };
}

/** Monta um deck principal de 50 cartas + 10 de recurso legais, só pra servir
 *  de base e depois quebrar uma regra específica por teste. */
function baseLegalDeck(): DeckLegalityItem[] {
  const main: DeckLegalityItem[] = [];
  for (let i = 0; i < 12; i++) main.push(legalMain({ cardModelId: `u${i}`, quantity: 4 }));
  main.push(legalMain({ cardModelId: "u12", quantity: 2 }));
  const resource: DeckLegalityItem[] = [{ cardModelId: "r1", cardType: "RESOURCE", color: null, quantity: 10, section: "resource" }];
  return [...main, ...resource];
}

describe("computeDeckLegality", () => {
  it("aceita um deck com 50 no principal, 10 de recurso, 1 cor — sem problema nenhum", () => {
    const result = computeDeckLegality(baseLegalDeck(), emptyLegality);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("acusa deck principal fora de 50 cartas", () => {
    const deck = baseLegalDeck().filter((item) => item.cardModelId !== "u12"); // tira 2, fica 48
    const result = computeDeckLegality(deck, emptyLegality);
    expect(result.valid).toBe(false);
    expect(result.issues.find((i) => i.type === "main_size")?.message).toContain("48");
  });

  it("acusa deck de recursos fora de 10 cartas", () => {
    const deck = baseLegalDeck().map((item) => (item.section === "resource" ? { ...item, quantity: 8 } : item));
    const result = computeDeckLegality(deck, emptyLegality);
    expect(result.issues.some((i) => i.type === "resource_size")).toBe(true);
  });

  it("acusa mais de 2 cores no deck principal", () => {
    const deck = baseLegalDeck();
    deck[0] = { ...deck[0], color: "Green" };
    deck[1] = { ...deck[1], color: "Red" };
    deck[2] = { ...deck[2], color: "White" };
    const result = computeDeckLegality(deck, emptyLegality);
    const issue = result.issues.find((i) => i.type === "too_many_colors");
    expect(issue).toBeDefined();
    expect(issue!.message).toContain("Blue");
  });

  it("acusa carta banida presente no deck (0 cópias permitidas)", () => {
    const legality: DeckLegalityData = { ...emptyLegality, banned: new Set(["u0"]) };
    const result = computeDeckLegality(baseLegalDeck(), legality);
    expect(result.issues.some((i) => i.type === "banned" && i.cardModelId === "u0")).toBe(true);
  });

  it("acusa carta restrita além do limite (ex: Corsica Base, restrita a 2)", () => {
    const legality: DeckLegalityData = { ...emptyLegality, restricted: new Map([["u0", 2]]) };
    const result = computeDeckLegality(baseLegalDeck(), legality); // u0 tem 4 cópias no deck base
    const issue = result.issues.find((i) => i.type === "over_copy_limit" && i.cardModelId === "u0");
    expect(issue).toBeDefined();
    expect(issue!.message).toContain("restrita");
  });

  it("não acusa cópia acima de 4 quando a carta não está restrita nem banida (regra padrão já é 4)", () => {
    const result = computeDeckLegality(baseLegalDeck(), emptyLegality);
    expect(result.issues.some((i) => i.type === "over_copy_limit")).toBe(false);
  });

  it("caso real: par banido (Amuro Ray x Mikazuki Augus) — duas cartas do mesmo grupo, maxDistinct 1", () => {
    const legality: DeckLegalityData = {
      ...emptyLegality,
      banGroups: new Map([["pair1", { label: "Amuro Ray x Mikazuki Augus", maxDistinct: 1, memberIds: new Set(["amuro", "mikazuki"]) }]]),
    };
    const deck = baseLegalDeck();
    deck[0] = { ...deck[0], cardModelId: "amuro" };
    deck[1] = { ...deck[1], cardModelId: "mikazuki" };
    const result = computeDeckLegality(deck, legality);
    expect(result.issues.some((i) => i.type === "ban_group")).toBe(true);
  });

  it("grupo banido não acusa nada se só uma carta distinta do grupo está no deck", () => {
    const legality: DeckLegalityData = {
      ...emptyLegality,
      banGroups: new Map([["pair1", { label: "Amuro Ray x Mikazuki Augus", maxDistinct: 1, memberIds: new Set(["amuro", "mikazuki"]) }]]),
    };
    const deck = baseLegalDeck();
    deck[0] = { ...deck[0], cardModelId: "amuro" };
    const result = computeDeckLegality(deck, legality);
    expect(result.issues.some((i) => i.type === "ban_group")).toBe(false);
  });

  it("caso real: categoria genérica de vanillas — grupo com muitos membros, mesmo mecanismo do par banido", () => {
    const vanillaCodes = ["GD01-008", "GD01-035", "GD01-060", "GD02-013", "ST01-005"];
    const legality: DeckLegalityData = {
      ...emptyLegality,
      banGroups: new Map([["vanillas", { label: "Unit Lv.2/custo 1/2AP/2HP sem efeito", maxDistinct: 1, memberIds: new Set(vanillaCodes) }]]),
    };
    const deck = baseLegalDeck();
    deck[0] = { ...deck[0], cardModelId: "GD01-008", quantity: 4 };
    deck[1] = { ...deck[1], cardModelId: "GD01-035", quantity: 2 };
    const result = computeDeckLegality(deck, legality);
    expect(result.issues.some((i) => i.type === "ban_group")).toBe(true);
  });
});
