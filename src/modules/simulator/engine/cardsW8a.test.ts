import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { effectiveAp, effectiveCost, effectiveLevel, hasKeyword } from "./types";
import { advanceToMainPhase } from "./phases";
import { attackTargetError } from "./combat";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD05_CARD_DEFS } from "../content/gd05";
import { GD02_CARD_DEFS } from "../content/gd02";

/** W8a — GD05-C com vocabulário existente, fluxo real. */

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
const inZone = (state: GameState, player: PlayerId, zone: "battleArea" | "hand" | "trash" | "baseSection", id: string) =>
  state.players[player][zone].some((c) => c.instanceId === id);
function pair(s: GameState, unit: string, pilot: string): void {
  findCard(s, unit).pairedPilotId = pilot;
  findCard(s, pilot).pairedUnitId = unit;
}
function runCombat(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 10 && s.combat && !s.pendingDecision.A && !s.pendingDecision.B; i++) {
    if (s.combat.step === "block") s = act(s, s.combat.defendingPlayer, { kind: "skipBlock" });
    else if (s.combat.step === "action") s = act(s, s.combat.actionPriority, { kind: "passAction" });
    else break;
  }
  return s;
}
/** A ataca `victim` com uma Unit e os dois chegam ao Action Step com A na prioridade */
function toActionStep(s: GameState, attacker: string, victim: string): GameState {
  let next = act(s, "A", { kind: "declareAttack", attackerId: attacker, target: { unitId: victim } });
  next = act(next, "B", { kind: "skipBlock" });
  if (next.combat!.actionPriority === "B") next = act(next, "B", { kind: "passAction" });
  return next;
}

describe("custo/nível dinâmico", () => {
  it("GD05-004: Lv. e custo -1 por Unit (Orb) sua, só sem Unit Lv.6+ em jogo", () => {
    const s = game();
    const def = G["GD05-004"];
    const [cost, level] = [effectiveCost(def, s, "A"), effectiveLevel(def, s, "A")];
    placeCard(s, "A", UNIT({ code: "TEST-ORB1", traits: ["Orb"] }), "battleArea");
    placeCard(s, "A", UNIT({ code: "TEST-ORB2", traits: ["Orb"] }), "battleArea");
    expect(effectiveCost(def, s, "A")).toBe(Math.max(0, cost - 2));
    expect(effectiveLevel(def, s, "A")).toBe(Math.max(0, level - 2));
    placeCard(s, "A", UNIT({ code: "TEST-BIG", level: 6 }), "battleArea");
    expect(effectiveCost(def, s, "A")).toBe(cost);
  });

  it("GD05-008: custo -2 com Pilot (Newtype) não azul pareado; azul não conta", () => {
    const s = game();
    const def = G["GD05-008"];
    const cost = effectiveCost(def, s, "A");
    const host = placeCard(s, "A", UNIT(), "battleArea");
    const blue = placeCard(s, "A", PILOT({ code: "TEST-NT-BLUE", traits: ["Newtype"], color: "blue" }), "battleArea");
    pair(s, host, blue);
    expect(effectiveCost(def, s, "A")).toBe(cost);
    findCard(s, blue).def = PILOT({ code: "TEST-NT-RED", traits: ["Newtype"], color: "red" });
    expect(effectiveCost(def, s, "A")).toBe(Math.max(0, cost - 2));
  });
});

