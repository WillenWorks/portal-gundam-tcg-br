/** Estatística de CUSTO baixo na mão inicial do Deckbuilder (docs/38 §5).
 *
 *  Espelha `lowLevelUnitStats` (deck-level-stats.ts), mas o "sucesso" aqui é a
 *  carta ter custo baixo — não nível baixo. É a leitura de "consigo agir cedo?":
 *  cartas de custo ≤2 são as jogáveis nos primeiros turnos, quando ainda há
 *  poucos recursos disponíveis.
 */

import { OPENING_HAND_SIZE, hypergeometricAtLeastOne } from "./deck-level-stats.ts";

/** Maior custo ainda considerado "baixo". Cartas de custo 0..2 entram em jogo
 *  já nos turnos iniciais; a partir de 3 normalmente é preciso montar recurso antes. */
export const LOW_COST_MAX = 2;

type CostRow = { cost?: number | null; quantity?: number | null };

export type LowCostStats = {
  lowCostCount: number;
  openingHand: number;
  withMulligan: number;
};

/** Quantas cartas de custo ≤ LOW_COST_MAX há no principal e a chance de abrir com
 *  pelo menos uma. Conta qualquer carta com custo numérico (Unit, Base, Command,
 *  Pilot) — Resource não tem custo e já fica fora da lista principal. Cartas sem
 *  custo numérico são ignoradas. Mesmo formato de `lowLevelUnitStats`. */
export function lowCostStats(rows: CostRow[], mainDeckCount: number): LowCostStats {
  const lowCostCount = rows.reduce((sum, row) => {
    if (typeof row.cost !== "number" || !Number.isFinite(row.cost) || row.cost < 0 || row.cost > LOW_COST_MAX) {
      return sum;
    }
    return sum + (typeof row.quantity === "number" ? row.quantity : 0);
  }, 0);

  const openingHand = hypergeometricAtLeastOne(mainDeckCount, lowCostCount, OPENING_HAND_SIZE);
  const withMulligan = 1 - (1 - openingHand) * (1 - openingHand);
  return { lowCostCount, openingHand, withMulligan };
}
