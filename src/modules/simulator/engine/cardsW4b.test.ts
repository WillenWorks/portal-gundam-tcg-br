import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { advanceToMainPhase } from "./phases";
import { attackTargetError } from "./combat";
import { enumerateLegalActions } from "./legalActions";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { effectiveAp } from "./types";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD04_CARD_DEFS } from "../content/gd04";

/**
 * GD04 — fluxo real das cartas que ficaram sem teste próprio (023, 030, 042, 050, 070, 074, 090, 122).
 * Só ações de jogador (`deployCard`, `declareAttack`, `skipBlock`, `passAction`, `activateAbility`,
 * `resolveAbility`): o motor tem que PEDIR a escolha (fila `abilityResolution` com os alvos legais certos),
 * aplicar o efeito depois de resolver e recusar o caso negativo. Nada de `dispatchTrigger` com alvo pronto.
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
const RESOURCE: CardDef = { code: "TEST-RES", nameEn: "Resource", cardType: "RESOURCE", color: "white", level: 0, cost: 0, ap: 0, hp: 0 };
/** carta de shield sem 【Burst】 (o deck de teste tem Bursts que pausariam o Damage Step) */
const SHIELD = UNIT({ code: "TEST-SHIELD", nameEn: "Plain Shield" });

function game(): GameState {
  const state = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 88, firstPlayer: "A" }));
  for (const p of ["A", "B"] as const) {
    state.players[p].battleArea = [];
    state.players[p].baseSection = [];
    state.players[p].trash = [];
    state.players[p].shields = [];
    for (let i = 0; i < 3; i++) placeCard(state, p, SHIELD, "shields");
  }
  return state;
}
function pair(state: GameState, unitId: string, pilotId: string): void {
  findCard(state, unitId).pairedPilotId = pilotId;
  findCard(state, pilotId).pairedUnitId = unitId;
}
/** `n` Recursos normais (ativos) na Resource Area */
function resources(state: GameState, player: PlayerId, n: number): void {
  state.players[player].resourceArea = [];
  for (let i = 0; i < n; i++) placeCard(state, player, RESOURCE, "resourceArea");
}
const restedResources = (state: GameState, player: PlayerId) => state.players[player].resourceArea.filter((r) => r.rested).length;
function act(state: GameState, player: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, player, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}
const pending = (state: GameState, player: PlayerId) => {
  const d = state.pendingDecision[player];
  return d?.kind === "abilityResolution" ? d : null;
};
const entry = (state: GameState, player: PlayerId, specId: string) => pending(state, player)?.queue.find((q) => q.specId === specId);
const resolve = (state: GameState, player: PlayerId, specId: string, targetIds: string[], extra: { activate?: boolean; secondaryTargetIds?: string[] } = {}) =>
  act(state, player, { kind: "resolveAbility", resolutions: [{ specId, activate: extra.activate ?? true, targetIds, secondaryTargetIds: extra.secondaryTargetIds }] });
/** joga da mão do jogador ativo `A` (Recursos suficientes pro custo e nível) */
function deployFromHand(state: GameState, def: CardDef, opts: { pairWithUnitId?: string } = {}): { state: GameState; id: string } {
  const id = placeCard(state, "A", def, "hand");
  return { state: act(state, "A", { kind: "deployCard", cardInstanceId: id, pairWithUnitId: opts.pairWithUnitId }), id };
}
/** avança o combate (B não bloqueia, os dois passam o Action Step) até o fim ou até alguém ter decisão pendente */
function runCombat(state: GameState): GameState {
  let s = state;
  for (let guard = 0; guard < 10 && s.combat && !s.pendingDecision.A && !s.pendingDecision.B && !s.gameOver; guard++) {
    if (s.combat.step === "block") s = act(s, s.combat.defendingPlayer, { kind: "skipBlock" });
    else if (s.combat.step === "action") s = act(s, s.combat.actionPriority, { kind: "passAction" });
    else break;
  }
  return s;
}
const inZone = (state: GameState, player: PlayerId, zone: "battleArea" | "hand" | "trash" | "deck", id: string) =>
  state.players[player][zone].some((c) => c.instanceId === id);