describe("ataque e alvo", () => {
  it("GD05-030/048/078: no turno do deploy ataca, mas só Unit inimiga descansada", () => {
    let s = game();
    const unit = placeCard(s, "A", G["GD05-030"], "hand");
    const rested = placeCard(s, "B", UNIT({ code: "TEST-RESTED" }), "battleArea", { rested: true });
    const active = placeCard(s, "B", UNIT({ code: "TEST-ACTIVE" }), "battleArea");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: unit });
    const me = findCard(s, unit);
    expect(attackTargetError(s, me, "player")).toMatch(/descansada/);
    expect(attackTargetError(s, me, { unitId: active })).not.toBeNull();
    expect(attackTargetError(s, me, { unitId: rested })).toBeNull();
    s = act(s, "A", { kind: "declareAttack", attackerId: unit, target: { unitId: rested } });
    expect(s.combat?.attackerId).toBe(unit);
  });

  it("GD05-086: com Link, a Unit pareada descansada atrai ataques que não são de Link Unit", () => {
    const s = game();
    s.activePlayer = "B";
    const host = placeCard(s, "A", UNIT({ code: "TEST-HOST", link: { kind: "pilotName", values: ["Kayra Su"] } }), "battleArea", { rested: true });
    const kayra = placeCard(s, "A", G["GD05-086"], "battleArea");
    pair(s, host, kayra);
    const plain = placeCard(s, "B", UNIT({ code: "TEST-ATK" }), "battleArea");
    expect(attackTargetError(s, findCard(s, plain), "player")).toMatch(/obriga/);
    expect(attackTargetError(s, findCard(s, plain), { unitId: host })).toBeNull();
    const linkAtk = placeCard(s, "B", UNIT({ code: "TEST-LINKATK", link: { kind: "pilotName", values: ["Test Pilot"] } }), "battleArea");
    const p = placeCard(s, "B", PILOT(), "battleArea");
    pair(s, linkAtk, p);
    expect(attackTargetError(s, findCard(s, linkAtk), "player")).toBeNull();
  });

  it("GD05-108 【Action】: troca o alvo do ataque inimigo para a sua Unit (Academy) descansada", () => {
    let s = game();
    s.activePlayer = "B";
    const academy = placeCard(s, "A", UNIT({ code: "TEST-ACAD", traits: ["Academy"] }), "battleArea", { rested: true });
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK" }), "battleArea");
    const cmd = placeCard(s, "A", G["GD05-108"], "hand");
    s = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: "player" });
    s = act(s, "A", { kind: "skipBlock" });
    if (s.combat!.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Action", targets: { target: [academy] } });
    expect(s.combat?.currentTarget).toEqual({ unitId: academy });
  });

  it("GD05-119 【Action】: AP-3 só na Unit inimiga em batalha com Unit sua de Lv.5+", () => {
    let s = game();
    const big = placeCard(s, "A", UNIT({ code: "TEST-LV5", level: 5, ap: 5, hp: 9 }), "battleArea");
    const victim = placeCard(s, "B", UNIT({ code: "TEST-V", ap: 4 }), "battleArea", { rested: true });
    const cmd = placeCard(s, "A", G["GD05-119"], "hand");
    s = toActionStep(s, big, victim);
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Action", targets: { target: [victim] } });
    expect(effectiveAp(findCard(s, victim), s)).toBe(1);
  });
});

