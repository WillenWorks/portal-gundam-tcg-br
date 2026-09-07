import { describe, expect, it } from "vitest";

import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction } from "./actions";
import { deployCard, playCommand } from "./deploy";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { buildSt02DeckList, ST02_CARD_DEFS } from "../fixtures/st02Deck";
import { buildSt04DeckList, ST04_CARD_DEFS } from "../fixtures/st04Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

/**
 * docs/47 Classe A — camada de decisão pra ESCOLHA NOMEADA que não é "alvo em
 * campo": `discardNamed` (ST04-002), `moveWithinDeck` nomeado (ST02-015) e
 * `spawnTokenChoice` (ST04-012). Antes essas primitivas resolviam inline sem
 * `ctx.targets` → no-op / branch default. Agora pausam em `abilityResolution`
 * (`handDiscard` / `deckReorder` / `enumChoice`).
 */

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-ca-${seq++}`;
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

const RES: CardDef = { code: "CA-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" };

function apply(state: GameState, p: PlayerId, action: Parameters<typeof applyPlayerAction>[2]): GameState {
  return applyPlayerAction(state, p, action, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}

describe("ST04-002 Strike Gundam — 【Deploy】Draw 1. Then, discard 1.", () => {
  function setup() {
    const state = advanceToMainPhase(createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 3, firstPlayer: "A" }));
    for (let i = 0; i < 4; i++) place(state, "A", RES, "resourceArea");
    state.players.A.baseSection = [];
    const strikeId = place(state, "A", ST04_CARD_DEFS.STRIKE_GUNDAM, "hand");
    return { state, strikeId };
  }

  it("pausa pra escolha (handDiscard) e o descarte de fato acontece (compra e descarta = net 0 na mão)", () => {
    const { state, strikeId } = setup();
    const handBefore = state.players.A.hand.filter((c) => c.instanceId !== strikeId).length;

    const paused = deployCard(state, "A", strikeId, {
      specs: ALL_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });
    const decision = paused.pendingDecision.A;
    expect(decision?.kind).toBe("abilityResolution");
    const q = decision?.kind === "abilityResolution" ? decision.queue[0] : undefined;
    expect(q?.handDiscard?.n).toBe(1);
    // legalHandIds inclui a carta que SERÁ comprada (topo do deck)
    const willDraw = paused.players.A.deck[0].instanceId;
    expect(q?.handDiscard?.legalHandIds).toContain(willDraw);

    // descarta a própria carta comprada
    const next = apply(paused, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: q!.specId, activate: true, targetIds: [willDraw] }],
    });
    expect(next.players.A.hand.filter((c) => c.instanceId !== strikeId).length).toBe(handBefore); // +1 compra, -1 descarte
    expect(next.players.A.trash.some((c) => c.instanceId === willDraw)).toBe(true);
    expect(next.pendingDecision.A).toBeNull();
  });

  it("descartar uma carta que já estava na mão: net -1 (a comprada fica)", () => {
    const { state, strikeId } = setup();
    const existingHandId = place(state, "A", ST04_CARD_DEFS.GINN, "hand");
    const handBefore = state.players.A.hand.filter((c) => c.instanceId !== strikeId).length;

    const paused = deployCard(state, "A", strikeId, {
      specs: ALL_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });
    const q = paused.pendingDecision.A?.kind === "abilityResolution" ? paused.pendingDecision.A.queue[0] : undefined;
    const next = apply(paused, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: q!.specId, activate: true, targetIds: [existingHandId] }],
    });
    expect(next.players.A.hand.filter((c) => c.instanceId !== strikeId).length).toBe(handBefore); // -1 (descarte) +1 (compra)
    expect(next.players.A.trash.some((c) => c.instanceId === existingHandId)).toBe(true);
  });
});

describe("ST02-015 Saint Gabriel — 【Deploy】...look at the top 2 and return 1 to top / 1 to bottom", () => {
  function setup() {
    const state = advanceToMainPhase(createGame(buildSt02DeckList(), buildSt02DeckList(), { seed: 5, firstPlayer: "A" }));
    for (let i = 0; i < 2; i++) place(state, "A", RES, "resourceArea");
    state.players.A.baseSection = [];
    const sgId = place(state, "A", ST02_CARD_DEFS.SAINT_GABRIEL_INSTITUTE, "hand");
    return { state, sgId };
  }

  it("pausa pra reordenação (deckReorder) e aplica a escolha do jogador ao topo/fundo do deck", () => {
    const { state, sgId } = setup();
    const [top1, top2] = state.players.A.deck.slice(0, 2).map((c) => c.instanceId);
    const shieldsBefore = state.players.A.shields.length;

    const paused = deployCard(state, "A", sgId, {
      specs: ALL_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });
    const decision = paused.pendingDecision.A;
    const q = decision?.kind === "abilityResolution" ? decision.queue[0] : undefined;
    expect(q?.deckReorder?.slots.map((s) => s.position)).toEqual(["top", "bottom"]);
    expect(q?.deckReorder?.topCards.map((c) => c.instanceId)).toEqual([top1, top2]);

    // inverte: top2 pro topo, top1 pro fundo
    const next = apply(paused, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: q!.specId, activate: true, targetIds: [top2, top1] }],
    });
    expect(next.players.A.shields.length).toBe(shieldsBefore - 1); // Add 1 Shield rodou no resolve
    expect(next.players.A.deck[0].instanceId).toBe(top2);
    expect(next.players.A.deck[next.players.A.deck.length - 1].instanceId).toBe(top1);
    expect(next.pendingDecision.A).toBeNull();
  });
});

describe("ST04-012 Striker Pack 【Main】 — deploy 1 Sword ou 1 Launcher (enumChoice)", () => {
  function setup() {
    const state = advanceToMainPhase(createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 9, firstPlayer: "A" }));
    for (let i = 0; i < 4; i++) place(state, "A", RES, "resourceArea");
    const cmdId = place(state, "A", ST04_CARD_DEFS.STRIKER_PACK, "hand");
    return { state, cmdId };
  }

  it("pausa pra escolha Sword/Launcher; 'launcher' → T-009 e a Command vai pro trash", () => {
    const { state, cmdId } = setup();
    const paused = playCommand(state, "A", cmdId, "Main", ALL_EFFECT_SPECS, {
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });
    const decision = paused.pendingDecision.A;
    const q = decision?.kind === "abilityResolution" ? decision.queue[0] : undefined;
    expect(q?.enumChoice?.key).toBe("strikerChoice");
    expect(q?.enumChoice?.options.map((o) => o.value).sort()).toEqual(["launcher", "sword"]);
    expect(paused.players.A.hand.some((c) => c.instanceId === cmdId)).toBe(true); // ainda na mão durante a pausa

    const next = apply(paused, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: q!.specId, activate: true, targetIds: ["launcher"] }],
    });
    const tokens = next.players.A.battleArea.filter((c) => c.def.isToken);
    expect(tokens.map((c) => c.def.code)).toEqual(["T-009"]);
    expect(next.players.A.trash.some((c) => c.instanceId === cmdId)).toBe(true); // CR 3-4-4
    expect(next.pendingDecision.A).toBeNull();
  });

  it("'sword' → T-010", () => {
    const { state, cmdId } = setup();
    const paused = playCommand(state, "A", cmdId, "Main", ALL_EFFECT_SPECS, {
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });
    const q = paused.pendingDecision.A?.kind === "abilityResolution" ? paused.pendingDecision.A.queue[0] : undefined;
    const next = apply(paused, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: q!.specId, activate: true, targetIds: ["sword"] }],
    });
    expect(next.players.A.battleArea.filter((c) => c.def.isToken).map((c) => c.def.code)).toEqual(["T-010"]);
  });

  it("com token (Earth Alliance) em campo: a Command resolve (vai pro trash) mas nenhum token novo", () => {
    const { state, cmdId } = setup();
    place(state, "A", ST04_CARD_DEFS.TOKEN_AILE_STRIKE, "battleArea");
    const paused = playCommand(state, "A", cmdId, "Main", ALL_EFFECT_SPECS, {
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });
    const q = paused.pendingDecision.A?.kind === "abilityResolution" ? paused.pendingDecision.A.queue[0] : undefined;
    const next = apply(paused, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: q!.specId, activate: true, targetIds: ["sword"] }],
    });
    expect(next.players.A.battleArea.filter((c) => c.def.isToken)).toHaveLength(1); // só o Aile Strike que já estava
    expect(next.players.A.trash.some((c) => c.instanceId === cmdId)).toBe(true);
  });
});
