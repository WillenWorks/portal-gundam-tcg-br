import { describe, expect, it } from "vitest";
import { runSelfPlay, randomLegal, checkStateInvariants } from "./selfPlay";
import { createGame } from "./setup";
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

describe("checkStateInvariants — regras de campo", () => {
  function fresh() {
    const state = createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 1, firstPlayer: "A" });
    state.pendingDecision.A = null;
    state.pendingDecision.B = null;
    return state;
  }
  function moveFromDeck(state: ReturnType<typeof fresh>, cardType: string, zone: "battleArea" | "baseSection") {
    const deck = state.players.A.deck;
    const idx = deck.findIndex((c) => c.def.cardType === cardType);
    if (idx < 0) throw new Error(`sem ${cardType} no deck`);
    const [card] = deck.splice(idx, 1);
    card.zone = zone;
    state.players.A[zone].push(card);
    return card;
  }

  it("estado recém-criado passa", () => {
    expect(checkStateInvariants(fresh())).toBeNull();
  });

  it("duas Bases na Base Section", () => {
    const state = fresh();
    const base = state.players.A.baseSection[0] ?? moveFromDeck(state, "BASE", "baseSection");
    const clone = { ...base, instanceId: `${base.instanceId}-dup` };
    state.players.A.baseSection.push(clone);
    expect(checkStateInvariants(state)).toMatch(/Base/);
  });

  it("Unit pareada com Piloto que não está em campo", () => {
    const state = fresh();
    const unit = moveFromDeck(state, "UNIT", "battleArea");
    unit.pairedPilotId = "piloto-fantasma";
    expect(checkStateInvariants(state)).toMatch(/Piloto/);
  });

  it("Unit com dano >= HP ainda em campo (fora de combate e sem decisão pendente)", () => {
    const state = fresh();
    const unit = moveFromDeck(state, "UNIT", "battleArea");
    unit.damage = (unit.def.hp ?? 0) + 1;
    expect(checkStateInvariants(state)).toMatch(/dano/);
  });

});
