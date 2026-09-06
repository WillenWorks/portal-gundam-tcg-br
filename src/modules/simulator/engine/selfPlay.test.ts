import { describe, expect, it } from "vitest";
import { runSelfPlay, randomLegal, checkStateInvariants } from "./selfPlay";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { buildSt03DeckList } from "../fixtures/st03Deck";
import { buildSt04DeckList } from "../fixtures/st04Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

/**
 * Testes do motor de self-play (docs/44, Fase 1 — §3.4). `randomLegal` vs
 * `randomLegal` com seed fixo termina sem crash e sem estado ilegal.
 */

const decks = {
  ST01: buildSt01DeckList,
  ST02: buildSt02DeckList,
  ST03: buildSt03DeckList,
  ST04: buildSt04DeckList,
};

function run(a: keyof typeof decks, b: keyof typeof decks, seed: number) {
  return runSelfPlay({
    deckA: decks[a](),
    deckB: decks[b](),
    seed,
    specs: ALL_EFFECT_SPECS,
    predicateResolver: defaultPredicateResolver,
    targetFilterResolver: defaultTargetFilterResolver,
  });
}

describe("runSelfPlay", () => {
  it("ST01 x ST01 seed fixo: termina em GAME_OVER real, sem crash", () => {
    const r = run("ST01", "ST01", 42);
    expect(r.crashed).toBeUndefined();
    expect(r.illegalState).toBeUndefined();
    expect(r.winner === "A" || r.winner === "B").toBe(true);
    expect(r.reason).not.toBeNull();
    expect(r.actionsPlayed).toBeGreaterThan(0);
    expect(checkStateInvariants(r.finalState)).toBeNull();
  });

  it("é determinístico dado o mesmo seed", () => {
    const a = run("ST03", "ST04", 7);
    const b = run("ST03", "ST04", 7);
    expect(b.winner).toBe(a.winner);
    expect(b.turns).toBe(a.turns);
    expect(b.actionsPlayed).toBe(a.actionsPlayed);
  });

  it("pares ST01-04, vários seeds: nenhum crash / estado ilegal / partida infinita", () => {
    const pairs: Array<[keyof typeof decks, keyof typeof decks]> = [
      ["ST01", "ST01"],
      ["ST01", "ST02"],
      ["ST01", "ST04"],
      ["ST02", "ST03"],
      ["ST03", "ST04"],
      ["ST04", "ST04"],
    ];
    for (const [a, b] of pairs) {
      for (let seed = 1; seed <= 10; seed++) {
        const r = run(a, b, seed);
        const label = `${a}x${b} seed=${seed}`;
        expect(r.crashed, `${label}: ${r.crashed?.error} @ ${JSON.stringify(r.crashed?.action)}`).toBeUndefined();
        expect(r.illegalState, `${label}: ${r.illegalState}`).toBeUndefined();
        expect(r.winner, `${label}: partida não terminou`).not.toBeNull();
      }
    }
  }, 60_000);

  it("randomLegal escolhe uma ação da lista", () => {
    const rng = () => 0;
    const chosen = randomLegal({} as never, [{ kind: "finishTurn" }, { kind: "passAction" }], rng);
    expect(chosen).toEqual({ kind: "finishTurn" });
  });
});
