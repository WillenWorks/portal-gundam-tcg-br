import { describe, expect, it } from "vitest";
import {
  _resetAllMatchesForTests,
  applyAction,
  decisionOwner,
  getMatch,
} from "./matchStore";
import { createTrainingMatch, SIM_BOT_USER_ID } from "./trainingMatch";
import { driveBotTurn } from "../../../../services/sim-bot/driveBotTurn.mjs";

describe("Bot no Modo Normal com Todos os Starters (ST01, ST02, ST03, ST04)", () => {
  const HUMAN = { userId: "user-1", displayName: "Jogador Humano" };

  const STARTER_CONFIGS = [
    { name: "ST02 vs ST02 (Ruination Ablaze)", playerDeck: "ST02", botDeck: "ST02", resourceCode: "ST02-RESOURCE" },
    { name: "ST03 vs ST03 (Zeon's Fangs)", playerDeck: "ST03", botDeck: "ST03", resourceCode: "ST03-RESOURCE" },
    { name: "ST04 vs ST04 (Aile of Justice)", playerDeck: "ST04", botDeck: "ST04", resourceCode: "ST04-RESOURCE" },
    { name: "ST01 vs ST02 (Cruzado: Heroic x Ruination)", playerDeck: "ST01", botDeck: "ST02", resourceCode: "ST02-RESOURCE" },
    { name: "ST03 vs ST04 (Cruzado: Zeon x Justice)", playerDeck: "ST03", botDeck: "ST04", resourceCode: "ST04-RESOURCE" },
    { name: "ST04 vs ST01 (Cruzado: Justice x Heroic)", playerDeck: "ST04", botDeck: "ST01", resourceCode: "ST01-RESOURCE" },
  ];

  for (const cfg of STARTER_CONFIGS) {
    it(`executa partida com ${cfg.name}: prioriza recurso normal, passa turno e não trava`, async () => {
      _resetAllMatchesForTests();
      const seed = 42;

      const { matchId: mId } = createTrainingMatch({
        playerDeckId: cfg.playerDeck,
        botDeckId: cfg.botDeck,
        level: "normal",
        human: HUMAN,
        seed,
      });

      const m = getMatch(mId)!;
      expect(m.deckKeys).toEqual({ A: cfg.playerDeck, B: cfg.botDeck });
      expect(m.seats.A?.autoPassActionStep).toBe(true);
      expect(m.seats.B?.autoPassActionStep).toBe(true);

      // 1. Mulligan Humano
      applyAction(mId, HUMAN.userId, { kind: "resolveMulligan", keep: true });

      // 2. Mulligan Bot
      await driveBotTurn({
        initialState: m.state,
        seat: "B",
        level: "normal",
        seed,
        commit: (act) => applyAction(mId, SIM_BOT_USER_ID, act as never),
      });

      // Turno 1 (Humano)
      expect(m.state.turnNumber).toBe(1);
      expect(m.state.activePlayer).toBe("A");
      expect(m.state.phase).toBe("main");

      // 3. Humano passa Turno 1
      applyAction(mId, HUMAN.userId, { kind: "finishTurn" });

      // Auto-pass liquida End Phase e transiciona direto pro Turno 2 (Bot)
      expect(m.state.turnNumber).toBe(2);
      expect(m.state.activePlayer).toBe("B");
      expect(m.state.phase).toBe("main");
      expect(decisionOwner(m.state)).toBe("B");

      // 4. Execução do Turno 2 pelo Bot
      const botTurnActions: any[] = [];
      let iterations = 0;
      while (decisionOwner(m.state) === "B" && !m.state.gameOver && iterations < 15) {
        iterations++;
        const current = getMatch(mId)!;
        await driveBotTurn({
          initialState: current.state,
          seat: "B",
          level: "normal",
          seed: seed + iterations,
          commit: (act) => {
            botTurnActions.push(act);
            applyAction(mId, SIM_BOT_USER_ID, act as never);
          },
        });
      }

      // O bot deve jogar unidades/ações e encerrar o turno com finishTurn
      expect(botTurnActions.some((a) => a.kind === "deployCard" || a.kind === "resolveAbility")).toBe(true);
      expect(botTurnActions.some((a) => a.kind === "finishTurn")).toBe(true);

      // 5. Verificação da Priorização de Recursos
      // O recurso comum do deck do bot (ex: ST02-RESOURCE) DEVE ter sido gasto primeiro
      const resourcesB = m.state.players.B.resourceArea;
      const normalResource = resourcesB.find((r) => r.def.code === cfg.resourceCode);
      const exResource = resourcesB.find((r) => r.def.code === "TOKEN-EX-RESOURCE");

      expect(normalResource).toBeDefined();
      expect(normalResource?.rested).toBe(true);

      const totalCost = m.state.players.B.battleArea.reduce((acc, u) => acc + (u.def.cost ?? 0), 0);
      if (totalCost === 1) {
        expect(exResource).toBeDefined();
        expect(exResource?.rested).toBe(false);
      } else if (totalCost >= 2) {
        expect(exResource).toBeUndefined();
      }

      // 6. Transição automática fluida para o Turno 3 (Humano)
      expect(m.state.turnNumber).toBe(3);
      expect(m.state.activePlayer).toBe("A");
      expect(m.state.phase).toBe("main");
      expect(decisionOwner(m.state)).toBe("A");

      // 7. Humano passa e turno volta para o bot no Turno 4
      applyAction(mId, HUMAN.userId, { kind: "finishTurn" });
      if (decisionOwner(m.state) === "A" && m.state.phase === "end") {
        applyAction(mId, HUMAN.userId, { kind: "passEndPhaseAction" });
      }
      expect(m.state.turnNumber).toBe(4);
      expect(m.state.activePlayer).toBe("B");
    });
  }
});
