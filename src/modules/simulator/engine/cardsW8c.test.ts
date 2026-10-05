import { describe, expect, it } from "vitest";
import { createGame, TOKEN_EX_RESOURCE_CODE } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { effectiveAp, effectiveHp } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { incomingDamage } from "./damageLayer";
import { applyEvent, findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD05_CARD_DEFS } from "../content/gd05";
import { EX_RESOURCE_TOKEN } from "./setup";

/** W8c — as 3 últimas do GD05 + o 【Burst】 do GD05-089, conforme o FAQ oficial (10/07/2026). */

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
const resolve = (state: GameState, player: PlayerId, specId: string, targetIds: string[], secondaryTargetIds?: string[]) =>
  act(state, player, { kind: "resolveAbility", resolutions: [{ specId, activate: true, targetIds, secondaryTargetIds }] });
const inZone = (state: GameState, player: PlayerId, zone: "battleArea" | "hand" | "trash" | "exile", id: string) =>
  state.players[player][zone].some((c) => c.instanceId === id);
const exCount = (s: GameState, p: PlayerId) => s.players[p].resourceArea.filter((r) => r.def.code === TOKEN_EX_RESOURCE_CODE).length;

describe("GD05-017 Nu Gundam — batalha só com o Damage Step (FAQ Q346–Q348)", () => {
  function pairNu(s: GameState): { s: GameState; nu: string } {
    const nu = placeCard(s, "A", G["GD05-017"], "battleArea");
    for (let i = 0; i < 3; i++) placeCard(s, "A", UNIT({ code: `TEST-LB${i}`, traits: ["Londo Bell"] }), "trash");
    const pilot = placeCard(s, "A", PILOT(), "hand");
    return { s: act(s, "A", { kind: "deployCard", cardInstanceId: pilot, pairWithUnitId: nu }), nu };
  }

  it("exila 3 (Londo Bell) e batalha direto no Damage Step: dano dos dois lados, <Breach 5> e volta à Main Phase", () => {
    let s = game();
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", ap: 2, hp: 3 }), "battleArea");
    let nu: string;
    ({ s, nu } = pairNu(s));
    s = resolve(s, "A", "GD05-017-WhenPaired", []);
    expect(s.players.A.exile).toHaveLength(3);
    expect(entry(s, "A", "GD05-017-Then")?.legalTargets).toEqual([enemy]);
    const shieldsBefore = s.players.B.shields.length;
    s = resolve(s, "A", "GD05-017-Then", [enemy]);
    expect(inZone(s, "B", "trash", enemy)).toBe(true);
    expect(findCard(s, nu).damage).toBe(2);
    expect(s.players.B.shields.length).toBe(shieldsBefore - 1); // <Breach 5> ao destruir em batalha (Q348)
    expect(s.combat).toBeNull();
    expect(s.phase).toBe("main");
    expect(findCard(s, nu).rested).toBe(false); // não houve Attack Step: a Unit não descansou
  });

  it("sem 3 (Londo Bell) no trash o efeito não é oferecido", () => {
    let s = game();
    const nu = placeCard(s, "A", G["GD05-017"], "battleArea");
    const pilot = placeCard(s, "A", PILOT(), "hand");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: pilot, pairWithUnitId: nu });
    expect(entry(s, "A", "GD05-017-WhenPaired")).toBeUndefined();
  });
});

describe("GD05-018 Gundam Calibarn (FAQ Q350–Q356)", () => {
  it("【Deploy】 coloca até o limite de 5 EX Resources (com 3, só 2)", () => {
    let s = game();
    for (let i = 0; i < 3; i++) placeCard(s, "A", EX_RESOURCE_TOKEN, "resourceArea");
    const cal = placeCard(s, "A", G["GD05-018"], "hand");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: cal });
    expect(exCount(s, "A")).toBe(5);
  });

  it("EX Resource usado pra pagar: 1 reação por pagamento (mesmo com 2 EX); a Unit escolhida reduz 3 do dano inimigo", () => {
    let s = game();
    const cal = placeCard(s, "A", G["GD05-018"], "battleArea");
    s.players.A.resourceArea = [];
    placeCard(s, "A", EX_RESOURCE_TOKEN, "resourceArea");
    placeCard(s, "A", EX_RESOURCE_TOKEN, "resourceArea");
    const cheap = placeCard(s, "A", UNIT({ code: "TEST-COST2", cost: 2, level: 0 }), "hand");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: cheap });
    expect(exCount(s, "A")).toBe(0);
    const reaction = pending(s, "A")?.queue.filter((q) => q.specId === "GD05-018-Reaction") ?? [];
    expect(reaction).toHaveLength(1);
    s = resolve(s, "A", "GD05-018-Reaction", [cal]);
    expect(incomingDamage(s, findCard(s, cal), 4, { kind: "effect", controller: "B", sourceId: "x" }).amount).toBe(1);
  });
});

