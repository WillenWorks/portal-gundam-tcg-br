import { describe, expect, it } from "vitest";
import type { CardInstance, GameEvent, GameState, Phase, Zone } from "../engine/types";
import { PLAYER_IDS } from "../engine/types";
import { createGame } from "../engine/setup";
import { applyPlayerAction } from "../engine/actions";
import { actionOwner, enumerateLegalActions } from "../engine/legalActions";
import { eventsSinceFor, isHiddenCard, viewStateFor, type ViewGameState } from "../engine/viewState";
import { createRng } from "../engine/rng";
import { DECK_BUILDERS, GOLDEN_PAIRS } from "../engine/__golden__/harness";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { planChoreography, type PendingAttack } from "./choreography";
import { revealBeat } from "./viewPatcher";

const opts = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };
const ZONES: Zone[] = ["deck", "resourceDeck", "shields", "resourceArea", "battleArea", "baseSection", "trash", "exile", "hand"];

function ids(view: ViewGameState): string[] {
  return PLAYER_IDS.flatMap((p) => ZONES.flatMap((z) => view.players[p][z].map((c) => c.instanceId)));
}

function card(view: ViewGameState, id: string): CardInstance | undefined {
  for (const p of PLAYER_IDS) for (const z of ZONES) {
    const c = view.players[p][z].find((x) => x.instanceId === id);
    if (c && !isHiddenCard(c)) return c as CardInstance;
  }
  return undefined;
}

/** partida ST01×ST02 já na Main Phase de A, com uma Unit de B em campo para levar dano */
function boardWithEnemyUnit(): { state: GameState; unitId: string } {
  let state = createGame(DECK_BUILDERS.ST01(), DECK_BUILDERS.ST02(), { seed: 3, firstPlayer: "A" });
  const unit = state.players.B.hand.find((c) => c.def.cardType === "UNIT");
  if (!unit) throw new Error("mão de B sem Unit");
  state = {
    ...state,
    players: {
      ...state.players,
      B: { ...state.players.B, hand: state.players.B.hand.filter((c) => c !== unit), battleArea: [{ ...unit, zone: "battleArea", damage: 0 }] },
    },
  };
  return { state, unitId: unit.instanceId };
}

