import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { effectiveAp, hasKeyword, keywordValue } from "./types";
import { enumerateLegalActions } from "./legalActions";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { findCard } from "./events";
import { incomingDamage } from "./damageLayer";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { getCardDefByCode } from "../content/allCardDefs";

/** W12 — ST11–ST14 (lançamento do GD05.5): padrões novos do motor e cartas com Q&A oficial. */

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
const inZone = (s: GameState, p: PlayerId, zone: "hand" | "trash" | "exile" | "battleArea" | "deck", id: string) =>
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
function endTurn(state: GameState): GameState {
  let s = act(state, "A", { kind: "finishTurn" });
  for (let i = 0; i < 3 && s.endPhaseAction && !pending(s, "A"); i++) s = act(s, s.endPhaseAction.priority, { kind: "passEndPhaseAction" });
  return s;
}

describe("ST11 — Marine", () => {
  it("ST11-001 pareada com 2+ OUTRAS (Marine): não pode ser alvo de ataque; com 1 pode", () => {
    let s = game();
    const zgok = placeCard(s, "B", card("ST11-001"), "battleArea", { rested: true });
    pair(s, zgok, placeCard(s, "B", PILOT(), "battleArea"));
    placeCard(s, "B", UNIT({ code: "TEST-M1", traits: ["Marine"] }), "battleArea");
    const attacker = placeCard(s, "A", UNIT({ code: "TEST-ATK" }), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: attacker, target: { unitId: zgok } });
    expect(s.combat?.currentTarget).toEqual({ unitId: zgok });

    const s2 = game();
    const zgok2 = placeCard(s2, "B", card("ST11-001"), "battleArea", { rested: true });
    pair(s2, zgok2, placeCard(s2, "B", PILOT(), "battleArea"));
    placeCard(s2, "B", UNIT({ code: "TEST-M1", traits: ["Marine"] }), "battleArea");
    placeCard(s2, "B", UNIT({ code: "TEST-M2", traits: ["Marine"] }), "battleArea");
    const attacker2 = placeCard(s2, "A", UNIT({ code: "TEST-ATK" }), "battleArea");
    expect(() => act(s2, "A", { kind: "declareAttack", attackerId: attacker2, target: { unitId: zgok2 } })).toThrow();
  });

  it("ST11-001 【Deploy】: com outra (Marine), Unit inimiga Lv.2- vai pro FUNDO do deck do dono (com o Piloto)", () => {
    let s = game();
    placeCard(s, "A", UNIT({ code: "TEST-M", traits: ["Marine"] }), "battleArea");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", level: 2 }), "battleArea");
    const enemyPilot = placeCard(s, "B", PILOT(), "battleArea");
    pair(s, enemy, enemyPilot);
    s = deploy(s, "ST11-001");
    s = resolveWith(s, "A", { specId: "ST11-001-Deploy", targetIds: [enemy] });
    const deck = s.players.B.deck.map((c) => c.instanceId);
    expect(deck.slice(-2).sort()).toEqual([enemy, enemyPilot].sort());
  });

  it("ST11-002: no turno do oponente, descansada, (Marine) amigas de HP 2- ficam imunes a dano de efeito inimigo", () => {
    const s = game();
    placeCard(s, "A", card("ST11-002"), "battleArea", { rested: true });
    const small = placeCard(s, "A", UNIT({ code: "TEST-S", hp: 2, traits: ["Marine"] }), "battleArea");
    const big = placeCard(s, "A", UNIT({ code: "TEST-B", hp: 3, traits: ["Marine"] }), "battleArea");
    const src = placeCard(s, "B", UNIT({ code: "TEST-SRC" }), "battleArea");
    const effect = { kind: "effect" as const, controller: "B" as const, sourceId: src };
    s.activePlayer = "B";
    expect(incomingDamage(s, findCard(s, small), 2, effect).amount).toBe(0);
    expect(incomingDamage(s, findCard(s, big), 2, effect).amount).toBe(2);
    expect(incomingDamage(s, findCard(s, small), 2, { ...effect, kind: "battle" }).amount).toBe(2);
    s.activePlayer = "A";
    expect(incomingDamage(s, findCard(s, small), 2, effect).amount).toBe(2);
  });

  it("ST11-003: com outra (Marine) ganha <Blocker>", () => {
    const s = game();
    const zock = placeCard(s, "A", card("ST11-003"), "battleArea");
    expect(hasKeyword(findCard(s, zock), "Blocker", s)).toBe(false);
    placeCard(s, "A", UNIT({ code: "TEST-M", traits: ["Marine"] }), "battleArea");
    expect(hasKeyword(findCard(s, zock), "Blocker", s)).toBe(true);
  });

  it("ST11-004 【Deploy】: token GOOhN descansado", () => {
    let s = game();
    s = deploy(s, "ST11-004");
    const token = s.players.A.battleArea.find((c) => c.def.code === "T-028");
    expect(token?.rested).toBe(true);
    expect(token?.def.traits).toEqual(["ZAFT", "Marine"]);
  });

  it("ST11-006: com outra (Marine) no início do turno do oponente, <Breach> inimigo nos escudos é reduzido em 5 (Q431)", () => {
    let s = game();
    placeCard(s, "A", card("ST11-006"), "battleArea");
    placeCard(s, "A", UNIT({ code: "TEST-M", traits: ["Marine"] }), "battleArea");
    s = endTurn(s); // início do turno de B: a proteção arma
    expect(s.players.A.shieldAreaEffectReduction?.amount).toBe(5);
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-BR", ap: 1, effectKeywords: ["Breach"], keywordTags: ["Breach 3"] }), "battleArea");
    const victim = placeCard(s, "A", UNIT({ code: "TEST-V", hp: 1 }), "battleArea", { rested: true });
    const shields = s.players.A.shields.length;
    s = runCombat(act(s, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: victim } }));
    expect(inZone(s, "A", "trash", victim)).toBe(true);
    expect(s.players.A.shields.length).toBe(shields);
  });

  it("ST11-006: sem outra (Marine) no início do turno do oponente, nada", () => {
    let s = game();
    placeCard(s, "A", card("ST11-006"), "battleArea");
    s = endTurn(s);
    expect(s.players.A.shieldAreaEffectReduction).toBeUndefined();
  });

  it("ST11-009 【Destroyed】: no turno do oponente compra 1 mesmo sem outra (Marine) (Q432)", () => {
    let s = game();
    s.activePlayer = "B";
    const kapool = placeCard(s, "A", card("ST11-009"), "battleArea", { rested: true });
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK", ap: 5 }), "battleArea");
    const hand = s.players.A.hand.length;
    s = runCombat(act(s, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: kapool } }));
    expect(inZone(s, "A", "trash", kapool)).toBe(true);
    expect(s.players.A.hand.length).toBe(hand + 1);
  });

  it("ST11-013 【Main】: devolve Unit inimiga descansada de HP 3- e compra 1", () => {
    let s = game();
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", hp: 3 }), "battleArea", { rested: true });
    const hand = s.players.A.hand.length;
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("ST11-013"), "hand"), trigger: "Main", targets: { target: [enemy] } });
    expect(inZone(s, "B", "hand", enemy)).toBe(true);
    expect(s.players.A.hand.length).toBe(hand + 1);
  });

  it("ST11-014 【Action】: a (Marine) escolhida não pode ser alvo de ataque neste turno", () => {
    let s = game();
    s.activePlayer = "B";
    const marine = placeCard(s, "A", UNIT({ code: "TEST-M", traits: ["Marine"] }), "battleArea", { rested: true });
    const other = placeCard(s, "A", UNIT({ code: "TEST-O", hp: 9 }), "battleArea", { rested: true });
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK" }), "battleArea");
    const attacker2 = placeCard(s, "B", UNIT({ code: "TEST-ATK2" }), "battleArea");
    s = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: other } });
    s = act(s, "A", { kind: "skipBlock" });
    if (s.combat?.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("ST11-014"), "hand"), trigger: "Action", targets: { target: [marine] } });
    s = runCombat(s);
    expect(() => act(s, "B", { kind: "declareAttack", attackerId: attacker2, target: { unitId: marine } })).toThrow();
  });

  it("ST11-015 【Main】: (Marine) Lv.4- do trash entra descansada, sem pagar o custo (Q434)", () => {
    let s = game();
    const target = placeCard(s, "A", UNIT({ code: "TEST-M", level: 4, cost: 4, traits: ["Marine"] }), "trash");
    for (const r of s.players.A.resourceArea) r.rested = false;
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("ST11-015"), "hand"), trigger: "Main" });
    s = resolveWith(s, "A", { specId: "ST11-015-Main", targetIds: [target] });
    expect(inZone(s, "A", "battleArea", target)).toBe(true);
    expect(findCard(s, target).rested).toBe(true);
    expect(s.players.A.resourceArea.filter((r) => r.rested)).toHaveLength(card("ST11-015").cost ?? 0);
  });
});

