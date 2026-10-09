import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { effectiveAp, effectiveCost, effectiveLevel, hasKeyword, keywordValue } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { findCard } from "./events";
import { incomingDamage } from "./damageLayer";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { getCardDefByCode } from "../content/allCardDefs";

/** W11 — EB01 fechado: os padrões novos (escopo "allUnits", Lv. exato, "all players look", 2+ jogadores inimigos…). */

const card = (code: string): CardDef => {
  const def = getCardDefByCode(code);
  if (!def) throw new Error(code);
  return def;
};
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
const GGEN = (i: number, extra: Partial<CardDef> = {}) => UNIT({ code: `TEST-GG${i}`, nameEn: `G Gen ${i}`, traits: ["G Generation"], ...extra });
const BLOCKER = (i: number, extra: Partial<CardDef> = {}) => UNIT({ code: `TEST-BL${i}`, effectKeywords: ["Blocker"], ...extra });

function game(): GameState {
  const state = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 100, firstPlayer: "A" }));
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
type Resolution = Extract<PlayerAction, { kind: "resolveAbility" }>["resolutions"][number];
const resolveWith = (state: GameState, player: PlayerId, r: Partial<Resolution> & { specId: string }) =>
  act(state, player, { kind: "resolveAbility", resolutions: [{ activate: true, targetIds: [], ...r }] });
const inZone = (s: GameState, p: PlayerId, zone: "hand" | "trash" | "exile" | "battleArea" | "deck", id: string) =>
  s.players[p][zone].some((c) => c.instanceId === id);
const deploy = (s: GameState, code: string, pairWithUnitId?: string) =>
  act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", card(code), "hand"), ...(pairWithUnitId ? { pairWithUnitId } : {}) });
