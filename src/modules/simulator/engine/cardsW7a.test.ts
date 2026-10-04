import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { enumerateLegalActions } from "./legalActions";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD05_CARD_DEFS } from "../content/gd05";

/**
 * W7a (C9) — escolha de modo, fluxo real: só ações de jogador. O motor pede o MODO (enum), depois o alvo
 * do modo escolhido, aplica o efeito e só então manda a Command pro trash (CR 3-4-4).
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
    for (let i = 0; i < 3; i++) placeCard(state, p, SHIELD, "shields");
    resources(state, p, 8);
  }
  return state;
}
function resources(state: GameState, player: PlayerId, n: number): void {
  state.players[player].resourceArea = [];
  for (let i = 0; i < n; i++) placeCard(state, player, RESOURCE, "resourceArea");
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
const inZone = (state: GameState, player: PlayerId, zone: "battleArea" | "hand" | "trash" | "resourceArea", id: string) =>
  state.players[player][zone].some((c) => c.instanceId === id);

describe("GD05-106 Mutual Attraction — 【Main】 escolha de modo", () => {
  it("o motor pede o modo; ■1 coloca o topo do resource deck descansado e a Command vai pro trash", () => {
    let s = game();
    const cmd = placeCard(s, "A", G["GD05-106"], "hand");
    const topResource = s.players.A.resourceDeck[0].instanceId;
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main" });
    const modeEntry = entry(s, "A", "GD05-106-Main");
    expect(modeEntry?.enumChoice?.options.map((o) => o.value)).toEqual(["1", "2"]);
    expect(inZone(s, "A", "hand", cmd)).toBe(true);

    s = resolve(s, "A", "GD05-106-Main", ["1"]);
    expect(s.pendingDecision.A).toBeNull();
    expect(findCard(s, topResource).zone).toBe("resourceArea");
    expect(findCard(s, topResource).rested).toBe(true);
    expect(inZone(s, "A", "trash", cmd)).toBe(true);
  });

  it("■2 pede a carta do trash (só Pilot Lv.5+); a Command fica na mão até o modo resolver", () => {
    let s = game();
    const strong = placeCard(s, "A", PILOT({ code: "TEST-PILOT-5", level: 5 }), "trash");
    const weak = placeCard(s, "A", PILOT({ code: "TEST-PILOT-4", level: 4 }), "trash");
    const cmd = placeCard(s, "A", G["GD05-106"], "hand");
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main" });
    s = resolve(s, "A", "GD05-106-Main", ["2"]);

    const search = entry(s, "A", "GD05-106-Mode2")?.trashSearch;
    expect(search?.legalTrashIds).toEqual([strong]);
    expect(search?.legalTrashIds).not.toContain(weak);
    expect(inZone(s, "A", "hand", cmd)).toBe(true);

    s = resolve(s, "A", "GD05-106-Mode2", [strong]);
    expect(inZone(s, "A", "hand", strong)).toBe(true);
    expect(inZone(s, "A", "trash", cmd)).toBe(true);
    expect(s.pendingDecision.A).toBeNull();
  });

  it("o bot enxerga os 2 modos como ações legais da decisão", () => {
    let s = game();
    const cmd = placeCard(s, "A", G["GD05-106"], "hand");
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main" });
    const modes = enumerateLegalActions(s, "A", ALL_EFFECT_SPECS, { targetFilterResolver: defaultTargetFilterResolver })
      .filter((a) => a.kind === "resolveAbility")
      .map((a) => (a.kind === "resolveAbility" ? a.resolutions[0].targetIds : []));
    expect(modes).toEqual(expect.arrayContaining([["1"], ["2"]]));
  });
});

describe("GD05-102 Wings of Light — 【Action】 escolha de modo no Action Step", () => {
  /** A ataca a Unit `victim` do B; os dois chegam no Action Step com `A` na prioridade de jogar o 102 */
  function toActionStep(s: GameState, victim: string): GameState {
    const attacker = placeCard(s, "A", UNIT({ ap: 1, hp: 9 }), "battleArea");
    let next = act(s, "A", { kind: "declareAttack", attackerId: attacker, target: { unitId: victim } });
    next = act(next, "B", { kind: "skipBlock" });
    expect(next.combat?.step).toBe("action");
    if (next.combat!.actionPriority === "B") next = act(next, "B", { kind: "passAction" });
    expect(next.combat?.actionPriority).toBe("A");
    return next;
  }

  it("■1 só oferece Unit inimiga com HP restante ≤5 e devolve à mão do dono", () => {
    let s = game();
    const small = placeCard(s, "B", UNIT({ code: "TEST-SMALL", hp: 7 }), "battleArea", { rested: true, damage: 2 });
    const big = placeCard(s, "B", UNIT({ code: "TEST-BIG", hp: 6 }), "battleArea");
    const cmd = placeCard(s, "A", G["GD05-102"], "hand");
    s = toActionStep(s, small);
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Action" });
    s = resolve(s, "A", "GD05-102-Action", ["1"]);

    const mode = entry(s, "A", "GD05-102-Mode1");
    expect(mode?.legalTargets).toEqual([small]);
    expect(mode?.legalTargets).not.toContain(big);
    s = resolve(s, "A", "GD05-102-Mode1", [small]);
    expect(inZone(s, "B", "hand", small)).toBe(true);
    expect(inZone(s, "A", "trash", cmd)).toBe(true);
  });

  it("■2 recupera 3 de HP de qualquer Unit (inclusive a própria)", () => {
    let s = game();
    const victim = placeCard(s, "B", UNIT({ hp: 9 }), "battleArea", { rested: true });
    const hurt = placeCard(s, "A", UNIT({ code: "TEST-HURT", hp: 6 }), "battleArea", { damage: 4 });
    const cmd = placeCard(s, "A", G["GD05-102"], "hand");
    s = toActionStep(s, victim);
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Action" });
    s = resolve(s, "A", "GD05-102-Action", ["2"]);
    expect(entry(s, "A", "GD05-102-Mode2")?.legalTargets).toEqual(expect.arrayContaining([hurt, victim]));
    s = resolve(s, "A", "GD05-102-Mode2", [hurt]);
    expect(findCard(s, hurt).damage).toBe(1);
    expect(inZone(s, "A", "trash", cmd)).toBe(true);
  });

  it("modo inválido é recusado", () => {
    let s = game();
    const victim = placeCard(s, "B", UNIT(), "battleArea", { rested: true });
    const cmd = placeCard(s, "A", G["GD05-102"], "hand");
    s = toActionStep(s, victim);
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Action" });
    expect(() => resolve(s, "A", "GD05-102-Action", ["3"])).toThrow(/Escolha inválida/);
  });
});

