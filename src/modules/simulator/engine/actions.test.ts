import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { findCard } from "./events";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction } from "./actions";
import { ALL_EFFECT_SPECS, defaultPredicateResolver } from "../content";

/**
 * `applyPlayerAction` é a borda entre o motor puro e a camada de rede
 * (`server/matchStore.ts`, passo 4 do docs/18) — estes testes cobrem a
 * tradução ação->motor e, principalmente, as checagens de autorização que só
 * existem aqui (não dentro do motor), porque é aqui que "qual sessão/conta
 * está mandando essa ação" passa a importar de verdade.
 */

let seq = 0;
function putInHand(state: GameState, player: PlayerId, def: CardDef): string {
  const instanceId = `${player}-actfx-${seq++}`;
  const card: CardInstance = {
    instanceId,
    def,
    owner: player,
    zone: "hand" as Zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber,
  };
  state.players[player].hand.push(card);
  return instanceId;
}

function giveResources(state: GameState, player: PlayerId, n: number): void {
  for (let i = 0; i < n; i++) {
    const instanceId = `${player}-actres-${seq++}`;
    const card: CardInstance = {
      instanceId,
      def: { code: "ACT-RESOURCE", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" },
      owner: player,
      zone: "resourceArea",
      rested: false,
      damage: 0,
      statModifiers: [],
      keywordGrants: [],
      usedKeywordsThisTurn: [],
      enteredZoneOnTurn: state.turnNumber,
    };
    state.players[player].resourceArea.push(card);
  }
}

function freshGame(): GameState {
  const state = createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 5, firstPlayer: "A" });
  return advanceToMainPhase(state);
}

describe("applyPlayerAction — deployCard", () => {
  it("joga uma Unit da mão, cobra o custo e move pra Battle Area", () => {
    const state = freshGame();
    giveResources(state, "A", 5);
    const gmId = putInHand(state, "A", ST01_CARD_DEFS.GM); // cost 1, sem EffectSpec

    const next = applyPlayerAction(state, "A", { kind: "deployCard", cardInstanceId: gmId }, ALL_EFFECT_SPECS, defaultPredicateResolver);

    expect(findCard(next, gmId).zone).toBe("battleArea");
    expect(next.players.A.resourceArea.filter((r) => r.rested)).toHaveLength(1); // custo 1
  });

  it("não deixa um jogador jogar carta que não é dele", () => {
    const state = freshGame();
    giveResources(state, "A", 5);
    const gmId = putInHand(state, "A", ST01_CARD_DEFS.GM);

    expect(() => applyPlayerAction(state, "B", { kind: "deployCard", cardInstanceId: gmId }, ALL_EFFECT_SPECS, defaultPredicateResolver)).toThrow();
  });

  it("dispara Deploy/When Paired automaticamente (via `specs`) — Amuro Ray pareado com Gundam MA Form compra 1 e resta a Unit alvo de B", () => {
    const state = freshGame();
    giveResources(state, "A", 5);
    const maFormId = putInHand(state, "A", ST01_CARD_DEFS.GUNDAM_MA_FORM);
    let next = applyPlayerAction(state, "A", { kind: "deployCard", cardInstanceId: maFormId }, ALL_EFFECT_SPECS, defaultPredicateResolver);

    // alvo válido pro AMURO_RAY_WHEN_PAIRED (lado do Pilot: "escolha 1 Unit inimiga com HP<=5, resta")
    const targetId = `B-actfx-${seq++}`;
    next.players.B.battleArea.push({
      instanceId: targetId,
      def: ST01_CARD_DEFS.GM,
      owner: "B",
      zone: "battleArea",
      rested: false,
      damage: 0,
      statModifiers: [],
      keywordGrants: [],
      usedKeywordsThisTurn: [],
      enteredZoneOnTurn: next.turnNumber - 1,
    });

    const amuroId = putInHand(next, "A", ST01_CARD_DEFS.AMURO_RAY);
    const handBefore = next.players.A.hand.length;
    next = applyPlayerAction(
      next,
      "A",
      { kind: "deployCard", cardInstanceId: amuroId, pairWithUnitId: maFormId, targets: { target: [targetId] } },
      ALL_EFFECT_SPECS,
      defaultPredicateResolver,
    );

    expect(findCard(next, maFormId).pairedPilotId).toBe(amuroId);
    expect(next.players.A.hand.length).toBe(handBefore - 1 + 1); // Amuro saiu (-1), GUNDAM_MA_FORM_WHEN_PAIRED (lado da Unit) compra 1 (+1)
    expect(findCard(next, targetId).rested).toBe(true); // AMURO_RAY_WHEN_PAIRED (lado do Pilot)
  });
});

