import { describe, expect, it } from "vitest";
import { articleIsIndexable, isNotFoundError, playerIsIndexable } from "./seoRules";

describe("seoRules", () => {
  it("só 404/410 confirmam que o item não existe", () => {
    expect(isNotFoundError({ status: 404 })).toBe(true);
    expect(isNotFoundError({ status: 410 })).toBe(true);
    for (const e of [{ status: 429 }, { status: 500 }, { status: 0 }, new TypeError("Failed to fetch"), null, undefined]) {
      expect(isNotFoundError(e)).toBe(false);
    }
  });

  it("artigo: só publicado é indexável", () => {
    expect(articleIsIndexable({ status: "PUBLISHED" })).toBe(true);
    expect(articleIsIndexable({ status: "DRAFT" })).toBe(false);
    expect(articleIsIndexable({ status: "REVIEW" })).toBe(false);
  });

  it("jogador: indexável com pelo menos uma lista publicada", () => {
    expect(playerIsIndexable({ results: [{ hasDecklist: false }, { hasDecklist: true }] })).toBe(true);
    expect(playerIsIndexable({ results: [{ hasDecklist: false }, { hasDecklist: false }] })).toBe(false);
    expect(playerIsIndexable({ results: [] })).toBe(false);
  });
});
