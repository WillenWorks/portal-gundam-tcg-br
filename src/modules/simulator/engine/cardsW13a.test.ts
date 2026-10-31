import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { effectiveAp, hasKeyword, keywordValue } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { getCardDefByCode } from "../content/allCardDefs";

/** W13a — GD06 (Stardust Trails): cartas com padrão novo no motor e as com Q&A oficial (Q489–Q548). */

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
const BASE = (extra: Partial<CardDef> = {}): CardDef => ({ code: "TEST-BASE", nameEn: "Test Base", cardType: "BASE", color: "white", level: 1, cost: 1, ap: 0, hp: 5, traits: [], ...extra });
const RESOURCE: CardDef = { code: "TEST-RES", nameEn: "Resource", cardType: "RESOURCE", color: "white", level: 0, cost: 0, ap: 0, hp: 0 };
const SHIELD = UNIT({ code: "TEST-SHIELD", nameEn: "Plain Shield" });

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
const inZone = (s: GameState, p: PlayerId, zone: "hand" | "trash" | "exile" | "battleArea" | "deck" | "baseSection", id: string) =>
  s.players[p][zone].some((c) => c.instanceId === id);
const deploy = (s: GameState, code: string, pairWithUnitId?: string) =>
  act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", card(code), "hand"), ...(pairWithUnitId ? { pairWithUnitId } : {}) });
