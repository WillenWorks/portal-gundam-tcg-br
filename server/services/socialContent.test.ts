import { describe, expect, it } from "vitest";
import { rarityAttemptOrder, rarityTier } from "./socialContent";

describe("rodízio de raridade da carta do dia", () => {
  it("normaliza os dois formatos do banco e as artes alternativas", () => {
    expect(rarityTier("Legend Rare")).toBe("LR");
    expect(rarityTier("LR++")).toBe("LR");
    expect(rarityTier("Rare")).toBe("R");
    expect(rarityTier("U+")).toBe("U");
    expect(rarityTier("Common")).toBe("C");
    expect(rarityTier("C++")).toBe("C");
    expect(rarityTier("Promo")).toBeNull();
    expect(rarityTier("TOKEN")).toBeNull();
    expect(rarityTier(null)).toBeNull();
  });

  it("segue LR → R → U → C e volta ao LR", () => {
    expect(rarityAttemptOrder(null)[0]).toBe("LR");
    expect(rarityAttemptOrder("LR")[0]).toBe("R");
    expect(rarityAttemptOrder("R")[0]).toBe("U");
    expect(rarityAttemptOrder("U")[0]).toBe("C");
    expect(rarityAttemptOrder("C")[0]).toBe("LR");
  });

  it("se faltar carta na faixa da vez, tenta as seguintes na ordem do rodízio", () => {
    expect(rarityAttemptOrder("R")).toEqual(["U", "C", "LR", "R"]);
  });
});
