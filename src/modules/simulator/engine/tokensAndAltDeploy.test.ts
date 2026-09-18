import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { applyEvents, findCard } from "./events";
import { deployCard } from "./deploy";
import type { CardDef } from "./types";

describe("Mecânicas Avançadas: Tokens e Custo Alternativo de Deploy", () => {
  it("Tokens que saem de campo (para hand, deck ou trash) são automaticamente expurgados para exile", () => {
    const deck = buildSt01DeckList();
    let state = createGame(deck, deck, { firstPlayer: "A", seed: 42 });

    // Instancia um Token Unit na Battle Area de A
    const tokenDef: CardDef = {
      code: "T-TEST-001",
      nameEn: "Test Mobile Suit Token",
      cardType: "UNIT",
      color: "blue",
      cost: 1,
      level: 1,
      ap: 2,
      hp: 2,
      isToken: true,
    };

    state = applyEvents(state, [
      {
        type: "SPAWN_TOKEN",
        def: tokenDef,
        player: "A",
        zone: "battleArea",
      },
    ]);

    const spawned = state.players.A.battleArea.find((c) => c.def.code === "T-TEST-001");
    expect(spawned).toBeDefined();
    expect(spawned!.zone).toBe("battleArea");

    const tokenId = spawned!.instanceId;

    // 1. Tentar mover o token para a mão (ex.: efeito de bounce)
    state = applyEvents(state, [
      {
        type: "MOVE_CARD",
        instanceId: tokenId,
        toZone: "hand",
      },
    ]);

    // Regra oficial: o token deve ir para exile e NÃO para hand
    const afterBounce = findCard(state, tokenId);
    expect(afterBounce.zone).toBe("exile");
    expect(state.players.A.hand.some((c) => c.instanceId === tokenId)).toBe(false);
    expect(state.players.A.exile.some((c) => c.instanceId === tokenId)).toBe(true);
  });

  it("Destruir um token envia-o para exile e não para o trash", () => {
    const deck = buildSt01DeckList();
    let state = createGame(deck, deck, { firstPlayer: "A", seed: 42 });

    const tokenDef: CardDef = {
      code: "T-TEST-002",
      nameEn: "Target Dummy Token",
      cardType: "UNIT",
      color: "green",
      cost: 1,
      level: 1,
      ap: 1,
      hp: 1,
      isToken: true,
    };

    state = applyEvents(state, [
      {
        type: "SPAWN_TOKEN",
        def: tokenDef,
        player: "A",
        zone: "battleArea",
      },
    ]);

    const spawned = state.players.A.battleArea.find((c) => c.def.code === "T-TEST-002");
    expect(spawned).toBeDefined();
    const tokenId = spawned!.instanceId;

    state = applyEvents(state, [
      {
        type: "DESTROY_CARD",
        instanceId: tokenId,
      },
    ]);

    const destroyed = findCard(state, tokenId);
    expect(destroyed.zone).toBe("exile");
    expect(state.players.A.trash.some((c) => c.instanceId === tokenId)).toBe(false);
    expect(state.players.A.exile.some((c) => c.instanceId === tokenId)).toBe(true);
  });

  it("Custo Alternativo de Deploy por descarte da mão funciona sem exigir custo ou nível de recursos", () => {
    const deck = buildSt01DeckList();
    let state = createGame(deck, deck, { firstPlayer: "A", seed: 42 });

    state.phase = "main";
    state.activePlayer = "A";

    const altDiscardUnitDef: CardDef = {
      code: "GD03-TEST-DISCARD",
      nameEn: "Special Infiltration Gundam",
      cardType: "UNIT",
      color: "blue",
      cost: 5,
      level: 5,
      ap: 5,
      hp: 4,
      alternateDeploy: {
        kind: "discard",
        discardCount: 2,
      },
    };

    // Coloca a carta e 2 descartes na mão
    const targetId = "UNIT-DISC-01";
    const discard1 = "DISC-CARD-01";
    const discard2 = "DISC-CARD-02";

    state.players.A.hand.push(
      {
        instanceId: targetId,
        def: altDiscardUnitDef,
        owner: "A",
        zone: "hand",
        damage: 0,
        rested: false,
        statModifiers: [],
        keywordGrants: [],
        usedKeywordsThisTurn: [],
        enteredZoneOnTurn: 1,
      },
      {
        instanceId: discard1,
        def: deck.main[0],
        owner: "A",
        zone: "hand",
        damage: 0,
        rested: false,
        statModifiers: [],
        keywordGrants: [],
        usedKeywordsThisTurn: [],
        enteredZoneOnTurn: 1,
      },
      {
        instanceId: discard2,
        def: deck.main[1],
        owner: "A",
        zone: "hand",
        damage: 0,
        rested: false,
        statModifiers: [],
        keywordGrants: [],
        usedKeywordsThisTurn: [],
        enteredZoneOnTurn: 1,
      },
    );

    // Esvazia os recursos de A para garantir que ele NÃO tem nível nem custo
    state.players.A.resourceArea = [];

    // Executa deploy com discardInstanceIds
    state = deployCard(state, "A", targetId, {
      discardInstanceIds: [discard1, discard2],
    });

    // A carta entrou na Battle Area
    const deployed = findCard(state, targetId);
    expect(deployed.zone).toBe("battleArea");
    // As cartas descartadas foram para o trash
    expect(findCard(state, discard1).zone).toBe("trash");
    expect(findCard(state, discard2).zone).toBe("trash");
  });
});