const play = (s: GameState, code: string, trigger: "Main" | "Action", targets?: Record<string, string[]>) =>
  act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card(code), "hand"), trigger, ...(targets ? { targets } : {}) });
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
/** A ataca `target`; chega no Action Step com a prioridade em A */
function toActionStep(state: GameState, attacker: string, target: { unitId: string } | "player"): GameState {
  let s = act(state, "A", { kind: "declareAttack", attackerId: attacker, target });
  if (s.combat?.step === "block") s = act(s, "B", { kind: "skipBlock" });
  if (s.combat?.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
  return s;
}

describe("GD06 — Units azuis", () => {
  it("GD06-002 【Deploy】: exila 3 Unit cards do trash e devolve 1 Unit inimiga ATIVA à mão", () => {
    let s = game();
    const trashUnits = [0, 1, 2].map((i) => placeCard(s, "A", UNIT({ code: `TEST-T${i}` }), "trash"));
    const active = placeCard(s, "B", UNIT({ code: "TEST-ACTIVE" }), "battleArea");
    const rested = placeCard(s, "B", UNIT({ code: "TEST-RESTED" }), "battleArea", { rested: true });
    s = deploy(s, "GD06-002");
    expect(entry(s, "A", "GD06-002-Deploy")?.legalTargets).toEqual([active]);
    expect(entry(s, "A", "GD06-002-Deploy")?.legalTargets).not.toContain(rested);
    s = resolveWith(s, "A", { specId: "GD06-002-Deploy", targetIds: [active] });
    expect(inZone(s, "B", "hand", active)).toBe(true);
    for (const id of trashUnits) expect(inZone(s, "A", "exile", id)).toBe(true);
  });

  it("GD06-002: destruiu carta inimiga em batalha no seu turno → 1 Unit (Orb) recupera 3 HP (Q489: escudo também conta)", () => {
    let s = game();
    const justice = placeCard(s, "A", card("GD06-002"), "battleArea");
    const orb = placeCard(s, "A", UNIT({ code: "TEST-ORB", hp: 6, traits: ["Orb"] }), "battleArea", { damage: 4 });
    s = toActionStep(s, justice, "player");
    s = runCombat(s);
    s = resolveWith(s, "A", { specId: "GD06-002-DestroyedShield", targetIds: [orb] });
    expect(findCard(s, orb).damage).toBe(1);
  });

  it("GD06-003: AP + nº de cartas na mão; 【Attack】 compra 1 com outra (Alphacide) e mão ≤5", () => {
    let s = game();
    const gqx = placeCard(s, "A", card("GD06-003"), "battleArea");
    const base = card("GD06-003").ap ?? 0;
    for (let i = 0; i < 3; i++) placeCard(s, "A", UNIT({ code: `TEST-H${i}` }), "hand");
    expect(effectiveAp(findCard(s, gqx), s)).toBe(base + 3);
    placeCard(s, "A", UNIT({ code: "TEST-ALPHA", traits: ["Alphacide"] }), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: gqx, target: "player" });
    expect(s.players.A.hand).toHaveLength(4);
  });

  it("GD06-004 【During Link】【Destroyed】 no seu turno: Piloto volta pra mão e descarta 1", () => {
    let s = game();
    const gp01 = placeCard(s, "A", card("GD06-004"), "battleArea");
    const kou = placeCard(s, "A", card("GD06-080"), "battleArea");
    pair(s, gp01, kou);
    const keep = placeCard(s, "A", UNIT({ code: "TEST-KEEP" }), "hand");
    const blocker = placeCard(s, "B", UNIT({ code: "TEST-WALL", ap: 9, hp: 9 }), "battleArea", { rested: true });
    s = toActionStep(s, gp01, { unitId: blocker });
    s = runCombat(s);
    expect(entry(s, "A", "GD06-004-Destroyed")?.handDiscard?.n).toBe(1);
    s = resolveWith(s, "A", { specId: "GD06-004-Destroyed", targetIds: [keep] });
    expect(inZone(s, "A", "hand", kou)).toBe(true);
    expect(inZone(s, "A", "trash", keep)).toBe(true);
  });

  it("GD06-008 【Attack】: AP+2 só com Base (Earth Federation) amiga", () => {
    let s = game();
    placeCard(s, "A", BASE({ traits: ["Earth Federation"] }), "baseSection");
    const gm = placeCard(s, "A", card("GD06-008"), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: gm, target: "player" });
    expect(effectiveAp(findCard(s, gm), s)).toBe((card("GD06-008").ap ?? 0) + 2);
  });

  it("GD06-011 【When Linked】: todas as suas Units ganham <Repair 1>", () => {
    let s = game();
    const red = placeCard(s, "A", card("GD06-011"), "battleArea");
    const other = placeCard(s, "A", UNIT(), "battleArea");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", PILOT({ traits: ["Newtype"] }), "hand"), pairWithUnitId: red });
    expect(keywordValue(findCard(s, other), "Repair", s)).toBe(1);
  });

  it("GD06-014/017: <Blocker> condicional (3+ inimigas / outra Alphacide)", () => {
    const s = game();
    const typeC = placeCard(s, "A", card("GD06-014"), "battleArea");
    const gqx = placeCard(s, "A", card("GD06-017"), "battleArea");
    expect(hasKeyword(findCard(s, typeC), "Blocker", s)).toBe(false);
    expect(hasKeyword(findCard(s, gqx), "Blocker", s)).toBe(false);
    for (let i = 0; i < 3; i++) placeCard(s, "B", UNIT({ code: `TEST-E${i}` }), "battleArea");
    placeCard(s, "A", UNIT({ code: "TEST-ALPHA", traits: ["Alphacide"] }), "battleArea");
    expect(hasKeyword(findCard(s, typeC), "Blocker", s)).toBe(true);
    expect(hasKeyword(findCard(s, gqx), "Blocker", s)).toBe(true);
  });
});

