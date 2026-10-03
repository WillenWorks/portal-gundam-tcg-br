import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { advanceToMainPhase } from "./phases";
import { attackTargetError } from "./combat";
import { enumerateLegalActions } from "./legalActions";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { effectiveAp, hasKeyword, keywordValue } from "./types";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD05_CARD_DEFS } from "../content/gd05";
import { GD04_CARD_DEFS } from "../content/gd04";

/**
 * W6 (GD05) — lote B: Units 061–079 e Pilotos. Fluxo real: só ações de jogador (`deployCard`,
 * `declareAttack`, `skipBlock`, `activateBlocker`, `passAction`, `activateAbility`, `resolveAbility`,
 * `finishTurn`); o motor tem que PEDIR a escolha com os alvos legais certos e aplicar o efeito.
 * Estáticos são checados pelo estado (`effectiveAp`, `hasKeyword`, `keywordValue`).
 */

const G = GD05_CARD_DEFS;
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
function act(state: GameState, player: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, player, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}
const pending = (state: GameState, player: PlayerId) => {
  const d = state.pendingDecision[player];
  return d?.kind === "abilityResolution" ? d : null;
};
const entry = (state: GameState, player: PlayerId, specId: string) => pending(state, player)?.queue.find((q) => q.specId === specId);
const resolve = (state: GameState, player: PlayerId, specId: string, targetIds: string[], activate = true) =>
  act(state, player, { kind: "resolveAbility", resolutions: [{ specId, activate, targetIds }] });
/** joga da mão do jogador ativo `A` com Recursos suficientes pro custo e o nível */
function deployFromHand(state: GameState, def: CardDef, pairWithUnitId?: string): { state: GameState; id: string } {
  resources(state, "A", Math.max(def.level ?? 0, def.cost ?? 0));
  const id = placeCard(state, "A", def, "hand");
  return { state: act(state, "A", { kind: "deployCard", cardInstanceId: id, pairWithUnitId }), id };
}
/** avança o combate (defensor não bloqueia, os dois passam o Action Step) até o fim ou até alguém ter decisão pendente */
function runCombat(state: GameState): GameState {
  let s = state;
  for (let guard = 0; guard < 10 && s.combat && !s.pendingDecision.A && !s.pendingDecision.B && !s.gameOver; guard++) {
    if (s.combat.step === "block") s = act(s, s.combat.defendingPlayer, { kind: "skipBlock" });
    else if (s.combat.step === "action") s = act(s, s.combat.actionPriority, { kind: "passAction" });
    else break;
  }
  return s;
}
/** A encerra o turno: os dois passam o Action Step da End Phase (End Step, Repair, troca de turno) */
function endTurn(state: GameState): GameState {
  let s = act(state, "A", { kind: "finishTurn" });
  for (let guard = 0; guard < 6 && s.endPhaseAction; guard++) s = act(s, s.endPhaseAction.priority, { kind: "passEndPhaseAction" });
  return s;
}
/** Unit cujo link é o Piloto dado (pra testar 【During Link】/【When Linked】 de Piloto) */
const linkedTo = (pilot: CardDef, extra: Partial<CardDef> = {}): CardDef => UNIT({ hp: 9, link: { kind: "pilotName", values: [pilot.nameEn] }, ...extra });
const inZone = (state: GameState, player: PlayerId, zone: "battleArea" | "hand" | "trash" | "deck", id: string) =>
  state.players[player][zone].some((c) => c.instanceId === id);
const ap = (state: GameState, id: string) => effectiveAp(findCard(state, id), state);
const dmg = (state: GameState, id: string) => findCard(state, id).damage;

