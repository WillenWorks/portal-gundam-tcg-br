import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { effectiveAp, hasKeyword } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { enumerateLegalActions } from "./legalActions";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { getCardDefByCode } from "../content/allCardDefs";

/** W9 — escolha no "exilar N do trash" (CR 10-2-2-1 / Q194) e o ST10 (FAQ Q302–Q309). */

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
const GGEN = (i: number, extra: Partial<CardDef> = {}) => UNIT({ code: `TEST-GG${i}`, nameEn: `G Gen ${i}`, traits: ["G Generation"], ...extra });
const OPTS = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };

function game(resources = 8): GameState {
  const state = advanceToMainPhase(createGame(buildSt07DeckList(), buildSt08DeckList(), { seed: 90, firstPlayer: "A" }));
  for (const p of ["A", "B"] as const) {
    state.players[p].battleArea = [];
    state.players[p].baseSection = [];
    state.players[p].trash = [];
    state.players[p].shields = [];
    state.players[p].hand = [];
    for (let i = 0; i < 3; i++) placeCard(state, p, SHIELD, "shields");
    state.players[p].resourceArea = [];
    for (let i = 0; i < resources; i++) placeCard(state, p, RESOURCE, "resourceArea");
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
const inZone = (s: GameState, p: PlayerId, zone: "hand" | "trash" | "exile" | "battleArea", id: string) => s.players[p][zone].some((c) => c.instanceId === id);

describe("W9 — o jogador escolhe quais cartas exilar do trash", () => {
  it("custo de 【Activate･Main】 (GD03-015): com mais elegíveis que o necessário, vira decisão e exila as escolhidas", () => {
    let s = game();
    const unit = placeCard(s, "A", card("GD03-015"), "battleArea");
    const titans = [0, 1, 2, 3, 4].map((i) => placeCard(s, "A", UNIT({ code: `TEST-T${i}`, traits: ["Titans"] }), "trash"));
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: unit });
    const e = entry(s, "A", "GD03-015-ActivateMain");
    expect(e?.trashExile).toMatchObject({ count: 3 });
    expect(e?.trashExile?.legalTrashIds.sort()).toEqual([...titans].sort());
    const chosen = [titans[4], titans[2], titans[0]];
    s = resolveWith(s, "A", { specId: "GD03-015-ActivateMain", trashExileIds: chosen });
    for (const id of chosen) expect(inZone(s, "A", "exile", id)).toBe(true);
    expect(inZone(s, "A", "trash", titans[1])).toBe(true);
    expect(hasKeyword(findCard(s, unit), "Breach", s)).toBe(true);
  });

  it("escolha com número errado ou carta fora do filtro é recusada", () => {
    let s = game();
    const unit = placeCard(s, "A", card("GD03-015"), "battleArea");
    const titans = [0, 1, 2, 3].map((i) => placeCard(s, "A", UNIT({ code: `TEST-T${i}`, traits: ["Titans"] }), "trash"));
    const other = placeCard(s, "A", UNIT({ code: "TEST-X" }), "trash");
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: unit });
    expect(() => resolveWith(s, "A", { specId: "GD03-015-ActivateMain", trashExileIds: titans.slice(0, 2) })).toThrow(/Exílio inválido/);
    expect(() => resolveWith(s, "A", { specId: "GD03-015-ActivateMain", trashExileIds: [titans[0], titans[1], other] })).toThrow(/Exílio inválido/);
  });

  it("com exatamente N elegíveis não há o que escolher: resolve direto", () => {
    let s = game();
    const unit = placeCard(s, "A", card("GD03-015"), "battleArea");
    [0, 1, 2].map((i) => placeCard(s, "A", UNIT({ code: `TEST-T${i}`, traits: ["Titans"] }), "trash"));
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: unit });
    expect(pending(s, "A")).toBeNull();
    expect(s.players.A.exile).toHaveLength(3);
  });
});

