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
 * Lista todos os formatos disponíveis em metaCores (GD01 a GD05) com métricas gerais.
 */
export function getAvailableFormats(): FormatOverviewItem[] {
  const formatsObj = META_CORES.formats || {};
  const result: FormatOverviewItem[] = [];

  for (const [formatKey, formatData] of Object.entries(formatsObj)) {
    const archetypes = formatData.archetypes || [];
    const top = archetypes.slice(0, 3).map((a) => ({
      name: a.name,
      share: a.share,
      colors: a.colors,
    }));

    result.push({
      format: formatKey,
      totalLists: formatData.lists,
      totalEvents: formatData.events,
      archetypeCount: archetypes.length,
      topArchetypes: top,
    });
  }

  return result.sort((a, b) => a.format.localeCompare(b.format));
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
  const formatKey = format.toUpperCase();
  const formatData = META_CORES.formats[formatKey as keyof typeof META_CORES.formats];

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
        name: `Torneios Competitivos Formato ${formatKey} (Egman Events / Bandai)`,
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
