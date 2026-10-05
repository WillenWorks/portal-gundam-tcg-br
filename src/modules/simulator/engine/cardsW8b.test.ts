import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { effectiveAp, hasKeyword, keywordValue } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { incomingDamage } from "./damageLayer";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD05_CARD_DEFS } from "../content/gd05";
import { TOKEN_PLUMA } from "../content/gd05/tokens";

/** W8b — GD05-C com motor novo pequeno, fluxo real. */

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
const COMMAND = (extra: Partial<CardDef> = {}): CardDef => ({
  code: "TEST-CMD",
  nameEn: "Test Command",
  cardType: "COMMAND",
  color: "white",
  level: 1,
  cost: 1,
  ap: 0,
  hp: 0,
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
const inZone = (state: GameState, player: PlayerId, zone: "battleArea" | "hand" | "trash" | "baseSection" | "exile", id: string) =>
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

describe("custo \"Rest N of your Units\"", () => {
  it("GD05-001: com só 1 Unit ativa, o custo não é pagável", () => {
    const s = game();
    const v2 = placeCard(s, "A", G["GD05-001"], "battleArea", { rested: true });
    placeCard(s, "A", UNIT({ code: "TEST-U1" }), "battleArea");
    expect(() => act(s, "A", { kind: "activateAbility", sourceInstanceId: v2 })).toThrow(/não há Unit elegível/);
  });

  it("GD05-001: com 2 Units ativas, pede as 2 e exige exatamente 2", () => {
    let s = game();
    const v2 = placeCard(s, "A", G["GD05-001"], "battleArea", { rested: true });
    const u1 = placeCard(s, "A", UNIT({ code: "TEST-U1" }), "battleArea");
    const u2 = placeCard(s, "A", UNIT({ code: "TEST-U2" }), "battleArea");
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: v2 });
    const q = entry(s, "A", "GD05-001-ActivateMain");
    expect(q?.secondaryTarget?.count).toBe(2);
    expect(() =>
      act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD05-001-ActivateMain", activate: true, targetIds: [], secondaryTargetIds: [u1] }] }),
    ).toThrow(/escolha 2 Units/);
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD05-001-ActivateMain", activate: true, targetIds: [], secondaryTargetIds: [u1, u2] }] });
    expect(findCard(s, u1).rested && findCard(s, u2).rested).toBe(true);
    expect(findCard(s, v2).rested).toBe(false);
  });

  it("GD05-038: descansa 3 (CB) e dá 4 de dano; <Suppression> com Link", () => {
    let s = game();
    const eins = placeCard(s, "A", G["GD05-038"], "battleArea");
    const cbs = [1, 2, 3].map((i) => placeCard(s, "A", UNIT({ code: `TEST-CB${i}`, traits: ["CB"] }), "battleArea"));
    const enemy = placeCard(s, "B", UNIT({ hp: 5 }), "battleArea");
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: eins });
    s = act(s, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: "GD05-038-ActivateMain", activate: true, targetIds: [enemy], secondaryTargetIds: cbs }],
    });
    expect(cbs.every((id) => findCard(s, id).rested)).toBe(true);
    expect(findCard(s, enemy).damage).toBe(4);
  });
});

