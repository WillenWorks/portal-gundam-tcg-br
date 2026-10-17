import type { PrismaClient } from "@prisma/client";
import { META_CORES } from "../src/modules/simulator/fixtures/metaCores.ts";
import type { MetagameProvenance } from "./metagameTrendsService.ts";

export interface FormatCardDetail {
  code: string;
  name: string;
  namePt: string | null;
  imageUrl: string | null;
  imageMediumUrl: string | null;
  color: string | null;
  cardType: string;
  cost: number | null;
  level: number | null;
  tier: "core" | "flex" | "tech";
  inclusionRate: number; // 0..1
  modeCopies: number;
  avgCopies: number;
}

export interface FormatArchetypeSummary {
  id: string;
  name: string;
  colors: string[];
  keyCard: string;
  keyCardDetail: FormatCardDetail | null;
  lists: number;
  share: number; // 0..1 (presença no meta)
  top8Share: number; // 0..1 (conversão em top cut)
  winShare: number; // 0..1 (fatia de vitórias)
  points: number; // escore ponderado
  isSmallSample: boolean; // true se lists < 10
  sampleWarning: string | null;
  cards: {
    core: FormatCardDetail[];
    flex: FormatCardDetail[];
    tech: FormatCardDetail[];
  };
  medianDecklist: Record<string, number>;
}

export interface FormatMetaResponse {
  format: string; // e.g. "GD01", "GD02", "GD03", "GD04", "GD05"
  totalLists: number;
  totalEvents: number;
  generatedAt: string;
  sourceUrl: string;
  archetypes: FormatArchetypeSummary[];
  provenance: MetagameProvenance;
}

export interface FormatOverviewItem {
  format: string;
  totalLists: number;
  totalEvents: number;
  archetypeCount: number;
  topArchetypes: Array<{ name: string; share: number; colors: string[] }>;
}

export interface ArchetypeEvolutionPoint {
  format: string;
  lists: number;
  share: number;
  top8Share: number;
  winShare: number;
  points: number;
}

export interface ArchetypeEvolution {
  name: string;
  colors: string[];
  points: ArchetypeEvolutionPoint[];
}

let cachedCardMap: Map<string, any> | null = null;

async function getCardMap(prisma: PrismaClient): Promise<Map<string, any>> {
  if (cachedCardMap && cachedCardMap.size > 0) {
    return cachedCardMap;
  }
  const cards = await prisma.card.findMany({
    select: {
      code: true,
      nameEn: true,
      namePt: true,
      imageUrl: true,
      imageMediumUrl: true,
      color: true,
      cardType: true,
      cost: true,
      level: true,
    },
  });
  const map = new Map<string, any>();
  for (const c of cards) {
    map.set(c.code, c);
  }
  cachedCardMap = map;
  return map;
}

/**
 * Agrega matematicamente múltiplos formatos (ex: GD05 + GD05.5 ou Todas as Temporadas)
 * sem inventar dados, ponderando taxas de inclusão, shares, top8 e pontos pelas listas reais.
 */
