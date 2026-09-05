import { describe, expect, it } from "vitest";
import {
  buildLevelCurve,
  hypergeometricAtLeastOne,
  lowLevelUnitStats,
  LEVEL_CURVE_TOP_BUCKET,
} from "./deck-level-stats.ts";

type Row = { type?: string | null; level?: number | null; quantity?: number | null };

describe("buildLevelCurve", () => {
  it("sempre devolve as 6 faixas (1..5 e 6+), mesmo sem cartas", () => {
    const curve = buildLevelCurve([]);
    expect(curve.map((r) => r.level)).toEqual(["1", "2", "3", "4", "5", "6+"]);
    expect(curve.every((r) => r.quantity === 0)).toBe(true);
  });

  it("soma as quantidades por nível só das Units", () => {
    const rows: Row[] = [
      { type: "UNIT", level: 1, quantity: 4 },
      { type: "UNIT", level: 1, quantity: 2 },
      { type: "UNIT", level: 3, quantity: 3 },
      { type: "PILOT", level: 2, quantity: 4 }, // ignora: não é Unit
      { type: "COMMAND", level: 5, quantity: 1 }, // ignora
    ];
    const curve = buildLevelCurve(rows);
    expect(curve.find((r) => r.level === "1")?.quantity).toBe(6);
    expect(curve.find((r) => r.level === "3")?.quantity).toBe(3);
    expect(curve.find((r) => r.level === "2")?.quantity).toBe(0);
    expect(curve.find((r) => r.level === "5")?.quantity).toBe(0);
  });

  it("agrupa Lv.6 e acima na faixa 6+", () => {
    const rows: Row[] = [
      { type: "UNIT", level: LEVEL_CURVE_TOP_BUCKET, quantity: 2 },
      { type: "UNIT", level: 7, quantity: 1 },
      { type: "UNIT", level: 9, quantity: 3 },
    ];
    const curve = buildLevelCurve(rows);
    expect(curve.find((r) => r.level === "6+")?.quantity).toBe(6);
  });

  it("ignora cartas sem nível numérico", () => {
    const rows: Row[] = [
      { type: "UNIT", level: null, quantity: 4 },
      { type: "UNIT", level: undefined, quantity: 4 },
      { type: "UNIT", quantity: 4 },
      { type: "UNIT", level: 2, quantity: 1 },
    ];
    const curve = buildLevelCurve(rows);
    expect(curve.reduce((s, r) => s + r.quantity, 0)).toBe(1);
  });
});

describe("hypergeometricAtLeastOne", () => {
  it("é 0 quando não há sucessos e 1 quando todo o baralho é sucesso", () => {
    expect(hypergeometricAtLeastOne(50, 0, 5)).toBe(0);
    expect(hypergeometricAtLeastOne(50, 50, 5)).toBe(1);
  });

  it("bate com o cálculo manual C(N-K,n)/C(N,n)", () => {
    // N=50, K=10, n=5 -> 1 - C(40,5)/C(50,5) = 1 - 658008/2118760 ≈ 0.6894
    expect(hypergeometricAtLeastOne(50, 10, 5)).toBeCloseTo(0.6894, 3);
  });
});

describe("lowLevelUnitStats", () => {
  it("conta Units Lv.1..3 e calcula a chance de abertura", () => {
    const rows: Row[] = [
      { type: "UNIT", level: 1, quantity: 4 },
      { type: "UNIT", level: 3, quantity: 6 },
      { type: "UNIT", level: 4, quantity: 4 }, // fora da faixa de abertura
      { type: "PILOT", level: 2, quantity: 4 }, // não é Unit
    ];
    const stats = lowLevelUnitStats(rows, 50);
    expect(stats.lowLevelUnitCount).toBe(10);
    expect(stats.openingHand).toBeCloseTo(0.6894, 3);
    expect(stats.withMulligan).toBeGreaterThan(stats.openingHand);
  });

  it("devolve zero sem estourar quando o deck está vazio", () => {
    const stats = lowLevelUnitStats([], 0);
    expect(stats).toEqual({ lowLevelUnitCount: 0, openingHand: 0, withMulligan: 0 });
  });
});
