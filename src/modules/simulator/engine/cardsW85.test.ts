import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { hasKeyword, hasTrait } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { dispatchTrigger } from "./dispatcher";
import { computeLegalTargets } from "./effectSpec";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { getCardDefByCode } from "../content/allCardDefs";

/** W8.5 — dívida dos sets fechados: as 6 cartas sem efeito e as 3 aproximações, pelo FAQ oficial de cada set. */

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
const BASE = (extra: Partial<CardDef> = {}): CardDef => ({
  code: "TEST-BASE",
  nameEn: "Test Base",
  cardType: "BASE",
  color: "white",
  level: 1,
  cost: 1,
  ap: 0,
  hp: 5,
  traits: [],
  ...extra,
});
const RESOURCE: CardDef = { code: "TEST-RES", nameEn: "Resource", cardType: "RESOURCE", color: "white", level: 0, cost: 0, ap: 0, hp: 0 };
const SHIELD = UNIT({ code: "TEST-SHIELD", nameEn: "Plain Shield" });
const OPTS = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };

function game(): GameState {
  const state = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 85, firstPlayer: "A" }));
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
const resolve = (state: GameState, player: PlayerId, specId: string, targetIds: string[], secondaryTargetIds?: string[]) =>
  act(state, player, { kind: "resolveAbility", resolutions: [{ specId, activate: true, targetIds, secondaryTargetIds }] });
function pair(s: GameState, unit: string, pilot: string): void {
  findCard(s, unit).pairedPilotId = pilot;
  findCard(s, pilot).pairedUnitId = unit;
}
/** Unit que linka com um Piloto de nome `pilotName` */
const linkUnit = (extra: Partial<CardDef>, pilotName = "Link Pilot"): CardDef => UNIT({ link: { kind: "pilotName", values: [pilotName] }, ...extra });
function runCombat(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 10 && s.combat && !s.pendingDecision.A && !s.pendingDecision.B; i++) {
    if (s.combat.step === "block") s = act(s, s.combat.defendingPlayer, { kind: "skipBlock" });
    else if (s.combat.step === "action") s = act(s, s.combat.actionPriority, { kind: "passAction" });
    else break;
  }
  return s;
}

describe("ST06-015 Kaneban Co., Ltd. — quando uma Unit (Clan) sua linka", () => {
  it("ganha <Breach 3> no turno; 【Once per Turn】; Unit sem (Clan) ou pareamento sem Link não dispara", () => {
    let s = game();
    placeCard(s, "A", card("ST06-015"), "baseSection");
    const clan = placeCard(s, "A", linkUnit({ code: "TEST-CLAN", traits: ["Clan"] }), "battleArea");
    const clan2 = placeCard(s, "A", linkUnit({ code: "TEST-CLAN2", traits: ["Clan"] }), "battleArea");
    const other = placeCard(s, "A", linkUnit({ code: "TEST-OTHER" }), "battleArea");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", PILOT({ nameEn: "Link Pilot" }), "hand"), pairWithUnitId: other });
    expect(hasKeyword(findCard(s, other), "Breach", s)).toBe(false);
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", PILOT({ nameEn: "Link Pilot" }), "hand"), pairWithUnitId: clan });
    expect(hasKeyword(findCard(s, clan), "Breach", s)).toBe(true);
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", PILOT({ nameEn: "Link Pilot" }), "hand"), pairWithUnitId: clan2 });
    expect(hasKeyword(findCard(s, clan2), "Breach", s)).toBe(false);
  });

  it("pareamento sem Link não conta", () => {
    let s = game();
    placeCard(s, "A", card("ST06-015"), "baseSection");
    const clan = placeCard(s, "A", linkUnit({ code: "TEST-CLAN", traits: ["Clan"] }), "battleArea");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", PILOT({ nameEn: "Outro" }), "hand"), pairWithUnitId: clan });
    expect(hasKeyword(findCard(s, clan), "Breach", s)).toBe(false);
  });
});