describe("GD05 Units (W6 lote B)", () => {
  it("061 Geara Doga: <Blocker> só com outra Unit (Neo Zeon) sua em jogo — e bloqueia de verdade", () => {
    let state = game();
    const self = placeCard(state, "B", G["GD05-061"], "battleArea");
    placeCard(state, "B", UNIT({ traits: ["Zeon"] }), "battleArea");
    expect(hasKeyword(findCard(state, self), "Blocker", state)).toBe(false);
    placeCard(state, "B", UNIT({ traits: ["Neo Zeon"] }), "battleArea");
    expect(hasKeyword(findCard(state, self), "Blocker", state)).toBe(true);
    const attacker = placeCard(state, "A", UNIT({ ap: 1 }), "battleArea");
    state = act(state, "A", { kind: "declareAttack", attackerId: attacker, target: "player" });
    state = act(state, "B", { kind: "activateBlocker", blockerId: self });
    expect(state.combat?.currentTarget).toEqual({ unitId: self });
  });

  it("061: sozinho não pode bloquear", () => {
    let state = game();
    const self = placeCard(state, "B", G["GD05-061"], "battleArea");
    const attacker = placeCard(state, "A", UNIT({ ap: 1 }), "battleArea");
    state = act(state, "A", { kind: "declareAttack", attackerId: attacker, target: "player" });
    expect(() => act(state, "B", { kind: "activateBlocker", blockerId: self })).toThrow();
  });

  it("065 Landman Rodi 【During Link】: AP+2 só no seu turno; pareada sem Link, nada", () => {
    const state = game();
    const linked = placeCard(state, "A", G["GD05-065"], "battleArea");
    pair(state, linked, placeCard(state, "A", PILOT({ traits: ["Tekkadan"], ap: 1 }), "battleArea"));
    expect(ap(state, linked)).toBe(1 + 1 + 2);
    expect(ap({ ...state, activePlayer: "B" }, linked)).toBe(1 + 1);
    const unlinked = placeCard(state, "A", G["GD05-065"], "battleArea");
    pair(state, unlinked, placeCard(state, "A", PILOT({ traits: ["Gjallarhorn"], ap: 1 }), "battleArea"));
    expect(ap(state, unlinked)).toBe(1 + 1);
  });

  it("071 Sandrock Custom 【Attack】: com outra (Preventer) em jogo, pede 1 Unit inimiga → AP-2 no turno", () => {
    let state = game();
    const self = placeCard(state, "A", G["GD05-071"], "battleArea");
    placeCard(state, "A", UNIT({ traits: ["Preventer"] }), "battleArea");
    const e1 = placeCard(state, "B", UNIT({ ap: 4 }), "battleArea");
    const e2 = placeCard(state, "B", UNIT({ ap: 4 }), "battleArea");
    state = act(state, "A", { kind: "declareAttack", attackerId: self, target: "player" });
    expect(entry(state, "A", "GD05-071-Attack")?.legalTargets?.sort()).toEqual([e1, e2].sort());
    state = resolve(state, "A", "GD05-071-Attack", [e2]);
    expect(ap(state, e2)).toBe(2);
    expect(ap(state, e1)).toBe(4);
  });

  it("071: sem outra (G Team)/(Preventer), o ataque não reduz AP de ninguém", () => {
    let state = game();
    const self = placeCard(state, "A", G["GD05-071"], "battleArea");
    placeCard(state, "A", UNIT({ traits: ["OZ"] }), "battleArea");
    const enemy = placeCard(state, "B", UNIT({ ap: 4 }), "battleArea");
    state = act(state, "A", { kind: "declareAttack", attackerId: self, target: "player" });
    if (entry(state, "A", "GD05-071-Attack")) state = resolve(state, "A", "GD05-071-Attack", [enemy]);
    expect(ap(state, enemy)).toBe(4);
  });

  it("072 Rising Gundam 【When Linked】 (pareamento real): pede inimiga com 4- HP e a descansa", () => {
    let state = game();
    const self = placeCard(state, "A", { ...G["GD05-072"] }, "battleArea");
    const low = placeCard(state, "B", UNIT({ hp: 4 }), "battleArea");
    const hurt = placeCard(state, "B", UNIT({ hp: 6 }), "battleArea", { damage: 2 });
    placeCard(state, "B", UNIT({ hp: 5 }), "battleArea");
    ({ state } = deployFromHand(state, PILOT({ traits: ["Gundam Fighter"] }), self));
    expect(entry(state, "A", "GD05-072-WhenLinked")?.legalTargets?.sort()).toEqual([low, hurt].sort());
    state = resolve(state, "A", "GD05-072-WhenLinked", [low]);
    expect(findCard(state, low).rested).toBe(true);
  });

  it("072: pareada com Piloto que não faz Link, nada dispara", () => {
    let state = game();
    const self = placeCard(state, "A", G["GD05-072"], "battleArea");
    placeCard(state, "B", UNIT({ hp: 2 }), "battleArea");
    ({ state } = deployFromHand(state, PILOT({ traits: ["Shuffle Alliance"] }), self));
    expect(entry(state, "A", "GD05-072-WhenLinked")).toBeUndefined();
  });

  it("073 Altron (EW) 【Deploy】: pede inimiga DESCANSADA; ela não volta a ativa no próximo turno do oponente", () => {
    let state = game();
    const rested = placeCard(state, "B", UNIT(), "battleArea", { rested: true });
    const other = placeCard(state, "B", UNIT(), "battleArea", { rested: true });
    placeCard(state, "B", UNIT(), "battleArea"); // ativa: não é alvo
    ({ state } = deployFromHand(state, G["GD05-073"]));
    expect(entry(state, "A", "GD05-073-Deploy")?.legalTargets?.sort()).toEqual([rested, other].sort());
    state = resolve(state, "A", "GD05-073-Deploy", [rested]);
    state = endTurn(state);
    expect(state.activePlayer).toBe("B");
    expect(findCard(state, rested).rested).toBe(true);
    expect(findCard(state, other).rested).toBe(false);
  });

  it("074 Noin's Taurus 【Destroyed】 (destruída em batalha): compra 1 e descarta 1 (escolha inclui a comprada)", () => {
    let state = game();
    state.players.A.hand = [];
    const keep = placeCard(state, "A", UNIT({ nameEn: "Keep" }), "hand");
    const top = state.players.A.deck[0].instanceId;
    const self = placeCard(state, "A", G["GD05-074"], "battleArea");
    const enemy = placeCard(state, "B", UNIT({ ap: 2, hp: 9 }), "battleArea", { rested: true });
    state = runCombat(act(state, "A", { kind: "declareAttack", attackerId: self, target: { unitId: enemy } }));
    expect(inZone(state, "A", "trash", self)).toBe(true);
    const e = entry(state, "A", "GD05-074-Destroyed");
    expect(e?.handDiscard?.legalHandIds).toEqual(expect.arrayContaining([keep, top]));
    state = resolve(state, "A", "GD05-074-Destroyed", [keep]);
    expect(state.players.A.hand.map((c) => c.instanceId)).toEqual([top]);
    expect(inZone(state, "A", "trash", keep)).toBe(true);
  });

  it("074: se sobrevive à batalha, não compra", () => {
    let state = game();
    const hand0 = state.players.A.hand.length;
    const self = placeCard(state, "A", G["GD05-074"], "battleArea");
    const enemy = placeCard(state, "B", UNIT({ ap: 0, hp: 9 }), "battleArea", { rested: true });
    state = runCombat(act(state, "A", { kind: "declareAttack", attackerId: self, target: { unitId: enemy } }));
    expect(entry(state, "A", "GD05-074-Destroyed")).toBeUndefined();
    expect(state.players.A.hand.length).toBe(hand0);
  });

  it("075 Royal Gundam: não pode escolher o jogador inimigo como alvo; Unit inimiga descansada pode", () => {
    const state = game();
    const self = placeCard(state, "A", G["GD05-075"], "battleArea");
    const enemy = placeCard(state, "B", UNIT(), "battleArea", { rested: true });
    expect(attackTargetError(state, findCard(state, self), "player")).not.toBeNull();
    expect(() => act(state, "A", { kind: "declareAttack", attackerId: self, target: "player" })).toThrow();
    const s = act(state, "A", { kind: "declareAttack", attackerId: self, target: { unitId: enemy } });
    expect(s.combat?.currentTarget).toEqual({ unitId: enemy });
    const plain = placeCard(state, "A", UNIT(), "battleArea");
    expect(attackTargetError(state, findCard(state, plain), "player")).toBeNull();
  });

  it("079 Heavyarms Custom 【Activate･Main】【Once per Turn】: com outra (G Team), inimiga Lv.4- → AP-1; 2ª vez no turno não", () => {
    let state = game();
    const self = placeCard(state, "A", G["GD05-079"], "battleArea");
    placeCard(state, "A", UNIT({ traits: ["G Team"] }), "battleArea");
    const lv4 = placeCard(state, "B", UNIT({ level: 4, ap: 4 }), "battleArea");
    placeCard(state, "B", UNIT({ level: 5, ap: 4 }), "battleArea");
    const offers = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).filter((a) => a.kind === "activateAbility" && a.sourceInstanceId === self);
    expect(offers.map((a) => (a.kind === "activateAbility" ? a.targets?.target : undefined))).toEqual([[lv4]]);
    state = act(state, "A", { kind: "activateAbility", sourceInstanceId: self, targets: { target: [lv4] } });
    expect(ap(state, lv4)).toBe(3);
    const again = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).filter((a) => a.kind === "activateAbility" && a.sourceInstanceId === self);
    expect(again).toEqual([]);
  });

  it("079: sem outra (G Team)/(Preventer), não reduz", () => {
    let state = game();
    const self = placeCard(state, "A", G["GD05-079"], "battleArea");
    const lv4 = placeCard(state, "B", UNIT({ level: 4, ap: 4 }), "battleArea");
    const offers = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, OPTS).filter((a) => a.kind === "activateAbility" && a.sourceInstanceId === self);
    for (const offer of offers) state = act(state, "A", offer);
    expect(ap(state, lv4)).toBe(4);
  });
});

