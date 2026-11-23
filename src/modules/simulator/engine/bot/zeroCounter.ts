import type { CardDef } from "../types";
import type { DeckList } from "../setup";
import { deckPool, poolFromFile, type BenchmarkDeck } from "../../fixtures/benchmarkDeckPools";
import { analyzeOpponentDeck, recommendCounterPersona, type OpponentDeckProfile } from "./zeroCounterDeckBuilder";

/**
 * Counter do Zero System (spec bot-zero-system-forte, fase B): o bot joga com o
 * deck do pool que MAIS VENCE o deck do jogador, medido numa matriz de confrontos
 * (`scripts/gundam-bot-matchups.mjs`). Deck fora do pool → o do pool com perfil
 * mais próximo (mesmas cartas pesam mais que cor/curva). Todo deck do pool é legal
 * e tem os efeitos modelados, então o counter também é.
 *
 * O builder temático antigo (`buildZeroCounterDeck`) devolvia um starter fixo por
 * arquétipo; aqui a escolha vem de dados.
 */

/** taxas medidas: `rate[i][j]` = vitória do deck `decks[i]` contra `decks[j]` (null na diagonal/sem dado) */
export interface MatchupTable {
  decks: string[];
  rate: (number | null)[][];
  /**
   * partidas por par na matriz. Com ele, a escolha do counter encolhe cada taxa
   * em direção à média do candidato (peso de `shrinkPriorGames`, estimado da matriz): com ~10 partidas por
   * par, o melhor de 27 candidatos pela taxa crua tende a ser sorte.
   */
  gamesPerPair?: number;
  /**
   * listas (em códigos) dos decks da matriz quando ela veio de um pool de arquivo
   * (decks do banco): o servidor não conhece esses decks de outro jeito
   */
  lists?: Record<string, { main: string[]; resources: string[] }>;
}

/** pool que a tabela descreve: as listas embutidas ou, sem elas, o pool fixo `all` */
export function poolForTable(table: MatchupTable): BenchmarkDeck[] {
  if (!table.lists) return deckPool("all");
  const lists = table.lists;
  return poolFromFile({
    date: "",
    decks: table.decks.filter((id) => lists[id]).map((id) => ({ id, label: id, source: "fixed" as const, list: lists[id] })),
  });
}

/** peso mínimo (em partidas) da média do candidato na taxa ajustada do confronto */
export const SHRINK_PRIOR_GAMES = 10;
/** teto do peso: matriz sem sinal de confronto nenhum vira "sempre o baseline" sem dividir por zero */
export const SHRINK_PRIOR_MAX_GAMES = 200;

export interface ZeroCounterSummary {
  counterDeckId: string;
  /** deck do pool usado como referência do deck do jogador */
  nearestDeckId: string;
  /** melhor deck fixo do pool (maior taxa média) — o baseline do spec */
  baselineDeckId: string;
  /** taxa medida do counter contra o `nearestDeckId` */
  expectedRate: number | null;
  /** o counter é o próprio baseline: nenhum deck bate o melhor fixo contra este deck */
  fallback: boolean;
  persona: "amuro" | "char" | "heero" | "treize";
  archetype: OpponentDeckProfile["archetype"];
}

export interface ZeroCounterResult {
  deck: DeckList;
  summary: ZeroCounterSummary;
}

/** assinatura do deck independente da ordem (códigos ordenados) */
export function deckSignature(deck: DeckList): string {
  return deck.main
    .map((c) => c.code)
    .sort()
    .join(",");
}

function codeCounts(cards: CardDef[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of cards) out.set(c.code, (out.get(c.code) ?? 0) + 1);
  return out;
}

/** fração de cartas em comum (multiconjunto), 0..1 */
function overlap(a: CardDef[], b: CardDef[]): number {
  const ca = codeCounts(a);
  const cb = codeCounts(b);
  let common = 0;
  for (const [code, n] of ca) common += Math.min(n, cb.get(code) ?? 0);
  return common / Math.max(a.length, b.length, 1);
}

function fractions(record: Record<string, number>, total: number): Map<string, number> {
  return new Map(Object.entries(record).map(([k, v]) => [k, v / total]));
}

/** distância L1 entre perfis (cor, curva, tipos, keywords), todos em fração do deck */
function profileDistance(a: OpponentDeckProfile, b: OpponentDeckProfile): number {
  const ta = a.totalCards || 1;
  const tb = b.totalCards || 1;
  let d = 0;
  for (const group of ["colors", "curve", "types", "keywords"] as const) {
    const fa = fractions(a[group] as Record<string, number>, ta);
    const fb = fractions(b[group] as Record<string, number>, tb);
    for (const key of new Set([...fa.keys(), ...fb.keys()])) d += Math.abs((fa.get(key) ?? 0) - (fb.get(key) ?? 0));
  }
  return d;
}

/** peso do perfil frente às cartas em comum na escolha do deck mais próximo */
const PROFILE_WEIGHT = 0.25;

