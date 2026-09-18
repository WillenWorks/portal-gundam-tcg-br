/*
 * Zero Foresight — Simulador Preditivo Monte Carlo (docs/54 §4 "Zero Foresight" e §8.3).
 * Projeta "Tier Shift" do metagame simulando 10.000 torneios estocásticos: cada
 * iteração sorteia um campo de pilotos seguindo a distribuição de Meta Share atual
 * (ou um cenário hipotético de presença deslocada), disputa rodadas suíças com
 * probabilidade de vitória por confronto (Matriz de Confrontos real quando há amostra
 * suficiente, com fallback pro modelo Bradley-Terry a partir do winrate agregado de
 * cada arquétipo) e apura conversão pra Top 8 / Top 16.
 *
 * O "efeito cadeia" descrito no roadmap ("se Red Rush sobe 10%, Blue Control ganha
 * X% de winrate") não precisa de lógica hardcoded: ele emerge naturalmente de rodar a
 * simulação duas vezes (baseline vs. cenário) — mudar a composição do campo muda quem
 * cada arquétipo enfrenta, e o motor de confronto pareado já responde a isso sozinho.
 *
 * As 10.000 iterações rodam em chunks liberando o event loop via setImmediate entre
 * lotes (mesmo espírito do padrão de paginação em chunks de BATCH_PROCESSING.md,
 * adaptado pra computação em vez de I/O) -- evita travar o processo Node single-thread
 * numa chamada de API síncrona longa.
 */
import { type PrismaClient } from "@prisma/client";
import { getPowerRankings, getMatchupMatrix } from "../tournamentIntelligenceService.ts";

// --- Constantes nomeadas (ver KOTLIN.md "No Magic Numbers", mesmo princípio aplicado aqui) ---
const ITERATIONS_DEFAULT = 10_000;
const CHUNK_SIZE = 500;
const MIN_ITERATIONS = 100;
const MAX_ITERATIONS = 20_000;
const FIELD_SIZE = 32; // tamanho de campo simulado por iteração (bracket regional típico)
const ROUNDS_PER_ITERATION = 5; // suíço padrão pra 32 jogadores (2^5)
const TOP_CUT_8 = 8;
const TOP_CUT_16 = 16;
const WIN_POINTS = 3;
const DRAW_POINTS = 1;
const DRAW_PROBABILITY = 0.03; // partidas empatadas por tempo são raras, mas existem
const WINRATE_FLOOR = 0.05;
const WINRATE_CEIL = 0.95;
const SHARE_FLOOR = 0.001;
const MAX_SINGLE_SHARE = 0.9;
const MIN_MATCHUP_SAMPLE = 8; // abaixo disso, a amostra real não é confiável sozinha
const MATCHUP_BLEND_FULL_SAMPLE = 25; // a partir daqui, confia 100% na matriz real
const SIGNIFICANT_SHARE_DELTA = 0.02; // 2pp -- piso pra considerar um arquétipo "driver" do cenário
const SIGNIFICANT_WINRATE_DELTA = 0.001; // 0.1pp -- piso pra reportar um "mover" de winrate
const TIER_THRESHOLDS = { TIER_1: 7, TIER_2: 5, TIER_3: 3 };
const CACHE_TTL_MS = 10 * 60_000;

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

