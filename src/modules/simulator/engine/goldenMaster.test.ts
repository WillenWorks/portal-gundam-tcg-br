import { describe, expect, it } from "vitest";
import {
  GOLDEN_PAIRS,
  computeGoldenOutcome,
  computeAllGoldenOutcomes,
  normalizeGoldenState,
  runGoldenGame,
} from "./__golden__/harness";

/**
 * Golden-master do motor dentro do `pnpm test` (docs/44, Fase 2 — §4.3). Mesma
 * checagem do `scripts/gundam-golden.mjs`: roda os 10 pares ST01–ST04 com seed
 * fixo e confere o hash SHA-256 do `GameState` final normalizado contra
 * `__golden__/hashes.json`. Um PR que muda um resultado de regra sem
 * `pnpm gundam:golden:update` falha aqui.
 */

const globbed = import.meta.glob("./__golden__/hashes.json", { eager: true }) as Record<
  string,
  { default: Record<string, string> }
>;
const storedHashes = Object.values(globbed)[0].default;

describe("golden-master do motor", () => {
  it("hashes.json cobre exatamente os 10 pares ST01–ST04", () => {
    expect(Object.keys(storedHashes).sort()).toEqual(GOLDEN_PAIRS.map((p) => p.key).sort());
  });

  it(
    "todos os 10 pares conferem com o hash gravado",
    async () => {
      const outcomes = await computeAllGoldenOutcomes();
      const diffs = outcomes
        .filter((o) => o.hash !== storedHashes[o.pair.key])
        .map((o) => `${o.pair.key}: esperado ${storedHashes[o.pair.key]}, obtido ${o.hash}`);
      expect(diffs, `motor mudou de comportamento — rode 'pnpm gundam:golden:update' se foi intencional:\n${diffs.join("\n")}`).toEqual(
        [],
      );
    },
    30_000,
  );

  it("é determinístico: recomputar o mesmo par dá o mesmo hash", async () => {
    const pair = GOLDEN_PAIRS[0];
    const a = await computeGoldenOutcome(pair);
    const b = await computeGoldenOutcome(pair);
    expect(b.hash).toBe(a.hash);
  });

  it("a normalização remove só `engineVersion` e `seed`", () => {
    const finalState = runGoldenGame(GOLDEN_PAIRS[0]);
    const normalized = normalizeGoldenState(finalState);
    expect("engineVersion" in normalized).toBe(false);
    expect("seed" in normalized).toBe(false);
    expect(normalized.turnNumber).toBe(finalState.turnNumber);
    expect(normalized.gameOver).toEqual(finalState.gameOver);
    expect(Array.isArray(normalized.eventLog)).toBe(true);
  });
});
