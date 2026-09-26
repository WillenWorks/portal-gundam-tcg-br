import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { placeCard } from "../engine/__testkit__/cardHarness";
import { advanceToMainPhase } from "../engine/phases";
import { applyPlayerAction } from "../engine/actions";
import { findCard } from "../engine/events";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD03_CARD_DEFS } from "../content/gd03";
import { commandTargets, missingSecondaryTarget, primaryTargetsDone, secondaryTargetingFor } from "./commandSecondaryTarget";

function board() {
  const state = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 31, firstPlayer: "A" }));
  for (let i = 0; i < 3; i++) {
    placeCard(state, "A", { code: "RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
  }
  const cmdId = placeCard(state, "A", GD03_CARD_DEFS["GD03-116"], "hand");
  const vaganId = placeCard(state, "A", GD03_CARD_DEFS["GD03-054"], "battleArea");
  const enemyId = placeCard(state, "B", GD03_CARD_DEFS["GD03-001"], "battleArea");
  return { state, cmdId, vaganId, enemyId };
}

describe("UI — 2º alvo de Command (secondaryTarget)", () => {
  it("GD03-116: pool do 2º alvo = Units inimigas; Command sem secondaryTarget (GD03-101) dá null", () => {
    const { state, enemyId } = board();
    const secondary = secondaryTargetingFor(state, "A", "GD03-116", "Main", ALL_EFFECT_SPECS, defaultTargetFilterResolver);
    expect(secondary?.name).toBe("enemyTarget");
    expect([...(secondary?.ids ?? [])]).toEqual([enemyId]);
    expect(secondaryTargetingFor(state, "A", "GD03-101", "Main", ALL_EFFECT_SPECS, defaultTargetFilterResolver)).toBeNull();
  });

  it("etapas: 2º alvo só depois do 1º; a jogada espera o 2º alvo", () => {
    const { state, vaganId, enemyId } = board();
    const secondary = secondaryTargetingFor(state, "A", "GD03-116", "Main", ALL_EFFECT_SPECS, defaultTargetFilterResolver);
    expect(primaryTargetsDone(1, 1, [])).toBe(false);
    expect(primaryTargetsDone(1, 1, [vaganId])).toBe(true);
    expect(primaryTargetsDone(0, 1, [])).toBe(true); // sem pool principal: nada a escolher
    expect(missingSecondaryTarget(secondary, 1, [])).toBe(true);
    expect(missingSecondaryTarget(secondary, 1, [enemyId])).toBe(false);
    expect(missingSecondaryTarget(secondary, 0, [])).toBe(false);
    expect(commandTargets([vaganId], secondary, [enemyId])).toEqual({ target: [vaganId], enemyTarget: [enemyId] });
    expect(commandTargets([], null, [])).toBeUndefined();
  });

  it("os targets montados pela UI são aceitos pelo motor (GD03-116 dá 2 de dano nos dois)", () => {
    const { state, cmdId, vaganId, enemyId } = board();
    const secondary = secondaryTargetingFor(state, "A", "GD03-116", "Main", ALL_EFFECT_SPECS, defaultTargetFilterResolver);
    const next = applyPlayerAction(
      state,
      "A",
      { kind: "playCommand", cardInstanceId: cmdId, trigger: "Main", targets: commandTargets([vaganId], secondary, [enemyId]) },
      ALL_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    expect(findCard(next, vaganId).damage).toBe(2);
    expect(findCard(next, enemyId).damage).toBe(2);
  });
});