describe("GD04-023 Gundam Kyrios (Tail Booster) 【Deploy】", () => {
  it("pede 1 Unit sua pareada com Piloto (Super Soldier); ela pode atacar inimiga ativa Lv.4-", () => {
    let state = game();
    resources(state, "A", 5);
    const ss = placeCard(state, "A", UNIT(), "battleArea");
    pair(state, ss, placeCard(state, "A", PILOT({ traits: ["Super Soldier"] }), "battleArea"));
    const other = placeCard(state, "A", UNIT(), "battleArea");
    pair(state, other, placeCard(state, "A", PILOT({ traits: ["CB"] }), "battleArea"));
    placeCard(state, "A", UNIT(), "battleArea"); // sem Piloto
    const lv4 = placeCard(state, "B", UNIT({ level: 4 }), "battleArea");
    const lv5 = placeCard(state, "B", UNIT({ level: 5 }), "battleArea");
    ({ state } = deployFromHand(state, G["GD04-023"]));
    expect(entry(state, "A", "GD04-023-Deploy")?.legalTargets).toEqual([ss]);
    state = resolve(state, "A", "GD04-023-Deploy", [ss]);
    expect(findCard(state, ss).attackTargetRelaxUntilTurn?.maxLevel).toBe(4);
    expect(attackTargetError(state, findCard(state, ss), { unitId: lv4 })).toBeNull();
    expect(attackTargetError(state, findCard(state, ss), { unitId: lv5 })).not.toBeNull();
    expect(attackTargetError(state, findCard(state, other), { unitId: lv4 })).not.toBeNull();
    // e o ataque de verdade é aceito
    state = act(state, "A", { kind: "declareAttack", attackerId: ss, target: { unitId: lv4 } });
    expect(state.combat?.currentTarget).toEqual({ unitId: lv4 });
  });

  it("sem Unit pareada com Piloto (Super Soldier), não há alvo legal e nada muda", () => {
    let state = game();
    resources(state, "A", 5);
    const other = placeCard(state, "A", UNIT(), "battleArea");
    pair(state, other, placeCard(state, "A", PILOT({ traits: ["CB"] }), "battleArea"));
    const lv4 = placeCard(state, "B", UNIT({ level: 4 }), "battleArea");
    ({ state } = deployFromHand(state, G["GD04-023"]));
    expect(entry(state, "A", "GD04-023-Deploy")?.legalTargets ?? []).toEqual([]);
    expect(findCard(state, other).attackTargetRelaxUntilTurn).toBeUndefined();
    expect(attackTargetError(state, findCard(state, other), { unitId: lv4 })).not.toBeNull();
  });
});

describe("GD04-030 Chuchu's Demi Trainer 【Attack】", () => {
  it("ao atacar, pede 1 OUTRA Unit (Academy) sua; ela pode atacar inimiga ativa Lv.3-", () => {
    let state = game();
    const self = placeCard(state, "A", G["GD04-030"], "battleArea");
    const academy = placeCard(state, "A", UNIT({ traits: ["Academy"] }), "battleArea");
    placeCard(state, "A", UNIT({ traits: ["Zeon"] }), "battleArea");
    const lv3 = placeCard(state, "B", UNIT({ level: 3 }), "battleArea");
    const lv4 = placeCard(state, "B", UNIT({ level: 4 }), "battleArea");
    state = act(state, "A", { kind: "declareAttack", attackerId: self, target: "player" });
    expect(entry(state, "A", "GD04-030-Attack")?.legalTargets).toEqual([academy]);
    state = resolve(state, "A", "GD04-030-Attack", [academy]);
    expect(findCard(state, academy).attackTargetRelaxUntilTurn?.maxLevel).toBe(3);
    expect(findCard(state, self).attackTargetRelaxUntilTurn).toBeUndefined();
    state = runCombat(state);
    expect(state.combat).toBeFalsy();
    expect(attackTargetError(state, findCard(state, academy), { unitId: lv3 })).toBeNull();
    expect(attackTargetError(state, findCard(state, academy), { unitId: lv4 })).not.toBeNull();
  });

  it("sem outra Unit (Academy), a própria 030 não é alvo legal", () => {
    let state = game();
    const self = placeCard(state, "A", G["GD04-030"], "battleArea");
    const lv3 = placeCard(state, "B", UNIT({ level: 3 }), "battleArea");
    state = act(state, "A", { kind: "declareAttack", attackerId: self, target: "player" });
    expect(entry(state, "A", "GD04-030-Attack")?.legalTargets ?? []).toEqual([]);
    expect(findCard(state, self).attackTargetRelaxUntilTurn).toBeUndefined();
    expect(attackTargetError(state, findCard(state, self), { unitId: lv3 })).not.toBeNull();
  });
});