describe("ST12", () => {
  it("ST12-001 Epyon pareada com Piloto Lv.5+: destruiu em batalha no seu turno → 2 de dano em toda inimiga de AP 5-", () => {
    let s = game();
    const epyon = placeCard(s, "A", card("ST12-001"), "battleArea");
    pair(s, epyon, placeCard(s, "A", PILOT({ level: 5 }), "battleArea"));
    const victim = placeCard(s, "B", UNIT({ code: "TEST-V", hp: 1 }), "battleArea", { rested: true });
    const small = placeCard(s, "B", UNIT({ code: "TEST-S", ap: 5, hp: 5 }), "battleArea");
    const big = placeCard(s, "B", UNIT({ code: "TEST-B", ap: 6, hp: 5 }), "battleArea");
    s = runCombat(act(s, "A", { kind: "declareAttack", attackerId: epyon, target: { unitId: victim } }));
    expect(inZone(s, "B", "trash", victim)).toBe(true);
    expect(findCard(s, small).damage).toBe(2);
    expect(findCard(s, big).damage).toBe(0);
  });

  it("ST12-001: Piloto Lv.4 → não dispara", () => {
    let s = game();
    const epyon = placeCard(s, "A", card("ST12-001"), "battleArea");
    pair(s, epyon, placeCard(s, "A", PILOT({ level: 4 }), "battleArea"));
    const victim = placeCard(s, "B", UNIT({ code: "TEST-V", hp: 1 }), "battleArea", { rested: true });
    const small = placeCard(s, "B", UNIT({ code: "TEST-S", ap: 5, hp: 5 }), "battleArea");
    s = runCombat(act(s, "A", { kind: "declareAttack", attackerId: epyon, target: { unitId: victim } }));
    expect(findCard(s, small).damage).toBe(0);
  });

  it("ST12-001 【Deploy】: 5 de dano na Base inimiga", () => {
    let s = game();
    const base = placeCard(s, "B", { ...UNIT({ code: "TEST-BASE", hp: 9 }), cardType: "BASE" }, "baseSection");
    s = deploy(s, "ST12-001");
    expect(findCard(s, base).damage).toBe(5);
  });

  it("ST12-003 + ST12-011: o dano de EFEITO do Piloto pareado destrói → Tallgeese Ⅲ dá 1 em toda inimiga de AP 3- (Q439)", () => {
    let s = game();
    s.activePlayer = "A";
    const tallgeese = placeCard(s, "A", card("ST12-003"), "battleArea");
    const milliardo = placeCard(s, "A", card("ST12-011"), "battleArea");
    pair(s, tallgeese, milliardo);
    const victim = placeCard(s, "B", UNIT({ code: "TEST-V", hp: 9, ap: 1 }), "battleArea", { rested: true, damage: 7 });
    const small = placeCard(s, "B", UNIT({ code: "TEST-S", ap: 3, hp: 5 }), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: tallgeese, target: { unitId: victim } });
    s = act(s, "B", { kind: "skipBlock" });
    if (s.combat?.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: milliardo, targets: { target: [victim] } });
    expect(inZone(s, "B", "trash", victim)).toBe(true);
    expect(findCard(s, small).damage).toBe(1);
  });

  it("ST12-006 【Activate･Main】 pareada: exila 4 do trash e ganha <First Strike>", () => {
    let s = game();
    const banshee = placeCard(s, "A", card("ST12-006"), "battleArea");
    pair(s, banshee, placeCard(s, "A", PILOT(), "battleArea"));
    for (let i = 0; i < 4; i++) placeCard(s, "A", UNIT({ code: `TEST-T${i}` }), "trash");
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: banshee });
    expect(s.players.A.exile).toHaveLength(4);
    expect(hasKeyword(findCard(s, banshee), "First Strike", s)).toBe(true);
  });

  it("ST12-009 【Destroyed】: com um jogador de 3 ou menos escudos, Unit Lv.6+ do trash pra mão e descarta 1", () => {
    let s = game();
    s.activePlayer = "B";
    const banshee = placeCard(s, "A", card("ST12-009"), "battleArea", { rested: true });
    const big = placeCard(s, "A", UNIT({ code: "TEST-BIG", level: 6 }), "trash");
    const junk = placeCard(s, "A", UNIT({ code: "TEST-J" }), "hand");
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK", ap: 9 }), "battleArea");
    s = runCombat(act(s, "B", { kind: "declareAttack", attackerId: attacker, target: { unitId: banshee } }));
    s = resolveWith(s, "A", { specId: "ST12-009-Destroyed", targetIds: [big] });
    expect(inZone(s, "A", "hand", big)).toBe(true);
    s = resolveWith(s, "A", { specId: "ST12-009-Then", targetIds: [junk] });
    expect(inZone(s, "A", "trash", junk)).toBe(true);
  });

  it("ST12-012 【When Linked】: com um jogador de 3 ou menos escudos, a escolhida vai pra mão; a outra pro trash", () => {
    let s = game();
    const pilotDef = card("ST12-012");
    const unit = placeCard(s, "A", UNIT({ code: "TEST-L", link: { kind: "pilotName", values: ["Marida Cruz"] } }), "battleArea");
    const t2 = onTop(s, "A", UNIT({ code: "TEST-T2" }));
    const t1 = onTop(s, "A", UNIT({ code: "TEST-T1" }));
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", pilotDef, "hand"), pairWithUnitId: unit });
    s = resolveWith(s, "A", { specId: "ST12-012-WhenLinked", targetIds: [t2, t1] });
    expect(inZone(s, "A", "hand", t2)).toBe(true);
    expect(inZone(s, "A", "trash", t1)).toBe(true);
  });

  it("ST12-013 【Main】: cada jogador escolhe 1 Unit própria e elas batalham só no Damage Step (Q446)", () => {
    let s = game();
    const mine = placeCard(s, "A", UNIT({ code: "TEST-M", ap: 4, hp: 5 }), "battleArea");
    const theirs = placeCard(s, "B", UNIT({ code: "TEST-T", ap: 2, hp: 3 }), "battleArea");
    placeCard(s, "B", UNIT({ code: "TEST-T2" }), "battleArea");
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("ST12-013"), "hand"), trigger: "Main", targets: { target: [mine] } });
    s = resolveWith(s, "B", { specId: "ST12-013-Then", targetIds: [theirs] });
    s = runCombat(s);
    expect(inZone(s, "B", "trash", theirs)).toBe(true);
    expect(findCard(s, mine).damage).toBe(2);
    expect(s.combat).toBeFalsy();
  });

  it("ST12-014 【Action】: nesta batalha, destruiu em batalha → destrói 1 inimiga de AP 2-; depois da batalha não vale mais", () => {
    let s = game();
    const mine = placeCard(s, "A", UNIT({ code: "TEST-M", ap: 5, hp: 5 }), "battleArea");
    const victim = placeCard(s, "B", UNIT({ code: "TEST-V", hp: 2 }), "battleArea", { rested: true });
    const weak = placeCard(s, "B", UNIT({ code: "TEST-W", ap: 2, hp: 5 }), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: mine, target: { unitId: victim } });
    s = act(s, "B", { kind: "skipBlock" });
    if (s.combat?.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("ST12-014"), "hand"), trigger: "Action", targets: { target: [mine] } });
    s = runCombat(s);
    s = resolveWith(s, "A", { specId: "ST12-014-Delayed", targetIds: [weak] });
    expect(inZone(s, "B", "trash", weak)).toBe(true);
    expect(s.players.A.delayedReactions).toBeUndefined();
  });

  it("ST12-015: o modo 2 só aparece se houver Unit amiga E inimiga Lv.5+ (Q451)", () => {
    let s = game();
    const friend = placeCard(s, "A", UNIT({ code: "TEST-F", hp: 5 }), "battleArea");
    placeCard(s, "B", UNIT({ code: "TEST-L1", level: 1 }), "battleArea");
    s.activePlayer = "B";
    const attacker = placeCard(s, "B", UNIT({ code: "TEST-ATK" }), "battleArea");
    s = act(s, "B", { kind: "declareAttack", attackerId: attacker, target: "player" });
    s = act(s, "A", { kind: "skipBlock" });
    if (s.combat?.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("ST12-015"), "hand"), trigger: "Action" });
    const options = entry(s, "A", "ST12-015-Action")?.enumChoice?.options.map((o) => o.value);
    expect(options).toEqual(["1"]);
    expect(findCard(s, friend).damage).toBe(0);
  });

  it("ST12-016 com a condição falsa: a ativação paga o custo (descansa a Base) e não repete (o bot ficava em laço)", () => {
    let s = game();
    const libra = placeCard(s, "A", card("ST12-016"), "baseSection");
    const target = placeCard(s, "B", UNIT({ code: "TEST-T", level: 4, hp: 3 }), "battleArea");
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: libra, targets: { target: [target] } });
    expect(findCard(s, libra).rested).toBe(true);
    expect(findCard(s, target).damage).toBe(0);
    const offered = enumerateLegalActions(s, "A", ALL_EFFECT_SPECS, { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver });
    expect(offered.some((a) => a.kind === "activateAbility" && a.sourceInstanceId === libra)).toBe(false);
  });

  it("ST12-016 【Activate･Main】: só depois de uma Unit PAREADA destruir inimiga em batalha neste turno (Q453)", () => {
    let s = game();
    const libra = placeCard(s, "A", card("ST12-016"), "baseSection");
    const unit = placeCard(s, "A", UNIT({ code: "TEST-U", ap: 5 }), "battleArea");
    const victim = placeCard(s, "B", UNIT({ code: "TEST-V", hp: 1 }), "battleArea", { rested: true });
    const target = placeCard(s, "B", UNIT({ code: "TEST-T", level: 4, hp: 3 }), "battleArea");
    s = runCombat(act(s, "A", { kind: "declareAttack", attackerId: unit, target: { unitId: victim } }));
    pair(s, unit, placeCard(s, "A", PILOT(), "battleArea")); // pareada DEPOIS: não conta
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: libra, targets: { target: [target] } });
    expect(findCard(s, target).damage).toBe(0);

    let s2 = game();
    const libra2 = placeCard(s2, "A", card("ST12-016"), "baseSection");
    const unit2 = placeCard(s2, "A", UNIT({ code: "TEST-U", ap: 5 }), "battleArea");
    pair(s2, unit2, placeCard(s2, "A", PILOT(), "battleArea"));
    const victim2 = placeCard(s2, "B", UNIT({ code: "TEST-V", hp: 1 }), "battleArea", { rested: true });
    const target2 = placeCard(s2, "B", UNIT({ code: "TEST-T", level: 4, hp: 3 }), "battleArea");
    s2 = runCombat(act(s2, "A", { kind: "declareAttack", attackerId: unit2, target: { unitId: victim2 } }));
    s2 = act(s2, "A", { kind: "activateAbility", sourceInstanceId: libra2, targets: { target: [target2] } });
    expect(findCard(s2, target2).damage).toBe(1);
  });
});

