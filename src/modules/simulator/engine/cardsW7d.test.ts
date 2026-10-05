import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { effectiveAp, effectiveCost, effectiveHp, effectiveLevel, hasKeyword } from "./types";
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
 * W7d — Neo Zeon "destruída por efeito seu" e Phantom Pain, fluxo real. Inclui a regressão do efeito concedido
 * do GD05-104 com destruição POR EFEITO (antes só funcionava em batalha).
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
  color: "red",
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
    state.players[p].hand = [];
    for (let i = 0; i < 3; i++) placeCard(state, p, SHIELD, "shields");
    state.players[p].resourceArea = [];
    for (let i = 0; i < 8; i++) placeCard(state, p, RESOURCE, "resourceArea");
  }
  return state;
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
const inZone = (state: GameState, player: PlayerId, zone: "battleArea" | "hand" | "trash", id: string) =>
  state.players[player][zone].some((c) => c.instanceId === id);
/** GD05-057 (Neo Zeon) destrói `victim` com o 【Activate･Main】 */
const gyuneiDestroys = (s: GameState, gyunei: string, victim: string) =>
  act(s, "A", { kind: "activateAbility", sourceInstanceId: gyunei, targets: { target: [victim] } });

describe("destruída por efeito seu (Neo Zeon)", () => {
  it("GD05-057 destrói outra Unit sua, fica ativa e não pode atacar o jogador neste turno", () => {
    let s = game();
    const gyunei = placeCard(s, "A", G["GD05-057"], "battleArea", { rested: true });
    const fodder = placeCard(s, "A", UNIT(), "battleArea");
    s = gyuneiDestroys(s, gyunei, fodder);
    expect(inZone(s, "A", "trash", fodder)).toBe(true);
    expect(findCard(s, gyunei).rested).toBe(false);
    expect(hasKeyword(findCard(s, gyunei), "CannotTargetPlayer", s)).toBe(true);
    expect(s.players.A.ownUnitDestroyedByOwnEffectOnTurn).toEqual({ turn: s.turnNumber, traits: ["Neo Zeon"] });
  });

  it("GD05-053 volta pra mão quando um efeito Neo Zeon SEU a destrói", () => {
    let s = game();
    const gyunei = placeCard(s, "A", G["GD05-057"], "battleArea");
    const quess = placeCard(s, "A", G["GD05-053"], "battleArea");
    s = gyuneiDestroys(s, gyunei, quess);
    expect(inZone(s, "A", "hand", quess)).toBe(true);
  });

  it("GD05-053 destruída em batalha fica no trash", () => {
    let s = game();
    const quess = placeCard(s, "A", G["GD05-053"], "battleArea");
    const wall = placeCard(s, "B", UNIT({ ap: 9, hp: 9 }), "battleArea", { rested: true });
    s = act(s, "A", { kind: "declareAttack", attackerId: quess, target: { unitId: wall } });
    for (let i = 0; i < 6 && s.combat; i++) {
      if (s.combat.step === "block") s = act(s, s.combat.defendingPlayer, { kind: "skipBlock" });
      else if (s.combat.step === "action") s = act(s, s.combat.actionPriority, { kind: "passAction" });
      else break;
    }
    expect(inZone(s, "A", "trash", quess)).toBe(true);
  });

  it("GD05-054: Unit sua destruída por efeito compra 1 (1×/turno)", () => {
    let s = game();
    placeCard(s, "A", G["GD05-054"], "battleArea");
    const gyunei = placeCard(s, "A", G["GD05-057"], "battleArea");
    const f1 = placeCard(s, "A", UNIT({ code: "TEST-F1" }), "battleArea");
    const hand = s.players.A.hand.length;
    s = gyuneiDestroys(s, gyunei, f1);
    expect(s.players.A.hand.length).toBe(hand + 1);
  });

  it("GD05-129 Axis: só depois de uma destruição Neo Zeon sua no turno, deploya Neo Zeon Lv.3- da mão", () => {
    let s = game();
    const axis = placeCard(s, "A", G["GD05-129"], "baseSection");
    const gyunei = placeCard(s, "A", G["GD05-057"], "battleArea");
    const fodder = placeCard(s, "A", UNIT(), "battleArea");
    const nz = placeCard(s, "A", UNIT({ code: "TEST-NZ3", traits: ["Neo Zeon"], level: 3 }), "hand");
    const nz5 = placeCard(s, "A", UNIT({ code: "TEST-NZ5", traits: ["Neo Zeon"], level: 5 }), "hand");

    const before = act(s, "A", { kind: "activateAbility", sourceInstanceId: axis });
    expect(before.pendingDecision.A).toBeNull();
    expect(inZone(before, "A", "hand", nz)).toBe(true);

    s = gyuneiDestroys(s, gyunei, fodder);
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: axis });
    const deploy = entry(s, "A", "GD05-129-ActivateMain");
    expect(deploy?.handChoice?.legalHandIds).toEqual([nz]);
    expect(deploy?.handChoice?.legalHandIds).not.toContain(nz5);
    s = resolve(s, "A", "GD05-129-ActivateMain", [nz]);
    expect(inZone(s, "A", "battleArea", nz)).toBe(true);
  });

  it("regressão W7: o 【Destroyed】 concedido pelo GD05-104 dispara com destruição POR EFEITO", () => {
    let s = game();
    const shrike = placeCard(s, "A", UNIT({ code: "TEST-SHRIKE", traits: ["Shrike Team"], link: { kind: "pilotName", values: ["Test Pilot"] } }), "battleArea");
    const pilot = placeCard(s, "A", PILOT(), "battleArea");
    findCard(s, shrike).pairedPilotId = pilot;
    findCard(s, pilot).pairedUnitId = shrike;
    const ally = placeCard(s, "A", UNIT({ code: "TEST-LM", traits: ["League Militaire"] }), "battleArea", { rested: true });
    const gyunei = placeCard(s, "A", G["GD05-057"], "battleArea");
    // o GD05-104 já foi jogado na Shrike neste turno (a Command está no trash e é a fonte do efeito concedido)
    const cmd = placeCard(s, "A", G["GD05-104"], "trash");
    s.players.A.delayedReactions = [{ specId: "GD05-104-Granted", sourceId: cmd, subjectId: shrike, turn: s.turnNumber }];

    s = gyuneiDestroys(s, gyunei, shrike);
    expect(entry(s, "A", "GD05-104-Granted")?.legalTargets).toContain(ally);
    s = resolve(s, "A", "GD05-104-Granted", [ally]);
    expect(findCard(s, ally).rested).toBe(false);
  });
});

