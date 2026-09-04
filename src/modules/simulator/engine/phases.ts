import type { CardInstance, GameEvent, GameState, PlayerId } from "./types";
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

// ---------------------------------------------------------------------------
// End Phase — Action Step (Comprehensive Rules 7-6: a End Phase tem 4 passos,
// nesta ordem — action step, end step, hand step, cleanup step). O Action
// Step funciona igual ao Action Step de combate (combat.ts): prioridade
// alternada, começando pelo jogador em espera, até os dois passarem em
// sequência — só então End Step (Repair)/Hand Step (descarte)/Cleanup Step
// (limpa modificadores) rodam. Foi o motor pular direto pra esses 3 últimos
// passos, sem passar pelo Action Step, que causava o bug reportado em teste
// (jogador não tinha chance de ativar Command 【Action】/【Activate·Action】 ao
// encerrar o turno, diferente do Action Step de uma batalha).
// ---------------------------------------------------------------------------

/** Entra no Action Step da End Phase — chamado quando o jogador ativo decide encerrar o turno (`finishTurn`). Prioridade começa pelo jogador em espera, igual ao Action Step de combate. */
export function beginEndPhaseActionStep(state: GameState): GameState {
  const standbyPlayer = otherPlayer(state.activePlayer);
  return applyEvents(state, [
    { type: "PHASE_CHANGE", phase: "end" },
    { type: "BEGIN_END_PHASE_ACTION_STEP", priority: standbyPlayer },
  ]);
}

/** `player` passa a vez no Action Step da End Phase. Quando os dois passam em sequência, o Action Step é encerrado (`state.endPhaseAction` volta a `null`) — quem chama decide se já continua pra `finishEndPhaseAndAdvance`. */
export function passEndPhaseAction(state: GameState, player: PlayerId): GameState {
  const endPhaseAction = state.endPhaseAction;
  if (!endPhaseAction) throw new Error("Não há Action Step de fim de turno em andamento");
  if (endPhaseAction.priority !== player) throw new Error("Não é a prioridade desse jogador no Action Step de fim de turno");

  let next = applyEvent(state, { type: "END_PHASE_ACTION_PASS", player });
  const bothPassed = next.endPhaseAction!.passes.A && next.endPhaseAction!.passes.B;
  if (bothPassed) {
    next = applyEvent(next, { type: "END_END_PHASE_ACTION_STEP" });
  }
  return next;
}

/** Chamar depois que os dois já passaram no Action Step da End Phase (`state.endPhaseAction === null`): End Step (Repair) + Hand Step (descarte) + Cleanup Step, troca de turno, avança até a Main Phase do próximo jogador. */
export function finishEndPhaseAndAdvance(state: GameState, chooseDiscard?: DiscardChoiceFn): GameState {
  let next = runEndPhase(state, chooseDiscard);
  next = runTurnChange(next);
  return advanceToMainPhase(next);
}

/**
 * Atalho de teste/script: encerra o turno atual de ponta a ponta, incluindo
 * o Action Step da End Phase (os dois jogadores passam automaticamente, sem
 * jogar nada) — equivalente ao caminho real de uma partida em que nenhum
 * dos dois tem Command 【Action】/【Activate·Action】 pra ativar. Fluxo real
 * (servidor/UI) usa `beginEndPhaseActionStep` + `passEndPhaseAction` +
 * `finishEndPhaseAndAdvance` direto, pra dar chance real de decisão.
 */
export function finishTurnAndAdvance(state: GameState, chooseDiscard?: DiscardChoiceFn): GameState {
  const standbyPlayer = otherPlayer(state.activePlayer);
  const activePlayer = state.activePlayer;
  let next = beginEndPhaseActionStep(state);
  next = passEndPhaseAction(next, standbyPlayer);
  if (next.endPhaseAction) {
    next = passEndPhaseAction(next, activePlayer);
  }
  return finishEndPhaseAndAdvance(next, chooseDiscard);
}