describe("GD06 — Units verdes", () => {
  it("GD06-019 Turn X: 【Attack】 sem token (Ghingnham Fleet) deploya Arms+Legs descansados; inimigas são obrigadas a mirá-los", () => {
    let s = game();
    const turnX = placeCard(s, "A", card("GD06-019"), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: turnX, target: "player" });
    const tokens = s.players.A.battleArea.filter((c) => c.def.isToken);
    expect(tokens.map((c) => c.def.code).sort()).toEqual(["T-031", "T-032"]);
    expect(tokens.every((t) => t.rested)).toBe(true);
    s = runCombat(s);
    s.activePlayer = "B";
    const other = placeCard(s, "A", UNIT({ code: "TEST-OTHER" }), "battleArea", { rested: true });
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK" }), "battleArea");
    expect(() => act(s, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: other } })).toThrow();
    const next = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: tokens[0].instanceId } });
    expect(next.combat?.currentTarget).toEqual({ unitId: tokens[0].instanceId });
  });

  it("GD06-023 Galluss J: descansa, AP+1 numa (Neo Zeon) Lv.3+; se for Link Unit, volta a ficar ativa", () => {
    let s = game();
    const link = placeCard(s, "A", UNIT({ code: "TEST-NZ", level: 4, traits: ["Neo Zeon"], link: { kind: "pilotName", values: ["Test Pilot"] } }), "battleArea");
    pair(s, link, placeCard(s, "A", PILOT(), "battleArea"));
    s = deploy(s, "GD06-023");
    const galluss = s.players.A.battleArea.find((c) => c.def.code === "GD06-023")!.instanceId;
    s = resolveWith(s, "A", { specId: "GD06-023-Deploy-Boost", targetIds: [link] });
    expect(effectiveAp(findCard(s, link), s)).toBe(4);
    expect(findCard(s, galluss).rested).toBe(false);

    let s2 = game();
    const plain = placeCard(s2, "A", UNIT({ code: "TEST-NZ2", level: 3, traits: ["Neo Zeon"] }), "battleArea");
    s2 = deploy(s2, "GD06-023");
    const galluss2 = s2.players.A.battleArea.find((c) => c.def.code === "GD06-023")!.instanceId;
    s2 = resolveWith(s2, "A", { specId: "GD06-023-Deploy-Boost", targetIds: [plain] });
    expect(findCard(s2, galluss2).rested).toBe(true);

    // sem (Neo Zeon) Lv.3+ pro "Then, choose …", o "Rest this Unit." acontece mesmo assim
    let s3 = game();
    s3 = deploy(s3, "GD06-023");
    while (pending(s3, "A")) s3 = resolveWith(s3, "A", { specId: pending(s3, "A")!.queue[0].specId });
    expect(s3.players.A.battleArea.find((c) => c.def.code === "GD06-023")?.rested).toBe(true);
  });

  it("GD06-030 Mahiroo: AP+2 com 3+ OUTRAS (Ghingnham Fleet)/(Long-Range Weapon)", () => {
    const s = game();
    const mahiroo = placeCard(s, "A", card("GD06-030"), "battleArea");
    const base = card("GD06-030").ap ?? 0;
    placeCard(s, "A", UNIT({ code: "TEST-G1", traits: ["Ghingnham Fleet"] }), "battleArea");
    placeCard(s, "A", UNIT({ code: "TEST-G2", traits: ["Long-Range Weapon"] }), "battleArea");
    expect(effectiveAp(findCard(s, mahiroo), s)).toBe(base);
    placeCard(s, "A", UNIT({ code: "TEST-G3", traits: ["Ghingnham Fleet"] }), "battleArea");
    expect(effectiveAp(findCard(s, mahiroo), s)).toBe(base + 2);
  });
});

describe("GD06 — Units vermelhas", () => {
  it("GD06-043 【During Link】 no seu turno: TODAS as outras (Gjallarhorn) ganham AP+1 (inclusive inimigas), ela não", () => {
    const s = game();
    const julieta = placeCard(s, "A", card("GD06-043"), "battleArea");
    pair(s, julieta, placeCard(s, "A", PILOT({ traits: ["Gjallarhorn"] }), "battleArea"));
    const mine = placeCard(s, "A", UNIT({ code: "TEST-GJ", traits: ["Gjallarhorn"] }), "battleArea");
    const theirs = placeCard(s, "B", UNIT({ code: "TEST-GJ2", traits: ["Gjallarhorn"] }), "battleArea");
    const plain = placeCard(s, "A", UNIT({ code: "TEST-PLAIN" }), "battleArea");
    expect(effectiveAp(findCard(s, mine), s)).toBe(4);
    expect(effectiveAp(findCard(s, theirs), s)).toBe(4);
    expect(effectiveAp(findCard(s, plain), s)).toBe(3);
    expect(effectiveAp(findCard(s, julieta), s)).toBe(card("GD06-043").ap);
    s.activePlayer = "B";
    expect(effectiveAp(findCard(s, mine), s)).toBe(3);
  });

  it("GD06-048 【Deploy】: Lv.2- normalmente; com 4+ (Gjallarhorn) no trash, qualquer Unit inimiga", () => {
    let s = game();
    const big = placeCard(s, "B", UNIT({ code: "TEST-BIG", level: 6 }), "battleArea");
    const small = placeCard(s, "B", UNIT({ code: "TEST-SMALL", level: 2 }), "battleArea");
    s = deploy(s, "GD06-048");
    expect(entry(s, "A", "GD06-048-Deploy")?.legalTargets).toEqual([small]);

    let s2 = game();
    const big2 = placeCard(s2, "B", UNIT({ code: "TEST-BIG", level: 6 }), "battleArea");
    for (let i = 0; i < 4; i++) placeCard(s2, "A", UNIT({ code: `TEST-GJ${i}`, traits: ["Gjallarhorn"] }), "trash");
    s2 = deploy(s2, "GD06-048");
    expect(entry(s2, "A", "GD06-048-Deploy")?.legalTargets).toContain(big2);
    expect(big).toBeDefined();
  });
});