describe("ST10 — Development N", () => {
  it("ST10-002 【Deploy･Development 2】: exila as 2 escolhidas e o ■ descansa Unit inimiga com HP ≤ 4", () => {
    let s = game();
    const gg = [0, 1, 2].map((i) => placeCard(s, "A", GGEN(i), "trash"));
    const weak = placeCard(s, "B", UNIT({ code: "TEST-W", hp: 4 }), "battleArea");
    const strong = placeCard(s, "B", UNIT({ code: "TEST-S", hp: 5 }), "battleArea");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", card("ST10-002"), "hand") });
    expect(entry(s, "A", "ST10-002-Deploy")?.trashExile?.count).toBe(2);
    s = resolveWith(s, "A", { specId: "ST10-002-Deploy", trashExileIds: [gg[2], gg[0]] });
    expect(inZone(s, "A", "trash", gg[1])).toBe(true);
    expect(entry(s, "A", "ST10-002-Then")?.legalTargets).toEqual([weak]);
    s = resolveWith(s, "A", { specId: "ST10-002-Then", targetIds: [weak] });
    expect(findCard(s, weak).rested).toBe(true);
    expect(findCard(s, strong).rested).toBe(false);
  });

  it("recusar o Development não exila nada; sem 2 (G Generation) no trash, nem pergunta", () => {
    let s = game();
    [0, 1].map((i) => placeCard(s, "A", GGEN(i), "trash"));
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", card("ST10-002"), "hand") });
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "ST10-002-Deploy", activate: false, targetIds: [] }] });
    expect(s.players.A.exile).toHaveLength(0);

    let t = game();
    placeCard(t, "A", GGEN(0), "trash");
    t = act(t, "A", { kind: "deployCard", cardInstanceId: placeCard(t, "A", card("ST10-002"), "hand") });
    expect(entry(t, "A", "ST10-002-Deploy")).toBeUndefined();
  });

  it("ST10-008: o ■ compra 1 e descarta 1 (1 jogador inimigo)", () => {
    let s = game();
    [0, 1].map((i) => placeCard(s, "A", GGEN(i), "trash"));
    const keep = placeCard(s, "A", UNIT({ code: "TEST-KEEP" }), "hand");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", card("ST10-008"), "hand") });
    s = resolveWith(s, "A", { specId: "ST10-008-Deploy" });
    const handBefore = s.players.A.hand.length;
    const then = entry(s, "A", "ST10-008-Then");
    expect(then?.handDiscard?.n).toBe(1);
    s = resolveWith(s, "A", { specId: "ST10-008-Then", targetIds: [keep] });
    expect(s.players.A.hand).toHaveLength(handBefore);
    expect(inZone(s, "A", "trash", keep)).toBe(true);
  });
});

