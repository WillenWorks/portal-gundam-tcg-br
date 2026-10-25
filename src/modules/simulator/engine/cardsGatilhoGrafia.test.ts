import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { effectiveAp } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { enumerateLegalActions } from "./legalActions";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList, ST07_CARD_DEFS } from "../fixtures/st07Deck";
import { buildSt08DeckList, ST08_CARD_DEFS } from "../fixtures/st08Deck";
import { ST06_CARD_DEFS } from "../fixtures/st06Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

/**
 * Specs com o gatilho escrito numa grafia que o motor não despacha ("Activate: Main", "EndOfTurn"):
 * o teste antigo chamava `resolveEffectSpec` direto e passava, mas no jogo a habilidade nunca era
 * oferecida. Aqui tudo vai pelo caminho do jogador — `enumerateLegalActions` + `applyPlayerAction`.
 */

const UNIT = (extra: Partial<CardDef> = {}): CardDef => ({
  code: "TEST-UNIT",
  nameEn: "Test Unit",
  cardType: "UNIT",
  color: "white",
  level: 3,
  cost: 2,
  ap: 3,
  hp: 5,
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
  const state = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 91, firstPlayer: "A" }));
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
const opts = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };
function act(state: GameState, player: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, player, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}
const offeredFrom = (s: GameState, sourceId: string) =>
  enumerateLegalActions(s, "A", ALL_EFFECT_SPECS, opts).filter((a) => a.kind === "activateAbility" && a.sourceInstanceId === sourceId);
const pendingEntry = (s: GameState, player: PlayerId, specId: string) => {
  const d = s.pendingDecision[player];
  return d?.kind === "abilityResolution" ? d.queue.find((q) => q.specId === specId) : undefined;
};
function pair(s: GameState, unitId: string, pilotId: string) {
  findCard(s, unitId).pairedPilotId = pilotId;
  findCard(s, pilotId).pairedUnitId = unitId;
}

describe("ST06-014 Clan Battle — 【Activate·Main】Rest this Base", () => {
  function withClanLink(s: GameState): string {
    const unit = placeCard(s, "A", UNIT({ code: "TEST-CLAN", traits: ["Clan"], link: { kind: "trait", values: ["Clan"] } }), "battleArea");
    const pilot = placeCard(s, "A", PILOT({ code: "TEST-CLAN-P", traits: ["Clan"] }), "battleArea");
    pair(s, unit, pilot);
    return unit;
  }

  it("com Link Unit (Clan): é oferecida, descansa a Base e dá AP+2", () => {
    let s = game();
    const base = placeCard(s, "A", ST06_CARD_DEFS["ST06-014"], "baseSection");
    const unit = withClanLink(s);
    const apBefore = effectiveAp(findCard(s, unit), s);
    expect(offeredFrom(s, base).length).toBeGreaterThan(0);
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: base, targets: { target: [unit] } });
    expect(findCard(s, base).rested).toBe(true);
    expect(effectiveAp(findCard(s, unit), s)).toBe(apBefore + 2);
  });

  it("Base já descansada: o custo não pode ser pago de novo", () => {
    const s = game();
    const base = placeCard(s, "A", ST06_CARD_DEFS["ST06-014"], "baseSection", { rested: true });
    withClanLink(s);
    expect(offeredFrom(s, base)).toEqual([]);
  });

  it("sem Link Unit (Clan): o custo é pago, mas ninguém ganha AP", () => {
    let s = game();
    const base = placeCard(s, "A", ST06_CARD_DEFS["ST06-014"], "baseSection");
    const unit = placeCard(s, "A", UNIT({ code: "TEST-NOLINK", traits: ["Clan"] }), "battleArea");
    const apBefore = effectiveAp(findCard(s, unit), s);
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: base, targets: { target: [unit] } });
    expect(findCard(s, base).rested).toBe(true);
    expect(effectiveAp(findCard(s, unit), s)).toBe(apBefore);
  });
});

