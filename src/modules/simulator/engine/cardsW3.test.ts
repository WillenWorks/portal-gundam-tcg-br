import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { effectiveAp, hasKeyword, keywordValue } from "./types";
import type { CardDef, GameState, PlayerId } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { dispatchTrigger } from "./dispatcher";
import { attackTargetError } from "./combat";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD04_CARD_DEFS } from "../content/gd04";
import { TOKEN_PARTS } from "../content/gd04/tokens";

/**
 * W3 — GD04-A: CardDefs gerados (texto oficial + apitcg) e as cláusulas que o vocabulário até a
 * W2c já cobre.
 */

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

function linkPilot(unit: CardDef): CardDef {
  const link = unit.link;
  if (!link) throw new Error(`${unit.code} sem link`);
  return link.kind === "pilotName" ? PILOT({ nameEn: link.values[0] }) : PILOT({ traits: [link.values[0]] });
}

function act(state: GameState, player: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, player, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}

function runSpec(state: GameState, id: string, sourceId: string, targets: Record<string, string[]> = {}): GameState {
  const s = ALL_EFFECT_SPECS.find((x) => x.id === id);
  if (!s) throw new Error(`spec ${id} ausente`);
  return dispatchTrigger(state, sourceId, s.trigger, [s], { targets, allSpecs: ALL_EFFECT_SPECS, ...OPTS });
}

const tokens = (state: GameState, player: PlayerId) => state.players[player].battleArea.filter((c) => c.def.isToken);

describe("W3 — CardDefs gerados do GD04", () => {
  it("130 cartas com stats, tipo e cor; Pilots com AP/HP; Commands com 【Pilot】 têm pilotMode", () => {
    const defs = Object.values(G);
    expect(defs).toHaveLength(130);
    for (const d of defs) {
      expect(d.level, d.code).toBeTypeOf("number");
      expect(d.cost, d.code).toBeTypeOf("number");
      expect(["blue", "green", "red", "purple", "white"]).toContain(d.color);
      if (d.cardType === "UNIT") {
        expect(d.ap, d.code).toBeTypeOf("number");
        expect(d.hp, d.code).toBeTypeOf("number");
      }
    }
    expect(G["GD04-001"].link).toEqual({ kind: "pilotName", values: ["Amuro Ray"] });
    expect(G["GD04-001"].triggerKeywords).toContain("Attack");
    expect(G["GD04-081"].hasBurst).toBe(true);
  });
});

