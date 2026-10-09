import { playerHasActionStepPlay } from "../engine/actions";
import type { EffectSpec } from "../engine/effectSpec";
import type { PlayerId } from "../engine/types";
import type { ViewGameState } from "../engine/viewState";

export type ActionStepPass = { kind: "passAction" } | { kind: "passEndPhaseAction" };

/**
 * Passe que o cliente manda sozinho quando `seat` tem a prioridade de um Action Step (combate ou fim de turno) e
 * NÃO tem nenhuma jogada real (mesma `playerHasActionStepPlay` do auto-pass do servidor). `null` quando não é
 * a vez de `seat` ou quando há jogada (aí a decisão é do jogador).
 *
 * Não espera o banner "FASE DE AÇÕES": o envio é imediato e as views seguintes já entram na fila depois dos
 * banners (`drainViewQueue`). Antes, o passe só saía depois do banner, e nesse intervalo o HUD pedia resposta a
 * quem não tinha jogada (BUG-88RVW1).
 */
export function actionStepAutoPass(view: ViewGameState, seat: PlayerId, specs: EffectSpec[]): ActionStepPass | null {
  const inCombatActionStep = view.combat?.step === "action" && view.combat.actionPriority === seat;
  const inEndPhaseActionStep = view.endPhaseAction !== null && view.endPhaseAction.priority === seat;
  if (!inCombatActionStep && !inEndPhaseActionStep) return null;
  if (playerHasActionStepPlay(view, seat, specs)) return null;
  return inCombatActionStep ? { kind: "passAction" } : { kind: "passEndPhaseAction" };
}