describe("ST08-015 Davao — 【Activate·Main】【Once per Turn】②: recupera 2 HP", () => {
  it("é oferecida, cobra ② e cura 2", () => {
    let s = game();
    const davao = placeCard(s, "A", ST08_CARD_DEFS["ST08-015"], "baseSection");
    const unit = placeCard(s, "A", UNIT(), "battleArea", { damage: 3 });
    expect(offeredFrom(s, davao).length).toBeGreaterThan(0);
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: davao, targets: { target: [unit] } });
    expect(findCard(s, unit).damage).toBe(1);
    expect(s.players.A.resourceArea.filter((r) => r.rested).length).toBe(2);
  });

  it("【Once per Turn】: não é oferecida de novo no mesmo turno", () => {
    let s = game();
    const davao = placeCard(s, "A", ST08_CARD_DEFS["ST08-015"], "baseSection");
    const unit = placeCard(s, "A", UNIT(), "battleArea", { damage: 4 });
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: davao, targets: { target: [unit] } });
    expect(offeredFrom(s, davao)).toEqual([]);
  });

  it("sem ② ativos: não é oferecida", () => {
    const s = game();
    for (const r of s.players.A.resourceArea.slice(1)) r.rested = true;
    const davao = placeCard(s, "A", ST08_CARD_DEFS["ST08-015"], "baseSection");
    placeCard(s, "A", UNIT(), "battleArea", { damage: 3 });
    expect(offeredFrom(s, davao)).toEqual([]);
  });
});

describe("ST07-001 Gundam Exia — no fim do seu turno, 7+ (CB) no trash: ativa 1 Recurso", () => {
  function endTurn(s: GameState): GameState {
    let next = act(s, "A", { kind: "finishTurn" });
    for (let i = 0; i < 2 && next.endPhaseAction; i++) next = act(next, next.endPhaseAction.priority, { kind: "passEndPhaseAction" });
    return next;
  }
  function cbTrash(s: GameState, n: number) {
    for (let i = 0; i < n; i++) placeCard(s, "A", UNIT({ code: `TEST-CB-${i}`, traits: ["CB"] }), "trash");
  }

  it("com 7 (CB) no trash: pede o Recurso e o ativa", () => {
    let s = game();
    placeCard(s, "A", ST07_CARD_DEFS["ST07-001"], "battleArea");
    cbTrash(s, 7);
    const res = s.players.A.resourceArea[0].instanceId;
    s.players.A.resourceArea[0].rested = true;
    s = endTurn(s);
    expect(pendingEntry(s, "A", "ST07-001-EndOfTurn")?.legalTargets).toContain(res);
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "ST07-001-EndOfTurn", activate: true, targetIds: [res] }] });
    expect(findCard(s, res).rested).toBe(false);
    expect(s.activePlayer).toBe("B");
  });

  it("com 6 (CB) no trash: não faz nada e o turno passa", () => {
    let s = game();
    placeCard(s, "A", ST07_CARD_DEFS["ST07-001"], "battleArea");
    cbTrash(s, 6);
    s.players.A.resourceArea[0].rested = true;
    const res = s.players.A.resourceArea[0].instanceId;
    s = endTurn(s);
    expect(pendingEntry(s, "A", "ST07-001-EndOfTurn")).toBeUndefined();
    expect(findCard(s, res).rested).toBe(true);
    expect(s.activePlayer).toBe("B");
  });

  it("no fim do turno do oponente: não dispara", () => {
    let s = game();
    s.activePlayer = "B";
    placeCard(s, "A", ST07_CARD_DEFS["ST07-001"], "battleArea");
    cbTrash(s, 7);
    s.players.A.resourceArea[0].rested = true;
    s = act(s, "B", { kind: "finishTurn" });
    for (let i = 0; i < 2 && s.endPhaseAction; i++) s = act(s, s.endPhaseAction.priority, { kind: "passEndPhaseAction" });
    expect(pendingEntry(s, "A", "ST07-001-EndOfTurn")).toBeUndefined();
  });
});
