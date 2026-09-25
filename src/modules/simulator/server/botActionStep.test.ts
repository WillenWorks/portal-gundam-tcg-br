import { afterEach, describe, expect, it } from "vitest";
import { _resetAllMatchesForTests, applyAction, decisionOwner, getMatch } from "./matchStore";
import { createTrainingMatch, SIM_BOT_USER_ID } from "./trainingMatch";
import { driveBotTurn } from "../../../../services/sim-bot/driveBotTurn.mjs";
import { ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { ST03_CARD_DEFS } from "../fixtures/st03Deck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "../engine/types";

/**
 * O bot é um jogador como outro qualquer no Action Step: o servidor só passa
 * por ele automaticamente quando ele NÃO tem jogada 【Action】 (mesma regra do
 * auto-pass humano). Antes, `settleAutoPasses` passava pelo bot SEMPRE — ele
 * nunca usava Comando 【Action】 nem 【Activate·Action】.
 */

afterEach(() => {
  _resetAllMatchesForTests();
});

const HUMAN = { userId: "human-1", displayName: "Willen" };
let seq = 0;

function put(state: GameState, player: PlayerId, zone: Zone, def: CardDef): CardInstance {
  const card: CardInstance = {
    instanceId: `${player}-botact-${seq++}`,
    def,
    owner: player,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber - 1,
  };
  state.players[player][zone].push(card);
  return card;
}

async function startAtHumanMain(seed: number): Promise<string> {
  const { matchId } = createTrainingMatch({ deckId: "ST01", level: "normal", human: HUMAN, seed, firstPlayer: "A" });
  applyAction(matchId, HUMAN.userId, { kind: "resolveMulligan", keep: true });
  await driveBotTurn({
    initialState: getMatch(matchId)!.state,
    seat: "B",
    level: "normal",
    seed,
    commit: (act) => applyAction(matchId, SIM_BOT_USER_ID, act as never),
  });
  const state = getMatch(matchId)!.state;
  expect(state.activePlayer).toBe("A");
  expect(state.phase).toBe("main");
  return matchId;
}

function clearHands(state: GameState): void {
  state.players.B.hand = [];
  state.players.B.resourceArea = [];
}

describe("Bot no Action Step da End Phase", () => {
  it("sem jogada 【Action】: servidor passa pelo bot e o turno vira na hora", async () => {
    const matchId = await startAtHumanMain(11);
    clearHands(getMatch(matchId)!.state);

    applyAction(matchId, HUMAN.userId, { kind: "finishTurn" });

    const state = getMatch(matchId)!.state;
    expect(state.turnNumber).toBe(2);
    expect(state.activePlayer).toBe("B");
  });

  it("com Comando 【Action】 pagável e alvo: bot recebe a prioridade e joga o Comando", async () => {
    const matchId = await startAtHumanMain(11);
    const state = getMatch(matchId)!.state;
    clearHands(state);
    put(state, "B", "hand", ST03_CARD_DEFS.CLOSE_COMBAT);
    put(state, "B", "resourceArea", { code: "ST03-RESOURCE", nameEn: "Resource", cardType: "RESOURCE", color: "red" });
    put(state, "B", "resourceArea", { code: "ST03-RESOURCE", nameEn: "Resource", cardType: "RESOURCE", color: "red" });
    const enemy = put(state, "A", "battleArea", ST01_CARD_DEFS.GM);

    applyAction(matchId, HUMAN.userId, { kind: "finishTurn" });

    const after = getMatch(matchId)!.state;
    expect(after.endPhaseAction?.priority).toBe("B");
    expect(decisionOwner(after)).toBe("B");

    const commits: Array<{ kind: string; targets?: { target?: string[] } }> = [];
    await driveBotTurn({
      initialState: after,
      seat: "B",
      level: "normal",
      seed: 3,
      commit: (act) => {
        commits.push(act as never);
        return applyAction(matchId, SIM_BOT_USER_ID, act as never).state;
      },
    });

    const played = commits.find((a) => a.kind === "playCommand");
    expect(played?.targets?.target).toEqual([enemy.instanceId]);
  });
});