describe("ST08-011 Lane Aim — quando você compra por efeito", () => {
  const drawSpec = [{ id: "T-draw", cardCode: "TEST-UNIT", trigger: "Main", actions: [{ op: "draw" as const, player: "controller" as const, n: 2 }], sourceText: "t" }];

  it("pareado com Unit azul: ganha <High-Maneuver> no turno; com Unit não azul, nada", () => {
    let s = game();
    const blue = placeCard(s, "A", UNIT({ code: "TEST-BLUE", color: "blue" }), "battleArea");
    pair(s, blue, placeCard(s, "A", card("ST08-011"), "battleArea"));
    const white = placeCard(s, "A", UNIT({ code: "TEST-WHITE" }), "battleArea");
    pair(s, white, placeCard(s, "A", card("ST08-011"), "battleArea"));
    const source = placeCard(s, "A", UNIT(), "battleArea");
    s = dispatchTrigger(s, source, "Main", drawSpec, { allSpecs: ALL_EFFECT_SPECS, ...OPTS });
    expect(hasKeyword(findCard(s, blue), "High-Maneuver", s)).toBe(true);
    expect(hasKeyword(findCard(s, white), "High-Maneuver", s)).toBe(false);
  });

  it("a compra da Draw Phase não é efeito", () => {
    let s = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 85, firstPlayer: "A" }));
    const blue = placeCard(s, "B", UNIT({ code: "TEST-BLUE", color: "blue" }), "battleArea");
    pair(s, blue, placeCard(s, "B", card("ST08-011"), "battleArea"));
    s = act(s, "A", { kind: "finishTurn" });
    while (s.endPhaseAction) s = act(s, s.endPhaseAction.priority, { kind: "passEndPhaseAction" });
    expect(s.activePlayer).toBe("B");
    expect(hasKeyword(findCard(s, blue), "High-Maneuver", s)).toBe(false);
  });
});

describe("GD02-073 Carta's Graze Ritter — a Unit inimiga que batalha com ela ganha <First Strike> no turno do oponente", () => {
  it("só no turno do oponente e só enquanto batalha com ela (FAQ Q185: bloqueio troca a batalha)", () => {
    let s = game();
    const ritter = placeCard(s, "A", card("GD02-073"), "battleArea", { rested: true });
    const blocker = placeCard(s, "A", UNIT({ code: "TEST-BLOCKER", effectKeywords: ["Blocker"] }), "battleArea");
    s.activePlayer = "B";
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATTACKER" }), "battleArea");
    s = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: ritter } });
    expect(hasKeyword(findCard(s, attacker), "First Strike", s)).toBe(true);
    s = act(s, "A", { kind: "activateBlocker", blockerId: blocker });
    expect(hasKeyword(findCard(s, attacker), "First Strike", s)).toBe(false);
  });

  it("no turno do dono da Graze Ritter, quem batalha com ela não ganha nada", () => {
    let s = game();
    const ritter = placeCard(s, "A", card("GD02-073"), "battleArea");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E" }), "battleArea", { rested: true });
    s = act(s, "A", { kind: "declareAttack", attackerId: ritter, target: { unitId: enemy } });
    expect(hasKeyword(findCard(s, enemy), "First Strike", s)).toBe(false);
  });
});

describe("GD03-079 G-Defenser — descansa no lugar da Base (FAQ Q425)", () => {
  it("GD02-075 【Attack】: com Base ativa, a G-Defenser também é alvo; escolhida, ela descansa e a Base fica ativa", () => {
    let s = game();
    const base = placeCard(s, "A", BASE(), "baseSection");
    const defenser = placeCard(s, "A", card("GD03-079"), "battleArea");
    const rick = placeCard(s, "A", card("GD02-075"), "battleArea");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", level: 3 }), "battleArea", { rested: true });
    s = act(s, "A", { kind: "declareAttack", attackerId: rick, target: { unitId: enemy } });
    expect(entry(s, "A", "GD02-075-Attack")?.legalTargets.sort()).toEqual([base, defenser].sort());
    s = resolve(s, "A", "GD02-075-Attack", [defenser], [enemy]);
    expect(findCard(s, defenser).rested).toBe(true);
    expect(findCard(s, base).rested).toBe(false);
  });

  it("sem Base que poderia ser descansada, a G-Defenser não entra (Q425)", () => {
    const s = game();
    placeCard(s, "A", card("GD03-079"), "battleArea");
    const rick = placeCard(s, "A", card("GD02-075"), "battleArea");
    const spec = ALL_EFFECT_SPECS.find((x) => x.id === "GD02-075-Attack")!;
    expect(computeLegalTargets(s, spec, "A", defaultTargetFilterResolver, rick)).toEqual([]);
    placeCard(s, "A", BASE(), "baseSection", { rested: true });
    expect(computeLegalTargets(s, spec, "A", defaultTargetFilterResolver, rick)).toEqual([]);
  });
});