describe("ST13", () => {
  it("T-029 Bit / Funnel não ataca nem pareia", () => {
    let s = game();
    s = deploy(s, "ST13-002");
    const bit = s.players.A.battleArea.find((c) => c.def.code === "T-029")!;
    expect(() => act(s, "A", { kind: "declareAttack", attackerId: bit.instanceId, target: "player" })).toThrow();
    expect(bit.def.cannotBePaired).toBe(true);
  });

  it("ST13-001 Qubeley: ao parear no seu turno escolhe 1 ou 2 Bits; 【Activate･Main】① token batalha só no Damage Step", () => {
    let s = game();
    placeCard(s, "A", card("ST13-001"), "battleArea");
    const unit = placeCard(s, "A", UNIT({ code: "TEST-U" }), "battleArea");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", PILOT(), "hand"), pairWithUnitId: unit });
    s = resolveWith(s, "A", { specId: "ST13-001-ReactionpilotPaired", targetIds: ["2"] });
    const bits = s.players.A.battleArea.filter((c) => c.def.code === "T-029");
    expect(bits).toHaveLength(2);
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", ap: 1, hp: 2 }), "battleArea");
    const qubeley = s.players.A.battleArea.find((c) => c.def.code === "ST13-001")!;
    s = act(s, "A", {
      kind: "activateAbility",
      sourceInstanceId: qubeley.instanceId,
      targets: { target: [bits[0].instanceId], enemyTarget: [enemy] },
    });
    s = runCombat(s);
    expect(inZone(s, "B", "trash", enemy)).toBe(true);
    expect(findCard(s, bits[0].instanceId).damage).toBe(1);
  });

  it("ST13-009 【Attack】: o OPONENTE escolhe 2 Units do trash dele pra exilar", () => {
    let s = game();
    const pharact = placeCard(s, "A", card("ST13-009"), "battleArea");
    const t = [0, 1, 2].map((i) => placeCard(s, "B", UNIT({ code: `TEST-T${i}` }), "trash"));
    placeCard(s, "B", { ...UNIT({ code: "TEST-CMD" }), cardType: "COMMAND" }, "trash");
    s = act(s, "A", { kind: "declareAttack", attackerId: pharact, target: "player" });
    expect(entry(s, "B", "ST13-009-Then")?.trashExile?.legalTrashIds.sort()).toEqual([...t].sort());
    s = resolveWith(s, "B", { specId: "ST13-009-Then", trashExileIds: [t[2], t[0]] });
    expect(s.players.B.exile.map((c) => c.instanceId).sort()).toEqual([t[0], t[2]].sort());
    expect(s.combat?.step).not.toBe("attack");
  });

  it("ST13-010 【Activate･Main】: destrói 1 token amigo e ganha <Breach 3>; sem token não ativa", () => {
    let s = game();
    const red = placeCard(s, "A", card("ST13-010"), "battleArea");
    expect(() => act(s, "A", { kind: "activateAbility", sourceInstanceId: red })).toThrow();
    const token = placeCard(s, "A", { ...UNIT({ code: "TEST-TK" }), isToken: true }, "battleArea");
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: red, targets: { costUnit: [token] } });
    expect(s.players.A.battleArea.some((c) => c.instanceId === token)).toBe(false);
    expect(keywordValue(findCard(s, red), "Breach", s)).toBe(3);
  });

  it("ST13-011 【When Paired】: só Piloto de Lv. até o da Unit pareada pode ser revelado", () => {
    let s = game();
    const unit = placeCard(s, "A", UNIT({ code: "TEST-U", level: 4 }), "battleArea");
    const low = onTop(s, "A", PILOT({ code: "TEST-P4", level: 4 }));
    const high = onTop(s, "A", PILOT({ code: "TEST-P5", level: 5 }));
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", card("ST13-011"), "hand"), pairWithUnitId: unit });
    const e = entry(s, "A", "ST13-011-WhenPaired");
    expect(e?.deckTopReveal?.revealableIds).toContain(low);
    expect(e?.deckTopReveal?.revealableIds).not.toContain(high);
  });

  it("ST13-012: Unit inimiga destruída por DANO de efeito enquanto a pareada ataca → compra 1", () => {
    let s = game();
    const unit = placeCard(s, "A", UNIT({ code: "TEST-U", hp: 9 }), "battleArea");
    pair(s, unit, placeCard(s, "A", card("ST13-012"), "battleArea"));
    const victim = placeCard(s, "B", UNIT({ code: "TEST-V", hp: 1 }), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
    s = act(s, "B", { kind: "skipBlock" });
    if (s.combat?.actionPriority === "B") s = act(s, "B", { kind: "passAction" });
    const hand = s.players.A.hand.length;
    // 【Action】 de dano qualquer (ST12-013 Burst não serve: usa um Command de dano do catálogo)
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("GD01-115"), "hand"), trigger: "Action", targets: { target: [victim] } });
    expect(inZone(s, "B", "trash", victim)).toBe(true);
    expect(s.players.A.hand.length).toBe(hand + 1);
  });

  it("ST13-014 【Main】: destrói 1 Unit sua e pode deployar 1 Unit Lv.4- das 4 do topo (sem custo, Q460)", () => {
    let s = game();
    const mine = placeCard(s, "A", UNIT({ code: "TEST-M" }), "battleArea");
    const lv4 = onTop(s, "A", UNIT({ code: "TEST-L4", level: 4, cost: 4 }));
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("ST13-014"), "hand"), trigger: "Main", targets: { target: [mine] } });
    expect(inZone(s, "A", "trash", mine)).toBe(true);
    s = resolveWith(s, "A", { specId: "ST13-014-Then", targetIds: [lv4] });
    expect(inZone(s, "A", "battleArea", lv4)).toBe(true);
  });
});

