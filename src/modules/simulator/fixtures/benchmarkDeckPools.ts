import type { DeckList } from "../engine/setup";
import { validatedDeckList } from "../content/validatedDecks";
import { META_DECKS_GD02_ERA } from "./metaDecksGd02Era";
import { getCardDefByCode } from "../content/allCardDefs";
import { GD03_TEST_DECKS } from "./gd03Decks";
import { GD04_TEST_DECKS } from "./gd04Decks";
import { ST09_DECKS } from "./st09Decks";
import { GD05_DECKS } from "./gd05Decks";
import { ST10_TEST_DECKS } from "./st10Decks";
import { EB01_TEST_DECKS } from "./eb01Decks";
import { ST11_TO_14_DECKS } from "./st11to14Decks";

/**
 * Pools de decks das réguas de força do bot (spec bot-avaliacao-forca):
 * `starters` = decks validados (ST01..ST08), `meta-gd02` = receitas oficiais da
 * época GD02 + ST06, `sets-novos` = decks dos sets fechados depois (GD03, GD04, ST09, as receitas
 * oficiais do GD05 e do ST11–ST14, e os decks de teste do ST10 e do EB01), `all` = os três. `knownGaps` = cartas com efeito ainda não implementado — o
 * relatório da escada sinaliza.
 */
export const BENCHMARK_POOLS = ["starters", "meta-gd02", "sets-novos", "all", "calib", "valid"] as const;

/**
 * Pools disjuntos da calibração dos pesos do Zero System (spec bot-zero-system-forte,
 * fase A): calibra num, valida no outro. Divididos alternando pela taxa média da
 * matriz `docs/bot/matchups-2026-09-24.json`, pra os dois terem força parecida. Cobrem só
 * `starters` + `meta-gd02` (os pesos foram calibrados antes dos `sets-novos`).
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

/** sets fechados (sem cartas parciais nem faltando): os mesmos decks do fuzz e do golden */
function setsNovos(): BenchmarkDeck[] {
  return [GD03_TEST_DECKS, GD04_TEST_DECKS, ST09_DECKS, GD05_DECKS, ST10_TEST_DECKS, EB01_TEST_DECKS, ST11_TO_14_DECKS].flatMap((decks) =>
    Object.values(decks).map((d) => ({ id: d.id, label: d.label, knownGaps: [], build: d.build })),
  );
}

export function deckPool(pool: BenchmarkPool): BenchmarkDeck[] {
  switch (pool) {
    case "starters":
      return starters();
    case "meta-gd02":
      return metaGd02();
    case "sets-novos":
      return setsNovos();
    case "all":
      return [...starters(), ...metaGd02(), ...setsNovos()];
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

/** deck de um arquivo de pool (`gundam:bot:pool-export`): lista em códigos de carta */
export interface PoolFileDeck {
  id: string;
  label: string;
  /** de onde veio: torneio, deck público do site ou pool fixo */
  source: "tournament" | "public" | "fixed";
  archetype?: string | null;
  /** melhor colocação em torneio (quando veio de um) */
  placement?: number | null;
  list: { main: string[]; resources: string[] };
}

export interface PoolFile {
  date: string;
  decks: PoolFileDeck[];
}

function defsFromCodes(codes: string[], deckId: string) {
  return codes.map((code) => {
    const def = getCardDefByCode(code);
    if (!def) throw new Error(`deck ${deckId}: carta ${code} fora do catálogo do simulador`);
    return def;
  });
}

/** pool a partir do JSON exportado (decks do banco) — mesmo formato dos pools nomeados */
export function poolFromFile(file: PoolFile): BenchmarkDeck[] {
  return file.decks.map((d) => ({
    id: d.id,
    label: d.label,
    knownGaps: [],
    build: () => ({ main: defsFromCodes(d.list.main, d.id), resources: defsFromCodes(d.list.resources, d.id) }),
  }));
}

/** deck do pool → formato de arquivo (pra incluir os pools fixos num export e na fixture do counter) */
export function toPoolFileDeck(deck: BenchmarkDeck, source: PoolFileDeck["source"] = "fixed"): PoolFileDeck {
  const list = deck.build();
  return { id: deck.id, label: deck.label, source, list: { main: list.main.map((c) => c.code), resources: list.resources.map((c) => c.code) } };
}
