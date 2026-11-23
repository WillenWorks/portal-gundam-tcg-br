import { describe, expect, it } from "vitest";
import { deckPool } from "../../fixtures/benchmarkDeckPools";
import { counterForPlayerDeck, deckSignature, poolForTable, refinementPairs, shrinkPriorGames, SHRINK_PRIOR_GAMES, SHRINK_PRIOR_MAX_GAMES, type MatchupTable } from "./zeroCounter";
import { ZERO_COUNTER_MATCHUPS } from "../../fixtures/zeroCounterMatchups";
import { toPoolFileDeck } from "../../fixtures/benchmarkDeckPools";
import { validateGeneratedDeckLegality } from "./zeroCounterDeckBuilder";

const pool = deckPool("all");
const byId = (id: string) => {
  const d = pool.find((x) => x.id === id);
  if (!d) throw new Error(`deck ${id} sumiu do pool`);
  return d;
};

/** tabela sintética: ST03 vence todo mundo por pouco; ST01 amassa o ST02 */
function table(): MatchupTable {
  const decks = pool.map((d) => d.id);
  const rate: (number | null)[][] = decks.map((row) => decks.map((col) => (row === col ? null : 0.5)));
  const i = (id: string) => decks.indexOf(id);
  for (const col of decks) if (col !== "ST03") rate[i("ST03")][i(col)] = 0.6;
  rate[i("ST01")][i("ST02")] = 0.9;
  return { decks, rate };
}