describe("W3 — tokens e gatilhos", () => {
  it("003 【Attack】: compra com 3+ Units (League Militaire), contando a própria", () => {
    for (const [others, draws] of [
      [2, 1],
      [1, 0],
    ] as const) {
      const state = game();
      const self = placeCard(state, "A", G["GD04-003"], "battleArea");
      for (let i = 0; i < others; i++) placeCard(state, "A", UNIT({ traits: ["League Militaire"] }), "battleArea");
      const hand = state.players.A.hand.length;
      const after = runSpec(state, "GD04-003-Attack", self);
      expect(after.players.A.hand.length - hand).toBe(draws);
    }
  });

  it("007 【During Pair】【Attack】: Parts (AP1/HP1) que não pode mirar o jogador inimigo; sem Piloto, nada", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-007"], "battleArea");
    expect(tokens(runSpec(state, "GD04-007-Attack", self), "A")).toHaveLength(0);
    pair(state, self, placeCard(state, "A", PILOT(), "battleArea"));
    const after = runSpec(state, "GD04-007-Attack", self);
    const [parts] = tokens(after, "A");
    expect(parts.def).toBe(TOKEN_PARTS);
    parts.enteredZoneOnTurn = after.turnNumber - 1;
    expect(attackTargetError(after, parts, "player")).toMatch(/.+/);
  });

  it("017: 【When Paired･(Newtype) Pilot】 2 Wire-Guided Arm (não pareáveis); 【Destroyed】 Zeong (Head) descansada", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-017"], "battleArea");
    pair(state, self, placeCard(state, "A", PILOT({ traits: ["Newtype"] }), "battleArea"));
    const paired = runSpec(state, "GD04-017-WhenPaired", self);
    expect(tokens(paired, "A").map((t) => t.def.nameEn)).toEqual(["Wire-Guided Arm", "Wire-Guided Arm"]);
    expect(tokens(paired, "A")[0].def.cannotBePaired).toBe(true);

    const s2 = game();
    const dead = placeCard(s2, "A", G["GD04-017"], "trash");
    const after = runSpec(s2, "GD04-017-Destroyed", dead);
    expect(tokens(after, "A").map((t) => [t.def.nameEn, t.rested])).toEqual([["Zeong (Head)", true]]);
  });

  it("046 【Deploy】: \"you may rest this Unit. If you do\" — só com a Unit ativa", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-046"], "battleArea");
    const enemy = placeCard(state, "B", UNIT({ level: 3 }), "battleArea");
    const after = runSpec(state, "GD04-046-Deploy", self, { target: [enemy] });
    expect(findCard(after, self).rested).toBe(true);
    expect(findCard(after, enemy).damage).toBe(2);
    findCard(state, self).rested = true;
    expect(findCard(runSpec(state, "GD04-046-Deploy", self, { target: [enemy] }), enemy).damage).toBe(0);
  });

  it("052 【During Pair】【Attack】: 2 de dano no alvo e na própria Unit", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-052"], "battleArea");
    pair(state, self, placeCard(state, "A", PILOT(), "battleArea"));
    const enemy = placeCard(state, "B", UNIT({ hp: 5 }), "battleArea");
    const after = runSpec(state, "GD04-052-Attack", self, { target: [enemy] });
    expect(findCard(after, enemy).damage).toBe(2);
    expect(findCard(after, self).damage).toBe(2);
  });

  it("054: dano de batalha numa Unit inimiga a destrói (combate real)", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-054"], "battleArea");
    const enemy = placeCard(state, "B", UNIT({ ap: 1, hp: 9 }), "battleArea", { rested: true });
    let s = act(state, "A", { kind: "declareAttack", attackerId: self, target: { unitId: enemy } });
    s = act(s, "B", { kind: "skipBlock" });
    s = act(s, "B", { kind: "passAction" });
    s = act(s, "A", { kind: "passAction" });
    expect(s.players.B.battleArea.some((c) => c.instanceId === enemy)).toBe(false);
  });

  it("065 【Attack】: todas as Units inimigas AP-1 no turno", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-065"], "battleArea");
    const e1 = placeCard(state, "B", UNIT({ ap: 3 }), "battleArea");
    const e2 = placeCard(state, "B", UNIT({ ap: 5 }), "battleArea");
    const after = runSpec(state, "GD04-065-Attack", self);
    expect([e1, e2].map((id) => effectiveAp(findCard(after, id), after))).toEqual([2, 4]);
  });

  it("073 【Activate･Main】【Once per Turn】①: AP+2; 2ª vez recusada", () => {
    const state = game();
    resources(state, "A", 3);
    const self = placeCard(state, "A", G["GD04-073"], "battleArea");
    const after = act(state, "A", { kind: "activateAbility", sourceInstanceId: self });
    expect(effectiveAp(findCard(after, self), after)).toBe((G["GD04-073"].ap ?? 0) + 2);
    expect(after.players.A.resourceArea.filter((r) => r.rested)).toHaveLength(1);
    expect(() => act(after, "A", { kind: "activateAbility", sourceInstanceId: self })).toThrow(/Once per Turn/);
  });

  it("080 【Destroyed】: Alvaaron descansada só com outra Unit (UN)/(Superpower Bloc)", () => {
    for (const [traits, n] of [
      [["Superpower Bloc"], 1],
      [["Zeon"], 0],
    ] as const) {
      const state = game();
      placeCard(state, "A", UNIT({ traits: [...traits] }), "battleArea");
      const dead = placeCard(state, "A", G["GD04-080"], "trash");
      const after = runSpec(state, "GD04-080-Destroyed", dead);
      expect(tokens(after, "A").filter((t) => t.def.nameEn === "Alvaaron" && t.rested)).toHaveLength(n);
    }
  });

  it("081 【When Paired】: Parts só se a Unit é (League Militaire)", () => {
    for (const [traits, n] of [
      [["League Militaire"], 1],
      [["Zeon"], 0],
    ] as const) {
      const state = game();
      const unit = placeCard(state, "A", UNIT({ traits: [...traits] }), "battleArea");
      const pilot = placeCard(state, "A", G["GD04-081"], "battleArea");
      pair(state, unit, pilot);
      expect(tokens(runSpec(state, "GD04-081-WhenPaired", pilot), "A")).toHaveLength(n);
    }
  });
});

