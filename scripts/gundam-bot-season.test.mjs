import { describe, expect, it } from "vitest";
import { planShards } from "./gundam-bot-matrix-plan.mjs";
import { deckStats, wilson } from "./gundam-bot-season-report.mjs";
import { buildSeasonPool } from "./gundam-bot-season-pool.mjs";

describe("matriz por temporada", () => {
  it("fatias proporcionais às partidas, no mínimo 1 por temporada", () => {
    const plan = planShards(
      [
        { format: "A", games: 900 },
        { format: "B", games: 100 },
        { format: "C", games: 1 },
      ],
      10,
    );
    const count = (f) => plan.filter((p) => p.format === f).length;
    expect(count("A")).toBe(9);
    expect(count("B")).toBe(1);
    expect(count("C")).toBe(1);
    expect(plan.filter((p) => p.format === "A").map((p) => p.shard)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(plan.every((p) => p.of === count(p.format))).toBe(true);
  });

  it("intervalo de Wilson contém a taxa e encolhe com mais partidas", () => {
    const [lo, hi] = wilson(0.6, 20);
    expect(lo).toBeLessThan(0.6);
    expect(hi).toBeGreaterThan(0.6);
    const [lo2, hi2] = wilson(0.6, 200);
    expect(hi2 - lo2).toBeLessThan(hi - lo);
  });

  it("aproveitamento por deck a partir dos resultados (empate vale ½)", () => {
    const pool = { decks: [{ id: "x" }, { id: "y" }, { id: "z" }] };
    const matrix = {
      decks: ["x", "y", "z"],
      results: [
        { a: 0, b: 1, scoreA: 1 },
        { a: 1, b: 0, scoreA: 0 },
        { a: 0, b: 2, scoreA: 0.5 },
        { a: 2, b: 1, scoreA: 1 },
      ],
    };
    const stats = Object.fromEntries(deckStats(pool, matrix).map((s) => [s.id, s]));
    expect(stats.x.rate).toBeCloseTo(2.5 / 3);
    expect(stats.y.rate).toBe(0);
    expect(stats.z.rate).toBeCloseTo(1.5 / 2);
    expect(stats.x.best[0].id).toBe("y");
  });

  it("pool do GD05.5: versões de arquétipo + as 4 receitas oficiais do ST11–ST14, todas válidas", async () => {
    const { pool, rejected } = await buildSeasonPool("GD05.5");
    expect(rejected).toEqual([]);
    const ids = pool.decks.map((d) => d.id);
    for (const r of ["ST11-MARINE", "ST12-CLOSE-COMBAT", "ST13-BIT-FUNNEL", "ST14-HEAVY-ARMED"]) expect(ids).toContain(`GD05.5:${r}`);
    for (const d of pool.decks) {
      expect(d.list.main, d.id).toHaveLength(50);
      expect(d.list.resources, d.id).toHaveLength(10);
    }
  }, 120_000);
});
