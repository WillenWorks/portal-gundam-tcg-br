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
 * O núcleo do Monte Carlo (`runForesightMonteCarlo` e afins) mora em
 * `zeroForesightMonteCarlo.ts` (módulo puro, sem Prisma) e roda isolado num Worker
 * Thread dedicado via `zeroForesightWorkerClient.ts` (docs/debates 2026-09-18 P0-3) —
 * nunca bloqueia o event loop principal do Express, com timeout de corte de 2s que
 * cai pra execução in-process (logada) se o worker não responder a tempo.
 */
import { type PrismaClient } from "@prisma/client";
import { getPowerRankings, getMatchupMatrix } from "../tournamentIntelligenceService.ts";
import {
  ITERATIONS_DEFAULT,
  MIN_ITERATIONS,
  MAX_ITERATIONS,
  clamp,
  runForesightMonteCarlo,
  type ForesightArchetypeInput,
  type ForesightMatchupInput,
  type ForesightArchetypeResult,
  type ForesightSimulationParams,
} from "./zeroForesightMonteCarlo.ts";
import { runForesightMonteCarloInWorker, FORESIGHT_WORKER_TIMEOUT_MS_DEFAULT } from "./zeroForesightWorkerClient.ts";

// Re-exportado pra manter a API pública de antes da extração (zeroForesightService.test.ts
// importa esses símbolos daqui, não do módulo puro).
export {
  seededRandom,
  buildPairwiseWinProbability,
  runForesightMonteCarlo,
  type ForesightArchetypeInput,
  type ForesightMatchupInput,
  type ForesightArchetypeResult,
  type ForesightSimulationParams,
  type ForesightSimulationResult,
} from "./zeroForesightMonteCarlo.ts";

// --- Constantes nomeadas (ver KOTLIN.md "No Magic Numbers", mesmo princípio aplicado aqui) ---
const SHARE_FLOOR = 0.001;
const MAX_SINGLE_SHARE = 0.9;
const SIGNIFICANT_SHARE_DELTA = 0.02; // 2pp -- piso pra considerar um arquétipo "driver" do cenário
const SIGNIFICANT_WINRATE_DELTA = 0.001; // 0.1pp -- piso pra reportar um "mover" de winrate
const TIER_THRESHOLDS = { TIER_1: 7, TIER_2: 5, TIER_3: 3 };
const CACHE_TTL_MS = 10 * 60_000;

export interface ForesightScenario {
  // chave = nome do arquétipo, valor = delta de presença em fração (0.10 = +10 pontos percentuais)
  presenceDeltas: Record<string, number>;
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

export interface ForesightInsight {
  type: "presence_impact" | "tier_shift";
  message: string;
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
 * Roda o Monte Carlo isolado num Worker Thread (docs/debates 2026-09-18 P0-3); se o
 * worker falhar ao subir ou estourar o timeout de corte, cai pra execução in-process
 * (mesmo `runForesightMonteCarlo`, chunked com setImmediate) — logando o motivo (ver
 * KOTLIN.md "No Silent Try-Catch": nunca engole o fallback sem registrar por quê).
 */
async function runMonteCarloSafely(params: ForesightSimulationParams) {
  try {
    return await runForesightMonteCarloInWorker(params, FORESIGHT_WORKER_TIMEOUT_MS_DEFAULT);
  } catch (err) {
    console.warn(
      `[zeroForesight] worker thread indisponível ou estourou o timeout de ${FORESIGHT_WORKER_TIMEOUT_MS_DEFAULT}ms, caindo pra execução in-process:`,
      err,
    );
    return runForesightMonteCarlo(params);
  }
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

  const baselineSim = await runMonteCarloSafely({ archetypes: archetypeInputs, matchups: matchupInputs, iterations });
  const baseline = applyFusionTiers(baselineSim.archetypes, realScoreByName);

  let scenario: ForesightArchetypeResult[] | null = null;
  let insights: ForesightInsight[] = [];
  if (params.scenario?.presenceDeltas && Object.keys(params.scenario.presenceDeltas).length) {
    const shiftedInputs = applyScenarioShift(archetypeInputs, params.scenario.presenceDeltas);
    const scenarioSim = await runMonteCarloSafely({ archetypes: shiftedInputs, matchups: matchupInputs, iterations });
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