describe("contagens dinâmicas", () => {
  it("GD05-006: <Repair> = nº de tokens (Calamity War); ao destruir Unit em batalha no seu turno, deploya Pluma", () => {
    let s = game();
    const hashmal = placeCard(s, "A", G["GD05-006"], "battleArea");
    expect(keywordValue(findCard(s, hashmal), "Repair", s)).toBe(0);
    placeCard(s, "A", TOKEN_PLUMA, "battleArea");
    expect(keywordValue(findCard(s, hashmal), "Repair", s)).toBe(1);
    const victim = placeCard(s, "B", UNIT({ ap: 1, hp: 1 }), "battleArea", { rested: true });
    s = runCombat(act(s, "A", { kind: "declareAttack", attackerId: hashmal, target: { unitId: victim } }));
    expect(s.players.A.battleArea.filter((c) => c.def.code === TOKEN_PLUMA.code)).toHaveLength(2);
    expect(keywordValue(findCard(s, hashmal), "Repair", s)).toBe(2);
  });

  it("GD05-051: AP + dano recebido; no fim do seu turno pode dar 1 de dano numa Tekkadan e ativá-la", () => {
    let s = game();
    const rex = placeCard(s, "A", G["GD05-051"], "battleArea", { damage: 2 });
    expect(effectiveAp(findCard(s, rex), s)).toBe((G["GD05-051"].ap ?? 0) + 2);
    const tk = placeCard(s, "A", UNIT({ code: "TEST-TK", traits: ["Tekkadan"], hp: 5 }), "battleArea", { rested: true });
    s = act(s, "A", { kind: "finishTurn" });
    s = act(s, s.endPhaseAction!.priority, { kind: "passEndPhaseAction" });
    if (s.endPhaseAction) s = act(s, s.endPhaseAction.priority, { kind: "passEndPhaseAction" });
    expect(entry(s, "A", "GD05-051-EndOfTurn")?.legalTargets).toContain(tk);
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD05-051-EndOfTurn", activate: true, targetIds: [tk] }] });
    expect(findCard(s, tk).damage).toBe(1);
    expect(findCard(s, tk).rested).toBe(false);
    expect(s.activePlayer).toBe("B"); // o fim de turno retomou e passou a vez
  });

  it("GD05-026: Units INIMIGAS com Lv. ≤ (Lfrith/Gundnode suas + esta) entram descansadas", () => {
    let s = game();
    placeCard(s, "A", G["GD05-026"], "battleArea");
    placeCard(s, "A", UNIT({ code: "TEST-GN", nameEn: "Gundnode" }), "battleArea");
    s.activePlayer = "B";
    const lv2 = placeCard(s, "B", UNIT({ code: "TEST-B2", level: 2 }), "hand");
    const lv3 = placeCard(s, "B", UNIT({ code: "TEST-B3", level: 3 }), "hand");
    s = act(s, "B", { kind: "deployCard", cardInstanceId: lv2 });
    s = act(s, "B", { kind: "deployCard", cardInstanceId: lv3 });
    expect(findCard(s, lv2).rested).toBe(true);
    expect(findCard(s, lv3).rested).toBe(false);
    s.activePlayer = "A";
    const mine = placeCard(s, "A", UNIT({ code: "TEST-A1", level: 1 }), "hand");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: mine });
    expect(findCard(s, mine).rested).toBe(false);
  });
});

