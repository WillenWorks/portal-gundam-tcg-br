import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { effectiveAp, effectiveDeployCost, hasKeyword, keywordValue } from "./types";
import type { CardDef, GameState, PlayerId } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { dispatchTrigger } from "./dispatcher";
import { enumerateLegalActions } from "./legalActions";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD03_CARD_DEFS } from "../content/gd03";
import { GD02_CARD_DEFS } from "../content/gd02";

/**
 * W2c — fechamento do GD03: exilar do trash (C3), quantidades por contagem (C7), filtro
 * condicional "… instead", Piloto pareado como alvo e os estáticos que faltavam.
 */

const G = GD03_CARD_DEFS;
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
const CARD = (cardType: CardDef["cardType"], traits: string[], nameEn = "Test Card"): CardDef => ({
  code: `TEST-${cardType}-${nameEn}`,
  nameEn,
  cardType,
  color: "white",
  level: 1,
  cost: 1,
  ap: 1,
  hp: 1,
  traits,
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

function toTrash(state: GameState, player: PlayerId, def: CardDef, n = 1): string[] {
  return Array.from({ length: n }, () => placeCard(state, player, def, "trash"));
}

function pair(state: GameState, unitId: string, pilotId: string): void {
  findCard(state, unitId).pairedPilotId = pilotId;
  findCard(state, pilotId).pairedUnitId = unitId;
}

/** Piloto que cumpre a condição de Link da Unit */
function linkPilot(unit: CardDef, extra: Partial<CardDef> = {}): CardDef {
  const link = unit.link;
  if (!link) throw new Error(`${unit.code} sem link`);
  return link.kind === "pilotName" ? PILOT({ nameEn: link.values[0], ...extra }) : PILOT({ traits: [link.values[0]], ...extra });
}

function act(state: GameState, player: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, player, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}

function spec(id: string) {
  const found = ALL_EFFECT_SPECS.find((s) => s.id === id);
  if (!found) throw new Error(`spec ${id} ausente`);
  return found;
}

function runSpec(state: GameState, id: string, sourceId: string, targets: Record<string, string[]> = {}): GameState {
  const s = spec(id);
  return dispatchTrigger(state, sourceId, s.trigger, [s], { targets, allSpecs: ALL_EFFECT_SPECS, ...OPTS });
}

const exiled = (state: GameState, player: PlayerId) => (state.players[player].exile ?? []).length;
const restedResources = (state: GameState, player: PlayerId) => state.players[player].resourceArea.filter((r) => r.rested).length;

describe("W2c — exilar do trash (C3)", () => {
  it("009 【Deploy】: com 2 (Titans) no trash exila as 2 e resta o alvo Lv.4-; com 1, nada", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD03-009"], "battleArea");
    const enemy = placeCard(state, "B", UNIT({ level: 4 }), "battleArea");
    toTrash(state, "A", CARD("UNIT", ["Titans"]), 2);
    const after = runSpec(state, "GD03-009-Deploy", self, { target: [enemy] });
    expect(findCard(after, enemy).rested).toBe(true);
    expect(exiled(after, "A")).toBe(2);
    expect(after.players.A.trash).toHaveLength(0);

    const s2 = game();
    const self2 = placeCard(s2, "A", G["GD03-009"], "battleArea");
    const enemy2 = placeCard(s2, "B", UNIT({ level: 4 }), "battleArea");
    toTrash(s2, "A", CARD("UNIT", ["Titans"]), 1);
    const after2 = runSpec(s2, "GD03-009-Deploy", self2, { target: [enemy2] });
    expect(findCard(after2, enemy2).rested).toBe(false);
    expect(exiled(after2, "A")).toBe(0);
  });

  it("015 【Activate･Main】: exila 3 (Titans) e ganha <Breach 4>; 【Once per Turn】 e custo impagável não são oferecidos", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD03-015"], "battleArea");
    toTrash(state, "A", CARD("COMMAND", ["Titans"]), 5);
    const offered = () => enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).filter((a) => a.kind === "activateAbility");
    expect(offered()).toHaveLength(1);

    // W9 — 5 elegíveis pra 3: a ação oferecida já leva a escolha do exílio (sem ela, vira decisão)
    const after = act(state, "A", offered()[0]);
    expect(keywordValue(findCard(after, self), "Breach", after)).toBe(4);
    expect(exiled(after, "A")).toBe(3);
    expect(enumerateLegalActions(after, "A", ALL_EFFECT_SPECS, OPTS).filter((a) => a.kind === "activateAbility")).toHaveLength(0);
    expect(() => act(after, "A", { kind: "activateAbility", sourceInstanceId: self })).toThrow(/Once per Turn/);

    const s2 = game();
    const self2 = placeCard(s2, "A", G["GD03-015"], "battleArea");
    toTrash(s2, "A", CARD("COMMAND", ["Titans"]), 2);
    expect(enumerateLegalActions(s2, "A", ALL_EFFECT_SPECS, OPTS).filter((a) => a.kind === "activateAbility")).toHaveLength(0);
    expect(() => act(s2, "A", { kind: "activateAbility", sourceInstanceId: self2 })).toThrow(/trash/);
  });

  it("035 【Activate･Main】: paga ① + exila 1 Piloto e dá 1 de dano em todas as Units inimigas", () => {
    const state = game();
    resources(state, "A", 2);
    const self = placeCard(state, "A", G["GD03-035"], "battleArea");
    const e1 = placeCard(state, "B", UNIT(), "battleArea");
    const e2 = placeCard(state, "B", UNIT(), "battleArea");
    toTrash(state, "A", CARD("PILOT", []));
    const after = act(state, "A", { kind: "activateAbility", sourceInstanceId: self });
    expect(findCard(after, e1).damage).toBe(1);
    expect(findCard(after, e2).damage).toBe(1);
    expect(restedResources(after, "A")).toBe(1);
    expect(exiled(after, "A")).toBe(1);

    const s2 = game();
    resources(s2, "A", 2);
    const self2 = placeCard(s2, "A", G["GD03-035"], "battleArea");
    toTrash(s2, "A", CARD("UNIT", []));
    expect(() => act(s2, "A", { kind: "activateAbility", sourceInstanceId: self2 })).toThrow(/trash/);
  });

  it("050 【Activate･Main】: exila 3 Units (Tekkadan)/(Teiwaz) e dá 2 de dano", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD03-050"], "battleArea");
    const enemy = placeCard(state, "B", UNIT({ hp: 5 }), "battleArea");
    toTrash(state, "A", CARD("UNIT", ["Tekkadan"]), 2);
    toTrash(state, "A", CARD("COMMAND", ["Teiwaz"]));
    expect(() => act(state, "A", { kind: "activateAbility", sourceInstanceId: self, targets: { target: [enemy] } })).toThrow(/trash/);
    toTrash(state, "A", CARD("UNIT", ["Teiwaz"]));
    const after = act(state, "A", { kind: "activateAbility", sourceInstanceId: self, targets: { target: [enemy] } });
    expect(findCard(after, enemy).damage).toBe(2);
    expect(exiled(after, "A")).toBe(3);
    expect(after.players.A.trash.map((c) => c.def.cardType)).toEqual(["COMMAND"]);
  });

  it("054 【When Paired･(X-Rounder) Pilot】: com 4 (Vagan) destrói Lv.4-; Piloto sem (X-Rounder), nada", () => {
    for (const [traits, destroyed] of [
      [["X-Rounder"], true],
      [["Vagan"], false],
    ] as const) {
      const state = game();
      const self = placeCard(state, "A", G["GD03-054"], "battleArea");
      pair(state, self, placeCard(state, "A", PILOT({ traits: [...traits] }), "battleArea"));
      const enemy = placeCard(state, "B", UNIT({ level: 4 }), "battleArea");
      toTrash(state, "A", CARD("UNIT", ["Vagan"]), 4);
      const after = runSpec(state, "GD03-054-WhenPaired", self, { target: [enemy] });
      expect(after.players.B.battleArea.some((c) => c.instanceId === enemy)).toBe(!destroyed);
      expect(exiled(after, "A")).toBe(destroyed ? 4 : 0);
    }
  });

  it("059 【Attack】: exila 1 (Vagan) e dá AP+2 a uma Unit (Vagan)", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD03-059"], "battleArea");
    toTrash(state, "A", CARD("PILOT", ["Vagan"]));
    const after = runSpec(state, "GD03-059-Attack", self, { target: [self] });
    expect(effectiveAp(findCard(after, self), after)).toBe((G["GD03-059"].ap ?? 0) + 2);
    expect(exiled(after, "A")).toBe(1);
  });

  it("058: no trash custa 1 a menos ao ser deployada pagando o custo", () => {
    const state = game();
    resources(state, "A", 6);
    const source = placeCard(state, "A", GD02_CARD_DEFS["GD02-110"], "trash");
    const [farsia] = toTrash(state, "A", G["GD03-058"]);
    const after = runSpec(state, "GD02-110-Main", source, { trashSearch: [farsia] });
    expect(after.players.A.battleArea.some((c) => c.instanceId === farsia)).toBe(true);
    expect(restedResources(after, "A")).toBe((G["GD03-058"].cost ?? 0) - 1);
  });
});