describe("counterForPlayerDeck", () => {
  it("deck do jogador igual a um do pool: usa o melhor deck contra ele", () => {
    const result = counterForPlayerDeck(byId("ST02").build(), table());
    expect(result.summary.nearestDeckId).toBe("ST02");
    expect(result.summary.counterDeckId).toBe("ST01");
    expect(result.summary.expectedRate).toBeCloseTo(0.9);
    expect(result.summary.fallback).toBe(false);
  });

  it("counter igual ao melhor deck fixo (baseline) marca fallback", () => {
    // contra o ST05 ninguém passa do ST03, que é o baseline
    const result = counterForPlayerDeck(byId("ST05").build(), table());
    expect(result.summary.counterDeckId).toBe("ST03");
    expect(result.summary.baselineDeckId).toBe("ST03");
    expect(result.summary.fallback).toBe(true);
  });

  it("todo counter é legal e vem do pool", () => {
    for (const d of pool) {
      const { deck, summary } = counterForPlayerDeck(d.build(), table());
      expect(validateGeneratedDeckLegality(deck).valid, summary.counterDeckId).toBe(true);
      expect(pool.map((p) => p.id)).toContain(summary.counterDeckId);
    }
  });

  it("deck fora do pool: usa o deck do pool com perfil mais próximo", () => {
    // ST02 com 4 cartas trocadas por cópias de outras do mesmo deck continua perto do ST02
    const st02 = byId("ST02").build();
    const tweaked = { ...st02, main: [...st02.main.slice(0, 46), ...st02.main.slice(0, 4)] };
    expect(deckSignature(tweaked)).not.toBe(deckSignature(st02));
    expect(counterForPlayerDeck(tweaked, table()).summary.nearestDeckId).toBe("ST02");
  });

  it("é determinístico e não depende da ordem das cartas", () => {
    const st04 = byId("ST04").build();
    const shuffled = { ...st04, main: [...st04.main].reverse() };
    expect(counterForPlayerDeck(shuffled, table()).summary).toEqual(counterForPlayerDeck(st04, table()).summary);
  });

  it("traz persona e arquétipo pro aviso da UI", () => {
    const { summary } = counterForPlayerDeck(byId("ST03").build(), table());
    expect(["amuro", "char", "heero", "treize"]).toContain(summary.persona);
    expect(["aggro", "control", "midrange_synergy", "tempo"]).toContain(summary.archetype);
  });

  it("com gamesPerPair, taxa extrema num confronto só não vence um deck forte no geral", () => {
    // ST02 fraco no geral (0,3) mas 0,8 contra o ST05; ST03 forte (0,6 contra todos)
    const t = table();
    const i = (id: string) => t.decks.indexOf(id);
    for (let c = 0; c < t.decks.length; c++) if (t.rate[i("ST02")][c] !== null) t.rate[i("ST02")][c] = 0.3;
    t.rate[i("ST02")][i("ST05")] = 0.8;
    expect(counterForPlayerDeck(byId("ST05").build(), t).summary.counterDeckId).toBe("ST02");
    t.gamesPerPair = 2;
    expect(counterForPlayerDeck(byId("ST05").build(), t).summary.counterDeckId).toBe("ST03");
  });

  it("só troca do baseline com vantagem clara no confronto", () => {
    // ST01 bate o ST02 por pouco acima do baseline (ST03, 0,6): com poucas partidas fica o baseline
    const t = table();
    const i = (id: string) => t.decks.indexOf(id);
    t.rate[i("ST01")][i("ST02")] = 0.75;
    t.gamesPerPair = 40;
    expect(counterForPlayerDeck(byId("ST02").build(), t).summary.fallback).toBe(true);
    // a mesma vantagem medida em muitas partidas passa
    t.gamesPerPair = 2000;
    expect(counterForPlayerDeck(byId("ST02").build(), t).summary.counterDeckId).toBe("ST01");
  });

  it("matriz do GD06 sem o reforço: nenhum confronto tem vantagem clara, o counter é sempre o baseline", () => {
    const stageOne: MatchupTable = { ...ZERO_COUNTER_MATCHUPS, refined: undefined };
    const gd06 = poolForTable(stageOne);
    for (const d of gd06) expect(counterForPlayerDeck(d.build(), stageOne, gd06).summary.fallback).toBe(true);
  });

  it("matriz do GD06 com o reforço: troca só onde o reforço mostrou vantagem clara", () => {
    const gd06 = poolForTable(ZERO_COUNTER_MATCHUPS);
    const ref = ZERO_COUNTER_MATCHUPS.refined!;
    for (const d of gd06) {
      const { summary } = counterForPlayerDeck(d.build(), ZERO_COUNTER_MATCHUPS, gd06);
      if (summary.fallback) continue;
      const i = ZERO_COUNTER_MATCHUPS.decks.indexOf(summary.counterDeckId);
      const j = ZERO_COUNTER_MATCHUPS.decks.indexOf(d.id);
      expect(ref.played[i][j]).toBeGreaterThan(0);
    }
  });

  describe("reforço (2ª etapa)", () => {
    /** tabela com gamesPerPair (1ª etapa toda em fallback) + reforço vazio */
    function withRefined(): MatchupTable {
      const t = table();
      t.gamesPerPair = 40;
      const size = t.decks.length;
      t.refined = { level: "dificil", wins: Array.from({ length: size }, () => Array<number>(size).fill(0)), played: Array.from({ length: size }, () => Array<number>(size).fill(0)) };
      return t;
    }
    const set = (t: MatchupTable, row: string, col: string, wins: number, played: number) => {
      const i = t.decks.indexOf(row);
      const j = t.decks.indexOf(col);
      t.refined!.wins[i][j] = wins;
      t.refined!.played[i][j] = played;
    };

    it("candidato medido com vantagem clara sobre o baseline vira o counter", () => {
      const t = withRefined();
      set(t, "ST03", "ST02", 110, 200); // baseline 55%
      set(t, "ST01", "ST02", 150, 200); // 75%
      const { summary } = counterForPlayerDeck(byId("ST02").build(), t);
      expect(summary.counterDeckId).toBe("ST01");
      expect(summary.expectedRate).toBeCloseTo(0.75);
    });

    it("vantagem pequena no reforço: fica o baseline, mesmo se a 1ª etapa trocasse", () => {
      const t = withRefined();
      t.rate[t.decks.indexOf("ST01")][t.decks.indexOf("ST02")] = 1;
      t.gamesPerPair = 2000;
      expect(counterForPlayerDeck(byId("ST02").build(), t).summary.counterDeckId).toBe("ST01");
      set(t, "ST03", "ST02", 110, 200);
      set(t, "ST01", "ST02", 120, 200);
      expect(counterForPlayerDeck(byId("ST02").build(), t).summary.fallback).toBe(true);
    });

    it("mais candidatos medidos exigem margem maior (Bonferroni)", () => {
      const t = withRefined();
      set(t, "ST03", "ST02", 100, 200); // 50%
      set(t, "ST01", "ST02", 118, 200); // 59%: z ≈ 1,82
      expect(counterForPlayerDeck(byId("ST02").build(), t).summary.counterDeckId).toBe("ST01");
      set(t, "ST04", "ST02", 100, 200);
      expect(counterForPlayerDeck(byId("ST02").build(), t).summary.fallback).toBe(true);
    });

    it("espelho: o jogador com o próprio baseline compara com 50%", () => {
      const t = withRefined();
      set(t, "ST01", "ST03", 125, 200); // 62,5% contra o baseline
      expect(counterForPlayerDeck(byId("ST03").build(), t).summary.counterDeckId).toBe("ST01");
    });

    it("coluna sem reforço do baseline: decide a 1ª etapa", () => {
      const t = withRefined();
      set(t, "ST01", "ST02", 200, 200);
      expect(counterForPlayerDeck(byId("ST02").build(), t).summary.fallback).toBe(true);
    });
  });

  describe("refinementPairs", () => {
    it("GD06: cada coluna com candidato leva também o baseline × coluna, sem pares repetidos", () => {
      const pairs = refinementPairs(ZERO_COUNTER_MATCHUPS);
      const keys = pairs.map(([a, b]) => [a, b].sort().join("|"));
      expect(new Set(keys).size).toBe(pairs.length);
      expect(pairs.length).toBeGreaterThan(0);
      expect(pairs.length).toBeLessThan(60);
      const baseline = counterForPlayerDeck(poolForTable(ZERO_COUNTER_MATCHUPS)[0].build(), ZERO_COUNTER_MATCHUPS).summary.baselineDeckId;
      for (const [row, col] of pairs) {
        if (row === baseline || col === baseline) continue;
        expect(keys).toContain([baseline, col].sort().join("|"));
      }
    });

    it("minZ alto: nenhum par", () => {
      expect(refinementPairs(ZERO_COUNTER_MATCHUPS, { minZ: 10 })).toEqual([]);
    });
  });

  it("tabela com listas embutidas (decks do banco): o counter sai dessas listas", () => {
    const st01 = toPoolFileDeck(byId("ST01"));
    const st02 = toPoolFileDeck(byId("ST02"));
    const t: MatchupTable = {
      decks: ["DB-A", "DB-B"],
      rate: [[null, 0.7], [0.3, null]],
      lists: { "DB-A": st01.list, "DB-B": st02.list },
    };
    expect(poolForTable(t).map((d) => d.id)).toEqual(["DB-A", "DB-B"]);
    const { deck, summary } = counterForPlayerDeck(byId("ST02").build(), t);
    expect(summary.nearestDeckId).toBe("DB-B");
    expect(summary.counterDeckId).toBe("DB-A");
    expect(deck.main.map((c) => c.code)).toEqual(st01.list.main);
  });

  describe("shrinkPriorGames (peso estimado da matriz)", () => {
    it("matriz do GD06 (pouco sinal de confronto): peso bem acima do mínimo", () => {
      const prior = shrinkPriorGames(ZERO_COUNTER_MATCHUPS);
      expect(prior).toBeGreaterThan(40);
      expect(prior).toBeLessThanOrEqual(SHRINK_PRIOR_MAX_GAMES);
    });

    it("confrontos fortes e muitas partidas: peso fica no mínimo", () => {
      const size = 8;
      const decks = Array.from({ length: size }, (_, i) => `D${i}`);
      // pedra-papel-tesoura: cada deck amassa o seguinte e perde do anterior, média 0,5 para todos
      const rate = decks.map((_, i) => decks.map((_, j) => (i === j ? null : (j - i + size) % size <= size / 2 ? 0.95 : 0.05)));
      expect(shrinkPriorGames({ decks, rate, gamesPerPair: 100 })).toBe(SHRINK_PRIOR_GAMES);
    });

    it("sem gamesPerPair: peso mínimo (e a escolha usa a taxa crua)", () => {
      expect(shrinkPriorGames(table())).toBe(SHRINK_PRIOR_GAMES);
    });
  });
});
