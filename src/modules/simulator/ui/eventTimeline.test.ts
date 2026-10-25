import { describe, expect, it } from "vitest";
import { stepOf, timelineFromEvents, type AnimationStep } from "./eventTimeline";
import type { GameEvent, GameState, PlayerId } from "../engine/types";
import { PLAYER_IDS } from "../engine/types";
import { createGame } from "../engine/setup";
import { applyPlayerAction, type PlayerAction } from "../engine/actions";
import { actionOwner, enumerateLegalActions } from "../engine/legalActions";
import { eventsSinceFor } from "../engine/viewState";
import { createRng } from "../engine/rng";
import { DECK_BUILDERS, GOLDEN_PAIRS } from "../engine/__golden__/harness";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

const opts = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };

describe("timelineFromEvents — evento vira passo de animação", () => {
  it("mapeia as jogadas e os efeitos visíveis", () => {
    const events: GameEvent[] = [
      { type: "CARD_PLAYED", player: "A", instanceId: "u1", as: "unit" },
      { type: "REST_CARD", instanceId: "r1" },
      { type: "MOVE_CARD", instanceId: "u1", toZone: "battleArea" },
      { type: "ATTACK_DECLARED", attackerId: "u1", attackingPlayer: "A", defendingPlayer: "B", target: "player" },
      { type: "COMBAT_STEP_CHANGE", step: "block" },
      { type: "BLOCK_DECLARED", blockerId: "b1", newTarget: { unitId: "b1" } },
      { type: "DAMAGE_UNIT", instanceId: "b1", amount: 3 },
      { type: "DESTROY_CARD", instanceId: "b1" },
      { type: "COMBAT_ENDED" },
    ];
    expect(timelineFromEvents(events).map((s) => s.kind)).toEqual(["cardPlayed", "rest", "move", "attack", "block", "damage", "destroy", "combatEnd"]);
  });

  it("contabilidade do motor não anima; dano/cura/shield zerados também não", () => {
    expect(stepOf({ type: "ACTION_PASS", player: "A" })).toBeNull();
    expect(stepOf({ type: "MARK_KEYWORD_USED", instanceId: "x", keyword: "Blocker" })).toBeNull();
    expect(stepOf({ type: "DAMAGE_UNIT", instanceId: "x", amount: 0 })).toBeNull();
    expect(stepOf({ type: "DAMAGE_SHIELD", player: "B", count: 0 })).toBeNull();
    expect(stepOf({ type: "MOVE_WITHIN_DECK", instanceId: "x", position: "bottom" })).toBeNull();
  });

  it("efeito de stat vira cue de buff ou debuff pelo sinal", () => {
    const mod = (amount: number) =>
      stepOf({ type: "MODIFY_STAT", instanceId: "u", modifier: { stat: "ap", amount, duration: "thisTurn", sourceId: "s", turn: 1 } as never });
    expect(mod(2)).toEqual({ kind: "cue", instanceId: "u", cue: "buff" });
    expect(mod(-2)).toEqual({ kind: "cue", instanceId: "u", cue: "debuff" });
  });
});

/** o passo que cada jogada tem que produzir na timeline (`null` = jogada sem passo próprio: passes, decisões) */
function signatureOf(action: PlayerAction, seat: PlayerId): ((s: AnimationStep) => boolean) | null {
  switch (action.kind) {
    case "deployCard":
      return (s) => s.kind === "cardPlayed" && s.instanceId === action.cardInstanceId && s.player === seat;
    case "playCommand":
      return (s) => s.kind === "cardPlayed" && s.instanceId === action.cardInstanceId && s.as === "command";
    case "declareAttack":
      return (s) => s.kind === "attack" && s.attackerId === action.attackerId;
    case "activateBlocker":
      return (s) => s.kind === "block" && s.blockerId === action.blockerId;
    case "activateAbility":
      return (s) => s.kind === "abilityActivated" && s.instanceId === action.sourceInstanceId;
    case "resolveBurstDecision":
      return action.activate ? (s) => s.kind === "abilityActivated" && s.trigger === "Burst" : null;
    case "finishTurn":
      return null; // a virada pode esperar o Action Step da End Phase
    default:
      return null;
  }
}

describe("timeline em partidas reais — cada jogada aparece para os dois jogadores", () => {
  it("deploy, Command, ataque, bloqueio, ativação e Burst geram o passo, nos eventos redigidos de cada assento", () => {
    const faltando: string[] = [];
    let checked = 0;
    for (const pair of GOLDEN_PAIRS) {
      let state: GameState = createGame(DECK_BUILDERS[pair.a](), DECK_BUILDERS[pair.b](), { seed: pair.seed, firstPlayer: "A", interactiveMulligan: true });
      const rng = createRng(pair.seed * 31_337);
      for (let step = 0; step < 160 && !state.gameOver; step++) {
        const seat = actionOwner(state);
        if (!seat) break;
        const legal = enumerateLegalActions(state, seat, ALL_EFFECT_SPECS, opts);
        if (legal.length === 0) break;
        const action = legal[Math.floor(rng() * legal.length)];
        const from = state.eventLog.length;
        state = applyPlayerAction(state, seat, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
        const signature = signatureOf(action, seat);
        if (!signature) continue;
        for (const viewer of PLAYER_IDS) {
          checked++;
          const timeline = timelineFromEvents(eventsSinceFor(state, from, viewer) ?? []);
          if (!timeline.some(signature)) faltando.push(`${pair.key}#${step} ${seat} ${action.kind} (vista por ${viewer})`);
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
    expect(faltando.slice(0, 10)).toEqual([]);
  }, 180_000);
});
