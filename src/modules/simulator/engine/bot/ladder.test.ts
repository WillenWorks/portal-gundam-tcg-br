import { describe, expect, it } from "vitest";
import { bradleyTerryElo, bootstrapEloIntervals, headToHead, wilsonInterval, type GameRecord } from "./ladder";

function games(a: string, b: string, aWins: number, bWins: number, draws = 0): GameRecord[] {
  return [
    ...Array.from({ length: aWins }, (): GameRecord => ({ a, b, score: 1 })),
    ...Array.from({ length: bWins }, (): GameRecord => ({ a, b, score: 0 })),
    ...Array.from({ length: draws }, (): GameRecord => ({ a, b, score: 0.5 })),
  ];
}

describe("ladder — estatística", () => {
  it("A vence B em 75% → A ≈ +190 Elo acima de B (âncora B = 0)", () => {
    const elo = bradleyTerryElo(games("A", "B", 75, 25), "B");
    expect(elo.B).toBe(0);
    expect(elo.A).toBeGreaterThan(180);
    expect(elo.A).toBeLessThan(195);
  });

  it("empates contam meio ponto: 50 empates = mesmo Elo", () => {
    const elo = bradleyTerryElo(games("A", "B", 0, 0, 50), "B");
    expect(elo.A).toBeCloseTo(0, 5);
  });

  it("nível que nunca vence fica finito (pseudo-contagem), abaixo da âncora", () => {
    const elo = bradleyTerryElo(games("R", "N", 0, 40), "R");
    expect(Number.isFinite(elo.N)).toBe(true);
    expect(elo.N).toBeGreaterThan(300);
  });

  it("transitivo: A > B > C recupera a ordem com 3 jogadores", () => {
    const records = [...games("A", "B", 70, 30), ...games("B", "C", 70, 30), ...games("A", "C", 85, 15)];
    const elo = bradleyTerryElo(records, "C");
    expect(elo.A).toBeGreaterThan(elo.B);
    expect(elo.B).toBeGreaterThan(elo.C);
  });

  it("bootstrap: intervalo contém a estimativa pontual e é determinístico dado o seed", () => {
    const records = games("A", "B", 60, 40);
    const point = bradleyTerryElo(records, "B");
    const ci1 = bootstrapEloIntervals(records, "B", { samples: 200, seed: 7 });
    const ci2 = bootstrapEloIntervals(records, "B", { samples: 200, seed: 7 });
    expect(ci1).toEqual(ci2);
    expect(ci1.A.low).toBeLessThanOrEqual(point.A);
    expect(ci1.A.high).toBeGreaterThanOrEqual(point.A);
  });

  it("headToHead soma pelo lado do `upper` independente de quem foi A", () => {
    const records: GameRecord[] = [
      { a: "N", b: "R", score: 1 },
      { a: "R", b: "N", score: 0 },
      { a: "R", b: "N", score: 0.5 },
    ];
    expect(headToHead(records, "R", "N")).toMatchObject({ upperScore: 2.5, games: 3 });
  });

  it("Wilson: 60/100 → ~[0,502, 0,691]; 0 partidas → [0, 1]", () => {
    const w = wilsonInterval(60, 100);
    expect(w.low).toBeCloseTo(0.502, 2);
    expect(w.high).toBeCloseTo(0.691, 2);
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 1 });
  });
});

describe("runLadder — round-robin", () => {
  it("fumaça: random × facil em 2 decks, assentos alternados, Elo do random = 0", async () => {
    const { runLadder } = await import("./ladder");
    const { deckPool } = await import("../../fixtures/benchmarkDeckPools");
    const { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } = await import("../../content");
    const decks = deckPool("starters").slice(0, 2);
    const result = runLadder({
      levels: ["random", "facil"],
      decks,
      gamesPerLevelPair: 4,
      maxTurns: 40,
      seed: 3,
      specs: ALL_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });
    expect(result.records.length + result.excluded.length).toBe(4);
    expect(result.elo.random).toBe(0);
    expect(result.neighborRates).toHaveLength(1);
    expect(result.neighborRates[0]).toMatchObject({ lower: "random", upper: "facil" });
    expect(result.vsAnchor).toHaveLength(1);
    const seatsOfFacil = result.games.filter((g) => g.levelA === "facil").length;
    expect(seatsOfFacil).toBe(2); // metade das partidas com cada nível como A
  }, 60_000);

  it("partida com crash sai do Elo e vai pra `excluded` com seed e decks", async () => {
    const { runLadder } = await import("./ladder");
    const { deckPool } = await import("../../fixtures/benchmarkDeckPools");
    const { ALL_EFFECT_SPECS } = await import("../../content");
    const { randomLegal } = await import("../selfPlay");
    const broken = () => ({ kind: "playCommand" as const, cardInstanceId: "inexistente", trigger: "Main" as const });
    const result = runLadder({
      levels: ["random", "quebrado"],
      decks: deckPool("starters").slice(0, 1),
      gamesPerLevelPair: 2,
      maxTurns: 10,
      seed: 1,
      specs: ALL_EFFECT_SPECS,
      policyFactory: (level) => (level === "quebrado" ? broken : randomLegal),
    });
    expect(result.excluded).toHaveLength(2);
    expect(result.excluded[0]).toMatchObject({ seed: expect.any(Number), deckA: expect.any(String), deckB: expect.any(String) });
    expect(result.records).toHaveLength(0);
  }, 60_000);
});
