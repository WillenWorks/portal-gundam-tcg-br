import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { placeCard } from "../engine/__testkit__/cardHarness";
import { buildSt08DeckList, ST08_CARD_DEFS } from "../fixtures/st08Deck";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import type { GameState } from "../engine/types";
import { effectiveCost, effectiveLevel } from "../engine/types";
import type { EffectContext } from "../engine/effectSpec";
import { resolveEffectSpec } from "../engine/effectSpec";
import { applyEvents, findCard } from "../engine/events";
import {
  XI_GUNDAM_WHEN_PAIRED,
  XI_GUNDAM_DEPLOY,
  MESSER_F01_ATTACK,
  VALIANT_DEPLOY,
  DAVAO_ACTIVATE_MAIN,
  ST08_EFFECT_SPECS,
} from "./st08";
import { defaultPredicateResolver, defaultTargetFilterResolver } from "./predicates";

function freshGame(): GameState {
  return createGame(buildSt08DeckList(), buildSt01DeckList(), { seed: 80, firstPlayer: "A" });
}

function ctxFor(state: GameState, sourceInstanceId: string, targets: Record<string, string[]> = {}): EffectContext {
  return { state, controller: "A", sourceInstanceId, turnNumber: state.turnNumber, targets };
}

describe("ST08 — fixtures e cobertura", () => {
  it("deck ST08 monta exatamente 50 cartas principais + 10 recursos", () => {
    const deckList = buildSt08DeckList();
    expect(deckList.main).toHaveLength(50);
    expect(deckList.resources).toHaveLength(10);
    expect(() => createGame(deckList, buildSt01DeckList(), { seed: 81, firstPlayer: "A" })).not.toThrow();
  });

  it("EffectSpecs cobrem as cartas bespoke de ST08", () => {
    expect(ST08_EFFECT_SPECS.length).toBeGreaterThanOrEqual(12);
    const coveredCodes = new Set(ST08_EFFECT_SPECS.map((s) => s.cardCode));
    expect(coveredCodes.has("ST08-001")).toBe(true);
    expect(coveredCodes.has("ST08-002")).toBe(true);
    expect(coveredCodes.has("ST08-004")).toBe(true);
    expect(coveredCodes.has("ST08-006")).toBe(true);
    expect(coveredCodes.has("ST08-009")).toBe(true);
    expect(coveredCodes.has("ST08-010")).toBe(true);
    expect(coveredCodes.has("ST08-011")).toBe(true);
    expect(coveredCodes.has("ST08-012")).toBe(true);
    expect(coveredCodes.has("ST08-013")).toBe(true);
    expect(coveredCodes.has("ST08-014")).toBe(true);
    expect(coveredCodes.has("ST08-015")).toBe(true);
  });
});

describe("ST08 — mecânica de custo e nível dinâmico (Xi Gundam)", () => {
  it("Xi Gundam LR reduz custo e level em 1 para cada enemy Unit se não houver Unit Lv.6+ em jogo", () => {
    const state = freshGame();
    const xiDef = ST08_CARD_DEFS["ST08-001"];

    // Sem unidades inimigas: level 9, custo 8
    expect(effectiveLevel(xiDef, state, "A")).toBe(9);
    expect(effectiveCost(xiDef, state, "A")).toBe(8);

    // 3 unidades inimigas em jogo (lado B)
    placeCard(state, "B", ST08_CARD_DEFS["ST08-003"], "battleArea");
    placeCard(state, "B", ST08_CARD_DEFS["ST08-004"], "battleArea");
    placeCard(state, "B", ST08_CARD_DEFS["ST08-005"], "battleArea");

    // Desconto de 3: level 6, custo 5
    expect(effectiveLevel(xiDef, state, "A")).toBe(6);
    expect(effectiveCost(xiDef, state, "A")).toBe(5);

    // Se o jogador A colocar uma Unit Lv.7 em jogo (ex: Penelope LR), anula a condição
    placeCard(state, "A", ST08_CARD_DEFS["ST08-006"], "battleArea");
    expect(effectiveLevel(xiDef, state, "A")).toBe(9);
    expect(effectiveCost(xiDef, state, "A")).toBe(8);
  });
});

describe("ST08 — efeitos em jogo", () => {
  it("ST08-001 Xi Gundam [When Paired] causa 3 de dano na Unit inimiga de maior nível", () => {
    let state = freshGame();
    const xiId = placeCard(state, "A", ST08_CARD_DEFS["ST08-001"], "battleArea");
    const enemyLv2Id = placeCard(state, "B", ST08_CARD_DEFS["ST08-004"], "battleArea"); // Lv 2, HP 1
    const enemyLv5Id = placeCard(state, "B", ST08_CARD_DEFS["ST08-007"], "battleArea"); // Lv 5, HP 4

    // Alvo deve ser enemyLv5Id (maior nível)
    const ctx = ctxFor(state, xiId, { target: [enemyLv5Id] });
    const events = resolveEffectSpec(XI_GUNDAM_WHEN_PAIRED, ctx);
    state = applyEvents(state, events);

    expect(findCard(state, enemyLv5Id).damage).toBe(3);
  });

  it("ST08-014 Valiant [Deploy] compra 1 shield e concede AP+2 para Unit amiga", () => {
    let state = freshGame();
    const valiantId = placeCard(state, "A", ST08_CARD_DEFS["ST08-014"], "baseSection");
    const messerId = placeCard(state, "A", ST08_CARD_DEFS["ST08-003"], "battleArea");
    const shieldsBefore = state.players.A.shields.length;
    const handBefore = state.players.A.hand.length;

    const ctx = ctxFor(state, valiantId, { target: [messerId] });
    const events = resolveEffectSpec(VALIANT_DEPLOY, ctx);
    state = applyEvents(state, events);

    expect(state.players.A.shields.length).toBe(shieldsBefore - 1);
    expect(state.players.A.hand.length).toBe(handBefore + 1);
    const messerMods = findCard(state, messerId).statModifiers;
    expect(messerMods.some(m => m.stat === "ap" && m.amount === 2)).toBe(true);
  });

  it("ST08-015 Davao [Activate: Main] cura 2 HP de Unit amiga ao pagar 2 recursos", () => {
    let state = freshGame();
    const davaoId = placeCard(state, "A", ST08_CARD_DEFS["ST08-015"], "baseSection");
    const messerId = placeCard(state, "A", ST08_CARD_DEFS["ST08-003"], "battleArea", { damage: 2 });

    // Coloca 2 recursos active
    const resDef = { code: "RESOURCE", nameEn: "Resource", cardType: "RESOURCE" as const, color: "colorless" as const };
    const r1 = placeCard(state, "A", resDef, "resourceArea");
    const r2 = placeCard(state, "A", resDef, "resourceArea");

    const ctx = ctxFor(state, davaoId, { target: [messerId] });
    ctx.costResourceIds = [r1, r2];

    const events = resolveEffectSpec(DAVAO_ACTIVATE_MAIN, ctx);
    state = applyEvents(state, events);

    expect(findCard(state, messerId).damage).toBe(0);
    expect(findCard(state, r1).rested).toBe(true);
    expect(findCard(state, r2).rested).toBe(true);
  });
});
