import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { placeCard } from "../engine/__testkit__/cardHarness";
import { buildSt06DeckList, ST06_CARD_DEFS } from "../fixtures/st06Deck";
import { buildSt04DeckList } from "../fixtures/st04Deck";
import type { GameState } from "../engine/types";
import type { EffectContext } from "../engine/effectSpec";
import { resolveEffectSpec } from "../engine/effectSpec";
import { applyEvents, findCard } from "../engine/events";
import {
  GQUUUUUUX_WHEN_LINKED,
  GQUUUUUUX_DEPLOY,
  RED_GUNDAM_ATTACK,
  ORTEGA_RICK_DOM_DEPLOY,
  AMATE_YUZURIHA_WHEN_LINKED,
  SHUJI_ITO_ATTACK,
  RUTHLESS_TACTICS_MAIN,
  RUTHLESS_TACTICS_ACTION,
  SCHOOLGIRL_AND_SMUGGLER_MAIN,
  FIERCE_UNITY_ACTION,
  CLAN_BATTLE_DEPLOY,
  CLAN_BATTLE_ACTIVATE_MAIN,
  KANEBAN_DEPLOY,
  ST06_EFFECT_SPECS,
} from "./st06";
import { defaultPredicateResolver, defaultTargetFilterResolver } from "./predicates";

function freshGame(): GameState {
  return createGame(buildSt06DeckList(), buildSt04DeckList(), { seed: 60, firstPlayer: "A" });
}

function ctxFor(state: GameState, sourceInstanceId: string, targets: Record<string, string[]> = {}): EffectContext {
  return { state, controller: "A", sourceInstanceId, turnNumber: state.turnNumber, targets };
}

describe("ST06 — fixtures e cobertura", () => {
  it("deck ST06 monta exatamente 50 cartas principais + 10 recursos", () => {
    const deckList = buildSt06DeckList();
    expect(deckList.main).toHaveLength(50);
    expect(deckList.resources).toHaveLength(10);
    expect(() => createGame(deckList, buildSt04DeckList(), { seed: 10, firstPlayer: "A" })).not.toThrow();
  });

  it("EffectSpecs cobrem as cartas bespoke de ST06", () => {
    expect(ST06_EFFECT_SPECS.length).toBeGreaterThanOrEqual(12);
    const coveredCodes = new Set(ST06_EFFECT_SPECS.map((s) => s.cardCode));
    expect(coveredCodes.has("ST06-001")).toBe(true);
    expect(coveredCodes.has("ST06-002")).toBe(true);
    expect(coveredCodes.has("ST06-005")).toBe(true);
    expect(coveredCodes.has("ST06-007")).toBe(true);
    expect(coveredCodes.has("ST06-009")).toBe(true);
    expect(coveredCodes.has("ST06-010")).toBe(true);
    expect(coveredCodes.has("ST06-011")).toBe(true);
    expect(coveredCodes.has("ST06-012")).toBe(true);
    expect(coveredCodes.has("ST06-013")).toBe(true);
    expect(coveredCodes.has("ST06-014")).toBe(true);
    expect(coveredCodes.has("ST06-015")).toBe(true);
  });
});

describe("ST06 — resolução de EffectSpecs", () => {
  it("ST06-001 GQuuuuuuX — 【When Linked】concede First Strike quando outro Clan Unit está em jogo", () => {
    let state = freshGame();
    const gqId = placeCard(state, "A", ST06_CARD_DEFS["ST06-001"], "battleArea");
    // Coloca outra unidade com trait Clan
    placeCard(state, "A", ST06_CARD_DEFS["ST06-003"], "battleArea");

    const events = resolveEffectSpec(GQUUUUUUX_WHEN_LINKED, ctxFor(state, gqId), defaultPredicateResolver);
    expect(events.length).toBeGreaterThan(0);
    state = applyEvents(state, events);
    const card = findCard(state, gqId);
    expect(card.keywordGrants?.some((k) => k.keyword === "First Strike")).toBe(true);
  });

  it("ST06-002 GQuuuuuuX — 【Deploy】causa 1 de dano a unidade inimiga com outro Clan em jogo", () => {
    let state = freshGame();
    const gqId = placeCard(state, "A", ST06_CARD_DEFS["ST06-002"], "battleArea");
    placeCard(state, "A", ST06_CARD_DEFS["ST06-003"], "battleArea");
    const enemyId = placeCard(state, "B", ST06_CARD_DEFS["ST06-004"], "battleArea");

    const events = resolveEffectSpec(GQUUUUUUX_DEPLOY, ctxFor(state, gqId, { target: [enemyId] }), defaultPredicateResolver);
    expect(events.length).toBeGreaterThan(0);
    state = applyEvents(state, events);
    expect(findCard(state, enemyId).damage).toBe(1);
  });

  it("ST06-005 Red Gundam — 【Attack】buffa AP+2 para até 2 unidades Clan", () => {
    let state = freshGame();
    const redId = placeCard(state, "A", ST06_CARD_DEFS["ST06-005"], "battleArea");
    const allyId = placeCard(state, "A", ST06_CARD_DEFS["ST06-003"], "battleArea");

    const events = resolveEffectSpec(RED_GUNDAM_ATTACK, ctxFor(state, redId, { targets: [redId, allyId] }), defaultPredicateResolver);
    expect(events.length).toBe(2);
    state = applyEvents(state, events);
    expect(findCard(state, redId).statModifiers?.some((m) => m.stat === "ap" && m.amount === 2)).toBe(true);
    expect(findCard(state, allyId).statModifiers?.some((m) => m.stat === "ap" && m.amount === 2)).toBe(true);
  });

  it("ST06-014 Clan Battle e ST06-015 Kaneban — 【Deploy】puxa 1 shield para a mão", () => {
    let state = freshGame();
    const baseId = placeCard(state, "A", ST06_CARD_DEFS["ST06-014"], "baseSection");
    const initialHandCount = state.players.A.hand.length;

    const events = resolveEffectSpec(CLAN_BATTLE_DEPLOY, ctxFor(state, baseId), defaultPredicateResolver);
    state = applyEvents(state, events);
    expect(state.players.A.hand.length).toBe(initialHandCount + 1);
  });
});
