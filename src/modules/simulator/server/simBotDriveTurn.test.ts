import { afterEach, describe, expect, it } from "vitest";

import {
  _resetAllMatchesForTests,
  applyAction,
  decisionOwner,
  defaultActionFor,
  getMatch,
} from "./matchStore";
import { SIM_BOT_USER_ID, createTrainingMatch } from "./trainingMatch";
import { driveBotTurn } from "../../../../services/sim-bot/driveBotTurn.mjs";

afterEach(() => {
  _resetAllMatchesForTests();
});

const HUMAN = { userId: "human-1", displayName: "Willen" };

/** Aplica a ação-padrão pelo humano até a vez ser do bot (ou fim de jogo). */
function driveHumanUntilBotTurn(matchId: string): void {
  for (let i = 0; i < 80; i += 1) {
    const match = getMatch(matchId);
    if (!match || match.state.gameOver) return;
    if (decisionOwner(match.state) !== "A") return;
    applyAction(matchId, HUMAN.userId, defaultActionFor(match.state));
  }
}

describe("driveBotTurn — worker sim-bot", () => {
  it("processa o turno do bot aplicando cada ação pelo caminho autoritativo", async () => {
    const { matchId } = createTrainingMatch({ deckId: "ST01", level: "normal", human: HUMAN, seed: 42 });
    driveHumanUntilBotTurn(matchId);

    expect(getMatch(matchId)!.state.gameOver).toBeFalsy();
    expect(decisionOwner(getMatch(matchId)!.state)).toBe("B");

    const versionBefore = getMatch(matchId)!.version;
    const commits: unknown[] = [];

    const result = await driveBotTurn({
      initialState: getMatch(matchId)!.state,
      seat: "B",
      level: "normal",
      seed: 1,
      commit: async (action: unknown) => {
        commits.push(action);
        // caminho autoritativo: a MESMA função que a rota HTTP chama
        applyAction(matchId, SIM_BOT_USER_ID, action as never);
      },
    });

    expect(result.actionsApplied).toBeGreaterThanOrEqual(1);
    expect(commits).toHaveLength(result.actionsApplied);
    expect(result.done).toBe(true);

    // O estado autoritativo avançou de verdade e a vez saiu do bot.
    const after = getMatch(matchId)!;
    expect(after.version).toBe(versionBefore + result.actionsApplied);
    expect(after.state.gameOver ? "B" : decisionOwner(after.state)).not.toBe("B");
  });

  it("e2e leve: humano finishTurn -> worker joga o turno do bot -> estado avança sem erro", async () => {
    const { matchId } = createTrainingMatch({ deckId: "ST02", level: "facil", human: HUMAN, seed: 9 });

    // 1ª vez do bot: normalmente o mulligan.
    driveHumanUntilBotTurn(matchId);
    await driveBotTurn({
      initialState: getMatch(matchId)!.state,
      seat: "B",
      level: "facil",
      seed: 2,
      commit: async (action: unknown) => applyAction(matchId, SIM_BOT_USER_ID, action as never),
    });

    // Turno de verdade do bot, depois do 1º turno do humano.
    driveHumanUntilBotTurn(matchId);
    if (!getMatch(matchId)!.state.gameOver) {
      expect(decisionOwner(getMatch(matchId)!.state)).toBe("B");
      const turnBefore = getMatch(matchId)!.state.turnNumber;

      const result = await driveBotTurn({
        initialState: getMatch(matchId)!.state,
        seat: "B",
        level: "facil",
        seed: 3,
        commit: async (action: unknown) => applyAction(matchId, SIM_BOT_USER_ID, action as never),
      });

      expect(result.actionsApplied).toBeGreaterThanOrEqual(1);
      const after = getMatch(matchId)!.state;
      // avançou: ou o turno passou, ou o jogo acabou.
      expect(after.gameOver != null || after.turnNumber > turnBefore || decisionOwner(after) !== "B").toBe(true);
    }
  });
});