describe("redução de dano", () => {
  it("GD05-021: 1×/turno -2 no dano inimigo com Pilot (Earth Federation); 【Activate･Action】 ①: AP+4 na batalha", () => {
    const s = game();
    const age2 = placeCard(s, "A", G["GD05-021"], "battleArea");
    const src = { kind: "effect" as const, controller: "B" as PlayerId, sourceId: "x" };
    expect(incomingDamage(s, findCard(s, age2), 3, src).amount).toBe(3);
    const pilot = placeCard(s, "A", PILOT({ traits: ["Earth Federation"] }), "battleArea");
    pair(s, age2, pilot);
    expect(incomingDamage(s, findCard(s, age2), 3, src).amount).toBe(1);
  });

  it("GD05-022 【Activate･Action】: exila 2 Commands do trash e reduz 2 do dano inimigo nesta batalha", () => {
    let s = game();
    const schwarz = placeCard(s, "A", G["GD05-022"], "battleArea");
    const c1 = placeCard(s, "A", COMMAND({ code: "TEST-C1" }), "trash");
    const c2 = placeCard(s, "A", COMMAND({ code: "TEST-C2" }), "trash");
    const victim = placeCard(s, "B", UNIT({ ap: 5, hp: 9 }), "battleArea", { rested: true });
    s = act(s, "A", { kind: "declareAttack", attackerId: schwarz, target: { unitId: victim } });
    s = act(s, "B", { kind: "skipBlock" });
    if (s.combat!.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: schwarz });
    expect(inZone(s, "A", "exile", c1) && inZone(s, "A", "exile", c2)).toBe(true);
    s = runCombat(s);
    expect(findCard(s, schwarz).damage).toBe(3);
  });

  it("GD05-084 (Piloto): tokens (League Militaire) seus levam 1 a menos de dano de efeito inimigo", () => {
    const s = game();
    const token = placeCard(s, "A", UNIT({ code: "TEST-LMT", traits: ["League Militaire"], isToken: true }), "battleArea");
    const notToken = placeCard(s, "A", UNIT({ code: "TEST-LM", traits: ["League Militaire"] }), "battleArea");
    const host = placeCard(s, "A", UNIT({ code: "TEST-HOST" }), "battleArea");
    const odelo = placeCard(s, "A", G["GD05-084"], "battleArea");
    pair(s, host, odelo);
    const src = { kind: "effect" as const, controller: "B" as PlayerId, sourceId: "x" };
    expect(incomingDamage(s, findCard(s, token), 2, src).amount).toBe(1);
    expect(incomingDamage(s, findCard(s, notToken), 2, src).amount).toBe(2);
    expect(incomingDamage(s, findCard(s, token), 2, { ...src, kind: "battle" }).amount).toBe(2);
  });

  it("GD05-123 (Base): no turno do oponente, (Orb) não recebe dano de efeito inimigo ≤2; 3+ passa inteiro", () => {
    const s = game();
    placeCard(s, "A", G["GD05-123"], "baseSection");
    const orb = placeCard(s, "A", UNIT({ code: "TEST-ORB", traits: ["Orb"] }), "battleArea");
    const src = { kind: "effect" as const, controller: "B" as PlayerId, sourceId: "x" };
    expect(incomingDamage(s, findCard(s, orb), 2, src).amount).toBe(2); // turno do A (dono): não vale
    s.activePlayer = "B";
    expect(incomingDamage(s, findCard(s, orb), 2, src).amount).toBe(0);
    expect(incomingDamage(s, findCard(s, orb), 3, src).amount).toBe(3);
  });
});

describe("GD05-130 Presidential Office", () => {
  it("【Destroyed】: exila a si mesma do trash e pode deployar outra \"Presidential Office\" da mão", () => {
    let s = game();
    const office = placeCard(s, "A", G["GD05-130"], "baseSection");
    const other = placeCard(s, "A", { ...G["GD05-130"] }, "hand");
    const attacker = placeCard(s, "B", UNIT({ ap: 9 }), "battleArea");
    s.activePlayer = "B";
    s = runCombat(act(s, "B", { kind: "declareAttack", attackerId: attacker, target: "player" }));
    expect(inZone(s, "A", "trash", office)).toBe(true);
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD05-130-Destroyed", activate: true, targetIds: [] }] });
    expect(inZone(s, "A", "exile", office)).toBe(true);
    expect(entry(s, "A", "GD05-130-Then")?.handChoice?.legalHandIds).toEqual([other]);
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD05-130-Then", activate: true, targetIds: [other] }] });
    expect(inZone(s, "A", "baseSection", other)).toBe(true);
    expect(hasKeyword(findCard(s, other), "Blocker", s)).toBe(false);
  });
});

describe("FAQ GD05-123 — dano 3+ reduzido a ≤2 por outro efeito também não é recebido", () => {
  it("com -1 temporário, 3 vira 2 e a Unit (Orb) fica imune no turno do oponente", () => {
    const s = game();
    placeCard(s, "A", G["GD05-123"], "baseSection");
    const orb = placeCard(s, "A", UNIT({ code: "TEST-ORB", traits: ["Orb"] }), "battleArea");
    findCard(s, orb).damageModifiers = [{ amount: 1, scope: "turn", turn: s.turnNumber }];
    s.activePlayer = "B";
    expect(incomingDamage(s, findCard(s, orb), 3, { kind: "effect", controller: "B", sourceId: "x" }).amount).toBe(0);
    expect(incomingDamage(s, findCard(s, orb), 4, { kind: "effect", controller: "B", sourceId: "x" }).amount).toBe(3);
  });
});
