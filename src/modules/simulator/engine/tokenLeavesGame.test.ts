import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyEvent, findCard } from "./events";
import { deployCard } from "./deploy";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { ST03_CARD_DEFS } from "../fixtures/st03Deck";

/**
 * docs/47 Lane 0A / Fix 3 — token que deixa o campo é REMOVIDO DO JOGO (zona
 * `exile`), nunca vai pro `trash` (Comprehensive Rules — EX Base, EX Resource,
 * tokens de Unit). Feedback dos testers: "os EX resource e EX bases estão
 * ficando nas zonas de exílio/trash".
 */

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-tokfx-${seq++}`;
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

const EX_BASE_DEF: CardDef = { code: "TOKEN-EX-BASE", nameEn: "EX Base", cardType: "BASE", color: "colorless", ap: 0, hp: 3, isToken: true };

function freshState(): GameState {
  return createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 3, firstPlayer: "A" });
}

describe("DESTROY_CARD — token vai pro exile, não pro trash", () => {
  it("EX Base (token) destruída aparece em `exile` e some do `trash`", () => {
    const state = freshState();
    state.players.A.baseSection = [];
    const exBaseId = place(state, "A", EX_BASE_DEF, "baseSection", { damage: 3 });

    const next = applyEvent(state, { type: "DESTROY_CARD", instanceId: exBaseId });

    expect(next.players.A.exile.some((c) => c.instanceId === exBaseId)).toBe(true);
    expect(next.players.A.trash.some((c) => c.instanceId === exBaseId)).toBe(false);
    expect(findCard(next, exBaseId).zone).toBe("exile");
    expect(findCard(next, exBaseId).damage).toBe(0);
  });

  it("token de Unit (T-007 Zaku Ⅱ) morto por dano letal vai pro `exile`, não pro `trash`", () => {
    const state = freshState();
    const tokenId = place(state, "B", { code: "T-007", nameEn: "Zaku II", cardType: "UNIT", color: "green", ap: 1, hp: 1, isToken: true }, "battleArea");

    let next = applyEvent(state, { type: "DAMAGE_UNIT", instanceId: tokenId, amount: 1 });
    next = applyEvent(next, { type: "DESTROY_CARD", instanceId: tokenId });

    expect(next.players.B.exile.some((c) => c.instanceId === tokenId)).toBe(true);
    expect(next.players.B.trash.some((c) => c.instanceId === tokenId)).toBe(false);
  });

  it("REGRESSÃO: carta NÃO-token destruída continua indo pro `trash`", () => {
    const state = freshState();
    const gmId = place(state, "B", ST01_CARD_DEFS.GM, "battleArea");

    const next = applyEvent(state, { type: "DESTROY_CARD", instanceId: gmId });

    expect(next.players.B.trash.some((c) => c.instanceId === gmId)).toBe(true);
    expect(next.players.B.exile.some((c) => c.instanceId === gmId)).toBe(false);
    expect(findCard(next, gmId).zone).toBe("trash");
  });
});

describe("deployCard — trocar a Base atual quando ela é um token (EX Base)", () => {
  it("jogar uma Base real por cima do EX Base manda o EX Base pro `exile`, não pro `trash`", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 3, firstPlayer: "A" }));
    for (let i = 0; i < 3; i++) {
      place(state, "A", { code: "TKB-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
    }
    state.players.A.baseSection = [];
    const exBaseId = place(state, "A", EX_BASE_DEF, "baseSection");
    // Falmel (ST03-016): BASE nível 3 / custo 2. Só interessa a troca de Base aqui.
    const falmelId = place(state, "A", ST03_CARD_DEFS.FALMEL, "hand");

    const next = deployCard(state, "A", falmelId, {});

    expect(next.players.A.exile.some((c) => c.instanceId === exBaseId)).toBe(true);
    expect(next.players.A.trash.some((c) => c.instanceId === exBaseId)).toBe(false);
    expect(next.players.A.baseSection.some((c) => c.instanceId === falmelId)).toBe(true);
  });

  it("REGRESSÃO: trocar por cima de uma Base NÃO-token manda a antiga pro `trash`", () => {
    const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 3, firstPlayer: "A" }));
    for (let i = 0; i < 3; i++) {
      place(state, "A", { code: "TKB-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");
    }
    state.players.A.baseSection = [];
    const oldBaseId = place(state, "A", ST01_CARD_DEFS.WHITE_BASE, "baseSection");
    const falmelId = place(state, "A", ST03_CARD_DEFS.FALMEL, "hand");

    const next = deployCard(state, "A", falmelId, {});

    expect(next.players.A.trash.some((c) => c.instanceId === oldBaseId)).toBe(true);
    expect(next.players.A.exile.some((c) => c.instanceId === oldBaseId)).toBe(false);
  });
});
