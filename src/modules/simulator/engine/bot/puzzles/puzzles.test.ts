import { describe, expect, it } from "vitest";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../../../content";
import { enumerateLegalActions, actionOwner } from "../../legalActions";
import { ALL_PUZZLES } from "./index";

const resolvers = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };

describe("banco de situações — integridade", () => {
  it("≥ 20 situações, ids únicos, todas as categorias do spec", () => {
    expect(ALL_PUZZLES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(ALL_PUZZLES.map((p) => p.id)).size).toBe(ALL_PUZZLES.length);
    const cats = new Set(ALL_PUZZLES.map((p) => p.category));
    for (const c of ["letal", "bloqueio", "combate", "remocao", "efeito-util", "efeito-inutil", "sequencia", "custo-oportunidade"]) {
      expect(cats.has(c as never), c).toBe(true);
    }
  });

  for (const puzzle of ALL_PUZZLES) {
    it(`${puzzle.id}: a vez é do assento e há ≥ 1 jogada aceita legal`, () => {
      const { state, seat, refs } = puzzle.build();
      expect(actionOwner(state)).toBe(seat);
      const legal = enumerateLegalActions(state, seat, ALL_EFFECT_SPECS, resolvers);
      expect(legal.some((a) => puzzle.accepted.some((m) => m.match(a, refs)))).toBe(true);
      // e existe ao menos uma jogada ERRADA — senão a situação não mede nada
      expect(legal.some((a) => !puzzle.accepted.some((m) => m.match(a, refs)))).toBe(true);
    });
  }
});

describe("banco de situações — fumaça do runner no pnpm test", () => {
  it("nível normal roda o banco inteiro sem quebradas e acima do acaso", async () => {
    const { runPuzzleSuite } = await import("../puzzleRunner");
    const { policyForLevel } = await import("../levelPolicies");
    const opts = { specs: ALL_EFFECT_SPECS, ...resolvers };
    const summary = runPuzzleSuite(ALL_PUZZLES, { normal: () => policyForLevel("normal", opts) }, opts);
    expect(summary.normal.broken).toBe(0);
    expect(summary.normal.rate).toBeGreaterThan(summary.normal.chanceRate);
  }, 60_000);
});