describe("Phantom Pain / \"7+ cartas no trash do oponente\"", () => {
  const fillEnemyTrash = (s: GameState, n: number) => {
    for (let i = 0; i < n; i++) placeCard(s, "B", UNIT({ code: `TEST-T${i}` }), "trash");
  };

  it("GD05-037: na mão, Lv. -3 e custo -3 com 7+ no trash do oponente; 【During Link】 ganha <Breach 3>", () => {
    const s = game();
    const destroy = placeCard(s, "A", G["GD05-037"], "hand");
    const def = findCard(s, destroy).def;
    const [cost, level] = [effectiveCost(def, s, "A"), effectiveLevel(def, s, "A")];
    fillEnemyTrash(s, 7);
    expect(effectiveCost(def, s, "A")).toBe(cost - 3);
    expect(effectiveLevel(def, s, "A")).toBe(level - 3);
  });

  it("GD05-091 (Piloto): a Unit pareada ganha AP+1/HP+1 com 7+ no trash do oponente", () => {
    const s = game();
    const unit = placeCard(s, "A", UNIT(), "battleArea");
    const sting = placeCard(s, "A", G["GD05-091"], "battleArea");
    findCard(s, unit).pairedPilotId = sting;
    findCard(s, sting).pairedUnitId = unit;
    const [ap, hp] = [effectiveAp(findCard(s, unit), s), effectiveHp(findCard(s, unit), s)];
    fillEnemyTrash(s, 7);
    expect(effectiveAp(findCard(s, unit), s)).toBe(ap + 1);
    expect(effectiveHp(findCard(s, unit), s)).toBe(hp + 1);
  });

  it("GD05-127: Unit (Phantom Pain) linka → 1 Unit inimiga não ativa <Blocker> neste turno", () => {
    let s = game();
    placeCard(s, "A", G["GD05-127"], "baseSection");
    const pp = placeCard(s, "A", UNIT({ code: "TEST-PP", traits: ["Phantom Pain"], link: { kind: "pilotName", values: ["Test Pilot"] } }), "battleArea");
    const blocker = placeCard(s, "B", UNIT({ code: "TEST-BLOCKER", effectKeywords: ["Blocker"] }), "battleArea");
    const pilot = placeCard(s, "A", PILOT(), "hand");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: pilot, pairWithUnitId: pp });
    s = resolve(s, "A", "GD05-127-Reaction", [blocker]);
    expect(hasKeyword(findCard(s, blocker), "CannotActivateBlocker", s)).toBe(true);

    const attacker = placeCard(s, "A", UNIT({ code: "TEST-ATK" }), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: attacker, target: "player" });
    expect(s.combat?.step).toBe("block");
    const blocks = enumerateLegalActions(s, "B", ALL_EFFECT_SPECS).filter((a) => a.kind === "activateBlocker");
    expect(blocks).toEqual([]);
    expect(() => act(s, "B", { kind: "activateBlocker", blockerId: blocker })).toThrow(/não pode ativar <Blocker>/);
  });

  it("GD05-127: Piloto sem Link (ou Unit sem Phantom Pain) não dispara", () => {
    let s = game();
    placeCard(s, "A", G["GD05-127"], "baseSection");
    const pp = placeCard(s, "A", UNIT({ code: "TEST-PP", traits: ["Phantom Pain"], link: { kind: "pilotName", values: ["Someone Else"] } }), "battleArea");
    placeCard(s, "B", UNIT({ effectKeywords: ["Blocker"] }), "battleArea");
    const pilot = placeCard(s, "A", PILOT(), "hand");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: pilot, pairWithUnitId: pp });
    expect(entry(s, "A", "GD05-127-Reaction")).toBeUndefined();
  });
});