describe("GD03-097 Wistario Afam — olha 2 do topo quando destrói em batalha no seu turno", () => {
  it("devolve 1 ao topo e manda a outra ao trash; 【Once per Turn】", () => {
    let s = game();
    const unit = placeCard(s, "A", linkUnit({ code: "TEST-W", ap: 5, hp: 5 }, "Wistario Afam"), "battleArea");
    pair(s, unit, placeCard(s, "A", card("GD03-097"), "battleArea"));
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", hp: 2 }), "battleArea", { rested: true });
    const [top1, top2] = s.players.A.deck.slice(0, 2).map((c) => c.instanceId);
    s = runCombat(act(s, "A", { kind: "declareAttack", attackerId: unit, target: { unitId: enemy } }));
    const e = entry(s, "A", "GD03-097-DestroyedEnemyInBattle");
    expect(e?.deckReorder?.slots.map((x) => x.position)).toEqual(["top", "trash"]);
    s = resolve(s, "A", "GD03-097-DestroyedEnemyInBattle", [top2, top1]);
    expect(s.players.A.deck[0].instanceId).toBe(top2);
    expect(s.players.A.trash.some((c) => c.instanceId === top1)).toBe(true);
  });
});

describe("GD03-099 Emma Sheen — 【During Link】【Destroyed】 com Base branca", () => {
  function setup(withWhiteBase: boolean) {
    const s = game();
    if (withWhiteBase) placeCard(s, "A", BASE(), "baseSection");
    const unit = placeCard(s, "A", linkUnit({ code: "TEST-U4", level: 4, hp: 1 }, "Emma Sheen"), "battleArea");
    pair(s, unit, placeCard(s, "A", card("GD03-099"), "battleArea"));
    const low = placeCard(s, "B", UNIT({ code: "TEST-LV4", level: 4 }), "battleArea");
    const high = placeCard(s, "B", UNIT({ code: "TEST-LV5", level: 5 }), "battleArea");
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK", ap: 5 }), "battleArea");
    findCard(s, unit).rested = true;
    s.activePlayer = "B";
    return { s, unit, low, high, attacker };
  }

  it("a Unit pareada é destruída → escolhe Unit inimiga de Lv. ≤ a dela (Q243) e devolve pra mão", () => {
    const setupState = setup(true);
    let s = setupState.s;
    s = runCombat(act(s, "B", { kind: "declareAttack", attackerId: setupState.attacker, target: { unitId: setupState.unit } }));
    const e = entry(s, "A", "GD03-099-Destroyed");
    // o atacante (Lv.3) também morreu na troca de dano; a Lv.5 fica de fora pelo nível
    expect(e?.legalTargets).toEqual([setupState.low]);
    s = resolve(s, "A", "GD03-099-Destroyed", [setupState.low]);
    expect(s.players.B.hand.some((c) => c.instanceId === setupState.low)).toBe(true);
  });

  it("sem Base branca, nada acontece", () => {
    const setupState = setup(false);
    const s = runCombat(act(setupState.s, "B", { kind: "declareAttack", attackerId: setupState.attacker, target: { unitId: setupState.unit } }));
    expect(entry(s, "A", "GD03-099-Destroyed")).toBeUndefined();
    expect(s.players.B.battleArea.some((c) => c.instanceId === setupState.low)).toBe(true);
  });
});

