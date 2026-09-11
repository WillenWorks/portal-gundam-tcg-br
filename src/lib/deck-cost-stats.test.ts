import { describe, expect, it } from "vitest";
import { LOW_COST_MAX, lowCostStats } from "./deck-cost-stats.ts";

type Row = { type?: string | null; cost?: number | null; level?: number | null; quantity?: number | null };

describe("lowCostStats", () => {
  it("expõe o teto de custo baixo esperado (≤2)", () => {
    expect(LOW_COST_MAX).toBe(2);
  });

  it("conta Unit/Base com custo 0..2 e nível ≤2 (ou sem nível)", () => {
    const rows: Row[] = [
      { type: "UNIT", cost: 0, quantity: 2 },
      { type: "UNIT", cost: 1, level: 1, quantity: 4 },
      { type: "BASE", cost: 2, quantity: 4 },
      { type: "UNIT", cost: 3, quantity: 10 }, // fora da faixa
      { type: "UNIT", cost: 5, quantity: 4 }, // fora da faixa
    ];
    expect(lowCostStats(rows, 50).lowCostCount).toBe(10);
  });

  it("NÃO conta Piloto/Comando de custo baixo -- não desenvolvem campo sozinhos (bug relatado)", () => {
    const rows: Row[] = [
      { type: "PILOT", cost: 1, quantity: 10 },
      { type: "COMMAND", cost: 1, quantity: 10 },
      { type: "UNIT", cost: 1, level: 1, quantity: 4 },
    ];
    expect(lowCostStats(rows, 50).lowCostCount).toBe(4);
  });

  it("NÃO conta Unit de custo baixo mas nível alto -- turno mínimo real é max(custo, nível) (bug relatado)", () => {
    const rows: Row[] = [
      { type: "UNIT", cost: 1, level: 6, quantity: 10 }, // só jogável no T6, apesar do custo 1
      { type: "UNIT", cost: 1, level: 1, quantity: 4 },
    ];
    expect(lowCostStats(rows, 50).lowCostCount).toBe(4);
  });

  it("ignora cartas sem custo numérico (ex.: Resource)", () => {
    const rows: Row[] = [
      { type: "UNIT", cost: 1, level: 1, quantity: 3 },
      { type: "UNIT", cost: null, quantity: 10 },
      { type: "UNIT", cost: undefined, quantity: 10 },
      { type: "UNIT", quantity: 10 },
      { type: "UNIT", cost: Number.NaN, quantity: 10 },
    ];
    expect(lowCostStats(rows, 50).lowCostCount).toBe(3);
  });

  it("bate com o cálculo hipergeométrico manual", () => {
    // Deck de 50 cartas, 10 Unit/Base realmente jogáveis até T2 (os "sucessos"), mão de 5.
    //   P(pelo menos 1) = 1 - C(N-K, n) / C(N, n)
    //                   = 1 - C(40, 5) / C(50, 5)
    //                   = 1 - 658008 / 2118760
    //                   = 1 - 0.310564...
    //                   ≈ 0.68944
    // withMulligan (dois sorteios independentes da mesma população):
    //   1 - (1 - 0.68944)^2 = 1 - 0.31056^2 ≈ 0.90355
    const rows: Row[] = [
      { type: "UNIT", cost: 0, level: 1, quantity: 2 },
      { type: "UNIT", cost: 1, level: 1, quantity: 4 },
      { type: "BASE", cost: 2, quantity: 4 },
      { type: "UNIT", cost: 4, level: 4, quantity: 40 }, // completa as 50, nenhuma de abertura cedo
    ];
    const stats = lowCostStats(rows, 50);
    expect(stats.lowCostCount).toBe(10);
    expect(stats.openingHand).toBeCloseTo(0.68944, 4);
    expect(stats.withMulligan).toBeCloseTo(0.90355, 4);
    expect(stats.withMulligan).toBeGreaterThan(stats.openingHand);
  });

  it("deck sem carta de abertura cedo → chance de abertura é 0", () => {
    const rows: Row[] = [
      { type: "UNIT", cost: 3, level: 3, quantity: 20 },
      { type: "UNIT", cost: 4, level: 4, quantity: 20 },
      { type: "UNIT", cost: 7, level: 7, quantity: 10 },
    ];
    const stats = lowCostStats(rows, 50);
    expect(stats.lowCostCount).toBe(0);
    expect(stats.openingHand).toBe(0);
    expect(stats.withMulligan).toBe(0);
  });

  it("devolve zero sem estourar quando o deck está vazio", () => {
    expect(lowCostStats([], 0)).toEqual({ lowCostCount: 0, openingHand: 0, withMulligan: 0 });
  });
});
