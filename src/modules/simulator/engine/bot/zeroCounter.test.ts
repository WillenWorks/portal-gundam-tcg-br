import { describe, expect, it } from "vitest";
import { deckPool } from "../../fixtures/benchmarkDeckPools";
import { counterForPlayerDeck, deckSignature, type MatchupTable } from "./zeroCounter";
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
});