describe("GD05-104 At the Risk of One's Life — efeito concedido (■【During Link】【Destroyed】)", () => {
  const SHRIKE = UNIT({ code: "TEST-SHRIKE", traits: ["Shrike Team"], ap: 1, hp: 2, link: { kind: "pilotName", values: ["Test Pilot"] } });
  const MILITAIRE = UNIT({ code: "TEST-LM", traits: ["League Militaire"] });

  /** A ataca com a Shrike (que morre na batalha) e joga o 104 nela no Action Step */
  function attackAndGrant(s: GameState, shrike: string): GameState {
    const wall = placeCard(s, "B", UNIT({ code: "TEST-WALL", ap: 9, hp: 9 }), "battleArea", { rested: true });
    const cmd = placeCard(s, "A", G["GD05-104"], "hand");
    let next = act(s, "A", { kind: "declareAttack", attackerId: shrike, target: { unitId: wall } });
    next = act(next, "B", { kind: "skipBlock" });
    if (next.combat!.actionPriority === "B") next = act(next, "B", { kind: "passAction" });
    next = act(next, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Action", targets: { target: [shrike] } });
    expect(inZone(next, "A", "trash", cmd)).toBe(true);
    for (let i = 0; i < 4 && next.combat?.step === "action"; i++) next = act(next, next.combat.actionPriority, { kind: "passAction" });
    return next;
  }

  it("Link Unit concedida destruída em batalha: pede 1 League Militaire e a ativa; o combate termina depois", () => {
    let s = game();
    const shrike = placeCard(s, "A", SHRIKE, "battleArea");
    const pilot = placeCard(s, "A", PILOT({ nameEn: "Test Pilot" }), "battleArea");
    findCard(s, shrike).pairedPilotId = pilot;
    findCard(s, pilot).pairedUnitId = shrike;
    const ally = placeCard(s, "A", MILITAIRE, "battleArea", { rested: true });
    const other = placeCard(s, "A", UNIT({ code: "TEST-OTHER" }), "battleArea", { rested: true });

    s = attackAndGrant(s, shrike);
    expect(inZone(s, "A", "trash", shrike)).toBe(true);
    const granted = entry(s, "A", "GD05-104-Granted");
    expect(granted?.legalTargets).toEqual([ally]);
    expect(granted?.legalTargets).not.toContain(other);

    s = resolve(s, "A", "GD05-104-Granted", [ally]);
    expect(findCard(s, ally).rested).toBe(false);
    expect(s.pendingDecision.A).toBeNull();
    expect(s.combat).toBeNull();
  });

  it("sem Link na destruição (Unit sem Piloto) o efeito concedido não dispara", () => {
    let s = game();
    const shrike = placeCard(s, "A", SHRIKE, "battleArea");
    const ally = placeCard(s, "A", MILITAIRE, "battleArea", { rested: true });
    s = attackAndGrant(s, shrike);
    expect(inZone(s, "A", "trash", shrike)).toBe(true);
    expect(entry(s, "A", "GD05-104-Granted")).toBeUndefined();
    expect(findCard(s, ally).rested).toBe(true);
  });

  it("só (Shrike Team) pode receber o efeito: outro alvo é recusado no Action Step", () => {
    let s = game();
    const attacker = placeCard(s, "A", UNIT({ ap: 1, hp: 9 }), "battleArea");
    const notShrike = placeCard(s, "A", UNIT({ code: "TEST-PLAIN" }), "battleArea");
    placeCard(s, "A", SHRIKE, "battleArea");
    const victim = placeCard(s, "B", UNIT(), "battleArea", { rested: true });
    const cmd = placeCard(s, "A", G["GD05-104"], "hand");
    s = act(s, "A", { kind: "declareAttack", attackerId: attacker, target: { unitId: victim } });
    s = act(s, "B", { kind: "skipBlock" });
    if (s.combat!.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
    expect(() => act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Action", targets: { target: [notShrike] } })).toThrow(/Alvo inválido/);
    expect(s.players.A.delayedReactions ?? []).toEqual([]);
  });
});

describe("GD05-002 Strike Freedom Gundam", () => {
  function deployWithGrant(s: GameState, chosen: (selfId: string) => string[]): { s: GameState; self: string } {
    const self = placeCard(s, "A", G["GD05-002"], "hand");
    let next = act(s, "A", { kind: "deployCard", cardInstanceId: self });
    expect(entry(next, "A", "GD05-002-Deploy")?.targetCount).toEqual({ min: 1, max: 2 });
    next = resolve(next, "A", "GD05-002-Deploy", chosen(self));
    return { s: next, self };
  }
  const runCombat = (state: GameState): GameState => {
    let s = state;
    for (let i = 0; i < 10 && s.combat && !s.pendingDecision.A && !s.pendingDecision.B; i++) {
      if (s.combat.step === "block") s = act(s, s.combat.defendingPlayer, { kind: "skipBlock" });
      else if (s.combat.step === "action") s = act(s, s.combat.actionPriority, { kind: "passAction" });
      else break;
    }
    return s;
  };

  it("【Deploy】 até 2 Units: cada uma compra 1 ao destruir Unit inimiga ou escudo em batalha, neste turno", () => {
    let s = game();
    const a1 = placeCard(s, "A", UNIT({ code: "TEST-A1", ap: 5, hp: 5 }), "battleArea");
    const a2 = placeCard(s, "A", UNIT({ code: "TEST-A2", ap: 5, hp: 5 }), "battleArea");
    const a3 = placeCard(s, "A", UNIT({ code: "TEST-A3", ap: 5, hp: 5 }), "battleArea");
    const victim = placeCard(s, "B", UNIT({ ap: 1, hp: 1 }), "battleArea", { rested: true });
    ({ s } = deployWithGrant(s, () => [a1, a2]));
    expect((s.players.A.delayedReactions ?? []).filter((d) => d.subjectId === a1)).toHaveLength(2);

    const hand0 = s.players.A.hand.length;
    s = runCombat(act(s, "A", { kind: "declareAttack", attackerId: a1, target: { unitId: victim } }));
    expect(inZone(s, "B", "trash", victim)).toBe(true);
    expect(s.players.A.hand.length).toBe(hand0 + 1);

    s = runCombat(act(s, "A", { kind: "declareAttack", attackerId: a2, target: "player" }));
    expect(s.players.A.hand.length).toBe(hand0 + 2);

    // a3 não foi escolhida: destruir escudo não compra
    s = runCombat(act(s, "A", { kind: "declareAttack", attackerId: a3, target: "player" }));
    expect(s.players.A.hand.length).toBe(hand0 + 2);
  });

  function pairedStrikeFreedom(s: GameState): string {
    const self = placeCard(s, "A", G["GD05-002"], "battleArea");
    const pilot = placeCard(s, "A", PILOT(), "battleArea");
    findCard(s, self).pairedPilotId = pilot;
    findCard(s, pilot).pairedUnitId = self;
    return self;
  }

  it("【During Pair】【Attack】 descarta 2 e DEPOIS escolhe a Unit inimiga de menor Lv → fundo do deck; o combate segue", () => {
    let s = game();
    const self = pairedStrikeFreedom(s);
    s.players.A.hand = [];
    const c1 = placeCard(s, "A", UNIT({ code: "TEST-H1" }), "hand");
    const c2 = placeCard(s, "A", UNIT({ code: "TEST-H2" }), "hand");
    const low = placeCard(s, "B", UNIT({ code: "TEST-LOW", level: 2 }), "battleArea");
    const high = placeCard(s, "B", UNIT({ code: "TEST-HIGH", level: 5 }), "battleArea");

    s = act(s, "A", { kind: "declareAttack", attackerId: self, target: "player" });
    expect(entry(s, "A", "GD05-002-Attack")?.handDiscard?.n).toBe(2);
    s = resolve(s, "A", "GD05-002-Attack", [c1, c2]);
    expect(inZone(s, "A", "trash", c1) && inZone(s, "A", "trash", c2)).toBe(true);
    expect(s.combat?.step).toBe("attack");

    const then = entry(s, "A", "GD05-002-Then");
    expect(then?.legalTargets).toEqual([low]);
    expect(then?.legalTargets).not.toContain(high);
    s = resolve(s, "A", "GD05-002-Then", [low]);
    expect(s.players.B.deck.at(-1)?.instanceId).toBe(low);
    expect(s.combat?.step).toBe("block");
  });

  it("recusar o descarte não move nada e o combate segue", () => {
    let s = game();
    const self = pairedStrikeFreedom(s);
    s.players.A.hand = [];
    placeCard(s, "A", UNIT(), "hand");
    placeCard(s, "A", UNIT(), "hand");
    const low = placeCard(s, "B", UNIT({ level: 1 }), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: self, target: "player" });
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD05-002-Attack", activate: false, targetIds: [] }] });
    expect(s.players.A.hand).toHaveLength(2);
    expect(inZone(s, "B", "battleArea", low)).toBe(true);
    expect(s.combat?.step).toBe("block");
  });

  it("com menos de 2 cartas na mão, ou sem Piloto, o 【Attack】 nem é oferecido", () => {
    let s = game();
    const self = pairedStrikeFreedom(s);
    s.players.A.hand = [];
    placeCard(s, "A", UNIT(), "hand");
    s = act(s, "A", { kind: "declareAttack", attackerId: self, target: "player" });
    expect(entry(s, "A", "GD05-002-Attack")).toBeUndefined();
    expect(s.combat?.step).toBe("block");

    let t = game();
    const unpaired = placeCard(t, "A", G["GD05-002"], "battleArea");
    placeCard(t, "A", UNIT(), "hand");
    placeCard(t, "A", UNIT(), "hand");
    t = act(t, "A", { kind: "declareAttack", attackerId: unpaired, target: "player" });
    expect(entry(t, "A", "GD05-002-Attack")).toBeUndefined();
  });
});