function aggregateFormatData(formatKeys: string[]): {
  lists: number;
  events: number;
  archetypes: any[];
} {
  let totalLists = 0;
  let totalEvents = 0;
  const archMap = new Map<
    string,
    {
      id: string;
      name: string;
      colors: string[];
      keyCard: string;
      lists: number;
      top8Weighted: number;
      winWeighted: number;
      pointsWeighted: number;
      cardsMap: Map<
        string,
        {
          code: string;
          tierWeights: Record<string, number>;
          totalRate: number;
          totalAvg: number;
          modeWeights: Record<number, number>;
        }
      >;
      median: Record<string, number>;
    }
  >();

  for (const fmtKey of formatKeys) {
    const fmt = META_CORES.formats[fmtKey as keyof typeof META_CORES.formats];
    if (!fmt) continue;
    totalLists += fmt.lists;
    totalEvents += fmt.events;

    for (const a of fmt.archetypes || []) {
      const normKey = a.name.toLowerCase().trim();
      let existing = archMap.get(normKey);
      if (!existing) {
        existing = {
          id: a.id,
          name: a.name,
          colors: [...a.colors],
          keyCard: a.keyCard,
          lists: 0,
          top8Weighted: 0,
          winWeighted: 0,
          pointsWeighted: 0,
          cardsMap: new Map(),
          median: { ...(a.median || a.variants?.[0]?.median || {}) },
        };
        archMap.set(normKey, existing);
      }

      existing.lists += a.lists;
      existing.top8Weighted += (a.top8Share || 0) * a.lists;
      existing.winWeighted += (a.winShare || 0) * a.lists;
      existing.pointsWeighted += (a.points || 0) * a.lists;

      // Adota a mediana e keyCard da versão com maior amostragem
      if (a.lists >= existing.lists - a.lists && a.median) {
        existing.median = { ...a.median };
        existing.keyCard = a.keyCard;
      }

      for (const card of a.cards || []) {
        let cEntry = existing.cardsMap.get(card.code);
        if (!cEntry) {
          cEntry = {
            code: card.code,
            tierWeights: {},
            totalRate: 0,
            totalAvg: 0,
            modeWeights: {},
          };
          existing.cardsMap.set(card.code, cEntry);
        }
        cEntry.tierWeights[card.tier] = (cEntry.tierWeights[card.tier] || 0) + a.lists;
        cEntry.totalRate += card.rate * a.lists;
        cEntry.totalAvg += card.avg * a.lists;
        cEntry.modeWeights[card.mode] = (cEntry.modeWeights[card.mode] || 0) + a.lists;
      }
    }
  }

  const archetypes = Array.from(archMap.values()).map((arch) => {
    const archLists = arch.lists;
    const share = totalLists > 0 ? Number((archLists / totalLists).toFixed(3)) : 0;
    const top8Share = archLists > 0 ? Number((arch.top8Weighted / archLists).toFixed(3)) : 0;
    const winShare = archLists > 0 ? Number((arch.winWeighted / archLists).toFixed(3)) : 0;
    const points = archLists > 0 ? Number((arch.pointsWeighted / archLists).toFixed(3)) : 0;

    const cards = Array.from(arch.cardsMap.values()).map((c) => {
      const rate = Number((c.totalRate / archLists).toFixed(3));
      const avg = Number((c.totalAvg / archLists).toFixed(2));

      let bestMode = 4;
      let maxModeWeight = -1;
      for (const [mStr, w] of Object.entries(c.modeWeights)) {
        if (w > maxModeWeight) {
          maxModeWeight = w;
          bestMode = Number(mStr);
        }
      }

      let bestTier: "core" | "flex" | "tech";
      if (rate >= 0.8) bestTier = "core";
      else if (rate >= 0.3) bestTier = "flex";
      else bestTier = "tech";

      return {
        code: c.code,
        tier: bestTier,
        rate,
        mode: bestMode,
        avg,
      };
    });

    return {
      id: arch.id,
      name: arch.name,
      colors: arch.colors,
      keyCard: arch.keyCard,
      lists: arch.lists,
      share,
      top8Share,
      winShare,
      points,
      cards,
      median: arch.median,
      variants: [{ id: `${arch.id}-combined`, lists: arch.lists, points, median: arch.median, simulavel: true }],
    };
  });

  return {
    lists: totalLists,
    events: totalEvents,
    archetypes: archetypes.sort((a, b) => b.points - a.points || b.share - a.share),
  };
}

/**
 * Lista todos os formatos disponíveis em metaCores, ordenando a Temporada Atual (GD05 / GD05.5)
 * no topo, seguida pelos formatos em ordem decrescente e pela opção de histórico geral (ALL).
 */
// GD05.5 é um recorte por data do GD05 (listas desde o ST11–ST14, ver scripts/gundam-meta-cores.mjs), não uma
// temporada à parte: somar os dois contaria essas listas duas vezes. A temporada atual é o próprio GD05.
const CURRENT_SEASON_KEYS = ["GD05"];
const ALL_SEASON_KEYS = ["GD01", "GD02", "GD03", "GD04", "GD05"];

