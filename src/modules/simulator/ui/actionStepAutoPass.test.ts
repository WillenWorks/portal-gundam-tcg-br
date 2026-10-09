import { describe, expect, it } from "vitest";
import { ALL_EFFECT_SPECS } from "../content";
import { createGame } from "../engine/setup";
import type { CardInstance, GameState } from "../engine/types";
import { viewStateFor } from "../engine/viewState";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { actionStepAutoPass } from "./actionStepAutoPass";

function endPhaseWithPriority(priority: "A" | "B"): GameState {
  const state = createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 7, firstPlayer: "A" });
  state.phase = "end";
  state.endPhaseAction = { priority, passes: { A: false, B: false } };
  state.players.A.hand = [];
  state.players.B.hand = [];
  return state;
}

function actionCommand(owner: "A" | "B", seq: number): CardInstance {
  return {
    instanceId: `${owner}-t-${seq}`,
    def: { code: "ST01-014", nameEn: "Unforeseen Incident", cardType: "COMMAND", color: "white", level: 3, cost: 1, triggerKeywords: ["Action"] },
    owner, zone: "hand", rested: false, damage: 0, statModifiers: [], keywordGrants: [], usedKeywordsThisTurn: [], enteredZoneOnTurn: 1,
  } as CardInstance;
}

function activeResources(owner: "A" | "B", n: number): CardInstance[] {
  return Array.from({ length: n }, (_, i) => ({
    instanceId: `${owner}-r-${i}`,
    def: { code: "R", nameEn: "R", cardType: "RESOURCE", color: "colorless" },
    owner, zone: "resourceArea", rested: false, damage: 0, statModifiers: [], keywordGrants: [], usedKeywordsThisTurn: [], enteredZoneOnTurn: 1,
  })) as CardInstance[];
}

describe("actionStepAutoPass (BUG-88RVW1)", () => {
  it("passa o Action Step do fim de turno de quem tem a prioridade e não tem jogada", () => {
    const state = endPhaseWithPriority("A");
    expect(actionStepAutoPass(viewStateFor(state, "A"), "A", ALL_EFFECT_SPECS)).toEqual({ kind: "passEndPhaseAction" });
  });

  it("não passa por quem não tem a prioridade", () => {
    const state = endPhaseWithPriority("B");
    expect(actionStepAutoPass(viewStateFor(state, "A"), "A", ALL_EFFECT_SPECS)).toBeNull();
  });

  it("não passa quando há Comando 【Action】 pagável na mão", () => {
    const state = endPhaseWithPriority("A");
    state.players.A.hand = [actionCommand("A", state.nextInstanceSeq)];
    state.players.A.resourceArea = activeResources("A", 3);
    expect(actionStepAutoPass(viewStateFor(state, "A"), "A", ALL_EFFECT_SPECS)).toBeNull();
  });

  it("fora de Action Step não faz nada", () => {
    const state = endPhaseWithPriority("A");
    state.endPhaseAction = null;
    state.phase = "main";
    expect(actionStepAutoPass(viewStateFor(state, "A"), "A", ALL_EFFECT_SPECS)).toBeNull();
  });
});
