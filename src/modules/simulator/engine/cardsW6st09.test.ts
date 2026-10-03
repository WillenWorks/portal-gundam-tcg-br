import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { advanceToMainPhase } from "./phases";
import { dispatchTrigger } from "./dispatcher";
import { enumerateLegalActions } from "./legalActions";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { hasKeyword } from "./types";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { ST09_CARD_DEFS as S } from "../content/st09";

/** W6 — ST09 (fluxo real: ações do jogador, escolha pedida pelo motor com os alvos legais). */

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
const BASE: CardDef = { code: "TEST-BASE", nameEn: "Test Base", cardType: "BASE", color: "white", level: 1, cost: 1, ap: 0, hp: 5 };
const RESOURCE: CardDef = { code: "TEST-RES", nameEn: "Resource", cardType: "RESOURCE", color: "white", level: 0, cost: 0, ap: 0, hp: 0 };
const PURPLE_CMD: CardDef = { code: "TEST-PCMD", nameEn: "Purple Command", cardType: "COMMAND", color: "purple", level: 1, cost: 1, ap: 0, hp: 0 };

function game(): GameState {
  const state = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 88, firstPlayer: "A" }));
  for (const p of ["A", "B"] as const) {
    state.players[p].battleArea = [];
    state.players[p].baseSection = [];
    state.players[p].trash = [];
  }
  return state;
}
function pair(state: GameState, unitId: string, pilotId: string): void {
  findCard(state, unitId).pairedPilotId = pilotId;
  findCard(state, pilotId).pairedUnitId = unitId;
}
function resources(state: GameState, player: PlayerId, n: number): string[] {
  state.players[player].resourceArea = [];
  return Array.from({ length: n }, () => placeCard(state, player, RESOURCE, "resourceArea"));
}
function act(state: GameState, player: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, player, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}
function entry(state: GameState, player: PlayerId, specId: string) {
  const d = state.pendingDecision[player];
  return d?.kind === "abilityResolution" ? d.queue.find((q) => q.specId === specId) : undefined;
}
function resolve(state: GameState, player: PlayerId, specId: string, targetIds: string[]): GameState {
  return act(state, player, { kind: "resolveAbility", resolutions: [{ specId, activate: true, targetIds }] });
}
function runCombat(state: GameState): GameState {
  let s = state;
  for (let guard = 0; guard < 10 && s.combat && !s.pendingDecision.A && !s.pendingDecision.B && !s.gameOver; guard++) {
    if (s.combat.step === "block") s = act(s, s.combat.defendingPlayer, { kind: "skipBlock" });
    else if (s.combat.step === "action") s = act(s, s.combat.actionPriority, { kind: "passAction" });
    else break;
  }
  return s;
}
const ids = (cards: { instanceId: string }[]) => cards.map((c) => c.instanceId);
const inZone = (state: GameState, player: PlayerId, zone: "battleArea" | "hand" | "trash" | "deck", id: string) =>
  state.players[player][zone].some((c) => c.instanceId === id);

describe("ST09-001 Impulse Gundam 【Activate·Main】", () => {
  it("②, Unit (e o Piloto pareado) para o fundo do deck → deploya grátis uma \"Impulse Gundam\" Lv.4+ do trash, que encadeia o 【Deploy】 da ST09-006", () => {
    let state = game();
    resources(state, "A", 2);
    const self = placeCard(state, "A", S["ST09-001"], "battleArea");
    const pilot = placeCard(state, "A", PILOT(), "battleArea");
    pair(state, self, pilot);
    const sword = placeCard(state, "A", S["ST09-006"], "trash"); // Lv.4
    placeCard(state, "A", UNIT({ nameEn: "Impulse Gundam Test", level: 3 }), "trash"); // Lv.3: fora
    placeCard(state, "A", UNIT({ nameEn: "Zaku", level: 5 }), "trash"); // nome errado: fora
    const enemyLow = placeCard(state, "B", UNIT({ level: 3 }), "battleArea");
    placeCard(state, "B", UNIT({ level: 4 }), "battleArea");

    state = act(state, "A", { kind: "activateAbility", sourceInstanceId: self });
    expect(entry(state, "A", "ST09-001-ActivateMain")?.trashSearch?.legalTrashIds).toEqual([sword]);

    state = resolve(state, "A", "ST09-001-ActivateMain", [sword]);
    expect(ids(state.players.A.deck.slice(-2))).toEqual([self, pilot]);
    expect(inZone(state, "A", "battleArea", sword)).toBe(true);
    expect(state.players.A.resourceArea.filter((r) => r.rested)).toHaveLength(2); // o deploy não cobra custo
    // ST09-006 veio do trash → pede a Unit inimiga Lv.3-
    expect(entry(state, "A", "ST09-006-Deploy")?.legalTargets).toEqual([enemyLow]);
    state = resolve(state, "A", "ST09-006-Deploy", [enemyLow]);
    expect(inZone(state, "B", "trash", enemyLow)).toBe(true);
  });

  it("sem ② disponível a habilidade não é ofertada", () => {
    const state = game();
    resources(state, "A", 1);
    const self = placeCard(state, "A", S["ST09-001"], "battleArea");
    placeCard(state, "A", S["ST09-006"], "trash");
    const offers = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).filter((a) => a.kind === "activateAbility" && a.sourceInstanceId === self);
    expect(offers).toEqual([]);
  });
});

