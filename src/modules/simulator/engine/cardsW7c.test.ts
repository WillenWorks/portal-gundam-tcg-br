import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { CardDef, GameState, PlayerId } from "./types";
import { effectiveAp, hasKeyword, keywordValue } from "./types";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { findCard } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { buildSt07DeckList } from "../fixtures/st07Deck";
import { buildSt08DeckList } from "../fixtures/st08Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { GD05_CARD_DEFS } from "../content/gd05";

/**
 * W7c — pacote MF / Special Move, fluxo real: ativar o 【Main】 da carta pareada pelo 【Attack】, voltar do trash
 * pareada depois do 【Main】, e o registro "ativou Special Move neste turno".
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
const MF = (extra: Partial<CardDef> = {}) => UNIT({ code: "TEST-MF", traits: ["MF"], ...extra });
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
const inZone = (state: GameState, player: PlayerId, zone: "battleArea" | "hand" | "trash" | "exile" | "resourceArea", id: string) =>
  state.players[player][zone].some((c) => c.instanceId === id);
const specialMoveActivated = (s: GameState, p: PlayerId) => {
  const m = s.players[p].commandTraitsActivatedOnTurn;
  return !!m && m.turn === s.turnNumber && m.traits.includes("Special Move");
};
/** a Unit e a Command-Piloto pareadas (Command no modo Piloto) */
function pairCommandPilot(s: GameState, unitDef: CardDef, commandDef: CardDef): { unit: string; pilot: string } {
  const unit = placeCard(s, "A", unitDef, "battleArea");
  const pilot = placeCard(s, "A", commandDef, "battleArea", { asPilot: true });
  findCard(s, unit).pairedPilotId = pilot;
  findCard(s, pilot).pairedUnitId = unit;
  return { unit, pilot };
}

describe("【During Link】【Attack】 Activate 【Main】 on the card paired with this Unit (GD05-044)", () => {
  it("o 【Main】 da Command pareada pede o alvo, resolve, conta como Special Move e o combate segue", () => {
    let s = game();
    const { unit: rose, pilot } = pairCommandPilot(s, G["GD05-044"], G["GD05-113"]);
    const ally = placeCard(s, "A", MF({ code: "TEST-MF-AP3", ap: 3 }), "battleArea");
    const big = placeCard(s, "A", MF({ code: "TEST-MF-AP5", ap: 5 }), "battleArea");

    s = act(s, "A", { kind: "declareAttack", attackerId: rose, target: "player" });
    const main = entry(s, "A", "GD05-113-Main");
    expect(main?.legalTargets).toEqual(expect.arrayContaining([rose, ally]));
    expect(main?.legalTargets).not.toContain(big);
    expect(specialMoveActivated(s, "A")).toBe(true);

    s = resolve(s, "A", "GD05-113-Main", [ally]);
    expect(effectiveAp(findCard(s, ally), s)).toBe(5);
    expect(inZone(s, "A", "battleArea", pilot)).toBe(true); // continua pareada, não vai pro trash
    expect(s.combat?.step).toBe("block");
  });

  it("sem Link (Piloto que não é George de Sand) não ativa", () => {
    let s = game();
    const rose = placeCard(s, "A", G["GD05-044"], "battleArea");
    const other = placeCard(s, "A", G["GD05-121"], "battleArea", { asPilot: true });
    findCard(s, rose).pairedPilotId = other;
    findCard(s, other).pairedUnitId = rose;
    s = act(s, "A", { kind: "declareAttack", attackerId: rose, target: "player" });
    expect(s.pendingDecision.A).toBeNull();
    expect(s.combat?.step).toBe("block");
  });
});

