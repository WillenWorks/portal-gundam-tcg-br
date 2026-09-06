import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { findCard } from "./events";
import { ALL_EFFECT_SPECS, defaultPredicateResolver } from "../content";

/**
 * docs/19, Sessão 4 — teste de ponta a ponta pela MESMA borda que o
 * servidor usa (`applyPlayerAction`), não pelas funções internas do motor.
 * Joga uma partida de vários turnos até um `GAME_OVER` real, exercitando no
 * caminho: pausa autoritativa de 【Burst】 + `resolveBurstDecision`,
 * `activateAbility` (【Activate·Main】 de White Base) e o encerramento de
 * turno via Action Step da End Phase. Complementa `st01VsSt02Match.test.ts`
 * (cobertura de EffectSpec no nível do motor) e `pendingDecision.test.ts`
 * (decisões isoladas).
 */

const SPECS = ALL_EFFECT_SPECS;
const R = defaultPredicateResolver;

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-e2e-${seq++}`;
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
    place(state, player, { code: "E2E-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
  }
}

function act(state: GameState, p: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, p, action, SPECS, R);
}

/** Encerra o turno de `active` passando o Action Step da End Phase pelos dois lados. */
function endTurn(state: GameState, active: PlayerId): GameState {
  const standby: PlayerId = active === "A" ? "B" : "A";
  let next = act(state, active, { kind: "finishTurn" });
  if (next.gameOver) return next;
  next = act(next, standby, { kind: "passEndPhaseAction" });
  if (next.endPhaseAction) next = act(next, active, { kind: "passEndPhaseAction" });
  return next;
}

describe("partida ST01 x ST01 pela borda `applyPlayerAction` (docs/19, Sessão 4)", () => {
  it("joga vários turnos até GAME_OVER, passando por Burst pausado, activateAbility e fim de turno", () => {
    let state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 3, firstPlayer: "A" }));

    // B vai deckar: encolhe o deck pra 2 cartas (B compra no próprio turno).
    state.players.B.deck = state.players.B.deck.slice(0, 2);

    // -- Turno 1 (A): joga um GM da mão pela ação real. --
    giveResources(state, "A", 6);
    const gmId = place(state, "A", ST01_CARD_DEFS.GM, "hand", { enteredZoneOnTurn: state.turnNumber });
    state = act(state, "A", { kind: "deployCard", cardInstanceId: gmId });
    expect(findCard(state, gmId).zone).toBe("battleArea");
    state = endTurn(state, "A");
    expect(state.activePlayer).toBe("B");
    expect(state.turnNumber).toBe(2);

    // -- Turno 2 (B): só encerra (deck 2 -> 1 na compra). --
    state = endTurn(state, "B");
    expect(state.turnNumber).toBe(3);
    expect(state.players.B.deck).toHaveLength(1);

    // -- Turno 3 (A): ataca o jogador B (1 shield = Amuro Ray, Burst). --
    state.players.B.baseSection = [];
    state.players.B.shields = [];
    const amuroShieldId = place(state, "B", ST01_CARD_DEFS.AMURO_RAY, "shields");
    // o GM já está estabelecido (foi jogado no turno 1)
    let s = act(state, "A", { kind: "declareAttack", attackerId: gmId, target: "player" });
    s = act(s, "B", { kind: "skipBlock" });
    s = act(s, "B", { kind: "passAction" });
    s = act(s, "A", { kind: "passAction" });

    // PAUSA autoritativa de Burst — combate parado no Damage Step, decisão do defensor.
    expect(s.combat?.step).toBe("damage");
    expect(s.pendingDecision.B).toMatchObject({ kind: "burst", cardInstanceId: amuroShieldId });
    expect(() => act(s, "A", { kind: "passAction" })).toThrow(/Aguardando o oponente/);

    s = act(s, "B", { kind: "resolveBurstDecision", activate: true });
    expect(findCard(s, amuroShieldId).zone).toBe("hand"); // AMURO_RAY_BURST: self -> hand
    expect(s.combat).toBeNull();
    expect(s.pendingDecision.B).toBeNull();
    state = s;

    // -- ainda no Turno 3 (A): joga White Base e ativa o 【Activate·Main】 ②. --
    giveResources(state, "A", 4);
    const whiteBaseId = place(state, "A", ST01_CARD_DEFS.WHITE_BASE, "hand", { enteredZoneOnTurn: state.turnNumber });
    state = act(state, "A", { kind: "deployCard", cardInstanceId: whiteBaseId, targets: { shield: [state.players.A.shields[0].instanceId] } });
    expect(findCard(state, whiteBaseId).zone).toBe("baseSection");

    const tokensBefore = state.players.A.battleArea.filter((c) => c.def.isToken).length;
    state = act(state, "A", { kind: "activateAbility", sourceInstanceId: whiteBaseId });
    expect(state.players.A.battleArea.filter((c) => c.def.isToken).length).toBe(tokensBefore + 1);

    state = endTurn(state, "A");
    expect(state.turnNumber).toBe(4);

    // -- Turno 4 (B): deck 1 -> 0 na compra. --
    state = endTurn(state, "B");
    expect(state.turnNumber).toBe(5);
    expect(state.players.B.deck).toHaveLength(0);

    // -- Turno 5 (A): encerra -> Turno 6 (B) tenta comprar com deck vazio -> GAME_OVER. --
    state = endTurn(state, "A");
    expect(state.gameOver).toEqual({ winner: "A", reason: "deckOut" });

    // depois do fim de jogo, nenhuma ação avança mais nada.
    expect(() => act(state, "A", { kind: "finishTurn" })).toThrow();
  });
});