describe("ST09-006 Sword Impulse Gundam 【Deploy】", () => {
  it("jogada da mão (não do trash): não destrói nada", () => {
    let state = game();
    resources(state, "A", 4);
    placeCard(state, "B", UNIT({ level: 2 }), "battleArea");
    const card = placeCard(state, "A", S["ST09-006"], "hand");
    state = act(state, "A", { kind: "deployCard", cardInstanceId: card });
    expect(entry(state, "A", "ST09-006-Deploy")).toBeUndefined();
    expect(state.players.B.battleArea).toHaveLength(1);
  });
});

describe("ST09-002 Force Impulse Gundam 【Destroyed】", () => {
  it("destruída em batalha → pede Unit (Minerva Squad) do trash sem \"Force Impulse Gundam\" no nome e põe na mão", () => {
    let state = game();
    const attacker = placeCard(state, "A", UNIT({ ap: 9, hp: 9 }), "battleArea");
    const self = placeCard(state, "B", S["ST09-002"], "battleArea", { rested: true });
    const ok = placeCard(state, "B", UNIT({ traits: ["Minerva Squad"] }), "trash");
    placeCard(state, "B", UNIT({ nameEn: "Force Impulse Gundam X", traits: ["Minerva Squad"] }), "trash");
    placeCard(state, "B", PILOT({ traits: ["Minerva Squad"] }), "trash");
    placeCard(state, "B", UNIT({ traits: ["ZAFT"] }), "trash");
    state = runCombat(act(state, "A", { kind: "declareAttack", attackerId: attacker, target: { unitId: self } }));
    expect(inZone(state, "B", "trash", self)).toBe(true);
    expect(entry(state, "B", "ST09-002-Destroyed")?.trashSearch?.legalTrashIds).toEqual([ok]);
    state = resolve(state, "B", "ST09-002-Destroyed", [ok]);
    expect(inZone(state, "B", "hand", ok)).toBe(true);
  });
});

describe("ST09-003 Saviour Gundam 【When Linked】", () => {
  const saviour = (): CardDef => ({ ...S["ST09-003"], link: { kind: "pilotName", values: ["Test Pilot"] } });

  it("5+ cartas roxas no trash: 2 de dano em todas as Units com AP 5- (dos dois lados)", () => {
    let state = game();
    resources(state, "A", 2);
    const self = placeCard(state, "A", saviour(), "battleArea");
    for (let i = 0; i < 5; i++) placeCard(state, "A", PURPLE_CMD, "trash");
    const friendly = placeCard(state, "A", UNIT({ ap: 5, hp: 9 }), "battleArea");
    const enemyLow = placeCard(state, "B", UNIT({ ap: 2, hp: 9 }), "battleArea");
    const enemyHigh = placeCard(state, "B", UNIT({ ap: 6, hp: 9 }), "battleArea");
    const pilot = placeCard(state, "A", PILOT({ ap: 1 }), "hand");
    state = act(state, "A", { kind: "deployCard", cardInstanceId: pilot, pairWithUnitId: self });
    expect(findCard(state, friendly).damage).toBe(2);
    expect(findCard(state, enemyLow).damage).toBe(2);
    expect(findCard(state, enemyHigh).damage).toBe(0);
    expect(findCard(state, self).damage).toBe(0); // AP 5 + 1 do Piloto = 6
  });

  it("só 4 cartas roxas no trash: nada acontece", () => {
    let state = game();
    resources(state, "A", 2);
    const self = placeCard(state, "A", saviour(), "battleArea");
    for (let i = 0; i < 4; i++) placeCard(state, "A", PURPLE_CMD, "trash");
    placeCard(state, "A", UNIT({ color: "red" }), "trash");
    const enemy = placeCard(state, "B", UNIT({ ap: 2, hp: 9 }), "battleArea");
    const pilot = placeCard(state, "A", PILOT(), "hand");
    state = act(state, "A", { kind: "deployCard", cardInstanceId: pilot, pairWithUnitId: self });
    expect(findCard(state, enemy).damage).toBe(0);
  });
});

describe("ST09-004 Freedom Gundam", () => {
  it("ganha <Suppression> só enquanto houver Base amiga em jogo", () => {
    const state = game();
    const self = placeCard(state, "A", S["ST09-004"], "battleArea");
    expect(hasKeyword(findCard(state, self), "Suppression", state)).toBe(false);
    placeCard(state, "B", BASE, "baseSection");
    expect(hasKeyword(findCard(state, self), "Suppression", state)).toBe(false); // Base inimiga não conta
    placeCard(state, "A", BASE, "baseSection");
    expect(hasKeyword(findCard(state, self), "Suppression", state)).toBe(true);
  });
});

