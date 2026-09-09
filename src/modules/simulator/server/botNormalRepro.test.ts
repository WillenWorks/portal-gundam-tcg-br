import { describe, expect, it } from "vitest";
import {
  _resetAllMatchesForTests,
  applyAction,
  decisionOwner,
  getMatch,
} from "./matchStore";
import { createTrainingMatch, SIM_BOT_USER_ID } from "./trainingMatch";
import { driveBotTurn } from "../../../../services/sim-bot/driveBotTurn.mjs";

describe("Bot no Modo Normal (ST01 vs ST01) — Fluxo de Turno e Priorização de Recursos", () => {
  it("executa jogo de ST01 vs ST01 no modo normal: preserva EX Resource e não trava após lançar carta", async () => {
    _resetAllMatchesForTests();
    const HUMAN = { userId: "user-1", displayName: "Jogador Humano" };

    for (const testSeed of [1, 2, 3, 5, 42, 100, 777]) {
      _resetAllMatchesForTests();
      const { matchId: mId } = createTrainingMatch({
        deckId: "ST01",
        level: "normal",
        human: HUMAN,
        seed: testSeed,
      });

      const m = getMatch(mId)!;

      // 1. Ambos os assentos nascem com autoPassActionStep = true no modo treino
      expect(m.seats.A?.autoPassActionStep).toBe(true);
      expect(m.seats.B?.autoPassActionStep).toBe(true);

      // 2. Mulligan Humano A
      applyAction(mId, HUMAN.userId, { kind: "resolveMulligan", keep: true });

      // 3. Mulligan Bot B
      await driveBotTurn({
        initialState: m.state,
        seat: "B",
        level: "normal",
        seed: testSeed,
        commit: (act) => applyAction(mId, SIM_BOT_USER_ID, act as never),
      });

      // Partida deve estar no Turno 1 na Main Phase de A
      expect(m.state.turnNumber).toBe(1);
      expect(m.state.activePlayer).toBe("A");
      expect(m.state.phase).toBe("main");

      // 4. Humano A passa o Turno 1
      applyAction(mId, HUMAN.userId, { kind: "finishTurn" });

      // Com autoPassActionStep: true nos dois assentos e settleAutoPasses tratando bot,
      // a End Phase é liquidada automaticamente e avança direto pro Turno 2 (Bot B)!
      expect(m.state.turnNumber).toBe(2);
      expect(m.state.activePlayer).toBe("B");
      expect(m.state.phase).toBe("main");
      expect(decisionOwner(m.state)).toBe("B");

      // 5. Bot joga o Turno 2
      const botTurnActions: any[] = [];
      let iterations = 0;
      while (decisionOwner(m.state) === "B" && !m.state.gameOver && iterations < 15) {
        iterations++;
        const current = getMatch(mId)!;
        await driveBotTurn({
          initialState: current.state,
          seat: "B",
          level: "normal",
          seed: testSeed + iterations,
          commit: (act) => {
            botTurnActions.push(act);
            applyAction(mId, SIM_BOT_USER_ID, act as never);
          },
        });
      }

      // Validações do Turno 2 do Bot:
      // O bot deve ter jogado pelo menos uma carta e passado o turno com finishTurn
      expect(botTurnActions.some((a) => a.kind === "deployCard")).toBe(true);
      expect(botTurnActions.some((a) => a.kind === "finishTurn")).toBe(true);

      // Validação de Recursos:
      // O recurso comum ST01-RESOURCE DEVE ter sido gasto primeiro (rested: true).
      // Se apenas 1 recurso foi gasto (totalCost === 1), o TOKEN-EX-RESOURCE DEVE ser preservado na resourceArea (rested: false).
      const resourcesB = m.state.players.B.resourceArea;
      const exResource = resourcesB.find((r) => r.def.code === "TOKEN-EX-RESOURCE");
      const normalResource = resourcesB.find((r) => r.def.code === "ST01-RESOURCE");

      expect(normalResource).toBeDefined();
      expect(normalResource?.rested).toBe(true);

      const totalCost = m.state.players.B.battleArea.reduce((acc, u) => acc + (u.def.cost ?? 0), 0);
      if (totalCost === 1) {
        expect(exResource).toBeDefined();
        expect(exResource?.rested).toBe(false);
      } else if (totalCost >= 2) {
        // Para pagar custo >= 2, o EX Resource é removido do jogo como esperado
        expect(exResource).toBeUndefined();
      }

      // 6. Fluidez de turno sem travamento:
      // O finishTurn do bot deve ter avançado automaticamente pra Main Phase do Turno 3 (Humano A)
      expect(m.state.turnNumber).toBe(3);
      expect(m.state.activePlayer).toBe("A");
      expect(m.state.phase).toBe("main");
      expect(decisionOwner(m.state)).toBe("A");

      // 7. Humano A passa o Turno 3 e o jogo segue normalmente pro Turno 4 (Bot)
      applyAction(mId, HUMAN.userId, { kind: "finishTurn" });
      expect(m.state.turnNumber).toBe(4);
      expect(m.state.activePlayer).toBe("B");
      expect(m.state.phase).toBe("main");
    }
  });
});
