import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction } from "./actions";
import { deployCard } from "./deploy";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { buildSt03DeckList, ST03_CARD_DEFS } from "../fixtures/st03Deck";
import { ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

/**
 * Regressão do bug de campo (feedback dos testers, docs/47 Lane 0A / Fix 1):
 * ST03-015 Rewloola 【Deploy】 = "Add 1 of your Shields to your hand. Then, choose
 * 1 enemy Unit with 5 or less AP. Deal 1 damage to it." — a Unit inimiga
 * escolhida na `abilityResolution` era aliasada pra `ctx.targets.shield`, então
 * `addShieldToHand` movia a Unit inimiga pra mão e o shield real NUNCA voltava.
 * Sintoma reportado: "a Base não adicionou um shield para minha mão" + no log
 * "Demi Trainer voltou pra mão / recebeu 1 de dano / foi destruída".
 */

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-rwlx-${seq++}`;
  state.players[player][zone].push({
    instanceId,
    def,
    owner: player,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber - 1,
    ...opts,
  });
  return instanceId;
}

function apply(state: GameState, p: PlayerId, action: Parameters<typeof applyPlayerAction>[2]): GameState {
  return applyPlayerAction(state, p, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}

describe("ST03-015 Rewloola 【Deploy】 — caminho real (deployCard + resolveAbility)", () => {
  function setup() {
    const state = advanceToMainPhase(createGame(buildSt03DeckList(), buildSt03DeckList(), { seed: 7, firstPlayer: "A" }));
    // nível 3 / custo 2 — garante recursos suficientes ativos
    for (let i = 0; i < 3; i++) {
      place(state, "A", { code: "RWL-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
    }
    state.players.A.baseSection = []; // sem Base atual, evita troca
    const rewloolaId = place(state, "A", ST03_CARD_DEFS.REWLOOLA, "hand");
    // Demi Trainer (ST01-008): AP1 (≤5, alvo legal), HP1 (1 de dano = letal) —
    // mesma carta do log do tester.
    const demiId = place(state, "B", ST01_CARD_DEFS.DEMI_TRAINER, "battleArea");
    return { state, rewloolaId, demiId };
  }

  it("adiciona 1 shield à mão E dá 1 de dano na Unit inimiga; a Unit morta vai pro trash do dono, nunca pra mão", () => {
    const { state, rewloolaId, demiId } = setup();

    const shieldsBefore = state.players.A.shields.length;
    const handBefore = state.players.A.hand.filter((c) => c.instanceId !== rewloolaId).length;

    const paused = deployCard(state, "A", rewloolaId, {
      specs: ALL_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });
    expect(paused.pendingDecision.A?.kind).toBe("abilityResolution");

    const next = apply(paused, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: "ST03-015-Deploy", activate: true, targetIds: [demiId] }],
    });

    // shield foi pra mão: -1 shield, +1 carta na mão
    expect(next.players.A.shields.length).toBe(shieldsBefore - 1);
    expect(next.players.A.hand.length).toBe(handBefore + 1);

    // a Unit inimiga tomou 1 de dano e foi destruída
    const demi = next.players.B.trash.find((c) => c.instanceId === demiId);
    expect(demi, "Demi Trainer deve estar no trash de B").toBeDefined();

    // e NUNCA foi parar em mão nenhuma (era o bug: MOVE_CARD demi -> hand)
    expect(next.players.A.hand.some((c) => c.instanceId === demiId)).toBe(false);
    expect(next.players.B.hand.some((c) => c.instanceId === demiId)).toBe(false);
    expect(next.pendingDecision.A).toBeNull();
  });

  it("Unit inimiga que sobrevive ao dano continua na Battle Area, com 1 de dano; shield mesmo assim vai pra mão", () => {
    const state = advanceToMainPhase(createGame(buildSt03DeckList(), buildSt03DeckList(), { seed: 11, firstPlayer: "A" }));
    for (let i = 0; i < 3; i++) {
      place(state, "A", { code: "RWL-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
    }
    state.players.A.baseSection = [];
    const rewloolaId = place(state, "A", ST03_CARD_DEFS.REWLOOLA, "hand");
    const draCId = place(state, "B", ST03_CARD_DEFS.DRA_C, "battleArea"); // AP1 (≤5), HP2 (sobrevive a 1)
    const shieldsBefore = state.players.A.shields.length;

    const paused = deployCard(state, "A", rewloolaId, {
      specs: ALL_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });
    const next = apply(paused, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: "ST03-015-Deploy", activate: true, targetIds: [draCId] }],
    });

    expect(next.players.A.shields.length).toBe(shieldsBefore - 1);
    const draC = next.players.B.battleArea.find((c) => c.instanceId === draCId);
    expect(draC?.damage).toBe(1);
  });
});