describe("GD06 — Units roxas", () => {
  it("GD06-049 【When Paired】 com 10+ (Zeon) Unit cards no trash: destrói a Base inimiga", () => {
    let s = game();
    const gp02 = placeCard(s, "A", card("GD06-049"), "battleArea");
    for (let i = 0; i < 10; i++) placeCard(s, "A", UNIT({ code: `TEST-Z${i}`, traits: ["Zeon"] }), "trash");
    const base = placeCard(s, "B", BASE(), "baseSection");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", PILOT(), "hand"), pairWithUnitId: gp02 });
    expect(inZone(s, "B", "baseSection", base)).toBe(false);
  });

  it("GD06-052/060: estáticos por (Zeon) Unit cards no trash (Command (Zeon) não conta)", () => {
    const s = game();
    const valWalo = placeCard(s, "A", card("GD06-052"), "battleArea");
    const f2 = placeCard(s, "A", card("GD06-060"), "battleArea");
    for (let i = 0; i < 4; i++) placeCard(s, "A", UNIT({ code: `TEST-Z${i}`, traits: ["Zeon"] }), "trash");
    placeCard(s, "A", { ...UNIT({ code: "TEST-ZCMD", traits: ["Zeon"] }), cardType: "COMMAND" }, "trash");
    expect(effectiveAp(findCard(s, f2), s)).toBe((card("GD06-060").ap ?? 0) + 1);
    expect(hasKeyword(findCard(s, valWalo), "High-Maneuver", s)).toBe(false);
    placeCard(s, "A", UNIT({ code: "TEST-Z5", traits: ["Zeon"] }), "trash");
    expect(hasKeyword(findCard(s, valWalo), "High-Maneuver", s)).toBe(true);
  });

  it("GD06-056 Xamel 【Attack】: paga ② e destrói 1 Unit inimiga Lv.2-", () => {
    let s = game();
    for (const r of s.players.A.resourceArea) r.rested = false;
    const xamel = placeCard(s, "A", card("GD06-056"), "battleArea");
    const victim = placeCard(s, "B", UNIT({ code: "TEST-V", level: 2 }), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: xamel, target: "player" });
    s = resolveWith(s, "A", { specId: "GD06-056-Attack", targetIds: [victim] });
    expect(inZone(s, "B", "trash", victim)).toBe(true);
    expect(s.players.A.resourceArea.filter((r) => r.rested)).toHaveLength(2);
  });
});

