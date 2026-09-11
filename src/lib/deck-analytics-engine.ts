/**
 * Motor de Telemetria e Análise Estatística Unificada — Portal Gundam TCG Brasil
 *
 * Garante 100% de paridade e fidelidade técnica entre a visualização do Deckbuilder
 * (/deckbuilder/:id) e a visualização Pública (/deck/:shareId).
 *
 * Utiliza termos em PT-BR consagrados pela comunidade:
 * - Staple (75%+ presença)
 * - Peça-Chave / Engine (50%-74% presença)
 * - Comum / Suporte (25%-49% presença)
 * - Opção Tática / Tech (<25% presença)
 */

import { buildLevelCurve, lowLevelUnitStats, LOW_LEVEL_MAX, type LowLevelUnitStats } from "./deck-level-stats";
import { lowCostStats, LOW_COST_MAX, type LowCostStats } from "./deck-cost-stats";

export { LOW_COST_MAX, LOW_LEVEL_MAX };

export const EFFECT_KEYWORD_LIST = ["Repair", "Breach", "Support", "Blocker", "First Strike", "High-Maneuver", "Suppression"];
export const NUMERIC_KEYWORDS = new Set(["Repair", "Breach", "Support"]);
export const TRIGGER_KEYWORD_LIST = ["Deploy", "Burst", "Once per Turn", "During Link", "During Pair", "When Paired", "Attack", "Activate"];

export function extractKeywordValue(effect: string | null | undefined, name: string): number | null {
  if (!effect) return null;
  const match = effect.match(new RegExp(`\\b${name}\\s+(\\d+)\\b`, "i"));
  return match ? Number(match[1]) : null;
}

export interface DeckCardModel {
  id: string;
  code: string;
  name: string;
  namePt?: string | null;
  imageUrl?: string | null;
  imageMediumUrl?: string | null;
  imageLargeUrl?: string | null;
  color?: string | null;
  type: string;
  rarity?: string | null;
  cost: number;
  level?: number | null;
  ap?: number | null;
  hp?: number | null;
  trait?: string | null;
  series?: string | null;
  quantity: number;
  section: string;
  keywords: string[];
  triggerKeywords?: string[];
  effect?: string | null;
  linkText?: string | null;
  pilotName?: string | null;
}

export type MetagameTier = "STAPLE" | "KEY" | "COMMON" | "TECH";

export interface MetagameTierStyle {
  tier: MetagameTier;
  label: string;
  badgeClass: string;
  borderClass: string;
  dotClass: string;
  accentHex: string;
  description: string;
  minPresence: number;
}

export const METAGAME_TIERS: Record<MetagameTier, MetagameTierStyle> = {
  STAPLE: {
    tier: "STAPLE",
    label: "Staple",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
    borderClass: "border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
    dotClass: "bg-emerald-400",
    accentHex: "#10b981",
    description: "Presença em 75%+ dos decks analisados — cartas indispensáveis",
    minPresence: 75,
  },
  KEY: {
    tier: "KEY",
    label: "Peça-Chave / Engine",
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/40",
    borderClass: "border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.15)]",
    dotClass: "bg-amber-400",
    accentHex: "#f59e0b",
    description: "Presença de 50% a 74% — núcleo mecânico e temático do arquétipo",
    minPresence: 50,
  },
  COMMON: {
    tier: "COMMON",
    label: "Comum / Suporte",
    badgeClass: "bg-sky-500/15 text-sky-400 border-sky-500/40",
    borderClass: "border-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.15)]",
    dotClass: "bg-sky-400",
    accentHex: "#0ea5e9",
    description: "Presença de 25% a 49% — suporte regular ou alternativas viáveis",
    minPresence: 25,
  },
  TECH: {
    tier: "TECH",
    label: "Opção Tática / Tech",
    badgeClass: "bg-slate-500/15 text-slate-300 border-slate-600/40",
    borderClass: "border-slate-700 hover:border-slate-500",
    dotClass: "bg-slate-400",
    accentHex: "#64748b",
    description: "Presença abaixo de 25% — cartas situacionais para matchups específicos",
    minPresence: 0,
  },
};

export function getCardMetagameTier(presenceRate: number): MetagameTierStyle {
  if (presenceRate >= 75) return METAGAME_TIERS.STAPLE;
  if (presenceRate >= 50) return METAGAME_TIERS.KEY;
  if (presenceRate >= 25) return METAGAME_TIERS.COMMON;
  return METAGAME_TIERS.TECH;
}

