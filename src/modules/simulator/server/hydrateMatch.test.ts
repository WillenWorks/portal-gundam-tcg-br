import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { advanceToMainPhase } from "../engine/phases";
import { applyPlayerAction } from "../engine/actions";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { hydrateMatch, HydrateMatchError } from "./hydrateMatch";

/** simula o que o servidor faz: serializa pro banco (JSON) e lê de volta. */
function roundTrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe("hydrateMatch (docs/44 Fase 3 §5.1)", () => {
  it("round-trip: createGame → JSON → hydrateMatch devolve um estado idêntico", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: "A" }));
    const rehydrated = hydrateMatch(roundTrip(state));
    expect(rehydrated).toEqual(state);
  });

  it("o estado re-hidratado continua utilizável em applyPlayerAction", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: "A" }));
    const rehydrated = hydrateMatch(roundTrip(state));
    const next = applyPlayerAction(
      rehydrated,
      "A",
      { kind: "finishTurn" },
      ALL_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    expect(next.phase).toBe("end");
  });

  it("preserva uma partida no meio de um turno (após algumas ações)", () => {
    let state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 3, firstPlayer: "A" }));
    state = applyPlayerAction(state, "A", { kind: "finishTurn" }, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
    const rehydrated = hydrateMatch(roundTrip(state));
    expect(rehydrated).toEqual(state);
  });

  it("rejeita JSON que não é objeto", () => {
    expect(() => hydrateMatch(null)).toThrow(HydrateMatchError);
    expect(() => hydrateMatch("{}")).toThrow(/não é um objeto/);
    expect(() => hydrateMatch([])).toThrow(HydrateMatchError);
  });

  it("rejeita objeto sem os campos obrigatórios", () => {
    expect(() => hydrateMatch({})).toThrow(/turnNumber/);
    expect(() => hydrateMatch({ turnNumber: 1, nextInstanceSeq: 0, seed: 1, activePlayer: "A", phase: "wat" })).toThrow(/phase/);
  });

  it("rejeita players/zonas malformados", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 1, firstPlayer: "A" }));
    const broken = roundTrip(state) as Record<string, unknown>;
    (broken.players as Record<string, { hand: unknown }>).A.hand = "não é lista";
    expect(() => hydrateMatch(broken)).toThrow(/players\.A\.hand/);
  });

  it("rejeita carta sem instanceId / sem def.code", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 1, firstPlayer: "A" }));
    const broken = roundTrip(state) as Record<string, unknown>;
    (broken.players as Record<string, { deck: unknown[] }>).A.deck[0] = { def: { code: "" }, owner: "A", zone: "deck", damage: 0, rested: false, statModifiers: [], keywordGrants: [], usedKeywordsThisTurn: [] };
    expect(() => hydrateMatch(broken)).toThrow(/instanceId/);
  });

  it("aceita estado sem engineVersion (blob antigo) mas rejeita engineVersion não-string", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 1, firstPlayer: "A" }));
    const withoutEngine = roundTrip(state) as Record<string, unknown>;
    delete withoutEngine.engineVersion;
    expect(() => hydrateMatch(withoutEngine)).not.toThrow();

    const badEngine = roundTrip(state) as Record<string, unknown>;
    badEngine.engineVersion = 123;
    expect(() => hydrateMatch(badEngine)).toThrow(/engineVersion/);
  });
});