describe("GD04-042 Psycho Gundam (GQ) 【During Link】【Once per Turn】", () => {
  function linked042(state: GameState): string {
    const self = placeCard(state, "A", G["GD04-042"], "battleArea");
    pair(state, self, placeCard(state, "A", G["GD04-091"], "battleArea")); // Deux Murasame (Cyber-Newtype)
    return self;
  }

  it("Unit pareada com Piloto (Cyber-Newtype) destrói shield → pede inimiga AP<=5 e causa 2 de dano", () => {
    let state = game();
    const self = linked042(state);
    const weak = placeCard(state, "B", UNIT({ ap: 5, hp: 9 }), "battleArea");
    placeCard(state, "B", UNIT({ ap: 6, hp: 9 }), "battleArea");
    const shields0 = state.players.B.shields.length;
    state = runCombat(act(state, "A", { kind: "declareAttack", attackerId: self, target: "player" }));
    expect(state.players.B.shields.length).toBe(shields0 - 1);
    expect(entry(state, "A", "GD04-042-DestroyedShield")?.legalTargets).toEqual([weak]);
    state = resolve(state, "A", "GD04-042-DestroyedShield", [weak]);
    expect(findCard(state, weak).damage).toBe(2);
  });

  it("sem link (Piloto que não é Deux Murasame), destruir shield não dispara nada", () => {
    let state = game();
    const self = placeCard(state, "A", G["GD04-042"], "battleArea");
    pair(state, self, placeCard(state, "A", PILOT({ traits: ["Cyber-Newtype"] }), "battleArea"));
    const weak = placeCard(state, "B", UNIT({ ap: 5, hp: 9 }), "battleArea");
    state = runCombat(act(state, "A", { kind: "declareAttack", attackerId: self, target: "player" }));
    expect(entry(state, "A", "GD04-042-DestroyedShield")).toBeUndefined();
    expect(findCard(state, weak).damage).toBe(0);
  });

  it("Unit sua pareada com Piloto que NÃO é (Cyber-Newtype) destrói shield → não dispara", () => {
    let state = game();
    linked042(state);
    const attacker = placeCard(state, "A", UNIT(), "battleArea");
    pair(state, attacker, placeCard(state, "A", PILOT({ traits: ["Newtype"] }), "battleArea"));
    const weak = placeCard(state, "B", UNIT({ ap: 5, hp: 9 }), "battleArea");
    state = runCombat(act(state, "A", { kind: "declareAttack", attackerId: attacker, target: "player" }));
    expect(entry(state, "A", "GD04-042-DestroyedShield")).toBeUndefined();
    expect(findCard(state, weak).damage).toBe(0);
  });
});

describe("GD04-050 Destiny Gundam 【During Pair】【Attack】", () => {
  it("pareada, ao atacar oferece Units (Minerva Squad) do trash e faz o deploy pagando o custo", () => {
    let state = game();
    resources(state, "A", 4);
    const self = placeCard(state, "A", G["GD04-050"], "battleArea");
    pair(state, self, placeCard(state, "A", PILOT(), "battleArea"));
    const minerva = placeCard(state, "A", UNIT({ traits: ["Minerva Squad"], cost: 2, level: 3 }), "trash");
    placeCard(state, "A", UNIT({ traits: ["ZAFT"] }), "trash");
    placeCard(state, "A", PILOT({ traits: ["Minerva Squad"] }), "trash");
    state = act(state, "A", { kind: "declareAttack", attackerId: self, target: "player" });
    const e = entry(state, "A", "GD04-050-Attack");
    expect(e?.optional).toBe(true);
    expect(e?.trashSearch?.legalTrashIds).toEqual([minerva]);
    state = resolve(state, "A", "GD04-050-Attack", [minerva]);
    expect(inZone(state, "A", "battleArea", minerva)).toBe(true);
    expect(restedResources(state, "A")).toBe(2);
  });

  it("recusar (activate: false) deixa a carta no trash e não paga nada", () => {
    let state = game();
    resources(state, "A", 4);
    const self = placeCard(state, "A", G["GD04-050"], "battleArea");
    pair(state, self, placeCard(state, "A", PILOT(), "battleArea"));
    const minerva = placeCard(state, "A", UNIT({ traits: ["Minerva Squad"] }), "trash");
    state = act(state, "A", { kind: "declareAttack", attackerId: self, target: "player" });
    state = resolve(state, "A", "GD04-050-Attack", [], { activate: false });
    expect(inZone(state, "A", "trash", minerva)).toBe(true);
    expect(restedResources(state, "A")).toBe(0);
  });

  it("sem Piloto pareado, o 【Attack】 não é oferecido", () => {
    let state = game();
    resources(state, "A", 4);
    const self = placeCard(state, "A", G["GD04-050"], "battleArea");
    const minerva = placeCard(state, "A", UNIT({ traits: ["Minerva Squad"] }), "trash");
    state = act(state, "A", { kind: "declareAttack", attackerId: self, target: "player" });
    expect(entry(state, "A", "GD04-050-Attack")).toBeUndefined();
    expect(inZone(state, "A", "trash", minerva)).toBe(true);
  });
});