describe("ST09-008 Shinn Asuka 【Attack】", () => {
  it("pareado com Unit (Minerva Squad): ao atacar, pede 1 Recurso descansado e o ativa", () => {
    let state = game();
    const [r1, r2] = resources(state, "A", 2);
    findCard(state, r1).rested = true;
    const unit = placeCard(state, "A", UNIT({ traits: ["Minerva Squad"] }), "battleArea");
    pair(state, unit, placeCard(state, "A", S["ST09-008"], "battleArea"));
    state = act(state, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
    expect(entry(state, "A", "ST09-008-Attack")?.legalTargets).toEqual([r1]);
    state = resolve(state, "A", "ST09-008-Attack", [r1]);
    expect(findCard(state, r1).rested).toBe(false);
    expect(findCard(state, r2).rested).toBe(false);
  });

  it("pareado com Unit sem (Minerva Squad): não pede nada", () => {
    let state = game();
    const [r1] = resources(state, "A", 1);
    findCard(state, r1).rested = true;
    const unit = placeCard(state, "A", UNIT({ traits: ["ZAFT"] }), "battleArea");
    pair(state, unit, placeCard(state, "A", S["ST09-008"], "battleArea"));
    state = act(state, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
    expect(entry(state, "A", "ST09-008-Attack")).toBeUndefined();
    expect(findCard(state, r1).rested).toBe(true);
  });
});

describe("ST09-009 Giant Killing 【Main】/【Action】", () => {
  it("só Units inimigas ATIVAS com AP 4- são alvo; destrói a escolhida", () => {
    let state = game();
    const def = S["ST09-009"];
    resources(state, "A", Math.max(def.level ?? 0, def.cost ?? 0));
    const ok = placeCard(state, "B", UNIT({ ap: 4 }), "battleArea");
    placeCard(state, "B", UNIT({ ap: 4 }), "battleArea", { rested: true });
    placeCard(state, "B", UNIT({ ap: 5 }), "battleArea");
    placeCard(state, "A", UNIT({ ap: 1 }), "battleArea");
    const card = placeCard(state, "A", def, "hand");
    const offers = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).filter(
      (a) => a.kind === "playCommand" && a.cardInstanceId === card && a.trigger === "Main",
    );
    expect(offers.map((a) => (a.kind === "playCommand" ? a.targets?.target : undefined))).toEqual([[ok]]);
    state = act(state, "A", { kind: "playCommand", cardInstanceId: card, trigger: "Main", targets: { target: [ok] } });
    expect(inZone(state, "B", "trash", ok)).toBe(true);
  });
});

describe("ST09-010 Minerva 【Deploy】", () => {
  it("no próprio turno: 1 Shield para a mão, olha o topo 2, um volta ao topo e o outro vai para o trash", () => {
    let state = game();
    resources(state, "A", 2);
    const shieldsBefore = state.players.A.shields.length;
    const handBefore = state.players.A.hand.length;
    const [top1, top2] = ids(state.players.A.deck.slice(0, 2));
    const card = placeCard(state, "A", S["ST09-010"], "hand");
    state = act(state, "A", { kind: "deployCard", cardInstanceId: card });
    const e = entry(state, "A", "ST09-010-Deploy");
    expect(e?.deckReorder?.slots.map((s) => s.position)).toEqual(["top", "trash"]);
    expect(ids(e?.deckReorder?.topCards ?? [])).toEqual([top1, top2]);
    state = resolve(state, "A", "ST09-010-Deploy", [top2, top1]);
    expect(state.players.A.shields).toHaveLength(shieldsBefore - 1);
    expect(state.players.A.hand).toHaveLength(handBefore + 1); // o Shield (a Minerva foi posta na mão e saiu)
    expect(state.players.A.deck[0].instanceId).toBe(top2);
    expect(inZone(state, "A", "trash", top1)).toBe(true);
  });

  it("pelo 【Burst】 no turno do oponente: só o Shield para a mão, sem olhar o deck", () => {
    let state = game();
    const deckBefore = ids(state.players.B.deck);
    const shieldsBefore = state.players.B.shields.length;
    const handBefore = state.players.B.hand.length;
    const shield = placeCard(state, "B", S["ST09-010"], "shields");
    state = dispatchTrigger(state, shield, "Burst", ALL_EFFECT_SPECS, { ...OPTS, allSpecs: ALL_EFFECT_SPECS });
    expect(state.players.B.baseSection.some((c) => c.instanceId === shield)).toBe(true);
    expect(entry(state, "B", "ST09-010-Deploy")).toBeUndefined();
    expect(state.players.B.hand).toHaveLength(handBefore + 1);
    expect(state.players.B.shields).toHaveLength(shieldsBefore - 1);
    expect(ids(state.players.B.deck)).toEqual(deckBefore);
  });
});
