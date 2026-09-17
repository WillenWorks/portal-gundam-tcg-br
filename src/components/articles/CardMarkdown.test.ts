import { describe, expect, it } from "vitest";

import { injectCardLinks } from "@/components/articles/CardMarkdown";

describe("injectCardLinks", () => {
  it("converte [[código]] num link markdown de esquema card://", () => {
    expect(injectCardLinks("Jogue [[GD01-001]] no turno 1.")).toBe("Jogue [GD01-001](card://GD01-001) no turno 1.");
  });

  it("converte [[Nome da Carta]] preservando espaços no label", () => {
    expect(injectCardLinks("[[Zeta Gundam]] é a unidade principal.")).toBe("[Zeta Gundam](card://Zeta%20Gundam) é a unidade principal.");
  });

  it("converte múltiplas referências no mesmo texto", () => {
    const result = injectCardLinks("[[GD01-001]] e [[GD01-002]] combinam bem.");
    expect(result).toBe("[GD01-001](card://GD01-001) e [GD01-002](card://GD01-002) combinam bem.");
  });

  it("não altera markdown sem referências de carta", () => {
    const plain = "# Título\n\nTexto normal com [um link](https://example.com).";
    expect(injectCardLinks(plain)).toBe(plain);
  });

  it("ignora colchetes duplos vazios ou mal formados", () => {
    expect(injectCardLinks("Texto com [[]] vazio.")).toBe("Texto com [[]] vazio.");
  });
});