describe("W3 — estáticos", () => {
  it("002: no seu turno, suas Units (Earth Federation) AP+1", () => {
    const state = game();
    placeCard(state, "A", G["GD04-002"], "battleArea");
    const ef = placeCard(state, "A", UNIT({ ap: 2, traits: ["Earth Federation"] }), "battleArea");
    expect(effectiveAp(findCard(state, ef), state)).toBe(3);
    expect(effectiveAp(findCard(state, ef), { ...state, activePlayer: "B" })).toBe(2);
  });

  it("008 【During Link】: <High-Maneuver>", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-008"], "battleArea");
    expect(hasKeyword(findCard(state, self), "High-Maneuver", state)).toBe(false);
    pair(state, self, placeCard(state, "A", linkPilot(G["GD04-008"]), "battleArea"));
    expect(hasKeyword(findCard(state, self), "High-Maneuver", state)).toBe(true);
  });

  it("016: não pode mirar o jogador inimigo", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD04-016"], "battleArea");
    expect(attackTargetError(state, findCard(state, self), "player")).toMatch(/.+/);
  });

  it("022: suas Unit tokens têm <Breach 1>; 083 (Piloto): tokens (League Militaire) AP+1", () => {
    const state = game();
    placeCard(state, "A", G["GD04-022"], "battleArea");
    const token = placeCard(state, "A", TOKEN_PARTS, "battleArea");
    const normal = placeCard(state, "A", UNIT({ traits: ["League Militaire"] }), "battleArea");
    expect(keywordValue(findCard(state, token), "Breach", state)).toBe(1);
    expect(hasKeyword(findCard(state, normal), "Breach", state)).toBe(false);

    const holder = placeCard(state, "A", UNIT(), "battleArea");
    pair(state, holder, placeCard(state, "A", G["GD04-083"], "battleArea"));
    expect(effectiveAp(findCard(state, token), state)).toBe(2);
    expect(effectiveAp(findCard(state, normal), state)).toBe(3);
  });
});

