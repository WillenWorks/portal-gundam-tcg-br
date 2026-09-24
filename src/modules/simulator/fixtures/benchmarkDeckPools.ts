import type { DeckList } from "../engine/setup";
import { validatedDeckList } from "../content/validatedDecks";
import { META_DECKS_GD02_ERA } from "./metaDecksGd02Era";

/**
 * Pools de decks das réguas de força do bot (spec bot-avaliacao-forca):
 * `starters` = decks validados (ST01..ST08), `meta-gd02` = receitas oficiais da
 * época GD02 + ST06, `all` = os dois. `knownGaps` = cartas com efeito ainda não
 * implementado — o relatório da escada sinaliza.
 */
export const BENCHMARK_POOLS = ["starters", "meta-gd02", "all"] as const;
export type BenchmarkPool = (typeof BENCHMARK_POOLS)[number];

export interface BenchmarkDeck {
  id: string;
  label: string;
  knownGaps: string[];
  build: () => DeckList;
}

function starters(): BenchmarkDeck[] {
  return validatedDeckList().map((d) => ({ id: d.id, label: d.label, knownGaps: [], build: d.build }));
}

function metaGd02(): BenchmarkDeck[] {
  return Object.values(META_DECKS_GD02_ERA).map((d) => ({ id: d.id, label: d.label, knownGaps: d.knownGaps, build: d.build }));
}

export function deckPool(pool: BenchmarkPool): BenchmarkDeck[] {
  switch (pool) {
    case "starters":
      return starters();
    case "meta-gd02":
      return metaGd02();
    case "all":
      return [...starters(), ...metaGd02()];
    default:
      throw new Error(`Pool de decks desconhecido "${String(pool)}" — use ${BENCHMARK_POOLS.join(", ")}`);
  }
}
