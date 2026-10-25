import { describe, expect, it } from "vitest";
import { isRepeatedView, planAnimations, sequenceStatus, timelineFor, type PendingAttack, type PlannedAnimation } from "./timelinePlayback";
import { timelineFromEvents } from "./eventTimeline";
import type { GameEvent, GameState, PlayerId } from "../engine/types";
import { PLAYER_IDS } from "../engine/types";
import { createGame } from "../engine/setup";
import { applyPlayerAction } from "../engine/actions";
import { actionOwner, enumerateLegalActions } from "../engine/legalActions";
import { eventsSinceFor } from "../engine/viewState";
import { createRng } from "../engine/rng";
import { DECK_BUILDERS, GOLDEN_PAIRS } from "../engine/__golden__/harness";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

const opts = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };
const attack = (attackerId: string, defendingPlayer: PlayerId = "B"): GameEvent => ({
  type: "ATTACK_DECLARED",
  attackerId,
  attackingPlayer: defendingPlayer === "B" ? "A" : "B",
  defendingPlayer,
  target: "player",
});

describe("timelineFor / isRepeatedView — só anima visão que continua a última", () => {
  const events: GameEvent[] = [{ type: "COMBAT_ENDED" }];
  it("continua a sequência: devolve os passos", () => {
    expect(timelineFor({ eventsSince: events, eventsFromSeq: 10 }, 10)).toEqual([{ kind: "combatEnd" }]);
  });
  it("buraco, visão sem eventos ou 1ª visão: não anima pelo log", () => {
    expect(timelineFor({ eventsSince: events, eventsFromSeq: 10 }, 9)).toBeNull();
    expect(timelineFor({}, 10)).toBeNull();
    expect(timelineFor({ eventsSince: events, eventsFromSeq: 10 }, null)).toBeNull();
  });
  it("estado já aplicado (resposta do POST antes da transmissão) é repetido", () => {
    expect(isRepeatedView({ eventSeq: 12 }, 12)).toBe(true);
    expect(isRepeatedView({ eventSeq: 13 }, 12)).toBe(false);
    expect(isRepeatedView({}, 12)).toBe(false);
  });
});

describe("sequenceStatus — medir como as visões chegam (fase 4)", () => {
  const events: GameEvent[] = [{ type: "COMBAT_ENDED" }];
  it("classifica contínua, repetida, sem eventos e buraco", () => {
    expect(sequenceStatus({ eventSeq: 11, eventsSince: events, eventsFromSeq: 10 }, 10)).toBe("continuous");
    expect(sequenceStatus({ eventSeq: 10, eventsSince: events, eventsFromSeq: 9 }, 10)).toBe("repeated");
    expect(sequenceStatus({ eventSeq: 12 }, 10)).toBe("noEvents");
    expect(sequenceStatus({ eventSeq: 15, eventsSince: events, eventsFromSeq: 14 }, 10)).toBe("gap");
  });
});

describe("planAnimations — o que a tela toca, em ordem", () => {
  it("dois ataques no mesmo lote do bot: dois golpes, na ordem (antes só um aparecia)", () => {
    const steps = timelineFromEvents([attack("b1", "A"), { type: "COMBAT_ENDED" }, attack("b2", "A"), { type: "COMBAT_ENDED" }]);
    expect(planAnimations(steps, "A", null).plan.map((p) => (p.kind === "strike" ? p.attackerId : p.kind))).toEqual(["b1", "b2"]);
  });

  it("o golpe vai no alvo final: bloqueio e mudança de alvo", () => {
    const steps = timelineFromEvents([attack("x"), { type: "BLOCK_DECLARED", blockerId: "bl", newTarget: { unitId: "bl" } }, { type: "COMBAT_ENDED" }]);
    expect(planAnimations(steps, "A", null).plan).toEqual([{ kind: "strike", attackerId: "x", target: { unitId: "bl" }, defendingPlayer: "B" }]);
    const retarget = timelineFromEvents([attack("x"), { type: "ATTACK_TARGET_CHANGED", unitId: "u9" }, { type: "COMBAT_ENDED" }]);
    expect(planAnimations(retarget, "A", null).plan[0]).toMatchObject({ target: { unitId: "u9" } });
  });

  it("combate que continua na próxima visão fica pendente e o golpe sai quando ele termina", () => {
    const first = planAnimations(timelineFromEvents([attack("x")]), "B", null);
    expect(first.plan).toEqual([]);
    expect(first.pendingAttack).toMatchObject({ attackerId: "x" });
    const second = planAnimations(timelineFromEvents([{ type: "COMBAT_ENDED" }]), "B", first.pendingAttack);
    expect(second.plan).toEqual([{ kind: "strike", attackerId: "x", target: "player", defendingPlayer: "B" }]);
    expect(second.pendingAttack).toBeNull();
  });

  it("Command anima só a do oponente", () => {
    const steps = timelineFromEvents([
      { type: "CARD_PLAYED", player: "B", instanceId: "c1", as: "command", trigger: "Main" },
      { type: "CARD_PLAYED", player: "A", instanceId: "c2", as: "command", trigger: "Main" },
      { type: "CARD_PLAYED", player: "B", instanceId: "u1", as: "unit" },
    ]);
    expect(planAnimations(steps, "A", null).plan).toEqual([{ kind: "opponentCommand", instanceId: "c1" }]);
  });
});

