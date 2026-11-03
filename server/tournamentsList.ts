/* Regras da lista de torneios: poucos valores de limite (cada um é uma consulta pesada em cache) e lista
 * completa só para quem administra. */
export const TOURNAMENT_LIST_LIMITS = [50, 100, 200] as const;
export const TOURNAMENT_LIST_DEFAULT_LIMIT = 50;

/** `null` = lista completa. O pedido é arredondado para cima, para o valor permitido mais próximo. */
export function tournamentListLimit(raw: unknown, isStaff: boolean): number | null {
  const requested = Number(raw);
  if (raw !== undefined && raw !== "" && Number.isFinite(requested) && requested > 0) {
    return TOURNAMENT_LIST_LIMITS.find((allowed) => allowed >= requested) ?? TOURNAMENT_LIST_LIMITS[TOURNAMENT_LIST_LIMITS.length - 1];
  }
  return isStaff ? null : TOURNAMENT_LIST_DEFAULT_LIMIT;
}
