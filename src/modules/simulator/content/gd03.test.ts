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
import { defaultPredicateResolver, defaultTargetFilterResolver } from "./predicates";
import { computeLegalTargets } from "../engine/effectSpec";
import { EX_RESOURCE_TOKEN } from "../engine/setup";
import { advanceToMainPhase } from "../engine/phases";
import { enumerateLegalActions } from "../engine/legalActions";
import { applyPlayerAction } from "../engine/actions";
import { ALL_EFFECT_SPECS } from "./index";

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

const OPTS = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };
const specOf = (id: string) => {
  const spec = GD03_EFFECT_SPECS.find((s) => s.id === id);
  if (!spec) throw new Error(`spec ${id} ausente`);
  return spec;
};
const run = (state: GameState, id: string, sourceId: string, targets: Record<string, string[]> = {}) =>
  applyEvents(state, resolveEffectSpec(specOf(id), ctxFor(state, sourceId, targets), defaultPredicateResolver));

describe("GD03 — correções W0.3 (texto oficial)", () => {
  it("GD03-021 【Deploy】 mira Unit amiga (Operation Meteor)/(G Team) e libera atacar Unit ativa", () => {
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD03_CARD_DEFS["GD03-021"], "battleArea");
    const gTeamId = placeCard(state, "A", GD03_CARD_DEFS["GD03-025"], "battleArea");
    const otherId = placeCard(state, "A", GD03_CARD_DEFS["GD03-001"], "battleArea");
    placeCard(state, "B", GD03_CARD_DEFS["GD03-004"], "battleArea");
    const legal = computeLegalTargets(state, specOf("GD03-021-Deploy"), "A", defaultTargetFilterResolver, sourceId);
    expect(legal).toContain(gTeamId);
    expect(legal).toContain(sourceId); // ela mesma é (G Team)
    expect(legal).not.toContain(otherId);
    state = run(state, "GD03-021-Deploy", sourceId, { target: [gTeamId] });
    expect(findCard(state, gTeamId).attackTargetRelaxUntilTurn?.turn).toBe(state.turnNumber);
  });

  it("GD03-023 não tem 【Deploy】; ao colocar EX Resource, uma Unit (AGE System) ganha <High-Maneuver>", () => {
    expect(GD03_EFFECT_SPECS.some((s) => s.cardCode === "GD03-023")).toBe(false);
    let state = freshGame();
    const sourceId = placeCard(state, "A", GD03_CARD_DEFS["GD03-023"], "battleArea");
    const ageId = placeCard(state, "A", GD03_CARD_DEFS["GD03-031"], "battleArea");
    const events = resolveEffectSpec(
      { id: "t-ex", cardCode: "T", trigger: "Main", sourceText: "", actions: [{ op: "spawnToken", def: EX_RESOURCE_TOKEN, player: "controller", zone: "resourceArea" }] },
      ctxFor(state, sourceId),
      defaultPredicateResolver,
    );
    state = applyEvents(state, events);
    expect(findCard(state, ageId).keywordGrants.map((g) => g.keyword)).toContain("High-Maneuver");
  });

  it("GD03-101: compra 1 e, com 2+ \"A Healthy Curiosity\" no trash, descansa inimigo com HP<=4", () => {
    let state = freshGame();
    const cmdId = placeCard(state, "A", GD03_CARD_DEFS["GD03-101"], "hand");
    placeCard(state, "A", GD03_CARD_DEFS["GD03-101"], "trash");
    const enemyId = placeCard(state, "B", GD03_CARD_DEFS["GD03-001"], "battleArea"); // HP 4
    const handBefore = state.players.A.hand.length;
    state = run(state, "GD03-101-Main", cmdId);
    state = run(state, "GD03-101-Main-Rest", cmdId, { target: [enemyId] });
    expect(state.players.A.hand.length).toBe(handBefore + 1);
    expect(findCard(state, enemyId).rested).toBe(false); // só 1 no trash

    placeCard(state, "A", GD03_CARD_DEFS["GD03-101"], "trash");
    state = run(state, "GD03-101-Main-Rest", cmdId, { target: [enemyId] });
    expect(findCard(state, enemyId).rested).toBe(true);
  });

  it("GD03-101: bot pode jogar sem alvo legal pro \"Then\" (compra 1 mesmo assim)", () => {
    let state = advanceToMainPhase(freshGame());
    for (let i = 0; i < 3; i++) {
      placeCard(state, "A", { code: "RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
    }
    const cmdId = placeCard(state, "A", GD03_CARD_DEFS["GD03-101"], "hand");
    const plays = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).filter(
      (a) => a.kind === "playCommand" && a.cardInstanceId === cmdId,
    );
    expect(plays).toHaveLength(1);
    const handBefore = state.players.A.hand.length;
    state = applyPlayerAction(state, "A", plays[0], ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
    expect(findCard(state, cmdId).zone).toBe("trash");
    expect(state.players.A.hand.length).toBe(handBefore); // -1 Command +1 compra
  });

  it("GD03-116 【Main】/【Action】 dá 2 de dano numa Unit amiga (Vagan) E num inimigo", () => {
    let state = freshGame();
    const cmdId = placeCard(state, "A", GD03_CARD_DEFS["GD03-116"], "hand");
    const vaganId = placeCard(state, "A", GD03_CARD_DEFS["GD03-054"], "battleArea");
    const enemyId = placeCard(state, "B", GD03_CARD_DEFS["GD03-001"], "battleArea");
    for (const trigger of ["Main", "Action"] as const) {
      const spec = specOf(`GD03-116-${trigger}`);
      expect(spec.targetFilter).toBe("trait:Vagan");
      expect(spec.secondaryTarget?.targetScope).toBe("enemyUnit");
    }
    state = run(state, "GD03-116-Action", cmdId, { target: [vaganId], enemyTarget: [enemyId] });
    expect(findCard(state, vaganId).damage).toBe(2);
    expect(findCard(state, enemyId).damage).toBe(2);
  });

  it("Bases GD03: 123 (Jupitris) descansa; 127 dá AP+3 a (ZAFT); 131 (2+ Triple Ship Alliance) devolve à mão", () => {
    let state = freshGame();
    const b123 = placeCard(state, "A", GD03_CARD_DEFS["GD03-123"], "baseSection");
    const enemyLow = placeCard(state, "B", GD03_CARD_DEFS["GD03-058"], "battleArea"); // Lv2
    state = run(state, "GD03-123-Deploy-Rest", b123, { target: [enemyLow] });
    expect(findCard(state, enemyLow).rested).toBe(false); // sem (Jupitris)
    placeCard(state, "A", GD03_CARD_DEFS["GD03-008"], "battleArea");
    state = run(state, "GD03-123-Deploy-Rest", b123, { target: [enemyLow] });
    expect(findCard(state, enemyLow).rested).toBe(true);

    const b127 = placeCard(state, "A", GD03_CARD_DEFS["GD03-127"], "baseSection");
    const zaftId = placeCard(state, "A", GD03_CARD_DEFS["GD03-038"], "battleArea");
    expect(computeLegalTargets(state, specOf("GD03-127-Deploy-Buff"), "A", defaultTargetFilterResolver, b127)).toEqual([zaftId]);

    const b131 = placeCard(state, "A", GD03_CARD_DEFS["GD03-131"], "baseSection");
    placeCard(state, "A", GD03_CARD_DEFS["GD03-072"], "battleArea");
    state = run(state, "GD03-131-Deploy-Bounce", b131, { target: [enemyLow] });
    expect(findCard(state, enemyLow).zone).toBe("battleArea"); // só 1 (Triple Ship Alliance)
    placeCard(state, "A", GD03_CARD_DEFS["GD03-070"], "battleArea");
    state = run(state, "GD03-131-Deploy-Bounce", b131, { target: [enemyLow] });
    expect(findCard(state, enemyLow).zone).toBe("hand");
  });

  it("GD03-132 【Destroyed】 não descansa sem Link Unit (AEUG) em jogo", () => {
    let state = freshGame();
    const b132 = placeCard(state, "A", GD03_CARD_DEFS["GD03-132"], "baseSection");
    placeCard(state, "A", GD03_CARD_DEFS["GD03-075"], "battleArea"); // (AEUG), sem Piloto: não é Link
    const enemyId = placeCard(state, "B", GD03_CARD_DEFS["GD03-001"], "battleArea");
    state = run(state, "GD03-132-Destroyed", b132, { target: [enemyId] });
    expect(findCard(state, enemyId).rested).toBe(false);
  });
});
