import { describe, expect, it } from "vitest";
import { LOW_COST_MAX, lowCostStats } from "./deck-cost-stats.ts";

type Row = { cost?: number | null; quantity?: number | null };

describe("lowCostStats", () => {
  it("expõe o teto de custo baixo esperado (≤2)", () => {
    expect(LOW_COST_MAX).toBe(2);
  });

  it("conta todas as cartas com custo 0..2, não só Units", () => {
    const rows: Row[] = [
      { cost: 0, quantity: 2 },
      { cost: 1, quantity: 4 },
      { cost: 2, quantity: 4 },
      { cost: 3, quantity: 10 }, // fora da faixa
      { cost: 5, quantity: 4 }, // fora da faixa
    ];
    expect(lowCostStats(rows, 50).lowCostCount).toBe(10);
  });

  it("ignora cartas sem custo numérico (ex.: Resource)", () => {
    const rows: Row[] = [
      { cost: 1, quantity: 3 },
      { cost: null, quantity: 10 },
      { cost: undefined, quantity: 10 },
      { quantity: 10 },
      { cost: Number.NaN, quantity: 10 },
    ];
    expect(lowCostStats(rows, 50).lowCostCount).toBe(3);
  });

  it("bate com o cálculo hipergeométrico manual", () => {
    // Deck de 50 cartas, 10 de custo ≤2 (os "sucessos"), mão de 5.
    //   P(pelo menos 1) = 1 - C(N-K, n) / C(N, n)
    //                   = 1 - C(40, 5) / C(50, 5)
    //                   = 1 - 658008 / 2118760
    //                   = 1 - 0.310564...
    //                   ≈ 0.68944
    // withMulligan (dois sorteios independentes da mesma população):
    //   1 - (1 - 0.68944)^2 = 1 - 0.31056^2 ≈ 0.90355
    const rows: Row[] = [
      { cost: 0, quantity: 2 },
      { cost: 1, quantity: 4 },
      { cost: 2, quantity: 4 },
      { cost: 4, quantity: 40 }, // completa as 50, nenhuma de custo baixo
    ];
    const stats = lowCostStats(rows, 50);
    expect(stats.lowCostCount).toBe(10);
    expect(stats.openingHand).toBeCloseTo(0.68944, 4);
    expect(stats.withMulligan).toBeCloseTo(0.90355, 4);
    expect(stats.withMulligan).toBeGreaterThan(stats.openingHand);
  });

  it("deck sem carta de custo baixo → chance de abertura é 0", () => {
    const rows: Row[] = [
      { cost: 3, quantity: 20 },
      { cost: 4, quantity: 20 },
      { cost: 7, quantity: 10 },
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
