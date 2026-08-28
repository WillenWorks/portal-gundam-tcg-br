import type { CardInstance, GameEvent, GameState } from "./types";
import { otherPlayer } from "./types";
import { applyEvent, applyEvents } from "./events";
import { computeRepairEvents } from "./keywords";

/**
 * As 5 fases oficiais de turno (Comprehensive Rules seção 7, ver docs/18
 * "Estrutura de turno"). Cada `compute*Events` é puro (só lê o estado e
 * devolve os eventos a aplicar); cada `run*` aplica e devolve o novo
 * estado — separado assim pra dar pra inspecionar/testar os eventos sem
 * precisar aplicar.
 */

export function computeStartPhaseEvents(state: GameState): GameEvent[] {
  const events: GameEvent[] = [{ type: "PHASE_CHANGE", phase: "start" }];
  const player = state.players[state.activePlayer];
  for (const zone of ["battleArea", "baseSection", "resourceArea"] as const) {
    for (const card of player[zone]) {
      if (card.rested) events.push({ type: "SET_ACTIVE", instanceId: card.instanceId });
    }
  }
  return events;
}

export function runStartPhase(state: GameState): GameState {
  return applyEvents(state, computeStartPhaseEvents(state));
}

export function computeDrawPhaseEvents(state: GameState): GameEvent[] {
  const player = state.players[state.activePlayer];
  const events: GameEvent[] = [{ type: "PHASE_CHANGE", phase: "draw" }];
  if (player.deck.length === 0) {
    // Comprehensive Rules 1-2-2-2: perde quem precisa comprar sem carta no deck
    events.push({ type: "GAME_OVER", winner: otherPlayer(state.activePlayer), reason: "deckOut" });
    return events;
  }
  events.push({
    type: "DRAW_CARD",
    player: state.activePlayer,
    from: "deck",
    instanceId: player.deck[0].instanceId,
  });
  return events;
}

export function runDrawPhase(state: GameState): GameState {
  return applyEvents(state, computeDrawPhaseEvents(state));
}

export function computeResourcePhaseEvents(state: GameState): GameEvent[] {
  const player = state.players[state.activePlayer];
  const events: GameEvent[] = [{ type: "PHASE_CHANGE", phase: "resource" }];
  // resource deck vazio não é condição de derrota (só o deck principal é) — só não compra nada
  if (player.resourceDeck.length > 0) {
    events.push({
      type: "DRAW_CARD",
      player: state.activePlayer,
      from: "resourceDeck",
      instanceId: player.resourceDeck[0].instanceId,
    });
  }
  return events;
}

export function runResourcePhase(state: GameState): GameState {
  return applyEvents(state, computeResourcePhaseEvents(state));
}

export function enterMainPhase(state: GameState): GameState {
  return applyEvent(state, { type: "PHASE_CHANGE", phase: "main" });
}

export type DiscardChoiceFn = (hand: CardInstance[], excess: number) => string[];

const defaultDiscardChoice: DiscardChoiceFn = (hand, excess) =>
  hand.slice(hand.length - excess).map((c) => c.instanceId);

export function computeEndPhaseEvents(state: GameState, chooseDiscard: DiscardChoiceFn = defaultDiscardChoice): GameEvent[] {
  const events: GameEvent[] = [{ type: "PHASE_CHANGE", phase: "end" }];
  // <Repair N>: cura no fim do turno de quem controla a carta (docs/18, tabela de keywords)
  events.push(...computeRepairEvents(state, state.activePlayer));
  const player = state.players[state.activePlayer];
  const HAND_LIMIT = 10;
  if (player.hand.length > HAND_LIMIT) {
    const excess = player.hand.length - HAND_LIMIT;
    const chosen = chooseDiscard(player.hand, excess).slice(0, excess);
    events.push({ type: "DISCARD_TO_HAND_LIMIT", player: state.activePlayer, instanceIds: chosen });
  }
  events.push({ type: "CLEAR_TURN_MODIFIERS", turnNumber: state.turnNumber });
  return events;
}

/** Roda a End Phase (descarte por limite de mão + limpeza de modificadores "endOfTurn") sem trocar de turno ainda. */
export function runEndPhase(state: GameState, chooseDiscard?: DiscardChoiceFn): GameState {
  return applyEvents(state, computeEndPhaseEvents(state, chooseDiscard));
}

/** Troca de turno: incrementa `turnNumber`, alterna `activePlayer`. Chamar depois de `runEndPhase`. */
export function runTurnChange(state: GameState): GameState {
  return applyEvent(state, {
    type: "TURN_CHANGE",
    turnNumber: state.turnNumber + 1,
    activePlayer: otherPlayer(state.activePlayer),
  });
}

/**
 * Roda Start → Draw → Resource → entra na Main Phase (que exige decisão do
 * jogador, então o motor para aí e devolve controle pra quem chama).
 * Para no meio se `GAME_OVER` disparar (deck-out na Draw Phase).
 */
export function advanceToMainPhase(state: GameState): GameState {
  let next = runStartPhase(state);
  next = runDrawPhase(next);
  if (next.gameOver) return next;
  next = runResourcePhase(next);
  next = enterMainPhase(next);
  return next;
}

/** Fecha o turno atual (End Phase + troca de turno) e já avança o próximo jogador até a Main Phase dele. */
export function finishTurnAndAdvance(state: GameState, chooseDiscard?: DiscardChoiceFn): GameState {
  let next = runEndPhase(state, chooseDiscard);
  next = runTurnChange(next);
  return advanceToMainPhase(next);
}
