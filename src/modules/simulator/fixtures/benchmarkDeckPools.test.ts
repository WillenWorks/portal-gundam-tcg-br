import { describe, expect, it } from "vitest";
import { BENCHMARK_POOLS, deckPool } from "./benchmarkDeckPools";

describe("benchmarkDeckPools", () => {
  it("meta-gd02 = as 6 receitas oficiais, com knownGaps", () => {
    const pool = deckPool("meta-gd02");
    expect(pool.map((d) => d.id)).toHaveLength(6);
    expect(pool.every((d) => d.id.startsWith("META-"))).toBe(true);
    expect(pool.every((d) => Array.isArray(d.knownGaps))).toBe(true);
  });

  it("starters = decks validados (ST01..)", () => {
    const pool = deckPool("starters");
    expect(pool.length).toBeGreaterThanOrEqual(8);
    expect(pool.every((d) => d.knownGaps.length === 0)).toBe(true);
  });

  it("all = união sem duplicatas", () => {
    const all = deckPool("all").map((d) => d.id);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(deckPool("meta-gd02").length + deckPool("starters").length);
  });

  it("todo deck do pool monta uma DeckList de 50 + 10", () => {
    for (const d of deckPool("all")) {
      const list = d.build();
      expect(list.main, d.id).toHaveLength(50);
      expect(list.resources, d.id).toHaveLength(10);
    }
  });

  it("pool desconhecido lança listando os válidos", () => {
    expect(() => deckPool("nope" as never)).toThrow(/meta-gd02/);
    expect(BENCHMARK_POOLS).toEqual(["starters", "meta-gd02", "all", "calib", "valid"]);
  });

  it("calib e valid são disjuntos e cobrem o pool all", () => {
    const calib = deckPool("calib").map((d) => d.id);
    const valid = deckPool("valid").map((d) => d.id);
    expect(calib.filter((id) => valid.includes(id))).toEqual([]);
    expect([...calib, ...valid].sort()).toEqual(deckPool("all").map((d) => d.id).sort());
  });
});
