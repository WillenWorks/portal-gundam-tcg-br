import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { hasKeyword } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { getCardDefByCode } from "../content/allCardDefs";

/** W10 — EB01, padrões representativos (FAQ EB01 Q310–Q334). */

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
const inZone = (s: GameState, p: PlayerId, zone: "hand" | "trash" | "exile" | "battleArea", id: string) => s.players[p][zone].some((c) => c.instanceId === id);
const deploy = (s: GameState, code: string, pairWithUnitId?: string) =>
  act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", card(code), "hand"), ...(pairWithUnitId ? { pairWithUnitId } : {}) });
function runCombat(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 10 && s.combat && !s.pendingDecision.A && !s.pendingDecision.B; i++) {
    if (s.combat.step === "block") s = act(s, s.combat.defendingPlayer, { kind: "skipBlock" });
    else if (s.combat.step === "action") s = act(s, s.combat.actionPriority, { kind: "passAction" });
    else break;
  }
  return s;
}

describe("EB01 — Development (escolha no exílio) e escolha do oponente", () => {
  it("EB01-010 Development 3: exila as 3 escolhidas e o ■ dá 2 de dano numa Unit inimiga descansada", () => {
    let s = game();
    const gg = [0, 1, 2, 3].map((i) => placeCard(s, "A", GGEN(i), "trash"));
    const rested = placeCard(s, "B", UNIT({ code: "TEST-R", hp: 3 }), "battleArea", { rested: true });
    s = deploy(s, "EB01-010");
    s = resolveWith(s, "A", { specId: "EB01-010-Deploy", trashExileIds: [gg[3], gg[1], gg[0]] });
    expect(inZone(s, "A", "trash", gg[2])).toBe(true);
    s = resolveWith(s, "A", { specId: "EB01-010-Then", targetIds: [rested] });
    expect(findCard(s, rested).damage).toBe(2);
  });

  it("EB01-009: o OPONENTE escolhe 1 Unit ativa dele (Q313) e ela descansa", () => {
    let s = game();
    const a1 = placeCard(s, "B", UNIT({ code: "TEST-B1" }), "battleArea");
    const a2 = placeCard(s, "B", UNIT({ code: "TEST-B2" }), "battleArea");
    s = deploy(s, "EB01-009");
    const e = entry(s, "B", "EB01-009-Then");
    expect(e?.legalTargets.sort()).toEqual([a1, a2].sort());
    s = resolveWith(s, "B", { specId: "EB01-009-Then", targetIds: [a2] });
    expect(findCard(s, a2).rested).toBe(true);
    expect(findCard(s, a1).rested).toBe(false);
  });
});