describe("ST14", () => {
  it("ST14-001 The-O: no start phase do oponente, as descansadas de MENOR Lv. dele não destombam (empate: todas, Q462)", () => {
    let s = game();
    placeCard(s, "A", card("ST14-001"), "battleArea");
    const a3 = placeCard(s, "B", UNIT({ code: "TEST-A3", level: 3 }), "battleArea", { rested: true });
    const b3 = placeCard(s, "B", UNIT({ code: "TEST-B3", level: 3 }), "battleArea", { rested: true });
    const c5 = placeCard(s, "B", UNIT({ code: "TEST-C5", level: 5 }), "battleArea", { rested: true });
    s = endTurn(s);
    expect(findCard(s, a3).rested).toBe(true);
    expect(findCard(s, b3).rested).toBe(true);
    expect(findCard(s, c5).rested).toBe(false);
  });

  it("ST14-003 【Deploy】: o oponente exila 2 Units do trash dele (com só 2, sem escolha)", () => {
    let s = game();
    const t = [0, 1].map((i) => placeCard(s, "B", UNIT({ code: `TEST-T${i}` }), "trash"));
    s = deploy(s, "ST14-003");
    if (pending(s, "B")) s = resolveWith(s, "B", { specId: "ST14-003-Then" });
    expect(s.players.B.exile.map((c) => c.instanceId).sort()).toEqual([...t].sort());
  });

  it("ST14-005 【Deploy】: descansa; com 7+ no trash também AP-2 (mesmo já descansada, Q466)", () => {
    let s = game();
    for (let i = 0; i < 7; i++) placeCard(s, "A", UNIT({ code: `TEST-T${i}` }), "trash");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", level: 6, ap: 4 }), "battleArea", { rested: true });
    s = deploy(s, "ST14-005");
    s = resolveWith(s, "A", { specId: "ST14-005-Deploy", targetIds: [enemy] });
    expect(findCard(s, enemy).rested).toBe(true);
    expect(effectiveAp(findCard(s, enemy), s)).toBe(2);
  });

  it("ST14-006 pareada: 1×/turno imune ao dano de batalha de Unit inimiga com AP até o dela", () => {
    const s = game();
    const unicorn = placeCard(s, "A", card("ST14-006"), "battleArea");
    pair(s, unicorn, placeCard(s, "A", PILOT(), "battleArea"));
    const ap = effectiveAp(findCard(s, unicorn), s);
    const weak = placeCard(s, "B", UNIT({ code: "TEST-W", ap }), "battleArea");
    const strong = placeCard(s, "B", UNIT({ code: "TEST-S", ap: ap + 1 }), "battleArea");
    const battle = (src: string) => ({ kind: "battle" as const, controller: "B" as const, sourceId: src });
    expect(incomingDamage(s, findCard(s, unicorn), ap, battle(strong)).amount).toBe(ap);
    expect(incomingDamage(s, findCard(s, unicorn), ap, battle(weak)).amount).toBe(0);
  });

  it("ST14-011 【Attack】: AP da inimiga escolhida cai pelo nº de Units inimigas descansadas", () => {
    let s = game();
    const unit = placeCard(s, "A", UNIT({ code: "TEST-U" }), "battleArea");
    pair(s, unit, placeCard(s, "A", card("ST14-011"), "battleArea"));
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", ap: 5 }), "battleArea", { rested: true });
    placeCard(s, "B", UNIT({ code: "TEST-R" }), "battleArea", { rested: true });
    s = act(s, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
    s = resolveWith(s, "A", { specId: "ST14-011-Attack", targetIds: [enemy] });
    expect(effectiveAp(findCard(s, enemy), s)).toBe(3);
  });

  it("ST14-014: com 4+ Commands no trash pode mirar Unit inimiga de qualquer Lv.", () => {
    let s = game();
    const big = placeCard(s, "B", UNIT({ code: "TEST-BIG", level: 7, ap: 6 }), "battleArea");
    // sem 4 Commands no trash a Lv.7 não é alvo legal: a jogada não tira AP dela
    const tried = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("ST14-014"), "hand"), trigger: "Main", targets: { target: [big] } });
    expect(effectiveAp(findCard(tried, big), tried)).toBe(6);
    for (let i = 0; i < 4; i++) placeCard(s, "A", { ...UNIT({ code: `TEST-C${i}` }), cardType: "COMMAND" }, "trash");
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("ST14-014"), "hand"), trigger: "Main", targets: { target: [big] } });
    expect(effectiveAp(findCard(s, big), s)).toBe(3);
  });

  it("ST14-015 【Main】: coloca 1 Resource descansado e ativa 1, se nenhum foi ativado por efeito no turno", () => {
    let s = game();
    // 2 Resources a mais, descansados (os 8 do jogo pagam o custo)
    for (let i = 0; i < 2; i++) placeCard(s, "A", RESOURCE, "resourceArea", { rested: true });
    const before = s.players.A.resourceArea.length;
    const restedBefore = s.players.A.resourceArea.filter((r) => r.rested).length;
    s = act(s, "A", { kind: "playCommand", cardInstanceId: placeCard(s, "A", card("ST14-015"), "hand"), trigger: "Main" });
    expect(s.players.A.resourceArea.length).toBe(before + 1);
    // + 1 descansado colocado, + o custo pago, − 1 ativado pelo efeito
    expect(s.players.A.resourceArea.filter((r) => r.rested).length).toBe(restedBefore + 1 + (card("ST14-015").cost ?? 0) - 1);
    expect(s.players.A.resourceSetActiveByEffectOnTurn).toBe(s.turnNumber);
  });

  it("ST14-016 Gryphios 2: no seu turno, quando uma Unit amiga forma Link, AP-1 numa inimiga Lv.5-", () => {
    let s = game();
    placeCard(s, "A", card("ST14-016"), "baseSection");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", level: 5, ap: 4 }), "battleArea");
    const unit = placeCard(s, "A", UNIT({ code: "TEST-L", link: { kind: "pilotName", values: ["Link Pilot"] } }), "battleArea");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", PILOT({ nameEn: "Link Pilot" }), "hand"), pairWithUnitId: unit });
    s = resolveWith(s, "A", { specId: "ST14-016-UnitLinked", targetIds: [enemy] });
    expect(effectiveAp(findCard(s, enemy), s)).toBe(3);
  });
});
