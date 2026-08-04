import { describe, expect, it } from "vitest";
import { traitsFrom } from "./apitcg-taxonomies.mjs";

describe("traitsFrom", () => {
  it("extrai múltiplos traits entre parênteses", () => {
    // caso real: GD01-130 tem Trait = "(Academy) (Stronghold)"
    expect(traitsFrom("(Academy) (Stronghold)")).toEqual(["Academy", "Stronghold"]);
  });

  it("extrai um único trait entre parênteses", () => {
    expect(traitsFrom("(Zeon)")).toEqual(["Zeon"]);
  });

  it("usa o valor bruto como trait único quando não há parênteses", () => {
    expect(traitsFrom("White Base Team")).toEqual(["White Base Team"]);
  });

  it("retorna lista vazia pra valor vazio, nulo ou indefinido", () => {
    expect(traitsFrom("")).toEqual([]);
    expect(traitsFrom(null)).toEqual([]);
    expect(traitsFrom(undefined)).toEqual([]);
  });

  it("ignora espaços extras dentro dos parênteses", () => {
    expect(traitsFrom("(  Academy  ) ( Stronghold )")).toEqual(["Academy", "Stronghold"]);
  });
});