describe("GD06 — Units brancas", () => {
  it("GD06-064 Altron: AP+3 enquanto há Unit inimiga Lv.5+", () => {
    const s = game();
    const altron = placeCard(s, "A", card("GD06-064"), "battleArea");
    const base = card("GD06-064").ap ?? 0;
    placeCard(s, "B", UNIT({ code: "TEST-L4", level: 4 }), "battleArea");
    expect(effectiveAp(findCard(s, altron), s)).toBe(base);
    placeCard(s, "B", UNIT({ code: "TEST-L5", level: 5 }), "battleArea");
    expect(effectiveAp(findCard(s, altron), s)).toBe(base + 3);
  });

  it("GD06-065 SUMO Gold ④: ativa as (Dianna Counter)/(Militia) com <Blocker> e elas não atacam (Q525)", () => {
    let s = game();
    for (const r of s.players.A.resourceArea) r.rested = false;
    const sumo = placeCard(s, "A", card("GD06-065"), "battleArea", { rested: true });
    const militia = placeCard(s, "A", UNIT({ code: "TEST-MIL", traits: ["Militia"], effectKeywords: ["Blocker"] }), "battleArea", { rested: true });
    const noBlocker = placeCard(s, "A", UNIT({ code: "TEST-DC", traits: ["Dianna Counter"] }), "battleArea", { rested: true });
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: sumo });
    expect(findCard(s, sumo).rested).toBe(false);
    expect(findCard(s, militia).rested).toBe(false);
    expect(findCard(s, noBlocker).rested).toBe(true);
    expect(() => act(s, "A", { kind: "declareAttack", attackerId: militia, target: "player" })).toThrow();
  });

  it("GD06-066 Shadow Gundam 【During Link】【Attack】: ativa o 【Action】 da carta pareada (Q526/Q527)", () => {
    let s = game();
    const shadow = placeCard(s, "A", card("GD06-066"), "battleArea");
    const sturm = placeCard(s, "A", card("GD06-119"), "battleArea");
    pair(s, shadow, sturm);
    findCard(s, sturm).def = { ...card("GD06-119"), nameEn: card("GD06-066").link!.values[0] } as CardDef;
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", hp: 3 }), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: shadow, target: "player" });
    s = resolveWith(s, "A", { specId: "GD06-119-Action", targetIds: [enemy] });
    expect(findCard(s, enemy).rested).toBe(true);
    expect(inZone(s, "A", "battleArea", sturm)).toBe(true);
  });

  it("GD06-071 Shining (Meikyo Shisui): no seu turno, ao ativar Command (Special Move) — inimiga AP-2 e ela AP+2", () => {
    let s = game();
    const shining = placeCard(s, "A", card("GD06-071"), "battleArea");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", ap: 5 }), "battleArea");
    // GD05-110 é (Special Move); o 【Main】 dela causa 2 de dano numa Unit inimiga (outra, aqui)
    const punching = placeCard(s, "B", UNIT({ code: "TEST-BAG", hp: 9 }), "battleArea");
    s = play(s, "GD05-110", "Main", { target: [punching] });
    if (entry(s, "A", "GD05-110-Main")) s = resolveWith(s, "A", { specId: "GD05-110-Main", targetIds: [punching] });
    s = resolveWith(s, "A", { specId: "GD06-071-CommandActivated", targetIds: [enemy] });
    expect(effectiveAp(findCard(s, enemy), s)).toBe(3);
    expect(effectiveAp(findCard(s, shining), s)).toBe((card("GD06-071").ap ?? 0) + 2);
  });
});

