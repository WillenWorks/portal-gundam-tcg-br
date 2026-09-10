import { useState, useEffect, useMemo } from "react";
import { 
  Activity, 
  Cpu, 
  Sparkles, 
  Target, 
  Zap, 
  ShieldCheck, 
  Plus, 
  ChevronRight, 
  RefreshCw,
  SlidersHorizontal,
  Flame,
  HelpCircle
} from "lucide-react";
import { api, type ClassifiedMetaCard, type MetaRecommendationsResponse } from "@/lib/api";
import type { CardRecord, DeckEntry } from "@/modules/core/types";
import { calculateHypergeometric } from "@/lib/meta-analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GAME_COLOR_HEX } from "@/lib/gundam-catalog";
import gundamCardBack from "@/assets/gundam-card-back.png";

interface VedaTelemetryAssistantProps {
  entries: DeckEntry[];
  cardCache: Record<string, CardRecord>;
  onAddCard: (card: CardRecord) => void;
  availableCards: CardRecord[];
}

const INITIAL_SHIELD_COUNT = 6;
const OPENING_HAND_SIZE = 5;

export function VedaTelemetryAssistant({
  entries,
  cardCache,
  onAddCard,
  availableCards,
}: VedaTelemetryAssistantProps) {
  const [recommendations, setRecommendations] = useState<MetaRecommendationsResponse | null>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [activeTab, setActiveTab] = useState<"SYNERGIES" | "STAPLES" | "TECHS">("SYNERGIES");

  // Cartas expandidas do deck principal
  const mainCards = useMemo(() => {
    return entries
      .filter((e) => e.section !== "resource")
      .map((e) => {
        const c = cardCache[e.cardId];
        return c ? { ...c, quantity: e.quantity } : null;
      })
      .filter(Boolean) as (CardRecord & { quantity: number })[];
  }, [entries, cardCache]);

  const totalMainCards = useMemo(() => {
    return mainCards.reduce((acc, c) => acc + c.quantity, 0);
  }, [mainCards]);

  // Cores presentes no deck
  const deckColors = useMemo(() => {
    const set = new Set<string>();
    mainCards.forEach((c) => {
      if (c.color) set.add(c.color);
    });
    return Array.from(set);
  }, [mainCards]);

  // Códigos das cartas no deck principal
  const cardCodes = useMemo(() => {
    return Array.from(new Set(mainCards.map((c) => c.code)));
  }, [mainCards]);

  // 1. Telemetria: Low Level Units (Lv. 1 a 3)
  const lowLevelUnitsCount = useMemo(() => {
    return mainCards
      .filter((c) => c.type === "UNIT" && typeof c.level === "number" && c.level >= 1 && c.level <= 3)
      .reduce((acc, c) => acc + c.quantity, 0);
  }, [mainCards]);

  const lowLevelOdds = useMemo(() => {
    if (totalMainCards < OPENING_HAND_SIZE || lowLevelUnitsCount === 0) {
      return { exact: 0, atLeast: 0, withMulligan: 0 };
    }
    return calculateHypergeometric(totalMainCards, lowLevelUnitsCount, OPENING_HAND_SIZE, 1);
  }, [totalMainCards, lowLevelUnitsCount]);

  // 2. Telemetria: Shield Burst Probability (6 escudos no setup)
  const burstCardsCount = useMemo(() => {
    return mainCards
      .filter((c) => {
        const hasTrigger = c.triggerKeywords?.some((k) => k.toLowerCase() === "burst");
        const hasKeyword = c.keywords?.some((k) => k.toLowerCase() === "burst");
        const hasEffectBurst = /burst/i.test(c.effect || "");
        return hasTrigger || hasKeyword || hasEffectBurst;
      })
      .reduce((acc, c) => acc + c.quantity, 0);
  }, [mainCards]);

  const shieldBurstOdds = useMemo(() => {
    if (totalMainCards < INITIAL_SHIELD_COUNT || burstCardsCount === 0) {
      return { exact: 0, atLeast: 0, withMulligan: 0 };
    }
    return calculateHypergeometric(totalMainCards, burstCardsCount, INITIAL_SHIELD_COUNT, 1);
  }, [totalMainCards, burstCardsCount]);

  // 3. Curva Composta Custo × Nível
  const curveStats = useMemo(() => {
    if (totalMainCards === 0) return { avgCost: 0, avgLevel: 0, compositeScore: 0, profile: "Vazio" };
    let sumCost = 0;
    let sumLevel = 0;
    let unitCount = 0;

    mainCards.forEach((c) => {
      sumCost += (c.cost ?? 0) * c.quantity;
      if (c.type === "UNIT" && typeof c.level === "number") {
        sumLevel += c.level * c.quantity;
        unitCount += c.quantity;
      }
    });

    const avgCost = sumCost / totalMainCards;
    const avgLevel = unitCount > 0 ? sumLevel / unitCount : avgCost * 1.2;
    const compositeScore = avgCost * 0.6 + avgLevel * 0.4;

    let profile = "Midrange Balanceado";
    if (compositeScore < 2.8) profile = "Agressivo (Rush / Tempo)";
    else if (compositeScore > 4.2) profile = "Controle Pesado (Late Game)";

    return { avgCost, avgLevel, compositeScore, profile };
  }, [mainCards, totalMainCards]);

  // Busca de recomendações por Lift quando a lista de cartas mudar significativamente
  const fetchRecommendations = () => {
    if (cardCodes.length === 0) {
      setRecommendations(null);
      return;
    }
    setLoadingRecs(true);
    api.getMetaRecommendations({ cardCodes, colors: deckColors })
      .then(setRecommendations)
      .catch((err) => console.error("Falha ao obter recomendações VEDA:", err))
      .finally(() => setLoadingRecs(false));
  };

  useEffect(() => {
    // Busca inicial ou quando adiciona as primeiras cartas
    if (cardCodes.length >= 2) {
      fetchRecommendations();
    }
  }, [cardCodes.length, deckColors.join(",")]);

  // Mapear carta recomendada para o objeto CardRecord completo da pool
  const resolveCardRecord = (rec: ClassifiedMetaCard): CardRecord => {
    const existing = availableCards.find((c) => c.code === rec.code);
    if (existing) return existing;

    return {
      id: rec.id,
      cardModelId: rec.id,
      printId: rec.id,
      code: rec.code,
      name: rec.name,
      namePt: rec.namePt ?? rec.name,
      color: (rec.color ?? "Blue") as CardRecord["color"],
      type: (rec.cardType ?? "Unit") as CardRecord["type"],
      cost: rec.cost ?? 0,
      level: rec.level ?? undefined,
      series: "",
      trait: "",
      keywords: [],
      triggerKeywords: [],
      effect: "",
      imageUrl: rec.imageUrl ?? rec.imageMediumUrl ?? undefined,
      imageMediumUrl: rec.imageMediumUrl ?? rec.imageUrl ?? undefined,
    };
  };

  return (
    <Card className="panel-cut rounded-none border-primary/40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-xl">
      <CardContent className="p-6">
        {/* Header VEDA */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-cyan-400 animate-pulse" />
              <p className="text-xs uppercase tracking-[0.24em] text-primary font-mono font-semibold">
                Assistente Tático VEDA · Telemetria Hipergeométrica & Lift
              </p>
              <Badge className="rounded-none border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 text-[10px] uppercase font-mono">
                Análise Preditiva
              </Badge>
            </div>
            <h3 className="mt-1 font-heading text-2xl uppercase tracking-wider text-white">
              Diagnóstico de Consistência & Sinergia Algorítmica
            </h3>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchRecommendations}
            disabled={loadingRecs || cardCodes.length === 0}
            className="rounded-none border-white/20 bg-white/5 text-xs uppercase tracking-wider font-mono hover:bg-primary/20 hover:border-primary text-slate-200"
          >
            <RefreshCw className={`mr-2 size-3.5 ${loadingRecs ? "animate-spin text-primary" : ""}`} />
            Recalcular Sinergias
          </Button>
        </div>

        {/* Painel de Telemetria de Probabilidades */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Chance de Unidade Inicial T1/T2 */}
          <div className="panel-cut border border-emerald-500/30 bg-emerald-950/20 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-mono">Presença Inicial T1/T2</p>
                <Target className="size-3.5 text-emerald-400" />
              </div>
              <p className="mt-2 font-heading text-3xl text-white">
                {(lowLevelOdds.atLeast * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-slate-300 mt-0.5">
                Com 1 Mulligan: <span className="text-emerald-300 font-semibold font-mono">{(lowLevelOdds.withMulligan * 100).toFixed(0)}%</span>
              </p>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 border-t border-white/10 pt-2">
              Probabilidade de abrir com pelo menos 1 Unidade Lv.1–3 ({lowLevelUnitsCount} na lista).
            </p>
          </div>

          {/* Card 2: Chance de Shield Burst nos 6 Escudos */}
          <div className="panel-cut border border-cyan-500/30 bg-cyan-950/20 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-mono">Defesa de Escudo (Burst)</p>
                <ShieldCheck className="size-3.5 text-cyan-400" />
              </div>
              <p className="mt-2 font-heading text-3xl text-white">
                {(shieldBurstOdds.atLeast * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-slate-300 mt-0.5">
                Cards com Burst: <span className="text-cyan-300 font-semibold font-mono">{burstCardsCount}</span>
              </p>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 border-t border-white/10 pt-2">
              Chance de pelo menos 1 ativação de Burst nos 6 escudos colocados no setup da partida.
            </p>
          </div>

          {/* Card 3: Escore Composto da Curva */}
          <div className="panel-cut border border-amber-500/30 bg-amber-950/20 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-mono">Curva Tática Composta</p>
                <SlidersHorizontal className="size-3.5 text-amber-400" />
              </div>
              <p className="mt-2 font-heading text-3xl text-accent">
                {curveStats.compositeScore.toFixed(2)}
              </p>
              <p className="text-xs text-slate-300 mt-0.5 truncate">
                Perfil: <span className="text-amber-300 font-semibold">{curveStats.profile}</span>
              </p>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 border-t border-white/10 pt-2">
              Custo Médio {curveStats.avgCost.toFixed(1)} × Nível Médio {curveStats.avgLevel.toFixed(1)}.
            </p>
          </div>

          {/* Card 4: Saturação e Identidade */}
          <div className="panel-cut border border-purple-500/30 bg-purple-950/20 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-purple-400 font-mono">Identidade de Cor</p>
                <Flame className="size-3.5 text-purple-400" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                {deckColors.map((col) => (
                  <span
                    key={col}
                    className="size-4 rounded-full border border-white/30"
                    style={{ backgroundColor: GAME_COLOR_HEX[col] || "#94a3b8" }}
                    title={col}
                  />
                ))}
                <span className="font-heading text-xl text-white">
                  {deckColors.join(" / ") || "Sem Cor"}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 font-mono">
                {totalMainCards} cartas no deck principal
              </p>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 border-t border-white/10 pt-2">
              Alinhamento de recursos e regras do formato (máximo 2 cores).
            </p>
          </div>
        </div>

        {/* Seção de Recomendações Preditivas por Lift */}
        <div className="mt-6 border-t border-white/10 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-4 text-primary" />
                <h4 className="font-heading text-xl uppercase tracking-wider text-white">
                  Sugestões Preditivas por Coocorrência & Lift
                </h4>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Baseado em correlações estatísticas entre as cartas da sua lista e o metagame consolidado.
              </p>
            </div>

            {/* Seletor de Abas de Recomendações */}
            <div className="flex items-center gap-1 bg-black/40 p-1 border border-white/10 panel-cut">
              <button
                type="button"
                onClick={() => setActiveTab("SYNERGIES")}
                className={`px-3 py-1 text-xs font-mono uppercase tracking-wider transition ${
                  activeTab === "SYNERGIES"
                    ? "bg-primary text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Sinergias de Lift ({recommendations?.synergies.length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("STAPLES")}
                className={`px-3 py-1 text-xs font-mono uppercase tracking-wider transition ${
                  activeTab === "STAPLES"
                    ? "bg-cyan-500 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Staples ({recommendations?.staples.length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("TECHS")}
                className={`px-3 py-1 text-xs font-mono uppercase tracking-wider transition ${
                  activeTab === "TECHS"
                    ? "bg-purple-500 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Techs ({recommendations?.techs.length ?? 0})
              </button>
            </div>
          </div>

          {/* Lista de Cartas Recomendadas */}
          <div className="mt-4">
            {loadingRecs ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 bg-white/5 border border-white/10 panel-cut" />
                ))}
              </div>
            ) : totalMainCards === 0 ? (
              <p className="text-xs text-slate-500 italic p-4 text-center border border-white/5 bg-slate-950/40 panel-cut">
                Adicione cartas ao deck para que o motor VEDA calcule correlações de Lift e afinidade de metagame.
              </p>
            ) : (
              <div>
                {activeTab === "SYNERGIES" && (
                  <RecommendationList
                    items={recommendations?.synergies || []}
                    type="SYNERGY"
                    onAdd={(rec) => onAddCard(resolveCardRecord(rec))}
                  />
                )}
                {activeTab === "STAPLES" && (
                  <RecommendationList
                    items={recommendations?.staples || []}
                    type="STAPLE"
                    onAdd={(rec) => onAddCard(resolveCardRecord(rec))}
                  />
                )}
                {activeTab === "TECHS" && (
                  <RecommendationList
                    items={recommendations?.techs || []}
                    type="TECH"
                    onAdd={(rec) => onAddCard(resolveCardRecord(rec))}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendationList({
  items,
  type,
  onAdd,
}: {
  items: Array<ClassifiedMetaCard & { liftScore?: number }>;
  type: "SYNERGY" | "STAPLE" | "TECH";
  onAdd: (item: ClassifiedMetaCard) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic p-4 text-center border border-white/5 bg-slate-950/40 panel-cut">
        Nenhuma recomendação adicional para esta categoria com a lista atual.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.slice(0, 8).map((card) => (
        <RecommendationCardItem key={card.id || card.code} card={card} type={type} onAdd={() => onAdd(card)} />
      ))}
    </div>
  );
}

function RecommendationCardItem({
  card,
  type,
  onAdd,
}: {
  card: ClassifiedMetaCard & { liftScore?: number };
  type: "SYNERGY" | "STAPLE" | "TECH";
  onAdd: () => void;
}) {
  const [imgSrc, setImgSrc] = useState(card.imageUrl || card.imageMediumUrl || gundamCardBack);

  return (
    <div className="panel-cut p-3 border border-white/10 bg-slate-950/70 hover:border-primary/50 transition-all flex items-center justify-between gap-3 group">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative w-12 h-16 shrink-0 bg-slate-900 border border-white/10 panel-cut overflow-hidden">
          <img
            src={imgSrc}
            alt={card.name}
            onError={() => setImgSrc(gundamCardBack)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            loading="lazy"
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: GAME_COLOR_HEX[card.color || "Blue"] || "#94a3b8" }}
            />
            <p className="text-[10px] font-mono text-slate-400 uppercase">{card.code}</p>
          </div>
          <h5 className="font-heading text-xs uppercase text-white truncate group-hover:text-primary transition-colors">
            {card.namePt || card.nameEn || card.name}
          </h5>
          <div className="flex items-center gap-2 mt-1">
            {card.liftScore && (
              <Badge className="rounded-none border-primary/30 bg-primary/10 text-primary text-[9px] font-mono px-1 py-0">
                Lift {card.liftScore.toFixed(2)}x
              </Badge>
            )}
            <span className="text-[10px] font-mono text-slate-400">
              Moda: {card.modeCopies}x
            </span>
          </div>
        </div>
      </div>

      <Button
        size="sm"
        onClick={onAdd}
        className="shrink-0 size-8 p-0 rounded-none bg-primary/20 border border-primary/40 text-primary hover:bg-primary hover:text-slate-950 transition"
        title="Adicionar ao deck principal"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