describe("revealBeat — a mesa entre um tempo e outro", () => {
  it("dano e depois compra: depois do 1º tempo a Unit já mostra o dano e a mão ainda não; depois do 2º, a carta chega", () => {
    const { state: before, unitId } = boardWithEnemyUnit();
    const drawn = before.players.A.deck[0];
    const after: GameState = {
      ...before,
      players: {
        ...before.players,
        A: { ...before.players.A, deck: before.players.A.deck.slice(1), hand: [...before.players.A.hand, { ...drawn, zone: "hand" }] },
        B: { ...before.players.B, battleArea: before.players.B.battleArea.map((c) => ({ ...c, damage: 2 })) },
      },
    };
    const shown = viewStateFor(before, "A");
    const final = viewStateFor(after, "A");
    const damage: GameEvent = { type: "DAMAGE_UNIT", instanceId: unitId, amount: 2 };
    const step1 = revealBeat(shown, final, { kind: "effects", events: [damage] });
    expect(card(step1, unitId)?.damage).toBe(2);
    expect(step1.players.A.hand).toHaveLength(shown.players.A.hand.length);
    const step2 = revealBeat(step1, final, { kind: "draw", player: "A", instanceId: drawn.instanceId });
    expect(step2.players.A.hand.at(-1)?.instanceId).toBe(drawn.instanceId);
    expect(step2.players.A.counts.hand).toBe(shown.players.A.counts.hand + 1);
    expect(step2.players.A.counts.deck).toBe(shown.players.A.counts.deck - 1);
  });

  it("nunca mostra mais dano do que a Unit terminou com (proteção reduziu depois do evento)", () => {
    const { state: before, unitId } = boardWithEnemyUnit();
    const after: GameState = {
      ...before,
      players: { ...before.players, B: { ...before.players.B, battleArea: before.players.B.battleArea.map((c) => ({ ...c, damage: 1 })) } },
    };
    const step = revealBeat(viewStateFor(before, "A"), viewStateFor(after, "A"), { kind: "effects", events: [{ type: "DAMAGE_UNIT", instanceId: unitId, amount: 3 }] });
    expect(card(step, unitId)?.damage).toBe(1);
  });

  it("escudo quebrado sai do topo; a carta destruída sai do campo", () => {
    const { state: before, unitId } = boardWithEnemyUnit();
    const top = before.players.A.shields[0];
    const unit = before.players.B.battleArea[0];
    const after: GameState = {
      ...before,
      players: {
        ...before.players,
        A: { ...before.players.A, shields: before.players.A.shields.slice(1), trash: [{ ...top, zone: "trash" }] },
        B: { ...before.players.B, battleArea: [], trash: [{ ...unit, zone: "trash" }] },
      },
    };
    const shown = viewStateFor(before, "B");
    const final = viewStateFor(after, "B");
    const s1 = revealBeat(shown, final, { kind: "departure", ids: [], shieldsOf: "A", count: 1 });
    expect(s1.players.A.counts.shields).toBe(shown.players.A.counts.shields - 1);
    expect(s1.players.A.trash.map((c) => c.instanceId)).toEqual([top.instanceId]);
    const s2 = revealBeat(s1, final, { kind: "departure", ids: [unitId] });
    expect(s2.players.B.battleArea).toHaveLength(0);
    expect(s2.players.B.trash.map((c) => c.instanceId)).toEqual([unitId]);
  });

  it("partidas reais: mesa intermediária sem carta duplicada nem inventada, contagens certas, dano nunca negativo", () => {
    const erros: string[] = [];
    let tempos = 0;
    for (const pair of GOLDEN_PAIRS.slice(0, 10)) {
      let state: GameState = createGame(DECK_BUILDERS[pair.a](), DECK_BUILDERS[pair.b](), { seed: pair.seed, firstPlayer: "A", interactiveMulligan: true });
      const rng = createRng(pair.seed * 13);
      let pendingAttack: PendingAttack | null = null;
      for (let step = 0; step < 200 && !state.gameOver; step++) {
        const seat = actionOwner(state);
        if (!seat) break;
        const legal = enumerateLegalActions(state, seat, ALL_EFFECT_SPECS, opts);
        if (legal.length === 0) break;
        const prev = state;
        const phase: Phase = prev.phase;
        state = applyPlayerAction(state, seat, legal[Math.floor(rng() * legal.length)], ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
        let nextPending: PendingAttack | null = null;
        for (const viewer of PLAYER_IDS) {
          const events = eventsSinceFor(state, prev.eventLog.length, viewer) ?? [];
          const plan = planChoreography({ events, viewerSeat: viewer, pendingAttack, phase });
          nextPending = plan.pendingAttack;
          const final = viewStateFor(state, viewer);
          const known = new Set([...ids(viewStateFor(prev, viewer)), ...ids(final)]);
          let shown = viewStateFor(prev, viewer);
          for (const beat of plan.beats) {
            shown = revealBeat(shown, final, beat);
            tempos += 1;
            const all = ids(shown);
            const where = `${pair.key} passo ${step} ${viewer} ${beat.kind}`;
            if (new Set(all).size !== all.length) erros.push(`${where}: carta duplicada`);
            if (all.some((id) => !known.has(id))) erros.push(`${where}: carta inventada`);
            for (const p of PLAYER_IDS) for (const z of ZONES) {
              if (shown.players[p].counts[z] !== shown.players[p][z].length) erros.push(`${where}: contagem ${p}.${z}`);
            }
            for (const id of all) if ((card(shown, id)?.damage ?? 0) < 0) erros.push(`${where}: dano negativo`);
          }
        }
        pendingAttack = state.combat ? nextPending : null;
      }
    }
    expect(erros.slice(0, 10)).toEqual([]);
    expect(tempos).toBeGreaterThan(50);
  }, 120_000);
});