describe("W2c — quantidades por contagem (C7)", () => {
  it("033 【Attack】: 1 de dano a cada 4 AP da própria Unit", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD03-033"], "battleArea");
    const enemy = placeCard(state, "B", UNIT({ hp: 9 }), "battleArea");
    const after = runSpec(state, "GD03-033-Attack", self, { target: [enemy] });
    expect(findCard(after, enemy).damage).toBe(Math.floor((G["GD03-033"].ap ?? 0) / 4));

    findCard(state, self).statModifiers.push({ stat: "ap", amount: 3, duration: "endOfTurn", appliedOnTurn: state.turnNumber, appliedBy: "A" });
    const after2 = runSpec(state, "GD03-033-Attack", self, { target: [enemy] });
    expect(findCard(after2, enemy).damage).toBe(Math.floor(((G["GD03-033"].ap ?? 0) + 3) / 4));
  });

  it("071 【Deploy】: AP-1 por Unit (AEUG) no trash; com 0, nenhum modificador", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD03-071"], "battleArea");
    const enemy = placeCard(state, "B", UNIT({ ap: 5 }), "battleArea");
    toTrash(state, "A", CARD("UNIT", ["AEUG"]), 3);
    toTrash(state, "A", CARD("PILOT", ["AEUG"]));
    const after = runSpec(state, "GD03-071-Deploy", self, { target: [enemy] });
    expect(effectiveAp(findCard(after, enemy), after)).toBe(2);

    const s2 = game();
    const self2 = placeCard(s2, "A", G["GD03-071"], "battleArea");
    const enemy2 = placeCard(s2, "B", UNIT({ ap: 5 }), "battleArea");
    const after2 = runSpec(s2, "GD03-071-Deploy", self2, { target: [enemy2] });
    expect(findCard(after2, enemy2).statModifiers).toHaveLength(0);
  });

  it("107 【Main】: dano igual ao nº de Unit tokens aliados; sem token, sem dano", () => {
    const state = game();
    const source = placeCard(state, "A", G["GD03-107"], "trash");
    const enemy = placeCard(state, "B", UNIT({ level: 5, hp: 9 }), "battleArea");
    placeCard(state, "A", { ...UNIT(), isToken: true }, "battleArea");
    placeCard(state, "A", { ...UNIT(), isToken: true }, "battleArea");
    placeCard(state, "A", UNIT(), "battleArea");
    const after = runSpec(state, "GD03-107-Main", source, { target: [enemy] });
    expect(findCard(after, enemy).damage).toBe(2);

    const s2 = game();
    const source2 = placeCard(s2, "A", G["GD03-107"], "trash");
    const enemy2 = placeCard(s2, "B", UNIT({ level: 5 }), "battleArea");
    expect(findCard(runSpec(s2, "GD03-107-Main", source2, { target: [enemy2] }), enemy2).damage).toBe(0);
  });

  it("089: AP+ nº de nomes únicos de Piloto/Command (Cyclops Team) no trash", () => {
    const state = game();
    const unit = placeCard(state, "A", UNIT({ ap: 2 }), "battleArea");
    pair(state, unit, placeCard(state, "A", G["GD03-089"], "battleArea"));
    toTrash(state, "A", CARD("PILOT", ["Cyclops Team"], "Mikhail"), 2);
    toTrash(state, "A", CARD("COMMAND", ["Cyclops Team"], "Plan"));
    toTrash(state, "A", CARD("UNIT", ["Cyclops Team"], "Kämpfer"));
    toTrash(state, "A", CARD("COMMAND", ["Zeon"], "Other"));
    expect(effectiveAp(findCard(state, unit), state)).toBe(2 + 2);
  });
});

