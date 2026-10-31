import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { effectiveAp, hasKeyword, keywordValue, trashCardDef } from "./types";
import { enumerateLegalActions } from "./legalActions";
import { legalMenuFor } from "./legalMenu";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { getCardDefByCode } from "../content/allCardDefs";

/** W13b — GD06 (Stardust Trails): as 21 cartas de motor novo + a proteção da área de escudo (Q539). */

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


describe("GD06 — reações novas", () => {
  it("GD06-001 GP01Fb: quando é atacada compra 1 (1×/turno); 【During Pair】 <High-Maneuver>", () => {
    let s = game();
    s.activePlayer = "B";
    const gp = placeCard(s, "A", card("GD06-001"), "battleArea", { rested: true });
    const a1 = placeCard(s, "B", UNIT({ code: "TEST-A1" }), "battleArea");
    s = act(s, "B", { kind: "declareAttack", attackerId: a1, target: { unitId: gp } });
    expect(s.players.A.hand).toHaveLength(1);
    expect(hasKeyword(findCard(s, gp), "High-Maneuver", s)).toBe(false);
    pair(s, gp, placeCard(s, "A", PILOT(), "battleArea"));
    expect(hasKeyword(findCard(s, gp), "High-Maneuver", s)).toBe(true);
  });

  it("GD06-097 Harry Ord: ao ativar <Blocker>, a Unit volta a ficar ativa (1×/turno)", () => {
    let s = game();
    s.activePlayer = "B";
    const blocker = placeCard(s, "A", UNIT({ code: "TEST-BL", hp: 9, effectKeywords: ["Blocker"] }), "battleArea");
    pair(s, blocker, placeCard(s, "A", card("GD06-097"), "battleArea"));
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK", ap: 1 }), "battleArea");
    s = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: "player" });
    s = act(s, "A", { kind: "activateBlocker", blockerId: blocker });
    expect(s.combat?.currentTarget).toEqual({ unitId: blocker });
    expect(findCard(s, blocker).rested).toBe(false);
  });

  it("GD06-125 Argama: recebeu dano de batalha com (AEUG) descansada → 1 de dano numa inimiga", () => {
    let s = game();
    s.activePlayer = "B";
    placeCard(s, "A", card("GD06-125"), "baseSection");
    placeCard(s, "A", UNIT({ code: "TEST-AEUG", traits: ["AEUG"] }), "battleArea", { rested: true });
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK", ap: 2, hp: 5 }), "battleArea");
    s = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: "player" });
    s = act(s, "A", { kind: "skipBlock" });
    s = runCombatAs(s);
    s = resolveWith(s, "A", { specId: "GD06-125-DamagedByEnemy", targetIds: [attacker] });
    expect(findCard(s, attacker).damage).toBe(1);
  });

  it("GD06-020 Hamma-Hamma: (Neo Zeon) amiga destruiu escudo inimigo no seu turno → recupera 1 HP (Q496)", () => {
    let s = game();
    const hamma = placeCard(s, "A", card("GD06-020"), "battleArea", { damage: 2 });
    const nz = placeCard(s, "A", UNIT({ code: "TEST-NZ", traits: ["Neo Zeon"] }), "battleArea");
    s = toActionStep(s, nz, "player");
    s = runCombat(s);
    expect(findCard(s, hamma).damage).toBe(1);
  });

  it("GD06-020 Hamma-Hamma: destruir com dano de EFEITO também conta (Q497)", () => {
    let s = game();
    const hamma = placeCard(s, "A", card("GD06-020"), "battleArea", { damage: 2 });
    const victim = placeCard(s, "B", UNIT({ code: "TEST-V", hp: 1 }), "battleArea");
    // GD06-041 (Earth Alliance, não Neo Zeon) não conta; a própria Hamma-Hamma é (Neo Zeon): GD06-036? usa uma Neo Zeon com 【Deploy】 de dano
    const nzDamage: CardDef = { ...card("GD06-041"), code: "GD06-041", traits: ["Neo Zeon"] };
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", nzDamage, "hand") });
    s = resolveWith(s, "A", { specId: "GD06-041-Deploy", targetIds: [victim] });
    expect(inZone(s, "B", "trash", victim)).toBe(true);
    expect(findCard(s, hamma).damage).toBe(1);
  });
});

