/**
 * W0 — "choose 1 to N" (`targetCount: { min, max }`, ex. GD01-099, GD02-101, ST06-013) na jogada
 * direta de Command/【Activate】: a tela só dispara sozinha quando não há mais o que escolher.
 * Antes disparava no mínimo — com "1 to 2" o humano nunca conseguia escolher o 2º alvo.
 */

/** dispara sozinha? — só com o mínimo atingido E o máximo alcançável (limitado ao pool) preenchido */
export function targetsReadyToAutoResolve(selectedCount: number, min: number, max: number, poolSize: number): boolean {
  if (min <= 0) return true;
  if (selectedCount < min) return false;
  return selectedCount >= Math.min(Math.max(max, min), poolSize);
}

/** mais um alvo cabe? (`max` 1 = comportamento antigo, sem limite de clique extra) */
export function canAddTarget(selectedCount: number, max: number): boolean {
  return max <= 1 || selectedCount < max;
}