describe("applyPlayerAction — declareAttack / activateBlocker / skipBlock (autorização)", () => {
  function setupAttacker(): { state: GameState; attackerId: string } {
    const state = freshGame();
    giveResources(state, "A", 5);
    const gmId = putInHand(state, "A", ST01_CARD_DEFS.GM);
    const next = applyPlayerAction(state, "A", { kind: "deployCard", cardInstanceId: gmId }, ALL_EFFECT_SPECS, defaultPredicateResolver);
    // GM foi deployado ESTE turno -> não pode atacar ainda (3-2-4); pra testar
    // o fluxo de ataque isoladamente, "envelhece" a Unit por mutação de
        // fixture (mesma convenção de combat.test.ts) em vez de fingir mais um turno inteiro.
    findCard(next, gmId).enteredZoneOnTurn = next.turnNumber - 1;
    return { state: next, attackerId: gmId };
  }

  it("só o dono da Unit pode declarar ataque com ela", () => {
    const { state, attackerId } = setupAttacker();
    expect(() =>
      applyPlayerAction(state, "B", { kind: "declareAttack", attackerId, target: "player" }, ALL_EFFECT_SPECS, defaultPredicateResolver),
    ).toThrow(/Unit própria/);
  });

  it("declara ataque e já avança automaticamente pro Block Step", () => {
    const { state, attackerId } = setupAttacker();
    const next = applyPlayerAction(state, "A", { kind: "declareAttack", attackerId, target: "player" }, ALL_EFFECT_SPECS, defaultPredicateResolver);
    expect(next.combat?.step).toBe("block");
  });

  it("só quem defende pode ativar <Blocker> ou pular o bloqueio", () => {
    const { state, attackerId } = setupAttacker();
    let next = applyPlayerAction(state, "A", { kind: "declareAttack", attackerId, target: "player" }, ALL_EFFECT_SPECS, defaultPredicateResolver);

    expect(() => applyPlayerAction(next, "A", { kind: "skipBlock" }, ALL_EFFECT_SPECS, defaultPredicateResolver)).toThrow(/quem está defendendo/);

    next = applyPlayerAction(next, "B", { kind: "skipBlock" }, ALL_EFFECT_SPECS, defaultPredicateResolver);
    expect(next.combat?.step).toBe("action");
  });
});

describe("applyPlayerAction — passAction encadeia Damage Step + Battle End automaticamente", () => {
  it("depois dos dois passarem, resolve dano e fecha o combate sozinho (sem passo extra)", () => {
    const state = freshGame();
    state.players.B.baseSection = []; // sem isso o dano vai pra EX Base (HP3), não pro shield — ver combat.test.ts
    giveResources(state, "A", 5);
    const gmId = putInHand(state, "A", ST01_CARD_DEFS.GM); // AP2/HP2
    let next = applyPlayerAction(state, "A", { kind: "deployCard", cardInstanceId: gmId }, ALL_EFFECT_SPECS, defaultPredicateResolver);
    findCard(next, gmId).enteredZoneOnTurn = next.turnNumber - 1;

    const shieldsBefore = next.players.B.shields.length;
    next = applyPlayerAction(next, "A", { kind: "declareAttack", attackerId: gmId, target: "player" }, ALL_EFFECT_SPECS, defaultPredicateResolver);
    next = applyPlayerAction(next, "B", { kind: "skipBlock" }, ALL_EFFECT_SPECS, defaultPredicateResolver);
    expect(next.combat?.step).toBe("action");

    // B (quem defende) tem prioridade primeiro no Action Step
    next = applyPlayerAction(next, "B", { kind: "passAction" }, ALL_EFFECT_SPECS, defaultPredicateResolver);
    expect(next.combat?.step).toBe("action"); // só 1 dos 2 passou ainda

    next = applyPlayerAction(next, "A", { kind: "passAction" }, ALL_EFFECT_SPECS, defaultPredicateResolver);
    // depois do 2º pass: dano resolvido, Burst recusado por padrão, Battle End rodado -> combate fechado
    expect(next.combat).toBeNull();
    expect(next.players.B.shields.length).toBe(shieldsBefore - 1);
  });
});

describe("applyPlayerAction — finishTurn", () => {
  it("só o jogador ativo pode encerrar o próprio turno, e entra no Action Step da End Phase (Comprehensive Rules 7-6) em vez de avançar direto", () => {
    const state = freshGame();
    expect(() => applyPlayerAction(state, "B", { kind: "finishTurn" }, ALL_EFFECT_SPECS, defaultPredicateResolver)).toThrow(/jogador ativo/);

    const next = applyPlayerAction(state, "A", { kind: "finishTurn" }, ALL_EFFECT_SPECS, defaultPredicateResolver);
    // ainda não trocou de turno -- só entrou no Action Step da End Phase, prioridade começa pelo jogador em espera (B)
    expect(next.activePlayer).toBe("A");
    expect(next.phase).toBe("end");
    expect(next.endPhaseAction).toEqual({ passes: { A: false, B: false }, priority: "B" });
  });

  it("depois que os dois passam no Action Step da End Phase, o turno avança de verdade pra Main Phase do outro (bug reportado em teste: motor pulava esse passo)", () => {
    const state = freshGame();
    let next = applyPlayerAction(state, "A", { kind: "finishTurn" }, ALL_EFFECT_SPECS, defaultPredicateResolver);

    next = applyPlayerAction(next, "B", { kind: "passEndPhaseAction" }, ALL_EFFECT_SPECS, defaultPredicateResolver);
    expect(next.endPhaseAction).not.toBeNull(); // ainda falta A passar
    expect(next.activePlayer).toBe("A"); // ainda não avançou

    next = applyPlayerAction(next, "A", { kind: "passEndPhaseAction" }, ALL_EFFECT_SPECS, defaultPredicateResolver);
    expect(next.endPhaseAction).toBeNull();
    expect(next.activePlayer).toBe("B");
    expect(next.phase).toBe("main");
  });
});
