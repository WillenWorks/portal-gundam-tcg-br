/**
 * Plano e agregação da matriz de confrontos (spec bot-dados-pool): separa QUAIS
 * partidas jogar de QUEM joga, pra rodar em série ou dividido entre workers com o
 * mesmo resultado — cada partida tem seed e assento fixos pelo índice.
 */

export interface PlannedGame {
  index: number;
  /** deck no assento A / B (índices no pool) */
  a: number;
  b: number;
  seed: number;
}

export interface GameResult {
  index: number;
  a: number;
  b: number;
  /** pontos do deck do assento A (1 vitória, 0,5 empate/sem vencedor); ausente se excluída */
  scoreA?: number;
  error?: string;
}

/** mesma sequência de seeds/assentos do script serial original (matrizes comparáveis) */
export function planMatchupGames(opts: { decks: number; gamesPerPair: number; seed: number }): PlannedGame[] {
  const plan: PlannedGame[] = [];
  let index = 0;
  for (let i = 0; i < opts.decks; i++) {
    for (let j = i + 1; j < opts.decks; j++) {
      for (let g = 0; g < opts.gamesPerPair; g++) {
        const iIsA = g % 2 === 0;
        plan.push({ index, a: iIsA ? i : j, b: iIsA ? j : i, seed: opts.seed * 100_003 + index });
        index++;
      }
    }
  }
  return plan;
}

/** round-robin por índice: partes de tamanho parecido e com pares misturados */
export function splitForWorkers(plan: PlannedGame[], workers: number): PlannedGame[][] {
  const n = Math.max(1, Math.min(workers, plan.length));
  const parts: PlannedGame[][] = Array.from({ length: n }, () => []);
  plan.forEach((g, i) => parts[i % n].push(g));
  return parts;
}

export interface MatchupAggregate {
  wins: number[][];
  played: number[][];
  rate: (number | null)[][];
  excluded: GameResult[];
}

export function aggregateMatchups(decks: number, results: GameResult[]): MatchupAggregate {
  const wins = Array.from({ length: decks }, () => Array<number>(decks).fill(0));
  const played = Array.from({ length: decks }, () => Array<number>(decks).fill(0));
  const excluded: GameResult[] = [];
  for (const r of [...results].sort((x, y) => x.index - y.index)) {
    if (r.scoreA === undefined) {
      excluded.push(r);
      continue;
    }
    wins[r.a][r.b] += r.scoreA;
    wins[r.b][r.a] += 1 - r.scoreA;
    played[r.a][r.b]++;
    played[r.b][r.a]++;
  }
  const rate = wins.map((row, i) => row.map((w, j) => (i === j || played[i][j] === 0 ? null : w / played[i][j])));
  return { wins, played, rate, excluded };
}

/** memória por worker (cada um carrega o motor + specs e joga partidas inteiras) */
const WORKER_MEMORY_BYTES = 1.5 * 1024 ** 3;
const MAX_DEFAULT_WORKERS = 6;

/** min(núcleos − 1, memória livre / 1,5 GB, 6), no mínimo 1 */
export function defaultWorkerCount(opts: { cpus: number; freeMemBytes: number }): number {
  return Math.max(1, Math.min(opts.cpus - 1, Math.floor(opts.freeMemBytes / WORKER_MEMORY_BYTES), MAX_DEFAULT_WORKERS));
}