describe("W2c — estáticos condicionais", () => {
  it("037 【During Link】: <First Strike> só no seu turno, contra Unit inimiga com 【Destroyed】", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD03-037"], "battleArea");
    pair(state, self, placeCard(state, "A", linkPilot(G["GD03-037"]), "battleArea"));
    const withDestroyed = placeCard(state, "B", UNIT({ triggerKeywords: ["Destroyed"] }), "battleArea");
    const plain = placeCard(state, "B", UNIT(), "battleArea");
    const inBattle = (defender: string): GameState => ({
      ...state,
      combat: { attackerId: self, currentTarget: { unitId: defender }, step: "action" } as GameState["combat"],
    });
    expect(hasKeyword(findCard(state, self), "First Strike", inBattle(withDestroyed))).toBe(true);
    expect(hasKeyword(findCard(state, self), "First Strike", inBattle(plain))).toBe(false);
    expect(hasKeyword(findCard(state, self), "First Strike", state)).toBe(false);
    expect(hasKeyword(findCard(state, self), "First Strike", { ...inBattle(withDestroyed), activePlayer: "B" })).toBe(false);
  });

  it("061: com 1 HP restante ganha <Repair 3>", () => {
    const state = game();
    const hp = G["GD03-061"].hp ?? 0;
    const self = placeCard(state, "A", G["GD03-061"], "battleArea", { damage: hp - 1 });
    expect(keywordValue(findCard(state, self), "Repair", state)).toBe(3);
    findCard(state, self).damage = hp - 2;
    expect(hasKeyword(findCard(state, self), "Repair", state)).toBe(false);
  });

  it("068: <Blocker> só com Base aliada em jogo", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD03-068"], "battleArea");
    expect(hasKeyword(findCard(state, self), "Blocker", state)).toBe(false);
    placeCard(state, "A", CARD("BASE", []), "baseSection");
    expect(hasKeyword(findCard(state, self), "Blocker", state)).toBe(true);
  });

  it("088 【During Link】: Unit (AGE System) ganha AP+1 e <Breach 1>; outra Unit, nada", () => {
    for (const [traits, bonus] of [
      [["AGE System"], true],
      [["Earth Federation"], false],
    ] as const) {
      const state = game();
      const unitDef = UNIT({ ap: 3, traits: [...traits], link: { kind: "pilotName", values: ["Asemu Asuno"] } });
      const unit = placeCard(state, "A", unitDef, "battleArea");
      pair(state, unit, placeCard(state, "A", G["GD03-088"], "battleArea"));
      const base = 3 + (G["GD03-088"].ap ?? 0);
      expect(effectiveAp(findCard(state, unit), state)).toBe(bonus ? base + 1 : base);
      expect(keywordValue(findCard(state, unit), "Breach", state)).toBe(bonus ? 1 : null);
    }
  });

  it("126: Unit tokens aliados têm AP+1 só no turno do oponente", () => {
    const state = game();
    placeCard(state, "A", G["GD03-126"], "baseSection");
    const token = placeCard(state, "A", { ...UNIT({ ap: 2 }), isToken: true }, "battleArea");
    const normal = placeCard(state, "A", UNIT({ ap: 2 }), "battleArea");
    expect(effectiveAp(findCard(state, token), state)).toBe(2);
    const oppTurn = { ...state, activePlayer: "B" as const };
    expect(effectiveAp(findCard(oppTurn, token), oppTurn)).toBe(3);
    expect(effectiveAp(findCard(oppTurn, normal), oppTurn)).toBe(2);
  });

  it("085: custo 0 ao parear com Unit \"Gundam NT-1\" — sem recurso, só esse pareamento é oferecido", () => {
    const state = game();
    resources(state, "A", G["GD03-085"].level ?? 0);
    for (const r of state.players.A.resourceArea) r.rested = true; // nível sim, recurso ativo não
    const nt1 = placeCard(state, "A", UNIT({ nameEn: "Gundam NT-1 (Chobham Armor)" }), "battleArea");
    const other = placeCard(state, "A", UNIT(), "battleArea");
    const christina = placeCard(state, "A", G["GD03-085"], "hand");
    const def = G["GD03-085"];
    expect(effectiveDeployCost(def, state, "A", nt1)).toBe(0);
    expect(effectiveDeployCost(def, state, "A", other)).toBe(def.cost);
    const deploys = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).filter(
      (a) => a.kind === "deployCard" && a.cardInstanceId === christina,
    );
    expect(deploys).toEqual([{ kind: "deployCard", cardInstanceId: christina, pairWithUnitId: nt1 }]);
    const after = act(state, "A", { kind: "deployCard", cardInstanceId: christina, pairWithUnitId: nt1 });
    expect(findCard(after, nt1).pairedPilotId).toBe(christina);
    expect(() => act(state, "A", { kind: "deployCard", cardInstanceId: christina, pairWithUnitId: other })).toThrow();
  });
});