export interface DeckTelemetryStats {
  mainDeckCount: number;
  uniqueCount: number;
  cardsAtLimit: number;
  cardsWithKeywords: number;
  dominantColor: string;
  dominantTrait: string;
  dominantSeries: string;
  dominantType: string;
  synergyScore: number;
  synergyLabel: string;
  diagnostics: Array<{ kind: "ok" | "warn"; label: string; value: string }>;
  archetypeBlocks: Array<{ label: string; value: string; hint: string }>;
  colorBreakdown: Array<{ name: string; value: number; pct: number }>;
  traitBreakdown: Array<{ name: string; value: number; pct: number }>;
  seriesBreakdown: Array<{ name: string; value: number; pct: number }>;
  typeBreakdown: Array<{ name: string; value: number; pct: number }>;
  effectKeywords: Array<{ name: string; count: number; pct: number; valueBreakdown?: Array<[number, number]> | null }>;
  triggerKeywords: Array<{ name: string; count: number; pct: number }>;
  curveData: Array<{ cost: string; quantity: number }>;
  colorPieData: Array<{ name: string; value: number }>;
  typeBarData: Array<{ name: string; quantity: number }>;
  levelData: Array<{ level: string; quantity: number }>;
  apData: Array<{ ap: string; quantity: number }>;
  hpData: Array<{ hp: string; quantity: number }>;
  handOdds: LowCostStats;
  lowLevelStats: LowLevelUnitStats;
}

