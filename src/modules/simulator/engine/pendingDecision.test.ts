import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { buildSt02DeckList, ST02_CARD_DEFS } from "../fixtures/st02Deck";
import { buildVanillaDeckList, VANILLA_CARD_DEFS } from "../fixtures/vanillaDeck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, playerHasActionStepPlay } from "./actions";
import { findCard } from "./events";
import { ALL_EFFECT_SPECS, defaultPredicateResolver } from "../content";

/**
 * docs/19, Sessão 2 — decisões interativas (`PendingDecision`): pausa
 * autoritativa de 【Burst】, habilidades ativadas (`activateAbility`) e o
 * helper de auto-pass (`playerHasActionStepPlay`).
 */

const SPECS = ALL_EFFECT_SPECS;
const R = defaultPredicateResolver;

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-pdfx-${seq++}`;
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

function giveResources(state: GameState, player: PlayerId, n: number): void {
  for (let i = 0; i < n; i++) {
    place(state, player, { code: "PD-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
  }
}

function apply(state: GameState, p: PlayerId, action: Parameters<typeof applyPlayerAction>[2]): GameState {
  return applyPlayerAction(state, p, action, SPECS, R);
}

/** A ataca o jogador B; B tem 1 único shield = `shieldDef`. Retorna o estado logo antes do 2º passAction. */
function attackIntoSingleShield(shieldDef: CardDef): { state: GameState; attackerId: string; shieldId: string } {
  const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" }));
  state.players.B.baseSection = [];
  state.players.B.shields = [];
  const shieldId = place(state, "B", shieldDef, "shields");
  const attackerId = place(state, "A", ST01_CARD_DEFS.GM, "battleArea"); // AP2

  let next = apply(state, "A", { kind: "declareAttack", attackerId, target: "player" });
  next = apply(next, "B", { kind: "skipBlock" });
  next = apply(next, "B", { kind: "passAction" });
  return { state: next, attackerId, shieldId };
}

describe("Pausa autoritativa de 【Burst】 (docs/19, Sessão 2)", () => {
  it("shield com 【Burst】 quebrada -> passAction PAUSA no Damage Step e grava pendingDecision pro defensor", () => {
    const { state, shieldId } = attackIntoSingleShield(ST01_CARD_DEFS.AMURO_RAY);
    const next = apply(state, "A", { kind: "passAction" });

    expect(next.combat?.step).toBe("damage"); // combate NÃO fechou
    expect(next.pendingDecision.B).toMatchObject({ kind: "burst", cardInstanceId: shieldId, queuedInstanceIds: [] });
    expect(next.pendingDecision.A).toBeNull();
    expect(findCard(next, shieldId).zone).toBe("trash"); // shield já caiu; Burst decide se sai do trash
  });

  it("enquanto a decisão está pendente, nenhum dos dois joga outra coisa", () => {
    const { state } = attackIntoSingleShield(ST01_CARD_DEFS.AMURO_RAY);
    const paused = apply(state, "A", { kind: "passAction" });

    expect(() => apply(paused, "A", { kind: "passAction" })).toThrow(/Aguardando o oponente/);
    expect(() => apply(paused, "B", { kind: "passAction" })).toThrow(/Resolva a decisão de/);
  });

  it("resolveBurstDecision{activate:true} roda o efeito (Amuro Ray -> mão), limpa a decisão e fecha o combate", () => {
    const { state, shieldId } = attackIntoSingleShield(ST01_CARD_DEFS.AMURO_RAY);
    const paused = apply(state, "A", { kind: "passAction" });
    const next = apply(paused, "B", { kind: "resolveBurstDecision", activate: true });

    expect(findCard(next, shieldId).zone).toBe("hand"); // AMURO_RAY_BURST: self -> hand
    expect(next.pendingDecision.B).toBeNull();
    expect(next.combat).toBeNull(); // Battle End rodou
  });

  it("resolveBurstDecision{activate:false} deixa a carta no trash e fecha o combate", () => {
    const { state, shieldId } = attackIntoSingleShield(ST01_CARD_DEFS.AMURO_RAY);
    const paused = apply(state, "A", { kind: "passAction" });
    const next = apply(paused, "B", { kind: "resolveBurstDecision", activate: false });

    expect(findCard(next, shieldId).zone).toBe("trash");
    expect(next.pendingDecision.B).toBeNull();
    expect(next.combat).toBeNull();
  });

  it("shield SEM 【Burst】 não pausa nada — combate fecha na hora", () => {
    const { state } = attackIntoSingleShield(ST01_CARD_DEFS.GUNCANNON); // vanilla, sem Burst
    const next = apply(state, "A", { kind: "passAction" });

    expect(next.combat).toBeNull();
    expect(next.pendingDecision.B).toBeNull();
  });

  it("resolveBurstDecision sem decisão pendente lança", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" }));
    expect(() => apply(state, "A", { kind: "resolveBurstDecision", activate: false })).toThrow(/não há decisão de/i);
  });
});

describe("activateAbility (docs/19, Sessão 2)", () => {
  function freshSt02(): GameState {
    return advanceToMainPhase(createGame(buildSt02DeckList(), buildSt02DeckList(), { seed: 11, firstPlayer: "A" }));
  }

  it("ST02-006 Tallgeese — Activate·Main ④: paga 4 recursos e fica active", () => {
    const state = freshSt02();
    state.players.A.resourceArea = [];
    const tallgeeseId = place(state, "A", ST02_CARD_DEFS.TALLGEESE, "battleArea", { rested: true });
    giveResources(state, "A", 5);

    const next = apply(state, "A", { kind: "activateAbility", sourceInstanceId: tallgeeseId });

    expect(findCard(next, tallgeeseId).rested).toBe(false);
    expect(next.players.A.resourceArea.filter((r) => r.rested)).toHaveLength(4);
  });

  it("resourceInstanceIds: paga com os recursos escolhidos e POUPA o EX Resource não escolhido", () => {
    const state = freshSt02();
    state.players.A.resourceArea = [];
    const tallgeeseId = place(state, "A", ST02_CARD_DEFS.TALLGEESE, "battleArea", { rested: true });
    const exId = place(state, "A", { code: "TOKEN-EX-RESOURCE", nameEn: "EX Resource", cardType: "RESOURCE", color: "colorless", isToken: true }, "resourceArea");
    giveResources(state, "A", 5);
    const chosen = state.players.A.resourceArea.filter((r) => r.instanceId !== exId).slice(0, 4).map((r) => r.instanceId);

    const next = apply(state, "A", { kind: "activateAbility", sourceInstanceId: tallgeeseId, resourceInstanceIds: chosen });

    expect(findCard(next, tallgeeseId).rested).toBe(false);
    // EX Resource continua em jogo e active (não foi escolhido)
    const ex = next.players.A.resourceArea.find((r) => r.instanceId === exId);
    expect(ex && !ex.rested).toBe(true);
    expect(next.players.A.resourceArea.filter((r) => r.rested).map((r) => r.instanceId).sort()).toEqual([...chosen].sort());
  });

  it("Activate·Main só do dono, na própria Main Phase", () => {
    const state = freshSt02();
    const tallgeeseId = place(state, "A", ST02_CARD_DEFS.TALLGEESE, "battleArea", { rested: true });
    giveResources(state, "A", 5);

    expect(() => apply(state, "B", { kind: "activateAbility", sourceInstanceId: tallgeeseId })).toThrow(/carta própria/);
  });

  it("【Once per Turn】: segunda ativação no mesmo turno é ignorada (dispatcher), sem custo dobrado", () => {
    const state = freshSt02();
    state.players.A.resourceArea = [];
    const tallgeeseId = place(state, "A", ST02_CARD_DEFS.TALLGEESE, "battleArea", { rested: true });
    giveResources(state, "A", 9);

    let next = apply(state, "A", { kind: "activateAbility", sourceInstanceId: tallgeeseId });
    next = apply(next, "A", { kind: "activateAbility", sourceInstanceId: tallgeeseId });

    expect(next.players.A.resourceArea.filter((r) => r.rested)).toHaveLength(4); // só a 1ª ativação cobrou
  });

  it("cai em <Support N> quando a carta não tem EffectSpec de Activate·Main", () => {
    const state = advanceToMainPhase(createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 9, firstPlayer: "A" }));
    const supId = place(state, "A", VANILLA_CARD_DEFS.SUPPORT_01, "battleArea");
    const allyId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_02, "battleArea");

    const next = apply(state, "A", { kind: "activateAbility", sourceInstanceId: supId, targets: { target: [allyId] } });

    expect(findCard(next, supId).rested).toBe(true);
    expect(findCard(next, allyId).statModifiers).toEqual([
      { stat: "ap", amount: 1, duration: "endOfTurn", appliedOnTurn: next.turnNumber },
    ]);
  });
});

describe("playerHasActionStepPlay (auto-pass helper, docs/19 Sessão 2 tarefa 4)", () => {
  it("true quando o jogador tem Command 【Action】 jogável na mão", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" }));
    state.players.A.resourceArea = [];
    place(state, "A", ST01_CARD_DEFS.UNFORESEEN_INCIDENT, "hand"); // Command 【Action】, nível 3 / custo 1
    giveResources(state, "A", 3);

    expect(playerHasActionStepPlay(state, "A", SPECS)).toBe(true);
  });

  it("false quando não tem nível/recurso pra pagar o Command 【Action】", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" }));
    state.players.A.resourceArea = [];
    place(state, "A", ST01_CARD_DEFS.UNFORESEEN_INCIDENT, "hand");
    giveResources(state, "A", 2); // nível 2 < 3 exigido

    expect(playerHasActionStepPlay(state, "A", SPECS)).toBe(false);
  });
});
