import { describe, expect, it } from "vitest";
import { createGame } from "../setup";
import { viewStateFor } from "../viewState";
import { actionOwner, enumerateLegalActions } from "../legalActions";
import { applyPlayerAction } from "../actions";
import { createRng } from "../rng";
import { buildSt01DeckList } from "../../fixtures/st01Deck";
import { buildSt02DeckList } from "../../fixtures/st02Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../../content/index";
import { ACTION_SPACE, FEATURE_SIZE, decodeActionIndex, encodeAction, extractFeatures, legalActionMask } from "./features";

const SPECS = ALL_EFFECT_SPECS;
const RESOLVERS = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };

function freshGame() {
  return createGame(buildSt01DeckList(), buildSt02DeckList(), {
    seed: 7,
    firstPlayer: "A",
    interactiveMulligan: true,
  });
}

function legalFor(state: ReturnType<typeof freshGame>, owner: "A" | "B") {
  return enumerateLegalActions(state, owner, SPECS, RESOLVERS);
}

function apply(state: ReturnType<typeof freshGame>, owner: "A" | "B", action: Parameters<typeof applyPlayerAction>[2]) {
  return applyPlayerAction(state, owner, action, SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}

/** Avança o jogo `steps` ações usando a 1ª ação legal — determinístico. */
function advance(steps: number) {
  let state = freshGame();
  for (let i = 0; i < steps && !state.gameOver; i++) {
    const owner = actionOwner(state);
    if (!owner) break;
    const legal = legalFor(state, owner);
    if (legal.length === 0) break;
    state = apply(state, owner, legal[0]);
  }
  return state;
}

describe("extractFeatures", () => {
  it("é determinística — mesmo view 2x produz o mesmo vetor", () => {
    const state = advance(12);
    const owner = actionOwner(state) ?? "A";
    const view = viewStateFor(state, owner);
    const a = extractFeatures(view, owner);
    const b = extractFeatures(view, owner);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("tem tamanho fixo FEATURE_SIZE em qualquer ponto do jogo", () => {
    for (const steps of [0, 1, 5, 12, 25, 40]) {
      const state = advance(steps);
      for (const seat of ["A", "B"] as const) {
        expect(extractFeatures(viewStateFor(state, seat), seat)).toHaveLength(FEATURE_SIZE);
      }
    }
  });

  it("muda quando o estado relevante muda", () => {
    const early = advance(2);
    const late = advance(30);
    const ownerEarly = actionOwner(early) ?? "A";
    const ownerLate = actionOwner(late) ?? "A";
    const fEarly = Array.from(extractFeatures(viewStateFor(early, ownerEarly), ownerEarly));
    const fLate = Array.from(extractFeatures(viewStateFor(late, ownerLate), ownerLate));
    expect(fEarly).not.toEqual(fLate);
  });

  it("todos os valores são finitos", () => {
    const state = advance(20);
    const view = viewStateFor(state, "A");
    for (const value of extractFeatures(view, "A")) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe("encodeAction / decodeActionIndex", () => {
  it("todo índice cai em [0, ACTION_SPACE)", () => {
    let state = freshGame();
    const rng = createRng(1);
    for (let i = 0; i < 60 && !state.gameOver; i++) {
      const owner = actionOwner(state);
      if (!owner) break;
      const legal = legalFor(state, owner);
      if (legal.length === 0) break;
      const view = viewStateFor(state, owner);
      for (const action of legal) {
        const idx = encodeAction(action, view);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(ACTION_SPACE);
        expect(Number.isInteger(idx)).toBe(true);
      }
      state = apply(state, owner, decodeActionIndex(encodeAction(legal[0], view), legal, view, rng) ?? legal[0]);
    }
  });

  it("decodeActionIndex devolve sempre uma ação de `legal` (ou null se o bucket está vazio)", () => {
    const state = advance(9);
    const owner = actionOwner(state) ?? "A";
    const legal = legalFor(state, owner);
    const view = viewStateFor(state, owner);
    const rng = createRng(42);
    for (const action of legal) {
      const decoded = decodeActionIndex(encodeAction(action, view), legal, view, rng);
      expect(decoded).not.toBeNull();
      expect(legal).toContainEqual(decoded);
    }
    // bucket sem nenhuma ação legal -> null
    const emptyBucket = [...Array(ACTION_SPACE).keys()].find((i) => !legal.some((a) => encodeAction(a, view) === i));
    if (emptyBucket !== undefined) {
      expect(decodeActionIndex(emptyBucket, legal, view, rng)).toBeNull();
    }
  });

  it("legalActionMask marca exatamente os buckets ocupados", () => {
    const state = advance(9);
    const owner = actionOwner(state) ?? "A";
    const legal = legalFor(state, owner);
    const view = viewStateFor(state, owner);
    const mask = legalActionMask(legal, view);
    expect(mask).toHaveLength(ACTION_SPACE);
    for (let i = 0; i < ACTION_SPACE; i++) {
      const occupied = legal.some((a) => encodeAction(a, view) === i);
      expect(mask[i]).toBe(occupied ? 1 : 0);
    }
  });
});