describe("EB01 — Units", () => {
  it("EB01-002 【Attack】 linkada: com 3+ OUTRAS Units descansadas (de qualquer lado, Q310) fica ativa", () => {
    let s = game();
    const hiNu = placeCard(s, "A", { ...card("EB01-002"), link: { kind: "pilotName", values: ["Amuro Ray"] } }, "battleArea");
    const pilot = placeCard(s, "A", PILOT({ nameEn: "Amuro Ray" }), "battleArea");
    findCard(s, hiNu).pairedPilotId = pilot;
    findCard(s, pilot).pairedUnitId = hiNu;
    placeCard(s, "A", UNIT({ code: "TEST-R1" }), "battleArea", { rested: true });
    placeCard(s, "B", UNIT({ code: "TEST-R2" }), "battleArea", { rested: true });
    placeCard(s, "B", UNIT({ code: "TEST-R3" }), "battleArea", { rested: true });
    s = act(s, "A", { kind: "declareAttack", attackerId: hiNu, target: "player" });
    expect(findCard(s, hiNu).rested).toBe(false);
  });

  it("EB01-017 Haro: destruída com dano de batalha → os dois jogadores compram 1", () => {
    let s = game();
    s.activePlayer = "B";
    const haro = placeCard(s, "A", { ...card("EB01-017"), hp: 1 }, "battleArea", { rested: true });
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK", ap: 3, hp: 5 }), "battleArea");
    const handA = s.players.A.hand.length;
    const handB = s.players.B.hand.length;
    s = runCombat(act(s, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: haro } }));
    expect(inZone(s, "A", "trash", haro)).toBe(true);
    expect(s.players.A.hand).toHaveLength(handA + 1);
    expect(s.players.B.hand).toHaveLength(handB + 1);
  });

  it("EB01-022 Exia: no fim do seu turno, pareada com Piloto (G Generation), pode se destruir e virar 3 tokens", () => {
    let s = game();
    const exia = placeCard(s, "A", card("EB01-022"), "battleArea");
    const pilot = placeCard(s, "A", PILOT({ traits: ["G Generation"] }), "battleArea");
    findCard(s, exia).pairedPilotId = pilot;
    findCard(s, pilot).pairedUnitId = exia;
    s = act(s, "A", { kind: "finishTurn" });
    for (let i = 0; i < 3 && s.endPhaseAction && !pending(s, "A"); i++) s = act(s, s.endPhaseAction.priority, { kind: "passEndPhaseAction" });
    s = resolveWith(s, "A", { specId: "EB01-022-EndOfTurn" });
    expect(inZone(s, "A", "trash", exia)).toBe(true);
    expect(s.players.A.battleArea.filter((c) => c.def.code === "T-025")).toHaveLength(3);
  });

  it("EB01-035: outra (G Generation) Lv.3 sua entra → ganha <Breach 1>; Lv.4 não", () => {
    let s = game();
    const thorn = placeCard(s, "A", card("EB01-035"), "battleArea");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", GGEN(1, { level: 4 }), "hand") });
    expect(hasKeyword(findCard(s, thorn), "Breach", s)).toBe(false);
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", GGEN(2, { level: 3 }), "hand") });
    expect(hasKeyword(findCard(s, thorn), "Breach", s)).toBe(true);
  });

  it("EB01-057: descansa 1 sua Lv.3 ativa e, se fizer, devolve inimiga Lv.2- pra mão", () => {
    let s = game();
    const lv3 = placeCard(s, "A", UNIT({ code: "TEST-L3", level: 3 }), "battleArea");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E2", level: 2 }), "battleArea");
    s = deploy(s, "EB01-057");
    s = resolveWith(s, "A", { specId: "EB01-057-Deploy", targetIds: [lv3] });
    expect(findCard(s, lv3).rested).toBe(true);
    s = resolveWith(s, "A", { specId: "EB01-057-Then", targetIds: [enemy] });
    expect(inZone(s, "B", "hand", enemy)).toBe(true);
  });
});

describe("EB01 — Pilotos, Commands e Bases", () => {
  it("EB01-072 Yuu Kajima: descansa a sua com <Blocker> E a inimiga Lv.4- (Q327: os dois juntos)", () => {
    let s = game();
    const unit = placeCard(s, "A", UNIT(), "battleArea");
    const blocker = placeCard(s, "A", UNIT({ code: "TEST-BL", effectKeywords: ["Blocker"] }), "battleArea");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", level: 4 }), "battleArea");
    s = deploy(s, "EB01-072", unit);
    s = resolveWith(s, "A", { specId: "EB01-072-WhenPaired", targetIds: [blocker], secondaryTargetIds: [enemy] });
    expect(findCard(s, blocker).rested).toBe(true);
    expect(findCard(s, enemy).rested).toBe(true);
  });

  it("EB01-075: descansa 1 a 2 inimigas com HP ≤ 2", () => {
    let s = game();
    const e1 = placeCard(s, "B", UNIT({ code: "TEST-E1", hp: 2 }), "battleArea");
    const e2 = placeCard(s, "B", UNIT({ code: "TEST-E2", hp: 1 }), "battleArea");
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("EB01-075"), "hand"), trigger: "Main", targets: { target: [e1, e2] } });
    expect([findCard(s, e1).rested, findCard(s, e2).rested, inZone(s, "A", "trash", s.players.A.trash[0]?.instanceId ?? "")]).toEqual([true, true, true]);
  });

  it("EB01-086 (Base): quando uma (G Generation) sua linka, ganha <Repair 2> (1× por turno)", () => {
    let s = game();
    placeCard(s, "A", card("EB01-086"), "baseSection");
    const gg = placeCard(s, "A", GGEN(1, { link: { kind: "pilotName", values: ["Link Pilot"] } }), "battleArea");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", PILOT({ nameEn: "Link Pilot" }), "hand"), pairWithUnitId: gg });
    expect(hasKeyword(findCard(s, gg), "Repair", s)).toBe(true);
  });

  it("EB01-090 (Base): no seu turno, devolve inimiga com HP ≤ 2 pra mão", () => {
    let s = game();
    const small = placeCard(s, "B", UNIT({ code: "TEST-S", hp: 2 }), "battleArea");
    s = deploy(s, "EB01-090");
    s = resolveWith(s, "A", { specId: "EB01-090-Deploy", targetIds: [small] });
    expect(inZone(s, "B", "hand", small)).toBe(true);
  });
});
