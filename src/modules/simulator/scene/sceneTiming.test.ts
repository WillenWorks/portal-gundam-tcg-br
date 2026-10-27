import { describe, expect, it } from "vitest";
import type { GameEvent, GameState, Phase } from "../engine/types";
import { PLAYER_IDS } from "../engine/types";
import { createGame } from "../engine/setup";
import { applyPlayerAction } from "../engine/actions";
import { actionOwner, enumerateLegalActions } from "../engine/legalActions";
import { eventsSinceFor } from "../engine/viewState";
import { createRng } from "../engine/rng";
import { DECK_BUILDERS, GOLDEN_PAIRS } from "../engine/__golden__/harness";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { planChoreography, type PendingAttack } from "./choreography";
import { SCENE_MS, beatBaseMs, beatsDurationMs, drawMs, sceneDurationMs, slowestPace, turnStartMs, type SceneInput, type ScenePace } from "./sceneTiming";
import { SCENE_LOCK_MAX_WAIT_MS, localSceneEnd, sceneLockWaitMs } from "./sceneLock";

const opts = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };
const scene = (events: GameEvent[], over: Partial<SceneInput> = {}) =>
  sceneDurationMs({
    events,
    pendingAttack: null,
    phase: "main",
    fromSetup: false,
    endsWithBurstDecision: false,
    endsWithDeployChoice: false,
    pace: "cinematic",
    ...over,
  }).durationMs;

const command: GameEvent = { type: "CARD_PLAYED", player: "A", instanceId: "c1", as: "command" };
const deployWithEffect: GameEvent[] = [
  { type: "CARD_PLAYED", player: "B", instanceId: "u1", as: "unit" },
  { type: "ABILITY_ACTIVATED", player: "B", instanceId: "u1", trigger: "Deploy" },
  { type: "DAMAGE_UNIT", instanceId: "a1", amount: 2 } as GameEvent,
];