function pair(s: GameState, unitId: string, pilotId: string) {
  findCard(s, unitId).pairedPilotId = pilotId;
  findCard(s, pilotId).pairedUnitId = unitId;
}
/** carta no TOPO do deck do jogador */
function onTop(s: GameState, p: PlayerId, def: CardDef): string {
  const id = placeCard(s, p, def, "deck");
  const deck = s.players[p].deck;
  deck.unshift(deck.splice(deck.findIndex((c) => c.instanceId === id), 1)[0]);
  return id;
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
function endTurn(state: GameState): GameState {
  let s = act(state, "A", { kind: "finishTurn" });
  for (let i = 0; i < 3 && s.endPhaseAction && !pending(s, "A"); i++) s = act(s, s.endPhaseAction.priority, { kind: "passEndPhaseAction" });
  return s;
}

describe("EB01 W11 — estáticos", () => {
  it("EB01-031: pode atacar Unit inimiga ATIVA de Lv.3 ou menos, não de Lv.4", () => {
    let s = game();
    const oggo = placeCard(s, "A", card("EB01-031"), "battleArea");
    const lv4 = placeCard(s, "B", UNIT({ code: "TEST-L4", level: 4 }), "battleArea");
    const lv3 = placeCard(s, "B", UNIT({ code: "TEST-L3", level: 3 }), "battleArea");
    expect(() => act(s, "A", { kind: "declareAttack", attackerId: oggo, target: { unitId: lv4 } })).toThrow();
    s = act(s, "A", { kind: "declareAttack", attackerId: oggo, target: { unitId: lv3 } });
    expect(s.combat?.currentTarget).toEqual({ unitId: lv3 });
  });

  it("EB01-036: no seu turno, as OUTRAS (G Generation) de Lv.3 exato ganham AP+1", () => {
    const s = game();
    const darilbalde = placeCard(s, "A", card("EB01-036"), "battleArea");
    const lv3 = placeCard(s, "A", GGEN(1, { level: 3, ap: 2 }), "battleArea");
    const lv4 = placeCard(s, "A", GGEN(2, { level: 4, ap: 2 }), "battleArea");
    const plain = placeCard(s, "A", UNIT({ code: "TEST-P", level: 3, ap: 2 }), "battleArea");
    const enemy = placeCard(s, "B", GGEN(3, { level: 3, ap: 2 }), "battleArea");
    expect(effectiveAp(findCard(s, lv3), s)).toBe(3);
    expect(effectiveAp(findCard(s, lv4), s)).toBe(2);
    expect(effectiveAp(findCard(s, plain), s)).toBe(2);
    expect(effectiveAp(findCard(s, enemy), s)).toBe(2);
    expect(effectiveAp(findCard(s, darilbalde), s)).toBe(card("EB01-036").ap);
    s.activePlayer = "B";
    expect(effectiveAp(findCard(s, lv3), s)).toBe(2);
  });

  it("EB01-088 (Base): (G Generation) Lv.3 ganham AP+1 só no turno do oponente", () => {
    const s = game();
    placeCard(s, "A", card("EB01-088"), "baseSection");
    const lv3 = placeCard(s, "A", GGEN(1, { level: 3, ap: 2 }), "battleArea");
    expect(effectiveAp(findCard(s, lv3), s)).toBe(2);
    s.activePlayer = "B";
    expect(effectiveAp(findCard(s, lv3), s)).toBe(3);
  });

  it("EB01-042: descansada, TODAS as Units (os 2 lados) ganham <Blocker>; 【Attack】 Lv.7- não ativam <Blocker>", () => {
    let s = game();
    const unit = placeCard(s, "A", card("EB01-042"), "battleArea");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", level: 7 }), "battleArea");
    const friend = placeCard(s, "A", UNIT({ code: "TEST-F" }), "battleArea");
    expect(hasKeyword(findCard(s, enemy), "Blocker", s)).toBe(false);
    findCard(s, unit).rested = true;
    expect(hasKeyword(findCard(s, enemy), "Blocker", s)).toBe(true);
    expect(hasKeyword(findCard(s, friend), "Blocker", s)).toBe(true);
    findCard(s, unit).rested = false;
    const blocker = placeCard(s, "B", BLOCKER(1, { level: 7 }), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
    expect(() => act(s, "B", { kind: "activateBlocker", blockerId: blocker })).toThrow();
  });

  it("EB01-049: com uma (G Generation) amiga com <Blocker> em jogo, ganha <Suppression>", () => {
    const s = game();
    const unit = placeCard(s, "A", card("EB01-049"), "battleArea");
    expect(hasKeyword(findCard(s, unit), "Suppression", s)).toBe(false);
    placeCard(s, "A", GGEN(1, { effectKeywords: ["Blocker"] }), "battleArea");
    expect(hasKeyword(findCard(s, unit), "Suppression", s)).toBe(true);
  });

  it("EB01-063/064 (Pilotos): <Repair 2> com 2+ OUTRAS Units descansadas; com <Repair>, <Breach 1>", () => {
    const s = game();
    const unit = placeCard(s, "A", UNIT({ code: "TEST-U" }), "battleArea", { rested: true });
    const pilot = placeCard(s, "A", card("EB01-063"), "battleArea");
    pair(s, unit, pilot);
    placeCard(s, "B", UNIT({ code: "TEST-R1" }), "battleArea", { rested: true });
    expect(hasKeyword(findCard(s, unit), "Repair", s)).toBe(false); // a própria Unit pareada não conta
    placeCard(s, "A", UNIT({ code: "TEST-R2" }), "battleArea", { rested: true });
    expect(keywordValue(findCard(s, unit), "Repair", s)).toBe(2);

    const unit2 = placeCard(s, "A", UNIT({ code: "TEST-U2", effectKeywords: ["Repair"], keywordTags: ["Repair 1"] }), "battleArea");
    const pilot2 = placeCard(s, "A", card("EB01-064"), "battleArea");
    pair(s, unit2, pilot2);
    expect(keywordValue(findCard(s, unit2), "Breach", s)).toBe(1);
    const unit3 = placeCard(s, "A", UNIT({ code: "TEST-U3" }), "battleArea");
    const pilot3 = placeCard(s, "A", card("EB01-064"), "battleArea");
    pair(s, unit3, pilot3);
    expect(hasKeyword(findCard(s, unit3), "Breach", s)).toBe(false);
  });

  it("EB01-071 (Piloto): 【During Link】 AP+1", () => {
    const s = game();
    const pilotDef = card("EB01-071");
    const unit = placeCard(s, "A", UNIT({ code: "TEST-L", ap: 3, link: { kind: "pilotName", values: [pilotDef.nameEn] } }), "battleArea");
    const pilot = placeCard(s, "A", pilotDef, "battleArea");
    pair(s, unit, pilot);
    expect(effectiveAp(findCard(s, unit), s)).toBe(3 + (pilotDef.ap ?? 0) + 1);
  });

  it("EB01-014: no turno do oponente, imune a dano de EFEITO de Unit inimiga Lv.5-", () => {
    const s = game();
    const unit = placeCard(s, "A", card("EB01-014"), "battleArea");
    const lv5 = placeCard(s, "B", UNIT({ code: "TEST-L5", level: 5 }), "battleArea");
    const lv6 = placeCard(s, "B", UNIT({ code: "TEST-L6", level: 6 }), "battleArea");
    const target = findCard(s, unit);
    s.activePlayer = "B";
    expect(incomingDamage(s, target, 2, { kind: "effect", controller: "B", sourceId: lv5 }).amount).toBe(0);
    expect(incomingDamage(s, target, 2, { kind: "effect", controller: "B", sourceId: lv6 }).amount).toBe(2);
    expect(incomingDamage(s, target, 2, { kind: "battle", controller: "B", sourceId: lv5 }).amount).toBe(2);
    s.activePlayer = "A";
    expect(incomingDamage(s, target, 2, { kind: "effect", controller: "B", sourceId: lv5 }).amount).toBe(2);
  });

  it("EB01-037: no seu turno, batalhando com Unit inimiga com <Blocker>, não recebe dano de batalha", () => {
    let s = game();
    const zudah = placeCard(s, "A", card("EB01-037"), "battleArea");
    const blocker = placeCard(s, "B", BLOCKER(1, { ap: 5, hp: 9 }), "battleArea", { rested: true });
    s = runCombat(act(s, "A", { kind: "declareAttack", attackerId: zudah, target: { unitId: blocker } }));
    expect(inZone(s, "A", "battleArea", zudah)).toBe(true);
    expect(findCard(s, zudah).damage).toBe(0);
  });

  it("EB01-039: com 3+ Units inimigas, joga como Lv.3 e custo 3", () => {
    const s = game();
    const def = card("EB01-039");
    expect(effectiveLevel(def, s, "A")).toBe(6);
    expect(effectiveCost(def, s, "A")).toBe(5);
    for (let i = 0; i < 3; i++) placeCard(s, "B", UNIT({ code: `TEST-E${i}` }), "battleArea");
    expect(effectiveLevel(def, s, "A")).toBe(3);
    expect(effectiveCost(def, s, "A")).toBe(3);
  });

  it("EB01-040/044/055/058: '2 or more enemy players' nunca vale no 1v1", () => {
    let s = game();
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E" }), "battleArea");
    s = deploy(s, "EB01-044");
    expect(inZone(s, "B", "battleArea", enemy)).toBe(true);
    expect(pending(s, "A")).toBeNull();
    const u058 = placeCard(s, "A", card("EB01-058"), "battleArea");
    expect(hasKeyword(findCard(s, u058), "Blocker", s)).toBe(false);

    s.activePlayer = "B";
    placeCard(s, "A", card("EB01-055"), "battleArea", { rested: true });
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK" }), "battleArea");
    const shields = s.players.A.shields.length;
    s = runCombat(act(s, "B", { kind: "declareAttack", attackerId: attacker, target: "player" }));
    expect(s.players.A.shields.length).toBe(shields - 1);
  });
});

describe("EB01 W11 — gatilhos", () => {
  it("EB01-003: fim do seu turno descansada → descansa todas as Units; 3+ descansadas por isso → compra 1", () => {
    let s = game();
    placeCard(s, "A", card("EB01-003"), "battleArea", { rested: true });
    const units = [placeCard(s, "A", UNIT({ code: "TEST-1" }), "battleArea"), placeCard(s, "B", UNIT({ code: "TEST-2" }), "battleArea"), placeCard(s, "B", UNIT({ code: "TEST-3" }), "battleArea")];
    const hand = s.players.A.hand.length;
    s = endTurn(s);
    // as do oponente voltam a ficar ativas no início do turno dele: confere pelo evento
    for (const id of units) expect(s.eventLog.some((e) => e.type === "REST_CARD" && e.instanceId === id)).toBe(true);
    expect(findCard(s, units[0]).rested).toBe(true);
    expect(s.players.A.hand.length).toBe(hand + 1);
  });

  it("EB01-003: só 2 Units descansadas pelo efeito → não compra", () => {
    let s = game();
    placeCard(s, "A", card("EB01-003"), "battleArea", { rested: true });
    placeCard(s, "A", UNIT({ code: "TEST-1" }), "battleArea");
    placeCard(s, "B", UNIT({ code: "TEST-2" }), "battleArea");
    placeCard(s, "B", UNIT({ code: "TEST-3" }), "battleArea", { rested: true });
    const hand = s.players.A.hand.length;
    s = endTurn(s);
    expect(s.players.A.hand.length).toBe(hand);
  });

  it("EB01-004: ao recuperar HP pelo <Repair> no seu turno, 1 de dano numa Unit inimiga descansada (a que morre)", () => {
    let s = game();
    placeCard(s, "A", card("EB01-004"), "battleArea", { damage: 1 });
    const tough = placeCard(s, "B", UNIT({ code: "TEST-T", level: 6, hp: 5 }), "battleArea", { rested: true });
    const weak = placeCard(s, "B", UNIT({ code: "TEST-W", level: 2, hp: 1 }), "battleArea", { rested: true });
    s = endTurn(s);
    expect(inZone(s, "B", "trash", weak)).toBe(true);
    expect(findCard(s, tough).damage).toBe(0);
  });

  it("EB01-023 【Attack】: cada jogador olha o topo; o controlador revela a Lv.5+, o oponente manda a dele pro fundo", () => {
    let s = game();
    const unit = placeCard(s, "A", card("EB01-023"), "battleArea");
    const myTop = onTop(s, "A", UNIT({ code: "TEST-BIG", level: 5 }));
    const theirTop = onTop(s, "B", UNIT({ code: "TEST-SMALL", level: 2 }));
    s = act(s, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
    expect(entry(s, "A", "EB01-023-LookYours")?.deckTopReveal?.revealableIds).toEqual([myTop]);
    s = resolveWith(s, "A", { specId: "EB01-023-LookYours", targetIds: [myTop] });
    expect(inZone(s, "A", "hand", myTop)).toBe(true);
    expect(entry(s, "B", "EB01-023-LookOpponent")?.deckTopReveal?.revealableIds).toEqual([]);
    s = resolveWith(s, "B", { specId: "EB01-023-LookOpponent" });
    s = resolveWith(s, "B", { specId: "EB01-023-PlaceOpponent", targetIds: ["bottom"] });
    const deckB = s.players.B.deck;
    expect(deckB[deckB.length - 1].instanceId).toBe(theirTop);
    // a continuação do oponente esperou na fila atrás da do controlador: resolvida, o combate segue (travava no Attack Step)
    expect(s.combat?.step).not.toBe("attack");
  });

  it("EB01-023: o controlador manda a dele pro fundo e o oponente revela → o combate também segue", () => {
    let s = game();
    const unit = placeCard(s, "A", card("EB01-023"), "battleArea");
    onTop(s, "A", UNIT({ code: "TEST-SMALL", level: 2 }));
    const theirTop = onTop(s, "B", UNIT({ code: "TEST-BIG", level: 6 }));
    s = act(s, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
    s = resolveWith(s, "A", { specId: "EB01-023-LookYours" });
    s = resolveWith(s, "A", { specId: "EB01-023-PlaceYours", targetIds: ["bottom"] });
    s = resolveWith(s, "B", { specId: "EB01-023-LookOpponent", targetIds: [theirTop] });
    expect(inZone(s, "B", "hand", theirTop)).toBe(true);
    expect(pending(s, "A")).toBeNull();
    expect(pending(s, "B")).toBeNull();
    expect(s.combat?.step).not.toBe("attack");
  });

  it("EB01-078 【Main】: carta que não é Unit fica no topo se o jogador escolher", () => {
    let s = game();
    const myTop = onTop(s, "A", { ...UNIT({ code: "TEST-CMD" }), cardType: "COMMAND" });
    onTop(s, "B", UNIT({ code: "TEST-B" }));
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("EB01-078"), "hand"), trigger: "Main" });
    s = resolveWith(s, "A", { specId: "EB01-078-LookYours" });
    s = resolveWith(s, "A", { specId: "EB01-078-PlaceYours", targetIds: ["top"] });
    expect(s.players.A.deck[0].instanceId).toBe(myTop);
    expect(entry(s, "B", "EB01-078-LookOpponent")).toBeDefined();
  });

  it("EB01-025 Development 2: os 2 jogadores ganham EX Resource; pareada, imune a dano de batalha de Lv.5- enquanto o oponente tem EX", () => {
    let s = game();
    [0, 1].forEach((i) => placeCard(s, "A", GGEN(i), "trash"));
    s = deploy(s, "EB01-025");
    s = resolveWith(s, "A", { specId: "EB01-025-Deploy" });
    const ex = (p: PlayerId) => s.players[p].resourceArea.filter((r) => r.def.code === "TOKEN-EX-RESOURCE").length;
    expect(ex("A")).toBe(1);
    expect(ex("B")).toBe(1);
    const unit = s.players.A.battleArea.find((c) => c.def.code === "EB01-025")!;
    const lv5 = placeCard(s, "B", UNIT({ code: "TEST-L5", level: 5 }), "battleArea");
    const battle = { kind: "battle" as const, controller: "B" as const, sourceId: lv5 };
    expect(incomingDamage(s, unit, 3, battle).amount).toBe(3);
    pair(s, unit.instanceId, placeCard(s, "A", PILOT(), "battleArea"));
    expect(incomingDamage(s, findCard(s, unit.instanceId), 3, battle).amount).toBe(0);
  });

  it("EB01-028: descansada, outra Unit sua atacando Unit inimiga ganha <Breach 2> na batalha (1×/turno)", () => {
    let s = game();
    placeCard(s, "A", card("EB01-028"), "battleArea", { rested: true });
    const attacker = placeCard(s, "A", UNIT({ code: "TEST-ATK" }), "battleArea");
    const victim = placeCard(s, "B", UNIT({ code: "TEST-V" }), "battleArea", { rested: true });
    s = act(s, "A", { kind: "declareAttack", attackerId: attacker, target: { unitId: victim } });
    expect(keywordValue(findCard(s, attacker), "Breach", s)).toBe(2);
  });

  it("EB01-029: com 5+ Units inimigas, 2 de dano em toda Unit com <Blocker> Lv.4- (dos 2 lados)", () => {
    let s = game();
    const mine = placeCard(s, "A", BLOCKER(1, { level: 4, hp: 5 }), "battleArea");
    const big = placeCard(s, "B", BLOCKER(2, { level: 5, hp: 5 }), "battleArea");
    const small = placeCard(s, "B", BLOCKER(3, { level: 2, hp: 5 }), "battleArea");
    for (let i = 0; i < 3; i++) placeCard(s, "B", UNIT({ code: `TEST-E${i}`, hp: 5 }), "battleArea");
    s = deploy(s, "EB01-029");
    expect(findCard(s, mine).damage).toBe(2);
    expect(findCard(s, small).damage).toBe(2);
    expect(findCard(s, big).damage).toBe(0);
  });

  it("EB01-033 【Activate･Action】①: outra Unit sendo atacada ganha AP+1 na batalha", () => {
    let s = game();
    s.activePlayer = "B";
    const taurus = placeCard(s, "A", card("EB01-033"), "battleArea");
    const defender = placeCard(s, "A", UNIT({ code: "TEST-D", ap: 2 }), "battleArea", { rested: true });
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK" }), "battleArea");
    s = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: defender } });
    s = act(s, "A", { kind: "skipBlock" });
    if (s.combat?.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: taurus, targets: { target: [defender] } });
    expect(effectiveAp(findCard(s, defender), s)).toBe(3);
  });

  it("EB01-050 【Attack】: a carta do topo vai pro trash; Lv.3+ → AP-2 numa Unit inimiga nesta batalha", () => {
    let s = game();
    const unit = placeCard(s, "A", card("EB01-050"), "battleArea");
    const milled = onTop(s, "A", UNIT({ code: "TEST-M", level: 3 }));
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", ap: 4 }), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
    expect(inZone(s, "A", "trash", milled)).toBe(true);
    s = resolveWith(s, "A", { specId: "EB01-050-Then", targetIds: [enemy] });
    expect(effectiveAp(findCard(s, enemy), s)).toBe(2);
  });

  it("EB01-050: carta Lv.2 → nada", () => {
    let s = game();
    const unit = placeCard(s, "A", card("EB01-050"), "battleArea");
    onTop(s, "A", UNIT({ code: "TEST-M", level: 2 }));
    placeCard(s, "B", UNIT({ code: "TEST-E" }), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
    expect(entry(s, "A", "EB01-050-Then")).toBeUndefined();
  });

  it("EB01-059 【During Link】【Attack】: cada jogador ativa 1 Resource", () => {
    let s = game();
    const pilot = PILOT({ nameEn: "Link Pilot" });
    const unit = placeCard(s, "A", { ...card("EB01-059"), link: { kind: "pilotName", values: ["Link Pilot"] } }, "battleArea");
    pair(s, unit, placeCard(s, "A", pilot, "battleArea"));
    for (const p of ["A", "B"] as const) for (const r of s.players[p].resourceArea) r.rested = true;
    s = act(s, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
    expect(s.players.A.resourceArea.filter((r) => !r.rested)).toHaveLength(1);
    expect(s.players.B.resourceArea.filter((r) => !r.rested)).toHaveLength(1);
  });

  it("EB01-062 【Attack】: o oponente escolhe comprar → os 2 compram 1; recusar → ninguém compra", () => {
    for (const choice of ["draw", "decline"] as const) {
      let s = game();
      const unit = placeCard(s, "A", UNIT({ code: "TEST-U" }), "battleArea");
      pair(s, unit, placeCard(s, "A", card("EB01-062"), "battleArea"));
      const [handA, handB] = [s.players.A.hand.length, s.players.B.hand.length];
      s = act(s, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
      s = resolveWith(s, "B", { specId: "EB01-062-Choice", targetIds: [choice] });
      const delta = choice === "draw" ? 1 : 0;
      expect(s.players.A.hand.length).toBe(handA + delta);
      expect(s.players.B.hand.length).toBe(handB + delta);
    }
  });

  it("EB01-066 【When Paired】: a (G Generation) escolhida pode atacar Unit inimiga ATIVA com <Blocker> neste turno", () => {
    let s = game();
    const gg = placeCard(s, "A", GGEN(1), "battleArea");
    const blocker = placeCard(s, "B", BLOCKER(1, { level: 8 }), "battleArea");
    const plain = placeCard(s, "B", UNIT({ code: "TEST-P", level: 1 }), "battleArea");
    s = deploy(s, "EB01-066", gg);
    s = resolveWith(s, "A", { specId: "EB01-066-WhenPaired", targetIds: [gg] });
    expect(() => act(s, "A", { kind: "declareAttack", attackerId: gg, target: { unitId: plain } })).toThrow();
    s = act(s, "A", { kind: "declareAttack", attackerId: gg, target: { unitId: blocker } });
    expect(s.combat?.currentTarget).toEqual({ unitId: blocker });
  });

  it("EB01-067 【When Paired】: a (G Generation) Unit revelada volta pro topo; o resto vai pro fundo", () => {
    let s = game();
    const unit = placeCard(s, "A", UNIT({ code: "TEST-U" }), "battleArea");
    const c3 = onTop(s, "A", UNIT({ code: "TEST-C3" }));
    const gg = onTop(s, "A", GGEN(9));
    const c1 = onTop(s, "A", UNIT({ code: "TEST-C1" }));
    s = deploy(s, "EB01-067", unit);
    expect(entry(s, "A", "EB01-067-WhenPaired")?.deckTopReveal?.revealableIds).toEqual([gg]);
    s = resolveWith(s, "A", { specId: "EB01-067-WhenPaired", targetIds: [gg] });
    const deck = s.players.A.deck;
    expect(deck[0].instanceId).toBe(gg);
    expect(deck.slice(-2).map((c) => c.instanceId).sort()).toEqual([c1, c3].sort());
  });

  it("EB01-068 【During Link】【Destroyed】: o Piloto pode voltar pro topo do deck do dono", () => {
    let s = game();
    s.activePlayer = "B";
    const pilotDef = card("EB01-068");
    const unit = placeCard(s, "A", UNIT({ code: "TEST-L", hp: 1, link: { kind: "pilotName", values: [pilotDef.nameEn] } }), "battleArea", { rested: true });
    const pilot = placeCard(s, "A", pilotDef, "battleArea");
    pair(s, unit, pilot);
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK", ap: 5, hp: 5 }), "battleArea");
    s = runCombat(act(s, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: unit } }));
    s = resolveWith(s, "A", { specId: "EB01-068-Destroyed" });
    expect(s.players.A.deck[0].instanceId).toBe(pilot);
    expect(inZone(s, "A", "trash", unit)).toBe(true);
  });

  it("EB01-077 【Action】: muda o alvo do ataque inimigo pra uma (G Generation) descansada sua", () => {
    let s = game();
    s.activePlayer = "B";
    const gg = placeCard(s, "A", GGEN(1, { hp: 9 }), "battleArea", { rested: true });
    const victim = placeCard(s, "A", UNIT({ code: "TEST-V" }), "battleArea", { rested: true });
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK" }), "battleArea");
    s = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: victim } });
    s = act(s, "A", { kind: "skipBlock" });
    if (s.combat?.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("EB01-077"), "hand"), trigger: "Action", targets: { target: [gg] } });
    expect(s.combat?.currentTarget).toEqual({ unitId: gg });
  });

  it("EB01-079 【Main】: (G Generation) não recebe dano de batalha de Unit inimiga Lv.3- neste turno", () => {
    let s = game();
    const gg = placeCard(s, "A", GGEN(1), "battleArea");
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("EB01-079"), "hand"), trigger: "Main", targets: { target: [gg] } });
    const lv3 = placeCard(s, "B", UNIT({ code: "TEST-L3", level: 3 }), "battleArea");
    const lv4 = placeCard(s, "B", UNIT({ code: "TEST-L4", level: 4 }), "battleArea");
    expect(incomingDamage(s, findCard(s, gg), 3, { kind: "battle", controller: "B", sourceId: lv3 }).amount).toBe(0);
    expect(incomingDamage(s, findCard(s, gg), 3, { kind: "battle", controller: "B", sourceId: lv4 }).amount).toBe(3);
  });

  it("EB01-088 【Deploy】: 1 escudo vai pra mão", () => {
    let s = game();
    const [hand, shields] = [s.players.A.hand.length, s.players.A.shields.length];
    s = deploy(s, "EB01-088");
    expect(s.players.A.shields.length).toBe(shields - 1);
    expect(s.players.A.hand.length).toBe(hand + 1);
  });
});