describe("GD06 — Pilotos", () => {
  it("GD06-081/083/091: auras do Piloto na Unit pareada condicionadas ao trait/keyword dela", () => {
    const s = game();
    const alpha = placeCard(s, "A", UNIT({ code: "TEST-ALPHA", traits: ["Alphacide"] }), "battleArea");
    pair(s, alpha, placeCard(s, "A", card("GD06-081"), "battleArea"));
    expect(keywordValue(findCard(s, alpha), "Repair", s)).toBe(2);
    const plain = placeCard(s, "A", UNIT({ code: "TEST-PLAIN" }), "battleArea");
    pair(s, plain, placeCard(s, "A", card("GD06-081"), "battleArea"));
    expect(hasKeyword(findCard(s, plain), "Repair", s)).toBe(false);

    const aeug = placeCard(s, "A", UNIT({ code: "TEST-AEUG", traits: ["AEUG"] }), "battleArea");
    pair(s, aeug, placeCard(s, "A", card("GD06-091"), "battleArea"));
    expect(keywordValue(findCard(s, aeug), "Breach", s)).toBe(1);

    const repairUnit = placeCard(s, "A", UNIT({ code: "TEST-REP", effectKeywords: ["Repair"], keywordTags: ["Repair 1"], link: { kind: "pilotName", values: ["Challia Bull"] } }), "battleArea");
    pair(s, repairUnit, placeCard(s, "A", card("GD06-083"), "battleArea"));
    expect(hasKeyword(findCard(s, repairUnit), "High-Maneuver", s)).toBe(true);
  });

  it("GD06-085 Gym Ghingnham 【During Link】: (Ghingnham Fleet) AP+1 só no turno do oponente", () => {
    const s = game();
    const unit = placeCard(s, "A", UNIT({ code: "TEST-GF", traits: ["Ghingnham Fleet"], link: { kind: "pilotName", values: ["Gym Ghingnham"] } }), "battleArea");
    pair(s, unit, placeCard(s, "A", card("GD06-085"), "battleArea"));
    expect(effectiveAp(findCard(s, unit), s)).toBe(3 + (card("GD06-085").ap ?? 0));
    s.activePlayer = "B";
    expect(effectiveAp(findCard(s, unit), s)).toBe(4 + (card("GD06-085").ap ?? 0));
  });

  it("GD06-090/092: nome também conta como [Gaelio Bauduin]/[Mu La Flaga]", () => {
    expect(card("GD06-090").nameAliases).toEqual(["Gaelio Bauduin"]);
    expect(card("GD06-092").nameAliases).toEqual(["Mu La Flaga"]);
  });

  it("GD06-092 【When Paired】 numa (Orb): 1 de dano em inimiga com AP ≤ o desta Unit", () => {
    let s = game();
    const orb = placeCard(s, "A", UNIT({ code: "TEST-ORB", ap: 3, traits: ["Orb"] }), "battleArea");
    const weak = placeCard(s, "B", UNIT({ code: "TEST-WEAK", ap: 4 }), "battleArea");
    const strong = placeCard(s, "B", UNIT({ code: "TEST-STRONG", ap: 9 }), "battleArea");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", card("GD06-092"), "hand"), pairWithUnitId: orb });
    const legal = entry(s, "A", "GD06-092-WhenPaired")?.legalTargets ?? [];
    expect(legal).toContain(weak);
    expect(legal).not.toContain(strong);
  });

  it("GD06-094 Nyaan: a Unit escolhida destrói a inimiga Lv.4- em que causar dano de batalha", () => {
    let s = game();
    const mine = placeCard(s, "A", UNIT({ code: "TEST-MINE", ap: 1, hp: 9 }), "battleArea");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", card("GD06-094"), "hand"), pairWithUnitId: mine });
    s = resolveWith(s, "A", { specId: "GD06-094-WhenPaired", targetIds: [mine] });
    const victim = placeCard(s, "B", UNIT({ code: "TEST-V", level: 4, hp: 9 }), "battleArea", { rested: true });
    s = toActionStep(s, mine, { unitId: victim });
    s = runCombat(s);
    expect(inZone(s, "B", "trash", victim)).toBe(true);
  });

  it("GD06-096 Xavier 【During Link】【Attack】: moeu (Zeon) → todas as inimigas AP-1 nesta batalha", () => {
    let s = game();
    const unit = placeCard(s, "A", UNIT({ code: "TEST-XU", link: { kind: "pilotName", values: ["Xavier Olivette"] } }), "battleArea");
    pair(s, unit, placeCard(s, "A", card("GD06-096"), "battleArea"));
    const top = onTop(s, "A", UNIT({ code: "TEST-ZTOP", traits: ["Zeon"] }));
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", ap: 4 }), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
    expect(inZone(s, "A", "trash", top)).toBe(true);
    expect(effectiveAp(findCard(s, enemy), s)).toBe(3);
  });
});

