import { describe, expect, it } from "vitest";
import { createGame, TOKEN_EX_RESOURCE_CODE } from "./setup";
import { effectiveAp, effectiveCost, hasKeyword, keywordValue } from "./types";
import type { CardDef, GameState, PlayerId } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { dispatchTrigger } from "./dispatcher";
import { attackTargetError, attackIneligibilityReason } from "./combat";
import { enumerateLegalActions } from "./legalActions";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD02_CARD_DEFS } from "../content/gd02";
import { GD03_CARD_DEFS } from "../content/gd03";
import { GD04_CARD_DEFS } from "../content/gd04";
import { TOKEN_PARTS } from "../content/gd04/tokens";

/** W4 — GD04-B: vocabulário pequeno por cima da W3 (ver content/gd04/effectsW4.ts). */

const G = GD04_CARD_DEFS;
const OPTS = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };

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
const CARD = (cardType: CardDef["cardType"], traits: string[] = [], extra: Partial<CardDef> = {}): CardDef => ({
  code: `TEST-${cardType}`,
  nameEn: "Test Card",
  cardType,
  color: "white",
  level: 1,
  cost: 1,
  ap: 1,
  hp: 1,
  traits,
  ...extra,
});
const RESOURCE: CardDef = { code: "TEST-RES", nameEn: "Resource", cardType: "RESOURCE", color: "white", level: 0, cost: 0, ap: 0, hp: 0 };

function game(): GameState {
  const state = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 88, firstPlayer: "A" }));
  for (const p of ["A", "B"] as const) {
    state.players[p].battleArea = [];
    state.players[p].baseSection = [];
    state.players[p].trash = [];
  }
  return state;
}
function resources(state: GameState, player: PlayerId, n: number): void {
  state.players[player].resourceArea = [];
  for (let i = 0; i < n; i++) placeCard(state, player, RESOURCE, "resourceArea");
}
function pair(state: GameState, unitId: string, pilotId: string): void {
  findCard(state, unitId).pairedPilotId = pilotId;
  findCard(state, pilotId).pairedUnitId = unitId;
}
function linkPilot(unit: CardDef, extra: Partial<CardDef> = {}): CardDef {
  const link = unit.link;
  if (!link) throw new Error(`${unit.code} sem link`);
  return link.kind === "pilotName" ? PILOT({ nameEn: link.values[0], ...extra }) : PILOT({ traits: [link.values[0]], ...extra });
}
function act(state: GameState, player: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, player, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}
function runSpec(state: GameState, id: string, sourceId: string, targets: Record<string, string[]> = {}): GameState {
  const s = ALL_EFFECT_SPECS.find((x) => x.id === id);
  if (!s) throw new Error(`spec ${id} ausente`);
  return dispatchTrigger(state, sourceId, s.trigger, [s], { targets, allSpecs: ALL_EFFECT_SPECS, ...OPTS });
}
const battle = (state: GameState, attackerId: string, defenderId: string | "player"): GameState => ({
  ...state,
  combat: {
    attackerId,
    currentTarget: defenderId === "player" ? "player" : { unitId: defenderId },
    originalTarget: defenderId === "player" ? "player" : { unitId: defenderId },
    step: "action",
  } as GameState["combat"],
});