describe("GD04-070 Al-Saachez's AEU Enact Custom 【Deploy】", () => {
  it("oferece só Pilotos \"Ali al-Saachez\" da mão e pareia o escolhido com ela", () => {
    let state = game();
    resources(state, "A", 3);
    state.players.A.hand = [];
    const ali = placeCard(state, "A", G["GD04-099"], "hand");
    placeCard(state, "A", PILOT({ nameEn: "Graham Aker" }), "hand");
    placeCard(state, "A", UNIT({ nameEn: "Ali al-Saachez Unit" }), "hand");
    const deployed = deployFromHand(state, G["GD04-070"]);
    state = deployed.state;
    const e = entry(state, "A", "GD04-070-Deploy");
    expect(e?.optional).toBe(true);
    expect(e?.handChoice?.legalHandIds).toEqual([ali]);
    state = resolve(state, "A", "GD04-070-Deploy", [ali]);
    // 【When Paired】/【When Linked】 de quem entrou podem abrir outra fila — não importa aqui
    expect(findCard(state, deployed.id).pairedPilotId).toBe(ali);
    expect(findCard(state, ali).pairedUnitId).toBe(deployed.id);
    expect(inZone(state, "A", "hand", ali)).toBe(false);
  });

  it("sem \"Ali al-Saachez\" na mão, não há escolha legal e nada é pareado", () => {
    let state = game();
    resources(state, "A", 3);
    state.players.A.hand = [];
    placeCard(state, "A", PILOT({ nameEn: "Graham Aker" }), "hand");
    const deployed = deployFromHand(state, G["GD04-070"]);
    state = deployed.state;
    expect(entry(state, "A", "GD04-070-Deploy")?.handChoice?.legalHandIds ?? []).toEqual([]);
    expect(findCard(state, deployed.id).pairedPilotId).toBeUndefined();
  });
});

