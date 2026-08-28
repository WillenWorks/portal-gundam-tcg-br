import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildVanillaDeckList } from "../fixtures/vanillaDeck";
import { applyEvents } from "./events";
import { resolveEffectSpec, type EffectContext, type EffectSpec } from "./effectSpec";

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
