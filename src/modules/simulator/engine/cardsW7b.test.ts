import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { effectiveCost } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { findCard } from "./events";
import { viewStateFor } from "./viewState";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD05_CARD_DEFS } from "../content/gd05";

/**
 * W7b (C10) — decisão do oponente no meio de um efeito, fluxo real: a `PendingDecision` vai para o
 * oponente, o efeito segue sendo do controlador, a visão do controlador não vê a mão do oponente e o
 * fluxo (combate) retoma depois.
 */

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
  color: "red",
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
const resolve = (state: GameState, player: PlayerId, specId: string, targetIds: string[]) =>
  act(state, player, { kind: "resolveAbility", resolutions: [{ specId, activate: true, targetIds }] });
const inZone = (state: GameState, player: PlayerId, zone: "battleArea" | "hand" | "trash", id: string) =>
  state.players[player][zone].some((c) => c.instanceId === id);
function pairWith(state: GameState, unitDef: CardDef, pilotDef: CardDef): string {
  const unit = placeCard(state, "A", unitDef, "battleArea");
  const pilot = placeCard(state, "A", pilotDef, "battleArea");
  findCard(state, unit).pairedPilotId = pilot;
  findCard(state, pilot).pairedUnitId = unit;
  return unit;
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

describe("GD05-034 Gaia Gundam — o oponente decide se descarta", () => {
  function gaiaBreaksShield(s: GameState): GameState {
    const gaia = pairWith(s, G["GD05-034"], PILOT());
    return runCombat(act(s, "A", { kind: "declareAttack", attackerId: gaia, target: "player" }));
  }

  it("a escolha vai para o OPONENTE; \"não descartar\" é a 1ª opção (padrão do AFK)", () => {
    let s = game();
    placeCard(s, "B", UNIT({ code: "TEST-B-HAND" }), "hand");
    s = gaiaBreaksShield(s);
    expect(s.pendingDecision.A).toBeNull();
    const choice = entry(s, "B", "GD05-034-Choice");
    expect(choice?.enumChoice?.options.map((o) => o.value)).toEqual(["keep", "discard"]);
  });

  it("oponente descarta: carta dele no trash, registro do turno e o GD05-041 fica 2 mais barato", () => {
    let s = game();
    const bCard = placeCard(s, "B", UNIT({ code: "TEST-B-HAND" }), "hand");
    const ma = placeCard(s, "A", G["GD05-041"], "hand");
    expect(effectiveCost(findCard(s, ma).def, s, "A")).toBe(3);
    s = gaiaBreaksShield(s);
    s = resolve(s, "B", "GD05-034-Choice", ["discard"]);
    const discard = entry(s, "B", "GD05-034-Discard");
    expect(discard?.handDiscard?.legalHandIds).toEqual([bCard]);

    // informação oculta: a visão do A mostra a decisão do B sem as cartas da mão dele
    const viewA = viewStateFor(s, "A");
    const redacted = viewA.pendingDecision.B;
    expect(redacted?.kind === "abilityResolution" && redacted.queue[0].handDiscard?.cards).toEqual([]);

    s = resolve(s, "B", "GD05-034-Discard", [bCard]);
    expect(inZone(s, "B", "trash", bCard)).toBe(true);
    expect(s.players.B.discardedByEnemyEffectOnTurn).toBe(s.turnNumber);
    expect(effectiveCost(findCard(s, ma).def, s, "A")).toBe(1);
    expect(s.pendingDecision.A).toBeNull();
    expect(s.combat).toBeNull();
  });

  it("oponente não descarta: o controlador pode deployar (Phantom Pain) Lv.4- da mão", () => {
    let s = game();
    placeCard(s, "B", UNIT(), "hand");
    const pp = placeCard(s, "A", UNIT({ code: "TEST-PP", traits: ["Phantom Pain"], level: 4 }), "hand");
    const big = placeCard(s, "A", UNIT({ code: "TEST-PP5", traits: ["Phantom Pain"], level: 5 }), "hand");
    s = gaiaBreaksShield(s);
    s = resolve(s, "B", "GD05-034-Choice", ["keep"]);
    const keep = entry(s, "A", "GD05-034-Keep");
    expect(keep?.handChoice?.legalHandIds).toEqual([pp]);
    expect(keep?.handChoice?.legalHandIds).not.toContain(big);
    s = resolve(s, "A", "GD05-034-Keep", [pp]);
    expect(inZone(s, "A", "battleArea", pp)).toBe(true);
    expect(s.players.B.discardedByEnemyEffectOnTurn).toBeUndefined();
  });

  it("oponente sem mão: nem pergunta, vai direto ao deploy do controlador", () => {
    let s = game();
    const pp = placeCard(s, "A", UNIT({ code: "TEST-PP", traits: ["Phantom Pain"], level: 2 }), "hand");
    s = gaiaBreaksShield(s);
    expect(s.pendingDecision.B).toBeNull();
    expect(entry(s, "A", "GD05-034-NoHand")?.handChoice?.legalHandIds).toEqual([pp]);
  });

  it("sem Piloto pareado o efeito não existe", () => {
    let s = game();
    placeCard(s, "B", UNIT(), "hand");
    const gaia = placeCard(s, "A", G["GD05-034"], "battleArea");
    s = runCombat(act(s, "A", { kind: "declareAttack", attackerId: gaia, target: "player" }));
    expect(s.pendingDecision.B).toBeNull();
    expect(s.combat).toBeNull();
  });
});

describe("GD05-046 Abyss Gundam (MA Mode)", () => {
  function pairAbyss(s: GameState, pilot: CardDef): GameState {
    const abyss = placeCard(s, "A", G["GD05-046"], "battleArea");
    const pilotId = placeCard(s, "A", pilot, "hand");
    return act(s, "A", { kind: "deployCard", cardInstanceId: pilotId, pairWithUnitId: abyss });
  }

  it("Piloto (Phantom Pain) e oponente com 4+ cartas: o OPONENTE escolhe qual descarta", () => {
    let s = game();
    const bHand = [1, 2, 3, 4].map((i) => placeCard(s, "B", UNIT({ code: `TEST-B${i}` }), "hand"));
    s = pairAbyss(s, PILOT({ traits: ["Phantom Pain"] }));
    expect(s.pendingDecision.A).toBeNull();
    expect(entry(s, "B", "GD05-046-Discard")?.handDiscard?.legalHandIds).toEqual(bHand);
    s = resolve(s, "B", "GD05-046-Discard", [bHand[2]]);
    expect(inZone(s, "B", "trash", bHand[2])).toBe(true);
    expect(s.players.B.hand).toHaveLength(3);
  });

  it("oponente com 3 cartas, ou Piloto de outro trait: nada", () => {
    let s = game();
    [1, 2, 3].forEach((i) => placeCard(s, "B", UNIT({ code: `TEST-B${i}` }), "hand"));
    s = pairAbyss(s, PILOT({ traits: ["Phantom Pain"] }));
    expect(s.pendingDecision.B).toBeNull();

    let t = game();
    [1, 2, 3, 4].forEach((i) => placeCard(t, "B", UNIT({ code: `TEST-B${i}` }), "hand"));
    t = pairAbyss(t, PILOT({ traits: ["Earth Alliance"] }));
    expect(t.pendingDecision.B).toBeNull();
  });
});

describe("GD05-049 Sazabi — cada oponente escolhe 1 Unit fora de batalha", () => {
  it("destrói uma Unit sua; o OPONENTE escolhe a dele (não a que está em batalha) e o combate segue", () => {
    let s = game();
    const sazabi = placeCard(s, "A", G["GD05-049"], "battleArea");
    const fodder = placeCard(s, "A", UNIT({ code: "TEST-FODDER" }), "battleArea");
    const target = placeCard(s, "B", UNIT({ code: "TEST-TARGET" }), "battleArea", { rested: true });
    const spare = placeCard(s, "B", UNIT({ code: "TEST-SPARE" }), "battleArea");

    s = act(s, "A", { kind: "declareAttack", attackerId: sazabi, target: { unitId: target } });
    // W8.5 — o próprio Sazabi também pode ser escolhido ("1 of your Units" não o exclui)
    expect(entry(s, "A", "GD05-049-Attack")?.legalTargets.sort()).toEqual([sazabi, fodder].sort());
    s = resolve(s, "A", "GD05-049-Attack", [fodder]);
    expect(inZone(s, "A", "trash", fodder)).toBe(true);

    const theirs = entry(s, "B", "GD05-049-Then");
    expect(theirs?.legalTargets).toEqual([spare]);
    s = resolve(s, "B", "GD05-049-Then", [spare]);
    expect(inZone(s, "B", "trash", spare)).toBe(true);
    expect(s.combat?.step).toBe("block");
  });

  it("recusar não destrói nada e o combate segue", () => {
    let s = game();
    const sazabi = placeCard(s, "A", G["GD05-049"], "battleArea");
    placeCard(s, "A", UNIT(), "battleArea");
    const theirs = placeCard(s, "B", UNIT(), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: sazabi, target: "player" });
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD05-049-Attack", activate: false, targetIds: [] }] });
    expect(s.pendingDecision.B).toBeNull();
    expect(inZone(s, "B", "battleArea", theirs)).toBe(true);
    expect(s.combat?.step).toBe("block");
  });
});

