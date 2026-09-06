import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { dispatchDestroyedTriggers } from "./abilityDispatch";
import { findCard } from "./events";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { buildSt04DeckList, ST04_CARD_DEFS } from "../fixtures/st04Deck";
import { ST03_CARD_DEFS } from "../fixtures/st03Deck";
import { VANILLA_CARD_DEFS } from "../fixtures/vanillaDeck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

/**
 * docs/45 — 【Destroyed】 disparado por dano/destroy direto de EFEITO (fora do
 * Damage Step). O ponto único é `dispatchTrigger` (dispatcher.ts): depois de
 * aplicar os eventos de cada EffectSpec, `dispatchDestroyedFromEffect` acha as
 * Units que aquele efeito matou e dispara o 【Destroyed】 de cada uma —
 * não-pausante inline (Miguel's Ginn), pausante como `abilityResolution`
 * (Char's Zaku Ⅱ).
 */

const SPECS = ALL_EFFECT_SPECS;

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-docfx-${seq++}`;
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

function pair(state: GameState, unitId: string, pilotId: string): void {
  findCard(state, unitId).pairedPilotId = pilotId;
  findCard(state, pilotId).pairedUnitId = unitId;
}

function apply(state: GameState, p: PlayerId, action: PlayerAction): GameState {
  return applyPlayerAction(state, p, action, SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
}

function freshMatch(): GameState {
  return advanceToMainPhase(createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 7, firstPlayer: "A" }));
}

/** dá `n` recursos active pra `player` (pra pagar level + custo de Command/Base). */
function giveResources(state: GameState, player: PlayerId, n: number): void {
  for (let i = 0; i < n; i++) place(state, player, ST04_CARD_DEFS.RESOURCE, "resourceArea");
}

describe("Close Combat 【Main】 — dano de efeito mata Unit com 【Destroyed】", () => {
  it("mata Char's Zaku Ⅱ (HP2) -> 【Destroyed】 pausante vira abilityResolution do dono", () => {
    const state = freshMatch();
    giveResources(state, "A", 2);
    const cmdId = place(state, "A", ST03_CARD_DEFS.CLOSE_COMBAT, "hand");
    const zakuId = place(state, "B", ST03_CARD_DEFS.CHARS_ZAKU_II, "battleArea"); // HP2

    const next = apply(state, "A", {
      kind: "playCommand",
      cardInstanceId: cmdId,
      trigger: "Main",
      targets: { target: [zakuId] },
    });

    expect(next.players.B.trash.some((c) => c.instanceId === zakuId)).toBe(true);
    const d = next.pendingDecision.B;
    if (d?.kind !== "abilityResolution") throw new Error("esperava abilityResolution pendente pra B");
    expect(d.trigger).toBe("Destroyed");
    const q = d.queue.find((x) => x.specId === "ST03-006-Destroyed");
    expect(q?.deckTopReveal?.count).toBe(3);
    expect(next.pendingDecision.A).toBeNull();
    // Close Combat resolveu e foi pro trash normalmente
    expect(next.players.A.trash.some((c) => c.instanceId === cmdId)).toBe(true);
  });

  it("dono resolve o 【Destroyed】 (declina) -> pausa some, jogo segue", () => {
    const state = freshMatch();
    giveResources(state, "A", 2);
    const cmdId = place(state, "A", ST03_CARD_DEFS.CLOSE_COMBAT, "hand");
    const zakuId = place(state, "B", ST03_CARD_DEFS.CHARS_ZAKU_II, "battleArea");
    const paused = apply(state, "A", { kind: "playCommand", cardInstanceId: cmdId, trigger: "Main", targets: { target: [zakuId] } });

    const next = apply(paused, "B", {
      kind: "resolveAbility",
      resolutions: [{ specId: "ST03-006-Destroyed", activate: false, targetIds: [] }],
    });
    expect(next.pendingDecision.A).toBeNull();
    expect(next.pendingDecision.B).toBeNull();
  });

  it("mata Miguel's Ginn pareada + outra Link Unit -> 【Destroyed】 não-pausante dispara inline (dono compra 1)", () => {
    const state = freshMatch();
    giveResources(state, "A", 2);
    const cmdId = place(state, "A", ST03_CARD_DEFS.CLOSE_COMBAT, "hand");
    // Miguel's Ginn (HP1) pareada com Kira (HP+1 -> HP efetivo 2): Close Combat (2) mata.
    const ginnId = place(state, "B", ST04_CARD_DEFS.MIGUELS_GINN, "battleArea");
    const ginnPilot = place(state, "B", ST04_CARD_DEFS.KIRA_YAMATO, "battleArea");
    pair(state, ginnId, ginnPilot);
    // outra Link Unit de B: Strike Gundam (link [Kira Yamato]) pareada com Kira.
    const strikeId = place(state, "B", ST04_CARD_DEFS.STRIKE_GUNDAM, "battleArea");
    const kira2 = place(state, "B", ST04_CARD_DEFS.KIRA_YAMATO, "battleArea");
    pair(state, strikeId, kira2);

    const handBefore = state.players.B.hand.length;
    const next = apply(state, "A", { kind: "playCommand", cardInstanceId: cmdId, trigger: "Main", targets: { target: [ginnId] } });

    expect(next.players.B.trash.some((c) => c.instanceId === ginnId)).toBe(true);
    expect(next.players.B.hand.length).toBe(handBefore + 1); // 【During Pair】【Destroyed】 disparou
    expect(next.pendingDecision.A).toBeNull();
    expect(next.pendingDecision.B).toBeNull(); // não-pausante: resolve inline
  });

  it("dano de efeito que mata NÃO dispara <Breach> do atacante (só ataque no Damage Step)", () => {
    const state = freshMatch();
    giveResources(state, "A", 2);
    place(state, "A", VANILLA_CARD_DEFS.BREACH_01, "battleArea"); // A tem <Breach 1> em campo
    const cmdId = place(state, "A", ST03_CARD_DEFS.CLOSE_COMBAT, "hand");
    const ginnId = place(state, "B", ST04_CARD_DEFS.MIGUELS_GINN, "battleArea");
    const ginnPilot = place(state, "B", ST04_CARD_DEFS.KIRA_YAMATO, "battleArea");
    pair(state, ginnId, ginnPilot);
    const strikeId = place(state, "B", ST04_CARD_DEFS.STRIKE_GUNDAM, "battleArea");
    const kira2 = place(state, "B", ST04_CARD_DEFS.KIRA_YAMATO, "battleArea");
    pair(state, strikeId, kira2);

    const shieldsBefore = state.players.B.shields.length;
    const handBefore = state.players.B.hand.length;
    const next = apply(state, "A", { kind: "playCommand", cardInstanceId: cmdId, trigger: "Main", targets: { target: [ginnId] } });

    expect(next.players.B.trash.some((c) => c.instanceId === ginnId)).toBe(true);
    expect(next.players.B.hand.length).toBe(handBefore + 1); // 【Destroyed】 disparou
    expect(next.players.B.shields.length).toBe(shieldsBefore); // <Breach> NÃO
  });
});

describe("Rewloola 【Deploy】 — dano de efeito mata Unit HP1, hook roda e respeita o gate", () => {
  it("mata Miguel's Ginn NÃO pareada (HP1) -> Unit vai pro trash, 【During Pair】 gate bloqueia a compra", () => {
    const state = freshMatch();
    giveResources(state, "A", 3);
    const baseId = place(state, "A", ST03_CARD_DEFS.REWLOOLA, "hand");
    const ginnId = place(state, "B", ST04_CARD_DEFS.MIGUELS_GINN, "battleArea"); // HP1, sem par
    const strikeId = place(state, "B", ST04_CARD_DEFS.STRIKE_GUNDAM, "battleArea");
    const kiraId = place(state, "B", ST04_CARD_DEFS.KIRA_YAMATO, "battleArea");
    pair(state, strikeId, kiraId);

    const handBefore = state.players.B.hand.length;
    const next = apply(state, "A", { kind: "deployCard", cardInstanceId: baseId, targets: { target: [ginnId] } });

    expect(next.players.B.trash.some((c) => c.instanceId === ginnId)).toBe(true);
    expect(next.players.B.hand.length).toBe(handBefore); // wasPaired = false -> 【During Pair】 não passa
    expect(next.pendingDecision.A).toBeNull();
  });
});

describe("docs/45 — 2 pausas 【Destroyed】 cross-player no mesmo evento (fila FIFO)", () => {
  it("Char's Zaku Ⅱ de cada lado -> a do jogador ativo pausa, a do oponente fica em queuedDestroyed", () => {
    const state = freshMatch(); // A = jogador ativo
    const zakuA = place(state, "A", ST03_CARD_DEFS.CHARS_ZAKU_II, "battleArea");
    const zakuB = place(state, "B", ST03_CARD_DEFS.CHARS_ZAKU_II, "battleArea");

    const next = dispatchDestroyedTriggers(
      state,
      [
        { instanceId: zakuA, owner: "A", wasPaired: false },
        { instanceId: zakuB, owner: "B", wasPaired: false },
      ],
      SPECS,
      { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver },
    );

    const d = next.pendingDecision.A;
    if (d?.kind !== "abilityResolution") throw new Error("esperava abilityResolution pra A");
    expect(next.pendingDecision.B).toBeNull();
    expect(d.queuedDestroyed?.owner).toBe("B");
    expect(d.queuedDestroyed?.sources.map((s) => s.instanceId)).toEqual([zakuB]);
  });

  it("ao resolver a do ativo, a do oponente entra em cena (sem deadlock)", () => {
    const state = freshMatch();
    const zakuA = place(state, "A", ST03_CARD_DEFS.CHARS_ZAKU_II, "battleArea");
    const zakuB = place(state, "B", ST03_CARD_DEFS.CHARS_ZAKU_II, "battleArea");
    const paused = dispatchDestroyedTriggers(
      state,
      [
        { instanceId: zakuA, owner: "A", wasPaired: false },
        { instanceId: zakuB, owner: "B", wasPaired: false },
      ],
      SPECS,
      { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver },
    );

    const next = apply(paused, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: "ST03-006-Destroyed", activate: false, targetIds: [] }],
    });

    expect(next.pendingDecision.A).toBeNull();
    const d = next.pendingDecision.B;
    if (d?.kind !== "abilityResolution") throw new Error("esperava abilityResolution pra B após resolver a de A");
    expect(d.trigger).toBe("Destroyed");
  });
});