export interface ForesightScenario {
  // chave = nome do arquétipo, valor = delta de presença em fração (0.10 = +10 pontos percentuais)
  presenceDeltas: Record<string, number>;
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

export interface ForesightInsight {
  type: "presence_impact" | "tier_shift";
  message: string;
}

export interface ZeroForesightRequestParams {
  seasonId: string | null;
  setId?: string | null;
  scenario?: ForesightScenario | null;
  iterations?: number;
}

export interface ZeroForesightReport {
  generatedAt: string;
  seasonId: string | null;
  setId: string | null;
  iterations: number;
  sampleSize: number;
  hasMatchupData: boolean;
  baseline: ForesightArchetypeResult[];
  scenario: ForesightArchetypeResult[] | null;
  insights: ForesightInsight[];
}

function clamp(value: number, min: number, max: number) {
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

/**
 * Aplica um cenário hipotético de presença ("e se X subir 10%?"): desloca o(s)
 * arquétipo(s) alvo e redistribui o delta proporcionalmente entre os demais (pra
 * manter a soma das presenças em 100%) -- nunca zera ou inventa um arquétipo novo.
 */
export function applyScenarioShift(
  archetypes: ForesightArchetypeInput[],
  presenceDeltas: Record<string, number>,
): ForesightArchetypeInput[] {
  const baseShare = new Map(archetypes.map((a) => [a.archetype, Math.max(a.metaShare, 0)]));
  const explicitKeys = new Set(Object.keys(presenceDeltas).filter((k) => baseShare.has(k)));
  if (!explicitKeys.size) return archetypes;

  const newShare = new Map(baseShare);
  let totalDeltaApplied = 0;
  for (const key of explicitKeys) {
    const base = baseShare.get(key)!;
    const target = clamp(base + presenceDeltas[key], SHARE_FLOOR, MAX_SINGLE_SHARE);
    totalDeltaApplied += target - base;
    newShare.set(key, target);
  }

  const others = archetypes.map((a) => a.archetype).filter((name) => !explicitKeys.has(name));
  const othersTotal = others.reduce((sum, name) => sum + baseShare.get(name)!, 0);
  if (othersTotal > 0) {
    for (const name of others) {
      const base = baseShare.get(name)!;
      const proportional = base / othersTotal;
      newShare.set(name, clamp(base - totalDeltaApplied * proportional, SHARE_FLOOR, MAX_SINGLE_SHARE));
    }
  }

  const total = Array.from(newShare.values()).reduce((sum, v) => sum + v, 0) || 1;
  return archetypes.map((a) => ({ ...a, metaShare: newShare.get(a.archetype)! / total }));
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

/**
 * Fusão preditivo + real (ver docs/54 §4: "definindo o Tier 1 através da fusão entre a
 * análise preditiva e os dados reais consolidados de top decks dos torneios"). Combina
 * o score simulado (winrate projetado + conversão relativa pra Top 8/16) com o
 * powerRankingScore real (getPowerRankings, 0..10) quando disponível, 50/50 -- sem dado
 * real (arquétipo só existe no cenário hipotético), usa só o score simulado.
 */
export function applyFusionTiers(
  results: ForesightArchetypeResult[],
  realScoreByName: Map<string, number>,
): ForesightArchetypeResult[] {
  if (!results.length) return results;
  const maxTop8 = Math.max(...results.map((r) => r.top8ConversionRate), 0.0001);
  const maxTop16 = Math.max(...results.map((r) => r.top16ConversionRate), 0.0001);

  return results
    .map((r) => {
      const simulatedScore =
        10 *
        (0.5 * clamp(r.projectedWinRate ?? 0.5, 0, 1) +
          0.3 * (r.top8ConversionRate / maxTop8) +
          0.2 * (r.top16ConversionRate / maxTop16));
      const realScore = realScoreByName.get(r.archetype);
      const fusionScore = Number((realScore != null ? 0.5 * simulatedScore + 0.5 * realScore : simulatedScore).toFixed(2));
      const tier =
        fusionScore >= TIER_THRESHOLDS.TIER_1
          ? "Tier 1"
          : fusionScore >= TIER_THRESHOLDS.TIER_2
            ? "Tier 2"
            : fusionScore >= TIER_THRESHOLDS.TIER_3
              ? "Tier 3"
              : "Tier 4 (Rogue)";
      return { ...r, fusionScore, tier };
    })
    .sort((a, b) => (b.fusionScore ?? 0) - (a.fusionScore ?? 0));
}

/**
 * Gera os insights preditivos em linguagem natural (docs/54 §4, exemplo: "Se a presença
 * de Red Rush aumentar 10% no meta, Blue Control ganha 7.4% de winrate e Green Midrange
 * cai 4.2%"). O "driver" é o arquétipo com maior deslocamento de presença entre
 * baseline e cenário; os "movers" são o maior ganho e a maior queda de winrate
 * projetado entre os demais arquétipos -- tudo derivado das duas simulações, sem
 * regra hardcoded por arquétipo.
 */
export function buildForesightInsights(
  baseline: ForesightArchetypeResult[],
  scenario: ForesightArchetypeResult[],
): ForesightInsight[] {
  const insights: ForesightInsight[] = [];
  const baselineByName = new Map(baseline.map((a) => [a.archetype, a]));

  const deltas = scenario.map((s) => {
    const b = baselineByName.get(s.archetype);
    return {
      archetype: s.archetype,
      dShare: b ? s.metaShare - b.metaShare : 0,
      dWinRate: b && s.projectedWinRate != null && b.projectedWinRate != null ? s.projectedWinRate - b.projectedWinRate : 0,
    };
  });

  const drivers = deltas
    .filter((d) => Math.abs(d.dShare) >= SIGNIFICANT_SHARE_DELTA)
    .sort((a, b) => Math.abs(b.dShare) - Math.abs(a.dShare));
  const primaryDriver = drivers[0];

  if (primaryDriver) {
    const movers = deltas
      .filter((d) => d.archetype !== primaryDriver.archetype && Math.abs(d.dWinRate) >= SIGNIFICANT_WINRATE_DELTA)
      .sort((a, b) => b.dWinRate - a.dWinRate);
    const riser = movers[0];
    const faller = movers[movers.length - 1];

    if (riser && faller && riser.archetype !== faller.archetype) {
      insights.push({
        type: "presence_impact",
        message: `Se a presença de ${primaryDriver.archetype} ${primaryDriver.dShare >= 0 ? "aumentar" : "cair"} ${Math.abs(primaryDriver.dShare * 100).toFixed(1)}% no meta, ${riser.archetype} ganha ${(riser.dWinRate * 100).toFixed(1)}% de winrate e ${faller.archetype} cai ${Math.abs(faller.dWinRate * 100).toFixed(1)}% de winrate.`,
      });
    } else if (riser) {
      insights.push({
        type: "presence_impact",
        message: `Se a presença de ${primaryDriver.archetype} ${primaryDriver.dShare >= 0 ? "aumentar" : "cair"} ${Math.abs(primaryDriver.dShare * 100).toFixed(1)}% no meta, ${riser.archetype} ${riser.dWinRate >= 0 ? "ganha" : "perde"} ${Math.abs(riser.dWinRate * 100).toFixed(1)}% de winrate.`,
      });
    }
  }

  for (const s of scenario) {
    const b = baselineByName.get(s.archetype);
    if (b?.tier && s.tier && b.tier !== s.tier) {
      insights.push({ type: "tier_shift", message: `${s.archetype} muda de ${b.tier} para ${s.tier} sob esse cenário.` });
    }
  }

  return insights;
}

/**
 * Orquestra a simulação completa: busca Power Rankings (meta share + winrate real) e
 * a Matriz de Confrontos (server/tournamentIntelligenceService.ts, mesma fonte usada
 * pela StatsPage), roda a simulação baseline e, se um cenário foi pedido, roda de novo
 * com a presença deslocada -- então funde os dois com o resultado real e monta insights.
 */
export async function runZeroForesightSimulation(
  prisma: PrismaClient,
  params: ZeroForesightRequestParams,
): Promise<ZeroForesightReport> {
  const iterations = clamp(Math.round(params.iterations ?? ITERATIONS_DEFAULT), MIN_ITERATIONS, MAX_ITERATIONS);
  const emptyReport: ZeroForesightReport = {
    generatedAt: new Date().toISOString(),
    seasonId: params.seasonId,
    setId: params.setId ?? null,
    iterations: 0,
    sampleSize: 0,
    hasMatchupData: false,
    baseline: [],
    scenario: null,
    insights: [],
  };

  const [rankings, matchupMatrix] = await Promise.all([
    getPowerRankings(prisma, { seasonId: params.seasonId, setId: params.setId ?? null }),
    getMatchupMatrix(prisma, { seasonId: params.seasonId, sinceDate: null }),
  ]);

  const eligible = rankings.filter((r) => r.deckCount > 0 && r.metaShare > 0);
  if (!eligible.length) return emptyReport;

  const archetypeInputs: ForesightArchetypeInput[] = eligible.map((r) => ({
    archetype: r.archetype,
    metaShare: r.metaShare,
    winRate: r.winRate,
  }));
  const matchupInputs: ForesightMatchupInput[] = matchupMatrix.hasData
    ? matchupMatrix.cells.map((c) => ({
        archetypeA: c.archetypeA,
        archetypeB: c.archetypeB,
        winRate: c.winRate,
        sampleSize: c.wins + c.losses + c.draws,
      }))
    : [];
  const realScoreByName = new Map(eligible.map((r) => [r.archetype, r.powerRankingScore]));

  const baselineSim = await runForesightMonteCarlo({ archetypes: archetypeInputs, matchups: matchupInputs, iterations });
  const baseline = applyFusionTiers(baselineSim.archetypes, realScoreByName);

  let scenario: ForesightArchetypeResult[] | null = null;
  let insights: ForesightInsight[] = [];
  if (params.scenario?.presenceDeltas && Object.keys(params.scenario.presenceDeltas).length) {
    const shiftedInputs = applyScenarioShift(archetypeInputs, params.scenario.presenceDeltas);
    const scenarioSim = await runForesightMonteCarlo({ archetypes: shiftedInputs, matchups: matchupInputs, iterations });
    scenario = applyFusionTiers(scenarioSim.archetypes, realScoreByName);
    insights = buildForesightInsights(baseline, scenario);
  }

  return {
    generatedAt: new Date().toISOString(),
    seasonId: params.seasonId,
    setId: params.setId ?? null,
    iterations,
    sampleSize: eligible.length,
    hasMatchupData: matchupMatrix.hasData,
    baseline,
    scenario,
    insights,
  };
}

// --- Cache em memória (ver roteiro: "endpoint... com caching em memória dos resultados") ---
// 10.000 iterações é barato o bastante pra rodar por request (ver ITERATIONS_DEFAULT x
// FIELD_SIZE x ROUNDS_PER_ITERATION ~ 1.6M avaliações de partida), mas ainda assim vale
// cachear: o resultado só muda quando novos torneios/eventos são cadastrados, então
// repetir a simulação a cada refresh de tela é desperdício puro de CPU.
const foresightCache = new Map<string, { expiresAt: number; report: ZeroForesightReport }>();

function cacheKeyFor(params: ZeroForesightRequestParams): string {
  return JSON.stringify({
    seasonId: params.seasonId,
    setId: params.setId ?? null,
    scenario: params.scenario ?? null,
    iterations: params.iterations ?? ITERATIONS_DEFAULT,
  });
}

export async function runZeroForesightSimulationCached(
  prisma: PrismaClient,
  params: ZeroForesightRequestParams,
): Promise<ZeroForesightReport> {
  const key = cacheKeyFor(params);
  const cached = foresightCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.report;

  const report = await runZeroForesightSimulation(prisma, params);
  foresightCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, report });
  return report;
}

/** Exportado só pra teste -- evita que o cache de uma simulação vaze pra outra. */
export function clearForesightCache() {
  foresightCache.clear();
}