describe("W4 — Units", () => {
  it("001 【During Link】【Attack】: atacando Unit inimiga, pode devolver o Piloto azul pareado à mão", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-001"], "battleArea");
    const pilot = placeCard(state, "A", linkPilot(G["GD04-001"], { color: "blue" }), "battleArea");
    pair(state, self, pilot);
    const enemy = placeCard(state, "B", UNIT(), "battleArea", { rested: true });
    const vsUnit = runSpec(battle(state, self, enemy), "GD04-001-Attack", self);
    expect(vsUnit.players.A.hand.some((c) => c.instanceId === pilot)).toBe(true);
    expect(findCard(vsUnit, self).pairedPilotId).toBeFalsy();
    const vsPlayer = runSpec(battle(state, self, "player"), "GD04-001-Attack", self);
    expect(vsPlayer.players.A.hand.some((c) => c.instanceId === pilot)).toBe(false);
  });

  it("013: descansada, suas Unit tokens (League Militaire) ganham <Blocker>", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-013"], "battleArea");
    const token = placeCard(state, "A", TOKEN_PARTS, "battleArea");
    expect(hasKeyword(findCard(state, token), "Blocker", state)).toBe(false);
    findCard(state, self).rested = true;
    expect(hasKeyword(findCard(state, token), "Blocker", state)).toBe(true);
  });

  it("026 【Deploy】 (fluxo real): olha o topo e manda pro trash ou deixa no topo", () => {
    const state = game();
    resources(state, "A", G["GD04-026"].level ?? 0);
    const self = placeCard(state, "A", G["GD04-026"], "hand");
    const top = state.players.A.deck[0].instanceId;
    const s = act(state, "A", { kind: "deployCard", cardInstanceId: self });
    const options = enumerateLegalActions(s, "A", ALL_EFFECT_SPECS, OPTS).filter((a) => a.kind === "resolveAbility");
    const toTrash = options.find((a) => a.kind === "resolveAbility" && a.resolutions.some((r) => r.targetIds.includes("trash")));
    expect(toTrash).toBeDefined();
    const after = act(s, "A", toTrash as PlayerAction);
    expect(after.players.A.trash.some((c) => c.instanceId === top)).toBe(true);
  });

  it("034 【During Link】: AP+2 por Unit (CB) sua descansada", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-034"], "battleArea");
    pair(state, self, placeCard(state, "A", linkPilot(G["GD04-034"]), "battleArea"));
    const base = effectiveAp(findCard(state, self), state);
    placeCard(state, "A", UNIT({ traits: ["CB"] }), "battleArea", { rested: true });
    placeCard(state, "A", UNIT({ traits: ["CB"] }), "battleArea", { rested: true });
    placeCard(state, "A", UNIT({ traits: ["CB"] }), "battleArea");
    expect(effectiveAp(findCard(state, self), state)).toBe(base + 4);
  });

  it("037: Piloto (Super Soldier) vermelho → <First Strike>; verde → <Breach 3>", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-037"], "battleArea");
    const holder = placeCard(state, "A", UNIT(), "battleArea");
    expect(hasKeyword(findCard(state, self), "First Strike", state)).toBe(false);
    pair(state, holder, placeCard(state, "A", PILOT({ traits: ["Super Soldier"], color: "red" }), "battleArea"));
    expect(hasKeyword(findCard(state, self), "First Strike", state)).toBe(true);
    expect(hasKeyword(findCard(state, self), "Breach", state)).toBe(false);
    const holder2 = placeCard(state, "A", UNIT(), "battleArea");
    pair(state, holder2, placeCard(state, "A", PILOT({ traits: ["Super Soldier"], color: "green" }), "battleArea"));
    expect(keywordValue(findCard(state, self), "Breach", state)).toBe(3);
  });

  it("039: custo -4 na mão com 8+ (Neo Zeon) no trash; 【Deploy】 1 de dano, 3 se o alvo tem <Repair>", () => {
    const state = game();
    const def = G["GD04-039"];
    expect(effectiveCost(def, state, "A")).toBe(def.cost);
    for (let i = 0; i < 8; i++) placeCard(state, "A", CARD("UNIT", ["Neo Zeon"]), "trash");
    expect(effectiveCost(def, state, "A")).toBe(Math.max(0, (def.cost ?? 0) - 4));

    const self = placeCard(state, "A", def, "battleArea");
    const plain = placeCard(state, "B", UNIT({ hp: 5 }), "battleArea");
    const repair = placeCard(state, "B", UNIT({ hp: 5, effectKeywords: ["Repair"], keywordTags: ["Repair 1"] }), "battleArea");
    expect(findCard(runSpec(state, "GD04-039-Deploy", self, { target: [plain] }), plain).damage).toBe(1);
    expect(findCard(runSpec(state, "GD04-039-Deploy", self, { target: [repair] }), repair).damage).toBe(3);
  });

  it("041 【Once per Turn】: descansada por efeito, volta a ficar ativa (1× por turno)", () => {
    const state = game();
    const self = placeCard(state, "B", G["GD04-041"], "battleArea");
    const source = placeCard(state, "A", G["GD04-104"], "trash");
    const once = runSpec(state, "GD04-104-Main", source, { target: [self] });
    expect(findCard(once, self).rested).toBe(false);
    const twice = runSpec(once, "GD04-104-Main", source, { target: [self] });
    expect(findCard(twice, self).rested).toBe(true);
  });

  it("043 【Deploy】: 1 de dano na Base inimiga", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-043"], "battleArea");
    const base = placeCard(state, "B", CARD("BASE", [], { hp: 5 }), "baseSection");
    expect(findCard(runSpec(state, "GD04-043-Deploy", self), base).damage).toBe(1);
  });

  it("044 【Attack】: atacando Unit inimiga com dano → <Breach 3> nesta batalha", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-044"], "battleArea");
    const damaged = placeCard(state, "B", UNIT({ hp: 5 }), "battleArea", { rested: true, damage: 1 });
    const clean = placeCard(state, "B", UNIT(), "battleArea", { rested: true });
    expect(keywordValue(findCard(runSpec(battle(state, self, damaged), "GD04-044-Attack", self), self), "Breach")).toBe(3);
    expect(keywordValue(findCard(runSpec(battle(state, self, clean), "GD04-044-Attack", self), self), "Breach")).toBeNull();
  });

  it("045 【When Linked】: Unit (CB) pode mirar Unit inimiga ATIVA com dano neste turno", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-045"], "battleArea");
    const cb = placeCard(state, "A", UNIT({ traits: ["CB"] }), "battleArea");
    const damaged = placeCard(state, "B", UNIT({ hp: 5 }), "battleArea", { damage: 1 });
    const clean = placeCard(state, "B", UNIT(), "battleArea");
    const after = runSpec(state, "GD04-045-WhenLinked", self, { target: [cb] });
    expect(attackTargetError(after, findCard(after, cb), { unitId: damaged })).toBeNull();
    expect(attackTargetError(after, findCard(after, cb), { unitId: clean })).toMatch(/.+/);
  });

  it("057 【Deploy】: AP- nº de Units \"Gundam Virtue\" no trash", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-057"], "battleArea");
    const enemy = placeCard(state, "B", UNIT({ ap: 5, level: 6 }), "battleArea");
    placeCard(state, "A", CARD("UNIT", [], { nameEn: "Gundam Virtue" }), "trash");
    placeCard(state, "A", CARD("UNIT", [], { nameEn: "Gundam Virtue (Nadleeh)" }), "trash");
    placeCard(state, "A", CARD("COMMAND", [], { nameEn: "Gundam Virtue" }), "trash");
    expect(effectiveAp(findCard(runSpec(state, "GD04-057-Deploy", self, { target: [enemy] }), enemy), state)).toBe(3);
  });

  it("058 【During Pair･(Vulture) Pilot】【Destroyed】: no seu turno o Piloto volta à mão", () => {
    for (const [active, back] of [
      ["A", true],
      ["B", false],
    ] as const) {
      const state = { ...game(), activePlayer: active };
      const self = placeCard(state, "A", G["GD04-058"], "trash");
      const pilot = placeCard(state, "A", PILOT({ traits: ["Vulture"] }), "trash");
      const after = runSpec(state, "GD04-058-Destroyed", self, { formerPairedPilot: [pilot] });
      expect(after.players.A.hand.some((c) => c.instanceId === pilot)).toBe(back);
    }
  });

  it("060 / GD03-062 【Deploy】: só vindo do trash (deploy pagando o custo pelo GD02-110)", () => {
    const state = game();
    resources(state, "A", 8);
    const command = placeCard(state, "A", GD02_CARD_DEFS["GD02-110"], "trash");
    const gx = placeCard(state, "A", GD03_CARD_DEFS["GD03-062"], "trash");
    const enemy = placeCard(state, "B", UNIT({ ap: 3, hp: 5 }), "battleArea");
    let s = runSpec(state, "GD02-110-Main", command, { trashSearch: [gx] });
    expect(findCard(s, gx).enteredFromZone).toBe("trash");
    // o 【Deploy】 tem que disparar sozinho (W6 — antes nunca disparava e um fallback `runSpec` aqui escondia)
    const d = s.pendingDecision.A;
    expect(d?.kind === "abilityResolution" && d.queue.find((q) => q.specId === "GD03-062-Deploy")?.legalTargets).toEqual([enemy]);
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD03-062-Deploy", activate: true, targetIds: [enemy] }] });
    expect(findCard(s, enemy).damage).toBe(2);

    const fromHand = game();
    resources(fromHand, "A", 8);
    const self = placeCard(fromHand, "A", G["GD04-060"], "hand");
    const hand = fromHand.players.A.hand.length;
    const deployed = act(fromHand, "A", { kind: "deployCard", cardInstanceId: self });
    expect(findCard(deployed, self).enteredFromZone).toBe("hand");
    expect(deployed.players.A.hand.length).toBe(hand - 1);
  });

  it("061: não ataca com 6 ou menos cartas no trash", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-061"], "battleArea");
    for (let i = 0; i < 6; i++) placeCard(state, "A", CARD("UNIT"), "trash");
    expect(attackIneligibilityReason(state, findCard(state, self))).toMatch(/trash/);
    placeCard(state, "A", CARD("UNIT"), "trash");
    expect(attackIneligibilityReason(state, findCard(state, self))).toBeNull();
  });

  it("063: filtro \"Lv.1 ou menor OU AP1 ou menor\"", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-063"], "battleArea");
    const lowLv = placeCard(state, "B", UNIT({ level: 1, ap: 5 }), "battleArea");
    const lowAp = placeCard(state, "B", UNIT({ level: 5, ap: 1 }), "battleArea");
    const neither = placeCard(state, "B", UNIT({ level: 5, ap: 5 }), "battleArea");
    const f = ALL_EFFECT_SPECS.find((x) => x.id === "GD04-063-Deploy")?.targetFilter ?? "";
    expect([lowLv, lowAp, neither].map((id) => defaultTargetFilterResolver(f, findCard(state, id), { state, sourceInstanceId: self }))).toEqual([true, true, false]);
  });

  it("071: 【Burst】 só com Unit (CB) inimiga; 【Activate･Main】 exila 1 (Superpower Bloc) + 1 (UN), fica ativa e não ataca", () => {
    const state = game();
    const shield = placeCard(state, "A", G["GD04-071"], "shields");
    expect(runSpec(state, "GD04-071-Burst", shield).players.A.hand.some((c) => c.instanceId === shield)).toBe(false);
    placeCard(state, "B", UNIT({ traits: ["CB"] }), "battleArea");
    expect(runSpec(state, "GD04-071-Burst", shield).players.A.hand.some((c) => c.instanceId === shield)).toBe(true);

    const s2 = game();
    const self = placeCard(s2, "A", G["GD04-071"], "battleArea", { rested: true });
    placeCard(s2, "A", CARD("COMMAND", ["Superpower Bloc"]), "trash");
    expect(() => act(s2, "A", { kind: "activateAbility", sourceInstanceId: self })).toThrow(/trash/);
    placeCard(s2, "A", CARD("PILOT", ["UN"]), "trash");
    const after = act(s2, "A", { kind: "activateAbility", sourceInstanceId: self });
    expect(findCard(after, self).rested).toBe(false);
    expect(after.players.A.exile).toHaveLength(2);
    expect(attackIneligibilityReason(after, findCard(after, self))).toMatch(/.+/);
  });

  it("075: custo -1 por Command (UN)/(Superpower Bloc) no trash", () => {
    const state = game();
    const def = G["GD04-075"];
    placeCard(state, "A", CARD("COMMAND", ["UN"]), "trash");
    placeCard(state, "A", CARD("COMMAND", ["Superpower Bloc"]), "trash");
    placeCard(state, "A", CARD("UNIT", ["UN"]), "trash");
    expect(effectiveCost(def, state, "A")).toBe(Math.max(0, (def.cost ?? 0) - 2));
  });
});

