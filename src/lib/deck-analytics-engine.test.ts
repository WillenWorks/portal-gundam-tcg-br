import { describe, expect, it } from "vitest";
import {
  computeUnifiedDeckTelemetry,
  getCardMetagameTier,
  METAGAME_TIERS,
  type DeckCardModel,
} from "./deck-analytics-engine";

describe("deck-analytics-engine", () => {
  it("classifica corretamente as faixas de metagame em PT-BR", () => {
    expect(getCardMetagameTier(100).tier).toBe("STAPLE");
    expect(getCardMetagameTier(75).tier).toBe("STAPLE");
    expect(getCardMetagameTier(74.9).tier).toBe("KEY");
    expect(getCardMetagameTier(50).tier).toBe("KEY");
    expect(getCardMetagameTier(49.9).tier).toBe("COMMON");
    expect(getCardMetagameTier(25).tier).toBe("COMMON");
    expect(getCardMetagameTier(24.9).tier).toBe("TECH");
    expect(getCardMetagameTier(0).tier).toBe("TECH");
  });

  it("calcula a telemetria unificada com precisão", () => {
    const mockCards: DeckCardModel[] = [
      {
        id: "c1",
        code: "GD01-001",
        name: "Gundam Exia",
        color: "Azul",
        type: "UNIT",
        cost: 2,
        level: 2,
        ap: 3000,
        hp: 3,
        trait: "Celestial Being",
        series: "Gundam 00",
        quantity: 4,
        section: "main",
        keywords: ["Breach", "Repair"],
        triggerKeywords: ["Deploy"],
      },
      {
        id: "c2",
        code: "GD01-002",
        name: "Setsuna F. Seiei",
        color: "Azul",
        type: "PILOT",
        cost: 1,
        quantity: 4,
        section: "main",
        keywords: [],
      },
    ];

    const telemetry = computeUnifiedDeckTelemetry(mockCards);
    expect(telemetry.mainDeckCount).toBe(8);
    expect(telemetry.uniqueCount).toBe(2);
    expect(telemetry.cardsAtLimit).toBe(2);
    expect(telemetry.dominantColor).toBe("Azul");
    expect(telemetry.dominantTrait).toBe("Celestial Being");
    expect(telemetry.curveData.length).toBeGreaterThan(0);
    expect(telemetry.diagnostics.length).toBe(5);
  });
});