describe("W2c — gatilhos e Commands", () => {
  it("039 【Deploy】: resta outra Unit (Clan) ativa e dá 2 de dano numa inimiga AP2-", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD03-039"], "battleArea");
    const clan = placeCard(state, "A", UNIT({ traits: ["Clan"] }), "battleArea");
    const enemy = placeCard(state, "B", UNIT({ ap: 2 }), "battleArea");
    const after = runSpec(state, "GD03-039-Deploy", self, { target: [clan], enemyTarget: [enemy] });
    expect(findCard(after, clan).rested).toBe(true);
    expect(findCard(after, enemy).damage).toBe(2);
  });

  it("039 fluxo real: sem inimiga AP2-, a Unit (Clan) ainda é restada (o \"if you do\" só condiciona o dano)", () => {
    for (const [enemyAp, dmg] of [
      [5, 0],
      [2, 2],
    ] as const) {
      const state = game();
      resources(state, "A", G["GD03-039"].level ?? 0);
      const red = placeCard(state, "A", G["GD03-039"], "hand");
      const clan = placeCard(state, "A", UNIT({ traits: ["Clan"] }), "battleArea");
      const enemy = placeCard(state, "B", UNIT({ ap: enemyAp }), "battleArea");
      let s = act(state, "A", { kind: "deployCard", cardInstanceId: red });
      const options = enumerateLegalActions(s, "A", ALL_EFFECT_SPECS, OPTS).filter((a) => a.kind === "resolveAbility");
      const chosen = options.find(
        (a) => a.kind === "resolveAbility" && a.resolutions.some((r) => r.activate && r.targetIds.includes(clan)),
      );
      expect(chosen, `AP ${enemyAp}: nenhuma resolução que resta a Unit (Clan)`).toBeDefined();
      s = act(s, "A", chosen as PlayerAction);
      expect(findCard(s, clan).rested).toBe(true);
      expect(findCard(s, enemy).damage).toBe(dmg);
    }
  });

  it("073 【During Link】【Activate･Action】: com 6 (Gjallarhorn) a inimiga em batalha fica AP-3 nesta batalha", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD03-073"], "battleArea");
    pair(state, self, placeCard(state, "A", linkPilot(G["GD03-073"]), "battleArea"));
    const enemy = placeCard(state, "B", UNIT({ ap: 5 }), "battleArea");
    const bystander = placeCard(state, "B", UNIT({ ap: 5 }), "battleArea");
    toTrash(state, "A", CARD("UNIT", ["Gjallarhorn"]), 6);
    const battle = { ...state, combat: { attackerId: enemy, currentTarget: { unitId: self }, step: "action" } as GameState["combat"] };
    const filter = spec("GD03-073-ActivateAction").targetFilter ?? "";
    const ctx = { state: battle, sourceInstanceId: self };
    expect(defaultTargetFilterResolver(filter, findCard(battle, enemy), ctx)).toBe(true);
    expect(defaultTargetFilterResolver(filter, findCard(battle, bystander), ctx)).toBe(false);
    const after = runSpec(battle, "GD03-073-ActivateAction", self, { target: [enemy] });
    expect(effectiveAp(findCard(after, enemy), after)).toBe(2);
    expect(findCard(after, enemy).statModifiers[0]?.duration).toBe("thisBattle");
  });

  it("073: sem Link a habilidade não é oferecida", () => {
    const state = game();
    placeCard(state, "A", G["GD03-073"], "battleArea");
    toTrash(state, "A", CARD("UNIT", ["Gjallarhorn"]), 6);
    placeCard(state, "B", UNIT(), "battleArea");
    const raw = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, { ...OPTS, validate: false });
    expect(raw.filter((a) => a.kind === "activateAbility")).toHaveLength(0);
  });

  it("084 【When Linked】: <Repair 2> na outra Unit escolhida; compra 1 se ela é (Jupitris)", () => {
    for (const [traits, draws] of [
      [["Jupitris"], 1],
      [["Titans"], 0],
    ] as const) {
      const state = game();
      const unit = placeCard(state, "A", UNIT(), "battleArea");
      const scirocco = placeCard(state, "A", G["GD03-084"], "battleArea");
      pair(state, unit, scirocco);
      const other = placeCard(state, "A", UNIT({ traits: [...traits] }), "battleArea");
      const hand = state.players.A.hand.length;
      const after = runSpec(state, "GD03-084-WhenLinked", scirocco, { target: [other] });
      expect(keywordValue(findCard(after, other), "Repair", after)).toBe(2);
      expect(after.players.A.hand.length - hand).toBe(draws);
    }
  });

  it("092 【When Linked】: mói o topo; dano só se a carta moída é (Zeon)/(Clan)", () => {
    for (const [traits, dmg] of [
      [["Clan"], 1],
      [["Titans"], 0],
    ] as const) {
      const state = game();
      const nyaan = placeCard(state, "A", G["GD03-092"], "battleArea");
      const enemy = placeCard(state, "B", UNIT(), "battleArea");
      state.players.A.deck[0] = { ...state.players.A.deck[0], def: CARD("UNIT", [...traits]) };
      const top = state.players.A.deck[0].instanceId;
      const after = runSpec(state, "GD03-092-WhenLinked", nyaan, { target: [enemy] });
      expect(after.players.A.trash.map((c) => c.instanceId)).toContain(top);
      expect(findCard(after, enemy).damage).toBe(dmg);
    }
  });

  it("094 【When Paired】: mói 2; AP-2 se alguma das 2 é (Vagan)", () => {
    const state = game();
    const zeheart = placeCard(state, "A", G["GD03-094"], "battleArea");
    const enemy = placeCard(state, "B", UNIT({ ap: 4 }), "battleArea");
    state.players.A.deck[1] = { ...state.players.A.deck[1], def: CARD("UNIT", ["Vagan"]) };
    const after = runSpec(state, "GD03-094-WhenPaired", zeheart, { target: [enemy] });
    expect(after.players.A.trash).toHaveLength(2);
    expect(effectiveAp(findCard(after, enemy), after)).toBe(2);
  });

  it("078 【During Link】【Destroyed】: o Piloto pareado volta pra mão", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD03-078"], "trash");
    const pilot = placeCard(state, "A", linkPilot(G["GD03-078"]), "trash");
    const after = runSpec(state, "GD03-078-Destroyed", self, { formerPairedPilot: [pilot] });
    expect(after.players.A.hand.some((c) => c.instanceId === pilot)).toBe(true);
  });

  it("102 【Action】: só Link Unit (Titans) em batalha com Unit inimiga; fica ativa", () => {
    const state = game();
    const unitDef = UNIT({ traits: ["Titans"], link: { kind: "trait", values: ["Titans"] } });
    const link = placeCard(state, "A", unitDef, "battleArea", { rested: true });
    pair(state, link, placeCard(state, "A", PILOT({ traits: ["Titans"] }), "battleArea"));
    const notLink = placeCard(state, "A", unitDef, "battleArea", { rested: true });
    const enemy = placeCard(state, "B", UNIT(), "battleArea");
    const battle = { ...state, combat: { attackerId: link, currentTarget: { unitId: enemy }, step: "action" } as GameState["combat"] };
    const filter = spec("GD03-102-Action").targetFilter ?? "";
    expect(defaultTargetFilterResolver(filter, findCard(battle, link), { state: battle })).toBe(true);
    expect(defaultTargetFilterResolver(filter, findCard(battle, notLink), { state: battle })).toBe(false);
    const after = runSpec(battle, "GD03-102-Action", placeCard(battle, "A", G["GD03-102"], "trash"), { target: [link] });
    expect(findCard(after, link).rested).toBe(false);
  });

  it("109: Lv.4- normalmente; com 2+ \"Improved Technique\" no trash, qualquer Unit inimiga", () => {
    const state = game();
    const source = placeCard(state, "A", G["GD03-109"], "trash");
    const big = placeCard(state, "B", UNIT({ level: 6, hp: 5 }), "battleArea");
    const filter = spec("GD03-109-Main").targetFilter ?? "";
    const ctx = () => ({ state, sourceInstanceId: source });
    expect(defaultTargetFilterResolver(filter, findCard(state, big), ctx())).toBe(false);
    placeCard(state, "A", G["GD03-109"], "trash");
    expect(defaultTargetFilterResolver(filter, findCard(state, big), ctx())).toBe(true);
    expect(spec("GD03-109-Burst").targetFilter).toBe(filter);
    expect(findCard(runSpec(state, "GD03-109-Burst", source, { target: [big] }), big).damage).toBe(3);
  });

  it("110: destrói o Piloto pareado com a Unit inimiga Lv.5- (a Unit fica, sem Piloto)", () => {
    const state = game();
    const unit = placeCard(state, "B", UNIT({ level: 5 }), "battleArea");
    const pilot = placeCard(state, "B", PILOT(), "battleArea");
    pair(state, unit, pilot);
    const unpaired = placeCard(state, "B", UNIT({ level: 2 }), "battleArea");
    const filter = spec("GD03-110-Main").targetFilter ?? "";
    expect(defaultTargetFilterResolver(filter, findCard(state, unpaired), { state })).toBe(false);
    const after = runSpec(state, "GD03-110-Main", placeCard(state, "A", G["GD03-110"], "trash"), { target: [unit] });
    expect(after.players.B.trash.some((c) => c.instanceId === pilot)).toBe(true);
    expect(after.players.B.battleArea.some((c) => c.instanceId === unit)).toBe(true);
    expect(findCard(after, unit).pairedPilotId).toBeFalsy();
  });

  it("114: ativa Lv.2- normalmente; com 10+ cartas no trash, ativa Lv.4-", () => {
    const state = game();
    const source = placeCard(state, "A", G["GD03-114"], "trash");
    const lv4 = placeCard(state, "B", UNIT({ level: 4 }), "battleArea");
    const restedLv2 = placeCard(state, "B", UNIT({ level: 2 }), "battleArea", { rested: true });
    const filter = spec("GD03-114-Action").targetFilter ?? "";
    const ok = (id: string) => defaultTargetFilterResolver(filter, findCard(state, id), { state, sourceInstanceId: source });
    expect(ok(lv4)).toBe(false);
    expect(ok(restedLv2)).toBe(false);
    toTrash(state, "A", CARD("UNIT", []), 9);
    expect(ok(lv4)).toBe(true);
  });

  it("117 【Main】: 1–4 inimigas → Graze Custom; 5+ → Barbatos 4th Form; 0 → nada", () => {
    for (const [enemies, token] of [
      [0, null],
      [4, "Graze Custom"],
      [5, "Gundam Barbatos 4th Form"],
    ] as const) {
      const state = game();
      for (let i = 0; i < enemies; i++) placeCard(state, "B", UNIT(), "battleArea");
      const after = runSpec(state, "GD03-117-Main", placeCard(state, "A", G["GD03-117"], "trash"));
      expect(after.players.A.battleArea.map((c) => c.def.nameEn)).toEqual(token ? [token] : []);
    }
  });
});
