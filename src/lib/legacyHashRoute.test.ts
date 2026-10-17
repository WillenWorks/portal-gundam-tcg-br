import { describe, expect, it } from "vitest";
import { legacyHashToPath } from "./legacyHashRoute";

describe("legacyHashToPath", () => {
  it("converte a rota com hash no caminho equivalente", () => {
    expect(legacyHashToPath("/", "", "#/cards/abc")).toBe("/cards/abc");
    expect(legacyHashToPath("/", "", "#/")).toBe("/");
    expect(legacyHashToPath("/index.html", "", "#/binder/xyz/")).toBe("/binder/xyz");
  });
  it("mantém a query de fora e a de dentro do hash", () => {
    expect(legacyHashToPath("/", "?token=abc", "#/redefinir-senha")).toBe("/redefinir-senha?token=abc");
    expect(legacyHashToPath("/", "", "#/simulador/preview-layout?preview=1")).toBe("/simulador/preview-layout?preview=1");
    expect(legacyHashToPath("/", "?challenge=K9", "#/simulador?x=1")).toBe("/simulador?challenge=K9&x=1");
  });
  it("tira a barra final de caminhos limpos", () => {
    expect(legacyHashToPath("/cards/", "?color=Blue", "")).toBe("/cards?color=Blue");
  });
  it("não mexe em caminhos limpos, âncoras simples nem na API", () => {
    expect(legacyHashToPath("/cards", "?color=Blue", "")).toBeNull();
    expect(legacyHashToPath("/", "", "")).toBeNull();
    expect(legacyHashToPath("/", "", "#topo")).toBeNull();
    expect(legacyHashToPath("/api/health/", "", "")).toBeNull();
  });
});
