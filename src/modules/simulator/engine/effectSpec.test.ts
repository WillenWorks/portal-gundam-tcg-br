import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildVanillaDeckList } from "../fixtures/vanillaDeck";
import { applyEvents, findCard } from "./events";
import { compilePrimitive, matchesCardDefFilter, resolveEffectSpec, type EffectContext, type EffectSpec } from "./effectSpec";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";

let fxSeq = 0;
function fxInstance(player: PlayerId, def: CardDef, zone: Zone): CardInstance {
  return {
    instanceId: `${player}-fx-${fxSeq++}`,
    def,
    owner: player,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: 0,
  };
}
function fxCtx(state: GameState, controller: PlayerId, targets: Record<string, string[]> = {}): EffectContext {
  return { state, controller, sourceInstanceId: `${controller}-fx-source`, turnNumber: state.turnNumber, targets };
}

/**
 * Exercita a formalização da Camada 3 (Effect Spec, ver docs/18 e
 * effectSpec.ts) com um exemplo sintético equivalente ao citado no
 * documento: "Deploy: Draw 1 card, then discard 1 card". Nenhum EffectSpec
 * de carta real ainda existe — isso é só a prova de que a tubulação
 * (EffectSpec -> PrimitiveCall -> GameEvent -> GameState) funciona antes de
 * autorar conteúdo carta a carta (passo 3 do plano incremental).
 */
describe("EffectSpec — formalização da Camada 3 (draft, sem carta real ainda)", () => {
  it("compila cost + actions em eventos aplicáveis (draw 1, depois discard 1)", () => {
    const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 11, firstPlayer: "A" });
    const [drawnCard] = state.players.A.deck;

    const spec: EffectSpec = {
      id: "SYNTH-001-Deploy",
      cardCode: "SYNTH-001",
      trigger: "Deploy",
      actions: [
        { op: "draw", player: "controller", n: 1 },
        { op: "discard", player: "controller", instanceIds: [drawnCard.instanceId] },
      ],
      sourceText: "Deploy: Draw 1 card, then discard 1 card.",
    };

    const ctx: EffectContext = {
      state,
      controller: "A",
      sourceInstanceId: "A-fixture-source",
      turnNumber: state.turnNumber,
      targets: {},
    };

    const events = resolveEffectSpec(spec, ctx);
    const next = applyEvents(state, events);

    expect(next.players.A.hand).toHaveLength(5); // comprou 1, descartou a mesma -> tamanho de mão não muda
    expect(next.players.A.trash.some((c) => c.instanceId === drawnCard.instanceId)).toBe(true);
    expect(next.players.A.deck).toHaveLength(state.players.A.deck.length - 1);
  });

  it("resolve condição if/then/else via PredicateResolver", () => {
    const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 12, firstPlayer: "A" });

    const spec: EffectSpec = {
      id: "SYNTH-002-Deploy",
      cardCode: "SYNTH-002",
      trigger: "Deploy",
      condition: {
        predicate: "controllerHasFewerThan6Shields",
        then: [{ op: "damageShield", player: "opponent", count: 1 }],
        else: [{ op: "draw", player: "controller", n: 1 }],
      },
      actions: [],
      sourceText: "Deploy: if [condição sintética], deal damage to a shield. Otherwise, draw 1.",
    };

    const ctx: EffectContext = { state, controller: "A", sourceInstanceId: "A-fixture-source", turnNumber: 1, targets: {} };
    const events = resolveEffectSpec(spec, ctx, () => false); // força o branch "else"
    const next = applyEvents(state, events);

    expect(next.players.A.hand).toHaveLength(6);
    expect(next.players.B.shields).toHaveLength(6); // não mexeu no shield do oponente
  });

  it("lança erro claro se a condição existir sem PredicateResolver", () => {
    const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 13, firstPlayer: "A" });
    const spec: EffectSpec = {
      id: "SYNTH-003-Deploy",
      cardCode: "SYNTH-003",
      trigger: "Deploy",
      condition: { predicate: "x", then: [] },
      actions: [],
      sourceText: "n/a",
    };
    const ctx: EffectContext = { state, controller: "A", sourceInstanceId: "src", turnNumber: 1, targets: {} };
    expect(() => resolveEffectSpec(spec, ctx)).toThrow();
  });
});

describe("matchesCardDefFilter", () => {
  const zaku: CardDef = { code: "X-1", nameEn: "Zaku", cardType: "UNIT", color: "green", level: 3, traits: ["Zeon"] };
  it("casa por cardType, trait e faixa de level", () => {
    expect(matchesCardDefFilter(zaku, { cardType: "UNIT" })).toBe(true);
    expect(matchesCardDefFilter(zaku, { cardType: "PILOT" })).toBe(false);
    expect(matchesCardDefFilter(zaku, { anyTrait: ["Neo Zeon", "Zeon"] })).toBe(true);
    expect(matchesCardDefFilter(zaku, { anyTrait: ["Earth Alliance"] })).toBe(false);
    expect(matchesCardDefFilter(zaku, { maxLevel: 4 })).toBe(true);
    expect(matchesCardDefFilter(zaku, { maxLevel: 2 })).toBe(false);
    expect(matchesCardDefFilter(zaku, { minLevel: 3 })).toBe(true);
  });
});

