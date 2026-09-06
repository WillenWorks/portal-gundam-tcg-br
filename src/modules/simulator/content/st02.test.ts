import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { buildSt02DeckList, ST02_CARD_DEFS } from "../fixtures/st02Deck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "../engine/types";
import { keywordValue } from "../engine/types";
import type { EffectContext } from "../engine/effectSpec";
import { resolveEffectSpec } from "../engine/effectSpec";
import { applyEvents, findCard } from "../engine/events";
import { declareAttack, passAction, proceedToBlockStep, resolveDamageStep, skipBlock } from "../engine/combat";
import {
  CORSICA_BASE_BURST,
  CORSICA_BASE_DEPLOY,
  HEERO_YUY_BURST,
  PEACEFUL_TIMBRE_ACTION,
  SAINT_GABRIEL_INSTITUTE_BURST,
  SAINT_GABRIEL_INSTITUTE_DEPLOY,
  SIEGE_PLOY_ACTION,
  SIEGE_PLOY_BURST,
  SIEGE_PLOY_MAIN,
  SIMULTANEOUS_FIRE_MAIN,
  ST02_EFFECT_SPECS,
  TALLGEESE_ACTIVATE_MAIN,
  WING_GUNDAM_BIRD_MODE_DEPLOY,
  ZECHS_MERQUISE_BURST,
} from "./st02";
import { defaultPredicateResolver } from "./predicates";
import { peekAndReorderDeck } from "../engine/effectSpec";

