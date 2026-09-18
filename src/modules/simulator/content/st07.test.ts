import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { placeCard } from "../engine/__testkit__/cardHarness";
import { buildSt07DeckList, ST07_CARD_DEFS } from "../fixtures/st07Deck";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import type { GameState } from "../engine/types";
import type { EffectContext } from "../engine/effectSpec";
import { resolveEffectSpec } from "../engine/effectSpec";
import { applyEvents, findCard } from "../engine/events";
import {
  GUNDAM_EXIA_WHEN_PAIRED,
  GUNDAM_EXIA_END_OF_TURN,
  SETSUNA_ATTACK,
  TIERIA_DESTROYED,
  LOCKON_WHEN_PAIRED,
  ARMED_INTERVENTION_BURST,
  TACTICAL_VISIONARY_MAIN,
  PTOLEMAIOS_DEPLOY,
  ST07_EFFECT_SPECS,
} from "./st07";
import { defaultPredicateResolver, defaultTargetFilterResolver } from "./predicates";

function freshGame(): GameState {
  return createGame(buildSt07DeckList(), buildSt01DeckList(), { seed: 70, firstPlayer: "A" });
}

function ctxFor(state: GameState, sourceInstanceId: string, targets: Record<string, string[]> = {}): EffectContext {
  return { state, controller: "A", sourceInstanceId, turnNumber: state.turnNumber, targets };
}

describe("ST07 — fixtures e cobertura", () => {
  it("deck ST07 monta exatamente 50 cartas principais + 10 recursos", () => {
    const deckList = buildSt07DeckList();
    expect(deckList.main).toHaveLength(50);
    expect(deckList.resources).toHaveLength(10);
    expect(() => createGame(deckList, buildSt01DeckList(), { seed: 71, firstPlayer: "A" })).not.toThrow();
  });

  it("EffectSpecs cobrem as cartas bespoke de ST07", () => {
    expect(ST07_EFFECT_SPECS.length).toBeGreaterThanOrEqual(10);
    const coveredCodes = new Set(ST07_EFFECT_SPECS.map((s) => s.cardCode));
    expect(coveredCodes.has("ST07-001")).toBe(true);
    expect(coveredCodes.has("ST07-009")).toBe(true);
    expect(coveredCodes.has("ST07-010")).toBe(true);
    expect(coveredCodes.has("ST07-011")).toBe(true);
    expect(coveredCodes.has("ST07-012")).toBe(true);
    expect(coveredCodes.has("ST07-013")).toBe(true);
    expect(coveredCodes.has("ST07-014")).toBe(true);
    expect(coveredCodes.has("ST07-015")).toBe(true);
  });
});

describe("ST07 — efeitos em jogo", () => {
  it("ST07-001 Gundam Exia [When Paired] mói 2 cartas para o trash e compra se conter (CB)", () => {
    let state = freshGame();
    const exiaId = placeCard(state, "A", ST07_CARD_DEFS["ST07-001"], "battleArea");
    const handBefore = state.players.A.hand.length;
    const trashBefore = state.players.A.trash.length;

    const ctx = ctxFor(state, exiaId);
    const events = resolveEffectSpec(GUNDAM_EXIA_WHEN_PAIRED, ctx);
    state = applyEvents(state, events);

    expect(state.players.A.trash.length).toBe(trashBefore + 2);
    // As cartas do topo do deck ST07 contêm traits CB, então compra 1
    expect(state.players.A.hand.length).toBe(handBefore + 1);
  });

  it("ST07-001 Gundam Exia [EndOfTurn] desvira 1 recurso se trash tiver 7+ cartas (CB)", () => {
    let state = freshGame();
    const exiaId = placeCard(state, "A", ST07_CARD_DEFS["ST07-001"], "battleArea");
    
    // Adiciona 7 cartas CB na lixeira de A
    for (let i = 0; i < 7; i++) {
      placeCard(state, "A", ST07_CARD_DEFS["ST07-002"], "trash");
    }

    // Coloca e vira um recurso de A
    const resDef = { code: "RESOURCE", nameEn: "Resource", cardType: "RESOURCE" as const, color: "colorless" as const };
    const resId = placeCard(state, "A", resDef, "resourceArea", { rested: true });

    const ctx = ctxFor(state, exiaId, { target: [resId] });
    const events = resolveEffectSpec(GUNDAM_EXIA_END_OF_TURN, ctx, defaultPredicateResolver);
    state = applyEvents(state, events);

    expect(findCard(state, resId).rested).toBe(false);
  });

  it("ST07-009 Setsuna F. Seiei [Attack] concede AP+1 para todas as units CB se 7+ cartas CB no trash", () => {
    let state = freshGame();
    const exiaId = placeCard(state, "A", ST07_CARD_DEFS["ST07-001"], "battleArea");
    const virtueId = placeCard(state, "A", ST07_CARD_DEFS["ST07-003"], "battleArea");
    const setsunaId = placeCard(state, "A", ST07_CARD_DEFS["ST07-009"], "battleArea");
    
    const exia = findCard(state, exiaId);
    const setsuna = findCard(state, setsunaId);
    exia.pairedPilotId = setsunaId;
    setsuna.pairedUnitId = exiaId;

    for (let i = 0; i < 7; i++) {
      placeCard(state, "A", ST07_CARD_DEFS["ST07-002"], "trash");
    }

    const ctx = ctxFor(state, setsunaId);
    const events = resolveEffectSpec(SETSUNA_ATTACK, ctx, defaultPredicateResolver);
    state = applyEvents(state, events);

    // Ambas Units CB devem receber o MODIFY_STAT
    const modExia = state.players.A.battleArea.find(u => u.instanceId === exiaId)?.statModifiers;
    const modVirtue = state.players.A.battleArea.find(u => u.instanceId === virtueId)?.statModifiers;
    expect(modExia?.some(m => m.stat === "ap" && m.amount === 1)).toBe(true);
    expect(modVirtue?.some(m => m.stat === "ap" && m.amount === 1)).toBe(true);
  });
});
