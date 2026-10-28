import { describe, expect, it } from "vitest";
import type { GameState } from "../engine/types";
import { createGame } from "../engine/setup";
import { applyPlayerAction } from "../engine/actions";
import { viewStateFor } from "../engine/viewState";
import { DECK_BUILDERS } from "../engine/__golden__/harness";
import { ALL_EFFECT_SPECS, defaultPredicateResolver } from "../content";
import { drawnCard, placedResource, unrestedIds } from "./turnStart";

/** partida já no turno 1 de A, com o setup feito pelos dois mulligans */
function inGame(): GameState {
  let s = createGame(DECK_BUILDERS.ST01(), DECK_BUILDERS.ST02(), { seed: 5, firstPlayer: "A", interactiveMulligan: true });
  s = applyPlayerAction(s, "A", { kind: "resolveMulligan", keep: true }, ALL_EFFECT_SPECS, defaultPredicateResolver);
  return applyPlayerAction(s, "B", { kind: "resolveMulligan", keep: true }, ALL_EFFECT_SPECS, defaultPredicateResolver);
}

describe("começo de turno — o que cada fase mudou", () => {
  it("desvirar: só as cartas do jogador que estavam descansadas e ficaram ativas", () => {
    const s = inGame();
    const rested: GameState = {
      ...s,
      players: { ...s.players, A: { ...s.players.A, resourceArea: s.players.A.resourceArea.map((c) => ({ ...c, rested: true })) } },
    };
    const before = viewStateFor(rested, "B");
    const after = viewStateFor(s, "B");
    expect([...unrestedIds(before, after, "A")].sort()).toEqual(s.players.A.resourceArea.map((c) => c.instanceId).sort());
    expect(unrestedIds(before, after, "B").size).toBe(0);
  });

  it("compra: a carta nova da mão — com face para o dono, oculta para o oponente", () => {
    const s = inGame();
    const drawn = s.players.A.hand[s.players.A.hand.length - 1];
    const before: GameState = { ...s, players: { ...s.players, A: { ...s.players.A, hand: s.players.A.hand.slice(0, -1) } } };
    const mine = drawnCard(viewStateFor(before, "A"), viewStateFor(s, "A"), "A");
    expect(mine?.instanceId).toBe(drawn.instanceId);
    expect(mine && "def" in mine).toBe(true);
    const theirs = drawnCard(viewStateFor(before, "B"), viewStateFor(s, "B"), "A");
    expect(theirs && "hidden" in theirs).toBe(true);
  });

  it("recurso: a carta que entrou na área de recursos", () => {
    const s = inGame();
    const placed = s.players.A.resourceArea[s.players.A.resourceArea.length - 1];
    const before: GameState = { ...s, players: { ...s.players, A: { ...s.players.A, resourceArea: s.players.A.resourceArea.slice(0, -1) } } };
    expect(placedResource(viewStateFor(before, "B"), viewStateFor(s, "B"), "A")?.instanceId).toBe(placed.instanceId);
    expect(placedResource(viewStateFor(s, "B"), viewStateFor(s, "B"), "A")).toBeNull();
  });
});
