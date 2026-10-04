import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { enumerateLegalActions } from "./legalActions";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD05_CARD_DEFS } from "../content/gd05";

/**
 * W7a (C9) — escolha de modo, fluxo real: só ações de jogador. O motor pede o MODO (enum), depois o alvo
 * do modo escolhido, aplica o efeito e só então manda a Command pro trash (CR 3-4-4).
 */

const G = GD05_CARD_DEFS;

const UNIT = (extra: Partial<CardDef> = {}): CardDef => ({
  code: "TEST-UNIT",
  nameEn: "Test Unit",
  cardType: "UNIT",
  color: "white",
  level: 3,
  cost: 2,
  ap: 3,
  hp: 3,
  traits: [],
  ...extra,
});
const PILOT = (extra: Partial<CardDef> = {}): CardDef => ({
  code: "TEST-PILOT",
  nameEn: "Test Pilot",
  cardType: "PILOT",
  color: "white",
  level: 1,
  cost: 1,
  ap: 0,
  hp: 0,
  traits: [],
  ...extra,
});
const RESOURCE: CardDef = { code: "TEST-RES", nameEn: "Resource", cardType: "RESOURCE", color: "white", level: 0, cost: 0, ap: 0, hp: 0 };
const SHIELD = UNIT({ code: "TEST-SHIELD", nameEn: "Plain Shield" });

function game(): GameState {
  const state = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 88, firstPlayer: "A" }));
  for (const p of ["A", "B"] as const) {
    state.players[p].battleArea = [];
    state.players[p].baseSection = [];
    state.players[p].trash = [];
    state.players[p].shields = [];
    for (let i = 0; i < 3; i++) placeCard(state, p, SHIELD, "shields");
    resources(state, p, 8);
  }
  return state;
}
function resources(state: GameState, player: PlayerId, n: number): void {
  state.players[player].resourceArea = [];
  for (let i = 0; i < n; i++) placeCard(state, player, RESOURCE, "resourceArea");
}
function act(state: GameState, player: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, player, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}
const pending = (state: GameState, player: PlayerId) => {
  const d = state.pendingDecision[player];
  return d?.kind === "abilityResolution" ? d : null;
};
const entry = (state: GameState, player: PlayerId, specId: string) => pending(state, player)?.queue.find((q) => q.specId === specId);
const resolve = (state: GameState, player: PlayerId, specId: string, targetIds: string[]) =>
  act(state, player, { kind: "resolveAbility", resolutions: [{ specId, activate: true, targetIds }] });
const inZone = (state: GameState, player: PlayerId, zone: "battleArea" | "hand" | "trash" | "resourceArea", id: string) =>
  state.players[player][zone].some((c) => c.instanceId === id);

describe("GD05-106 Mutual Attraction — 【Main】 escolha de modo", () => {
  it("o motor pede o modo; ■1 coloca o topo do resource deck descansado e a Command vai pro trash", () => {
    let s = game();
    const cmd = placeCard(s, "A", G["GD05-106"], "hand");
    const topResource = s.players.A.resourceDeck[0].instanceId;
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main" });
    const modeEntry = entry(s, "A", "GD05-106-Main");
    expect(modeEntry?.enumChoice?.options.map((o) => o.value)).toEqual(["1", "2"]);
    expect(inZone(s, "A", "hand", cmd)).toBe(true);

    s = resolve(s, "A", "GD05-106-Main", ["1"]);
    expect(s.pendingDecision.A).toBeNull();
    expect(findCard(s, topResource).zone).toBe("resourceArea");
    expect(findCard(s, topResource).rested).toBe(true);
    expect(inZone(s, "A", "trash", cmd)).toBe(true);
  });

  it("■2 pede a carta do trash (só Pilot Lv.5+); a Command fica na mão até o modo resolver", () => {
    let s = game();
    const strong = placeCard(s, "A", PILOT({ code: "TEST-PILOT-5", level: 5 }), "trash");
    const weak = placeCard(s, "A", PILOT({ code: "TEST-PILOT-4", level: 4 }), "trash");
    const cmd = placeCard(s, "A", G["GD05-106"], "hand");
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main" });
    s = resolve(s, "A", "GD05-106-Main", ["2"]);

    const search = entry(s, "A", "GD05-106-Mode2")?.trashSearch;
    expect(search?.legalTrashIds).toEqual([strong]);
    expect(search?.legalTrashIds).not.toContain(weak);
    expect(inZone(s, "A", "hand", cmd)).toBe(true);

    s = resolve(s, "A", "GD05-106-Mode2", [strong]);
    expect(inZone(s, "A", "hand", strong)).toBe(true);
    expect(inZone(s, "A", "trash", cmd)).toBe(true);
    expect(s.pendingDecision.A).toBeNull();
  });

  it("o bot enxerga os 2 modos como ações legais da decisão", () => {
    let s = game();
    const cmd = placeCard(s, "A", G["GD05-106"], "hand");
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main" });
    const modes = enumerateLegalActions(s, "A", ALL_EFFECT_SPECS, { targetFilterResolver: defaultTargetFilterResolver })
      .filter((a) => a.kind === "resolveAbility")
      .map((a) => (a.kind === "resolveAbility" ? a.resolutions[0].targetIds : []));
    expect(modes).toEqual(expect.arrayContaining([["1"], ["2"]]));
  });
});

