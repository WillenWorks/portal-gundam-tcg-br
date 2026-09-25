import { describe, expect, it } from "vitest";
import { aggregateMatchups, defaultWorkerCount, planMatchupGames, splitForWorkers } from "./matchupPlan";

describe("planMatchupGames", () => {
  it("n decks → n(n-1)/2 pares × games, assento alternado, seed única por partida", () => {
    const plan = planMatchupGames({ decks: 4, gamesPerPair: 3, seed: 1 });
    expect(plan).toHaveLength(6 * 3);
    expect(new Set(plan.map((g) => g.seed)).size).toBe(plan.length);
    const pair01 = plan.filter((g) => (g.a === 0 && g.b === 1) || (g.a === 1 && g.b === 0));
    expect(pair01.map((g) => g.a)).toEqual([0, 1, 0]);
  });

  it("é determinístico", () => {
    expect(planMatchupGames({ decks: 5, gamesPerPair: 2, seed: 9 })).toEqual(planMatchupGames({ decks: 5, gamesPerPair: 2, seed: 9 }));
  });
});

describe("splitForWorkers", () => {
  it("divide sem perder nem repetir partidas", () => {
    const plan = planMatchupGames({ decks: 5, gamesPerPair: 3, seed: 1 });
    const parts = splitForWorkers(plan, 4);
    expect(parts).toHaveLength(4);
    expect(parts.flat().map((g) => g.index).sort((x, y) => x - y)).toEqual(plan.map((g) => g.index));
  });

  it("mais workers que partidas → só partes não vazias", () => {
    const plan = planMatchupGames({ decks: 2, gamesPerPair: 1, seed: 1 });
    expect(splitForWorkers(plan, 8)).toHaveLength(1);
  });
});

describe("aggregateMatchups", () => {
  it("soma vitórias dos dois lados e ignora excluídas; ordem de chegada não importa", () => {
    const results = [
      { index: 0, a: 0, b: 1, scoreA: 1 },
      { index: 1, a: 1, b: 0, scoreA: 0.5 },
      { index: 2, a: 0, b: 1, error: "crash" },
    ];
    const one = aggregateMatchups(2, results);
    const two = aggregateMatchups(2, [...results].reverse());
    expect(one).toEqual(two);
    expect(one.wins[0][1]).toBe(1.5);
    expect(one.wins[1][0]).toBe(0.5);
    expect(one.played[0][1]).toBe(2);
    expect(one.rate[0][1]).toBe(0.75);
    expect(one.rate[0][0]).toBeNull();
    expect(one.excluded).toHaveLength(1);
  });
});

describe("defaultWorkerCount", () => {
  const GB = 1024 ** 3;
  it("limita por núcleos, memória livre e teto", () => {
    expect(defaultWorkerCount({ cpus: 16, freeMemBytes: 64 * GB })).toBe(6);
    expect(defaultWorkerCount({ cpus: 4, freeMemBytes: 64 * GB })).toBe(3);
    expect(defaultWorkerCount({ cpus: 16, freeMemBytes: 3.2 * GB })).toBe(2);
  });
  it("nunca menos que 1", () => {
    expect(defaultWorkerCount({ cpus: 1, freeMemBytes: 0.2 * GB })).toBe(1);
  });
});
