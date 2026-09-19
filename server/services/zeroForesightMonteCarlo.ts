/*
 * Zero Foresight — núcleo PURO do Monte Carlo (extraído de zeroForesightService.ts,
 * docs/debates 2026-09-18 P0-3). Zero dependência de Prisma/DB de propósito: este
 * módulo é importado tanto pelo processo principal (uso direto, testado em
 * zeroForesightService.test.ts) quanto pelo Worker Thread dedicado
 * (zeroForesightWorker.ts) — qualquer import de Prisma aqui arriscaria abrir uma
 * conexão de banco por worker sem necessidade.
 *
 * As `iterations` (10.000 por padrão) rodam em chunks liberando o event loop via
 * setImmediate entre lotes (mesmo espírito do padrão de paginação em chunks de
 * BATCH_PROCESSING.md, adaptado pra computação em vez de I/O) — mantido mesmo
 * quando chamado dentro do worker (não atrapalha, e preserva o comportamento já
 * coberto pelos testes existentes).
 */

// --- Constantes nomeadas (ver KOTLIN.md "No Magic Numbers", mesmo princípio aplicado aqui) ---
export const ITERATIONS_DEFAULT = 10_000;
export const CHUNK_SIZE = 500;
export const MIN_ITERATIONS = 100;
export const MAX_ITERATIONS = 20_000;
export const FIELD_SIZE = 32; // tamanho de campo simulado por iteração (bracket regional típico)
export const ROUNDS_PER_ITERATION = 5; // suíço padrão pra 32 jogadores (2^5)
export const TOP_CUT_8 = 8;
export const TOP_CUT_16 = 16;
export const WIN_POINTS = 3;
export const DRAW_POINTS = 1;
export const DRAW_PROBABILITY = 0.03; // partidas empatadas por tempo são raras, mas existem
export const WINRATE_FLOOR = 0.05;
export const WINRATE_CEIL = 0.95;
export const MIN_MATCHUP_SAMPLE = 8; // abaixo disso, a amostra real não é confiável sozinha
export const MATCHUP_BLEND_FULL_SAMPLE = 25; // a partir daqui, confia 100% na matriz real

export interface ForesightArchetypeInput {
  archetype: string;
  metaShare: number; // 0..1
  winRate: number | null; // 0..1, winrate observado (bruto)
  adjustedWinRate?: number | null; // 0..1, winrate suavizado (Laplace) -- preferido quando presente
}

export interface ForesightMatchupInput {
  archetypeA: string;
  archetypeB: string;
  winRate: number | null; // winrate de A contra B, 0..1
  sampleSize?: number;
}

export interface ForesightSimulationParams {
  archetypes: ForesightArchetypeInput[];
  matchups?: ForesightMatchupInput[];
  iterations?: number;
  seed?: number;
}

export interface ForesightArchetypeResult {
  archetype: string;
  metaShare: number;
  appearances: number;
  projectedWinRate: number | null;
  top8ConversionRate: number;
  top16ConversionRate: number;
  fusionScore: number | null;
  tier: string | null;
}

