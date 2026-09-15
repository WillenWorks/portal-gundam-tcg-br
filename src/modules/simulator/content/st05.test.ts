import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { advanceToMainPhase } from "../engine/phases";
import { deployCard } from "../engine/deploy";
import { applyPlayerAction } from "../engine/actions";
import { placeCard } from "../engine/__testkit__/cardHarness";
import { buildSt05DeckList, ST05_CARD_DEFS } from "../fixtures/st05Deck";
import { buildSt04DeckList } from "../fixtures/st04Deck";
import type { GameState } from "../engine/types";
import { effectiveAp, hasKeyword } from "../engine/types";
import type { EffectContext } from "../engine/effectSpec";
import { resolveEffectSpec } from "../engine/effectSpec";
import { applyEvents, findCard } from "../engine/events";
import {
  AKIHIRO_ALTLAND_BURST,
  BARBATOS_4TH_FORM_DEPLOY,
  CGS_MOBILE_WORKER_ACTIVATE_MAIN,
  FATAL_STRIKE_BURST,
  FATAL_STRIKE_MAIN,
  GUSION_REBAKE_DESTROYED,
  ISARIBI_ACTIVATE_MAIN,
  ISARIBI_DEPLOY,
  MCGILLIS_FAREED_WHEN_PAIRED,
  MIKAZUKI_AUGUS_BURST,
  SCHWALBE_GRAZE_WHEN_PAIRED,
  ST05_EFFECT_SPECS,
  WITH_IRON_AND_BLOOD_ACTION,
  WITH_IRON_AND_BLOOD_MAIN,
} from "./st05";
import { defaultPredicateResolver, defaultTargetFilterResolver } from "./predicates";

function freshGame(): GameState {
  return createGame(buildSt05DeckList(), buildSt05DeckList(), { seed: 51, firstPlayer: "A" });
}
function ctxFor(state: GameState, sourceInstanceId: string, targets: Record<string, string[]> = {}): EffectContext {
  return { state, controller: "A", sourceInstanceId, turnNumber: state.turnNumber, targets };
}

describe("ST05 — fixtures e cobertura", () => {
  it("decks montam 50 + 10 e a partida ST05 vs ST04 inicia sem erro", () => {
    expect(() => createGame(buildSt05DeckList(), buildSt04DeckList(), { seed: 2, firstPlayer: "B" })).not.toThrow();
    expect(buildSt05DeckList().main).toHaveLength(50);
    expect(buildSt05DeckList().resources).toHaveLength(10);
  });

  it("16 EffectSpecs cadastrados cobrindo 9 das 15 cartas únicas (resto é vanilla/static/keyword)", () => {
    const codes = new Set(ST05_EFFECT_SPECS.map((s) => s.cardCode));
    expect(ST05_EFFECT_SPECS).toHaveLength(16);
    expect(codes).toEqual(
      new Set([
        "ST05-001",
        "ST05-003",
        "ST05-005",
        "ST05-007",
        "ST05-010",
        "ST05-011",
        "ST05-012",
        "ST05-013",
        "ST05-014",
        "ST05-015",
      ]),
    );
  });
});

