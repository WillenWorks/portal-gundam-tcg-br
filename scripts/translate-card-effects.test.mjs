import { describe, expect, it } from "vitest";
import { buildPrompt, isProperNounParen, restore, tokenize, validate } from "./translate-card-effects.mjs";

describe("tokenize", () => {
  it("isola gatilhos 【...】 e keywords <...> como placeholders", () => {
    const en = "<Repair 2> (At the end of your turn, this Unit recovers the specified number of HP.)\n【During Pair】During your turn, all your Units get AP+1.";
    const { masked, tokens } = tokenize(en);
    expect(tokens).toContain("<Repair 2>");
    expect(tokens).toContain("【During Pair】");
    expect(tokens).toContain("AP+1");
    // O texto livre entre parenteses NAO vira token (deve ser traduzido).
    expect(masked).toContain("At the end of your turn");
    // Nenhum token oficial sobra visivel no texto mascarado.
    expect(masked).not.toContain("【During Pair】");
    expect(masked).not.toContain("<Repair 2>");
    expect(masked).toMatch(/§\d+§/);
  });

  it("protege nomes proprios entre [ ] e traits entre ( ), mas traduz texto explicativo", () => {
    const en = "【Deploy】Deploy 1 rested [Zaku Ⅱ]((Zeon)･AP1･HP1) Unit token. You may reveal 1 (Zeon)/(Neo Zeon) Unit card.";
    const { tokens } = tokenize(en);
    expect(tokens).toContain("[Zaku Ⅱ]");
    expect(tokens).toContain("((Zeon)･AP1･HP1)");
    expect(tokens).toContain("(Zeon)");
    expect(tokens).toContain("(Neo Zeon)");
  });

  it("nao protege parenteses que sao frase explicativa", () => {
    const { tokens } = tokenize("This Unit gains <High-Maneuver>. (This Unit can't be blocked.)");
    expect(tokens).toEqual(["<High-Maneuver>"]);
  });

  it("protege Lv.X, Rest e custos circulados", () => {
    const { tokens } = tokenize("【Activate･Main】②：Choose 1 enemy Unit that is Lv.5 or lower. Rest it.");
    expect(tokens).toContain("②");
    expect(tokens).toContain("Lv.5");
    expect(tokens).toContain("Rest");
  });
});

describe("isProperNounParen", () => {
  it("aceita 1-3 palavras capitalizadas", () => {
    expect(isProperNounParen("Zeon")).toBe(true);
    expect(isProperNounParen("Neo Zeon")).toBe(true);
    expect(isProperNounParen("White Base Team")).toBe(true);
    expect(isProperNounParen("OZ")).toBe(true);
  });

  it("rejeita frases explicativas", () => {
    expect(isProperNounParen("This Unit can't be blocked.")).toBe(false);
    expect(isProperNounParen("At the end of your turn")).toBe(false);
    expect(isProperNounParen("specified amount")).toBe(false);
  });
});

describe("restore", () => {
  it("recompoe os tokens originais a partir dos placeholders", () => {
    const en = "【Deploy】Choose 1 enemy Unit with 2 or less HP. Rest it.";
    const { masked, tokens } = tokenize(en);
    const fakePt = masked
      .replace("Choose 1 enemy Unit with 2 or less", "Escolha 1 Unidade inimiga com 2 ou menos de")
      .replace(" it.", "-a.");
    const pt = restore(fakePt, tokens);
    expect(pt).toBe("【Deploy】Escolha 1 Unidade inimiga com 2 ou menos de HP. Rest-a.");
  });
});

describe("validate", () => {
  const en = "【Deploy】Choose 1 enemy Unit that is Lv.5 or lower. It gets AP-3 during this turn.";
  const { tokens } = tokenize(en);

  it("ACEITA uma traducao que preserva todos os tokens", () => {
    const pt = "【Deploy】Escolha 1 Unidade inimiga que seja Lv.5 ou menor. Ela recebe AP-3 durante este turno.";
    expect(validate(en, pt, tokens)).toEqual({ ok: true });
  });

  it("REJEITA quando um gatilho foi traduzido (【Implantar】)", () => {
    const pt = "【Implantar】Escolha 1 Unidade inimiga que seja Lv.5 ou menor. Ela recebe AP-3 durante este turno.";
    const verdict = validate(en, pt, tokens);
    expect(verdict.ok).toBe(false);
    expect(verdict.motivo).toMatch(/【Deploy】/);
  });

  it("REJEITA quando um token sumiu", () => {
    const pt = "【Deploy】Escolha 1 Unidade inimiga que seja menor. Ela recebe AP-3 durante este turno.";
    const verdict = validate(en, pt, tokens);
    expect(verdict.ok).toBe(false);
    expect(verdict.motivo).toMatch(/Lv\.5/);
  });

  it("REJEITA quando um token foi duplicado", () => {
    const pt = "【Deploy】【Deploy】Escolha 1 Unidade inimiga que seja Lv.5 ou menor. Ela recebe AP-3 durante este turno.";
    const verdict = validate(en, pt, tokens);
    expect(verdict.ok).toBe(false);
  });

  it("REJEITA quando sobra placeholder nao restaurado", () => {
    const pt = "§0§Escolha 1 Unidade inimiga que seja Lv.5 ou menor. Ela recebe AP-3 durante este turno.";
    const verdict = validate(en, pt, tokens);
    expect(verdict.ok).toBe(false);
    expect(verdict.motivo).toMatch(/placeholder/);
  });

  it("REJEITA quando uma keyword <...> foi traduzida", () => {
    const kwEn = "This Unit gains <Blocker> during this turn.";
    const t = tokenize(kwEn).tokens;
    const pt = "Esta Unidade ganha <Bloqueador> durante este turno.";
    expect(validate(kwEn, pt, t).ok).toBe(false);
  });
});

describe("buildPrompt", () => {
  it("injeta o grounding do glossario e o texto mascarado", () => {
    const prompt = buildPrompt("§0§Draw 1.");
    expect(prompt).toContain("Gundam Trading Card Game");
    expect(prompt).toContain("§0§Draw 1.");
    expect(prompt).toMatch(/JAMAIS s[aã]o traduzidas/i);
  });
});
