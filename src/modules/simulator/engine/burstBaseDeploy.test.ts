import { describe, expect, it } from "vitest";

import { createGame } from "./setup";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { buildSt02DeckList, ST02_CARD_DEFS } from "../fixtures/st02Deck";
import { ST03_CARD_DEFS } from "../fixtures/st03Deck";
import { ST04_CARD_DEFS } from "../fixtures/st04Deck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { findCard } from "./events";
import { dispatchTrigger } from "./dispatcher";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

/**
 * docs/47 Classe B — 【Burst】Deploy this card AGORA encadeia o 【Deploy】 da Base.
 * Antes o Burst era `moveZone self → baseSection`: a Base entrava mas o efeito
 * 【Deploy】 (Add 1 Shield / token / dano) nunca rodava e a Base anterior ficava.
 * Fecha via primitiva `deployThisCard` (regra de 1 Base) + encadeamento no
 * `dispatcher.ts` (alvo nomeado auto-mirado — Burst só acontece em combate).
 */

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-burst-${seq++}`;
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
  return createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: "A" });
}

const OPTS = {
  predicateResolver: defaultPredicateResolver,
  targetFilterResolver: defaultTargetFilterResolver,
  allSpecs: ALL_EFFECT_SPECS,
};

/** Revela `def` como shield de `player` e dispara o 【Burst】 (fluxo real: shield já
 *  quebrada; aqui em `shields` só pra o teste). */
function burst(state: GameState, player: PlayerId, def: CardDef): GameState {
  const shieldId = place(state, player, def, "shields");
  return dispatchTrigger(state, shieldId, "Burst", ALL_EFFECT_SPECS, OPTS);
}

describe("【Burst】Deploy this card — encadeia o 【Deploy】 da Base (docs/47 Classe B)", () => {
  it("ST01-015 White Base: Base em campo + Add 1 Shield to hand", () => {
    let state = freshGame();
    const handBefore = state.players.A.hand.length;
    const shieldsBefore = state.players.A.shields.length; // 6 do setup
    state = burst(state, "A", ST01_CARD_DEFS.WHITE_BASE);
    expect(state.players.A.baseSection.some((c) => c.def.code === "ST01-015")).toBe(true);
    expect(state.players.A.hand.length).toBe(handBefore + 1); // 【Deploy】 Add 1 Shield
    expect(state.players.A.shields.length).toBe(shieldsBefore - 1); // 1 shield saiu pra mão
  });

  it("ST01-016 Asticassia: Base em campo + Add 1 Shield to hand", () => {
    let state = freshGame();
    place(state, "A", ST01_CARD_DEFS.RESOURCE, "shields");
    const handBefore = state.players.A.hand.length;
    state = burst(state, "A", ST01_CARD_DEFS.ASTICASSIA);
    expect(state.players.A.baseSection.some((c) => c.def.code === "ST01-016")).toBe(true);
    expect(state.players.A.hand.length).toBe(handBefore + 1);
  });

  it("ST02-015 Saint Gabriel: Base em campo + Add 1 Shield (a reordenação do topo NÃO roda via Burst)", () => {
    let state = freshGame();
    place(state, "A", ST01_CARD_DEFS.RESOURCE, "shields");
    const handBefore = state.players.A.hand.length;
    const topBefore = state.players.A.deck.slice(0, 2).map((c) => c.instanceId);
    state = burst(state, "A", ST02_CARD_DEFS.SAINT_GABRIEL_INSTITUTE);
    expect(state.players.A.baseSection.some((c) => c.def.code === "ST02-015")).toBe(true);
    expect(state.players.A.hand.length).toBe(handBefore + 1);
    expect(state.players.A.deck.slice(0, 2).map((c) => c.instanceId)).toEqual(topBefore); // reorder pulado (deferred Classe A)
  });

  it("ST02-016 Corsica Base: Base em campo + Add 1 Shield + token [Tallgeese]", () => {
    let state = freshGame();
    place(state, "A", ST01_CARD_DEFS.RESOURCE, "shields");
    const handBefore = state.players.A.hand.length;
    const unitsBefore = state.players.A.battleArea.filter((c) => c.def.cardType === "UNIT").length;
    state = burst(state, "A", ST02_CARD_DEFS.CORSICA_BASE);
    expect(state.players.A.baseSection.some((c) => c.def.code === "ST02-016")).toBe(true);
    expect(state.players.A.hand.length).toBe(handBefore + 1);
    const tokens = state.players.A.battleArea.filter((c) => c.def.isToken);
    expect(tokens.map((c) => c.def.nameEn)).toEqual(["Tallgeese"]);
    expect(state.players.A.battleArea.filter((c) => c.def.cardType === "UNIT").length).toBe(unitsBefore + 1);
  });

  it("ST03-015 Rewloola: Base em campo + Add 1 Shield + 1 de dano numa Unit inimiga AP≤5 (auto-mira)", () => {
    let state = freshGame();
    place(state, "A", ST01_CARD_DEFS.RESOURCE, "shields");
    const enemyId = place(state, "B", ST01_CARD_DEFS.GM, "battleArea"); // AP2, HP2
    const handBefore = state.players.A.hand.length;
    state = burst(state, "A", ST03_CARD_DEFS.REWLOOLA);
    expect(state.players.A.baseSection.some((c) => c.def.code === "ST03-015")).toBe(true);
    expect(state.players.A.hand.length).toBe(handBefore + 1);
    expect(findCard(state, enemyId).damage).toBe(1);
  });

  it("ST03-015 Rewloola: sem Unit inimiga AP≤5 legal, só o Add 1 Shield roda (o spec de dano não ativa, sem pausa)", () => {
    let state = freshGame();
    place(state, "A", ST01_CARD_DEFS.RESOURCE, "shields");
    const handBefore = state.players.A.hand.length;
    state = burst(state, "A", ST03_CARD_DEFS.REWLOOLA);
    expect(state.players.A.baseSection.some((c) => c.def.code === "ST03-015")).toBe(true);
    expect(state.players.A.hand.length).toBe(handBefore + 1); // spec incondicional "Add 1 Shield" roda
    expect(state.pendingDecision.A).toBeNull(); // não pausou
  });

  it("ST03-016 Falmel: Base em campo + Add 1 Shield + token [Char's Zaku II] rested", () => {
    let state = freshGame();
    place(state, "A", ST01_CARD_DEFS.RESOURCE, "shields");
    const handBefore = state.players.A.hand.length;
    state = burst(state, "A", ST03_CARD_DEFS.FALMEL);
    expect(state.players.A.baseSection.some((c) => c.def.code === "ST03-016")).toBe(true);
    expect(state.players.A.hand.length).toBe(handBefore + 1);
    const token = state.players.A.battleArea.find((c) => c.def.isToken);
    expect(token?.def.code).toBe("T-006");
    expect(token?.rested).toBe(true);
  });

  it("ST04-015 Archangel: Base em campo + Add 1 Shield to hand", () => {
    let state = freshGame();
    place(state, "A", ST01_CARD_DEFS.RESOURCE, "shields");
    const handBefore = state.players.A.hand.length;
    state = burst(state, "A", ST04_CARD_DEFS.ARCHANGEL);
    expect(state.players.A.baseSection.some((c) => c.def.code === "ST04-015")).toBe(true);
    expect(state.players.A.hand.length).toBe(handBefore + 1);
  });

  it("ST04-016 Vesalius: Base em campo + Add 1 Shield to hand", () => {
    let state = freshGame();
    place(state, "A", ST01_CARD_DEFS.RESOURCE, "shields");
    const handBefore = state.players.A.hand.length;
    state = burst(state, "A", ST04_CARD_DEFS.VESALIUS);
    expect(state.players.A.baseSection.some((c) => c.def.code === "ST04-016")).toBe(true);
    expect(state.players.A.hand.length).toBe(handBefore + 1);
  });

  it("aplica a regra de 1 Base: a Base real anterior vai pro trash (não é 'destruída')", () => {
    let state = freshGame();
    place(state, "A", ST01_CARD_DEFS.RESOURCE, "shields");
    state.players.A.baseSection = []; // limpa a EX Base do setup
    const oldBaseId = place(state, "A", ST04_CARD_DEFS.VESALIUS, "baseSection");
    state = burst(state, "A", ST01_CARD_DEFS.WHITE_BASE);
    expect(state.players.A.baseSection.map((c) => c.def.code)).toEqual(["ST01-015"]);
    expect(findCard(state, oldBaseId).zone).toBe("trash");
  });

  it("EX Base (token) substituída por Burst → removida do jogo (exile), não trash", () => {
    let state = freshGame();
    place(state, "A", ST01_CARD_DEFS.RESOURCE, "shields");
    const exBase = state.players.A.baseSection.find((c) => c.def.isToken);
    expect(exBase).toBeTruthy();
    state = burst(state, "A", ST01_CARD_DEFS.WHITE_BASE);
    expect(state.players.A.baseSection.map((c) => c.def.code)).toEqual(["ST01-015"]);
    expect(findCard(state, exBase!.instanceId).zone).toBe("exile");
    expect(state.players.A.trash.some((c) => c.instanceId === exBase!.instanceId)).toBe(false);
  });
});
