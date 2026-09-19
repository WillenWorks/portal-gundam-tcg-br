import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { viewStateFor, viewStatesForBothPlayers, type ViewCardInstance } from "./viewState";

/**
 * A garantia mais importante desta wave (decisão do Willen: testar com 2
 * abas reais, "na tela do oponente não terá essa informação"): `def` (a
 * identidade da carta) nunca aparece em `viewStateFor` pra uma zona oculta
 * que não seja a própria mão do viewer — nem serializado como JSON e
 * inspecionado.
 */

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone): string {
  const instanceId = `${player}-viewfx-${seq++}`;
  const card: CardInstance = {
    instanceId,
    def,
    owner: player,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber,
  };
  state.players[player][zone].push(card);
  return instanceId;
}

function isHidden(card: ViewCardInstance): card is Extract<ViewCardInstance, { hidden: true }> {
  return "hidden" in card && card.hidden === true;
}

function freshGame(): GameState {
  return createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 7, firstPlayer: "A" });
}

describe("viewStateFor", () => {
  it("mostra a própria mão inteira (com def) e esconde a mão do adversário", () => {
    const state = freshGame();
    const ownCardId = place(state, "A", ST01_CARD_DEFS.GUNDAM, "hand");
    const enemyCardId = place(state, "B", ST01_CARD_DEFS.GUNDAM, "hand");

    const viewA = viewStateFor(state, "A");
    const ownCard = viewA.players.A.hand.find((c) => c.instanceId === ownCardId)!;
    expect(isHidden(ownCard)).toBe(false);
    expect((ownCard as CardInstance).def.code).toBe("ST01-001");

    const enemyCard = viewA.players.B.hand.find((c) => c.instanceId === enemyCardId)!;
    expect(isHidden(enemyCard)).toBe(true);
    expect(Object.keys(enemyCard)).not.toContain("def");
  });

  it("esconde deck/resourceDeck/shields dos dois jogadores, mesmo do próprio dono", () => {
    const state = freshGame();
    const viewA = viewStateFor(state, "A");
    const viewB = viewStateFor(state, "B");

    for (const zone of ["deck", "resourceDeck", "shields"] as const) {
      for (const card of viewA.players.A[zone]) expect(isHidden(card)).toBe(true);
      for (const card of viewA.players.B[zone]) expect(isHidden(card)).toBe(true);
      for (const card of viewB.players.A[zone]) expect(isHidden(card)).toBe(true);
      for (const card of viewB.players.B[zone]) expect(isHidden(card)).toBe(true);
    }
  });

  it("nenhuma carta oculta carrega `def` — checagem via JSON, não só via tipo", () => {
    const state = freshGame();
    place(state, "B", ST01_CARD_DEFS.AMURO_RAY, "hand"); // pilot com traits/keywords — bom candidato a vazar se o bug existir

    const viewA = viewStateFor(state, "A");
    const serialized = JSON.stringify(viewA);
    expect(serialized).not.toContain("Amuro Ray");
    expect(serialized).not.toContain("ST01-010");
  });

  it("battleArea/baseSection/resourceArea/trash são sempre públicas, dos dois lados", () => {
    const state = freshGame();
    const unitId = place(state, "B", ST01_CARD_DEFS.GUNCANNON, "battleArea");

    const viewA = viewStateFor(state, "A");
    const card = viewA.players.B.battleArea.find((c) => c.instanceId === unitId)!;
    expect(isHidden(card)).toBe(false);
    expect((card as CardInstance).def.code).toBe("ST01-003");
  });

  it("counts batem com o tamanho real da zona, mesmo quando o conteúdo está oculto", () => {
    const state = freshGame();
    const viewA = viewStateFor(state, "A");
    expect(viewA.players.A.counts.deck).toBe(state.players.A.deck.length);
    expect(viewA.players.B.counts.shields).toBe(state.players.B.shields.length);
  });

  it("viewStatesForBothPlayers devolve as 2 visões, cada uma marcada com `viewer` certo", () => {
    const state = freshGame();
    const both = viewStatesForBothPlayers(state);
    expect(both.A.viewer).toBe("A");
    expect(both.B.viewer).toBe("B");
  });

  it("handDiscard: popula cards para o dono da decisão (inclusive carta do deck a ser comprada) e redige a [] para o adversário", () => {
    const state = freshGame();
    const handCardId = place(state, "A", ST01_CARD_DEFS.GUNDAM, "hand");
    const deckCardId = state.players.A.deck[0].instanceId;
    const deckCardDefName = state.players.A.deck[0].def.nameEn;

    state.pendingDecision.A = {
      kind: "abilityResolution",
      trigger: "Deploy",
      queue: [
        {
          specId: "test-discard",
          sourceInstanceId: "dummy",
          label: "Draw 1. Then, discard 1.",
          optional: false,
          needsTarget: false,
          targetScope: "friendlyUnit",
          legalTargets: [],
          targetCount: { min: 1, max: 1 },
          handDiscard: {
            n: 1,
            legalHandIds: [handCardId, deckCardId],
            label: "Draw 1. Then, discard 1.",
          },
        },
      ],
    };

    const viewA = viewStateFor(state, "A");
    const viewB = viewStateFor(state, "B");

    const decisionA = viewA.pendingDecision.A;
    expect(decisionA?.kind).toBe("abilityResolution");
    expect(decisionA?.kind === "abilityResolution" && decisionA.queue[0].handDiscard?.cards).toHaveLength(2);
    expect(decisionA?.kind === "abilityResolution" && decisionA.queue[0].handDiscard?.cards?.[0].def.nameEn).toBe("Gundam");
    expect(decisionA?.kind === "abilityResolution" && decisionA.queue[0].handDiscard?.cards?.[1].def.nameEn).toBe(deckCardDefName);

    const decisionB = viewB.pendingDecision.A;
    expect(decisionB?.kind).toBe("abilityResolution");
    expect(decisionB?.kind === "abilityResolution" && decisionB.queue[0].handDiscard?.cards).toHaveLength(0);
  });
});