describe("FAQ GD05-054 — destruída por DANO de efeito não é \"destroyed by an effect\"", () => {
  it("Unit sua destruída por dano de efeito não compra; por \"destroy it\" compra", () => {
    let s = game();
    placeCard(s, "A", G["GD05-054"], "battleArea");
    const weak = placeCard(s, "A", UNIT({ code: "TEST-WEAK", hp: 1 }), "battleArea");
    const enemyThrone = placeCard(s, "B", G["GD05-038"], "battleArea");
    const cbs = [1, 2, 3].map((i) => placeCard(s, "B", UNIT({ code: `TEST-CB${i}`, traits: ["CB"] }), "battleArea"));
    s.activePlayer = "B";
    const hand = s.players.A.hand.length;
    s = act(s, "B", { kind: "activateAbility", sourceInstanceId: enemyThrone });
    s = act(s, "B", { kind: "resolveAbility", resolutions: [{ specId: "GD05-038-ActivateMain", activate: true, targetIds: [weak], secondaryTargetIds: cbs }] });
    expect(inZone(s, "A", "trash", weak)).toBe(true);
    expect(s.players.A.hand.length).toBe(hand);
    expect(s.players.A.ownUnitDestroyedByOwnEffectOnTurn).toBeUndefined();
  });
});