describe("planAnimations — cartas saindo de jogo", () => {
  it("a Unit destruída no combate sai DEPOIS do golpe (no log a destruição vem antes do fim do combate)", () => {
    const steps = timelineFromEvents([
      attack("x"),
      { type: "BLOCK_DECLARED", blockerId: "bl", newTarget: { unitId: "bl" } },
      { type: "DAMAGE_UNIT", instanceId: "bl", amount: 3 },
      { type: "DESTROY_CARD", instanceId: "bl" },
      { type: "COMBAT_ENDED" },
    ]);
    expect(planAnimations(steps, "A", null).plan.map((p) => p.kind)).toEqual(["strike", "departure"]);
  });

  it("fora de combate a saída toca na hora; shield quebrada leva dono e quantidade", () => {
    const steps = timelineFromEvents([
      { type: "MOVE_CARD", instanceId: "c1", toZone: "trash" },
      { type: "MOVE_CARD", instanceId: "c2", toZone: "hand" },
      { type: "DISCARD_TO_HAND_LIMIT", player: "A", instanceIds: ["h1", "h2"] },
    ]);
    expect(planAnimations(steps, "A", null).plan).toEqual([
      { kind: "departure", ids: ["c1"] },
      { kind: "departure", ids: ["h1", "h2"] },
    ]);
    const shields = planAnimations(timelineFromEvents([attack("x"), { type: "DAMAGE_SHIELD", player: "B", count: 2 }, { type: "COMBAT_ENDED" }]), "A", null);
    expect(shields.plan).toEqual([
      { kind: "strike", attackerId: "x", target: "player", defendingPlayer: "B" },
      { kind: "departure", ids: [], shieldsOf: "B", count: 2 },
    ]);
  });

  it("combate que não termina no lote: as saídas dele ainda tocam neste lote (a visão final vem a seguir)", () => {
    const r = planAnimations(timelineFromEvents([attack("x"), { type: "DESTROY_CARD", instanceId: "v" }]), "A", null);
    expect(r.plan).toEqual([{ kind: "departure", ids: ["v"] }]);
    expect(r.pendingAttack).toMatchObject({ attackerId: "x" });
  });
});

describe("planAnimations em partidas reais, com lotes de várias jogadas (como o turno do bot)", () => {
  it("todo combate encerrado vira 1 golpe e toda Command do oponente vira 1 animação, com qualquer corte de lote", () => {
    const erros: string[] = [];
    for (const pair of GOLDEN_PAIRS.slice(0, 16)) {
      let state: GameState = createGame(DECK_BUILDERS[pair.a](), DECK_BUILDERS[pair.b](), { seed: pair.seed, firstPlayer: "A", interactiveMulligan: true });
      const rng = createRng(pair.seed * 7_777);
      const cuts: number[] = [state.eventLog.length];
      for (let step = 0; step < 220 && !state.gameOver; step++) {
        const seat = actionOwner(state);
        if (!seat) break;
        const legal = enumerateLegalActions(state, seat, ALL_EFFECT_SPECS, opts);
        if (legal.length === 0) break;
        state = applyPlayerAction(state, seat, legal[Math.floor(rng() * legal.length)], ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
        if (rng() < 0.3) cuts.push(state.eventLog.length); // lotes de tamanhos variados
      }
      cuts.push(state.eventLog.length);
      const log = state.eventLog;
      const combats = log.filter((e) => e.type === "COMBAT_ENDED").length;
      for (const viewer of PLAYER_IDS) {
        const plan: PlannedAnimation[] = [];
        let pending: PendingAttack | null = null;
        for (let i = 1; i < cuts.length; i++) {
          const r = planAnimations(timelineFromEvents(eventsSinceFor({ ...state, eventLog: log.slice(0, cuts[i]) }, cuts[i - 1], viewer) ?? []), viewer, pending);
          plan.push(...r.plan);
          pending = r.pendingAttack;
        }
        const commands = log.filter((e) => e.type === "CARD_PLAYED" && e.as === "command" && e.player !== viewer).length;
        const strikes = plan.filter((p) => p.kind === "strike").length;
        const cast = plan.filter((p) => p.kind === "opponentCommand").length;
        if (strikes !== combats || cast !== commands) erros.push(`${pair.key} ${viewer}: golpes ${strikes}/${combats}, Commands ${cast}/${commands}`);
      }
    }
    expect(erros).toEqual([]);
  }, 120_000);
});