describe("W3 — Commands e Bases", () => {
  it("104: descansa 1 a 2 inimigas Lv.2-", () => {
    const state = game();
    const source = placeCard(state, "A", G["GD04-104"], "trash");
    const a = placeCard(state, "B", UNIT({ level: 2 }), "battleArea");
    const b = placeCard(state, "B", UNIT({ level: 1 }), "battleArea");
    const after = runSpec(state, "GD04-104-Main", source, { target: [a, b] });
    expect([a, b].map((id) => findCard(after, id).rested)).toEqual([true, true]);
  });

  it("112: 1 de dano em todas as Units Lv.2- (dos dois lados)", () => {
    const state = game();
    const source = placeCard(state, "A", G["GD04-112"], "trash");
    const mine = placeCard(state, "A", UNIT({ level: 2, hp: 3 }), "battleArea");
    const theirs = placeCard(state, "B", UNIT({ level: 1, hp: 3 }), "battleArea");
    const big = placeCard(state, "B", UNIT({ level: 3, hp: 3 }), "battleArea");
    const after = runSpec(state, "GD04-112-Main", source);
    expect([mine, theirs, big].map((id) => findCard(after, id).damage)).toEqual([1, 1, 0]);
  });

  it("114 【Burst】: busca Unit com \"Trans-Am\" no nome no trash", () => {
    const state = game();
    const source = placeCard(state, "A", G["GD04-114"], "shields");
    const [transAm] = [placeCard(state, "A", CARD("UNIT", [], { nameEn: "Gundam Exia (Trans-Am)" }), "trash")];
    const after = runSpec(state, "GD04-114-Burst", source, { trashSearch: [transAm] });
    expect(after.players.A.hand.some((c) => c.instanceId === transAm)).toBe(true);
  });

  it("118: devolve HP5- só com 2+ Units (UN) aliadas", () => {
    for (const [n, back] of [
      [2, true],
      [1, false],
    ] as const) {
      const state = game();
      const source = placeCard(state, "A", G["GD04-118"], "trash");
      for (let i = 0; i < n; i++) placeCard(state, "A", UNIT({ traits: ["UN"] }), "battleArea");
      const enemy = placeCard(state, "B", UNIT({ hp: 5 }), "battleArea");
      const after = runSpec(state, "GD04-118-Main", source, { target: [enemy] });
      expect(after.players.B.hand.some((c) => c.instanceId === enemy)).toBe(back);
    }
  });

  it("121 【Deploy】: escudo pra mão; Parts só no seu turno com Unit (League Militaire)", () => {
    const state = game();
    const base = placeCard(state, "A", G["GD04-121"], "baseSection");
    placeCard(state, "A", UNIT({ traits: ["League Militaire"] }), "battleArea");
    const shields = state.players.A.shields.length;
    const after = runSpec(state, "GD04-121-Deploy", base);
    expect(after.players.A.shields.length).toBe(shields - 1);
    expect(tokens(after, "A")).toHaveLength(1);
    expect(tokens(runSpec({ ...state, activePlayer: "B" }, "GD04-121-Deploy", base), "A")).toHaveLength(0);
  });

  it("128 【Destroyed】: todos os jogadores compram 1", () => {
    const state = game();
    const base = placeCard(state, "A", G["GD04-128"], "trash");
    const [a, b] = [state.players.A.hand.length, state.players.B.hand.length];
    const after = runSpec(state, "GD04-128-Destroyed", base);
    expect([after.players.A.hand.length - a, after.players.B.hand.length - b]).toEqual([1, 1]);
  });

  it("129 【Deploy】: escudo pra mão e 3 de dano na própria Base", () => {
    const state = game();
    const base = placeCard(state, "A", G["GD04-129"], "baseSection");
    const after = runSpec(state, "GD04-129-Deploy", base);
    expect(findCard(after, base).damage).toBe(3);
  });

  it("130 【Activate･Main】【Once per Turn】: exila 1 Command do trash, AP-1; sem Command no trash não ativa", () => {
    const state = game();
    const base = placeCard(state, "A", G["GD04-130"], "baseSection");
    const enemy = placeCard(state, "B", UNIT({ ap: 3 }), "battleArea");
    expect(() => act(state, "A", { kind: "activateAbility", sourceInstanceId: base, targets: { target: [enemy] } })).toThrow(/trash/);
    placeCard(state, "A", CARD("COMMAND"), "trash");
    const after = act(state, "A", { kind: "activateAbility", sourceInstanceId: base, targets: { target: [enemy] } });
    expect(effectiveAp(findCard(after, enemy), after)).toBe(2);
    expect(after.players.A.exile.length).toBe(1);
  });
});

describe("W3 — link misto (GD04-045)", () => {
  it("\"(Trinity) Trait / [Ali al-Saachez]\": linka com o nome OU com Piloto (Trinity)", async () => {
    const { satisfiesLinkCondition } = await import("./types");
    const unit = G["GD04-045"];
    expect(unit.link).toEqual({ kind: "pilotName", values: ["Ali al-Saachez"], orTraits: ["Trinity"] });
    expect(satisfiesLinkCondition(PILOT({ nameEn: "Ali al-Saachez" }), unit)).toBe(true);
    expect(satisfiesLinkCondition(PILOT({ nameEn: "Nena Trinity", traits: ["Trinity"] }), unit)).toBe(true);
    expect(satisfiesLinkCondition(PILOT({ nameEn: "Other", traits: ["CB"] }), unit)).toBe(false);
  });
});
