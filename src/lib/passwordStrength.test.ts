import { describe, expect, it } from "vitest";
import { evaluatePasswordStrength, validatePasswordStrength } from "./passwordStrength";

describe("passwordStrength", () => {
  it("avalia senha vazia como score 0 e fraca", () => {
    const res = evaluatePasswordStrength("");
    expect(res.score).toBe(0);
    expect(res.isStrong).toBe(false);
    expect(res.requirements.every((r) => !r.met)).toBe(true);
  });

  it("avalia senha curta como fraca mesmo com todos os caracteres", () => {
    const res = evaluatePasswordStrength("Aa1!");
    expect(res.score).toBe(1);
    expect(res.isStrong).toBe(false);
    expect(res.requirements.find((r) => r.id === "length")?.met).toBe(false);
  });

  it("identifica senha forte quando cumpre todos os 5 critérios", () => {
    const res = evaluatePasswordStrength("AmuroRay@2026");
    expect(res.score).toBe(4);
    expect(res.isStrong).toBe(true);
    expect(res.label).toBe("Forte");
    expect(res.requirements.every((r) => r.met)).toBe(true);
  });

  it("validatePasswordStrength retorna erro específico quando falta requisito", () => {
    expect(validatePasswordStrength("curta").valid).toBe(false);
    expect(validatePasswordStrength("curta").error).toContain("8 caracteres");

    expect(validatePasswordStrength("minusculas123!").valid).toBe(false);
    expect(validatePasswordStrength("minusculas123!").error).toContain("maiúscula");

    expect(validatePasswordStrength("MAIUSCULAS123!").valid).toBe(false);
    expect(validatePasswordStrength("MAIUSCULAS123!").error).toContain("minúscula");

    expect(validatePasswordStrength("SemNumeros!Aa").valid).toBe(false);
    expect(validatePasswordStrength("SemNumeros!Aa").error).toContain("número");

    expect(validatePasswordStrength("SemEspecial1Aa").valid).toBe(false);
    expect(validatePasswordStrength("SemEspecial1Aa").error).toContain("caractere especial");

    expect(validatePasswordStrength("Valida@123").valid).toBe(true);
    expect(validatePasswordStrength("Valida@123").error).toBeUndefined();
  });
});
