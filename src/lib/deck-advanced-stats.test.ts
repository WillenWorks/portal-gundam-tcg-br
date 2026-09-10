import { describe, expect, it } from "vitest";
import { computeAdvancedDeckStats } from "./deck-advanced-stats";
import { detectDeckTokens } from "./deck-tokens";

describe("deck-advanced-stats", () => {
  const sampleMainCards = [
    {
      code: "GD01-001",
      name: "Gundam",
      namePt: "Gundam",
      type: "UNIT",
      cost: 3,
      level: 3,
      ap: 4,
      hp: 4,
      color: "BLUE",
      effect: "Burst: Deploy this card. [Link: Amuro Ray]",
      quantity: 4,
      trait: "Earth Federation",
    },
    {
      code: "GD01-026",
      name: "Char's Zaku II",
      namePt: "Zaku II do Char",
      type: "UNIT",
      cost: 2,
      level: 2,
      ap: 3,
      hp: 2,
      color: "RED",
      effect: "Deploy: Generate 1 Char's Zaku II Token with 3 AP and 2 HP.",
      quantity: 4,
      trait: "Zeon",
    },
    {
      code: "GD01-008",
      name: "Guntank",
      namePt: "Guntank",
      type: "UNIT",
      cost: 1,
      level: 1,
      ap: 1,
      hp: 2,
      color: "BLUE",
      effect: "Blocker",
      quantity: 4,
      trait: "White Base Team",
    },
  ];

  it("calculates 6 histograms with correct bins", () => {
    const stats = computeAdvancedDeckStats(sampleMainCards, 12);
    expect(stats.costRange).toBeDefined();
    expect(stats.levelRange).toBeDefined();
    expect(stats.unitCostRange).toBeDefined();
    expect(stats.unitLevelRange).toBeDefined();
    expect(stats.apRange).toBeDefined();
    expect(stats.hpRange).toBeDefined();

    // Cost 1 (Guntank x4), Cost 2 (Char's Zaku II x4), Cost 3 (Gundam x4)
    const cost1Bin = stats.costRange.find((b) => b.label === "1");
    expect(cost1Bin?.count).toBe(4);
    const cost2Bin = stats.costRange.find((b) => b.label === "2");
    expect(cost2Bin?.count).toBe(4);
    const cost3Bin = stats.costRange.find((b) => b.label === "3");
    expect(cost3Bin?.count).toBe(4);
  });

  it("detects Turn 1 playable probability accurately", () => {
    const stats = computeAdvancedDeckStats(sampleMainCards, 12);
    expect(stats.turn1Playable.eligibleCardsCount).toBe(4); // Guntank is cost 1, level <= 1
    expect(stats.turn1Playable.probabilityTurn1WithMulligan).toBeGreaterThan(0);
    expect(stats.turn1Playable.probabilityTurn1WithMulligan).toBeLessThanOrEqual(1);
  });

  it("counts burst and quick reactions correctly", () => {
    const stats = computeAdvancedDeckStats(sampleMainCards, 12);
    expect(stats.burstCount).toBe(4); // Gundam has Burst
    expect(stats.quickCountersCount).toBe(4); // Guntank has Blocker
  });

  it("classifies staples, engine and tech cards", () => {
    const stats = computeAdvancedDeckStats(sampleMainCards, 12);
    expect(stats.metaComparison).toBeDefined();
    expect(stats.metaComparison.deckAvgCost).toBe(2); // (3*4 + 2*4 + 1*4) / 12 = 24 / 12 = 2.0
    expect(stats.metaComparison.speedVerdict).toBe("Rápido / Agressivo");
  });
});

describe("deck-tokens", () => {
  const officialTokens = [
    {
      code: "T-006",
      nameEn: "Char's Zaku II Token",
      namePt: "Token Zaku II do Char",
      ap: 3,
      hp: 2,
      color: "RED",
      trait: "Zeon",
      imageUrl: "https://example.com/t006.jpg",
    },
    {
      code: "T-007",
      nameEn: "Zaku II Token",
      namePt: "Token Zaku II",
      ap: 2,
      hp: 2,
      color: "RED",
      trait: "Zeon",
      imageUrl: "https://example.com/t007.jpg",
    },
  ];

  it("detects tokens when cards mention them in their effects", () => {
    const cards = [
      {
        code: "GD01-026",
        name: "Char's Zaku II",
        effect: "Deploy: Generate 1 Char's Zaku II Token.",
        quantity: 4,
      },
    ];

    const detected = detectDeckTokens(cards, officialTokens);
    expect(detected.length).toBe(1);
    expect(detected[0].tokenCode).toBe("T-006");
    expect(detected[0].ap).toBe(3);
    expect(detected[0].hp).toBe(2);
    expect(detected[0].generatedBy[0].code).toBe("GD01-026");
  });

  it("returns empty array when deck has no token generating cards", () => {
    const cards = [
      {
        code: "GD01-001",
        name: "Gundam",
        effect: "Burst: Deploy this unit.",
        quantity: 4,
      },
    ];

    const detected = detectDeckTokens(cards, officialTokens);
    expect(detected.length).toBe(0);
  });
});
