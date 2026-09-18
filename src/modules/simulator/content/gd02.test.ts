import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { placeCard } from "../engine/__testkit__/cardHarness";
import { buildSt06DeckList } from "../fixtures/st06Deck";
import { buildSt04DeckList } from "../fixtures/st04Deck";
import { GD02_CARD_DEFS } from "./gd02";
import { GD02_EFFECT_SPECS } from "./gd02/effects";
import type { GameState } from "../engine/types";
import type { EffectContext } from "../engine/effectSpec";
import { resolveEffectSpec } from "../engine/effectSpec";
import { applyEvents, findCard } from "../engine/events";
import { defaultPredicateResolver, defaultTargetFilterResolver } from "./predicates";

function freshGame(): GameState {
  return createGame(buildSt06DeckList(), buildSt04DeckList(), { seed: 202, firstPlayer: "A" });
}

function ctxFor(state: GameState, sourceInstanceId: string, targets: Record<string, string[]> = {}): EffectContext {
  return { state, controller: "A", sourceInstanceId, turnNumber: state.turnNumber, targets };
}

describe("GD02 — catálogo e cobertura", () => {
  it("contém exatamente 130 cartas oficiais indexadas por código GD02-001 até GD02-130", () => {
    const codes = Object.keys(GD02_CARD_DEFS);
    expect(codes).toHaveLength(130);
    expect(codes).toContain("GD02-001");
    expect(codes).toContain("GD02-069");
    expect(codes).toContain("GD02-130");
  });

  it("distribui as cartas em cores e tipos consistentes", () => {
    const cards = Object.values(GD02_CARD_DEFS);
    const units = cards.filter((c) => c.cardType === "UNIT");
    const pilots = cards.filter((c) => c.cardType === "PILOT");
    const commands = cards.filter((c) => c.cardType === "COMMAND");
    const bases = cards.filter((c) => c.cardType === "BASE");

    expect(units).toHaveLength(84);
    expect(pilots).toHaveLength(16);
    expect(commands).toHaveLength(20);
    expect(bases).toHaveLength(10);
  });

  it("todas as 10 bases de GD02 possuem Deploy de puxar escudo", () => {
    const bases = Object.values(GD02_CARD_DEFS).filter((c) => c.cardType === "BASE");
    expect(bases).toHaveLength(10);
    for (const b of bases) {
      expect(b.triggerKeywords).toContain("Deploy");
    }
  });
});

describe("GD02 — resolução de efeitos bespoke", () => {
  it("bases de GD02 puxam 1 shield para a mão ao dar Deploy", () => {
    let state = freshGame();
    const baseDef = GD02_CARD_DEFS["GD02-121"]; // Dominion / Base Blue
    const baseId = placeCard(state, "A", baseDef, "baseSection");
    const initialHandCount = state.players.A.hand.length;

    const baseDeploySpec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-121" && s.trigger === "Deploy");
    expect(baseDeploySpec).toBeDefined();

    if (baseDeploySpec) {
      const events = resolveEffectSpec(baseDeploySpec, ctxFor(state, baseId), defaultPredicateResolver);
      state = applyEvents(state, events);
      expect(state.players.A.hand.length).toBe(initialHandCount + 1);
    }
  });

  it("GD02-068 Gundam Barbatos causa 2 de dano a unidade alvo no Deploy", () => {
    let state = freshGame();
    const barbatosDef = GD02_CARD_DEFS["GD02-068"];
    const enemyDef = GD02_CARD_DEFS["GD02-004"];
    const sourceId = placeCard(state, "A", barbatosDef, "battleArea");
    const enemyId = placeCard(state, "B", enemyDef, "battleArea");

    const deploySpec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-068" && s.trigger === "Deploy");
    expect(deploySpec).toBeDefined();

    if (deploySpec) {
      const events = resolveEffectSpec(deploySpec, ctxFor(state, sourceId, { target: [enemyId] }), defaultPredicateResolver);
      state = applyEvents(state, events);
      expect(findCard(state, enemyId).damage).toBe(2);
    }
  });

  it("GD02-036 Qubeley concede Suppression ao dar When Linked", () => {
    let state = freshGame();
    const qubeleyDef = GD02_CARD_DEFS["GD02-036"];
    const sourceId = placeCard(state, "A", qubeleyDef, "battleArea");

    const spec = GD02_EFFECT_SPECS.find((s) => s.cardCode === "GD02-036");
    expect(spec).toBeDefined();

    if (spec) {
      const events = resolveEffectSpec(spec, ctxFor(state, sourceId), defaultPredicateResolver);
      state = applyEvents(state, events);
      expect(findCard(state, sourceId).keywordGrants.some((k) => k.keyword === "Suppression")).toBe(true);
    }
  });
});