export function computeUnifiedDeckTelemetry(mainRows: DeckCardModel[]): DeckTelemetryStats {
  const mainDeckCount = mainRows.reduce((sum, r) => sum + (r.quantity || 1), 0);
  const total = mainDeckCount || 1;
  const uniqueCount = mainRows.length;
  const cardsAtLimit = mainRows.filter((r) => r.quantity >= 4).length;
  const cardsWithKeywords = mainRows.filter((r) => r.keywords && r.keywords.length > 0).length;

  // 1. Cores
  const colorMap = new Map<string, number>();
  mainRows.forEach((r) => {
    if (r.color) colorMap.set(r.color, (colorMap.get(r.color) || 0) + r.quantity);
  });
  const colorPieData = Array.from(colorMap.entries()).map(([name, value]) => ({ name, value }));
  const colorBreakdown = [...colorPieData]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((item) => ({ ...item, pct: Math.round((item.value / total) * 100) }));
  const dominantColor = colorBreakdown[0]?.name || "";

  // 2. Traits
  const traitMap = new Map<string, number>();
  mainRows.forEach((r) => {
    if (r.trait) traitMap.set(r.trait, (traitMap.get(r.trait) || 0) + r.quantity);
  });
  const topTraits = Array.from(traitMap.entries()).sort((a, b) => b[1] - a[1]);
  const dominantTrait = topTraits[0]?.[0] || "";
  const dominantTraitCount = topTraits[0]?.[1] || 0;
  const traitBreakdown = topTraits.slice(0, 4).map(([name, value]) => ({
    name,
    value,
    pct: Math.round((value / total) * 100),
  }));

  // 3. Séries
  const seriesMap = new Map<string, number>();
  mainRows.forEach((r) => {
    const key = r.series || "Sem série definida";
    seriesMap.set(key, (seriesMap.get(key) || 0) + r.quantity);
  });
  const seriesBreakdown = Array.from(seriesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, value]) => ({ name, value, pct: Math.round((value / total) * 100) }));
  const dominantSeries = seriesBreakdown[0]?.name === "Sem série definida" ? "" : seriesBreakdown[0]?.name || "";

  // 4. Tipos
  const typeMap = new Map<string, number>();
  mainRows.forEach((r) => {
    const t = (r.type || "UNIT").toUpperCase();
    typeMap.set(t, (typeMap.get(t) || 0) + r.quantity);
  });
  const typeBarData = Array.from(typeMap.entries()).map(([name, quantity]) => ({ name, quantity }));
  const typeBreakdown = [...typeBarData]
    .sort((a, b) => b.quantity - a.quantity)
    .map((item) => ({ name: item.name, value: item.quantity, pct: Math.round((item.quantity / total) * 100) }));
  const dominantType = typeBreakdown[0]?.name || "";

  // 5. Curva de custo
  const costMap = new Map<number, number>();
  mainRows.forEach((r) => {
    const cost = typeof r.cost === "number" ? r.cost : 0;
    costMap.set(cost, (costMap.get(cost) || 0) + r.quantity);
  });
  const curveData = Array.from(costMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([cost, quantity]) => ({ cost: String(cost), quantity }));

  // 6. Unidades (Nível, AP, HP)
  const unitRows = mainRows.filter((r) => (r.type || "").toUpperCase() === "UNIT");
  const levelData = buildLevelCurve(unitRows);

  const apMap = new Map<number, number>();
  unitRows.forEach((r) => {
    if (typeof r.ap === "number") apMap.set(r.ap, (apMap.get(r.ap) || 0) + r.quantity);
  });
  const apData = Array.from(apMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ap, quantity]) => ({ ap: String(ap), quantity }));

  const hpMap = new Map<number, number>();
  unitRows.forEach((r) => {
    if (typeof r.hp === "number") hpMap.set(r.hp, (hpMap.get(r.hp) || 0) + r.quantity);
  });
  const hpData = Array.from(hpMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hp, quantity]) => ({ hp: String(hp), quantity }));

  // 7. Probabilidades Hipergeométricas de Abertura
  const handOdds = lowCostStats(mainRows, mainDeckCount);
  const lowLevelStats = lowLevelUnitStats(unitRows, mainDeckCount);

  // 8. Keywords de Efeito e Gatilho
  const effectKeywords = EFFECT_KEYWORD_LIST.map((name) => {
    const rows = mainRows.filter((row) => row.keywords && row.keywords.includes(name));
    const count = rows.reduce((sum, r) => sum + r.quantity, 0);
    if (!count) return null;
    let valueBreakdown: Array<[number, number]> | null = null;
    if (NUMERIC_KEYWORDS.has(name)) {
      const valMap = new Map<number, number>();
      rows.forEach((row) => {
        const val = extractKeywordValue(row.effect, name);
        if (val !== null) valMap.set(val, (valMap.get(val) || 0) + row.quantity);
      });
      valueBreakdown = Array.from(valMap.entries()).sort((a, b) => a[0] - b[0]);
    }
    return { name, count, pct: Math.round((count / total) * 100), valueBreakdown };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  const triggerKeywords = TRIGGER_KEYWORD_LIST.map((name) => {
    const count = mainRows
      .filter((row) => row.triggerKeywords && row.triggerKeywords.includes(name))
      .reduce((sum, r) => sum + r.quantity, 0);
    return count ? { name, count, pct: Math.round((count / total) * 100) } : null;
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  // 9. Pontuação de Sinergia (Fórmula idêntica ao Deckbuilder: 0 a 100)
  let points = 0;
  if (dominantColor && (colorMap.get(dominantColor) || 0) >= Math.max(8, mainDeckCount * 0.35)) points += 35;
  if (dominantTrait && dominantTraitCount >= Math.max(6, mainDeckCount * 0.25)) points += 35;
  if (cardsWithKeywords >= Math.max(4, Math.floor(mainDeckCount * 0.2))) points += 15;
  if (uniqueCount >= 12) points += 15;
  const synergyScore = Math.min(100, points);
  const synergyLabel = synergyScore >= 80 ? "sinergia forte" : synergyScore >= 55 ? "sinergia em formação" : "base ainda dispersa";

  // 10. Diagnósticos Operacionais (5 checagens rápidas)
  const diagnostics: Array<{ kind: "ok" | "warn"; label: string; value: string }> = [
    { kind: mainDeckCount > 0 ? "ok" : "warn", label: "Volume atual", value: `${mainDeckCount} cartas na lista` },
    { kind: uniqueCount >= 10 ? "ok" : "warn", label: "Variedade", value: `${uniqueCount} cartas únicas` },
    { kind: cardsAtLimit > 0 ? "ok" : "warn", label: "Cópias no limite", value: `${cardsAtLimit} cartas em 4x` },
    { kind: cardsWithKeywords > 0 ? "ok" : "warn", label: "Cobertura por keywords", value: `${cardsWithKeywords} cartas com keywords mapeadas` },
    { kind: dominantTrait ? "ok" : "warn", label: "Linha principal", value: dominantTrait ? `${dominantTrait} · ${dominantTraitCount}` : "Sem trait dominante ainda" },
  ];

  // 11. Blocos de Identidade Tática (Cor, Trait, Série, Tipo)
  const archetypeBlocks: Array<{ label: string; value: string; hint: string }> = [];
  if (dominantColor) {
    const count = colorMap.get(dominantColor) || 0;
    archetypeBlocks.push({
      label: "Cor-base",
      value: dominantColor,
      hint: `${count}/${mainDeckCount} cartas · ${Math.round((count / total) * 100)}% do deck principal.`,
    });
  }
  if (dominantTrait) {
    archetypeBlocks.push({
      label: "Trait-base",
      value: dominantTrait,
      hint: `${dominantTraitCount}/${mainDeckCount} cartas · núcleo de identidade do deck.`,
    });
  }
  if (dominantSeries) {
    archetypeBlocks.push({
      label: "Série-base",
      value: dominantSeries,
      hint: "Linha temática mais recorrente.",
    });
  }
  if (dominantType) {
    const count = typeMap.get(dominantType) || 0;
    archetypeBlocks.push({
      label: "Tipo-base",
      value: dominantType,
      hint: `${count}/${mainDeckCount} cartas · tipo mais frequente.`,
    });
  }

  return {
    mainDeckCount,
    uniqueCount,
    cardsAtLimit,
    cardsWithKeywords,
    dominantColor,
    dominantTrait,
    dominantSeries,
    dominantType,
    synergyScore,
    synergyLabel,
    diagnostics,
    archetypeBlocks,
    colorBreakdown,
    traitBreakdown,
    seriesBreakdown,
    typeBreakdown,
    effectKeywords,
    triggerKeywords,
    curveData,
    colorPieData,
    typeBarData,
    levelData,
    apData,
    hpData,
    handOdds,
    lowLevelStats,
  };
}
