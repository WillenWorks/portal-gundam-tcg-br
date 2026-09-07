import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { mechanicTokens, rankSimilarSpecs } from "./similar-specs.mjs";

const signatures = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../src/modules/simulator/content/_index/specs-signatures.json", import.meta.url)),
    "utf8",
  ),
);

const codesOf = (r) => r.results.map((x) => x.cardCode);

describe("mechanicTokens", () => {
  it("normaliza números pra * e isola n-gramas de mecânica", () => {
    const tokens = mechanicTokens("Choose 1 enemy Unit. Deal 2 damage to it.");
    expect(tokens.has("choose * enemy unit")).toBe(true);
    expect(tokens.has("deal * damage")).toBe(true);
    expect(tokens.has("damage to it")).toBe(true);
  });
});

describe("rankSimilarSpecs", () => {
  it("\"Choose 1 enemy Unit. Deal 2 damage to it.\" -> Close Combat e Rewloola no top 3", () => {
    const r = rankSimilarSpecs(signatures, "Choose 1 enemy Unit. Deal 2 damage to it.", 3);
    expect(r.results.length).toBeLessThanOrEqual(3);
    expect(codesOf(r)).toContain("ST03-013"); // Close Combat
    expect(codesOf(r)).toContain("ST03-015"); // Rewloola
  });

  it("\"Look at the top 3 cards of your deck...\" -> Char's Zaku II (ST03-006) no topo", () => {
    const r = rankSimilarSpecs(signatures, "Look at the top 3 cards of your deck...", 3);
    expect(r.results[0].cardCode).toBe("ST03-006");
  });

  it("devolve no máximo `limit` resultados, ordenados por score desc", () => {
    const r = rankSimilarSpecs(signatures, "Choose 1 enemy Unit. Deal 2 damage to it.", 2);
    expect(r.results).toHaveLength(2);
    const scores = r.results.map((x) => x.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("cada resultado carrega id, cardCode, trigger, sourceText, score e ops", () => {
    const [top] = rankSimilarSpecs(signatures, "Choose 1 enemy Unit. Deal 2 damage to it.", 1).results;
    expect(top).toMatchObject({
      id: expect.any(String),
      cardCode: expect.any(String),
      trigger: expect.any(String),
      sourceText: expect.any(String),
      score: expect.any(Number),
    });
    expect(Array.isArray(top.ops)).toBe(true);
  });

  it("texto sem mecânica reconhecível -> nenhum resultado", () => {
    const r = rankSimilarSpecs(signatures, "zzzzz qqqqq", 3);
    expect(r.results).toHaveLength(0);
  });
});