describe("GD04-074 Kapool 【Attack】", () => {
  it("paga ① → compra 1 → descarta 1 (a escolha do descarte inclui a recém-comprada)", () => {
    let state = game();
    resources(state, "A", 2);
    state.players.A.hand = [];
    const keep = placeCard(state, "A", UNIT({ nameEn: "Keep" }), "hand");
    const toss = placeCard(state, "A", UNIT({ nameEn: "Toss" }), "hand");
    const top = state.players.A.deck[0].instanceId;
    const self = placeCard(state, "A", G["GD04-074"], "battleArea");
    state = act(state, "A", { kind: "declareAttack", attackerId: self, target: "player" });
    const e = entry(state, "A", "GD04-074-Attack");
    expect(e?.optional).toBe(true);
    expect(e?.handDiscard?.n).toBe(1);
    expect(e?.handDiscard?.legalHandIds).toEqual(expect.arrayContaining([keep, toss, top]));
    state = resolve(state, "A", "GD04-074-Attack", [toss]);
    expect(restedResources(state, "A")).toBe(1);
    expect(state.players.A.hand.map((c) => c.instanceId).sort()).toEqual([keep, top].sort());
    expect(inZone(state, "A", "trash", toss)).toBe(true);
  });

  it("recusar não paga, não compra, não descarta", () => {
    let state = game();
    resources(state, "A", 2);
    const hand0 = state.players.A.hand.length;
    const self = placeCard(state, "A", G["GD04-074"], "battleArea");
    state = act(state, "A", { kind: "declareAttack", attackerId: self, target: "player" });
    state = resolve(state, "A", "GD04-074-Attack", [], { activate: false });
    expect(restedResources(state, "A")).toBe(0);
    expect(state.players.A.hand.length).toBe(hand0);
    expect(state.players.A.trash.length).toBe(0);
  });

  it("sem Recurso ativo não dá pra pagar: nem oferece, não compra, não descarta", () => {
    let state = game();
    resources(state, "A", 2);
    for (const r of state.players.A.resourceArea) r.rested = true;
    const hand0 = state.players.A.hand.map((c) => c.instanceId);
    const self = placeCard(state, "A", G["GD04-074"], "battleArea");
    state = act(state, "A", { kind: "declareAttack", attackerId: self, target: "player" });
    expect(pending(state, "A")).toBeNull();
    expect(state.combat?.step).toBe("block");
    expect(state.players.A.hand.map((c) => c.instanceId)).toEqual(hand0);
    expect(state.players.A.trash.length).toBe(0);
  });

  it("com Sochie Heim (GD04-100) pareada numa Unit sua, pagar o ① do Kapool abre a reação da Sochie (+1 AP)", () => {
    let state = game();
    resources(state, "A", 2);
    state.players.A.hand = [];
    const toss = placeCard(state, "A", UNIT({ nameEn: "Toss" }), "hand");
    const holder = placeCard(state, "A", UNIT({ ap: 2 }), "battleArea");
    pair(state, holder, placeCard(state, "A", G["GD04-100"], "battleArea"));
    const self = placeCard(state, "A", G["GD04-074"], "battleArea");
    const before = effectiveAp(findCard(state, holder), state);
    state = act(state, "A", { kind: "declareAttack", attackerId: self, target: "player" });
    state = resolve(state, "A", "GD04-074-Attack", [toss]);
    const sochie = entry(state, "A", "GD04-100-PaidForUnitEffect");
    expect(sochie?.optional).toBe(true);
    state = resolve(state, "A", "GD04-100-PaidForUnitEffect", []);
    expect(effectiveAp(findCard(state, holder), state)).toBe(before + 1);
  });

  it("com Sochie pareada, recusar o ① do Kapool não abre a reação da Sochie", () => {
    let state = game();
    resources(state, "A", 2);
    const holder = placeCard(state, "A", UNIT({ ap: 2 }), "battleArea");
    pair(state, holder, placeCard(state, "A", G["GD04-100"], "battleArea"));
    const self = placeCard(state, "A", G["GD04-074"], "battleArea");
    const before = effectiveAp(findCard(state, holder), state);
    state = act(state, "A", { kind: "declareAttack", attackerId: self, target: "player" });
    state = resolve(state, "A", "GD04-074-Attack", [], { activate: false });
    expect(entry(state, "A", "GD04-100-PaidForUnitEffect")).toBeUndefined();
    expect(effectiveAp(findCard(state, holder), state)).toBe(before);
  });
});

describe("GD04-090 Hallelujah Haptism (Piloto) 【During Link】【Once per Turn】", () => {
  /** Kyrios (link "Hallelujah Haptism") pareada com a 090, atacando `victim` (descansada) */
  function setup(topDef: CardDef, opts: { linked?: boolean } = {}) {
    const state = game();
    const unit = placeCard(state, "A", { ...(opts.linked === false ? UNIT() : G["GD04-023"]), ap: 5, hp: 9 }, "battleArea");
    const pilot = placeCard(state, "A", G["GD04-090"], "battleArea");
    pair(state, unit, pilot);
    const victim = placeCard(state, "B", UNIT({ hp: 2 }), "battleArea", { rested: true });
    const top = placeCard(state, "A", topDef, "deck");
    const deck = state.players.A.deck;
    deck.unshift(deck.pop()!);
    return { state, unit, victim, top };
  }

  it("destrói Unit inimiga em batalha no seu turno → olha o topo; (CB) pode ir pra mão", () => {
    const { state: s0, unit, victim, top } = setup(UNIT({ traits: ["CB"] }));
    let state = runCombat(act(s0, "A", { kind: "declareAttack", attackerId: unit, target: { unitId: victim } }));
    expect(inZone(state, "B", "battleArea", victim)).toBe(false);
    const e = entry(state, "A", "GD04-090-DestroyedEnemy");
    expect(e?.deckTopReveal?.revealableIds).toEqual([top]);
    state = resolve(state, "A", "GD04-090-DestroyedEnemy", [top]);
    expect(inZone(state, "A", "hand", top)).toBe(true);
  });

  it("topo que não é (CB) não pode ser revelado e vai pro fundo do deck", () => {
    const { state: s0, unit, victim, top } = setup(UNIT({ traits: ["Zeon"] }));
    let state = runCombat(act(s0, "A", { kind: "declareAttack", attackerId: unit, target: { unitId: victim } }));
    expect(entry(state, "A", "GD04-090-DestroyedEnemy")?.deckTopReveal?.revealableIds).toEqual([]);
    state = resolve(state, "A", "GD04-090-DestroyedEnemy", []);
    expect(inZone(state, "A", "hand", top)).toBe(false);
    const deck = state.players.A.deck;
    expect(deck[deck.length - 1].instanceId).toBe(top);
  });

  it("sem link (Unit cujo link não é Hallelujah), destruir em batalha não dispara", () => {
    const { state: s0, unit, victim, top } = setup(UNIT({ traits: ["CB"] }), { linked: false });
    const state = runCombat(act(s0, "A", { kind: "declareAttack", attackerId: unit, target: { unitId: victim } }));
    expect(inZone(state, "B", "battleArea", victim)).toBe(false);
    expect(entry(state, "A", "GD04-090-DestroyedEnemy")).toBeUndefined();
    expect(state.players.A.deck[0].instanceId).toBe(top);
  });
});

