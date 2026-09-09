import { describe, expect, it } from "vitest";
import {
  _resetAllMatchesForTests,
  applyAction,
  decisionOwner,
  getMatch,
} from "./matchStore";
import { createTrainingMatch, SIM_BOT_USER_ID } from "./trainingMatch";
import { driveBotTurn } from "../../../../services/sim-bot/driveBotTurn.mjs";
import { ST03_CARD_DEFS } from "../fixtures/st03Deck";
import { VANILLA_CARD_DEFS } from "../fixtures/vanillaDeck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "../engine/types";

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-repro-${seq++}`;
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

describe("Resolução de gatilhos 【Destroyed】 pelo Bot (Char's Zaku II e similares)", () => {
  it("bot toma decisão para resolver o efeito de Destroyed de Char's Zaku II linkada e seleciona carta revelável", async () => {
    _resetAllMatchesForTests();
    const HUMAN = { userId: "user-1", displayName: "Jogador Humano" };

    const { matchId } = createTrainingMatch({
      playerDeckId: "ST01",
      botDeckId: "ST03",
      level: "normal",
      human: HUMAN,
      seed: 1234,
    });

    const m = getMatch(matchId)!;

    // 1. Resolve Mulligans
    applyAction(matchId, HUMAN.userId, { kind: "resolveMulligan", keep: true });
    await driveBotTurn({
      initialState: m.state,
      seat: "B",
      level: "normal",
      seed: 1234,
      commit: (act) => applyAction(matchId, SIM_BOT_USER_ID, act as never).state,
    });

    // 2. Coloca Char's Zaku II no bot linkado com Char Aznable
    const zakuId = place(m.state, "B", ST03_CARD_DEFS.CHARS_ZAKU_II, "battleArea", { rested: true });
    const pilotId = place(m.state, "B", ST03_CARD_DEFS.CHAR_AZNABLE, "battleArea");
    const zakuCard = m.state.players.B.battleArea.find((c) => c.instanceId === zakuId)!;
    const pilotCard = m.state.players.B.battleArea.find((c) => c.instanceId === pilotId)!;
    zakuCard.pairedPilotId = pilotId;
    pilotCard.pairedUnitId = zakuId;

    // 3. Humano ataca a unidade linkada com força suficiente para destruir
    const attackerId = place(m.state, "A", VANILLA_CARD_DEFS.HEAVY_01, "battleArea", {
      statModifiers: [{ stat: "ap", amount: 5, duration: "endOfTurn", appliedOnTurn: m.state.turnNumber }],
    });

    applyAction(matchId, HUMAN.userId, {
      kind: "declareAttack",
      attackerId,
      target: { unitId: zakuId },
    });

    expect(m.state.combat).toBeDefined();

    // 4. Bot joga durante o combate (Block step / Action step / resolução de gatilho Destroyed)
    const botActions: any[] = [];
    while (decisionOwner(m.state) === "B" && !m.state.gameOver) {
      await driveBotTurn({
        initialState: m.state,
        seat: "B",
        level: "normal",
        seed: 1234,
        commit: (act) => {
          botActions.push(act);
          const rec = applyAction(matchId, SIM_BOT_USER_ID, act as never);
          return rec.state;
        },
      });
    }

    // O bot deve ter feito skipBlock e depois respondido o gatilho de Destroyed
    expect(botActions.some((a) => a.kind === "skipBlock")).toBe(true);
    const resolveAct = botActions.find((a) => a.kind === "resolveAbility");
    expect(resolveAct).toBeDefined();
    expect(resolveAct.resolutions[0].specId).toBe("ST03-006-Destroyed");
    expect(resolveAct.resolutions[0].activate).toBe(true);
    // Verifica que o bot escolheu adicionar a carta revelada à mão em vez de descartar a vantagem
    expect(resolveAct.resolutions[0].targetIds.length).toBeGreaterThan(0);

    // O combate encerrou, pendingDecision de B foi limpo e o jogo não está travado
    expect(m.state.pendingDecision.B).toBeNull();
    expect(m.state.combat).toBeNull();
    expect(decisionOwner(m.state)).toBe("A");
  });
});
