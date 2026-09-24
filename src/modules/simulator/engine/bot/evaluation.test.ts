import { describe, expect, it } from "vitest";
import { createGame } from "../setup";
import { advanceToMainPhase } from "../phases";
import { viewStateFor } from "../viewState";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "../types";
import { ALL_EFFECT_SPECS, validatedDeckList } from "../../content/index";
import { applyForEval, determinize, evaluatePosition, positionValue } from "./evaluation";

const decks = validatedDeckList();
const deckBuild = (id: string) => decks.find((d) => d.id === id)!.build;

function freshMain(): GameState {
  const state = createGame(deckBuild("ST01")(), deckBuild("ST02")(), { seed: 7, firstPlayer: "A" });
  return advanceToMainPhase(state);
}

let seq = 0;
function put(state: GameState, player: PlayerId, zone: Zone, def: CardDef): CardInstance {
  const card: CardInstance = {
    instanceId: `${player}-evalfx-${seq++}`,
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

const UNIT: CardDef = { code: "EVAL-UNIT", nameEn: "Eval Unit", cardType: "UNIT", color: "blue", level: 1, cost: 1, ap: 3, hp: 3 };

describe("evaluation — determinize", () => {
  it("mantém a mão do viewer e troca a mão do oponente por fillers (sem vazar)", () => {
    const state = freshMain();
    const view = viewStateFor(state, "A");
    const det = determinize(view);

    expect(det.players.A.hand.map((c) => c.instanceId)).toEqual(state.players.A.hand.map((c) => c.instanceId));
    expect(det.players.B.hand).toHaveLength(state.players.B.hand.length);
    const realOppCodes = new Set(state.players.B.hand.map((c) => c.def.code));
    expect(det.players.B.hand.every((c) => !realOppCodes.has(c.def.code))).toBe(true);
  });
});

describe("evaluation — positionValue", () => {
  it("lados simétricos → 0.5; Unit a mais do meu lado → > 0.5", () => {
    const state = freshMain();
    for (const id of ["A", "B"] as const) {
      state.players[id].battleArea = [];
      state.players[id].hand = [];
    }
    expect(positionValue(state, "A")).toBeCloseTo(0.5, 5);
    put(state, "A", "battleArea", UNIT);
    expect(positionValue(state, "A")).toBeGreaterThan(0.5);
    expect(positionValue(state, "B")).toBeLessThan(0.5);
  });
});

describe("evaluation — applyForEval", () => {
  it("ação ilegal no estado determinizado → null (não lança)", () => {
    const state = freshMain();
    const det = determinize(viewStateFor(state, "A"));
    const out = applyForEval({ kind: "playCommand", cardInstanceId: "inexistente", trigger: "Main" }, det, "A", {
      specs: ALL_EFFECT_SPECS,
    });
    expect(out).toBeNull();
  });
});

describe("evaluation — evaluatePosition (avaliação estendida)", () => {
  function emptyBoard(): GameState {
    const state = freshMain();
    for (const id of ["A", "B"] as const) {
      state.players[id].battleArea = [];
      state.players[id].hand = [];
      state.players[id].resourceArea = [];
    }
    return state;
  }
  const RESOURCE: CardDef = { code: "EVAL-RES", nameEn: "Res", cardType: "RESOURCE", color: "blue" };

  it("carta a mais na mão aumenta o valor", () => {
    const state = emptyBoard();
    const before = evaluatePosition(state, "A");
    put(state, "A", "hand", UNIT);
    expect(evaluatePosition(state, "A")).toBeGreaterThan(before);
  });

  it("recurso active x rested não muda o valor (desvira todo turno; custo de oportunidade é da policy)", () => {
    const state = emptyBoard();
    const res = put(state, "A", "resourceArea", RESOURCE);
    const active = evaluatePosition(state, "A");
    res.rested = true;
    expect(evaluatePosition(state, "A")).toBeCloseTo(active, 5);
  });

  it("pump 'durante este turno' só vale em Unit que ainda pode atacar", () => {
    const state = emptyBoard();
    expect(state.activePlayer).toBe("A");
    const unit = put(state, "A", "battleArea", UNIT);
    const base = evaluatePosition(state, "A");
    unit.statModifiers.push({ stat: "ap", amount: 2, duration: "endOfTurn", appliedOnTurn: state.turnNumber });
    const pumpedReady = evaluatePosition(state, "A");
    expect(pumpedReady).toBeGreaterThan(base);

    unit.rested = true; // já atacou
    const restedBase = evaluatePosition({ ...state, players: { ...state.players } }, "A");
    unit.statModifiers = [];
    expect(evaluatePosition(state, "A")).toBeCloseTo(restedBase, 5);
  });

  it("pump permanente vale mesmo em Unit rested (tabuleiro durável)", () => {
    const state = emptyBoard();
    const unit = put(state, "A", "battleArea", UNIT);
    unit.rested = true;
    const base = evaluatePosition(state, "A");
    unit.statModifiers.push({ stat: "hp", amount: 2, duration: "permanent", appliedOnTurn: state.turnNumber });
    expect(evaluatePosition(state, "A")).toBeGreaterThan(base);
  });

  it("dar rest num <Blocker> ativo do defensor melhora a posição do atacante", () => {
    const state = emptyBoard();
    expect(state.activePlayer).toBe("A");
    const blocker = put(state, "B", "battleArea", { ...UNIT, code: "EVAL-BLK", effectKeywords: ["Blocker"] });
    const noAttacker = evaluatePosition(state, "A");
    blocker.rested = true;
    expect(evaluatePosition(state, "A")).toBeCloseTo(noAttacker, 5); // sem atacante, bloqueador não "defende" nada
    blocker.rested = false;
    put(state, "A", "battleArea", UNIT);
    const withReadyBlocker = evaluatePosition(state, "A");
    blocker.rested = true;
    expect(evaluatePosition(state, "A")).toBeGreaterThan(withReadyBlocker);
  });

  it("é antissimétrica: valor pra A = −valor pra B", () => {
    const state = emptyBoard();
    put(state, "A", "battleArea", UNIT);
    put(state, "B", "hand", UNIT);
    expect(evaluatePosition(state, "A")).toBeCloseTo(-evaluatePosition(state, "B"), 5);
  });
});
