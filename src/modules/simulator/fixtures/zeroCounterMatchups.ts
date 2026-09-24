import type { MatchupTable } from "../engine/bot/zeroCounter";

/**
 * Matriz de confrontos que o counter do Zero System consulta (spec
 * bot-zero-system-forte). GERADA por `pnpm gundam:bot:matchups -- --write-fixture`
 * — não editar à mão. Sem dados (tudo `null`) o counter cai no primeiro deck
 * da tabela com `fallback: true`.
 */
export const ZERO_COUNTER_MATCHUPS: MatchupTable = {
  decks: [],
  rate: [],
};
