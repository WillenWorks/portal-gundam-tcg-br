import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { collectDestroyedInBattle } from "./abilityDispatch";
import { findCard } from "./events";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { buildSt04DeckList, ST04_CARD_DEFS } from "../fixtures/st04Deck";
import { ST03_CARD_DEFS } from "../fixtures/st03Deck";
import { VANILLA_CARD_DEFS } from "../fixtures/vanillaDeck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

/**
 * docs/44 — wiring do gatilho 【Destroyed】 no motor de combate. `actions.ts`
 * chama `collectDestroyedInBattle` + `dispatchDestroyedTriggers` depois do
 * Damage Step:
 * - ST04-009 Miguel's Ginn (【During Pair】【Destroyed】, `condition` + `draw`) —
 *   não pausa: compra 1 inline SE estava pareada E tem outra Link Unit.
 * - ST03-006 Char's Zaku Ⅱ (【Destroyed】 `lookAtTopFilterReveal`, `optional`) —
 *   PAUSA em `abilityResolution` com `deckTopReveal`, resolvida antes do Battle
 *   End Step.
 */

const SPECS = ALL_EFFECT_SPECS;

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-dtfx-${seq++}`;
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
  // A (ST04) é o jogador ativo/atacante; B só segura o tabuleiro.
  return advanceToMainPhase(createGame(buildSt04DeckList(), buildSt04DeckList(), { seed: 7, firstPlayer: "A" }));
}

/**
 * A ataca a Unit rested `defenderId` de B com `attackerId`. Passa Block e os dois
 * lados do Action Step; o 2º `passAction` (do atacante A) dispara o Damage Step.
 */
function runCombat(state: GameState, attackerId: string, defenderId: string): GameState {
  let next = apply(state, "A", { kind: "declareAttack", attackerId, target: { unitId: defenderId } });
  next = apply(next, "B", { kind: "skipBlock" });
  next = apply(next, "B", { kind: "passAction" });
  next = apply(next, "A", { kind: "passAction" });
  return next;
}

describe("collectDestroyedInBattle", () => {
  it("lista só as Units que foram pro trash neste passo, com o flag wasPaired de ANTES", () => {
    const before = freshMatch();
    const paired = place(before, "A", ST04_CARD_DEFS.MIGUELS_GINN, "battleArea");
    const pilot = place(before, "A", ST04_CARD_DEFS.KIRA_YAMATO, "battleArea");
    pair(before, paired, pilot);
    const lone = place(before, "B", ST04_CARD_DEFS.GINN, "battleArea");
    const survivor = place(before, "B", VANILLA_CARD_DEFS.HEAVY_01, "battleArea");

    // simula o resultado do Damage Step: as duas primeiras Units pro trash
    const after: GameState = JSON.parse(JSON.stringify(before));
    for (const id of [paired, lone]) {
      const p = id.startsWith("A") ? after.players.A : after.players.B;
      const idx = p.battleArea.findIndex((c) => c.instanceId === id);
      const [card] = p.battleArea.splice(idx, 1);
      card.pairedPilotId = undefined;
      p.trash.push(card);
    }

    const destroyed = collectDestroyedInBattle(before, after);
    expect(destroyed.map((d) => d.instanceId).sort()).toEqual([paired, lone].sort());
    expect(destroyed.find((d) => d.instanceId === paired)?.wasPaired).toBe(true);
    expect(destroyed.find((d) => d.instanceId === lone)?.wasPaired).toBe(false);
    expect(destroyed.some((d) => d.instanceId === survivor)).toBe(false);
  });
});

describe("ST04-009 Miguel's Ginn — 【During Pair】【Destroyed】 no motor de combate", () => {
  it("pareada + outra Link Unit em campo -> morre em batalha -> controlador compra 1", () => {
    const state = freshMatch();
    // Miguel's Ginn pareada (wasPaired = true)
    const ginnId = place(state, "A", ST04_CARD_DEFS.MIGUELS_GINN, "battleArea");
    const ginnPilotId = place(state, "A", ST04_CARD_DEFS.ATHRUN_ZALA, "battleArea");
    pair(state, ginnId, ginnPilotId);
    // outra Link Unit: Strike Gundam (link [Kira Yamato]) pareada com Kira
    const strikeId = place(state, "A", ST04_CARD_DEFS.STRIKE_GUNDAM, "battleArea");
    const kiraId = place(state, "A", ST04_CARD_DEFS.KIRA_YAMATO, "battleArea");
    pair(state, strikeId, kiraId);
    // defensor forte e rested: mata Miguel's Ginn (HP1) e sobrevive aos 3 de AP
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.HEAVY_01, "battleArea", { rested: true });

    const handBefore = state.players.A.hand.length;
    const next = runCombat(state, ginnId, defenderId);

    expect(next.players.A.trash.some((c) => c.instanceId === ginnId)).toBe(true);
    expect(next.players.A.hand.length).toBe(handBefore + 1);
    expect(next.pendingDecision.A).toBeNull();
    expect(next.pendingDecision.B).toBeNull();
    expect(next.combat).toBeNull(); // Battle End rodou
  });

  it("NÃO pareada -> morre -> não compra (gate 【During Pair】)", () => {
    const state = freshMatch();
    const ginnId = place(state, "A", ST04_CARD_DEFS.MIGUELS_GINN, "battleArea"); // sem pairedPilotId
    const strikeId = place(state, "A", ST04_CARD_DEFS.STRIKE_GUNDAM, "battleArea");
    const kiraId = place(state, "A", ST04_CARD_DEFS.KIRA_YAMATO, "battleArea");
    pair(state, strikeId, kiraId);
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.HEAVY_01, "battleArea", { rested: true });

    const handBefore = state.players.A.hand.length;
    const next = runCombat(state, ginnId, defenderId);

    expect(next.players.A.trash.some((c) => c.instanceId === ginnId)).toBe(true);
    expect(next.players.A.hand.length).toBe(handBefore);
    expect(next.combat).toBeNull();
  });

  it("pareada mas SEM outra Link Unit -> morre -> não compra (condition falsa)", () => {
    const state = freshMatch();
    const ginnId = place(state, "A", ST04_CARD_DEFS.MIGUELS_GINN, "battleArea");
    const ginnPilotId = place(state, "A", ST04_CARD_DEFS.ATHRUN_ZALA, "battleArea");
    pair(state, ginnId, ginnPilotId);
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.HEAVY_01, "battleArea", { rested: true });

    const handBefore = state.players.A.hand.length;
    const next = runCombat(state, ginnId, defenderId);

    expect(next.players.A.hand.length).toBe(handBefore);
    expect(next.combat).toBeNull();
  });
});

describe("ST03-006 Char's Zaku Ⅱ — 【Destroyed】 no motor de combate (pausa)", () => {
  /** força o topo 3 do deck: Zaku I (Zeon Unit), Ginn (ZAFT/red), Dra-C (Neo Zeon Unit). */
  function forceTop(state: GameState, player: PlayerId = "A"): { zakuIId: string; ginnId: string; draCId: string } {
    const zakuIId = place(state, player, ST03_CARD_DEFS.ZAKU_I, "deck");
    const ginnId = place(state, player, ST04_CARD_DEFS.GINN, "deck");
    const draCId = place(state, player, ST03_CARD_DEFS.DRA_C, "deck");
    const three = state.players[player].deck.splice(-3, 3);
    state.players[player].deck.unshift(...three);
    return { zakuIId, ginnId, draCId };
  }

  it("Char's Zaku Ⅱ morre em batalha -> pendingDecision de A vira abilityResolution com deckTopReveal", () => {
    const state = freshMatch();
    const zakuId = place(state, "A", ST03_CARD_DEFS.CHARS_ZAKU_II, "battleArea"); // AP3 HP2
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.HEAVY_01, "battleArea", { rested: true }); // AP5 -> mata
    const { zakuIId, ginnId, draCId } = forceTop(state);

    const next = runCombat(state, zakuId, defenderId);

    const d = next.pendingDecision.A;
    if (d?.kind !== "abilityResolution") throw new Error("esperava abilityResolution pendente pra A");
    expect(d.trigger).toBe("Destroyed");
    const q = d.queue.find((x) => x.specId === "ST03-006-Destroyed");
    expect(q?.deckTopReveal?.count).toBe(3);
    expect(q?.deckTopReveal?.topCards.map((c) => c.instanceId)).toEqual([zakuIId, ginnId, draCId]);
    expect(q?.deckTopReveal?.revealableIds.slice().sort()).toEqual([zakuIId, draCId].slice().sort());
    // combate segue parado no Damage Step até A resolver
    expect(next.combat?.step).toBe("damage");
    expect(next.players.A.trash.some((c) => c.instanceId === zakuId)).toBe(true);
  });

  it("resolver revelando a Unit Zeon -> vai pra mão; combate fecha", () => {
    const state = freshMatch();
    const zakuId = place(state, "A", ST03_CARD_DEFS.CHARS_ZAKU_II, "battleArea");
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.HEAVY_01, "battleArea", { rested: true });
    const { zakuIId } = forceTop(state);
    const paused = runCombat(state, zakuId, defenderId);

    const next = apply(paused, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: "ST03-006-Destroyed", activate: true, targetIds: [zakuIId] }],
    });

    expect(next.pendingDecision.A).toBeNull();
    expect(next.players.A.hand.some((c) => c.instanceId === zakuIId)).toBe(true);
    expect(next.combat).toBeNull();
  });

  it("AFK / declinar (default action) -> as 3 vão pro fundo, nada pra mão, combate fecha", () => {
    const state = freshMatch();
    const zakuId = place(state, "A", ST03_CARD_DEFS.CHARS_ZAKU_II, "battleArea");
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.HEAVY_01, "battleArea", { rested: true });
    const { zakuIId, ginnId, draCId } = forceTop(state);
    const handBefore = state.players.A.hand.length;
    const paused = runCombat(state, zakuId, defenderId);

    // mesma ação-padrão que `matchStore.defaultActionFor` aplica no timeout
    const next = apply(paused, "A", {
      kind: "resolveAbility",
      resolutions: [{ specId: "ST03-006-Destroyed", activate: false, targetIds: [] }],
    });

    expect(next.pendingDecision.A).toBeNull();
    expect(next.players.A.hand.length).toBe(handBefore);
    expect(
      next.players.A.deck
        .slice(-3)
        .map((c) => c.instanceId)
        .sort(),
    ).toEqual([zakuIId, ginnId, draCId].sort());
    expect(next.combat).toBeNull();
  });

  it("Breach quebra shield COM 【Burst】 no mesmo step: 【Burst】 resolve primeiro, 【Destroyed】 depois, antes do Battle End", () => {
    const state = freshMatch();
    // atacante com <Breach> e HP alto (sobrevive ao contra-ataque de AP3)
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.BREACH_01, "battleArea", {
      statModifiers: [{ stat: "hp", amount: 5, duration: "endOfTurn", appliedOnTurn: state.turnNumber }],
    });
    // defensor de B: Char's Zaku Ⅱ rested (morre pros 3 de Breach) -> 【Destroyed】 de B
    const zakuId = place(state, "B", ST03_CARD_DEFS.CHARS_ZAKU_II, "battleArea", { rested: true });
    // 1 único shield de B, com 【Burst】 real (Full Frontal)
    state.players.B.shields = [];
    place(state, "B", ST03_CARD_DEFS.FULL_FRONTAL, "shields");
    const { zakuIId } = forceTop(state, "B"); // o 【Destroyed】 revela do deck de B (dono da Char's Zaku Ⅱ)

    // combate direto contra a Unit rested; Breach quebra o shield ao matá-la
    let next = apply(state, "A", { kind: "declareAttack", attackerId, target: { unitId: zakuId } });
    next = apply(next, "B", { kind: "skipBlock" });
    next = apply(next, "B", { kind: "passAction" });
    next = apply(next, "A", { kind: "passAction" });

    // 1ª pausa: 【Burst】 do shield quebrado por Breach
    expect(next.pendingDecision.B?.kind).toBe("burst");
    expect(next.combat?.step).toBe("damage");

    // recusa o Burst -> agora dispara o 【Destroyed】 de Char's Zaku Ⅱ (mesmo step)
    next = apply(next, "B", { kind: "resolveBurstDecision", activate: false });
    const d = next.pendingDecision.B;
    if (d?.kind !== "abilityResolution") throw new Error("esperava abilityResolution (【Destroyed】) pra B após o Burst");
    expect(d.trigger).toBe("Destroyed");
    expect(next.combat?.step).toBe("damage"); // ainda não fechou

    // resolve o 【Destroyed】 -> combate fecha
    next = apply(next, "B", {
      kind: "resolveAbility",
      resolutions: [{ specId: "ST03-006-Destroyed", activate: true, targetIds: [zakuIId] }],
    });
    expect(next.pendingDecision.B).toBeNull();
    expect(next.players.B.hand.some((c) => c.instanceId === zakuIId)).toBe(true);
    expect(next.combat).toBeNull();
  });

  it("enquanto a decisão de 【Destroyed】 está pendente, o oponente não joga nada", () => {
    const state = freshMatch();
    const zakuId = place(state, "A", ST03_CARD_DEFS.CHARS_ZAKU_II, "battleArea");
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.HEAVY_01, "battleArea", { rested: true });
    forceTop(state);
    const paused = runCombat(state, zakuId, defenderId);

    expect(() => apply(paused, "B", { kind: "finishTurn" })).toThrow(/Aguardando o oponente/);
  });
});