describe("Special Move jogada da mão + \"After activating this card's 【Main】, you may pair this card from your trash\"", () => {
  it("GD05-112: <Breach 3> numa MF sem <Breach>; depois a carta sai do trash pareada com uma MF sem Piloto", () => {
    let s = game();
    const target = placeCard(s, "A", MF({ code: "TEST-MF-NOBREACH" }), "battleArea");
    const withBreach = placeCard(s, "A", MF({ code: "TEST-MF-BREACH", effectKeywords: ["Breach"], keywordTags: ["Breach 1"] }), "battleArea");
    const host = placeCard(s, "A", MF({ code: "TEST-MF-HOST" }), "battleArea");
    const cmd = placeCard(s, "A", G["GD05-112"], "hand");

    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main", targets: { target: [target] } });
    expect(hasKeyword(findCard(s, target), "Breach", s)).toBe(true);
    expect(keywordValue(findCard(s, target), "Breach", s)).toBe(3);
    expect(specialMoveActivated(s, "A")).toBe(true);
    expect(inZone(s, "A", "trash", cmd)).toBe(true);

    const pair = entry(s, "A", "GD05-112-AfterMain");
    expect(pair?.legalTargets).toEqual(expect.arrayContaining([target, host]));
    void withBreach;
    s = resolve(s, "A", "GD05-112-AfterMain", [host]);
    expect(findCard(s, host).pairedPilotId).toBe(cmd);
    expect(inZone(s, "A", "battleArea", cmd)).toBe(true);
  });

  it("GD05-112: não oferece Unit que já tem <Breach>", () => {
    const s = game();
    const withBreach = placeCard(s, "A", MF({ code: "TEST-MF-BREACH", effectKeywords: ["Breach"], keywordTags: ["Breach 1"] }), "battleArea");
    placeCard(s, "A", MF({ code: "TEST-MF-PLAIN" }), "battleArea");
    const cmd = placeCard(s, "A", G["GD05-112"], "hand");
    expect(() => act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main", targets: { target: [withBreach] } })).toThrow(/Alvo inválido/);
  });

  it("GD05-068: ganha <Suppression> no turno em que uma Special Move foi ativada", () => {
    let s = game();
    const shining = placeCard(s, "A", G["GD05-068"], "battleArea");
    const enemy = placeCard(s, "B", UNIT(), "battleArea");
    expect(hasKeyword(findCard(s, shining), "Suppression", s)).toBe(false);
    const cmd = placeCard(s, "A", G["GD05-121"], "hand");
    s = act(s, "A", { kind: "playCommand", cardInstanceId: cmd, trigger: "Main", targets: { target: [enemy] } });
    expect(effectiveAp(findCard(s, enemy), s)).toBe(1);
    expect(hasKeyword(findCard(s, shining), "Suppression", s)).toBe(true);
  });
});

describe("GD05-089 Master Asia / GD05-097 Domon Kasshu", () => {
  it("089 【During Link】【Attack】: com Special Move ativada no turno, 2 de dano numa Unit inimiga; sem ela, nada", () => {
    let s = game();
    const unit = placeCard(s, "A", G["GD05-036"], "battleArea"); // Haow Gundam, link "Master Asia"
    const asia = placeCard(s, "A", G["GD05-089"], "battleArea");
    findCard(s, unit).pairedPilotId = asia;
    findCard(s, asia).pairedUnitId = unit;
    const enemy = placeCard(s, "B", UNIT({ hp: 5 }), "battleArea");

    const noFlag = act(s, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
    expect(entry(noFlag, "A", "GD05-089-Attack")).toBeUndefined();

    s.players.A.commandTraitsActivatedOnTurn = { turn: s.turnNumber, traits: ["Special Move"] };
    s = act(s, "A", { kind: "declareAttack", attackerId: unit, target: "player" });
    s = resolve(s, "A", "GD05-089-Attack", [enemy]);
    expect(findCard(s, enemy).damage).toBe(2);
  });

  it("097 【When Paired】: compra, descarta; se descartou Special Move, pode ativar o 【Main】 dela", () => {
    let s = game();
    const host = placeCard(s, "A", G["GD05-066"], "battleArea");
    const enemy = placeCard(s, "B", UNIT(), "battleArea");
    const special = placeCard(s, "A", G["GD05-121"], "hand");
    const domon = placeCard(s, "A", G["GD05-097"], "hand");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: domon, pairWithUnitId: host });
    expect(entry(s, "A", "GD05-097-WhenPaired")?.handDiscard?.legalHandIds).toContain(special);
    s = resolve(s, "A", "GD05-097-WhenPaired", [special]);
    expect(inZone(s, "A", "trash", special)).toBe(true);
    s = resolve(s, "A", "GD05-097-Then", []);
    const main = entry(s, "A", "GD05-121-Main");
    expect(main?.legalTargets).toEqual([enemy]);
    s = resolve(s, "A", "GD05-121-Main", [enemy]);
    expect(effectiveAp(findCard(s, enemy), s)).toBe(1);
    expect(specialMoveActivated(s, "A")).toBe(true);
  });
});