describe("GD05-124 White Ark — substitui UMA Unit no custo de descanso (FAQ Q418/Q419)", () => {
  const LM = (code: string) => UNIT({ code, traits: ["League Militaire"] });

  it("no custo \"Rest 2\" do V2 (League Militaire), a Base entra no lugar de uma das Units", () => {
    let s = game();
    const ark = placeCard(s, "A", G["GD05-124"], "baseSection");
    const v2 = placeCard(s, "A", { ...G["GD05-001"], traits: ["League Militaire"] }, "battleArea", { rested: true });
    const u1 = placeCard(s, "A", LM("TEST-LM1"), "battleArea");
    const u2 = placeCard(s, "A", LM("TEST-LM2"), "battleArea");
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: v2 });
    expect(entry(s, "A", "GD05-001-ActivateMain")?.secondaryTarget?.legalTargets).toEqual(expect.arrayContaining([u1, u2, ark]));
    s = resolve(s, "A", "GD05-001-ActivateMain", [], [u1, ark]);
    expect(findCard(s, ark).rested).toBe(true);
    expect(findCard(s, u1).rested).toBe(true);
    expect(findCard(s, u2).rested).toBe(false);
    expect(findCard(s, v2).rested).toBe(false);
  });

  it("sem as Units do custo, a Base não basta (Q418)", () => {
    const s = game();
    placeCard(s, "A", G["GD05-124"], "baseSection");
    const v2 = placeCard(s, "A", { ...G["GD05-001"], traits: ["League Militaire"] }, "battleArea", { rested: true });
    placeCard(s, "A", LM("TEST-LM1"), "battleArea");
    expect(() => act(s, "A", { kind: "activateAbility", sourceInstanceId: v2 })).toThrow(/não há Unit elegível/);
  });
});

describe("GD05-089 Master Asia — 【Burst】 como Unit AP3/HP3 (FAQ Q390/Q391)", () => {
  function breakAsiaShield(s: GameState): GameState {
    s.players.B.shields = [];
    placeCard(s, "B", G["GD05-089"], "shields");
    const attacker = placeCard(s, "A", UNIT({ code: "TEST-ATK", ap: 1 }), "battleArea");
    let next = act(s, "A", { kind: "declareAttack", attackerId: attacker, target: "player" });
    next = act(next, "B", { kind: "skipBlock" });
    for (let i = 0; i < 4 && next.combat?.step === "action"; i++) next = act(next, next.combat.actionPriority, { kind: "passAction" });
    return next;
  }

  it("com 3+ (MF) no trash: ativa o 【Burst】, escolhe entrar como Unit Lv.6 AP3/HP3 e o combate termina", () => {
    let s = game();
    for (let i = 0; i < 3; i++) placeCard(s, "B", UNIT({ code: `TEST-MF${i}`, traits: ["MF"] }), "trash");
    s = breakAsiaShield(s);
    expect(s.pendingDecision.B?.kind).toBe("burst");
    s = act(s, "B", { kind: "resolveBurstDecision", activate: true });
    expect(entry(s, "B", "GD05-089-Then")).toBeDefined();
    s = resolve(s, "B", "GD05-089-Then", []);
    const asia = s.players.B.battleArea.find((c) => c.def.code === "GD05-089")!;
    expect(asia.def.cardType).toBe("UNIT");
    expect(asia.def.level).toBe(6);
    expect([effectiveAp(asia, s), effectiveHp(asia, s)]).toEqual([3, 3]);
    expect(s.combat).toBeNull();

    // pode receber Piloto (Q391) e, ao sair da Battle Area, volta a ser a carta de Piloto
    const p = placeCard(s, "B", PILOT({ code: "TEST-B-PILOT" }), "battleArea");
    findCard(s, asia.instanceId).pairedPilotId = p;
    findCard(s, p).pairedUnitId = asia.instanceId;
    expect(effectiveAp(findCard(s, asia.instanceId), s)).toBe(3);

    // destruída, vai pro trash como a carta de Piloto original
    s = applyEvent(s, { type: "DESTROY_CARD", instanceId: asia.instanceId });
    const inTrash = findCard(s, asia.instanceId);
    expect(inTrash.zone).toBe("trash");
    expect(inTrash.def.cardType).toBe("PILOT");
    expect(inTrash.unitFormOf).toBeUndefined();
  });

  it("sem 3 (MF) no trash, o 【Burst】 só adiciona à mão", () => {
    let s = game();
    s = breakAsiaShield(s);
    s = act(s, "B", { kind: "resolveBurstDecision", activate: true });
    expect(entry(s, "B", "GD05-089-Then")).toBeUndefined();
    expect(s.players.B.hand.some((c) => c.def.code === "GD05-089")).toBe(true);
    expect(s.combat).toBeNull();
  });
});