describe("GD05-107 Interwoven Blessings — destrói as 2 primeiras cartas da área de escudo", () => {
  const BURST_SHIELD: CardDef = { ...G["GD05-107"] };
  /** GD05-107 é Lv.10 */
  const tenResources = (s: GameState) => {
    s.players.A.resourceArea = [];
    for (let i = 0; i < 10; i++) placeCard(s, "A", RESOURCE, "resourceArea");
  };

  it("sem Base: os 2 escudos do topo; escudo com 【Burst】 oferece a decisão ao DONO", () => {
    let s = game();
    s.players.B.shields = [];
    const burst = placeCard(s, "B", BURST_SHIELD, "shields");
    const plain = placeCard(s, "B", SHIELD, "shields");
    const third = placeCard(s, "B", SHIELD, "shields");
    const cmd = placeCard(s, "A", G["GD05-107"], "hand");
    tenResources(s);
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main" });
    expect(inZone(s, "B", "trash", burst) && inZone(s, "B", "trash", plain)).toBe(true);
    expect(s.players.B.shields.map((c) => c.instanceId)).toEqual([third]);
    expect(inZone(s, "A", "trash", cmd)).toBe(true);

    const d = s.pendingDecision.B;
    expect(d?.kind).toBe("burst");
    expect(d?.kind === "burst" && d.cardInstanceId).toBe(burst);
    const exBefore = s.players.B.resourceArea.length;
    s = act(s, "B", { kind: "resolveBurstDecision", activate: true });
    expect(s.players.B.resourceArea.length).toBe(exBefore + 1); // 【Burst】Place 1 EX Resource.
    expect(s.pendingDecision.B).toBeNull();
  });

  it("com Base: a Base é a 1ª carta (destruída) e só 1 escudo sai", () => {
    let s = game();
    const base = placeCard(s, "B", { code: "TEST-BASE", nameEn: "Base", cardType: "BASE", color: "white", level: 1, cost: 1, ap: 0, hp: 5 }, "baseSection");
    const top = s.players.B.shields[0].instanceId;
    const cmd = placeCard(s, "A", G["GD05-107"], "hand");
    tenResources(s);
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main" });
    expect(inZone(s, "B", "trash", base)).toBe(true);
    expect(inZone(s, "B", "trash", top)).toBe(true);
    expect(s.players.B.shields).toHaveLength(2);
  });
});
