/* Spec simulador-cadencia-de-mesa (P1) — quem trocou a mão neste lote. A troca é narrada pelo motor
 * (`MULLIGAN_RESOLVED`): as cartas da mão são renumeradas por posição (para não vazar a ordem do deck), então olhar os
 * ids da mão não serve. Tela e servidor leem daqui. */
import type { GameEvent, PlayerId } from "../engine/types";

export function mulliganRedraws(events: readonly GameEvent[]): PlayerId[] {
  return events.flatMap((e) => (e.type === "MULLIGAN_RESOLVED" && e.redraw ? [e.player] : []));
}
