import { describe, expect, it } from "vitest";
import {
  calculateHypergeometric,
  classifyMetaCard,
  combination,
  computePairwiseLift,
  computeSlotRigidity,
} from "./meta-analytics";

describe("meta-analytics: combinação simples", () => {
  it("calcula valores básicos de C(n, k)", () => {
    expect(combination(5, 0)).toBe(1);
    expect(combination(5, 1)).toBe(5);
    expect(combination(5, 2)).toBe(10);
    expect(combination(50, 5)).toBe(2118760);
  });
});

describe("meta-analytics: probabilidade hipergeométrica", () => {
  it("calcula probabilidade exata para 4 cópias em 50 cartas (mão de 5)", () => {
    // Para N=50, K=4, n=5, k=1:
    // P(0) = C(46, 5) / C(50, 5) = 1370754 / 2118760 ≈ 0.64696...
    // P(X >= 1) = 1 - P(0) ≈ 0.399... (ou cerca de 39.9%)
    const res = calculateHypergeometric(50, 4, 5, 1);
    expect(res.atLeast).toBeGreaterThan(0.35);
    expect(res.atLeast).toBeLessThan(0.42);
    // Com mulligan, a chance sobe para > 55%
    expect(res.withMulligan).toBeGreaterThan(0.55);
    expect(res.withMulligan).toBeLessThan(0.70);
  });

  it("retorna 100% se todas as cartas forem o alvo", () => {
    const res = calculateHypergeometric(50, 50, 5, 1);
    expect(res.atLeast).toBe(1);
  });

  it("retorna 0% se não houver cópias do alvo no deck", () => {
    const res = calculateHypergeometric(50, 0, 5, 1);
    expect(res.atLeast).toBe(0);
    expect(res.withMulligan).toBe(0);
  });
});

describe("meta-analytics: classificação em 4 quadrantes", () => {
  it("classifica como CORE carta com alta presença e alta afinidade", () => {
    const quad = classifyMetaCard({
      inclusionRate: 0.90,
      affinity: 1.6,
      meanCopies: 3.9,
    });
    expect(quad).toBe("CORE");
  });

  it("classifica como STAPLE carta onipresente na cor mesmo em arquétipos variados", () => {
    const quad = classifyMetaCard({
      inclusionRate: 0.85,
      affinity: 1.05,
      colorInclusionRate: 0.80,
      meanCopies: 4.0,
    });
    expect(quad).toBe("STAPLE");
  });

  it("classifica como TECH carta situacional com baixa presença e poucas cópias", () => {
    const quad = classifyMetaCard({
      inclusionRate: 0.22,
      affinity: 0.9,
      meanCopies: 1.5,
    });
    expect(quad).toBe("TECH");
  });

  it("classifica como FLEX carta intermediária de preenchimento de curva", () => {
    const quad = classifyMetaCard({
      inclusionRate: 0.55,
      affinity: 1.1,
      meanCopies: 2.8,
    });
    expect(quad).toBe("FLEX");
  });
});

describe("meta-analytics: rigidez de slot e Lift", () => {
  it("calcula alta rigidez quando o desvio padrão é muito baixo", () => {
    // 4x estrito: média 4.0, desvio 0.1
    const cr = computeSlotRigidity(4.0, 0.2);
    expect(cr).toBeGreaterThanOrEqual(0.95);
  });

  it("calcula baixa rigidez quando há forte oscilação", () => {
    // Oscilação: média 2.0, desvio 1.2
    const cr = computeSlotRigidity(2.0, 1.2);
    expect(cr).toBeLessThan(0.6);
  });

  it("calcula Lift corretamente", () => {
    // P(A) = 0.5, P(B) = 0.4, P(A e B) = 0.35 -> Lift = 0.35 / 0.20 = 1.75
    const lift = computePairwiseLift(0.35, 0.5, 0.4);
    expect(lift).toBe(1.75);
  });
});
