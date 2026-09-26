import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { buildSt04DeckList } from "../fixtures/st04Deck";
import { VANILLA_CARD_DEFS } from "../fixtures/vanillaDeck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

/**
 * CR 2-8-2 / 11-1-2 / 11-3-1 — rules management: um card com HP é destruído quando o HP
 * restante chega a zero, na hora, mesmo que o HP tenha caído DEPOIS do dano (bônus
 * "during this turn" que expirou, bônus de Link que sumiu). O motor só checava no
 * momento do dano — a Unit ficava em campo com dano >= HP.
 */

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-rm-${seq++}`;
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

function apply(state: GameState, p: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, p, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}

/** passa o turno até o jogador ativo mudar (atravessando o Action Step da End Phase) */
function endTurn(state: GameState): GameState {
  let next = apply(state, state.activePlayer, { kind: "finishTurn" });
  for (let guard = 0; guard < 6 && next.endPhaseAction; guard++) {
    next = apply(next, next.endPhaseAction.priority, { kind: "passEndPhaseAction" });
  }
  return next;
}

const inPlay = (state: GameState, id: string) =>
  (["A", "B"] as PlayerId[]).some((p) => state.players[p].battleArea.some((c) => c.instanceId === id));

describe("rules management — dano >= HP depois que o HP cai", () => {
  it("Unit que sobreviveu só pelo HP+2 'during this turn' é destruída quando o bônus expira", () => {
    const state = advanceToMainPhase(createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 7, firstPlayer: "A" }));
    const def = VANILLA_CARD_DEFS.BREACH_01;
    const hp = def.hp ?? 0;
    const id = place(state, "A", def, "battleArea", {
      damage: hp,
      statModifiers: [{ stat: "hp", amount: 2, duration: "endOfTurn", appliedOnTurn: state.turnNumber }],
    });
    expect(inPlay(state, id)).toBe(true);
    const next = endTurn(state);
    expect(inPlay(next, id)).toBe(false);
    expect(next.players.A.trash.some((c) => c.instanceId === id)).toBe(true);
  });

  it("Unit com dano abaixo do HP continua em campo", () => {
    const state = advanceToMainPhase(createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 7, firstPlayer: "A" }));
    const def = VANILLA_CARD_DEFS.BREACH_01;
    const id = place(state, "A", def, "battleArea", { damage: Math.max(0, (def.hp ?? 1) - 1) });
    expect(inPlay(endTurn(state), id)).toBe(true);
  });
});

describe("rules management — 【Destroyed】 da Unit destruída", () => {
  it("dispara normalmente (Char's Zaku Ⅱ abre a decisão de revelar do topo)", async () => {
    const { ST03_CARD_DEFS } = await import("../fixtures/st03Deck");
    const state = advanceToMainPhase(createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 7, firstPlayer: "A" }));
    const def = ST03_CARD_DEFS.CHARS_ZAKU_II;
    const id = place(state, "B", def, "battleArea", {
      damage: def.hp ?? 0,
      statModifiers: [{ stat: "hp", amount: 1, duration: "endOfTurn", appliedOnTurn: state.turnNumber }],
    });
    const next = endTurn(state);
    expect(inPlay(next, id)).toBe(false);
    const pending = next.pendingDecision.B;
    expect(pending?.kind === "abilityResolution" && pending.trigger).toBe("Destroyed");
  });
});