export function getAvailableFormats(): FormatOverviewItem[] {
  const result: FormatOverviewItem[] = [];

  // 1. Temporada Atual Combinada: GD05 + GD05.5
  const currentSeason = aggregateFormatData(CURRENT_SEASON_KEYS);
  result.push({
    format: "GD05_COMBINED",
    totalLists: currentSeason.lists,
    totalEvents: currentSeason.events,
    archetypeCount: currentSeason.archetypes.length,
    topArchetypes: currentSeason.archetypes.slice(0, 3).map((a) => ({
      name: a.name,
      share: a.share,
      colors: a.colors,
    })),
  });

  // 2. Formatos individuais em ordem decrescente (mais recente para mais antigo)
  const orderedKeys = ["GD05.5", "GD05", "GD04", "GD03", "GD02", "GD01"];
  for (const formatKey of orderedKeys) {
    const formatData = META_CORES.formats[formatKey as keyof typeof META_CORES.formats];
    if (!formatData) continue;
    const archetypes = formatData.archetypes || [];
    result.push({
      format: formatKey,
      totalLists: formatData.lists,
      totalEvents: formatData.events,
      archetypeCount: archetypes.length,
      topArchetypes: archetypes.slice(0, 3).map((a) => ({
        name: a.name,
        share: a.share,
        colors: a.colors,
      })),
    });
  }

  // 3. Histórico Geral (Todas as Temporadas)
  const allSeasons = aggregateFormatData(ALL_SEASON_KEYS);
  result.push({
    format: "ALL",
    totalLists: allSeasons.lists,
    totalEvents: allSeasons.events,
    archetypeCount: allSeasons.archetypes.length,
    topArchetypes: allSeasons.archetypes.slice(0, 3).map((a) => ({
      name: a.name,
      share: a.share,
      colors: a.colors,
    })),
  });

  return result;
}

/**
 * Retorna as estatísticas completas de metagame, presença, conversão em top cut,
 * vitórias e núcleos de arquétipo (core/flex/tech) para o formato/temporada especificado.
 */