describe("GD05 Pilotos (W6 lote B) — \"this Unit\" = a Unit pareada", () => {
  it("081 Kira Yamato 【When Linked】: Link com Unit (Orb) ou (Triple Ship Alliance) → compra 1", () => {
    for (const trait of ["Orb", "Triple Ship Alliance"]) {
      let state = game();
      const unit = placeCard(state, "A", linkedTo(G["GD05-081"], { traits: [trait] }), "battleArea");
      const hand0 = state.players.A.hand.length;
      ({ state } = deployFromHand(state, G["GD05-081"], unit));
      expect(pending(state, "A")).toBeNull(); // sem escolha: resolve direto
      expect(state.players.A.hand.length).toBe(hand0 + 1);
    }
  });

  it("081: Link com Unit de outro trait não compra", () => {
    let state = game();
    const unit = placeCard(state, "A", linkedTo(G["GD05-081"], { traits: ["ZAFT"] }), "battleArea");
    const hand0 = state.players.A.hand.length;
    ({ state } = deployFromHand(state, G["GD05-081"], unit));
    expect(pending(state, "A")).toBeNull();
    expect(state.players.A.hand.length).toBe(hand0);
  });

  it("082 Andrew Waldfeld 【During Link】: a Unit pareada ganha <Repair 2> e cura no fim do turno; sem Link, não", () => {
    let state = game();
    const linked = placeCard(state, "A", linkedTo(G["GD05-082"]), "battleArea", { damage: 3 });
    ({ state } = deployFromHand(state, G["GD05-082"], linked));
    expect(keywordValue(findCard(state, linked), "Repair", state)).toBe(2);
    const unlinked = placeCard(state, "A", UNIT({ hp: 9 }), "battleArea");
    pair(state, unlinked, placeCard(state, "A", G["GD05-082"], "battleArea"));
    expect(hasKeyword(findCard(state, unlinked), "Repair", state)).toBe(false);
    state = endTurn(state);
    expect(dmg(state, linked)).toBe(1);
  });

  it("083 Cagalli 【When Paired】 (pareamento real): pede inimiga com 1 HP e devolve à mão do dono", () => {
    let state = game();
    const unit = placeCard(state, "A", UNIT(), "battleArea");
    const one = placeCard(state, "B", UNIT({ hp: 1 }), "battleArea");
    const hurt = placeCard(state, "B", UNIT({ hp: 3 }), "battleArea", { damage: 2 });
    const two = placeCard(state, "B", UNIT({ hp: 2 }), "battleArea");
    ({ state } = deployFromHand(state, G["GD05-083"], unit));
    expect(entry(state, "A", "GD05-083-WhenPaired")?.legalTargets?.sort()).toEqual([one, hurt].sort());
    expect(entry(state, "A", "GD05-083-WhenPaired")?.legalTargets).not.toContain(two);
    state = resolve(state, "A", "GD05-083-WhenPaired", [hurt]);
    expect(inZone(state, "B", "hand", hurt)).toBe(true);
  });

  it("085 Amuro Ray: no seu turno, a Unit pareada destrói inimiga em batalha → recupera 2 HP", () => {
    let state = game();
    const unit = placeCard(state, "A", UNIT({ ap: 5, hp: 9 }), "battleArea", { damage: 3 });
    pair(state, unit, placeCard(state, "A", G["GD05-085"], "battleArea"));
    const enemy = placeCard(state, "B", UNIT({ ap: 1, hp: 2 }), "battleArea", { rested: true });
    state = runCombat(act(state, "A", { kind: "declareAttack", attackerId: unit, target: { unitId: enemy } }));
    if (entry(state, "A", "GD05-085-DestroyedEnemy")) state = resolve(state, "A", "GD05-085-DestroyedEnemy", []);
    expect(inZone(state, "B", "trash", enemy)).toBe(true);
    expect(dmg(state, unit)).toBe(3 + 1 - 2);
  });

  it("085: no turno do oponente (bloqueando e destruindo o atacante), não recupera", () => {
    let state = game();
    state.activePlayer = "B";
    const unit = placeCard(state, "A", UNIT({ ap: 5, hp: 9, effectKeywords: ["Blocker"], keywordTags: ["Blocker"] }), "battleArea", { damage: 3 });
    pair(state, unit, placeCard(state, "A", G["GD05-085"], "battleArea"));
    const attacker = placeCard(state, "B", UNIT({ ap: 1, hp: 2 }), "battleArea");
    state = act(state, "B", { kind: "declareAttack", attackerId: attacker, target: "player" });
    state = act(state, "A", { kind: "activateBlocker", blockerId: unit });
    state = runCombat(state);
    expect(inZone(state, "B", "trash", attacker)).toBe(true);
    expect(entry(state, "A", "GD05-085-DestroyedEnemy")).toBeUndefined();
    expect(dmg(state, unit)).toBe(3 + 1);
  });

  it("087 Lauda Neill: Unit (Academy) pareada ganha <High-Maneuver>; outra Unit, não", () => {
    const state = game();
    const academy = placeCard(state, "A", UNIT({ traits: ["Academy"] }), "battleArea");
    pair(state, academy, placeCard(state, "A", G["GD05-087"], "battleArea"));
    const other = placeCard(state, "A", UNIT({ traits: ["Dawn of Fold"] }), "battleArea");
    pair(state, other, placeCard(state, "A", G["GD05-087"], "battleArea"));
    expect(hasKeyword(findCard(state, academy), "High-Maneuver", state)).toBe(true);
    expect(hasKeyword(findCard(state, other), "High-Maneuver", state)).toBe(false);
  });

  it("092 Auel Neider 【During Link】【Attack】: atacando o jogador, AP+2 nesta batalha", () => {
    let state = game();
    const unit = placeCard(state, "A", linkedTo(G["GD05-092"], { ap: 3 }), "battleArea");
    pair(state, unit, placeCard(state, "A", G["GD05-092"], "battleArea"));
    const before = ap(state, unit);
    state = act(state, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
    if (entry(state, "A", "GD05-092-Attack")) state = resolve(state, "A", "GD05-092-Attack", []);
    expect(ap(state, unit)).toBe(before + 2);
  });

  it("092: atacando Unit, ou sem Link, não ganha AP", () => {
    const state = game();
    const unit = placeCard(state, "A", linkedTo(G["GD05-092"], { ap: 3 }), "battleArea");
    pair(state, unit, placeCard(state, "A", G["GD05-092"], "battleArea"));
    const enemy = placeCard(state, "B", UNIT({ hp: 9 }), "battleArea", { rested: true });
    const before = ap(state, unit);
    let s = act(state, "A", { kind: "declareAttack", attackerId: unit, target: { unitId: enemy } });
    if (entry(s, "A", "GD05-092-Attack")) s = resolve(s, "A", "GD05-092-Attack", []);
    expect(ap(s, unit)).toBe(before);
    const unlinked = placeCard(state, "A", UNIT({ ap: 3 }), "battleArea");
    pair(state, unlinked, placeCard(state, "A", G["GD05-092"], "battleArea"));
    const before2 = ap(state, unlinked);
    s = act(state, "A", { kind: "declareAttack", attackerId: unlinked, target: "player" });
    if (entry(s, "A", "GD05-092-Attack")) s = resolve(s, "A", "GD05-092-Attack", []);
    expect(ap(s, unlinked)).toBe(before2);
  });

  it("094 Quess Paraya 【Destroyed】: pede 1 Unit (Neo Zeon) sua; neste turno o dano de batalha inimigo nela é -2", () => {
    let state = game();
    const unit = placeCard(state, "A", UNIT({ ap: 1, hp: 1 }), "battleArea");
    pair(state, unit, placeCard(state, "A", G["GD05-094"], "battleArea"));
    const nz = placeCard(state, "A", UNIT({ ap: 1, hp: 9, traits: ["Neo Zeon"] }), "battleArea");
    placeCard(state, "A", UNIT({ hp: 9, traits: ["Zeon"] }), "battleArea");
    const killer = placeCard(state, "B", UNIT({ ap: 3, hp: 9 }), "battleArea", { rested: true });
    state = runCombat(act(state, "A", { kind: "declareAttack", attackerId: unit, target: { unitId: killer } }));
    expect(inZone(state, "A", "trash", unit)).toBe(true);
    expect(entry(state, "A", "GD05-094-Destroyed")?.legalTargets).toEqual([nz]);
    state = resolve(state, "A", "GD05-094-Destroyed", [nz]);
    state = runCombat(act(state, "A", { kind: "declareAttack", attackerId: nz, target: { unitId: killer } }));
    expect(dmg(state, nz)).toBe(1); // 3 de AP - 2
  });

  it("095 Gyunei Guss: Unit (Neo Zeon) pareada ganha <Blocker>; outra Unit, não", () => {
    const state = game();
    const nz = placeCard(state, "A", UNIT({ traits: ["Neo Zeon"] }), "battleArea");
    pair(state, nz, placeCard(state, "A", G["GD05-095"], "battleArea"));
    const other = placeCard(state, "A", UNIT({ traits: ["Zeon"] }), "battleArea");
    pair(state, other, placeCard(state, "A", G["GD05-095"], "battleArea"));
    expect(hasKeyword(findCard(state, nz), "Blocker", state)).toBe(true);
    expect(hasKeyword(findCard(state, other), "Blocker", state)).toBe(false);
  });

  it("096 Chad Chadan 【Attack】: pode dar 1 de dano na Unit pareada; se der, outra (Tekkadan) sua recupera 1", () => {
    let state = game();
    const unit = placeCard(state, "A", UNIT({ hp: 9, traits: ["Tekkadan"] }), "battleArea");
    pair(state, unit, placeCard(state, "A", G["GD05-096"], "battleArea"));
    const ally = placeCard(state, "A", UNIT({ hp: 9, traits: ["Tekkadan"] }), "battleArea", { damage: 2 });
    placeCard(state, "A", UNIT({ hp: 9, traits: ["Gjallarhorn"] }), "battleArea", { damage: 2 });
    state = act(state, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
    const e = entry(state, "A", "GD05-096-Attack");
    expect(e?.optional).toBe(true);
    expect(e?.legalTargets).toEqual([ally]);
    state = resolve(state, "A", "GD05-096-Attack", [ally]);
    expect(dmg(state, unit)).toBe(1);
    expect(dmg(state, ally)).toBe(1);
  });

  it("096: recusar não dá dano nem cura", () => {
    let state = game();
    const unit = placeCard(state, "A", UNIT({ hp: 9, traits: ["Tekkadan"] }), "battleArea");
    pair(state, unit, placeCard(state, "A", G["GD05-096"], "battleArea"));
    const ally = placeCard(state, "A", UNIT({ hp: 9, traits: ["Tekkadan"] }), "battleArea", { damage: 2 });
    state = act(state, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
    state = resolve(state, "A", "GD05-096-Attack", [], false);
    expect(dmg(state, unit)).toBe(0);
    expect(dmg(state, ally)).toBe(2);
  });

  it("098 Heero Yuy: a Unit pareada destrói shield com dano → pede 1 Unit inimiga → AP-2 no turno", () => {
    let state = game();
    const unit = placeCard(state, "A", UNIT({ ap: 3, hp: 9 }), "battleArea");
    pair(state, unit, placeCard(state, "A", G["GD05-098"], "battleArea"));
    const enemy = placeCard(state, "B", UNIT({ ap: 4 }), "battleArea");
    const shields0 = state.players.B.shields.length;
    state = runCombat(act(state, "A", { kind: "declareAttack", attackerId: unit, target: "player" }));
    expect(state.players.B.shields.length).toBe(shields0 - 1);
    expect(entry(state, "A", "GD05-098-DestroyedShield")?.legalTargets).toEqual([enemy]);
    state = resolve(state, "A", "GD05-098-DestroyedShield", [enemy]);
    expect(ap(state, enemy)).toBe(2);
  });

  it("098: atacando Unit (sem destruir shield), não dispara", () => {
    let state = game();
    const unit = placeCard(state, "A", UNIT({ ap: 3, hp: 9 }), "battleArea");
    pair(state, unit, placeCard(state, "A", G["GD05-098"], "battleArea"));
    const enemy = placeCard(state, "B", UNIT({ ap: 4, hp: 9 }), "battleArea", { rested: true });
    state = runCombat(act(state, "A", { kind: "declareAttack", attackerId: unit, target: { unitId: enemy } }));
    expect(entry(state, "A", "GD05-098-DestroyedShield")).toBeUndefined();
    expect(ap(state, enemy)).toBe(4);
  });

  it("099 Trowa Barton: no seu turno, a Unit pareada destrói inimiga em batalha → compra 1 e descarta 1", () => {
    let state = game();
    state.players.A.hand = [];
    const keep = placeCard(state, "A", UNIT({ nameEn: "Keep" }), "hand");
    const top = state.players.A.deck[0].instanceId;
    const unit = placeCard(state, "A", UNIT({ ap: 5, hp: 9 }), "battleArea");
    pair(state, unit, placeCard(state, "A", G["GD05-099"], "battleArea"));
    const enemy = placeCard(state, "B", UNIT({ ap: 1, hp: 2 }), "battleArea", { rested: true });
    state = runCombat(act(state, "A", { kind: "declareAttack", attackerId: unit, target: { unitId: enemy } }));
    const e = entry(state, "A", "GD05-099-DestroyedEnemy");
    expect(e?.handDiscard?.legalHandIds).toEqual(expect.arrayContaining([keep, top]));
    state = resolve(state, "A", "GD05-099-DestroyedEnemy", [top]);
    expect(state.players.A.hand.map((c) => c.instanceId)).toEqual([keep]);
  });

  it("099: se a inimiga sobrevive, não compra", () => {
    let state = game();
    const hand0 = state.players.A.hand.length;
    const unit = placeCard(state, "A", UNIT({ ap: 1, hp: 9 }), "battleArea");
    pair(state, unit, placeCard(state, "A", G["GD05-099"], "battleArea"));
    const enemy = placeCard(state, "B", UNIT({ ap: 1, hp: 9 }), "battleArea", { rested: true });
    state = runCombat(act(state, "A", { kind: "declareAttack", attackerId: unit, target: { unitId: enemy } }));
    expect(entry(state, "A", "GD05-099-DestroyedEnemy")).toBeUndefined();
    expect(state.players.A.hand.length).toBe(hand0);
  });

  it("100 Quatre 【When Paired】 (pareamento real): pede inimiga Lv.5- e a descansa", () => {
    let state = game();
    const unit = placeCard(state, "A", UNIT(), "battleArea");
    const lv5 = placeCard(state, "B", UNIT({ level: 5 }), "battleArea");
    const lv6 = placeCard(state, "B", UNIT({ level: 6 }), "battleArea");
    ({ state } = deployFromHand(state, G["GD05-100"], unit));
    expect(entry(state, "A", "GD05-100-WhenPaired")?.legalTargets).toEqual([lv5]);
    state = resolve(state, "A", "GD05-100-WhenPaired", [lv5]);
    expect(findCard(state, lv5).rested).toBe(true);
    expect(findCard(state, lv6).rested).toBe(false);
  });

  it("101 Gavane Goonny 【Once per Turn】: pagar ① num efeito de Unit sua → Unit (Militia) pareada pode recuperar 2", () => {
    let state = game();
    resources(state, "A", 4);
    const militia = placeCard(state, "A", UNIT({ hp: 9, traits: ["Militia"] }), "battleArea", { damage: 3 });
    pair(state, militia, placeCard(state, "A", G["GD05-101"], "battleArea"));
    const kapool = placeCard(state, "A", GD04_CARD_DEFS["GD04-074"], "battleArea"); // 【Attack】 paga ①
    state = act(state, "A", { kind: "declareAttack", attackerId: kapool, target: "player" });
    const discard = state.players.A.hand[0].instanceId;
    state = resolve(state, "A", "GD04-074-Attack", [discard]);
    const e = entry(state, "A", "GD05-101-PaidForUnitEffect");
    expect(e?.optional).toBe(true);
    state = resolve(state, "A", "GD05-101-PaidForUnitEffect", []);
    expect(dmg(state, militia)).toBe(1);
  });

  it("101: Unit pareada que não é (Militia) não recupera", () => {
    let state = game();
    resources(state, "A", 4);
    const unit = placeCard(state, "A", UNIT({ hp: 9, traits: ["Earth Federation"] }), "battleArea", { damage: 3 });
    pair(state, unit, placeCard(state, "A", G["GD05-101"], "battleArea"));
    const kapool = placeCard(state, "A", GD04_CARD_DEFS["GD04-074"], "battleArea");
    state = act(state, "A", { kind: "declareAttack", attackerId: kapool, target: "player" });
    state = resolve(state, "A", "GD04-074-Attack", [state.players.A.hand[0].instanceId]);
    if (entry(state, "A", "GD05-101-PaidForUnitEffect")) state = resolve(state, "A", "GD05-101-PaidForUnitEffect", []);
    expect(dmg(state, unit)).toBe(3);
  });
});