describe("GD06 — Commands", () => {
  it("GD06-101 【Main】: devolve inimiga HP 5- e compra 1 com Link Unit (Alphacide)", () => {
    let s = game();
    const alpha = placeCard(s, "A", UNIT({ code: "TEST-ALPHA", traits: ["Alphacide"], link: { kind: "pilotName", values: ["Test Pilot"] } }), "battleArea");
    pair(s, alpha, placeCard(s, "A", PILOT(), "battleArea"));
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", hp: 5 }), "battleArea");
    s = play(s, "GD06-101", "Main", { target: [enemy] });
    if (pending(s, "A")) s = resolveWith(s, "A", { specId: "GD06-101-Main", targetIds: [enemy] });
    expect(inZone(s, "B", "hand", enemy)).toBe(true);
    expect(s.players.A.hand).toHaveLength(1);
  });

  it("GD06-106 【Action】: escudos não recebem dano de inimiga com AP 6-", () => {
    let s = game();
    s.activePlayer = "B";
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK", ap: 6 }), "battleArea");
    s = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: "player" });
    s = act(s, "A", { kind: "skipBlock" });
    if (s.combat?.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("GD06-106"), "hand"), trigger: "Action" });
    s = runCombat(s);
    expect(s.players.A.shields).toHaveLength(3);
  });

  it("GD06-109 【Main】: deploya Turn X (Legs) DESCANSADO", () => {
    let s = game();
    s = play(s, "GD06-109", "Main");
    s = resolveWith(s, "A", { specId: "GD06-109-Main", targetIds: ["legs"] });
    const token = s.players.A.battleArea.find((c) => c.def.code === "T-032");
    expect(token?.rested).toBe(true);
  });

  it("GD06-112 【Action】: só inimiga batalhando uma Unit (AEUG) amiga", () => {
    let s = game();
    const aeug = placeCard(s, "A", UNIT({ code: "TEST-AEUG", traits: ["AEUG"] }), "battleArea");
    const battling = placeCard(s, "B", UNIT({ code: "TEST-B", hp: 5 }), "battleArea", { rested: true });
    const outside = placeCard(s, "B", UNIT({ code: "TEST-O" }), "battleArea");
    s = toActionStep(s, aeug, { unitId: battling });
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("GD06-112"), "hand"), trigger: "Action", targets: { target: [battling] } });
    expect(findCard(s, battling).damage).toBe(2);
    expect(() => act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("GD06-112"), "hand"), trigger: "Action", targets: { target: [outside] } })).toThrow();
  });

  it("GD06-115 【Main】: destrói Lv.4-, você ganha Sazabi e o dono da destruída ganha Nu Gundam (Q542)", () => {
    let s = game();
    const victim = placeCard(s, "B", UNIT({ code: "TEST-V", level: 4 }), "battleArea");
    s = play(s, "GD06-115", "Main", { target: [victim] });
    if (pending(s, "A")) s = resolveWith(s, "A", { specId: "GD06-115-Main", targetIds: [victim] });
    expect(inZone(s, "B", "trash", victim)).toBe(true);
    expect(s.players.A.battleArea.map((c) => c.def.code)).toContain("T-033");
    const nu = s.players.B.battleArea.find((c) => c.def.code === "T-034");
    expect(nu && hasKeyword(nu, "First Strike", s)).toBe(true);
  });

  it("GD06-116 【Main】: Unit roxa (Zeon) Lv.5- do trash entra sem pagar custo (Q543)", () => {
    let s = game();
    for (const r of s.players.A.resourceArea) r.rested = false;
    const purple = placeCard(s, "A", UNIT({ code: "TEST-PZ", color: "purple", level: 5, cost: 4, traits: ["Zeon"] }), "trash");
    placeCard(s, "A", UNIT({ code: "TEST-WZ", color: "white", level: 2, traits: ["Zeon"] }), "trash");
    s = play(s, "GD06-116", "Main");
    expect(entry(s, "A", "GD06-116-Main")?.trashSearch?.legalTrashIds).toEqual([purple]);
    s = resolveWith(s, "A", { specId: "GD06-116-Main", targetIds: [purple] });
    expect(inZone(s, "A", "battleArea", purple)).toBe(true);
    expect(s.players.A.resourceArea.filter((r) => r.rested)).toHaveLength(card("GD06-116").cost ?? 0);
  });

  it("GD06-119 Sturm und Drang: depois do 【Action】, pode virar Piloto de uma Unit (MF) (Q546)", () => {
    let s = game();
    const mf = placeCard(s, "A", UNIT({ code: "TEST-MF", traits: ["MF"] }), "battleArea");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", hp: 3 }), "battleArea");
    const sturm = placeCard(s, "A", card("GD06-119"), "hand");
    const attacker = placeCard(s, "A", UNIT({ code: "TEST-ATK" }), "battleArea");
    s = toActionStep(s, attacker, "player");
    s = act(s, "A", { kind: "playCommand", cardInstanceId: sturm, trigger: "Action", targets: { target: [enemy] } });
    if (entry(s, "A", "GD06-119-Action")) s = resolveWith(s, "A", { specId: "GD06-119-Action", targetIds: [enemy] });
    expect(findCard(s, enemy).rested).toBe(true);
    s = resolveWith(s, "A", { specId: "GD06-119-AfterAction", targetIds: [mf] });
    expect(findCard(s, mf).pairedPilotId).toBe(sturm);
  });

  it("GD06-121 Crybaby Poe: AP-2, ou AP-6 se a inimiga tem <High-Maneuver>", () => {
    let s = game();
    const attacker = placeCard(s, "A", UNIT({ code: "TEST-ATK" }), "battleArea");
    const hm = placeCard(s, "B", UNIT({ code: "TEST-HM", ap: 7, effectKeywords: ["High-Maneuver"] }), "battleArea", { rested: true });
    s = toActionStep(s, attacker, { unitId: hm });
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("GD06-121"), "hand"), trigger: "Action", targets: { target: [hm] } });
    expect(effectiveAp(findCard(s, hm), s)).toBe(1);
  });
});