describe("primitiva lookAtTopFilterReveal (ST03-006, docs/41)", () => {
  const zeonUnit: CardDef = { code: "Z-1", nameEn: "Char's Zaku", cardType: "UNIT", color: "green", level: 3, traits: ["Zeon"] };
  const plainCmd: CardDef = { code: "C-1", nameEn: "Cmd", cardType: "COMMAND", color: "green", level: 2 };

  function stateWithTop(top: CardDef[]): { state: GameState; ids: string[] } {
    const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 3, firstPlayer: "A" });
    const instances = top.map((d) => fxInstance("A", d, "deck"));
    state.players.A.deck = [...instances, ...state.players.A.deck];
    return { state, ids: instances.map((i) => i.instanceId) };
  }

  it("revela a Unit filtrada pro topo -> mão, e manda o resto do topo pro fundo", () => {
    const { state, ids } = stateWithTop([plainCmd, zeonUnit, plainCmd]);
    const deckLenBefore = state.players.A.deck.length;
    const events = compilePrimitive(
      { op: "lookAtTopFilterReveal", player: "controller", count: 3, filter: { cardType: "UNIT", anyTrait: ["Zeon", "Neo Zeon"] } },
      fxCtx(state, "A", { reveal: [ids[1]] }),
    );
    const next = applyEvents(state, events);
    expect(next.players.A.hand.some((c) => c.instanceId === ids[1])).toBe(true);
    expect(next.players.A.deck.slice(0, 3).map((c) => c.instanceId)).not.toContain(ids[0]);
    expect(next.players.A.deck.slice(-2).map((c) => c.instanceId).sort()).toEqual([ids[0], ids[2]].sort());
    expect(next.players.A.deck).toHaveLength(deckLenBefore - 1);
  });

  it("sem escolha (jogador declina) manda as 3 do topo pro fundo, nada pra mão", () => {
    const { state, ids } = stateWithTop([zeonUnit, plainCmd, plainCmd]);
    const handBefore = state.players.A.hand.length;
    const events = compilePrimitive(
      { op: "lookAtTopFilterReveal", player: "controller", count: 3, filter: { cardType: "UNIT" } },
      fxCtx(state, "A", {}),
    );
    const next = applyEvents(state, events);
    expect(next.players.A.hand).toHaveLength(handBefore);
    expect(next.players.A.deck.slice(-3).map((c) => c.instanceId).sort()).toEqual([...ids].sort());
  });

  it("lança se a carta revelada não casa o filtro", () => {
    const { state, ids } = stateWithTop([plainCmd, plainCmd, plainCmd]);
    expect(() =>
      compilePrimitive(
        { op: "lookAtTopFilterReveal", player: "controller", count: 3, filter: { cardType: "UNIT" } },
        fxCtx(state, "A", { reveal: [ids[0]] }),
      ),
    ).toThrow(/não casa o filtro/);
  });
});

describe("primitiva deployFromHandTriggered (ST03-010, docs/41)", () => {
  const lowUnit: CardDef = { code: "U-lo", nameEn: "Geara Zulu", cardType: "UNIT", color: "red", level: 3, cost: 2, ap: 3, hp: 2, traits: ["Neo Zeon"] };
  const highUnit: CardDef = { code: "U-hi", nameEn: "Sinanju", cardType: "UNIT", color: "red", level: 6, cost: 5, ap: 5, hp: 4, traits: ["Neo Zeon"] };

  function stateWithHand(hand: CardDef[]): { state: GameState; ids: string[] } {
    const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 4, firstPlayer: "A" });
    const instances = hand.map((d) => fxInstance("A", d, "hand"));
    state.players.A.hand = [...instances, ...state.players.A.hand];
    return { state, ids: instances.map((i) => i.instanceId) };
  }

  it("move a Unit escolhida da mão pra battleArea, sem custo", () => {
    const { state, ids } = stateWithHand([lowUnit]);
    const events = compilePrimitive(
      { op: "deployFromHandTriggered", player: "controller", filter: { anyTrait: ["Neo Zeon", "Zeon"], maxLevel: 4 } },
      fxCtx(state, "A", { deploy: [ids[0]] }),
    );
    const next = applyEvents(state, events);
    expect(next.players.A.battleArea.some((c) => c.instanceId === ids[0])).toBe(true);
    expect(next.players.A.hand.some((c) => c.instanceId === ids[0])).toBe(false);
  });

  it("no-op quando ninguém escolheu carta", () => {
    const { state } = stateWithHand([lowUnit]);
    expect(compilePrimitive({ op: "deployFromHandTriggered", player: "controller", filter: { maxLevel: 4 } }, fxCtx(state, "A", {}))).toEqual([]);
  });

  it("lança se a Unit escolhida estoura o level do filtro", () => {
    const { state, ids } = stateWithHand([highUnit]);
    expect(() =>
      compilePrimitive(
        { op: "deployFromHandTriggered", player: "controller", filter: { anyTrait: ["Neo Zeon"], maxLevel: 4 } },
        fxCtx(state, "A", { deploy: [ids[0]] }),
      ),
    ).toThrow(/não casa o filtro/);
  });
});