describe("GD06 — camada de dano", () => {
  it("GD06-033 ZZ: dano das cartas (AEUG) em Units inimigas +1 — batalha e o próprio 【Deploy】 (Q503/Q504)", () => {
    let s = game();
    const e1 = placeCard(s, "B", UNIT({ code: "TEST-E1", hp: 9 }), "battleArea");
    const e2 = placeCard(s, "B", UNIT({ code: "TEST-E2", hp: 9 }), "battleArea", { rested: true });
    placeCard(s, "A", RESOURCE, "resourceArea");
    s = deploy(s, "GD06-033");
    expect(findCard(s, e1).damage).toBe(3);
    expect(findCard(s, e2).damage).toBe(3);
    const aeug = placeCard(s, "A", UNIT({ code: "TEST-AEUG", ap: 2, traits: ["AEUG"] }), "battleArea");
    s = toActionStep(s, aeug, { unitId: e2 });
    s = runCombat(s);
    expect(findCard(s, e2).damage).toBe(6);
  });

  it("GD06-093 Gato 【Attack】: nesta batalha, dano de batalha de inimiga de Lv. ≤ reduzido em 2", () => {
    let s = game();
    const unit = placeCard(s, "A", UNIT({ code: "TEST-U", level: 5, hp: 9 }), "battleArea");
    pair(s, unit, placeCard(s, "A", card("GD06-093"), "battleArea"));
    const low = placeCard(s, "B", UNIT({ code: "TEST-LOW", level: 5, ap: 4, hp: 9 }), "battleArea", { rested: true });
    s = toActionStep(s, unit, { unitId: low });
    s = runCombat(s);
    expect(findCard(s, unit).damage).toBe(2);
  });

  it("GD06-098 Duo 【During Link】 descansada: Bases amigas não recebem dano de inimigas de Lv. ≤ (Q536)", () => {
    let s = game();
    s.activePlayer = "B";
    const base = placeCard(s, "A", BASE(), "baseSection");
    const unit = placeCard(s, "A", UNIT({ code: "TEST-U", level: 6, link: { kind: "pilotName", values: ["Duo Maxwell"] } }), "battleArea", { rested: true });
    pair(s, unit, placeCard(s, "A", card("GD06-098"), "battleArea"));
    const low = placeCard(s, "B", UNIT({ code: "TEST-L6", level: 6, ap: 3 }), "battleArea");
    s = act(s, "B", { kind: "declareAttack", attackerId: low, target: "player" });
    s = act(s, "A", { kind: "skipBlock" });
    s = runCombatAs(s);
    expect(findCard(s, base).damage).toBe(0);
    expect(s.players.A.shields).toHaveLength(3);
  });

  it("Q539: a proteção da área de escudo (GD06-106) vale pra Base e pro <Breach>", () => {
    let s = game();
    s.activePlayer = "B";
    const base = placeCard(s, "A", BASE(), "baseSection");
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK", ap: 6 }), "battleArea");
    s = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: "player" });
    s = act(s, "A", { kind: "skipBlock" });
    if (s.combat?.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("GD06-106"), "hand"), trigger: "Action" });
    s = runCombatAs(s);
    expect(findCard(s, base).damage).toBe(0);

    let s2 = game();
    s2.activePlayer = "B";
    const breacher = placeCard(s2, "B", UNIT({ code: "TEST-BR", ap: 6, effectKeywords: ["Breach"], keywordTags: ["Breach 3"] }), "battleArea");
    const victim = placeCard(s2, "A", UNIT({ code: "TEST-V", hp: 1 }), "battleArea", { rested: true });
    s2 = act(s2, "B", { kind: "declareAttack", attackerId: breacher, target: { unitId: victim } });
    s2 = act(s2, "A", { kind: "skipBlock" });
    if (s2.combat?.actionPriority === "B") s2 = act(s2, "B", { kind: "passAction" });
    s2 = act(s2, "A", { kind: "playCommand", cardInstanceId: placeCard(s2, "A", card("GD06-106"), "hand"), trigger: "Action" });
    s2 = runCombatAs(s2);
    expect(inZone(s2, "A", "trash", victim)).toBe(true);
    expect(s2.players.A.shields).toHaveLength(3);
  });
});