describe("GD06 — Bases", () => {
  it("GD06-123 Endra: no seu turno, com (Neo Zeon) pareada com Piloto Lv.3-, destrói <Blocker> de AP 3-", () => {
    let s = game();
    const nz = placeCard(s, "A", UNIT({ code: "TEST-NZ", traits: ["Neo Zeon"] }), "battleArea");
    pair(s, nz, placeCard(s, "A", PILOT({ level: 3 }), "battleArea"));
    const blocker = placeCard(s, "B", UNIT({ code: "TEST-BL", ap: 3, effectKeywords: ["Blocker"] }), "battleArea");
    s = deploy(s, "GD06-123");
    s = resolveWith(s, "A", { specId: "GD06-123-Deploy", targetIds: [blocker] });
    expect(inZone(s, "B", "trash", blocker)).toBe(true);
    expect(s.players.A.hand).toHaveLength(1);
  });

  it("GD06-127 Yomagn'tho: no seu turno moe 2; com (Alphacide) entre elas destrói inimiga de AP 2-", () => {
    let s = game();
    onTop(s, "A", UNIT({ code: "TEST-A", traits: ["Alphacide"] }));
    onTop(s, "A", UNIT({ code: "TEST-X" }));
    const victim = placeCard(s, "B", UNIT({ code: "TEST-V", ap: 2 }), "battleArea");
    s = deploy(s, "GD06-127");
    s = resolveWith(s, "A", { specId: "GD06-127-Deploy", targetIds: [victim] });
    expect(inZone(s, "B", "trash", victim)).toBe(true);
    expect(s.players.A.trash.filter((c) => c.def.code.startsWith("TEST-"))).toHaveLength(2);
  });

  it("GD06-129 5th Luna 【Destroyed】 com escudos: deploya a Base token Axis", () => {
    let s = game();
    const luna = placeCard(s, "B", card("GD06-129"), "baseSection");
    findCard(s, luna).damage = (card("GD06-129").hp ?? 0) - 1;
    const attacker = placeCard(s, "A", UNIT({ code: "TEST-ATK", ap: 5 }), "battleArea");
    s = toActionStep(s, attacker, "player");
    s = runCombat(s);
    expect(inZone(s, "B", "trash", luna)).toBe(true);
    expect(s.players.B.baseSection.map((c) => c.def.code)).toEqual(["T-037"]);
  });

  it("GD06-130 Soleil: AP da inimiga sem Piloto reduzido pelo nº de (Dianna Counter)/(Militia) amigas", () => {
    let s = game();
    placeCard(s, "A", UNIT({ code: "TEST-DC", traits: ["Dianna Counter"] }), "battleArea");
    placeCard(s, "A", UNIT({ code: "TEST-MIL", traits: ["Militia"] }), "battleArea");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", ap: 5 }), "battleArea");
    s = deploy(s, "GD06-130");
    s = resolveWith(s, "A", { specId: "GD06-130-Deploy", targetIds: [enemy] });
    expect(effectiveAp(findCard(s, enemy), s)).toBe(3);
  });
});
