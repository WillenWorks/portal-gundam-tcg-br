import type { DeckList } from "../engine/setup";
import { validatedDeckList } from "../content/validatedDecks";
import { META_DECKS_GD02_ERA } from "./metaDecksGd02Era";

/**
 * Pools de decks das réguas de força do bot (spec bot-avaliacao-forca):
 * `starters` = decks validados (ST01..ST08), `meta-gd02` = receitas oficiais da
 * época GD02 + ST06, `all` = os dois. `knownGaps` = cartas com efeito ainda não
 * implementado — o relatório da escada sinaliza.
 */
export const BENCHMARK_POOLS = ["starters", "meta-gd02", "all", "calib", "valid"] as const;

/**
 * Pools disjuntos da calibração dos pesos do Zero System (spec bot-zero-system-forte,
 * fase A): calibra num, valida no outro. Divididos alternando pela taxa média da
 * matriz `docs/bot/matchups-2026-09-24.json`, pra os dois terem força parecida.
 */
export const CALIB_DECK_IDS = ["META-ST06-GQUUUUUUX", "META-GD02-QUBELEY", "META-GD02-AEUG-EA", "ST06", "ST05", "META-GD02-TEKKADAN-VAGAN", "ST08"];
export const VALID_DECK_IDS = ["ST04", "ST03", "META-GD02-TITANS", "ST07", "ST02", "ST01", "META-GD02-AGE-WING"];
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
    case "calib":
    case "valid": {
      const ids = pool === "calib" ? CALIB_DECK_IDS : VALID_DECK_IDS;
      const all = [...starters(), ...metaGd02()];
      return ids.map((id) => {
        const deck = all.find((d) => d.id === id);
        if (!deck) throw new Error(`deck ${id} do pool ${pool} não existe`);
        return deck;
      });
    }
    default:
      throw new Error(`Pool de decks desconhecido "${String(pool)}" — use ${BENCHMARK_POOLS.join(", ")}`);
  }
}