describe("demais cartas do pacote", () => {
  it("GD05-033 【Attack】: exila 2 Special Move do trash e dá 5 de dano na 1ª carta da área de escudo", () => {
    let s = game();
    const master = placeCard(s, "A", G["GD05-033"], "battleArea");
    const sm1 = placeCard(s, "A", G["GD05-121"], "trash");
    const sm2 = placeCard(s, "A", G["GD05-122"], "trash");
    const top = s.players.B.shields[0].instanceId;
    s = act(s, "A", { kind: "declareAttack", attackerId: master, target: "player" });
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD05-033-Attack", activate: true, targetIds: [] }] });
    expect(inZone(s, "A", "exile", sm1) && inZone(s, "A", "exile", sm2)).toBe(true);
    expect(s.players.B.trash.some((c) => c.instanceId === top)).toBe(true);
  });

  it("GD05-036 【When Paired】: descansa outra MF ativa e dá 2 de dano em toda Unit inimiga de Lv. ≤ ao dela", () => {
    let s = game();
    const haow = placeCard(s, "A", G["GD05-036"], "battleArea");
    const lv4 = placeCard(s, "A", MF({ code: "TEST-MF-LV4", level: 4 }), "battleArea");
    const e3 = placeCard(s, "B", UNIT({ code: "TEST-E3", level: 3, hp: 5 }), "battleArea");
    const e5 = placeCard(s, "B", UNIT({ code: "TEST-E5", level: 5, hp: 5 }), "battleArea");
    const asia = placeCard(s, "A", G["GD05-089"], "hand");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: asia, pairWithUnitId: haow });
    s = resolve(s, "A", "GD05-036-WhenPaired", [lv4]);
    expect(findCard(s, lv4).rested).toBe(true);
    expect(findCard(s, e3).damage).toBe(2);
    expect(findCard(s, e5).damage).toBe(0);
  });

  it("GD05-066 【Deploy】 exila 2 MF do trash e busca 1 Special Move; 【Attack】 ativa 1 Resource descansado", () => {
    let s = game();
    const mf1 = placeCard(s, "A", MF({ code: "TEST-MF1" }), "trash");
    const mf2 = placeCard(s, "A", MF({ code: "TEST-MF2" }), "trash");
    const sm = placeCard(s, "A", G["GD05-113"], "trash");
    const shining = placeCard(s, "A", G["GD05-066"], "hand");
    s = act(s, "A", { kind: "deployCard", cardInstanceId: shining });
    s = act(s, "A", { kind: "resolveAbility", resolutions: [{ specId: "GD05-066-Deploy", activate: true, targetIds: [] }] });
    expect(inZone(s, "A", "exile", mf1) && inZone(s, "A", "exile", mf2)).toBe(true);
    s = resolve(s, "A", "GD05-066-Then", [sm]);
    expect(inZone(s, "A", "hand", sm)).toBe(true);

    const rested = s.players.A.resourceArea.find((r) => r.rested)!;
    findCard(s, shining).enteredZoneOnTurn = s.turnNumber - 1;
    s = act(s, "A", { kind: "declareAttack", attackerId: shining, target: "player" });
    s = resolve(s, "A", "GD05-066-Attack", [rested.instanceId]);
    expect(findCard(s, rested.instanceId).rested).toBe(false);
  });

  it("GD05-128 Base: sem MF Link em jogo, descansar a Base não dá nada", () => {
    let s = game();
    const base = placeCard(s, "A", G["GD05-128"], "baseSection");
    const plain = placeCard(s, "A", MF(), "battleArea");
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: base, targets: { target: [plain] } });
    expect(effectiveAp(findCard(s, plain), s)).toBe(3);
  });

  it("GD05-128 Base: com MF Link em jogo, descansa a Base e dá AP+2", () => {
    let s = game();
    const base = placeCard(s, "A", G["GD05-128"], "baseSection");
    const { unit } = pairCommandPilot(s, G["GD05-044"], G["GD05-113"]);
    const apBefore = effectiveAp(findCard(s, unit), s); // 3 da Unit + 1 do Rose Screamer como Piloto
    s = act(s, "A", { kind: "activateAbility", sourceInstanceId: base, targets: { target: [unit] } });
    expect(findCard(s, base).rested).toBe(true);
    expect(effectiveAp(findCard(s, unit), s)).toBe(apBefore + 2);
  });

  function runCombat(state: GameState): GameState {
    let next = state;
    for (let i = 0; i < 10 && next.combat && !next.pendingDecision.A && !next.pendingDecision.B; i++) {
      if (next.combat.step === "block") next = act(next, next.combat.defendingPlayer, { kind: "skipBlock" });
      else if (next.combat.step === "action") next = act(next, next.combat.actionPriority, { kind: "passAction" });
      else break;
    }
    return next;
  }

  it("GD05-035: ao destruir carta da área de escudo, 2 de dano numa Unit inimiga com AP ≤3 (1×/turno)", () => {
    let s = game();
    const dragon = placeCard(s, "A", G["GD05-035"], "battleArea");
    const weak = placeCard(s, "B", UNIT({ code: "TEST-AP2", ap: 2, hp: 5 }), "battleArea");
    const strong = placeCard(s, "B", UNIT({ code: "TEST-AP4", ap: 4, hp: 5 }), "battleArea");
    s = runCombat(act(s, "A", { kind: "declareAttack", attackerId: dragon, target: "player" }));
    const reaction = entry(s, "A", "GD05-035-Reaction");
    expect(reaction?.legalTargets).toEqual([weak]);
    expect(reaction?.legalTargets).not.toContain(strong);
    s = resolve(s, "A", "GD05-035-Reaction", [weak]);
    expect(findCard(s, weak).damage).toBe(2);
    expect(s.combat).toBeNull();
  });

  it("GD05-069: no seu turno, ao destruir Unit em batalha, olha o topo 4 por Special Move", () => {
    let s = game();
    const maxter = placeCard(s, "A", G["GD05-069"], "battleArea");
    const victim = placeCard(s, "B", UNIT({ ap: 1, hp: 1 }), "battleArea", { rested: true });
    const sm = placeCard(s, "A", G["GD05-121"], "deck");
    s.players.A.deck = [s.players.A.deck.at(-1)!, ...s.players.A.deck.slice(0, -1)];
    s = runCombat(act(s, "A", { kind: "declareAttack", attackerId: maxter, target: { unitId: victim } }));
    expect(entry(s, "A", "GD05-069-Reaction")?.deckTopReveal?.revealableIds).toEqual([sm]);
    s = resolve(s, "A", "GD05-069-Reaction", [sm]);
    expect(inZone(s, "A", "hand", sm)).toBe(true);
  });
});