describe("GD04-122 Jaburo (Base) 【Activate･Main】【Once per Turn】", () => {
  it("pede a inimiga Lv.3- e a Unit (Earth Federation) ativa do custo; descansa as duas", () => {
    let state = game();
    const base = placeCard(state, "A", G["GD04-122"], "baseSection");
    const ef = placeCard(state, "A", UNIT({ traits: ["Earth Federation"] }), "battleArea");
    placeCard(state, "A", UNIT({ traits: ["Earth Federation"] }), "battleArea", { rested: true });
    placeCard(state, "A", UNIT({ traits: ["Zeon"] }), "battleArea");
    const lv3 = placeCard(state, "B", UNIT({ level: 3 }), "battleArea");
    placeCard(state, "B", UNIT({ level: 4 }), "battleArea");
    state = act(state, "A", { kind: "activateAbility", sourceInstanceId: base });
    const e = entry(state, "A", "GD04-122-ActivateMain");
    expect(e?.legalTargets).toEqual([lv3]);
    expect(e?.secondaryTarget?.legalTargets).toEqual([ef]);
    state = resolve(state, "A", "GD04-122-ActivateMain", [lv3], { secondaryTargetIds: [ef] });
    expect(findCard(state, lv3).rested).toBe(true);
    expect(findCard(state, ef).rested).toBe(true);
    // 【Once per Turn】: não é ofertada de novo neste turno
    placeCard(state, "A", UNIT({ traits: ["Earth Federation"] }), "battleArea");
    placeCard(state, "B", UNIT({ level: 2 }), "battleArea");
    const again = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).filter((a) => a.kind === "activateAbility" && a.sourceInstanceId === base);
    expect(again).toEqual([]);
  });

  it("sem Unit (Earth Federation) ativa, a habilidade não é ofertada", () => {
    const state = game();
    const base = placeCard(state, "A", G["GD04-122"], "baseSection");
    placeCard(state, "A", UNIT({ traits: ["Earth Federation"] }), "battleArea", { rested: true });
    placeCard(state, "A", UNIT({ traits: ["Zeon"] }), "battleArea");
    placeCard(state, "B", UNIT({ level: 3 }), "battleArea");
    const offers = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).filter((a) => a.kind === "activateAbility" && a.sourceInstanceId === base);
    expect(offers).toEqual([]);
  });

  it("resolver com alvo ilegal (inimiga Lv.4) é recusado", () => {
    let state = game();
    const base = placeCard(state, "A", G["GD04-122"], "baseSection");
    const ef = placeCard(state, "A", UNIT({ traits: ["Earth Federation"] }), "battleArea");
    placeCard(state, "B", UNIT({ level: 3 }), "battleArea");
    const lv4 = placeCard(state, "B", UNIT({ level: 4 }), "battleArea");
    state = act(state, "A", { kind: "activateAbility", sourceInstanceId: base });
    expect(() => resolve(state, "A", "GD04-122-ActivateMain", [lv4], { secondaryTargetIds: [ef] })).toThrow();
  });
});