export async function getFormatMetaBreakdown(
  prisma: PrismaClient,
  format: string,
  options?: { color?: string; minLists?: number },
): Promise<FormatMetaResponse | null> {
  const normalizedKey = format.trim().toUpperCase().replace(/\s+/g, "");

  let formatKey: string;
  let formatData: { lists: number; events: number; archetypes: any[] } | undefined;
  let tournamentLabel = `Torneios Competitivos Formato ${format} (Egman Events + DigiLab)`;

  if (
    normalizedKey === "GD05_COMBINED" ||
    normalizedKey === "CURRENT" ||
    normalizedKey === "GD05/GD05.5" ||
    normalizedKey === "GD05_GD05.5" ||
    normalizedKey === "GD05+GD05.5"
  ) {
    formatKey = "GD05_COMBINED";
    formatData = aggregateFormatData(CURRENT_SEASON_KEYS);
    tournamentLabel = "Torneios Competitivos Temporada Atual GD05 & GD05.5 (Egman Events + DigiLab)";
  } else if (normalizedKey === "ALL" || normalizedKey === "TODAS") {
    formatKey = "ALL";
    formatData = aggregateFormatData(ALL_SEASON_KEYS);
    tournamentLabel = "Torneios Competitivos de Todas as Temporadas (Egman Events + DigiLab)";
  } else {
    formatKey = format.toUpperCase();
    formatData = META_CORES.formats[formatKey as keyof typeof META_CORES.formats];
  }

  if (!formatData) {
    return null;
  }

  const cardMap = await getCardMap(prisma);
  const colorFilter = options?.color?.toLowerCase();
  const minLists = options?.minLists ?? 0;

  const rawArchetypes = formatData.archetypes || [];
  const filtered = rawArchetypes.filter((arch) => {
    if (arch.lists < minLists) return false;
    if (colorFilter && !arch.colors.some((c) => c.toLowerCase() === colorFilter)) {
      return false;
    }
    return true;
  });

  const enrichedArchetypes: FormatArchetypeSummary[] = filtered.map((arch) => {
    const isSmallSample = arch.lists < 10;
    const sampleWarning = arch.lists < 5
      ? "Poucos dados coletados para este arquétipo no formato — amostra indicativa."
      : isSmallSample
      ? "Amostra moderada — números com maior margem de variação."
      : null;

    const keyCardRow = cardMap.get(arch.keyCard);
    const keyCardDetail: FormatCardDetail | null = keyCardRow
      ? {
          code: arch.keyCard,
          name: keyCardRow.namePt || keyCardRow.nameEn || arch.keyCard,
          namePt: keyCardRow.namePt,
          imageUrl: keyCardRow.imageUrl,
          imageMediumUrl: keyCardRow.imageMediumUrl || keyCardRow.imageUrl,
          color: keyCardRow.color,
          cardType: keyCardRow.cardType,
          cost: keyCardRow.cost,
          level: keyCardRow.level,
          tier: "core",
          inclusionRate: 1,
          modeCopies: 4,
          avgCopies: 4,
        }
      : null;

    const core: FormatCardDetail[] = [];
    const flex: FormatCardDetail[] = [];
    const tech: FormatCardDetail[] = [];

    for (const card of arch.cards) {
      const c = cardMap.get(card.code);
      const detail: FormatCardDetail = {
        code: card.code,
        name: c?.namePt || c?.nameEn || card.code,
        namePt: c?.namePt || null,
        imageUrl: c?.imageUrl || null,
        imageMediumUrl: c?.imageMediumUrl || c?.imageUrl || null,
        color: c?.color || null,
        cardType: c?.cardType || "UNIT",
        cost: c?.cost ?? null,
        level: c?.level ?? null,
        tier: card.tier,
        inclusionRate: card.rate,
        modeCopies: card.mode,
        avgCopies: Number(card.avg.toFixed(2)),
      };

      if (card.tier === "core") core.push(detail);
      else if (card.tier === "flex") flex.push(detail);
      else tech.push(detail);
    }

    const bestVariant = arch.variants?.[0];
    const medianDecklist = bestVariant?.median || (arch as any).median || {};

    return {
      id: arch.id,
      name: arch.name,
      colors: arch.colors,
      keyCard: arch.keyCard,
      keyCardDetail,
      lists: arch.lists,
      share: arch.share,
      top8Share: arch.top8Share,
      winShare: arch.winShare,
      points: arch.points,
      isSmallSample,
      sampleWarning,
      cards: {
        core: core.sort((a, b) => b.inclusionRate - a.inclusionRate || b.avgCopies - a.avgCopies),
        flex: flex.sort((a, b) => b.inclusionRate - a.inclusionRate || b.avgCopies - a.avgCopies),
        tech: tech.sort((a, b) => b.inclusionRate - a.inclusionRate || b.avgCopies - a.avgCopies),
      },
      medianDecklist,
    };
  });

  // MetagameProvenance compatível com o componente DataSourceNote
  const provenance: MetagameProvenance = {
    totalDecks: formatData.lists,
    totalTournaments: formatData.events,
    startDate: null,
    endDate: null,
    tournaments: [
      {
        id: `meta-cores-${formatKey}`,
        name: tournamentLabel,
        date: META_CORES.generatedAt,
        organizer: "Circuitos Oficiais & Regionais",
        playerCount: null,
        deckCount: formatData.lists,
        tier: "LARGE_OFFICIAL",
        sourceUrl: META_CORES.source,
      },
    ],
  };

  return {
    format: formatKey,
    totalLists: formatData.lists,
    totalEvents: formatData.events,
    generatedAt: META_CORES.generatedAt,
    sourceUrl: META_CORES.source,
    archetypes: enrichedArchetypes.sort((a, b) => b.points - a.points || b.share - a.share),
    provenance,
  };
}

/**
 * Evolução temporal de arquétipos através dos formatos GD01 -> GD05.
 */
export function getFormatsEvolution(): ArchetypeEvolution[] {
  const evolutionMap = new Map<string, { name: string; colors: string[]; points: ArchetypeEvolutionPoint[] }>();

  for (const [formatKey, formatData] of Object.entries(META_CORES.formats)) {
    for (const arch of formatData.archetypes || []) {
      // Agrupa por nome de arquétipo normalizado
      const key = arch.name.toLowerCase().trim();
      const existing = evolutionMap.get(key);
      const point: ArchetypeEvolutionPoint = {
        format: formatKey,
        lists: arch.lists,
        share: arch.share,
        top8Share: arch.top8Share,
        winShare: arch.winShare,
        points: arch.points,
      };

      if (existing) {
        existing.points.push(point);
      } else {
        evolutionMap.set(key, {
          name: arch.name,
          colors: arch.colors,
          points: [point],
        });
      }
    }
  }

  return Array.from(evolutionMap.values())
    .filter((a) => a.points.length >= 2)
    .sort((a, b) => {
      const maxA = Math.max(...a.points.map((p) => p.share));
      const maxB = Math.max(...b.points.map((p) => p.share));
      return maxB - maxA;
    });
}