describe("GD05-102 Wings of Light — 【Action】 escolha de modo no Action Step", () => {
  /** A ataca a Unit `victim` do B; os dois chegam no Action Step com `A` na prioridade de jogar o 102 */
  function toActionStep(s: GameState, victim: string): GameState {
    const attacker = placeCard(s, "A", UNIT({ ap: 1, hp: 9 }), "battleArea");
    let next = act(s, "A", { kind: "declareAttack", attackerId: attacker, target: { unitId: victim } });
    next = act(next, "B", { kind: "skipBlock" });
    expect(next.combat?.step).toBe("action");
    if (next.combat!.actionPriority === "B") next = act(next, "B", { kind: "passAction" });
    expect(next.combat?.actionPriority).toBe("A");
    return next;
  }

  it("■1 só oferece Unit inimiga com HP restante ≤5 e devolve à mão do dono", () => {
    let s = game();
    const small = placeCard(s, "B", UNIT({ code: "TEST-SMALL", hp: 7 }), "battleArea", { rested: true, damage: 2 });
    const big = placeCard(s, "B", UNIT({ code: "TEST-BIG", hp: 6 }), "battleArea");
    const cmd = placeCard(s, "A", G["GD05-102"], "hand");
    s = toActionStep(s, small);
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Action" });
    s = resolve(s, "A", "GD05-102-Action", ["1"]);

    const mode = entry(s, "A", "GD05-102-Mode1");
    expect(mode?.legalTargets).toEqual([small]);
    expect(mode?.legalTargets).not.toContain(big);
    s = resolve(s, "A", "GD05-102-Mode1", [small]);
    expect(inZone(s, "B", "hand", small)).toBe(true);
    expect(inZone(s, "A", "trash", cmd)).toBe(true);
  });

  it("■2 recupera 3 de HP de qualquer Unit (inclusive a própria)", () => {
    let s = game();
    const victim = placeCard(s, "B", UNIT({ hp: 9 }), "battleArea", { rested: true });
    const hurt = placeCard(s, "A", UNIT({ code: "TEST-HURT", hp: 6 }), "battleArea", { damage: 4 });
    const cmd = placeCard(s, "A", G["GD05-102"], "hand");
    s = toActionStep(s, victim);
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Action" });
    s = resolve(s, "A", "GD05-102-Action", ["2"]);
    expect(entry(s, "A", "GD05-102-Mode2")?.legalTargets).toEqual(expect.arrayContaining([hurt, victim]));
    s = resolve(s, "A", "GD05-102-Mode2", [hurt]);
    expect(findCard(s, hurt).damage).toBe(1);
    expect(inZone(s, "A", "trash", cmd)).toBe(true);
  });

  it("modo inválido é recusado", () => {
    let s = game();
    const victim = placeCard(s, "B", UNIT(), "battleArea", { rested: true });
    const cmd = placeCard(s, "A", G["GD05-102"], "hand");
    s = toActionStep(s, victim);
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Action" });
    expect(() => resolve(s, "A", "GD05-102-Action", ["3"])).toThrow(/Escolha inválida/);
  });
});