describe("GD06 — custos e rastreios do turno", () => {
  it("GD06-050 Legend: no trash, com Link Unit (ZAFT), Lv./custo -3", () => {
    const s = game();
    const legend = placeCard(s, "A", card("GD06-050"), "trash");
    expect(trashCardDef(s, findCard(s, legend)).level).toBe(card("GD06-050").level);
    const zaft = placeCard(s, "A", UNIT({ code: "TEST-ZAFT", traits: ["ZAFT"], link: { kind: "pilotName", values: ["Test Pilot"] } }), "battleArea");
    pair(s, zaft, placeCard(s, "A", PILOT(), "battleArea"));
    expect(trashCardDef(s, findCard(s, legend)).level).toBe((card("GD06-050").level ?? 0) - 3);
    expect(trashCardDef(s, findCard(s, legend)).cost).toBe((card("GD06-050").cost ?? 0) - 3);
  });

  it("GD06-086/100: custo -1 ao parear com a Unit certa (o Lv. não muda — Q532/Q537)", () => {
    let s = game();
    s.players.A.resourceArea.forEach((r) => (r.rested = true));
    s.players.A.resourceArea[0].rested = false; // só 1 Resource ativo: Mashymre (custo 1) sai por 0
    s.players.A.resourceArea = s.players.A.resourceArea.slice(0, 3);
    const unit = placeCard(s, "A", UNIT({ code: "TEST-MU", link: { kind: "pilotName", values: ["Mashymre Cello"] } }), "battleArea");
    s.players.A.resourceArea[0].rested = true;
    const mashymre = placeCard(s, "A", card("GD06-086"), "hand");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: mashymre, pairWithUnitId: unit });
    expect(findCard(s, unit).pairedPilotId).toBe(mashymre);

    let s2 = game();
    const dc = placeCard(s2, "A", UNIT({ code: "TEST-DC", level: 5, traits: ["Dianna Counter"] }), "battleArea");
    for (const r of s2.players.A.resourceArea) r.rested = false;
    s2 = act(s2, "A", { kind: "deployCard", cardInstanceId: placeCard(s2, "A", card("GD06-100"), "hand"), pairWithUnitId: dc });
    expect(s2.players.A.resourceArea.filter((r) => r.rested)).toHaveLength(0);
  });

  it("GD06-080 Kou: o 【Activate･Action】 só cura se você comprou por efeito neste turno", () => {
    const setup = (drewByEffect: boolean) => {
      let s = game();
      const unit = placeCard(s, "A", UNIT({ code: "TEST-U", hp: 6 }), "battleArea", { damage: 3 });
      const kou = placeCard(s, "A", card("GD06-080"), "battleArea");
      pair(s, unit, kou);
      // compra por efeito na Main Phase (a da Draw Phase não conta)
      if (drewByEffect) s.eventLog.push({ type: "DRAW_CARD", player: "A", from: "deck", instanceId: null });
      const attacker = placeCard(s, "A", UNIT({ code: "TEST-ATK" }), "battleArea");
      s = toActionStep(s, attacker, "player");
      s = act(s, "A", { kind: "activateAbility", sourceInstanceId: kou, targets: { target: [unit] } });
      if (entry(s, "A", "GD06-080-ActivateAction")) s = resolveWith(s, "A", { specId: "GD06-080-ActivateAction", targetIds: [unit] });
      return findCard(s, unit).damage;
    };
    expect(setup(false)).toBe(3);
    expect(setup(true)).toBe(1);
  });

  it("GD06-102 A Miracle: no turno do oponente, sem ataque inimigo no turno, compra 2", () => {
    const s = game();
    s.activePlayer = "B";
    const ctx = { state: s, controller: "A" as PlayerId, sourceInstanceId: placeCard(s, "A", card("GD06-102"), "hand"), targets: {}, turnNumber: s.turnNumber };
    expect(defaultPredicateResolver("isOpponentTurn;noEnemyAttackedThisTurn", ctx as never)).toBe(true);
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK" }), "battleArea");
    const s2 = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: "player" });
    expect(defaultPredicateResolver("isOpponentTurn;noEnemyAttackedThisTurn", { ...ctx, state: s2 } as never)).toBe(false);
  });

  it("GD06-051 GFreD: com outra (Alphacide), no fim do turno ativa 2 Resources (Q518)", () => {
    let s = game();
    placeCard(s, "A", UNIT({ code: "TEST-ALPHA", traits: ["Alphacide"] }), "battleArea");
    for (const r of s.players.A.resourceArea) r.rested = false;
    s = deploy(s, "GD06-051");
    const restedBefore = s.players.A.resourceArea.filter((r) => r.rested).map((r) => r.instanceId);
    expect(restedBefore.length).toBeGreaterThanOrEqual(2);
    s = act(s, "A", { kind: "finishTurn" });
    for (let i = 0; i < 4 && s.endPhaseAction && !pending(s, "A"); i++) s = act(s, s.endPhaseAction.priority, { kind: "passEndPhaseAction" });
    s = resolveWith(s, "A", { specId: "GD06-051-EndOfTurn", targetIds: restedBefore.slice(0, 2) });
    for (const id of restedBefore.slice(0, 2)) expect(findCard(s, id).rested).toBe(false);
  });
});