describe("ST10 — demais cartas", () => {
  it("ST10-001: destrói carta da área de escudo em batalha → fica ativa e não ataca o jogador de novo no turno", () => {
    let s = game();
    const zeta = placeCard(s, "A", card("ST10-001"), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: zeta, target: "player" });
    for (let i = 0; i < 6 && s.combat; i++) {
      if (s.combat.step === "block") s = act(s, "B", { kind: "skipBlock" });
      else if (s.combat.step === "action") s = act(s, s.combat.actionPriority, { kind: "passAction" });
      else break;
    }
    expect(findCard(s, zeta).rested).toBe(false);
    expect(() => act(s, "A", { kind: "declareAttack", attackerId: zeta, target: "player" })).toThrow();
  });

  it("ST10-011 【When Linked】: com 2+ Units descansadas (de qualquer lado, Q307) descansa inimiga de Lv. ≤ a Unit (Q308)", () => {
    let s = game();
    const unit = placeCard(s, "A", UNIT({ code: "TEST-K", level: 4, link: { kind: "pilotName", values: ["Kamille Bidan"] } }), "battleArea");
    placeCard(s, "A", UNIT({ code: "TEST-R1" }), "battleArea", { rested: true });
    const restedEnemy = placeCard(s, "B", UNIT({ code: "TEST-R2" }), "battleArea", { rested: true });
    const low = placeCard(s, "B", UNIT({ code: "TEST-LV4", level: 4 }), "battleArea");
    placeCard(s, "B", UNIT({ code: "TEST-LV5", level: 5 }), "battleArea");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", card("ST10-011"), "hand"), pairWithUnitId: unit });
    expect(entry(s, "A", "ST10-011-WhenLinked")?.legalTargets.sort()).toEqual([restedEnemy, low].sort());
    s = resolveWith(s, "A", { specId: "ST10-011-WhenLinked", targetIds: [low] });
    expect(findCard(s, low).rested).toBe(true);
  });

  it("ST10-013: qualquer Unit (G Generation) Lv.5+ (Q309) recupera 2 HP e ganha AP+2", () => {
    let s = game();
    const enemyGG = placeCard(s, "B", GGEN(9, { level: 5, hp: 5 }), "battleArea");
    findCard(s, enemyGG).damage = 3;
    const cmd = placeCard(s, "A", card("ST10-013"), "hand");
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main", targets: { target: [enemyGG] } });
    expect(findCard(s, enemyGG).damage).toBe(1);
    expect(effectiveAp(findCard(s, enemyGG), s)).toBe(5);
  });

  it("ST10-014: descartando 1 Unit (G Generation), joga como Lv.2/custo 2; o bot também enxerga a opção", () => {
    let s = game(2);
    const gg = placeCard(s, "A", GGEN(0), "hand");
    const cmd = placeCard(s, "A", card("ST10-014"), "hand");
    const offers = enumerateLegalActions(s, "A", ALL_EFFECT_SPECS, OPTS).filter((a) => a.kind === "playCommand" && a.cardInstanceId === cmd);
    expect(offers).toEqual([expect.objectContaining({ altCostDiscardId: gg })]);
    const handBefore = s.players.A.hand.length;
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main", altCostDiscardId: gg });
    expect(inZone(s, "A", "trash", gg)).toBe(true);
    expect(s.players.A.hand).toHaveLength(handBefore - 2 + 2);
    expect(s.players.A.resourceArea.filter((r) => r.rested)).toHaveLength(2);
  });

  it("ST10-014: sem o descarte, precisa do Lv./custo 4; carta errada é recusada", () => {
    const s = game(2);
    const notGG = placeCard(s, "A", UNIT({ code: "TEST-NG" }), "hand");
    const cmd = placeCard(s, "A", card("ST10-014"), "hand");
    expect(() => act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main" })).toThrow(/Nível insuficiente/);
    expect(() => act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main", altCostDiscardId: notGG })).toThrow(/G Generation/);
  });

  it("ST10-016 【Deploy】: 1 Shield pra mão e todas as Units (G Generation) recuperam 1 HP", () => {
    let s = game();
    const gg = placeCard(s, "A", GGEN(0, { hp: 4 }), "battleArea");
    const other = placeCard(s, "A", UNIT({ code: "TEST-O", hp: 4 }), "battleArea");
    findCard(s, gg).damage = 2;
    findCard(s, other).damage = 2;
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", card("ST10-016"), "hand") });
    expect(findCard(s, gg).damage).toBe(1);
    expect(findCard(s, other).damage).toBe(2);
  });
});

describe("ST10-012 / ST10-006", () => {
  it("ST10-012 【When Paired】: inimiga Lv.5- ganha AP-2 no turno", () => {
    let s = game();
    const unit = placeCard(s, "A", UNIT(), "battleArea");
    const enemy = placeCard(s, "B", UNIT({ code: "TEST-E", level: 5, ap: 4 }), "battleArea");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: placeCard(s, "A", card("ST10-012"), "hand"), pairWithUnitId: unit });
    s = resolveWith(s, "A", { specId: "ST10-012-WhenPaired", targetIds: [enemy] });
    expect(effectiveAp(findCard(s, enemy), s)).toBe(2);
  });

  it("ST10-006 【During Pair】: destruiu em batalha no seu turno → devolve inimiga com HP ≤ 3 pra mão", () => {
    let s = game();
    const phoenix = placeCard(s, "A", { ...card("ST10-006"), ap: 6 }, "battleArea");
    findCard(s, phoenix).pairedPilotId = placeCard(s, "A", PILOT(), "battleArea");
    findCard(s, findCard(s, phoenix).pairedPilotId!).pairedUnitId = phoenix;
    const victim = placeCard(s, "B", UNIT({ code: "TEST-V", hp: 2 }), "battleArea", { rested: true });
    const small = placeCard(s, "B", UNIT({ code: "TEST-SM", hp: 3 }), "battleArea");
    s = act(s, "A", { kind: "declareAttack", attackerId: phoenix, target: { unitId: victim } });
    for (let i = 0; i < 6 && s.combat && !pending(s, "A"); i++) {
      if (s.combat.step === "block") s = act(s, "B", { kind: "skipBlock" });
      else if (s.combat.step === "action") s = act(s, s.combat.actionPriority, { kind: "passAction" });
      else break;
    }
    s = resolveWith(s, "A", { specId: "ST10-006-DestroyedEnemyInBattle", targetIds: [small] });
    expect(inZone(s, "B", "hand", small)).toBe(true);
  });
});
