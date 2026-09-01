import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "../engine/types";
import type { EffectContext, PredicateResolver } from "../engine/effectSpec";
import { resolveEffectSpec } from "../engine/effectSpec";
import { applyEvents, findCard } from "../engine/events";
import {
  AERIAL_SCORE_SIX_WHEN_PAIRED,
  AMURO_RAY_BURST,
  AMURO_RAY_WHEN_PAIRED,
  ASTICASSIA_ACTIVATE_MAIN,
  ASTICASSIA_BURST,
  ASTICASSIA_DEPLOY,
  GUNDAM_MA_FORM_WHEN_PAIRED,
  GUNTANK_DEPLOY,
  KAIS_RESOLVE_MAIN,
  SULETTA_MERCURY_ATTACK,
  SULETTA_MERCURY_BURST,
  ST01_EFFECT_SPECS,
  THOROUGHLY_DAMAGED_MAIN,
  UNFORESEEN_INCIDENT_ACTION,
  UNFORESEEN_INCIDENT_BURST,
  UNFORESEEN_INCIDENT_MAIN,
  WHITE_BASE_ACTIVATE_MAIN,
  WHITE_BASE_BURST,
  WHITE_BASE_DEPLOY,
} from "./st01";

/**
 * Passo 3 do plano incremental (docs/18): testa cada EffectSpec real do
 * ST01 contra o `resolveEffectSpec` do motor, do mesmo jeito que
 * `effectSpec.test.ts` já testava o exemplo sintético — só que agora com
 * texto de carta de verdade. Não existe dispatcher automático ainda (ver
 * comentário no topo de `content/st01.ts`), então cada teste monta o
 * `EffectContext` à mão, exatamente como um dispatcher futuro faria.
 */

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-st01fx-${seq++}`;
  const card: CardInstance = {
    instanceId,
    def,
    owner: player,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    // -1: unit já estabelecida em campo por padrão (ver engine/combat.test.ts).
    enteredZoneOnTurn: state.turnNumber - 1,
    ...opts,
  };
  state.players[player][zone].push(card);
  return instanceId;
}

function freshGame(): GameState {
  return createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 7, firstPlayer: "A" });
}

const pairedPilotHasTraitResolver: PredicateResolver = (predicate, ctx) => {
  const match = predicate.match(/^pairedPilotHasTrait:(.+)$/);
  if (!match) return false;
  const source = findCard(ctx.state, ctx.sourceInstanceId);
  if (!source.pairedPilotId) return false;
  const pilot = findCard(ctx.state, source.pairedPilotId);
  return pilot.def.traits?.includes(match[1]) ?? false;
};

describe("EffectSpecs reais do ST01 (docs/18 passo 3)", () => {
  it("18 EffectSpecs cadastrados, cobrindo 10 das 16 cartas únicas do ST01", () => {
    const codes = new Set(ST01_EFFECT_SPECS.map((s) => s.cardCode));
    expect(ST01_EFFECT_SPECS).toHaveLength(18);
    expect(codes.size).toBe(10);
  });

  describe("ST01-002 Gundam (MA Form) — When Paired (White Base Team Pilot): Draw 1", () => {
    it("compra 1 carta quando pareado com Piloto (White Base Team)", () => {
      const state = freshGame();
      const pilotId = place(state, "A", ST01_CARD_DEFS.AMURO_RAY, "battleArea");
      const unitId = place(state, "A", ST01_CARD_DEFS.GUNDAM_MA_FORM, "battleArea", { pairedPilotId: pilotId });
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: unitId, turnNumber: state.turnNumber, targets: {} };

      const events = resolveEffectSpec(GUNDAM_MA_FORM_WHEN_PAIRED, ctx, pairedPilotHasTraitResolver);
      const next = applyEvents(state, events);

      expect(next.players.A.hand.length).toBe(state.players.A.hand.length + 1);
    });

    it("não compra nada se o Piloto pareado não tem o trait (White Base Team)", () => {
      const state = freshGame();
      const pilotId = place(state, "A", ST01_CARD_DEFS.SULETTA_MERCURY, "battleArea"); // trait (Academy), não (White Base Team)
      const unitId = place(state, "A", ST01_CARD_DEFS.GUNDAM_MA_FORM, "battleArea", { pairedPilotId: pilotId });
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: unitId, turnNumber: state.turnNumber, targets: {} };

      const events = resolveEffectSpec(GUNDAM_MA_FORM_WHEN_PAIRED, ctx, pairedPilotHasTraitResolver);

      expect(events).toEqual([]);
    });
  });

  it("ST01-004 Guntank — Deploy: resta o alvo escolhido", () => {
    const state = freshGame();
    const guntankId = place(state, "A", ST01_CARD_DEFS.GUNTANK, "battleArea");
    const targetId = place(state, "B", ST01_CARD_DEFS.GM, "battleArea");
    const ctx: EffectContext = { state, controller: "A", sourceInstanceId: guntankId, turnNumber: state.turnNumber, targets: { target: [targetId] } };

    const events = resolveEffectSpec(GUNTANK_DEPLOY, ctx);
    const next = applyEvents(state, events);

    expect(findCard(next, targetId).rested).toBe(true);
  });

  it("ST01-006 Gundam Aerial (Score Six) — When Paired: alvo recebe AP-3 nesse turno", () => {
    const state = freshGame();
    const sourceId = place(state, "A", ST01_CARD_DEFS.AERIAL_SCORE_SIX, "battleArea");
    const targetId = place(state, "B", ST01_CARD_DEFS.GUNCANNON, "battleArea");
    const ctx: EffectContext = { state, controller: "A", sourceInstanceId: sourceId, turnNumber: state.turnNumber, targets: { target: [targetId] } };

    const events = resolveEffectSpec(AERIAL_SCORE_SIX_WHEN_PAIRED, ctx);
    const next = applyEvents(state, events);

    expect(findCard(next, targetId).statModifiers).toEqual([{ stat: "ap", amount: -3, duration: "endOfTurn", appliedOnTurn: state.turnNumber }]);
  });

  describe("ST01-010 Amuro Ray", () => {
    it("Burst: a própria carta (revelada como shield) vai pra mão", () => {
      const state = freshGame();
      const amuroId = place(state, "A", ST01_CARD_DEFS.AMURO_RAY, "shields");
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: amuroId, turnNumber: state.turnNumber, targets: {} };

      const events = resolveEffectSpec(AMURO_RAY_BURST, ctx);
      const next = applyEvents(state, events);

      expect(findCard(next, amuroId).zone).toBe("hand");
    });

    it("When Paired: resta o alvo escolhido", () => {
      const state = freshGame();
      const amuroId = place(state, "A", ST01_CARD_DEFS.AMURO_RAY, "battleArea");
      const targetId = place(state, "B", ST01_CARD_DEFS.GM, "battleArea");
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: amuroId, turnNumber: state.turnNumber, targets: { target: [targetId] } };

      const events = resolveEffectSpec(AMURO_RAY_WHEN_PAIRED, ctx);
      const next = applyEvents(state, events);

      expect(findCard(next, targetId).rested).toBe(true);
    });
  });

  describe("ST01-011 Suletta Mercury", () => {
    it("Burst: a própria carta (revelada como shield) vai pra mão", () => {
      const state = freshGame();
      const sulettaId = place(state, "A", ST01_CARD_DEFS.SULETTA_MERCURY, "shields");
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: sulettaId, turnNumber: state.turnNumber, targets: {} };

      const events = resolveEffectSpec(SULETTA_MERCURY_BURST, ctx);
      const next = applyEvents(state, events);

      expect(findCard(next, sulettaId).zone).toBe("hand");
    });

    it("Attack: ativa (seta active) o Resource escolhido", () => {
      const state = freshGame();
      const sulettaId = place(state, "A", ST01_CARD_DEFS.SULETTA_MERCURY, "battleArea");
      const resourceId = place(state, "A", ST01_CARD_DEFS.RESOURCE, "resourceArea", { rested: true });
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: sulettaId, turnNumber: state.turnNumber, targets: { target: [resourceId] } };

      const events = resolveEffectSpec(SULETTA_MERCURY_ATTACK, ctx);
      const next = applyEvents(state, events);

      expect(findCard(next, resourceId).rested).toBe(false);
    });
  });

  describe("ST01-012 Thoroughly Damaged — Main: 1 dano no alvo rested", () => {
    it("aplica 1 dano sem destruir se o alvo sobrevive", () => {
      const state = freshGame();
      const sourceId = place(state, "A", ST01_CARD_DEFS.GM, "battleArea"); // fonte fictícia, só pro ctx
      const targetId = place(state, "B", ST01_CARD_DEFS.GUNCANNON, "battleArea", { rested: true }); // HP4
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: sourceId, turnNumber: state.turnNumber, targets: { target: [targetId] } };

      const events = resolveEffectSpec(THOROUGHLY_DAMAGED_MAIN, ctx);
      const next = applyEvents(state, events);

      expect(findCard(next, targetId).damage).toBe(1);
      expect(findCard(next, targetId).zone).toBe("battleArea");
    });

    it("destrói o alvo se o dano bater o HP efetivo (Comprehensive Rules 5-5-2)", () => {
      const state = freshGame();
      const sourceId = place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
      const targetId = place(state, "B", ST01_CARD_DEFS.DEMI_TRAINER, "battleArea", { rested: true, damage: 0 }); // HP1
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: sourceId, turnNumber: state.turnNumber, targets: { target: [targetId] } };

      const events = resolveEffectSpec(THOROUGHLY_DAMAGED_MAIN, ctx);
      const next = applyEvents(state, events);

      expect(next.players.B.trash.some((c) => c.instanceId === targetId)).toBe(true);
    });
  });

  it("ST01-013 Kai's Resolve — Main: alvo recupera 3 HP", () => {
    const state = freshGame();
    const sourceId = place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const targetId = place(state, "A", ST01_CARD_DEFS.GUNCANNON, "battleArea", { damage: 4 }); // HP4, quase destruída
    const ctx: EffectContext = { state, controller: "A", sourceInstanceId: sourceId, turnNumber: state.turnNumber, targets: { target: [targetId] } };

    const events = resolveEffectSpec(KAIS_RESOLVE_MAIN, ctx);
    const next = applyEvents(state, events);

    expect(findCard(next, targetId).damage).toBe(1);
  });

  it("ST01-014 Unforeseen Incident — Burst/Main/Action compilam pra exatamente o mesmo evento (AP-3 endOfTurn)", () => {
    const state = freshGame();
    const sourceId = place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const targetId = place(state, "B", ST01_CARD_DEFS.GUNCANNON, "battleArea");
    const ctx: EffectContext = { state, controller: "A", sourceInstanceId: sourceId, turnNumber: state.turnNumber, targets: { target: [targetId] } };

    const burstEvents = resolveEffectSpec(UNFORESEEN_INCIDENT_BURST, ctx);
    const mainEvents = resolveEffectSpec(UNFORESEEN_INCIDENT_MAIN, ctx);
    const actionEvents = resolveEffectSpec(UNFORESEEN_INCIDENT_ACTION, ctx);

    expect(burstEvents).toEqual(mainEvents);
    expect(mainEvents).toEqual(actionEvents);
    expect(mainEvents).toEqual([
      { type: "MODIFY_STAT", instanceId: targetId, modifier: { stat: "ap", amount: -3, duration: "endOfTurn", appliedOnTurn: state.turnNumber } },
    ]);
  });

  describe("ST01-015 White Base / ST01-016 Asticassia — Burst + Deploy", () => {
    it("Burst: a própria carta (revelada como shield) se deploya na Base Section", () => {
      const state = freshGame();
      const baseId = place(state, "A", ST01_CARD_DEFS.WHITE_BASE, "shields");
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: baseId, turnNumber: state.turnNumber, targets: {} };

      const events = resolveEffectSpec(WHITE_BASE_BURST, ctx);
      const next = applyEvents(state, events);

      expect(findCard(next, baseId).zone).toBe("baseSection");
    });

    it("Deploy: 1 Shield escolhido vai pra mão", () => {
      const state = freshGame();
      const baseId = place(state, "A", ST01_CARD_DEFS.WHITE_BASE, "baseSection");
      const shieldId = state.players.A.shields[0].instanceId;
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: baseId, turnNumber: state.turnNumber, targets: { shield: [shieldId] } };

      const events = resolveEffectSpec(WHITE_BASE_DEPLOY, ctx);
      const next = applyEvents(state, events);

      expect(findCard(next, shieldId).zone).toBe("hand");
    });

    it("Asticassia segue o mesmo padrão de Burst (self -> baseSection)", () => {
      const state = freshGame();
      const baseId = place(state, "A", ST01_CARD_DEFS.ASTICASSIA, "shields");
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: baseId, turnNumber: state.turnNumber, targets: {} };

      const events = resolveEffectSpec(ASTICASSIA_BURST, ctx);
      const next = applyEvents(state, events);

      expect(findCard(next, baseId).zone).toBe("baseSection");
    });

    it("Asticassia segue o mesmo padrão de Deploy (1 Shield -> mão)", () => {
      const state = freshGame();
      const baseId = place(state, "A", ST01_CARD_DEFS.ASTICASSIA, "baseSection");
      const shieldId = state.players.A.shields[0].instanceId;
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: baseId, turnNumber: state.turnNumber, targets: { shield: [shieldId] } };

      const events = resolveEffectSpec(ASTICASSIA_DEPLOY, ctx);
      const next = applyEvents(state, events);

      expect(findCard(next, shieldId).zone).toBe("hand");
    });

    it("Deploy sem escolha de shield: pega o 1º shield automaticamente (escolha cega — shields são face-down)", () => {
      const state = freshGame();
      const baseId = place(state, "A", ST01_CARD_DEFS.WHITE_BASE, "baseSection");
      const firstShieldId = state.players.A.shields[0].instanceId;
      const handBefore = state.players.A.hand.length;
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: baseId, turnNumber: state.turnNumber, targets: {} };

      const next = applyEvents(state, resolveEffectSpec(WHITE_BASE_DEPLOY, ctx));

      expect(findCard(next, firstShieldId).zone).toBe("hand");
      expect(next.players.A.hand.length).toBe(handBefore + 1);
    });

    it("Deploy com 0 shields: não lança, só não move nada (a Base ainda deploya)", () => {
      const state = freshGame();
      state.players.A.shields = [];
      const baseId = place(state, "A", ST01_CARD_DEFS.WHITE_BASE, "baseSection");
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: baseId, turnNumber: state.turnNumber, targets: {} };

      expect(() => resolveEffectSpec(WHITE_BASE_DEPLOY, ctx)).not.toThrow();
      expect(resolveEffectSpec(WHITE_BASE_DEPLOY, ctx)).toEqual([]);
    });
  });

  describe("ST01-015 White Base — Activate·Main ②: deploy de token condicional por Units em campo (docs/18 lacunas #3/#4)", () => {
    it("custo ④②: resta 2 Recursos active e, com 0 Units em campo, deploya 1 token [Gundam] (AP3/HP3)", () => {
      const state = freshGame();
      const baseId = place(state, "A", ST01_CARD_DEFS.WHITE_BASE, "baseSection");
      const r1 = place(state, "A", ST01_CARD_DEFS.RESOURCE, "resourceArea");
      const r2 = place(state, "A", ST01_CARD_DEFS.RESOURCE, "resourceArea");
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: baseId, turnNumber: state.turnNumber, targets: {} };

      const next = applyEvents(state, resolveEffectSpec(WHITE_BASE_ACTIVATE_MAIN, ctx));

      expect(findCard(next, r1).rested).toBe(true);
      expect(findCard(next, r2).rested).toBe(true);
      const tokens = next.players.A.battleArea.filter((c) => c.def.isToken);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].def.nameEn).toBe("Gundam");
      expect(tokens[0].def.ap).toBe(3);
    });

    it("com 1 Unit em campo deploya [Guncannon]; com 2+ deploya [Guntank]", () => {
      const state = freshGame();
      const baseId = place(state, "A", ST01_CARD_DEFS.WHITE_BASE, "baseSection");
      place(state, "A", ST01_CARD_DEFS.RESOURCE, "resourceArea");
      place(state, "A", ST01_CARD_DEFS.RESOURCE, "resourceArea");
      place(state, "A", ST01_CARD_DEFS.RESOURCE, "resourceArea");
      place(state, "A", ST01_CARD_DEFS.RESOURCE, "resourceArea");
      place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
      const ctx1: EffectContext = { state, controller: "A", sourceInstanceId: baseId, turnNumber: state.turnNumber, targets: {} };
      const afterFirst = applyEvents(state, resolveEffectSpec(WHITE_BASE_ACTIVATE_MAIN, ctx1));
      expect(afterFirst.players.A.battleArea.filter((c) => c.def.isToken).map((c) => c.def.nameEn)).toEqual(["Guncannon"]);

      const ctx2: EffectContext = { state: afterFirst, controller: "A", sourceInstanceId: baseId, turnNumber: afterFirst.turnNumber, targets: {} };
      const afterSecond = applyEvents(afterFirst, resolveEffectSpec(WHITE_BASE_ACTIVATE_MAIN, ctx2));
      expect(afterSecond.players.A.battleArea.filter((c) => c.def.isToken).map((c) => c.def.nameEn)).toEqual(["Guncannon", "Guntank"]);
    });

    it("custo ② sem Recursos active suficientes: lança", () => {
      const state = freshGame();
      const baseId = place(state, "A", ST01_CARD_DEFS.WHITE_BASE, "baseSection");
      place(state, "A", ST01_CARD_DEFS.RESOURCE, "resourceArea");
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: baseId, turnNumber: state.turnNumber, targets: {} };

      expect(() => resolveEffectSpec(WHITE_BASE_ACTIVATE_MAIN, ctx)).toThrow(/Recursos active insuficientes/);
    });
  });

  it("ST01-016 Asticassia — Activate·Main: resta a Base e dá AP+1 a toda Unit amiga com Link ativo (docs/18 lacuna #5)", () => {
    const state = freshGame();
    const baseId = place(state, "A", ST01_CARD_DEFS.ASTICASSIA, "baseSection");
    const amuroId = place(state, "A", ST01_CARD_DEFS.AMURO_RAY, "battleArea");
    const linkedId = place(state, "A", ST01_CARD_DEFS.GUNDAM, "battleArea", { pairedPilotId: amuroId });
    const unlinkedId = place(state, "A", ST01_CARD_DEFS.GM, "battleArea");
    const ctx: EffectContext = { state, controller: "A", sourceInstanceId: baseId, turnNumber: state.turnNumber, targets: {} };

    const next = applyEvents(state, resolveEffectSpec(ASTICASSIA_ACTIVATE_MAIN, ctx));

    expect(findCard(next, baseId).rested).toBe(true);
    expect(findCard(next, linkedId).statModifiers).toEqual([
      { stat: "ap", amount: 1, duration: "endOfTurn", appliedOnTurn: state.turnNumber },
    ]);
    expect(findCard(next, unlinkedId).statModifiers).toEqual([]);
  });
});
