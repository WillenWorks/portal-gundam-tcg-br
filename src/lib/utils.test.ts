import { describe, expect, it } from "vitest";
import { formatCardText } from "./utils";

describe("formatCardText", () => {
  it("troca tags <br> por quebra de linha real", () => {
    expect(formatCardText("[Burst] Deploy this card.<br>[Deploy] Draw 1.")).toBe(
      "[Burst] Deploy this card.\n[Deploy] Draw 1.",
    );
  });

  it("aceita variações de grafia da tag (maiúscula, com espaço, autofechada)", () => {
    expect(formatCardText("A<BR>B<br />C<br/>D")).toBe("A\nB\nC\nD");
  });

  it("remove espaço em branco nas pontas depois da troca", () => {
    expect(formatCardText("<br>Texto<br>")).toBe("Texto");
  });

  it("retorna string vazia pra valor vazio, nulo ou indefinido", () => {
    expect(formatCardText("")).toBe("");
    expect(formatCardText(null)).toBe("");
    expect(formatCardText(undefined)).toBe("");
  });

  it("não mexe em texto sem nenhuma tag <br>", () => {
    expect(formatCardText("Texto normal sem quebras.")).toBe("Texto normal sem quebras.");
  });
});