describe("GD04-033 Neo Zeong — (Neo Zeon) concedido vale em condições de board (FAQ Q269/Q335)", () => {
  it("linkada: as Units da Battle Area contam como (Neo Zeon) nas condições; a carta no trash não", () => {
    const s = game();
    const zeong = placeCard(s, "A", { ...card("GD04-033"), link: { kind: "pilotName", values: ["Full Frontal"] } }, "battleArea");
    pair(s, zeong, placeCard(s, "A", PILOT({ nameEn: "Full Frontal" }), "battleArea"));
    const plain = placeCard(s, "A", UNIT({ code: "TEST-PLAIN" }), "battleArea");
    const inTrash = placeCard(s, "A", UNIT({ code: "TEST-TRASH" }), "trash");
    expect(hasTrait(findCard(s, plain), "Neo Zeon", s)).toBe(true);
    expect(hasTrait(findCard(s, inTrash), "Neo Zeon", s)).toBe(false);
    const ctx = { state: s, controller: "A" as const, sourceInstanceId: plain, turnNumber: s.turnNumber, targets: {} };
    expect(defaultPredicateResolver(`controllerOtherUnitWithTrait:Neo Zeon`, { ...ctx, sourceInstanceId: zeong })).toBe(true);
    expect(defaultPredicateResolver(`controllerTrashCardCountWithTraitAtLeast:Neo Zeon:1`, ctx)).toBe(false);
  });
});

describe("GD04-069 ∀ Gundam — o fim do turno pausa pra escolha", () => {
  it("pagou ① por efeito de outra (Militia) → no fim do turno escolhe 1 Unit (Militia) e ativa", () => {
    let s = game();
    const self = placeCard(s, "A", { ...card("GD04-069"), link: { kind: "pilotName", values: ["Loran Cehack"] } }, "battleArea");
    pair(s, self, placeCard(s, "A", PILOT({ nameEn: "Loran Cehack" }), "battleArea"));
    const payer = placeCard(s, "A", UNIT({ code: "TEST-MILITIA", traits: ["Militia"] }), "battleArea", { rested: true });
    const other = placeCard(s, "A", UNIT({ code: "TEST-MILITIA2", traits: ["Militia"] }), "battleArea", { rested: true });
    s = dispatchTrigger(
      s,
      payer,
      "Activate·Main",
      [{ id: "T-pay", cardCode: "TEST-MILITIA", trigger: "Activate·Main", cost: [{ op: "payResourceCost", player: "controller", n: 1 }], actions: [], sourceText: "t" }],
      { allSpecs: ALL_EFFECT_SPECS, ...OPTS },
    );
    s = act(s, "A", { kind: "finishTurn" });
    for (let i = 0; i < 3 && s.endPhaseAction && !pending(s, "A"); i++) s = act(s, s.endPhaseAction.priority, { kind: "passEndPhaseAction" });
    const e = entry(s, "A", "GD04-069-EndOfTurn");
    expect(e?.legalTargets).toEqual(expect.arrayContaining([payer, other]));
    s = resolve(s, "A", "GD04-069-EndOfTurn", [other]);
    while (s.endPhaseAction) s = act(s, s.endPhaseAction.priority, { kind: "passEndPhaseAction" });
    expect(findCard(s, other).rested).toBe(false);
    expect(findCard(s, payer).rested).toBe(true);
  });
});

describe("GD05-049 Sazabi — \"1 of your Units\" inclui o próprio Sazabi", () => {
  it("o próprio Sazabi é alvo legal do 【Attack】", () => {
    let s = game();
    const sazabi = placeCard(s, "A", card("GD05-049"), "battleArea");
    const fodder = placeCard(s, "A", UNIT({ code: "TEST-F" }), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: sazabi, target: "player" });
    expect(entry(s, "A", "GD05-049-Attack")?.legalTargets.sort()).toEqual([sazabi, fodder].sort());
  });
});