describe("gatilhos", () => {
  it("GD05-016: Unit (Orb) sua deployada dá <High-Maneuver> neste turno", () => {
    let s = game();
    const mura = placeCard(s, "A", G["GD05-016"], "battleArea");
    const orb = placeCard(s, "A", UNIT({ code: "TEST-ORB", traits: ["Orb"] }), "hand");
    expect(hasKeyword(findCard(s, mura), "High-Maneuver", s)).toBe(false);
    s = act(s, "A", { kind: "deployCard", cardInstanceId: orb });
    expect(hasKeyword(findCard(s, mura), "High-Maneuver", s)).toBe(true);
  });

  it("GD05-059 【Attack】: descansa Gjallarhorn ativa e compra; ganha <High-Maneuver>", () => {
    let s = game();
    const lupus = placeCard(s, "A", G["GD05-059"], "battleArea");
    const gj = placeCard(s, "A", UNIT({ code: "TEST-GJ", traits: ["Gjallarhorn"] }), "battleArea");
    const hand = s.players.A.hand.length;
    s = act(s, "A", { kind: "declareAttack", attackerId: lupus, target: "player" });
    s = resolve(s, "A", "GD05-059-Attack", [gj]);
    expect(findCard(s, gj).rested).toBe(true);
    expect(s.players.A.hand.length).toBe(hand + 1);
    expect(hasKeyword(findCard(s, lupus), "High-Maneuver", s)).toBe(true);
  });

  it("GD05-064 【Deploy】: só se veio do trash pega Shinn Asuka do trash", () => {
    let s = game();
    const force = placeCard(s, "A", G["GD05-064"], "trash");
    const shinn = placeCard(s, "A", PILOT({ code: "TEST-SHINN", nameEn: "Shinn Asuka" }), "trash");
    const cmd = placeCard(s, "A", GD02_CARD_DEFS["GD02-110"], "hand");
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main" });
    s = resolve(s, "A", "GD02-110-Main", [force]);
    expect(inZone(s, "A", "battleArea", force)).toBe(true);
    expect(entry(s, "A", "GD05-064-Deploy")?.trashSearch?.legalTrashIds).toEqual([shinn]);
    s = resolve(s, "A", "GD05-064-Deploy", [shinn]);
    expect(inZone(s, "A", "hand", shinn)).toBe(true);

    let t = game();
    placeCard(t, "A", PILOT({ nameEn: "Shinn Asuka" }), "trash");
    const fromHand = placeCard(t, "A", G["GD05-064"], "hand");
    t = act(t, "A", { kind: "deployCard", cardInstanceId: fromHand });
    expect(entry(t, "A", "GD05-064-Deploy")).toBeUndefined();
  });

  it("GD05-067: <Suppression> só com Unit inimiga descansada; 【Attack】 descansa 1 inimiga", () => {
    let s = game();
    const wing = placeCard(s, "A", G["GD05-067"], "battleArea");
    const enemy = placeCard(s, "B", UNIT(), "battleArea");
    expect(hasKeyword(findCard(s, wing), "Suppression", s)).toBe(false);
    s = act(s, "A", { kind: "declareAttack", attackerId: wing, target: "player" });
    s = resolve(s, "A", "GD05-067-Attack", [enemy]);
    expect(findCard(s, enemy).rested).toBe(true);
    expect(hasKeyword(findCard(s, wing), "Suppression", s)).toBe(true);
  });

  it("GD05-070: ao destruir em batalha, ativa uma Link (Preventer) descansada que não pode atacar", () => {
    let s = game();
    const tallgeese = placeCard(s, "A", G["GD05-070"], "battleArea");
    const prev = placeCard(s, "A", UNIT({ code: "TEST-PREV", traits: ["Preventer"], link: { kind: "pilotName", values: ["Test Pilot"] } }), "battleArea", { rested: true });
    const p = placeCard(s, "A", PILOT(), "battleArea");
    pair(s, prev, p);
    const victim = placeCard(s, "B", UNIT({ ap: 1, hp: 1 }), "battleArea", { rested: true });
    s = runCombat(act(s, "A", { kind: "declareAttack", attackerId: tallgeese, target: { unitId: victim } }));
    s = resolve(s, "A", "GD05-070-Reaction", [prev]);
    expect(findCard(s, prev).rested).toBe(false);
    expect(() => act(s, "A", { kind: "declareAttack", attackerId: prev, target: "player" })).toThrow(/não pode atacar/);
  });

  it("GD05-093 【When Linked】: deploya Base (Neo Zeon) do trash no lugar da atual", () => {
    let s = game();
    const host = placeCard(s, "A", UNIT({ code: "TEST-CHAR-HOST", link: { kind: "pilotName", values: ["Char Aznable"] } }), "battleArea");
    const old = placeCard(s, "A", { code: "TEST-OLDBASE", nameEn: "Old", cardType: "BASE", color: "red", level: 1, cost: 1, ap: 0, hp: 3 }, "baseSection");
    const axis = placeCard(s, "A", G["GD05-129"], "trash");
    const char = placeCard(s, "A", G["GD05-093"], "hand");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: char, pairWithUnitId: host });
    expect(entry(s, "A", "GD05-093-WhenLinked")?.trashSearch?.legalTrashIds).toEqual([axis]);
    s = resolve(s, "A", "GD05-093-WhenLinked", [axis]);
    expect(inZone(s, "A", "baseSection", axis)).toBe(true);
    expect(inZone(s, "A", "trash", old)).toBe(true);
  });

  it("GD05-126 Quiet Zero: ② e Aerial Lv.5+ em jogo → token Gundnode", () => {
    let s = game();
    const base = placeCard(s, "A", G["GD05-126"], "baseSection");
    const none = act(s, "A", { kind: "activateAbility", sourceInstanceId: base });
    expect(none.players.A.battleArea.some((c) => c.def.nameEn === "Gundnode")).toBe(false);
    placeCard(s, "A", UNIT({ code: "TEST-AERIAL", nameEn: "Gundam Aerial Rebuild", level: 5 }), "battleArea");
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: base });
    expect(s.players.A.battleArea.some((c) => c.def.nameEn === "Gundnode")).toBe(true);
  });
});

describe("estáticos de Piloto", () => {
  it("GD05-088: a pareada e as outras Lfrith/Gundnode ganham AP+1 (a pareada não soma 2×)", () => {
    const s = game();
    const host = placeCard(s, "A", UNIT({ code: "TEST-LFRITH-HOST", nameEn: "Gundam Lfrith Ur" }), "battleArea");
    const other = placeCard(s, "A", UNIT({ code: "TEST-GUNDNODE", nameEn: "Gundnode" }), "battleArea");
    const plain = placeCard(s, "A", UNIT({ code: "TEST-PLAIN" }), "battleArea");
    const prospera = placeCard(s, "A", G["GD05-088"], "battleArea");
    const hostAp = effectiveAp(findCard(s, host), s);
    pair(s, host, prospera);
    expect(effectiveAp(findCard(s, host), s)).toBe(hostAp + (G["GD05-088"].ap ?? 0) + 1);
    expect(effectiveAp(findCard(s, other), s)).toBe(4);
    expect(effectiveAp(findCard(s, plain), s)).toBe(3);
  });
});
