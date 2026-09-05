import { describe, expect, it } from "vitest";
import { createGame } from "../engine/setup";
import { buildSt03DeckList, ST03_CARD_DEFS } from "../fixtures/st03Deck";
import { buildSt04DeckList } from "../fixtures/st04Deck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "../engine/types";
import type { EffectContext } from "../engine/effectSpec";
import { resolveEffectSpec } from "../engine/effectSpec";
import { applyEvents, findCard } from "../engine/events";
import {
  CHARS_ZAKU_II_DESTROYED,
  CHAR_AZNABLE_ATTACK,
  CLOSE_COMBAT_MAIN,
  FALMEL_DEPLOY,
  FULL_FRONTAL_WHEN_PAIRED,
  GOUF_DEPLOY,
  INDIGNATION_MAIN,
  REWLOOLA_DEPLOY,
  ST03_EFFECT_SPECS,
  ZAKU_II_ATTACK,
} from "./st03";
import { defaultPredicateResolver, defaultTargetFilterResolver } from "./predicates";

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-st03fx-${seq++}`;
  state.players[player][zone].push({
    instanceId,
    def,
    owner: player,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber - 1,
    ...opts,
  });
  return instanceId;
}

function freshGame(): GameState {
  return createGame(buildSt03DeckList(), buildSt03DeckList(), { seed: 21, firstPlayer: "A" });
}
function ctxFor(state: GameState, sourceInstanceId: string, targets: Record<string, string[]> = {}): EffectContext {
  return { state, controller: "A", sourceInstanceId, turnNumber: state.turnNumber, targets };
}

describe("ST03 — fixtures e cobertura", () => {
  it("os dois decks montam 50 + 10 e a partida ST03 vs ST04 inicia sem erro", () => {
    expect(() => createGame(buildSt03DeckList(), buildSt04DeckList(), { seed: 1, firstPlayer: "A" })).not.toThrow();
    expect(buildSt03DeckList().main).toHaveLength(50);
    expect(buildSt03DeckList().resources).toHaveLength(10);
  });

  it("16 EffectSpecs cadastrados cobrindo 8 das 16 cartas únicas (resto é vanilla/keyword)", () => {
    const codes = new Set(ST03_EFFECT_SPECS.map((s) => s.cardCode));
    expect(ST03_EFFECT_SPECS).toHaveLength(16);
    expect(codes).toEqual(new Set(["ST03-006", "ST03-008", "ST03-009", "ST03-010", "ST03-011", "ST03-012", "ST03-013", "ST03-015", "ST03-016"]));
  });
});

describe("ST03 — EffectSpecs bespoke", () => {
  it("ST03-006 Char's Zaku Ⅱ — 【Destroyed】revela Unit Zeon do topo pra mão", () => {
    const state = freshGame();
    const sourceId = place(state, "A", ST03_CARD_DEFS.CHARS_ZAKU_II, "trash");
    // força o topo do deck: 1 Zaku I (Zeon Unit) + 2 outras
    const zaku = place(state, "A", ST03_CARD_DEFS.ZAKU_I, "deck");
    state.players.A.deck.unshift(state.players.A.deck.pop()!); // move o recém-adicionado pro topo
    const topZakuId = state.players.A.deck[0].instanceId;
    const handBefore = state.players.A.hand.length;

    const events = resolveEffectSpec(CHARS_ZAKU_II_DESTROYED, ctxFor(state, sourceId, { reveal: [topZakuId] }), defaultPredicateResolver);
    const next = applyEvents(state, events);

    expect(next.players.A.hand.some((c) => c.instanceId === topZakuId)).toBe(true);
    expect(next.players.A.hand).toHaveLength(handBefore + 1);
    void zaku;
  });

  it("ST03-008 Zaku Ⅱ — 【Attack】dá AP+2 até o fim do turno na própria Unit", () => {
    const state = freshGame();
    const zakuId = place(state, "A", ST03_CARD_DEFS.ZAKU_II, "battleArea");
    const events = resolveEffectSpec(ZAKU_II_ATTACK, ctxFor(state, zakuId));
    const next = applyEvents(state, events);
    expect(findCard(next, zakuId).statModifiers).toContainEqual(expect.objectContaining({ stat: "ap", amount: 2, duration: "endOfTurn" }));
  });

  it("ST03-009 Gouf — 【Deploy】invoca 1 token Zaku Ⅱ rested", () => {
    const state = freshGame();
    const goufId = place(state, "A", ST03_CARD_DEFS.GOUF, "battleArea");
    const before = state.players.A.battleArea.length;
    const next = applyEvents(state, resolveEffectSpec(GOUF_DEPLOY, ctxFor(state, goufId)));
    expect(next.players.A.battleArea).toHaveLength(before + 1);
    const token = next.players.A.battleArea[next.players.A.battleArea.length - 1];
    expect(token.def.code).toBe("T-007");
    expect(token.rested).toBe(true);
  });

  it("ST03-010 Full Frontal — 【When Paired】deploya Unit Neo Zeon Lv≤4 da mão sem custo", () => {
    const state = freshGame();
    const ffId = place(state, "A", ST03_CARD_DEFS.FULL_FRONTAL, "battleArea");
    const gearaId = place(state, "A", ST03_CARD_DEFS.GEARA_ZULU, "hand"); // L3 Neo Zeon
    const before = state.players.A.battleArea.length;
    const next = applyEvents(state, resolveEffectSpec(FULL_FRONTAL_WHEN_PAIRED, ctxFor(state, ffId, { deploy: [gearaId] })));
    expect(next.players.A.battleArea).toHaveLength(before + 1);
    expect(next.players.A.battleArea.some((c) => c.instanceId === gearaId)).toBe(true);
    expect(next.players.A.hand.some((c) => c.instanceId === gearaId)).toBe(false);
  });

  it("ST03-011 Char Aznable — 【Attack】AP+1 na Unit pareada; <High-Maneuver> só se for Link Unit", () => {
    const state = freshGame();
    const zakuId = place(state, "A", ST03_CARD_DEFS.CHARS_ZAKU_II, "battleArea"); // link [Char Aznable]
    const charId = place(state, "A", ST03_CARD_DEFS.CHAR_AZNABLE, "battleArea", { pairedUnitId: zakuId, asPilot: undefined });
    findCard(state, zakuId).pairedPilotId = charId;

    const next = applyEvents(state, resolveEffectSpec(CHAR_AZNABLE_ATTACK, ctxFor(state, charId), defaultPredicateResolver));
    expect(findCard(next, zakuId).statModifiers).toContainEqual(expect.objectContaining({ stat: "ap", amount: 1 }));
    expect(findCard(next, zakuId).keywordGrants.some((g) => g.keyword === "High-Maneuver")).toBe(true);
  });

  it("ST03-012 Indignation — 【Main】escolhe Unit amiga e dá AP+2", () => {
    const state = freshGame();
    const cmdId = place(state, "A", ST03_CARD_DEFS.INDIGNATION, "trash");
    const allyId = place(state, "A", ST03_CARD_DEFS.GEARA_ZULU, "battleArea");
    const next = applyEvents(state, resolveEffectSpec(INDIGNATION_MAIN, ctxFor(state, cmdId, { target: [allyId] })));
    expect(findCard(next, allyId).statModifiers).toContainEqual(expect.objectContaining({ stat: "ap", amount: 2 }));
  });

  it("ST03-013 Close Combat — 【Main】2 de dano numa Unit inimiga", () => {
    const state = freshGame();
    const cmdId = place(state, "A", ST03_CARD_DEFS.CLOSE_COMBAT, "trash");
    const enemyId = place(state, "B", ST03_CARD_DEFS.ANGELOS_GEARA_ZULU, "battleArea"); // HP3 -> sobrevive a 2 de dano
    const next = applyEvents(state, resolveEffectSpec(CLOSE_COMBAT_MAIN, ctxFor(state, cmdId, { target: [enemyId] })));
    expect(findCard(next, enemyId).damage).toBe(2);
  });

  it("ST03-015 Rewloola — 【Deploy】pega 1 shield e dá 1 de dano em Unit inimiga com AP≤5", () => {
    const state = freshGame();
    const baseId = place(state, "A", ST03_CARD_DEFS.REWLOOLA, "baseSection");
    const enemyId = place(state, "B", ST03_CARD_DEFS.DRA_C, "battleArea"); // AP1
    const shieldsBefore = state.players.A.shields.length;
    const next = applyEvents(state, resolveEffectSpec(REWLOOLA_DEPLOY, ctxFor(state, baseId, { target: [enemyId] })));
    expect(next.players.A.shields.length).toBe(shieldsBefore - 1);
    expect(findCard(next, enemyId).damage).toBe(1);
  });

  it("ST03-016 Falmel — 【Deploy】pega 1 shield e invoca token Char's Zaku Ⅱ rested", () => {
    const state = freshGame();
    const baseId = place(state, "A", ST03_CARD_DEFS.FALMEL, "baseSection");
    const before = state.players.A.battleArea.length;
    const next = applyEvents(state, resolveEffectSpec(FALMEL_DEPLOY, ctxFor(state, baseId)));
    expect(next.players.A.battleArea).toHaveLength(before + 1);
    expect(next.players.A.battleArea[next.players.A.battleArea.length - 1].def.code).toBe("T-006");
  });

  it("defaultTargetFilterResolver — ap<=5 aceita Unit fraca e rejeita Unit forte", () => {
    const state = freshGame();
    const weakId = place(state, "B", ST03_CARD_DEFS.DRA_C, "battleArea");
    const strongId = place(state, "B", ST03_CARD_DEFS.SINANJU, "battleArea");
    expect(defaultTargetFilterResolver("ap<=5", findCard(state, weakId), { state })).toBe(true);
    expect(defaultTargetFilterResolver("ap<=5", findCard(state, strongId), { state })).toBe(true); // Sinanju AP5
    expect(defaultTargetFilterResolver("ap<=4", findCard(state, strongId), { state })).toBe(false);
  });
});
