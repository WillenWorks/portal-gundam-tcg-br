import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { placeCard } from "../engine/__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { GD03_CARD_DEFS } from "./gd03";
import { GD03_EFFECT_SPECS } from "./gd03/effects";
import type { GameState } from "../engine/types";
import type { EffectContext } from "../engine/effectSpec";
import { resolveEffectSpec } from "../engine/effectSpec";
import { applyEvents, findCard } from "../engine/events";
import { defaultPredicateResolver } from "./predicates";

function freshGame(): GameState {
  return createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 303, firstPlayer: "A" });
}

function ctxFor(state: GameState, sourceInstanceId: string, targets: Record<string, string[]> = {}): EffectContext {
  return { state, controller: "A", sourceInstanceId, turnNumber: state.turnNumber, targets };
}

describe("GD03 — catálogo e cobertura", () => {
  it("contém exatamente 132 cartas oficiais indexadas por código GD03-001 até GD03-132", () => {
    const codes = Object.keys(GD03_CARD_DEFS);
    expect(codes).toHaveLength(132);
    expect(codes).toContain("GD03-001");
    expect(codes).toContain("GD03-050");
    expect(codes).toContain("GD03-085");
    expect(codes).toContain("GD03-132");
  });

  it("distribui as cartas em cores e tipos consistentes", () => {
    const cards = Object.values(GD03_CARD_DEFS);
    const units = cards.filter((c) => c.cardType === "UNIT");
    const pilots = cards.filter((c) => c.cardType === "PILOT");
    const commands = cards.filter((c) => c.cardType === "COMMAND");
    const bases = cards.filter((c) => c.cardType === "BASE");

    expect(units).toHaveLength(83);
    expect(pilots).toHaveLength(17);
    expect(commands).toHaveLength(22);
    expect(bases).toHaveLength(10);
  });

  it("todas as 10 bases de GD03 possuem Deploy de puxar escudo", () => {
    const bases = Object.values(GD03_CARD_DEFS).filter((c) => c.cardType === "BASE");
    expect(bases).toHaveLength(10);
    for (const b of bases) {
      expect(b.triggerKeywords).toContain("Deploy");
    }
  });

  it("todos os 17 pilotos de GD03 possuem Burst", () => {
    const pilots = Object.values(GD03_CARD_DEFS).filter((c) => c.cardType === "PILOT");
    expect(pilots).toHaveLength(17);
    for (const p of pilots) {
      expect(p.hasBurst).toBe(true);
      expect(p.triggerKeywords).toContain("Burst");
    }
  });
});

describe("GD03 — resolução de efeitos bespoke", () => {
  it("bases de GD03 puxam 1 shield para a mão ao dar Deploy", () => {
    let state = freshGame();
    const baseDef = GD03_CARD_DEFS["GD03-123"]; // Jupitris / Base Blue
    const baseId = placeCard(state, "A", baseDef, "baseSection");
    const initialHandCount = state.players.A.hand.length;

    const baseDeploySpec = GD03_EFFECT_SPECS.find((s) => s.cardCode === "GD03-123" && s.trigger === "Deploy");
    expect(baseDeploySpec).toBeDefined();

    if (baseDeploySpec) {
      const events = resolveEffectSpec(baseDeploySpec, ctxFor(state, baseId), defaultPredicateResolver);
      state = applyEvents(state, events);
      expect(state.players.A.hand.length).toBe(initialHandCount + 1);
    }
  });

  it("GD03-005 Kshatriya Besserung compra 1 carta no Deploy", () => {
    let state = freshGame();
    const kshatriyaDef = GD03_CARD_DEFS["GD03-005"];
    const sourceId = placeCard(state, "A", kshatriyaDef, "battleArea");
    const handBefore = state.players.A.hand.length;

    const deploySpec = GD03_EFFECT_SPECS.find((s) => s.cardCode === "GD03-005" && s.trigger === "Deploy");
    expect(deploySpec).toBeDefined();

    if (deploySpec) {
      const events = resolveEffectSpec(deploySpec, ctxFor(state, sourceId), defaultPredicateResolver);
      state = applyEvents(state, events);
      expect(state.players.A.hand.length).toBe(handBefore + 1);
    }
  });

  it("GD03-023 Gundam Heavyarms Custom causa 2 de dano no Deploy", () => {
    let state = freshGame();
    const heavyarmsDef = GD03_CARD_DEFS["GD03-023"];
    const enemyDef = GD03_CARD_DEFS["GD03-001"];
    const sourceId = placeCard(state, "A", heavyarmsDef, "battleArea");
    const enemyId = placeCard(state, "B", enemyDef, "battleArea");

    const deploySpec = GD03_EFFECT_SPECS.find((s) => s.cardCode === "GD03-023" && s.trigger === "Deploy");
    expect(deploySpec).toBeDefined();

    if (deploySpec) {
      const events = resolveEffectSpec(deploySpec, ctxFor(state, sourceId, { target: [enemyId] }), defaultPredicateResolver);
      state = applyEvents(state, events);
      expect(findCard(state, enemyId).damage).toBe(2);
    }
  });

  it("GD03-001 Gundam NT-1 [When Paired] compra 1 quando o dano de 1 destrói o alvo", () => {
    let state = freshGame();
    const nt1Def = GD03_CARD_DEFS["GD03-001"];
    const enemyDef = GD03_CARD_DEFS["GD03-002"]; // The-O, HP 5
    const sourceId = placeCard(state, "A", nt1Def, "battleArea");
    const enemyId = placeCard(state, "B", enemyDef, "battleArea", { damage: 4 }); // 1 a mais mata
    const handBefore = state.players.A.hand.length;

    const whenPairedSpec = GD03_EFFECT_SPECS.find((s) => s.cardCode === "GD03-001" && s.trigger === "When Paired");
    expect(whenPairedSpec).toBeDefined();

    if (whenPairedSpec) {
      const events = resolveEffectSpec(whenPairedSpec, ctxFor(state, sourceId, { target: [enemyId] }), defaultPredicateResolver);
      state = applyEvents(state, events);
      // 5 de dano em cima de 5 de HP destrói o alvo — DESTROY_CARD zera `damage` e move pra trash.
      expect(findCard(state, enemyId).zone).toBe("trash");
      expect(state.players.A.hand.length).toBe(handBefore + 1);
    }
  });

  it("GD03-001 Gundam NT-1 [When Paired] NÃO compra quando o dano de 1 não destrói o alvo", () => {
    let state = freshGame();
    const nt1Def = GD03_CARD_DEFS["GD03-001"];
    const enemyDef = GD03_CARD_DEFS["GD03-002"]; // The-O, HP 5
    const sourceId = placeCard(state, "A", nt1Def, "battleArea");
    const enemyId = placeCard(state, "B", enemyDef, "battleArea"); // sem dano prévio
    const handBefore = state.players.A.hand.length;

    const whenPairedSpec = GD03_EFFECT_SPECS.find((s) => s.cardCode === "GD03-001" && s.trigger === "When Paired");
    expect(whenPairedSpec).toBeDefined();

    if (whenPairedSpec) {
      const events = resolveEffectSpec(whenPairedSpec, ctxFor(state, sourceId, { target: [enemyId] }), defaultPredicateResolver);
      state = applyEvents(state, events);
      expect(findCard(state, enemyId).damage).toBe(1);
      expect(state.players.A.hand.length).toBe(handBefore);
    }
  });
});