describe("sceneDurationMs — quanto a cena dura na tela, igual para quem vê", () => {
  it("a cena dura o tempo da visão mais longa: a Command do A o oponente vê, o próprio A não vê de novo", () => {
    const forB = planChoreography({ events: [command], viewerSeat: "B", pendingAttack: null, phase: "main" }).beats;
    const forA = planChoreography({ events: [command], viewerSeat: "A", pendingAttack: null, phase: "main" }).beats;
    expect(forA).toEqual([]);
    expect(scene([command])).toBe(beatsDurationMs(forB, "cinematic") + SCENE_MS.margin);
  });

  it("ritmo rápido e a abertura não seguram ninguém", () => {
    expect(scene(deployWithEffect, { pace: "classic" })).toBe(0);
    expect(scene(deployWithEffect, { fromSetup: true })).toBe(0);
    expect(scene([])).toBe(0);
  });

  it("o Normal encurta os tempos de espera, o Cinemático é o mais longo", () => {
    const cinematic = scene(deployWithEffect);
    const normal = scene(deployWithEffect, { pace: "normal" });
    expect(normal).toBeGreaterThan(0);
    expect(normal).toBeLessThan(cinematic);
  });

  it("golpe de um combate aberto antes do lote entra na conta, antes do dano", () => {
    const pendingAttack: PendingAttack = { attackerId: "x1", target: "player", defendingPlayer: "A" };
    const events: GameEvent[] = [{ type: "DAMAGE_SHIELD", player: "A", count: 1 } as GameEvent, { type: "COMBAT_ENDED" }];
    const withAttack = sceneDurationMs({ events, pendingAttack, phase: "main", fromSetup: false, endsWithBurstDecision: false, endsWithDeployChoice: false, pace: "cinematic" });
    expect(withAttack.durationMs).toBeGreaterThanOrEqual(beatBaseMs({ kind: "strike", ...pendingAttack }));
    expect(withAttack.pendingAttack).toBeNull();
  });

  it("virada de turno soma os banners; revelação do 【Burst】 e o pouso antes do modal também", () => {
    const turn: GameEvent[] = [{ type: "TURN_CHANGE", turnNumber: 2, activePlayer: "B" }];
    // fim do turno anterior (1 ou 2 banners) + começo do novo: 5 banners, desvirar, comprar, pôr o recurso
    expect(scene(turn)).toBe(2 * SCENE_MS.banner + turnStartMs() + SCENE_MS.margin);
    expect(scene(turn, { phase: "end" })).toBe(SCENE_MS.banner + turnStartMs() + SCENE_MS.margin);
    expect(turnStartMs()).toBe(5 * SCENE_MS.banner + SCENE_MS.unrest + drawMs() + SCENE_MS.resource);
    const burst = SCENE_MS.burstReveal.fly + SCENE_MS.burstReveal.flip + SCENE_MS.burstReveal.hold;
    expect(scene(deployWithEffect, { endsWithBurstDecision: true }) - scene(deployWithEffect)).toBe(burst);
    expect(scene(deployWithEffect, { endsWithDeployChoice: true }) - scene(deployWithEffect)).toBe(SCENE_MS.modalHold);
  });

  it("partidas reais: nenhuma visão (com os eventos redigidos dela) toca mais tempo do que o servidor espera", () => {
    const erros: string[] = [];
    let lotes = 0;
    for (const pair of GOLDEN_PAIRS.slice(0, 8)) {
      let state: GameState = createGame(DECK_BUILDERS[pair.a](), DECK_BUILDERS[pair.b](), { seed: pair.seed, firstPlayer: "A", interactiveMulligan: true });
      const rng = createRng(pair.seed * 31);
      let cursor = state.eventLog.length;
      let pendingAttack: PendingAttack | null = null;
      let phase: Phase = state.phase;
      for (let step = 0; step < 220 && !state.gameOver; step++) {
        const seat = actionOwner(state);
        if (!seat) break;
        const legal = enumerateLegalActions(state, seat, ALL_EFFECT_SPECS, opts);
        if (legal.length === 0) break;
        state = applyPlayerAction(state, seat, legal[Math.floor(rng() * legal.length)], ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
        lotes += 1;
        const input = { events: state.eventLog.slice(cursor), pendingAttack, phase, fromSetup: false, endsWithBurstDecision: false, endsWithDeployChoice: false };
        for (const pace of ["cinematic", "normal"] as ScenePace[]) {
          const total = sceneDurationMs({ ...input, pace }).durationMs;
          for (const viewer of PLAYER_IDS) {
            const events = eventsSinceFor(state, cursor, viewer) ?? [];
            const beats = planChoreography({ events, viewerSeat: viewer, pendingAttack, phase }).beats;
            const ms = beatsDurationMs(beats, pace);
            if (ms > total) erros.push(`${pair.key} passo ${step} ${viewer} ${pace}: tela ${ms} > servidor ${total}`);
          }
        }
        pendingAttack = sceneDurationMs({ ...input, pace: "cinematic" }).pendingAttack;
        cursor = state.eventLog.length;
        phase = state.phase;
      }
    }
    expect(erros).toEqual([]);
    expect(lotes).toBeGreaterThan(200);
  }, 120_000);
});

describe("slowestPace — ninguém tem a cena cortada pela pressa do outro", () => {
  it("vale o mais lento; sem escolha é o cinemático", () => {
    expect(slowestPace(["classic", "normal"])).toBe("normal");
    expect(slowestPace(["classic", undefined])).toBe("cinematic");
    expect(slowestPace(["classic"])).toBe("classic");
    expect(slowestPace([])).toBe("cinematic");
  });
});

describe("sceneLock — a mesa espera o fim da cena, com teto", () => {
  it("converte para o relógio local e nunca prende além do teto", () => {
    const now = 1_000_000;
    expect(localSceneEnd(now + 3000, 1000, now)).toBe(now + 2000);
    expect(localSceneEnd(now + 999_999, 0, now)).toBe(now + SCENE_LOCK_MAX_WAIT_MS);
    expect(localSceneEnd(null, 0, now)).toBeNull();
    expect(sceneLockWaitMs(now + 500, now)).toBe(500);
    expect(sceneLockWaitMs(now - 500, now)).toBe(0);
    expect(sceneLockWaitMs(null, now)).toBe(0);
  });
});
