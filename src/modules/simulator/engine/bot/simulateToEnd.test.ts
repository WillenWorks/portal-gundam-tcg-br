import { describe, expect, it } from "vitest";
import { createGame } from "../setup";
import { createRng } from "../rng";
import { randomLegal } from "../selfPlay";
import {
  ALL_EFFECT_SPECS,
  defaultPredicateResolver,
  defaultTargetFilterResolver,
  validatedDeckList,
} from "../../content/index";
import { heuristicPolicy } from "./heuristicPolicy";
import { simulateToEnd } from "./simulateToEnd";

const resolvers = {
  predicateResolver: defaultPredicateResolver,
  targetFilterResolver: defaultTargetFilterResolver,
};

const decks = validatedDeckList();
const buildA = decks.find((d) => d.id === "ST01")!.build;
const buildB = decks.find((d) => d.id === "ST02")!.build;

function freshGame(seed: number) {
  return createGame(buildA(), buildB(), { seed, firstPlayer: "A", interactiveMulligan: true });
}

describe("simulateToEnd", () => {
  it("é determinística: 2 chamadas com o mesmo estado e o mesmo seed dão o mesmo resultado", () => {
    const state = freshGame(7);
    const run = () =>
      simulateToEnd(state, "A", ALL_EFFECT_SPECS, resolvers, {
        policyA: randomLegal,
        policyB: randomLegal,
        maxTurns: 60,
        rng: createRng(999),
      });
    const a = run();
    const b = run();
    expect(b).toEqual(a);
  });

  it("determinística também com policies heurísticas dos dois lados", () => {
    const normal = heuristicPolicy({ level: "normal" });
    const state = freshGame(11);
    const run = () =>
      simulateToEnd(state, "B", ALL_EFFECT_SPECS, resolvers, {
        policyA: normal,
        policyB: normal,
        maxTurns: 60,
        rng: createRng(2024),
      });
    expect(run()).toEqual(run());
  });

  it("sempre termina (nunca laço infinito) e devolve um vencedor válido ou null", () => {
    for (let seed = 0; seed < 12; seed++) {
      const result = simulateToEnd(freshGame(seed), "A", ALL_EFFECT_SPECS, resolvers, {
        policyA: randomLegal,
        policyB: randomLegal,
        maxTurns: 80,
        rng: createRng(seed * 31 + 1),
      });
      expect(result.turns).toBeGreaterThan(0);
      expect([null, "A", "B"]).toContain(result.winner);
    }
  });

  it("respeita maxTurns baixo: para e devolve winner=null sem estourar", () => {
    const result = simulateToEnd(freshGame(3), "A", ALL_EFFECT_SPECS, resolvers, {
      policyA: randomLegal,
      policyB: randomLegal,
      maxTurns: 2,
      rng: createRng(5),
    });
    expect(result.turns).toBeLessThanOrEqual(3);
    expect(result.winner).toBeNull();
  });

  it("fastLegal é determinística e termina como o caminho normal", () => {
    const state = freshGame(8);
    const run = (fastLegal: boolean) =>
      simulateToEnd(state, "A", ALL_EFFECT_SPECS, resolvers, {
        policyA: randomLegal,
        policyB: randomLegal,
        maxTurns: 60,
        rng: createRng(77),
        fastLegal,
      });
    expect(run(true)).toEqual(run(true));
    const fast = run(true);
    expect(fast.turns).toBeGreaterThan(0);
    expect([null, "A", "B"]).toContain(fast.winner);
  });

  it("não muta o estado de entrada", () => {
    const state = freshGame(4);
    const snapshot = JSON.stringify(state);
    simulateToEnd(state, "A", ALL_EFFECT_SPECS, resolvers, {
      policyA: randomLegal,
      policyB: randomLegal,
      maxTurns: 40,
      rng: createRng(42),
    });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
