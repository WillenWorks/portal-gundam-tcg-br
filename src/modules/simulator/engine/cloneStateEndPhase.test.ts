import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction } from "./actions";
import type { GameState, PlayerId } from "./types";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver } from "../content";

/**
 * docs/46 §Achados 1 / docs/47 Lane 0A — `cloneState` (events.ts) precisa clonar
 * `endPhaseAction` a fundo (o objeto E o `passes` aninhado). Sem isso, o
 * `applyEvent` de `END_PHASE_ACTION_PASS` mutava `.passes`/`.priority` in place
 * no snapshot recebido, corrompendo qualquer consumidor que especule 2 ações a
 * partir do MESMO estado (busca/MCTS, e a validação por aplicação de teste do
 * `enumerateLegalActions`).
 */

function apply(state: GameState, p: PlayerId, action: Parameters<typeof applyPlayerAction>[2]): GameState {
  return applyPlayerAction(state, p, action, ALL_EFFECT_SPECS, defaultPredicateResolver);
}

describe("cloneState — endPhaseAction não vaza mutação pro snapshot", () => {
  function atEndPhaseActionStep(): GameState {
    const main = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 9, firstPlayer: "A" }));
    // A (ativo) passa o turno -> entra no Action Step da End Phase, prioridade de B.
    return apply(main, "A", { kind: "finishTurn" });
  }

  it("aplicar 2 ações a partir do MESMO snapshot não muta o `endPhaseAction` do snapshot", () => {
    const snapshot = atEndPhaseActionStep();
    expect(snapshot.endPhaseAction).not.toBeNull();
    const passesBefore = { ...snapshot.endPhaseAction!.passes };
    const priorityBefore = snapshot.endPhaseAction!.priority;

    // duas aplicações independentes a partir do mesmo estado
    const a = apply(snapshot, "B", { kind: "passEndPhaseAction" });
    const b = apply(snapshot, "B", { kind: "passEndPhaseAction" });

    // o snapshot original permanece intacto
    expect(snapshot.endPhaseAction!.passes).toEqual(passesBefore);
    expect(snapshot.endPhaseAction!.priority).toBe(priorityBefore);

    // e cada aplicação produziu o mesmo resultado (determinístico)
    expect(a.endPhaseAction?.passes).toEqual(b.endPhaseAction?.passes);
    expect(a.endPhaseAction?.priority).toBe(b.endPhaseAction?.priority);
  });
});