describe("W4 — Pilots e Commands", () => {
  it("094 【When Linked】: busca Unit roxa com <Suppression> no trash", () => {
    const state = game();
    const pilot = placeCard(state, "A", G["GD04-094"], "battleArea");
    const ok = placeCard(state, "A", CARD("UNIT", [], { color: "purple", effectKeywords: ["Suppression"] }), "trash");
    const s = ALL_EFFECT_SPECS.find((x) => x.id === "GD04-094-WhenLinked");
    expect(s).toBeDefined();
    const after = runSpec(state, "GD04-094-WhenLinked", pilot, { trashSearch: [ok] });
    expect(after.players.A.hand.some((c) => c.instanceId === ok)).toBe(true);
    const wrong = placeCard(state, "A", CARD("UNIT", [], { color: "red", effectKeywords: ["Suppression"] }), "trash");
    expect(() => runSpec(state, "GD04-094-WhenLinked", pilot, { trashSearch: [wrong] })).toThrow();
  });

  it("096 【During Link】 (Piloto): dano de batalha em Unit inimiga Lv.5- a destrói (combate real)", () => {
    const state = game();
    const unitDef = UNIT({ ap: 2, link: { kind: "trait", values: ["Test"] } });
    const unit = placeCard(state, "A", unitDef, "battleArea");
    pair(state, unit, placeCard(state, "A", { ...G["GD04-096"], traits: [...(G["GD04-096"].traits ?? []), "Test"] }, "battleArea"));
    const low = placeCard(state, "B", UNIT({ level: 5, ap: 1, hp: 9 }), "battleArea", { rested: true });
    let s = act(state, "A", { kind: "declareAttack", attackerId: unit, target: { unitId: low } });
    s = act(s, "B", { kind: "skipBlock" });
    s = act(s, "B", { kind: "passAction" });
    s = act(s, "A", { kind: "passAction" });
    expect(s.players.B.battleArea.some((c) => c.instanceId === low)).toBe(false);
  });

  it("099 【During Link】【Attack】: devolve um Piloto inimigo à mão do dono", () => {
    const state = game();
    const unit = placeCard(state, "A", UNIT(), "battleArea");
    const self = placeCard(state, "A", G["GD04-099"], "battleArea");
    pair(state, unit, self);
    const enemy = placeCard(state, "B", UNIT(), "battleArea");
    const enemyPilot = placeCard(state, "B", PILOT(), "battleArea");
    pair(state, enemy, enemyPilot);
    const after = dispatchTrigger(state, self, "Attack", ALL_EFFECT_SPECS.filter((x) => x.id === "GD04-099-Attack").map((x) => ({ ...x, duringLink: false })), {
      targets: { target: [enemy] },
      allSpecs: ALL_EFFECT_SPECS,
      ...OPTS,
    });
    expect(after.players.B.hand.some((c) => c.instanceId === enemyPilot)).toBe(true);
    expect(findCard(after, enemy).pairedPilotId).toBeFalsy();
  });

  it("102 【Main】: Unit inimiga descansada Lv.5- não ativa no próximo Start Phase do oponente", () => {
    const state = game();
    const source = placeCard(state, "A", G["GD04-102"], "trash");
    const enemy = placeCard(state, "B", UNIT(), "battleArea", { rested: true });
    const after = runSpec(state, "GD04-102-Main", source, { target: [enemy] });
    expect(findCard(after, enemy).cannotActivateUntilTurn).toBe(after.turnNumber + 1);
  });

  it("116 【Main】: dano = nº de (Minerva Squad) entre as 2 do topo moídas", () => {
    const state = game();
    const source = placeCard(state, "A", G["GD04-116"], "trash");
    const enemy = placeCard(state, "B", UNIT({ ap: 4, hp: 9 }), "battleArea");
    state.players.A.deck[0] = { ...state.players.A.deck[0], def: CARD("UNIT", ["Minerva Squad"]) };
    state.players.A.deck[1] = { ...state.players.A.deck[1], def: CARD("PILOT", ["Minerva Squad"]) };
    const after = runSpec(state, "GD04-116-Main", source, { target: [enemy] });
    expect(findCard(after, enemy).damage).toBe(2);
    expect(after.players.A.trash.length).toBe(3);
  });
});

