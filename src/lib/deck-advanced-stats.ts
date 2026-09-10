/* Estatísticas Avançadas do Deck — Portal Gundam TCG Brasil
 * Implementa telemetria no estilo Exburst: 6 histogramas, probabilidade de jogada no Turno 1,
 * contagem de Burst/Counters e classificação tática (Staples, Engine, Techs). */

import { hypergeometricAtLeastOne } from "./deck-level-stats";

export interface HistogramBin {
  label: string;
  value: number;
  count: number;
}

export interface AdvancedDeckStats {
  // 6 Histogramas (Exburst style)
  levelRange: HistogramBin[];
  costRange: HistogramBin[];
  unitLevelRange: HistogramBin[];
  unitCostRange: HistogramBin[];
  apRange: HistogramBin[];
  hpRange: HistogramBin[];

  // Estatísticas de Jogo (Game Statistics)
  burstCount: number;
  quickCountersCount: number;
  turn1Playable: {
    eligibleCardsCount: number;
    probability5Cards: number; // Mão inicial de 5
    probabilityWithMulligan: number; // Com mulligan
    probability6Cards: number; // Turno 1 (5 + 1 draw)
    probabilityTurn1WithMulligan: number;
  };

  // Classificação Tática de Metagame
  staples: Array<{ code: string; name: string; quantity: number; color?: string; reason: string }>;
  engine: Array<{ code: string; name: string; quantity: number; color?: string; reason: string }>;
  techs: Array<{ code: string; name: string; quantity: number; color?: string; reason: string }>;
  metaComparison: {
    deckAvgCost: number;
    metaAvgCost: number;
    speedVerdict: "Rápido / Agressivo" | "Equilibrado / Midrange" | "Controle / Late Game";
  };
}