describe("GD06 — primitivas novas", () => {
  it("GD06-021 Turn X (Top): deploya um token novo igual ao escolhido, descansado e sem dano (Q498)", () => {
    let s = game();
    const tok = placeCard(s, "A", { ...card("GD06-109"), ...{ code: "T-031", nameEn: "Turn X (Arms)", cardType: "UNIT", ap: 2, hp: 3, isToken: true } } as CardDef, "battleArea", { damage: 2 });
    s = deploy(s, "GD06-021");
    s = resolveWith(s, "A", { specId: "GD06-021-Deploy", targetIds: [tok] });
    const copies = s.players.A.battleArea.filter((c) => c.def.code === "T-031");
    expect(copies).toHaveLength(2);
    const fresh = copies.find((c) => c.instanceId !== tok)!;
    expect(fresh.rested).toBe(true);
    expect(fresh.damage).toBe(0);
  });

  it("GD06-039 Neo Core Fighter: destrói Core Top + Core Base (nomes diferentes) e ela, deploya (Gundam Team) Lv.8+ da mão", () => {
    let s = game();
    const fighter = placeCard(s, "A", card("GD06-039"), "battleArea");
    const top = placeCard(s, "A", card("GD06-044"), "battleArea");
    const base = placeCard(s, "A", card("GD06-045"), "battleArea");
    const zz = placeCard(s, "A", card("GD06-033"), "hand");
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: fighter });
    for (let i = 0; i < 6 && pending(s, "A"); i++) {
      const q = pending(s, "A")!.queue[0];
      s = resolveWith(s, "A", {
        specId: q.specId,
        targetIds: q.handChoice ? [zz] : [],
        ...(q.secondaryTarget ? { secondaryTargetIds: [top, base] } : {}),
      });
    }
    for (const id of [fighter, top, base]) expect(inZone(s, "A", "trash", id)).toBe(true);
    expect(inZone(s, "A", "battleArea", zz)).toBe(true);
  });

  it("GD06-039: duas Units com o MESMO nome não pagam o custo", () => {
    const s = game();
    const fighter = placeCard(s, "A", card("GD06-039"), "battleArea");
    placeCard(s, "A", card("GD06-044"), "battleArea");
    placeCard(s, "A", card("GD06-044"), "battleArea");
    placeCard(s, "A", card("GD06-033"), "hand");
    const offered = enumerateLegalActions(s, "A", ALL_EFFECT_SPECS, { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver }).some(
      (a) => a.kind === "activateAbility" && a.sourceInstanceId === fighter,
    );
    expect(offered).toBe(false);
  });

  it("GD06-042 Destroy Gundam: pareia um Piloto (Biological CPU) do topo 4, sem custo (Q513)", () => {
    let s = game();
    const cpu = onTop(s, "A", PILOT({ code: "TEST-CPU", traits: ["Biological CPU"] }));
    s = deploy(s, "GD06-042");
    const destroy = s.players.A.battleArea.find((c) => c.def.code === "GD06-042")!;
    s = resolveWith(s, "A", { specId: "GD06-042-Deploy", targetIds: [cpu] });
    expect(findCard(s, destroy.instanceId).pairedPilotId).toBe(cpu);
  });

  it("GD06-084 Elpeo Ple: <Breach> = nº de Units (Neo Zeon)/(Long-Range Weapon)", () => {
    let s = game();
    const unit = placeCard(s, "A", UNIT({ code: "TEST-NZ", traits: ["Neo Zeon"] }), "battleArea");
    placeCard(s, "A", UNIT({ code: "TEST-LRW", traits: ["Long-Range Weapon"] }), "battleArea");
    placeCard(s, "A", UNIT({ code: "TEST-X" }), "battleArea");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", card("GD06-084"), "hand"), pairWithUnitId: unit });
    expect(keywordValue(findCard(s, unit), "Breach", s)).toBe(2);
  });

  it("GD06-118 Infinite Variations: o máximo de alvos é N (Units brancas com <Blocker>) — fila, menu e validação", () => {
    let s = game();
    placeCard(s, "A", UNIT({ code: "TEST-WB1", color: "white", effectKeywords: ["Blocker"] }), "battleArea");
    placeCard(s, "A", UNIT({ code: "TEST-WB2", color: "white", effectKeywords: ["Blocker"] }), "battleArea");
    placeCard(s, "A", UNIT({ code: "TEST-RB", color: "red", effectKeywords: ["Blocker"] }), "battleArea");
    const enemies = [0, 1, 2].map((i) => placeCard(s, "B", UNIT({ code: `TEST-E${i}`, ap: 5 }), "battleArea"));
    // o menu de jogadas (o que a tela oferece) já vem limitado a 2
    const cmd = placeCard(s, "A", card("GD06-118"), "hand");
    const offer = enumerateLegalActions(s, "A", ALL_EFFECT_SPECS, { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver }).find(
      (a) => a.kind === "playCommand" && a.cardInstanceId === cmd && a.trigger === "Main",
    );
    expect(offer && "targets" in offer ? offer.targets?.target : []).toHaveLength(2);
    // o seletor da tela (legalMenu) também: até 2 marcados entre as 3 inimigas
    const menu = legalMenuFor(s, "A", ALL_EFFECT_SPECS, { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver });
    const entryMenu = menu.entries.find((e) => e.kind === "playCommand" && e.cardInstanceId === cmd && e.trigger === "Main");
    const slot = entryMenu?.kind === "playCommand" ? entryMenu.slots.find((sl) => sl.name === "target") : undefined;
    expect(slot && { min: slot.min, max: slot.max, n: slot.legalTargets.length }).toEqual({ min: 1, max: 2, n: 3 });
    expect(() => act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main", targets: { target: enemies } })).toThrow();
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main", targets: { target: enemies.slice(0, 2) } });
    expect(enemies.map((id) => effectiveAp(findCard(s, id), s))).toEqual([3, 3, 5]);
  });

  it("GD06-118: sem Unit branca com <Blocker>, não há alvo — a Command não é oferecida", () => {
    const s = game();
    placeCard(s, "B", UNIT({ code: "TEST-E" }), "battleArea");
    const cmd = placeCard(s, "A", card("GD06-118"), "hand");
    const offered = enumerateLegalActions(s, "A", ALL_EFFECT_SPECS, { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver }).some(
      (a) => a.kind === "playCommand" && a.cardInstanceId === cmd,
    );
    expect(offered).toBe(false);
  });

  it("GD06-037 Reginlaze Julia: <First Strike> contra Unit danificada no seu turno; pareada, inimigas não se reativam por efeito próprio", () => {
    let s = game();
    const julia = placeCard(s, "A", card("GD06-037"), "battleArea");
    const hurt = placeCard(s, "B", UNIT({ code: "TEST-H", hp: 9 }), "battleArea", { rested: true, damage: 1 });
    s = act(s, "A", { kind: "declareAttack", attackerId: julia, target: { unitId: hurt } });
    expect(hasKeyword(findCard(s, julia), "First Strike", s)).toBe(true);
    s.activePlayer = "B";
    expect(hasKeyword(findCard(s, julia), "First Strike", s)).toBe(false); // só no seu turno

    let s2 = game();
    const julia2 = placeCard(s2, "B", card("GD06-037"), "battleArea");
    pair(s2, julia2, placeCard(s2, "B", PILOT(), "battleArea"));
    const mine = placeCard(s2, "A", UNIT({ code: "TEST-M" }), "battleArea", { rested: true });
    // EB01-084-like: uma Unit do controlador se reativando por efeito do próprio controlador (GD06-065 SUMO Gold)
    const sumo = placeCard(s2, "A", card("GD06-065"), "battleArea", { rested: true });
    for (const r of s2.players.A.resourceArea) r.rested = false;
    s2 = act(s2, "A", { kind: "activateAbility", sourceInstanceId: sumo });
    expect(findCard(s2, sumo).rested).toBe(true);
    expect(findCard(s2, mine).rested).toBe(true);
  });

  it("GD06-018 Qubeley Mk-Ⅱ 【During Pair】: o dano de batalha vai pra Base (Neo Zeon) escolhida (Q493)", () => {
    let s = game();
    s.activePlayer = "B";
    const qub = placeCard(s, "A", card("GD06-018"), "battleArea", { rested: true });
    pair(s, qub, placeCard(s, "A", PILOT(), "battleArea"));
    const base = placeCard(s, "A", BASE({ traits: ["Neo Zeon"], hp: 9 }), "baseSection");
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK", ap: 4 }), "battleArea");
    s = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: qub } });
    s = act(s, "A", { kind: "skipBlock" });
    if (s.combat?.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: qub, targets: { target: [base] } });
    s = runCombatAs(s);
    expect(findCard(s, qub).damage).toBe(0);
    expect(findCard(s, base).damage).toBe(4);
  });
});

/** combate em que o defensor é A: passa o Action Step pelos dois */
function runCombatAs(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 10 && s.combat && !s.pendingDecision.A && !s.pendingDecision.B; i++) {
    if (s.combat.step === "action") s = act(s, s.combat.actionPriority, { kind: "passAction" });
    else break;
  }
  return s;
}