/**
 * Passo 3 do plano incremental (docs/18), segundo deck real (ST02). Mesmo
 * padrão de `content/st01.test.ts`: cada EffectSpec é testado chamando
 * `resolveEffectSpec` direto, sem dispatcher automático.
 */

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-st02fx-${seq++}`;
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
  return createGame(buildSt02DeckList(), buildSt02DeckList(), { seed: 11, firstPlayer: "A" });
}

function stripBase(state: GameState, player: PlayerId): GameState {
  return { ...state, players: { ...state.players, [player]: { ...state.players[player], baseSection: [] } } };
}

describe("EffectSpecs reais do ST02 (docs/18 passo 3)", () => {
  it("13 EffectSpecs cadastrados, cobrindo 9 das 16 cartas únicas", () => {
    const codes = new Set(ST02_EFFECT_SPECS.map((s) => s.cardCode));
    expect(ST02_EFFECT_SPECS).toHaveLength(13);
    expect(codes.size).toBe(9);
  });

  it("ST02-006 Tallgeese — Activate·Main ④: paga 4 Recursos active e seta a própria Unit como active", () => {
    const state = freshGame();
    const tallgeeseId = place(state, "A", ST02_CARD_DEFS.TALLGEESE, "battleArea", { rested: true });
    const resourceIds = [0, 1, 2, 3].map(() => place(state, "A", ST02_CARD_DEFS.RESOURCE, "resourceArea"));
    const ctx: EffectContext = { state, controller: "A", sourceInstanceId: tallgeeseId, turnNumber: state.turnNumber, targets: {} };

    const events = resolveEffectSpec(TALLGEESE_ACTIVATE_MAIN, ctx);
    const next = applyEvents(state, events);

    expect(findCard(next, tallgeeseId).rested).toBe(false);
    expect(resourceIds.every((id) => findCard(next, id).rested)).toBe(true);
  });

  it("ST02-006 Tallgeese — Activate·Main ④: sem 4 Recursos active, lança", () => {
    const state = freshGame();
    const tallgeeseId = place(state, "A", ST02_CARD_DEFS.TALLGEESE, "battleArea", { rested: true });
    [0, 1, 2].forEach(() => place(state, "A", ST02_CARD_DEFS.RESOURCE, "resourceArea"));
    const ctx: EffectContext = { state, controller: "A", sourceInstanceId: tallgeeseId, turnNumber: state.turnNumber, targets: {} };

    expect(() => resolveEffectSpec(TALLGEESE_ACTIVATE_MAIN, ctx)).toThrow(/Recursos active insuficientes/);
  });

  it("ST02-002 Wing Gundam (Bird Mode) — Deploy: coloca 1 EX Resource active na Resource Area (docs/18 lacuna #3)", () => {
    const state = freshGame();
    const wingId = place(state, "A", ST02_CARD_DEFS.WING_GUNDAM_BIRD_MODE, "battleArea");
    const before = state.players.A.resourceArea.length;
    const ctx: EffectContext = { state, controller: "A", sourceInstanceId: wingId, turnNumber: state.turnNumber, targets: {} };

    const next = applyEvents(state, resolveEffectSpec(WING_GUNDAM_BIRD_MODE_DEPLOY, ctx));

    expect(next.players.A.resourceArea).toHaveLength(before + 1);
    const exRes = next.players.A.resourceArea[next.players.A.resourceArea.length - 1];
    expect(exRes.def.nameEn).toBe("EX Resource");
    expect(exRes.rested).toBe(false);
  });

  it("ST02-013 Peaceful Timbre — Action: shields do defensor não recebem dano de Unit inimiga Lv.4 ou menos nesta batalha (docs/18 lacuna #7)", () => {
    let state = stripBase(freshGame(), "B");
    const attackerId = place(state, "A", ST02_CARD_DEFS.LEO, "battleArea"); // Lv.2, AP2
    const sourceId = place(state, "A", ST02_CARD_DEFS.GUNDAM_SANDROCK, "battleArea"); // só pra ter fonte do ctx
    const shieldsBefore = state.players.B.shields.length;

    state = { ...state, phase: "main" };
    state = declareAttack(state, attackerId, "player");
    state = proceedToBlockStep(state);
    state = skipBlock(state);

    // durante o Action Step, o controlador joga Peaceful Timbre (ação sobre o combate em andamento)
    const ctx: EffectContext = { state, controller: "A", sourceInstanceId: sourceId, turnNumber: state.turnNumber, targets: {} };
    state = applyEvents(state, resolveEffectSpec(PEACEFUL_TIMBRE_ACTION, ctx));
    expect(state.combat?.shieldProtection).toEqual({ maxAttackerLevel: 4 });

    state = passAction(state, state.combat!.defendingPlayer);
    state = passAction(state, state.combat!.attackingPlayer);
    state = resolveDamageStep(state);

    expect(state.players.B.shields).toHaveLength(shieldsBefore); // nenhum shield caiu
  });

  it("ST02-010 Heero Yuy — Burst: a própria carta (revelada como shield) vai pra mão", () => {
    const state = freshGame();
    const heeroId = place(state, "A", ST02_CARD_DEFS.HEERO_YUY, "shields");
    const ctx: EffectContext = { state, controller: "A", sourceInstanceId: heeroId, turnNumber: state.turnNumber, targets: {} };

    const events = resolveEffectSpec(HEERO_YUY_BURST, ctx);
    const next = applyEvents(state, events);

    expect(findCard(next, heeroId).zone).toBe("hand");
  });

  it("ST02-011 Zechs Merquise — Burst: a própria carta (revelada como shield) vai pra mão", () => {
    const state = freshGame();
    const zechsId = place(state, "A", ST02_CARD_DEFS.ZECHS_MERQUISE, "shields");
    const ctx: EffectContext = { state, controller: "A", sourceInstanceId: zechsId, turnNumber: state.turnNumber, targets: {} };

    const events = resolveEffectSpec(ZECHS_MERQUISE_BURST, ctx);
    const next = applyEvents(state, events);

    expect(findCard(next, zechsId).zone).toBe("hand");
  });

  describe("ST02-012 Simultaneous Fire — Main: concede <Breach 3> ao alvo neste turno", () => {
    it("compila pra um GRANT_KEYWORD e o alvo passa a ter keywordValue('Breach') === 3", () => {
      const state = freshGame();
      const sourceId = place(state, "A", ST02_CARD_DEFS.LEO, "battleArea");
      const targetId = place(state, "A", ST02_CARD_DEFS.GUNDAM_SANDROCK, "battleArea");
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: sourceId, turnNumber: state.turnNumber, targets: { target: [targetId] } };

      const events = resolveEffectSpec(SIMULTANEOUS_FIRE_MAIN, ctx);
      expect(events).toEqual([
        { type: "GRANT_KEYWORD", instanceId: targetId, grant: { keyword: "Breach 3", duration: "endOfTurn", appliedOnTurn: state.turnNumber } },
      ]);

      const next = applyEvents(state, events);
      expect(keywordValue(findCard(next, targetId), "Breach")).toBe(3);
    });

    it("regressão: o Breach concedido dinamicamente é lido de verdade pelo combate (bug encontrado nesta wave, corrigido em types.ts)", () => {
      let state = stripBase(freshGame(), "B");
      const casterId = place(state, "A", ST02_CARD_DEFS.LEO, "battleArea");
      const attackerId = place(state, "A", ST02_CARD_DEFS.GUNDAM_SANDROCK, "battleArea"); // AP4/HP3, sem Breach nativo
      const defenderId = place(state, "B", ST02_CARD_DEFS.TRAGOS, "battleArea", { rested: true }); // AP1/HP1
      const shieldsBefore = state.players.B.shields.length;

      // antes da correção, keywordValue nunca via keywordGrants — o Breach concedido aqui seria ignorado no Damage Step
      const grantCtx: EffectContext = { state, controller: "A", sourceInstanceId: casterId, turnNumber: state.turnNumber, targets: { target: [attackerId] } };
      state = applyEvents(state, resolveEffectSpec(SIMULTANEOUS_FIRE_MAIN, grantCtx));
      expect(keywordValue(findCard(state, attackerId), "Breach")).toBe(3);

      state = { ...state, phase: "main" };
      state = declareAttack(state, attackerId, { unitId: defenderId });
      state = proceedToBlockStep(state);
      state = skipBlock(state);
      state = passAction(state, state.combat!.defendingPlayer);
      state = passAction(state, state.combat!.attackingPlayer);
      state = resolveDamageStep(state);

      expect(state.players.B.trash.some((c) => c.instanceId === defenderId)).toBe(true);
      // <Breach N> sempre acerta só o 1º shield (Shield tem "1 HP" — 1+ de dano já
      // destrói o shield inteiro) — N nunca muda quantos shields caem.
      expect(state.players.B.shields).toHaveLength(shieldsBefore - 1);
    });
  });

  it("ST02-014 Siege Ploy — Burst/Main/Action compilam pro mesmo evento (resta o alvo)", () => {
    const state = freshGame();
    const sourceId = place(state, "A", ST02_CARD_DEFS.LEO, "battleArea");
    const targetId = place(state, "B", ST02_CARD_DEFS.TRAGOS, "battleArea");
    const ctx: EffectContext = { state, controller: "A", sourceInstanceId: sourceId, turnNumber: state.turnNumber, targets: { target: [targetId] } };

    const burstEvents = resolveEffectSpec(SIEGE_PLOY_BURST, ctx);
    const mainEvents = resolveEffectSpec(SIEGE_PLOY_MAIN, ctx);
    const actionEvents = resolveEffectSpec(SIEGE_PLOY_ACTION, ctx);

    expect(burstEvents).toEqual(mainEvents);
    expect(mainEvents).toEqual(actionEvents);
    expect(mainEvents).toEqual([{ type: "REST_CARD", instanceId: targetId }]);
  });

  describe("ST02-015 Saint Gabriel Institute / ST02-016 Corsica Base — Burst + Deploy", () => {
    it("Burst: a própria carta (revelada como shield) se deploya na Base Section", () => {
      const state = freshGame();
      const baseId = place(state, "A", ST02_CARD_DEFS.SAINT_GABRIEL_INSTITUTE, "shields");
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: baseId, turnNumber: state.turnNumber, targets: {} };

      const events = resolveEffectSpec(SAINT_GABRIEL_INSTITUTE_BURST, ctx);
      const next = applyEvents(state, events);

      expect(findCard(next, baseId).zone).toBe("baseSection");
    });

    it("Deploy: 1 Shield escolhido vai pra mão + reordena o topo do deck (2ª carta pro topo, 1ª pro fundo) — docs/18 lacuna #8", () => {
      const state = freshGame();
      const baseId = place(state, "A", ST02_CARD_DEFS.SAINT_GABRIEL_INSTITUTE, "baseSection");
      const shieldId = state.players.A.shields[0].instanceId;
      const [top1, top2] = peekAndReorderDeck(state, "A", 2);
      const deckSizeBefore = state.players.A.deck.length;
      // quem controla decide: manda a 2ª carta olhada pro topo e a 1ª pro fundo
      const ctx: EffectContext = {
        state,
        controller: "A",
        sourceInstanceId: baseId,
        turnNumber: state.turnNumber,
        targets: { shield: [shieldId], toTop: [top2.instanceId], toBottom: [top1.instanceId] },
      };

      const next = applyEvents(state, resolveEffectSpec(SAINT_GABRIEL_INSTITUTE_DEPLOY, ctx));

      expect(findCard(next, shieldId).zone).toBe("hand");
      expect(next.players.A.deck).toHaveLength(deckSizeBefore);
      expect(next.players.A.deck[0].instanceId).toBe(top2.instanceId);
      expect(next.players.A.deck[next.players.A.deck.length - 1].instanceId).toBe(top1.instanceId);
    });

    it("Deploy: sem decisão de reordenação (toTop/toBottom ausentes), o deck fica como está — no-op, não erro", () => {
      const state = freshGame();
      const baseId = place(state, "A", ST02_CARD_DEFS.SAINT_GABRIEL_INSTITUTE, "baseSection");
      const shieldId = state.players.A.shields[0].instanceId;
      const deckOrderBefore = state.players.A.deck.map((c) => c.instanceId);
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: baseId, turnNumber: state.turnNumber, targets: { shield: [shieldId] } };

      const next = applyEvents(state, resolveEffectSpec(SAINT_GABRIEL_INSTITUTE_DEPLOY, ctx));

      expect(findCard(next, shieldId).zone).toBe("hand");
      expect(next.players.A.deck.map((c) => c.instanceId)).toEqual(deckOrderBefore);
    });

    it("Corsica Base segue o mesmo padrão de Burst (self -> baseSection)", () => {
      const state = freshGame();
      const baseId = place(state, "A", ST02_CARD_DEFS.CORSICA_BASE, "shields");
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: baseId, turnNumber: state.turnNumber, targets: {} };

      const events = resolveEffectSpec(CORSICA_BASE_BURST, ctx);
      const next = applyEvents(state, events);

      expect(findCard(next, baseId).zone).toBe("baseSection");
    });

    it("Corsica Base — Deploy: 1 Shield pra mão + deploya 1 token [Tallgeese] (sem 'Corsica Base' no trash) — docs/18 lacuna #3", () => {
      const state = freshGame();
      const baseId = place(state, "A", ST02_CARD_DEFS.CORSICA_BASE, "baseSection");
      const shieldId = state.players.A.shields[0].instanceId;
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: baseId, turnNumber: state.turnNumber, targets: { shield: [shieldId] } };

      const next = applyEvents(state, resolveEffectSpec(CORSICA_BASE_DEPLOY, ctx, defaultPredicateResolver));

      expect(findCard(next, shieldId).zone).toBe("hand");
      const tokens = next.players.A.battleArea.filter((c) => c.def.isToken);
      expect(tokens.map((c) => c.def.nameEn)).toEqual(["Tallgeese"]);
    });

    it("Corsica Base — Deploy: com uma carta 'Corsica Base' no trash, deploya 2 tokens [Leo] em vez do Tallgeese", () => {
      const state = freshGame();
      const baseId = place(state, "A", ST02_CARD_DEFS.CORSICA_BASE, "baseSection");
      place(state, "A", ST02_CARD_DEFS.CORSICA_BASE, "trash");
      const shieldId = state.players.A.shields[0].instanceId;
      const ctx: EffectContext = { state, controller: "A", sourceInstanceId: baseId, turnNumber: state.turnNumber, targets: { shield: [shieldId] } };

      const next = applyEvents(state, resolveEffectSpec(CORSICA_BASE_DEPLOY, ctx, defaultPredicateResolver));

      const tokens = next.players.A.battleArea.filter((c) => c.def.isToken);
      expect(tokens.map((c) => c.def.nameEn)).toEqual(["Leo", "Leo"]);
    });
  });
});