export function computeAdvancedDeckStats(
  mainCards: Array<{
    code: string;
    name?: string;
    namePt?: string | null;
    type?: string | null;
    cost?: number | null;
    level?: number | null;
    ap?: number | null;
    hp?: number | null;
    color?: string | null;
    effect?: string | null;
    quantity?: number;
    triggerKeywords?: string[];
    trait?: string | null;
  }>,
  mainCount: number
): AdvancedDeckStats {
  // 1. Histogramas
  const buildBins = (maxBin: number, minBin = 1): Map<number, number> => {
    const map = new Map<number, number>();
    for (let i = minBin; i <= maxBin; i++) map.set(i, 0);
    return map;
  };

  const levelMap = buildBins(8, 1);
  const costMap = buildBins(8, 0);
  const unitLevelMap = buildBins(8, 1);
  const unitCostMap = buildBins(8, 1);
  const apMap = buildBins(8, 0);
  const hpMap = buildBins(8, 1);

  let burstCount = 0;
  let quickCountersCount = 0;
  let turn1PlayableCardsCount = 0;

  for (const card of mainCards) {
    const qty = card.quantity || 1;
    const isUnit = (card.type || "").toUpperCase() === "UNIT";
    const isBase = (card.type || "").toUpperCase() === "BASE";
    const effect = card.effect || "";

    // Level Range (todas as cartas com level)
    if (typeof card.level === "number" && card.level >= 1) {
      const bucket = Math.min(card.level, 8);
      levelMap.set(bucket, (levelMap.get(bucket) || 0) + qty);
      if (isUnit) {
        unitLevelMap.set(bucket, (unitLevelMap.get(bucket) || 0) + qty);
      }
    }

    // Cost Range (todas as cartas com custo)
    if (typeof card.cost === "number" && card.cost >= 0) {
      const bucket = Math.min(card.cost, 8);
      costMap.set(bucket, (costMap.get(bucket) || 0) + qty);
      if (isUnit) {
        unitCostMap.set(bucket, (unitCostMap.get(bucket) || 0) + qty);
      }
    }

    // AP / HP das Unidades
    if (isUnit) {
      if (typeof card.ap === "number" && card.ap >= 0) {
        const bucket = Math.min(card.ap, 8);
        apMap.set(bucket, (apMap.get(bucket) || 0) + qty);
      }
      if (typeof card.hp === "number" && card.hp >= 1) {
        const bucket = Math.min(card.hp, 8);
        hpMap.set(bucket, (hpMap.get(bucket) || 0) + qty);
      }
    }

    // Burst
    if (
      effect.toLowerCase().includes("burst") ||
      (card.triggerKeywords && card.triggerKeywords.some((k) => k.toLowerCase().includes("burst")))
    ) {
      burstCount += qty;
    }

    // Quick Counters / Ação Rápida
    if (
      effect.includes("【Action】") ||
      effect.includes("【Counter】") ||
      effect.toLowerCase().includes("counter") ||
      effect.toLowerCase().includes("blocker") ||
      effect.toLowerCase().includes("quick")
    ) {
      quickCountersCount += qty;
    }

    // Turn 1 Playable (Unit ou Base de custo <= 1 e level <= 1)
    if ((isUnit || isBase) && typeof card.cost === "number" && card.cost <= 1) {
      if (card.level === undefined || card.level === null || card.level <= 1) {
        turn1PlayableCardsCount += qty;
      }
    }
  }

  const mapToBins = (map: Map<number, number>, max: number): HistogramBin[] => {
    return Array.from(map.entries()).map(([val, count]) => ({
      label: val === max ? `${val}+` : String(val),
      value: val,
      count,
    }));
  };

  // 2. Probabilidades hipergeométricas de Turno 1 (0..1)
  const prob5 = hypergeometricAtLeastOne(mainCount, turn1PlayableCardsCount, 5);
  const probWithMulligan5 = 1 - (1 - prob5) * (1 - prob5);
  const prob6 = hypergeometricAtLeastOne(mainCount, turn1PlayableCardsCount, 6); // 5 + 1 compra do turno 1
  const probWithMulligan6 = 1 - (1 - prob6) * (1 - prob6);

  // 3. Classificação Tática (Staples, Engine, Techs)
  const staples: AdvancedDeckStats["staples"] = [];
  const engine: AdvancedDeckStats["engine"] = [];
  const techs: AdvancedDeckStats["techs"] = [];

  // Trait dominante para detectar engine
  const traitCounts = new Map<string, number>();
  for (const c of mainCards) {
    if (c.trait) {
      traitCounts.set(c.trait, (traitCounts.get(c.trait) || 0) + (c.quantity || 1));
    }
  }
  let dominantTrait = "";
  let maxTraitCount = 0;
  for (const [trait, count] of traitCounts.entries()) {
    if (count > maxTraitCount) {
      maxTraitCount = count;
      dominantTrait = trait;
    }
  }

  for (const c of mainCards) {
    const qty = c.quantity || 1;
    const name = c.namePt || c.name || c.code;

    if (qty === 4 && (c.cost ?? 0) <= 2) {
      staples.push({
        code: c.code,
        name,
        quantity: qty,
        color: c.color || undefined,
        reason: "4 cópias · Agilidade de início de jogo (Staple de curva)",
      });
    } else if (dominantTrait && c.trait && c.trait.includes(dominantTrait)) {
      engine.push({
        code: c.code,
        name,
        quantity: qty,
        color: c.color || undefined,
        reason: `Núcleo tático (${c.trait})`,
      });
    } else if (qty <= 2 && (c.cost ?? 0) >= 3) {
      techs.push({
        code: c.code,
        name,
        quantity: qty,
        color: c.color || undefined,
        reason: `${qty}x cópias · Resposta situacional / Finalizador`,
      });
    } else {
      engine.push({
        code: c.code,
        name,
        quantity: qty,
        color: c.color || undefined,
        reason: "Suporte do arquétipo",
      });
    }
  }

  // Comparação com Metagame
  const totalCost = mainCards.reduce((acc, c) => acc + (c.cost || 0) * (c.quantity || 1), 0);
  const deckAvgCost = mainCount > 0 ? Number((totalCost / mainCount).toFixed(2)) : 0;
  const metaAvgCost = 2.85; // Média padrão do metagame Gundam TCG
  const speedVerdict =
    deckAvgCost < 2.5
      ? "Rápido / Agressivo"
      : deckAvgCost <= 3.1
      ? "Equilibrado / Midrange"
      : "Controle / Late Game";

  return {
    levelRange: mapToBins(levelMap, 8),
    costRange: mapToBins(costMap, 8),
    unitLevelRange: mapToBins(unitLevelMap, 8),
    unitCostRange: mapToBins(unitCostMap, 8),
    apRange: mapToBins(apMap, 8),
    hpRange: mapToBins(hpMap, 8),
    burstCount,
    quickCountersCount,
    turn1Playable: {
      eligibleCardsCount: turn1PlayableCardsCount,
      probability5Cards: prob5,
      probabilityWithMulligan: probWithMulligan5,
      probability6Cards: prob6,
      probabilityTurn1WithMulligan: probWithMulligan6,
    },
    staples: staples.slice(0, 5),
    engine: engine.slice(0, 8),
    techs: techs.slice(0, 5),
    metaComparison: {
      deckAvgCost,
      metaAvgCost,
      speedVerdict,
    },
  };
}