function nearestPoolDeck(deck: DeckList, pool: BenchmarkDeck[], profile: OpponentDeckProfile): BenchmarkDeck {
  const signature = deckSignature(deck);
  let best = pool[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of pool) {
    const built = candidate.build();
    if (deckSignature(built) === signature) return candidate;
    const score = 1 - overlap(deck.main, built.main) + PROFILE_WEIGHT * profileDistance(profile, analyzeOpponentDeck(built));
    if (score < bestScore - 1e-12) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

function averageRate(table: MatchupTable, row: number): number {
  const rates = table.rate[row].filter((r): r is number => r !== null);
  return rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
}

const priorCache = new WeakMap<MatchupTable, number>();

/**
 * Peso da média do candidato, estimado da própria matriz (Bayes empírico). Modelo aditivo: taxa esperada do par
 * = média da linha + média da coluna − 0,5. O que sobra é sinal de confronto + ruído binomial (p(1−p)/n).
 * Peso = n · ruído / sinal: quanto menos sinal de confronto a matriz tem, mais a escolha fica com o deck forte
 * no geral. Na matriz do GD06 de 22/11 (10 por par), só 14% do desvio era sinal → peso ~60, não 10.
 */
export function shrinkPriorGames(table: MatchupTable): number {
  const cached = priorCache.get(table);
  if (cached !== undefined) return cached;
  const n = table.gamesPerPair ?? 0;
  const size = table.decks.length;
  const rowAvg = table.decks.map((_, i) => averageRate(table, i));
  const colAvg = table.decks.map((_, j) => {
    const col = table.rate.map((row) => row[j]).filter((r): r is number => r !== null);
    return col.length ? col.reduce((s, r) => s + r, 0) / col.length : 0.5;
  });
  let observed = 0;
  let noise = 0;
  let cells = 0;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const r = table.rate[i][j];
      if (r === null) continue;
      const expected = rowAvg[i] + colAvg[j] - 0.5;
      const p = Math.min(0.95, Math.max(0.05, expected));
      observed += (r - expected) ** 2;
      noise += (p * (1 - p)) / Math.max(1, n);
      cells++;
    }
  }
  let prior = SHRINK_PRIOR_GAMES;
  if (n > 0 && cells > 0) {
    const signal = (observed - noise) / cells;
    prior = signal <= 0 ? SHRINK_PRIOR_MAX_GAMES : (n * (noise / cells)) / signal;
    prior = Math.min(SHRINK_PRIOR_MAX_GAMES, Math.max(SHRINK_PRIOR_GAMES, prior));
  }
  priorCache.set(table, prior);
  return prior;
}

export function counterForPlayerDeck(playerDeck: DeckList, table: MatchupTable, pool: BenchmarkDeck[] = poolForTable(table)): ZeroCounterResult {
  const inTable = pool.filter((d) => table.decks.includes(d.id));
  if (inTable.length === 0) throw new Error("counterForPlayerDeck: nenhum deck do pool está na matriz de confrontos");
  const profile = analyzeOpponentDeck(playerDeck);
  const nearest = nearestPoolDeck(playerDeck, inTable, profile);
  const col = table.decks.indexOf(nearest.id);

  // baseline: maior taxa média contra o pool (empate → ordem da tabela)
  let baselineRow = table.decks.indexOf(inTable[0].id);
  for (const d of inTable) {
    const row = table.decks.indexOf(d.id);
    if (averageRate(table, row) > averageRate(table, baselineRow) + 1e-12) baselineRow = row;
  }

  // counter: maior taxa AJUSTADA contra o deck do jogador; em empate fica o baseline
  const n = table.gamesPerPair;
  const prior = n === undefined ? 0 : shrinkPriorGames(table);
  const adjusted = (row: number): number | null => {
    const r = table.rate[row][col];
    if (r === null) return null;
    return n === undefined ? r : (n * r + prior * averageRate(table, row)) / (n + prior);
  };
  let counterRow = baselineRow;
  let counterScore = adjusted(baselineRow);
  for (const d of inTable) {
    const row = table.decks.indexOf(d.id);
    const a = adjusted(row);
    if (a !== null && (counterScore === null || a > counterScore + 1e-12)) {
      counterRow = row;
      counterScore = a;
    }
  }
  const counterRate = table.rate[counterRow][col];

  const counterId = table.decks[counterRow];
  const counterDeck = inTable.find((d) => d.id === counterId);
  if (!counterDeck) throw new Error(`counterForPlayerDeck: deck ${counterId} fora do pool`);
  return {
    deck: counterDeck.build(),
    summary: {
      counterDeckId: counterId,
      nearestDeckId: nearest.id,
      baselineDeckId: table.decks[baselineRow],
      expectedRate: counterRate,
      fallback: counterRow === baselineRow,
      persona: recommendCounterPersona(profile),
      archetype: profile.archetype,
    },
  };
}
