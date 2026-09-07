import { describe, expect, it } from "vitest";

import { rankSimilarSpecs as rankMjs } from "../../scripts/mcp-gundam/similar-specs.mjs";
import indexJson from "@/modules/simulator/content/_index/specs-signatures.json";
import { similarSpecsClient, mechanicTokens, type SpecSignature } from "./similar-specs-client";

const index = indexJson as SpecSignature[];

const codesOf = (r: { results: Array<{ cardCode: string }> }) => r.results.map((x) => x.cardCode);

describe("similarSpecsClient — casos canônicos (docs/44)", () => {
  it('"Choose 1 enemy Unit. Deal 2 damage to it." → Close Combat (ST03-013) e Rewloola (ST03-015) no top 3', () => {
    const r = similarSpecsClient("Choose 1 enemy Unit. Deal 2 damage to it.", index, 3);
    expect(r.results.length).toBeLessThanOrEqual(3);
    expect(codesOf(r)).toContain("ST03-013");
    expect(codesOf(r)).toContain("ST03-015");
  });

  it('"Look at the top 3 cards of your deck..." → Char\'s Zaku Ⅱ (ST03-006) no topo', () => {
    const r = similarSpecsClient("Look at the top 3 cards of your deck...", index, 3);
    expect(r.results[0].cardCode).toBe("ST03-006");
  });

  it("cada resultado carrega id, cardCode, trigger, sourceText, score e ops[]", () => {
    const [top] = similarSpecsClient("Choose 1 enemy Unit. Deal 2 damage to it.", index, 1).results;
    expect(top).toMatchObject({
      id: expect.any(String),
      cardCode: expect.any(String),
      trigger: expect.any(String),
      sourceText: expect.any(String),
      score: expect.any(Number),
    });
    expect(Array.isArray(top.ops)).toBe(true);
  });

  it("texto sem mecânica reconhecível → nenhum resultado", () => {
    expect(similarSpecsClient("zzzzz qqqqq", index, 3).results).toHaveLength(0);
  });

  it("mechanicTokens normaliza números pra * e isola n-gramas de mecânica", () => {
    const t = mechanicTokens("Choose 1 enemy Unit. Deal 2 damage to it.");
    expect(t.has("choose * enemy unit")).toBe(true);
    expect(t.has("deal * damage")).toBe(true);
    expect(t.has("damage to it")).toBe(true);
  });
});

describe("similarSpecsClient — paridade com scripts/mcp-gundam/similar-specs.mjs", () => {
  const QUERIES = [
    "Choose 1 enemy Unit. Deal 2 damage to it.",
    "Look at the top 3 cards of your deck...",
    "Look at the top 3 cards of your deck. Reveal 1 Unit card and add it to your hand.",
    "【Deploy】Choose 1 enemy Unit with 2 or less HP. Rest it.",
    "Draw 1. Then, discard 1 card from your hand.",
    "This Unit gets AP+2 during this turn.",
    "Return it to its owner's hand.",
    "Deploy 1 rested EX Base token.",
    "zzzzz qqqqq",
  ];

  for (const q of QUERIES) {
    for (const limit of [1, 3, 5]) {
      it(`"${q.slice(0, 40)}" (limit ${limit})`, () => {
        expect(similarSpecsClient(q, index, limit)).toEqual(rankMjs(index, q, limit));
      });
    }
  }
});
