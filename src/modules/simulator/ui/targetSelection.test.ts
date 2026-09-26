import { describe, expect, it } from "vitest";
import { canAddTarget, targetsReadyToAutoResolve } from "./targetSelection";

describe("UI — seleção de 1 a N alvos (targetCount)", () => {
  it("alvo único: dispara no 1º clique (comportamento antigo)", () => {
    expect(targetsReadyToAutoResolve(0, 1, 1, 3)).toBe(false);
    expect(targetsReadyToAutoResolve(1, 1, 1, 3)).toBe(true);
  });

  it("\"choose 1 to 2\": com 2+ legais espera o 2º (ou o Confirmar); com 1 legal dispara no 1º", () => {
    expect(targetsReadyToAutoResolve(1, 1, 2, 3)).toBe(false);
    expect(targetsReadyToAutoResolve(2, 1, 2, 3)).toBe(true);
    expect(targetsReadyToAutoResolve(1, 1, 2, 1)).toBe(true);
  });

  it("sem alvo exigido não segura a jogada", () => {
    expect(targetsReadyToAutoResolve(0, 0, 0, 0)).toBe(true);
  });

  it("não deixa passar do máximo; alvo único mantém a troca livre", () => {
    expect(canAddTarget(1, 2)).toBe(true);
    expect(canAddTarget(2, 2)).toBe(false);
    expect(canAddTarget(1, 1)).toBe(true);
  });
});
