/* Eventos de narração (spec simulador-animacao-pelo-log, fase 1): não mudam o estado, só contam à tela o que foi
 * jogado/ativado. Pelo caminho do jogador: a jogada legal tem que deixar o evento no log. */
import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { enumerateLegalActions } from "./legalActions";
import { applyEvent } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { scenarioOpts } from "./__testkit__/cardScenario";
import type { CardDef, GameEvent, GameState } from "./types";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { ALL_CARD_DEFS } from "../content/allCardDefs";

const RESOURCE: CardDef = { code: "CA-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" };

function board(): GameState {
  const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: "A" }));
  for (let i = 0; i < 6; i++) placeCard(state, "A", RESOURCE, "resourceArea");
  return state;
}

/** aplica a 1ª jogada legal que casa e devolve só os eventos que ela produziu */
function play(state: GameState, match: (a: PlayerAction) => boolean): GameEvent[] {
  const action = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, scenarioOpts).find(match);
  expect(action).toBeDefined();
  const next = applyPlayerAction(state, "A", action!, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
  return next.eventLog.slice(state.eventLog.length);
}

describe("narração no log: carta jogada e habilidade ativada", () => {
  it("deploy de Unit e de Base, e Piloto pareado", () => {
    const state = board();
    const unit = placeCard(state, "A", ST01_CARD_DEFS.GM, "hand");
    const baseCard = placeCard(state, "A", ALL_CARD_DEFS["ST01-015"], "hand");
    const host = placeCard(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const pilot = placeCard(state, "A", ALL_CARD_DEFS["ST01-010"], "hand");
    expect(play(state, (a) => a.kind === "deployCard" && a.cardInstanceId === unit)[0]).toEqual({ type: "CARD_PLAYED", player: "A", instanceId: unit, as: "unit" });
    expect(play(state, (a) => a.kind === "deployCard" && a.cardInstanceId === baseCard)[0]).toEqual({ type: "CARD_PLAYED", player: "A", instanceId: baseCard, as: "base" });
    expect(play(state, (a) => a.kind === "deployCard" && a.cardInstanceId === pilot && "pairWithUnitId" in a && a.pairWithUnitId === host)[0]).toEqual({
      type: "CARD_PLAYED",
      player: "A",
      instanceId: pilot,
      as: "pilot",
    });
  });

  it("Command jogada leva o gatilho; o evento vem antes do pagamento e do efeito", () => {
    const state = board();
    placeCard(state, "A", ST01_CARD_DEFS.GM, "battleArea", { damage: 1 });
    const cmd = placeCard(state, "A", ALL_CARD_DEFS["ST01-013"], "hand");
    const events = play(state, (a) => a.kind === "playCommand" && a.cardInstanceId === cmd);
    expect(events[0]).toEqual({ type: "CARD_PLAYED", player: "A", instanceId: cmd, as: "command", trigger: "Main" });
    expect(events.some((e) => e.type === "HEAL_UNIT")).toBe(true);
  });

  it("【Activate･Main】 de Base anuncia a ativação antes do custo", () => {
    const state = board();
    state.players.A.baseSection = [];
    const base = placeCard(state, "A", ALL_CARD_DEFS["ST01-015"], "baseSection");
    placeCard(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const events = play(state, (a) => a.kind === "activateAbility" && a.sourceInstanceId === base);
    expect(events[0]).toEqual({ type: "ABILITY_ACTIVATED", player: "A", instanceId: base, trigger: "Activate·Main" });
  });

  it("os eventos de narração não mudam o estado: só entram no log", () => {
    const state = board();
    const id = state.players.A.hand[0].instanceId;
    for (const event of [
      { type: "CARD_PLAYED", player: "A", instanceId: id, as: "unit" },
      { type: "ABILITY_ACTIVATED", player: "A", instanceId: id, trigger: "Burst" },
    ] as GameEvent[]) {
      const next = applyEvent(state, event);
      expect(next.eventLog).toEqual([...state.eventLog, event]);
      expect({ ...next, eventLog: [] }).toEqual({ ...state, eventLog: [] });
    }
  });
});