describe("W4 — vocabulário existente (reação de pareamento, 【Destroyed】 de Unit/Piloto, EX Resource)", () => {
  const exCount = (state: GameState, player: PlayerId) => state.players[player].resourceArea.filter((r) => r.def.code === TOKEN_EX_RESOURCE_CODE).length;

  it("004 【Once per Turn】: parear Piloto (Cyber-Newtype) com Unit azul sua → compra 1; Unit não azul não", () => {
    let state = game();
    resources(state, "A", 6);
    placeCard(state, "A", G["GD04-004"], "battleArea");
    const red = placeCard(state, "A", UNIT({ color: "red" }), "battleArea");
    const blue = placeCard(state, "A", UNIT({ color: "blue" }), "battleArea");
    const hand0 = state.players.A.hand.length;
    const p1 = placeCard(state, "A", PILOT({ traits: ["Cyber-Newtype"] }), "hand");
    state = act(state, "A", { kind: "deployCard", cardInstanceId: p1, pairWithUnitId: red });
    expect(state.players.A.hand.length).toBe(hand0);
    const p2 = placeCard(state, "A", PILOT({ traits: ["Cyber-Newtype"] }), "hand");
    state = act(state, "A", { kind: "deployCard", cardInstanceId: p2, pairWithUnitId: blue });
    expect(state.players.A.hand.length).toBe(hand0 + 1);
  });

  it("025 【Destroyed】: no seu turno, com outra (Dawn of Fold) em jogo, coloca 1 EX Resource", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-025"], "trash");
    const ex0 = exCount(state, "A");
    expect(exCount(runSpec(state, "GD04-025-Destroyed", self), "A")).toBe(ex0);
    placeCard(state, "A", UNIT({ traits: ["Dawn of Fold"] }), "battleArea");
    expect(exCount(runSpec(state, "GD04-025-Destroyed", self), "A")).toBe(ex0 + 1);
    expect(exCount(runSpec({ ...state, activePlayer: "B" }, "GD04-025-Destroyed", self), "A")).toBe(ex0);
  });

  it("086 【During Link】【Destroyed】: sem EX Resource, coloca 1; com EX, nada", () => {
    const state = game();
    state.players.A.resourceArea = state.players.A.resourceArea.filter((r) => !r.def.isToken);
    const self = placeCard(state, "A", G["GD04-086"], "trash");
    const once = runSpec(state, "GD04-086-Destroyed", self);
    expect(exCount(once, "A")).toBe(1);
    expect(exCount(runSpec(once, "GD04-086-Destroyed", self), "A")).toBe(1);
  });

  it("091 【Destroyed】 (Piloto, fluxo real): Unit pareada destruída → 1 de dano numa inimiga sem dano", () => {
    const state = game();
    const unit = placeCard(state, "B", UNIT({ hp: 1 }), "battleArea");
    const pilot = placeCard(state, "B", G["GD04-091"], "battleArea");
    pair(state, unit, pilot);
    const damaged = placeCard(state, "A", UNIT({ hp: 5 }), "battleArea", { damage: 1 });
    const clean = placeCard(state, "A", UNIT({ hp: 5 }), "battleArea");
    const killer = placeCard(state, "A", G["GD04-043"], "trash");
    const after = dispatchTrigger(state, killer, "Deploy", [
      { id: "T-kill", cardCode: "GD04-043", trigger: "Deploy", actions: [{ op: "destroy", target: { kind: "named", name: "target" } }], targetScope: "enemyUnit", sourceText: "teste" },
    ], { targets: { target: [unit] }, allSpecs: ALL_EFFECT_SPECS, ...OPTS });
    const decision = after.pendingDecision.B;
    expect(decision?.kind === "abilityResolution" && decision.queue[0].legalTargets).toEqual([clean]);
    expect(damaged).toBeTruthy();
  });
});
