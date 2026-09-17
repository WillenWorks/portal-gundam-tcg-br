import { describe, expect, it } from "vitest";

import { createGame } from "./setup";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { buildSt02DeckList, ST02_CARD_DEFS } from "../fixtures/st02Deck";
import { ST03_CARD_DEFS } from "../fixtures/st03Deck";
import { ST04_CARD_DEFS } from "../fixtures/st04Deck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { findCard } from "./events";
import { dispatchTrigger } from "./dispatcher";
import { applyPlayerAction } from "./actions";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

/**
 * docs/47 Classe B — 【Burst】Deploy this card AGORA encadeia o 【Deploy】 da Base.
 * Antes o Burst era `moveZone self → baseSection`: a Base entrava mas o efeito
 * 【Deploy】 (Add 1 Shield / token / dano) nunca rodava e a Base anterior ficava.
 * Fecha via primitiva `deployThisCard` (regra de 1 Base) + encadeamento no
 * `dispatcher.ts`.
 *
 * docs/47 Fase 4 — o encadeamento passou a usar `deferOrDispatchAbilities`
 * (mesmo helper de `deployCard`/`playCommand`) em vez de auto-mirar 1 alvo e
 * chamar `dispatchTrigger` direto: specs automáticos (sem alvo) resolvem na
 * hora, specs com alvo nomeado OU `ChoicePrimitive` (deckReorder, etc.) PAUSAM
 * em `PendingDecision.abilityResolution` — mesmo se não houver alvo legal
 * (fila com `legalTargets: []`, `resolveAbility` aceita `targetIds: []`).
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

  it("ST02-015 Saint Gabriel: Base em campo + PAUSA pra reordenação (deckReorder) via Burst — resolver aplica Add 1 Shield + reorder juntos (docs/47 Fase 4, deferred.ts fechado)", () => {
    let state = freshGame();
    place(state, "A", ST01_CARD_DEFS.RESOURCE, "shields");
    const handBefore = state.players.A.hand.length;
    const shieldsBefore = state.players.A.shields.length;
    const [top1, top2] = state.players.A.deck.slice(0, 2).map((c) => c.instanceId);
    state = burst(state, "A", ST02_CARD_DEFS.SAINT_GABRIEL_INSTITUTE);
    expect(state.players.A.baseSection.some((c) => c.def.code === "ST02-015")).toBe(true);
    // pausou: shield e reorder resolvem JUNTOS (mesmo spec) na resolução da decisão, não antes.
    expect(state.players.A.hand.length).toBe(handBefore);
    const decision = state.pendingDecision.A;
    const q = decision?.kind === "abilityResolution" ? decision.queue[0] : undefined;
    expect(q?.specId).toBe("ST02-015-Deploy");
    expect(q?.deckReorder?.slots.map((s) => s.position)).toEqual(["top", "bottom"]);
    expect(q?.deckReorder?.topCards.map((c) => c.instanceId)).toEqual([top1, top2]);

    // inverte: top2 pro topo, top1 pro fundo
    const resolved = applyPlayerAction(
      state,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: q!.specId, activate: true, targetIds: [top2, top1] }] },
      ALL_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    expect(resolved.players.A.hand.length).toBe(handBefore + 1); // Add 1 Shield rodou no resolve
    expect(resolved.players.A.shields.length).toBe(shieldsBefore - 1);
    expect(resolved.players.A.deck[0].instanceId).toBe(top2);
    expect(resolved.players.A.deck[resolved.players.A.deck.length - 1].instanceId).toBe(top1);
    expect(resolved.pendingDecision.A).toBeNull();
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

  it("ST03-015 Rewloola: Base em campo + Add 1 Shield roda na hora (spec incondicional); dano PAUSA pra escolha real de alvo via Burst (docs/47 Fase 4, deferred.ts fechado)", () => {
    let state = freshGame();
    place(state, "A", ST01_CARD_DEFS.RESOURCE, "shields");
    const enemyId = place(state, "B", ST01_CARD_DEFS.GM, "battleArea"); // AP2, HP2
    const handBefore = state.players.A.hand.length;
    state = burst(state, "A", ST03_CARD_DEFS.REWLOOLA);
    expect(state.players.A.baseSection.some((c) => c.def.code === "ST03-015")).toBe(true);
    expect(state.players.A.hand.length).toBe(handBefore + 1); // "Add 1 Shield" é spec separado, sem alvo — resolve na hora
    const decision = state.pendingDecision.A;
    const q = decision?.kind === "abilityResolution" ? decision.queue[0] : undefined;
    expect(q?.specId).toBe("ST03-015-Deploy-Damage");
    expect(q?.legalTargets).toEqual([enemyId]);

    const resolved = applyPlayerAction(
      state,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: q!.specId, activate: true, targetIds: [enemyId] }] },
      ALL_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    expect(findCard(resolved, enemyId).damage).toBe(1);
    expect(resolved.pendingDecision.A).toBeNull();
  });

  it("ST03-015 Rewloola: sem Unit inimiga AP≤5 legal — spec de dano ainda pausa (fila vazia), mas resolve com targetIds:[] sem aplicar dano", () => {
    let state = freshGame();
    place(state, "A", ST01_CARD_DEFS.RESOURCE, "shields");
    const handBefore = state.players.A.hand.length;
    state = burst(state, "A", ST03_CARD_DEFS.REWLOOLA);
    expect(state.players.A.baseSection.some((c) => c.def.code === "ST03-015")).toBe(true);
    expect(state.players.A.hand.length).toBe(handBefore + 1); // spec incondicional "Add 1 Shield" roda
    const decision = state.pendingDecision.A;
    const q = decision?.kind === "abilityResolution" ? decision.queue[0] : undefined;
    expect(q?.specId).toBe("ST03-015-Deploy-Damage");
    expect(q?.legalTargets).toEqual([]); // nenhum alvo legal — mesmo assim entra na fila (resolveAbility aceita targetIds:[])

    const resolved = applyPlayerAction(
      state,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: q!.specId, activate: true, targetIds: [] }] },
      ALL_EFFECT_SPECS,
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    expect(resolved.pendingDecision.A).toBeNull();
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
