/* Spec simulador-cadencia-de-mesa (P0): quanto a mesa ainda espera a cena do servidor terminar. A cena chega como
 * horário do servidor (`MatchView.sceneEndsAt`) e vira horário local com o desvio de relógio da visão. Teto por
 * segurança: um relógio muito errado ou uma conta do servidor fora do esperado nunca prende a mesa por mais que isso. */

/** nenhuma cena de um lote só passa disto (turno inteiro do bot com banners fica bem abaixo) */
export const SCENE_LOCK_MAX_WAIT_MS = 15_000;

/** fim da cena no relógio local; `clockOffset` = relógio do servidor − local */
export function localSceneEnd(sceneEndsAt: number | null | undefined, clockOffset: number, now: number): number | null {
  if (sceneEndsAt == null) return null;
  return Math.min(sceneEndsAt - clockOffset, now + SCENE_LOCK_MAX_WAIT_MS);
}

export function sceneLockWaitMs(sceneEndsAtLocal: number | null, now: number): number {
  return sceneEndsAtLocal == null ? 0 : Math.max(0, sceneEndsAtLocal - now);
}
