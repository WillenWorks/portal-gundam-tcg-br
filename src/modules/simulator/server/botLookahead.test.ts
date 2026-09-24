import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { advanceToMainPhase } from "../engine/phases";
import { applyPlayerAction } from "../engine/actions";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "../engine/types";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { buildSt05DeckList, ST05_CARD_DEFS } from "../fixtures/st05Deck";
import { driveBotTurn } from "../../../../services/sim-bot/driveBotTurn.mjs";

/**
 * Bot real (driveBotTurn + specs reais) no Action Step do próprio ataque:
 * ST05-013 With Iron and Blood ("Choose 1 of your Units. Deal 1 damage to it.
 * It gets AP+3 during this turn.") transforma um ataque perdido numa troca.
 * Antes do lookahead o bot só jogava Comando com alvo em Unit INIMIGA.
 */

let seq = 0;
function put(state: GameState, player: PlayerId, zone: Zone, def: CardDef, rested = false): CardInstance {
  const card: CardInstance = {
    instanceId: `${player}-blfx-${seq++}`,
    def,
    owner: player,
    zone,
    rested,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber - 1,
  };
  state.players[player][zone].push(card);
  return card;
}

const unit = (code: string, ap: number, hp: number): CardDef => ({ code, nameEn: code, cardType: "UNIT", color: "purple", level: 1, cost: 1, ap, hp });
const apply = (s: GameState, seat: PlayerId, a: Parameters<typeof applyPlayerAction>[2]) =>
  applyPlayerAction(s, seat, a, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);

describe("driveBotTurn — lookahead de efeitos com cartas reais", () => {
  it("bot normal joga ST05-013 no próprio atacante no Action Step (efeito em aliado)", async () => {
    let state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt05DeckList(), { seed: 21, firstPlayer: "B" }));
    for (const id of ["A", "B"] as const) {
      state.players[id].hand = [];
      state.players[id].battleArea = [];
    }
    state.players.B.resourceArea = [];
    for (let i = 0; i < 3; i++) put(state, "B", "resourceArea", ST05_CARD_DEFS.RESOURCE);
    const attacker = put(state, "B", "battleArea", unit("BL-ATK", 3, 3));
    const defender = put(state, "A", "battleArea", unit("BL-DEF", 4, 4), true);
    const iron = put(state, "B", "hand", ST05_CARD_DEFS.WITH_IRON_AND_BLOOD);

    state = apply(state, "B", { kind: "declareAttack", attackerId: attacker.instanceId, target: { unitId: defender.instanceId } });
    if (state.combat?.step === "block") state = apply(state, "A", { kind: "skipBlock" });
    if (state.combat?.step === "action" && state.combat.actionPriority === "A") state = apply(state, "A", { kind: "passAction" });
    expect(state.combat?.actionPriority).toBe("B");

    const commits: Array<{ kind: string; cardInstanceId?: string; targets?: { target?: string[] } }> = [];
    let local = state;
    await driveBotTurn({
      initialState: state,
      seat: "B",
      level: "normal",
      seed: 5,
      maxActions: 3,
      commit: (action: unknown) => {
        commits.push(action as never);
        local = apply(local, "B", action as never);
        return local;
      },
    });

    expect(commits[0]).toMatchObject({ kind: "playCommand", cardInstanceId: iron.instanceId, targets: { target: [attacker.instanceId] } });
  }, 60_000);
});
