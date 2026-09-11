/** Estatística de "consigo desenvolver campo cedo?" na mão inicial do Deckbuilder
 *  (docs/38 §5).
 *
 *  Corrigido a partir de um erro relatado pelo usuário: a versão antiga contava
 *  QUALQUER carta com custo numérico ≤2 (Unit, Base, Command, Pilot) como um
 *  "sucesso", ignorando que (1) o NÍVEL da carta também trava o turno em que ela
 *  pode ser jogada (ver opening-hand-score.ts: turno mínimo real = max(custo,
 *  nível), replicando a regra oficial do motor de simulação) e que (2) o jogo
 *  depende de Unidades/Bases em campo pra atacar/bloquear — um Piloto ou Comando
 *  de custo 1 não desenvolve o campo sozinho. Por isso "sucesso" aqui agora é:
 *  Unidade OU Base cujo turno mínimo (max(custo, nível)) seja ≤ LOW_COST_MAX.
 */

import { OPENING_HAND_SIZE, hypergeometricAtLeastOne } from "./deck-level-stats.ts";
import { earliestPlayableTurn, isBoardDevelopmentCard, type HandScoreCard } from "./opening-hand-score.ts";

/** Maior turno mínimo ainda considerado "abertura cedo". Unidades/Bases com
 *  max(custo, nível) 0..2 entram em jogo já nos turnos iniciais; a partir de 3
 *  normalmente é preciso desenvolver mais recurso antes. */
export const LOW_COST_MAX = 2;

type CostRow = HandScoreCard & { quantity?: number | null };

export type LowCostStats = {
  lowCostCount: number;
  openingHand: number;
  withMulligan: number;
};

/** Quantas Unidades/Bases realmente jogáveis até LOW_COST_MAX (custo E nível) há no
 *  principal e a chance de abrir com pelo menos uma. Piloto/Comando nunca contam
 *  aqui — não desenvolvem campo sozinhos, mesmo com custo baixo. Mesmo formato de
 *  `lowLevelUnitStats`. */
export function lowCostStats(rows: CostRow[], mainDeckCount: number): LowCostStats {
  const lowCostCount = rows.reduce((sum, row) => {
    if (typeof row.cost !== "number" || !Number.isFinite(row.cost)) return sum;
    if (!isBoardDevelopmentCard(row)) return sum;
    if (earliestPlayableTurn(row) > LOW_COST_MAX) return sum;
    return sum + (typeof row.quantity === "number" ? row.quantity : 0);
  }, 0);

  const openingHand = hypergeometricAtLeastOne(mainDeckCount, lowCostCount, OPENING_HAND_SIZE);
  const withMulligan = 1 - (1 - openingHand) * (1 - openingHand);
  return { lowCostCount, openingHand, withMulligan };
}