describe("ST05 — EffectSpecs bespoke", () => {
  it("ST05-001 Gundam Barbatos 4th Form — 【Deploy】dano 1 + AP+1 em outra Unit aliada", () => {
    const state = freshGame();
    const barbatosId = placeCard(state, "A", ST05_CARD_DEFS.GUNDAM_BARBATOS_4TH_FORM, "battleArea");
    const allyId = placeCard(state, "A", ST05_CARD_DEFS.GRAZE_CUSTOM, "battleArea");
    const next = applyEvents(state, resolveEffectSpec(BARBATOS_4TH_FORM_DEPLOY, ctxFor(state, barbatosId, { target: [allyId] })));
    expect(findCard(next, allyId).damage).toBe(1);
    expect(findCard(next, allyId).statModifiers).toContainEqual(expect.objectContaining({ stat: "ap", amount: 1 }));
  });

  it("ST05-001 Gundam Barbatos 4th Form — ganha <Suppression> só enquanto danificada", () => {
    const state = freshGame();
    const freshId = placeCard(state, "A", ST05_CARD_DEFS.GUNDAM_BARBATOS_4TH_FORM, "battleArea");
    expect(hasKeyword(findCard(state, freshId), "Suppression", state)).toBe(false);
    const damagedId = placeCard(state, "A", ST05_CARD_DEFS.GUNDAM_BARBATOS_4TH_FORM, "battleArea", { damage: 1 });
    expect(hasKeyword(findCard(state, damagedId), "Suppression", state)).toBe(true);
  });

  it("ST05-002 Gundam Barbatos 2nd Form — AP+2 só enquanto danificada", () => {
    const state = freshGame();
    const freshId = placeCard(state, "A", ST05_CARD_DEFS.GUNDAM_BARBATOS_2ND_FORM, "battleArea");
    expect(effectiveAp(findCard(state, freshId), state)).toBe(2);
    const damagedId = placeCard(state, "A", ST05_CARD_DEFS.GUNDAM_BARBATOS_2ND_FORM, "battleArea", { damage: 1 });
    expect(effectiveAp(findCard(state, damagedId), state)).toBe(4);
  });

  it("ST05-003 CGS Mobile Worker — 【Activate･Main】descansa e dá dano 1 + AP+1 numa Unit própria", () => {
    const state = freshGame();
    const workerId = placeCard(state, "A", ST05_CARD_DEFS.CGS_MOBILE_WORKER, "battleArea");
    const allyId = placeCard(state, "A", ST05_CARD_DEFS.GRAZE_CUSTOM, "battleArea");
    const next = applyEvents(state, resolveEffectSpec(CGS_MOBILE_WORKER_ACTIVATE_MAIN, ctxFor(state, workerId, { target: [allyId] })));
    expect(findCard(next, workerId).rested).toBe(true);
    expect(findCard(next, allyId).damage).toBe(1);
    expect(findCard(next, allyId).statModifiers).toContainEqual(expect.objectContaining({ stat: "ap", amount: 1 }));
  });

  it("ST05-005 Gundam Gusion Rebake — 【Destroyed】descansa Unit inimiga com AP≤4", () => {
    const state = freshGame();
    const gusionId = placeCard(state, "A", ST05_CARD_DEFS.GUNDAM_GUSION_REBAKE, "battleArea");
    const enemyId = placeCard(state, "B", ST05_CARD_DEFS.GRAZE, "battleArea"); // AP2
    const next = applyEvents(state, resolveEffectSpec(GUSION_REBAKE_DESTROYED, ctxFor(state, gusionId, { target: [enemyId] })));
    expect(findCard(next, enemyId).rested).toBe(true);
  });

  it("ST05-007 McGillis' Schwalbe Graze — 【When Paired】AP-2 durante o turno em Unit inimiga Lv.3 ou menos", () => {
    const state = freshGame();
    const schwalbeId = placeCard(state, "A", ST05_CARD_DEFS.MCGILLIS_SCHWALBE_GRAZE, "battleArea");
    const enemyId = placeCard(state, "B", ST05_CARD_DEFS.GRAZE, "battleArea"); // Lv.2
    const next = applyEvents(state, resolveEffectSpec(SCHWALBE_GRAZE_WHEN_PAIRED, ctxFor(state, schwalbeId, { target: [enemyId] })));
    expect(findCard(next, enemyId).statModifiers).toContainEqual(expect.objectContaining({ stat: "ap", amount: -2 }));
  });

  it("ST05-010 Mikazuki Augus — 【Burst】adiciona a própria carta à mão", () => {
    const state = freshGame();
    const pilotId = placeCard(state, "A", ST05_CARD_DEFS.MIKAZUKI_AUGUS, "shields");
    const next = applyEvents(state, resolveEffectSpec(MIKAZUKI_AUGUS_BURST, ctxFor(state, pilotId)));
    expect(next.players.A.hand.some((c) => c.instanceId === pilotId)).toBe(true);
  });

  it("ST05-010 Mikazuki Augus — 【When Paired】pausa pedindo 2 alvos (1 Unit própria + 1 inimiga) e causa 1 de dano em cada ao resolver (docs/47 Fase 5, deferred.ts fechado)", () => {
    const state = advanceToMainPhase(freshGame());
    for (let i = 0; i < 4; i++) placeCard(state, "A", ST05_CARD_DEFS.RESOURCE, "resourceArea");
    const allyId = placeCard(state, "A", ST05_CARD_DEFS.GRAZE_CUSTOM, "battleArea");
    const enemyId = placeCard(state, "B", ST05_CARD_DEFS.GRAZE, "battleArea");
    const pilotId = placeCard(state, "A", ST05_CARD_DEFS.MIKAZUKI_AUGUS, "hand");

    const paused = deployCard(state, "A", pilotId, {
      pairWithUnitId: allyId,
      specs: ST05_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });

    const decision = paused.pendingDecision.A;
    const q = decision?.kind === "abilityResolution" ? decision.queue.find((e) => e.specId === "ST05-010-WhenPaired") : undefined;
    expect(q).toBeDefined();
    expect(q?.legalTargets).toEqual([allyId]);
    expect(q?.secondaryTarget?.targetScope).toBe("enemyUnit");
    expect(q?.secondaryTarget?.legalTargets).toEqual([enemyId]);

    const resolved = applyPlayerAction(
      paused,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: q!.specId, activate: true, targetIds: [allyId], secondaryTargetIds: [enemyId] }] },
      ST05_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    expect(findCard(resolved, allyId).damage).toBe(1);
    expect(findCard(resolved, enemyId).damage).toBe(1);
    expect(resolved.pendingDecision.A).toBeNull();
  });

  it("ST05-010 Mikazuki Augus — 【When Paired】sem alvo inimigo legal: 'Choose 1 X AND 1 Y' não ativa nem a metade (nenhum dano, mesmo com o alvo próprio escolhido)", () => {
    const state = advanceToMainPhase(freshGame());
    for (let i = 0; i < 4; i++) placeCard(state, "A", ST05_CARD_DEFS.RESOURCE, "resourceArea");
    const allyId = placeCard(state, "A", ST05_CARD_DEFS.GRAZE_CUSTOM, "battleArea");
    const pilotId = placeCard(state, "A", ST05_CARD_DEFS.MIKAZUKI_AUGUS, "hand");

    const paused = deployCard(state, "A", pilotId, {
      pairWithUnitId: allyId,
      specs: ST05_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });

    const decision = paused.pendingDecision.A;
    const q = decision?.kind === "abilityResolution" ? decision.queue.find((e) => e.specId === "ST05-010-WhenPaired") : undefined;
    expect(q?.secondaryTarget?.legalTargets).toEqual([]);

    const resolved = applyPlayerAction(
      paused,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: q!.specId, activate: true, targetIds: [allyId], secondaryTargetIds: [] }] },
      ST05_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    expect(findCard(resolved, allyId).damage).toBe(0); // "Choose 1 X and 1 Y" — sem o 2º, o efeito inteiro não ativa
    expect(resolved.pendingDecision.A).toBeNull();
  });

  it("ST05-011 Akihiro Altland — 【Burst】adiciona a própria carta à mão (a cláusula 【During Link】 está deferida)", () => {
    const state = freshGame();
    const pilotId = placeCard(state, "A", ST05_CARD_DEFS.AKIHIRO_ALTLAND, "shields");
    const next = applyEvents(state, resolveEffectSpec(AKIHIRO_ALTLAND_BURST, ctxFor(state, pilotId)));
    expect(next.players.A.hand.some((c) => c.instanceId === pilotId)).toBe(true);
  });

  it("ST05-012 McGillis Fareed — 【When Paired】com 2+ outras Units (Gjallarhorn)/(Tekkadan), descansa Unit inimiga HP≤3", () => {
    const state = freshGame();
    const pilotId = placeCard(state, "A", ST05_CARD_DEFS.MCGILLIS_FAREED, "battleArea");
    placeCard(state, "A", ST05_CARD_DEFS.GRAZE, "battleArea"); // Gjallarhorn
    placeCard(state, "A", ST05_CARD_DEFS.GRAZE_CUSTOM, "battleArea"); // Tekkadan
    const enemyId = placeCard(state, "B", ST05_CARD_DEFS.GRAZE, "battleArea"); // HP2
    const events = resolveEffectSpec(
      MCGILLIS_FAREED_WHEN_PAIRED,
      ctxFor(state, pilotId, { target: [enemyId] }),
      defaultPredicateResolver,
    );
    const next = applyEvents(state, events);
    expect(findCard(next, enemyId).rested).toBe(true);
  });

  it("ST05-012 McGillis Fareed — sem 2 outras Units (Gjallarhorn)/(Tekkadan) o efeito não dispara", () => {
    const state = freshGame();
    const pilotId = placeCard(state, "A", ST05_CARD_DEFS.MCGILLIS_FAREED, "battleArea");
    const enemyId = placeCard(state, "B", ST05_CARD_DEFS.GRAZE, "battleArea");
    const events = resolveEffectSpec(
      MCGILLIS_FAREED_WHEN_PAIRED,
      ctxFor(state, pilotId, { target: [enemyId] }),
      defaultPredicateResolver,
    );
    expect(events).toHaveLength(0);
  });

  it("ST05-013 With Iron and Blood — 【Main】/【Action】mesmo efeito nos 2 gatilhos (dano 1 + AP+3)", () => {
    for (const spec of [WITH_IRON_AND_BLOOD_MAIN, WITH_IRON_AND_BLOOD_ACTION]) {
      const state = freshGame();
      const allyId = placeCard(state, "A", ST05_CARD_DEFS.GRAZE_CUSTOM, "battleArea");
      const next = applyEvents(state, resolveEffectSpec(spec, ctxFor(state, "A-testkit-command", { target: [allyId] })));
      expect(findCard(next, allyId).damage).toBe(1);
      expect(findCard(next, allyId).statModifiers).toContainEqual(expect.objectContaining({ stat: "ap", amount: 3 }));
    }
  });

  it("ST05-014 Fatal Strike — 【Burst】dano 1 em Unit inimiga qualquer", () => {
    const state = freshGame();
    const enemyId = placeCard(state, "B", ST05_CARD_DEFS.GRAZE, "battleArea");
    const next = applyEvents(state, resolveEffectSpec(FATAL_STRIKE_BURST, ctxFor(state, "A-testkit-command", { target: [enemyId] })));
    expect(findCard(next, enemyId).damage).toBe(1);
  });

  it("ST05-014 Fatal Strike — 【Main】destrói Unit inimiga Lv.3 ou menos", () => {
    const state = freshGame();
    const enemyId = placeCard(state, "B", ST05_CARD_DEFS.GRAZE, "battleArea"); // Lv.2
    const next = applyEvents(state, resolveEffectSpec(FATAL_STRIKE_MAIN, ctxFor(state, "A-testkit-command", { target: [enemyId] })));
    expect(next.players.B.battleArea.some((c) => c.instanceId === enemyId)).toBe(false);
    expect(next.players.B.trash.some((c) => c.instanceId === enemyId)).toBe(true);
  });

  it("ST05-015 Isaribi — 【Deploy】adiciona 1 Shield à mão", () => {
    const state = freshGame();
    const baseId = placeCard(state, "A", ST05_CARD_DEFS.ISARIBI, "baseSection");
    const shieldCountBefore = state.players.A.shields.length;
    const handCountBefore = state.players.A.hand.length;
    const next = applyEvents(state, resolveEffectSpec(ISARIBI_DEPLOY, ctxFor(state, baseId)));
    expect(next.players.A.hand.length).toBeGreaterThan(handCountBefore);
    expect(next.players.A.shields.length).toBe(shieldCountBefore - 1);
  });

  it("ST05-015 Isaribi — 【Activate･Main】descansa e dá AP+2 numa Unit própria danificada", () => {
    const state = freshGame();
    const baseId = placeCard(state, "A", ST05_CARD_DEFS.ISARIBI, "baseSection");
    const damagedAllyId = placeCard(state, "A", ST05_CARD_DEFS.GRAZE_CUSTOM, "battleArea", { damage: 1 });
    const next = applyEvents(state, resolveEffectSpec(ISARIBI_ACTIVATE_MAIN, ctxFor(state, baseId, { target: [damagedAllyId] })));
    expect(findCard(next, baseId).rested).toBe(true);
    expect(findCard(next, damagedAllyId).statModifiers).toContainEqual(expect.objectContaining({ stat: "ap", amount: 2 }));
  });
});