export interface ForesightSimulationResult {
  iterations: number;
  fieldSize: number;
  archetypes: ForesightArchetypeResult[];
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Gerador Lehmer determinístico (seedável) -- usado tanto em produção (seed aleatória
 *  por request) quanto em testes (seed fixa, pra asserções reprodutíveis). */
export function seededRandom(seed: number): () => number {
  let state = Math.trunc(seed) % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function buildCumulativeShares(archetypes: ForesightArchetypeInput[]): number[] {
  const total = archetypes.reduce((sum, a) => sum + Math.max(a.metaShare, 0), 0) || 1;
  let running = 0;
  return archetypes.map((a) => {
    running += Math.max(a.metaShare, 0) / total;
    return running;
  });
}

/** Modelo Bradley-Terry (winrateA / (winrateA + winrateB)) como fallback pra qualquer
 *  par sem amostra real suficiente, com blend proporcional à amostra quando a Matriz
 *  de Confrontos real (getMatchupMatrix) já tem dados pro par -- mesma filosofia de
 *  suavização estatística usada em getPowerRankings (Laplace) e VEDA. */
export function buildPairwiseWinProbability(
  archetypes: ForesightArchetypeInput[],
  matchups: ForesightMatchupInput[],
): (archetypeA: string, archetypeB: string) => number {
  const effWinRate = new Map(
    archetypes.map((a) => [a.archetype, clamp(a.adjustedWinRate ?? a.winRate ?? 0.5, WINRATE_FLOOR, WINRATE_CEIL)]),
  );
  const matchupLookup = new Map<string, { winRate: number; sampleSize: number }>();
  for (const m of matchups) {
    if (m.winRate == null) continue;
    matchupLookup.set(`${m.archetypeA}|||${m.archetypeB}`, { winRate: m.winRate, sampleSize: m.sampleSize ?? 0 });
  }

  return (archetypeA: string, archetypeB: string) => {
    if (archetypeA === archetypeB) return 0.5;
    const ra = effWinRate.get(archetypeA) ?? 0.5;
    const rb = effWinRate.get(archetypeB) ?? 0.5;
    const modelProb = ra + rb > 0 ? ra / (ra + rb) : 0.5;

    const explicit = matchupLookup.get(`${archetypeA}|||${archetypeB}`);
    if (explicit && explicit.sampleSize >= MIN_MATCHUP_SAMPLE) {
      const weight = clamp(explicit.sampleSize / MATCHUP_BLEND_FULL_SAMPLE, 0, 1);
      return clamp(weight * explicit.winRate + (1 - weight) * modelProb, WINRATE_FLOOR, WINRATE_CEIL);
    }
    return clamp(modelProb, WINRATE_FLOOR, WINRATE_CEIL);
  };
}

interface AccEntry {
  appearances: number;
  wins: number;
  losses: number;
  draws: number;
  top8: number;
  top16: number;
}

function simulateOneTournament(
  archetypeNames: string[],
  cumulative: number[],
  pairwiseWinProbability: (a: string, b: string) => number,
  rng: () => number,
  acc: Map<string, AccEntry>,
) {
  const field: Array<{ name: string; score: number; wins: number; losses: number; draws: number }> = [];
  for (let i = 0; i < FIELD_SIZE; i++) {
    const roll = rng();
    let idx = cumulative.findIndex((c) => roll <= c);
    if (idx < 0) idx = archetypeNames.length - 1;
    field.push({ name: archetypeNames[idx], score: 0, wins: 0, losses: 0, draws: 0 });
  }

  for (let round = 0; round < ROUNDS_PER_ITERATION; round++) {
    // Pareamento suíço simplificado: ordena por pontuação atual (desempate aleatório) e
    // casa adjacentes -- suficiente pra Monte Carlo em massa, não precisa da trava de
    // "não reencontrar adversário" do motor real (server/services/swissTournamentEngine.ts).
    const order = field.map((_, i) => i).sort((x, y) => field[y].score - field[x].score || rng() - 0.5);
    const paired = new Array(field.length).fill(false);
    for (let i = 0; i < order.length; i++) {
      const pi = order[i];
      if (paired[pi]) continue;
      paired[pi] = true;
      let pj = -1;
      for (let j = i + 1; j < order.length; j++) {
        if (!paired[order[j]]) {
          pj = order[j];
          break;
        }
      }
      if (pj === -1) {
        field[pi].score += WIN_POINTS;
        field[pi].wins += 1;
        continue;
      }
      paired[pj] = true;
      const a = field[pi];
      const b = field[pj];
      const pWin = pairwiseWinProbability(a.name, b.name);
      const roll = rng();
      if (roll < DRAW_PROBABILITY) {
        a.score += DRAW_POINTS;
        b.score += DRAW_POINTS;
        a.draws += 1;
        b.draws += 1;
      } else if ((roll - DRAW_PROBABILITY) / (1 - DRAW_PROBABILITY) < pWin) {
        a.score += WIN_POINTS;
        a.wins += 1;
        b.losses += 1;
      } else {
        b.score += WIN_POINTS;
        b.wins += 1;
        a.losses += 1;
      }
    }
  }

  const ranked = field.slice().sort((x, y) => y.score - x.score || rng() - 0.5);
  ranked.forEach((p, rank) => {
    const entry = acc.get(p.name)!;
    entry.appearances += 1;
    entry.wins += p.wins;
    entry.losses += p.losses;
    entry.draws += p.draws;
    if (rank < TOP_CUT_8) entry.top8 += 1;
    if (rank < TOP_CUT_16) entry.top16 += 1;
  });
}

/**
 * Motor de simulação Monte Carlo. Roda `iterations` torneios simulados (10.000 por
 * padrão) em chunks de CHUNK_SIZE, cedendo o event loop (setImmediate) entre lotes.
 */
export async function runForesightMonteCarlo(params: ForesightSimulationParams): Promise<ForesightSimulationResult> {
  const archetypes = params.archetypes.filter((a) => a.metaShare > 0);
  if (!archetypes.length) {
    return { iterations: 0, fieldSize: FIELD_SIZE, archetypes: [] };
  }

  const iterations = clamp(Math.round(params.iterations ?? ITERATIONS_DEFAULT), MIN_ITERATIONS, MAX_ITERATIONS);
  const archetypeNames = archetypes.map((a) => a.archetype);
  const cumulative = buildCumulativeShares(archetypes);
  const pairwiseWinProbability = buildPairwiseWinProbability(archetypes, params.matchups ?? []);
  const rng = seededRandom(params.seed ?? Math.floor(Math.random() * 2_147_483_646) + 1);

  const acc = new Map<string, AccEntry>(
    archetypeNames.map((name) => [name, { appearances: 0, wins: 0, losses: 0, draws: 0, top8: 0, top16: 0 }]),
  );

  let done = 0;
  while (done < iterations) {
    const chunk = Math.min(CHUNK_SIZE, iterations - done);
    for (let i = 0; i < chunk; i++) {
      simulateOneTournament(archetypeNames, cumulative, pairwiseWinProbability, rng, acc);
    }
    done += chunk;
    if (done < iterations) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  const archetypeInputByName = new Map(archetypes.map((a) => [a.archetype, a]));
  const results: ForesightArchetypeResult[] = archetypeNames.map((name) => {
    const entry = acc.get(name)!;
    const games = entry.wins + entry.losses + entry.draws;
    return {
      archetype: name,
      metaShare: archetypeInputByName.get(name)!.metaShare,
      appearances: entry.appearances,
      projectedWinRate: games > 0 ? Number((entry.wins / games).toFixed(4)) : null,
      top8ConversionRate: entry.appearances > 0 ? Number((entry.top8 / entry.appearances).toFixed(4)) : 0,
      top16ConversionRate: entry.appearances > 0 ? Number((entry.top16 / entry.appearances).toFixed(4)) : 0,
      fusionScore: null,
      tier: null,
    };
  });

  return { iterations, fieldSize: FIELD_SIZE, archetypes: results };
}
