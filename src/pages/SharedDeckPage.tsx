import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  Heart,
  Layers,
  Shield,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  api,
  type ApiDeck,
  type ArchetypeMetaBreakdown,
  type ArchetypeSummary,
  type CardUsageInfo,
  type SourceDeckEntry,
} from "@/lib/api";
import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { ExportDeckImageModal } from "@/components/deck/ExportDeckImageModal";
import { MetricTooltip } from "@/components/deck/MetricTooltip";
import { OpeningHandModal } from "@/components/deck/OpeningHandModal";
import { StatDetailModal } from "@/components/deck/StatDetailModal";
import { BuildCoreDeckModal, type CoreCardItem } from "@/components/deck/BuildCoreDeckModal";
import { SourceDecksModal } from "@/components/deck/SourceDecksModal";
import { VedaTelemetryAssistant } from "@/components/deck/VedaTelemetryAssistant";

import {
  computeUnifiedDeckTelemetry,
  getCardMetagameTier,
  LOW_COST_MAX,
  LOW_LEVEL_MAX,
  type DeckCardModel,
  type MetagameTier,
} from "@/lib/deck-analytics-engine";
import { detectDeckTokens } from "@/lib/deck-tokens";
import { isNonStatsCard } from "@/lib/deck-legality";
import { GAME_COLOR_HEX } from "@/lib/gundam-catalog";
import { earliestPlayableTurn, isBoardDevelopmentCard } from "@/lib/opening-hand-score";
import { mapApiCard } from "@/lib/api";
import { usePageMeta } from "@/lib/pageMeta";
import type { CardRecord } from "@/modules/core/types";

import ozHangarBanner from "@/assets/oz_deck_hangar.webp";
import { useSiteLanguage } from "@/i18n/siteLanguage";

const DECK_MAIN_SIZE = 50;
const DECK_RESOURCE_SIZE = 10;
const NON_COUNTED_SECTIONS = new Set(["resource", "ex_base", "ex_resource"]);

const chartConfig = {
  quantity: { label: "Quantidade", color: "var(--primary)" },
  value: { label: "Quantidade", color: "var(--primary)" },
} satisfies ChartConfig;

type DeckRow = CardRecord & { quantity: number; section: string };

/** Tile de Carta no Deck Compartilhado com Indicadores de Metagame da Comunidade */
function ReadOnlyCardTile({
  row,
  usage,
  onPreview,
}: {
  row: DeckRow;
  usage?: CardUsageInfo;
  onPreview: () => void;
}) {
  const { tr } = useSiteLanguage();
  const image = row.imageMediumUrl || row.imageUrl;
  const isNonStats = isNonStatsCard(row);
  // presenceRate no backend varia de 0 a 100
  const presence = !isNonStats && usage
    ? usage.presenceRate <= 1 && usage.presenceRate > 0
      ? usage.presenceRate * 100
      : usage.presenceRate
    : 0;
  const tierStyle = getCardMetagameTier(presence);

  return (
    <div
      className={`flex flex-col border ${tierStyle.borderClass} bg-white dark:bg-slate-950/90 transition-all hover:scale-[1.02] hover:shadow-xl relative group`}
    >
      <button
        type="button"
        onClick={onPreview}
        title={tr(`Ver ${row.namePt || row.name} em tamanho grande`, `View ${row.namePt || row.name} full size`)}
        className="group relative block aspect-[63/88] w-full overflow-hidden bg-slate-100 dark:bg-slate-900/60"
      >
        {image ? (
          <img
            src={image}
            alt={row.namePt || row.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-slate-100 dark:bg-slate-950/90 p-2 text-center">
            <p className="text-[10px] font-mono uppercase text-slate-500">{row.code}</p>
            <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{row.namePt || row.name}</p>
          </div>
        )}

        {/* Drawer informativo no hover */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-white/95 dark:bg-slate-950/95 border-t border-slate-200 dark:border-white/10 p-2 text-left backdrop-blur-sm transition-all duration-200 group-hover:translate-y-0">
          <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{row.namePt || row.name}</p>
          <p className="truncate text-[10px] font-mono text-slate-600 dark:text-slate-400">
            {row.code} · {row.type}
          </p>
        </div>
      </button>

      {/* Painel Tático Inferior: Tier, Taxa de Uso e Seletor de Cópias */}
      <div className="border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 p-1.5 text-[10px] font-mono text-slate-700 dark:text-slate-300 space-y-1">
        {!isNonStats && usage ? (
          <>
            <div className="flex items-center justify-between gap-1">
              <span className={`px-1 py-0.2 border text-[9px] font-semibold uppercase ${tierStyle.badgeClass}`}>
                {tierStyle.label.split(" / ")[0]}
              </span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {presence.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-[9px] text-slate-600 dark:text-slate-400">
              <span>{usage.deckCount}/{usage.totalDecks} decks</span>
              <span>{tr("Méd", "Avg")}: {usage.avgCopies ? usage.avgCopies.toFixed(1) : "0.0"}x</span>
            </div>
          </>
        ) : !isNonStats ? (
          <div className="text-[9px] text-slate-500 text-center py-0.5">
            {tr("Sem dados de meta", "No meta data")}
          </div>
        ) : (
          <div className="text-[9px] text-slate-600 dark:text-slate-400 text-center py-0.5 font-semibold">
            {row.section === "resource" ? tr("Recurso Básico", "Basic Resource") : tr("Componente Fixo", "Fixed Component")}
          </div>
        )}

        {/* Pílulas de Quantidade de Cópias (1 2 3 4) - destaque na cópia ativa deste deck */}
        {isNonStats ? (
          <div className="text-center py-0.5 text-[9px] font-mono font-bold text-slate-600 dark:text-slate-400">
            {row.quantity}x {row.section === "resource" ? "Recurso" : "Fixo"}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-0.5 pt-0.5">
            {[1, 2, 3, 4].map((copyNum) => {
              const isActive = row.quantity === copyNum;
              return (
                <div
                  key={copyNum}
                  className={`flex items-center justify-center py-0.5 text-[9px] font-bold transition-all ${
                    isActive
                      ? `${tierStyle.badgeClass} font-mono shadow-sm border`
                      : "bg-slate-200/70 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-white/5"
                  }`}
                  title={tr(`${copyNum} cópia(s)${isActive ? " (em uso neste deck)" : ""}`, `${copyNum} cop${copyNum === 1 ? "y" : "ies"}${isActive ? " (used in this deck)" : ""}`)}
                >
                  {copyNum}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Modal Carrossel de visualização de cartas em alta resolução */
function CardPreviewModal({
  rows,
  index,
  onNavigate,
  onClose,
}: {
  rows: DeckRow[];
  index: number | null;
  onNavigate: (index: number) => void;
  onClose: () => void;
}) {
  const { tr } = useSiteLanguage();
  const card = index !== null ? rows[index] : null;

  useEffect(() => {
    if (index === null || rows.length < 2) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onNavigate((index - 1 + rows.length) % rows.length);
      if (e.key === "ArrowRight") onNavigate((index + 1) % rows.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, rows.length, onNavigate]);

  if (!card || index === null) return null;
  const image = card.imageLargeUrl || card.imageMediumUrl || card.imageUrl;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[380px] max-h-[90vh] overflow-y-auto border-white/10 bg-slate-950 text-white panel-cut">
        <DialogTitle className="sr-only">{tr(`Carta ampliada: ${card.namePt || card.name}`, `Enlarged card: ${card.namePt || card.name}`)}</DialogTitle>
        <div className="relative mx-auto h-[447px] w-[320px] overflow-hidden border border-white/10 bg-slate-950/70">
          {image ? (
            <img loading="lazy" decoding="async" src={image} alt={card.namePt || card.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500 font-mono text-xs">{tr("Arte indisponível", "Art unavailable")}</div>
          )}
          {rows.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => onNavigate((index - 1 + rows.length) % rows.length)}
                title={tr("Carta anterior", "Previous card")}
                className="absolute left-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/80 text-white transition hover:bg-primary hover:text-primary-foreground"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate((index + 1) % rows.length)}
                title={tr("Próxima carta", "Next card")}
                className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/80 text-white transition hover:bg-primary hover:text-primary-foreground"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>

        <div className="mt-4 space-y-2 text-center">
          <p className="font-heading text-lg text-white">{card.namePt || card.name}</p>
          <div className="flex items-center justify-center gap-2 text-xs font-mono text-slate-400">
            <span>{card.code}</span>
            <span>·</span>
            <span className="uppercase">{card.type}</span>
            {card.color && (
              <>
                <span>·</span>
                <span className="text-white font-medium">{card.color}</span>
              </>
            )}
          </div>
          {card.effect && (
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/80 p-3 border border-white/10 text-left whitespace-pre-wrap">
              {card.effect}
            </p>
          )}
          <a
            href={`/cards/${card.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 underline font-mono pt-1"
          >
            <ExternalLink className="size-3.5" /> {tr("Detalhes da Carta", "Card Details")}
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SharedDeckPage() {
  const { tr } = useSiteLanguage();
  const [, params] = useRoute<{ shareId: string }>("/deck/:shareId");
  const [, navigate] = useLocation();

  const [deck, setDeck] = useState<ApiDeck | null>(null);
  usePageMeta(deck ? {
    title: deck.name,
    description: `Deck "${deck.name}" de ${deck.user?.displayName || deck.user?.username || "piloto da comunidade"} — lista de cartas, curva e estatísticas de Gundam Card Game.`,
    image: deck.coverImage || null,
    // Só deck público entra no Google; "não listado" é acessível por link mas não indexado.
    noindex: deck.visibility !== "PUBLIC",
  } : null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Alternância de Abas: Cartas / Estatísticas & Telemetria
  const [activeTab, setActiveTab] = useState<"cartas" | "estatisticas">("cartas");

  // Modais
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewCard, setPreviewCard] = useState<DeckRow | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [openingHandOpen, setOpeningHandOpen] = useState(false);
  const [buildCoreModalOpen, setBuildCoreModalOpen] = useState(false);
  const [sourceDecksModalOpen, setSourceDecksModalOpen] = useState(false);

  // Modal de Detalhes Estatísticos (mesmo do Deckbuilder)
  const [statDetail, setStatDetail] = useState<{ label: string; value: string } | null>(null);
  const [statDetailRows, setStatDetailRows] = useState<DeckRow[]>([]);

  // Detalhamento do cálculo hipergeométrico expansível
  const [handOddsBreakdownOpen, setHandOddsBreakdownOpen] = useState(false);

  // Curtidas
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // Dados Auxiliares
  const [cardUsageMap, setCardUsageMap] = useState<Record<string, CardUsageInfo>>({});
  const [officialTokens, setOfficialTokens] = useState<any[]>([]);
  const [archetypeMeta, setArchetypeMeta] = useState<ArchetypeMetaBreakdown | null>(null);
  const [communityDecks, setCommunityDecks] = useState<ApiDeck[]>([]);
  const [tournamentsData, setTournamentsData] = useState<any[]>([]);

  // Pílula de filtro ativa na visualização de cartas
  const [activeFilterPill, setActiveFilterPill] = useState<{
    key: "type" | "color" | "trait" | "link" | "quick" | "burst";
    value: string;
  } | null>(null);

  useEffect(() => {
    if (!params?.shareId) return;
    setLoading(true);

    api
      .getSharedDeck(params.shareId)
      .then((loadedDeck) => {
        setDeck(loadedDeck);
        setLikeCount(loadedDeck.likeCount ?? 0);
        setLiked(Boolean(loadedDeck.hasLiked));
        if (loadedDeck?.id) {
          api.recordDeckView(loadedDeck.id).catch(() => {});
        }

        // Carrega estatísticas reais de metagame para todas as cartas do deck
        const codes = Array.from(
          new Set(
            loadedDeck.items
              ?.map((it) => it.card?.code)
              .filter(Boolean) as string[]
          )
        );
        if (codes.length > 0) {
          api
            .getCardUsageStats(codes)
            .then((statsMap) => setCardUsageMap(statsMap || {}))
            .catch((err) => console.error("Falha ao carregar taxa de uso das cartas:", err));
        }

        // Carrega decks públicos cadastrados da comunidade para amostra comparativa
        api
          .listPublicDecks()
          .then((res: any) => {
            const list = Array.isArray(res) ? res : res?.items || [];
            if (list.length > 0) {
              setCommunityDecks(list);
            }
          })
          .catch(() => {});

        // Carrega torneios competitivos oficiais e resultados de metagame para a amostra
        api
          .listTournaments()
          .then((data: any) => {
            if (Array.isArray(data)) {
              setTournamentsData(data);
            }
          })
          .catch(() => {});

        // Tenta buscar arquétipo por afinidade real para recuperar sourceDecks e coreBuild oficiais
        api
          .getMetaArchetypes()
          .then((archetypes) => {
            if (archetypes && archetypes.length > 0) {
              const deckItems = (loadedDeck.items || []).filter(
                (it) => it.section !== "resource" && !NON_COUNTED_SECTIONS.has(it.section || "")
              );
              const deckCodesSet = new Set(
                deckItems.map((it) => it.card?.code).filter(Boolean) as string[]
              );
              const deckColorsSet = new Set(
                deckItems.map((it) => it.card?.color).filter(Boolean) as string[]
              );

              // Identifica a unidade chefe / boss unit do deck atual pelo padrão VEDA
              const units = deckItems
                .filter((i) => (i.card?.cardType || "").toUpperCase() === "UNIT")
                .sort((a, b) => {
                  const isLrA = (a.card?.rarity || "").includes("LR") || (a.card?.rarity || "").includes("Legend");
                  const isLrB = (b.card?.rarity || "").includes("LR") || (b.card?.rarity || "").includes("Legend");
                  if (isLrA && !isLrB) return -1;
                  if (!isLrA && isLrB) return 1;
                  const rA = (a.card?.rarity || "").includes("R") ? 2 : 1;
                  const rB = (b.card?.rarity || "").includes("R") ? 2 : 1;
                  if (rA !== rB) return rB - rA;
                  return (b.card?.cost ?? 0) - (a.card?.cost ?? 0) || b.quantity - a.quantity;
                });
              const bossCard = units[0]?.card;

              let bestMatch: ArchetypeSummary | null = null;
              let bestScore = -Infinity;

              for (const a of archetypes) {
                let score = 0;

                // 1. archetypeId explícito
                if ((loadedDeck as any).archetypeId && a.key === (loadedDeck as any).archetypeId) {
                  score += 1000;
                }

                // 2. Boss unit idêntica
                if (bossCard?.code && a.signatureCard?.code === bossCard.code) {
                  score += 160;
                } else if (a.signatureCard?.code && deckCodesSet.has(a.signatureCard.code)) {
                  score += 80;
                }

                // 3. Compatibilidade estrita de cores
                const aColors = a.colors || [];
                const sharedColors = aColors.filter((c) => deckColorsSet.has(c));
                const extraColorsInA = aColors.filter((c) => !deckColorsSet.has(c));

                if (aColors.length > 0 && deckColorsSet.size > 0) {
                  if (sharedColors.length === aColors.length && deckColorsSet.size === aColors.length) {
                    score += 50; // Cores 100% idênticas
                  } else if (sharedColors.length > 0) {
                    score += 25 * sharedColors.length;
                    score -= 50 * extraColorsInA.length; // Penalidade se o arquétipo exigir cores não presentes
                  } else {
                    // Sem nenhuma cor em comum (ex.: Verde/Preto vs Azul) -> desclassificação imediata
                    score -= 200;
                  }
                }

                // 4. Correspondência de nome do deck com arquétipo ou carta assinatura
                const deckNameLower = (loadedDeck.name || "").toLowerCase();
                const archNameLower = (a.name || "").toLowerCase();
                const sigNameLower = (a.signatureCard?.name || "").toLowerCase();

                const keyThemes = [
                  "unicorn", "banshee", "wing", "strike", "zeon", "barbatos",
                  "freedom", "justice", "aerial", "calibarn", "tallgeese",
                  "epyon", "sinanju", "kushariya", "exia", "dynames"
                ];
                for (const theme of keyThemes) {
                  if (deckNameLower.includes(theme) && (archNameLower.includes(theme) || sigNameLower.includes(theme))) {
                    score += 60;
                  }
                }

                if (score > bestScore) {
                  bestScore = score;
                  bestMatch = a;
                }
              }

              // Só aceita o arquétipo se atingir confiança mínima alta (>= 80)
              if (bestMatch && bestScore >= 80) {
                api
                  .getArchetypeBreakdown(bestMatch.key)
                  .then((bd) => setArchetypeMeta(bd))
                  .catch(() => setArchetypeMeta(null));
              } else {
                setArchetypeMeta(null);
              }
            }
          })
          .catch(() => setArchetypeMeta(null));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    api
      .listTokens()
      .then((tokens) => setOfficialTokens(tokens || []))
      .catch((err) => console.error("Falha ao carregar tokens oficiais:", err));
  }, [params?.shareId]);

  const toggleLike = async () => {
    if (!deck?.id) return;
    try {
      const res = await api.toggleDeckLike(deck.id);
      setLiked(res.liked);
      setLikeCount(res.likeCount);
      toast.success(res.liked ? tr("Deck marcado como favorito!", "Deck added to favorites!") : tr("Curtida removida.", "Like removed."));
    } catch {
      toast.error(tr("Você precisa estar logado para curtir decks.", "You need to sign in to like decks."));
    }
  };

  const allRows: DeckRow[] = useMemo(() => {
    if (!deck) return [];
    return deck.items
      .map((item) => {
        const card = item.card ? mapApiCard(item.card) : null;
        return card ? { ...card, quantity: item.quantity, section: item.section || "main" } : null;
      })
      .filter(Boolean) as DeckRow[];
  }, [deck]);

  const mainRows = useMemo(
    () => allRows.filter((row) => row.section !== "resource" && !NON_COUNTED_SECTIONS.has(row.section) && !isNonStatsCard(row)),
    [allRows]
  );
  const resourceRows = useMemo(() => allRows.filter((row) => row.section === "resource"), [allRows]);
  const exBaseRow = useMemo(() => allRows.find((row) => row.section === "ex_base"), [allRows]);
  const exResourceRow = useMemo(() => allRows.find((row) => row.section === "ex_resource"), [allRows]);

  const visibleRows = useMemo(() => [...mainRows, ...resourceRows], [mainRows, resourceRows]);

  // Telemetria Unificada (100% idêntica ao Deckbuilder)
  const telemetry = useMemo(
    () => computeUnifiedDeckTelemetry(mainRows as unknown as DeckCardModel[]),
    [mainRows]
  );

  // Unidades e Suportes
  const unitRows = useMemo(
    () => mainRows.filter((r) => (r.type || "").toUpperCase() === "UNIT"),
    [mainRows]
  );
  const supportRows = useMemo(
    () => mainRows.filter((r) => (r.type || "").toUpperCase() !== "UNIT"),
    [mainRows]
  );

  // Cartas filtradas por pílula selecionada
  const filteredUnitRows = useMemo(() => {
    if (!activeFilterPill) return unitRows;
    return unitRows.filter((r) => {
      if (activeFilterPill.key === "type") return (r.type || "").toUpperCase() === activeFilterPill.value.toUpperCase();
      if (activeFilterPill.key === "color") return (r.color || "").toUpperCase() === activeFilterPill.value.toUpperCase();
      if (activeFilterPill.key === "trait") return (r.trait || "").toLowerCase() === activeFilterPill.value.toLowerCase();
      if (activeFilterPill.key === "link") return r.effect?.toLowerCase().includes(activeFilterPill.value.toLowerCase());
      if (activeFilterPill.key === "burst") return /burst/i.test(r.effect || "");
      if (activeFilterPill.key === "quick") return /(?:quick|counter|blocker)/i.test(r.effect || "");
      return true;
    });
  }, [unitRows, activeFilterPill]);

  const filteredSupportRows = useMemo(() => {
    if (!activeFilterPill) return supportRows;
    return supportRows.filter((r) => {
      if (activeFilterPill.key === "type") return (r.type || "").toUpperCase() === activeFilterPill.value.toUpperCase();
      if (activeFilterPill.key === "color") return (r.color || "").toUpperCase() === activeFilterPill.value.toUpperCase();
      if (activeFilterPill.key === "trait") return (r.trait || "").toLowerCase() === activeFilterPill.value.toLowerCase();
      if (activeFilterPill.key === "link") return r.effect?.toLowerCase().includes(activeFilterPill.value.toLowerCase());
      if (activeFilterPill.key === "burst") return /burst/i.test(r.effect || "");
      if (activeFilterPill.key === "quick") return /(?:quick|counter|blocker)/i.test(r.effect || "");
      return true;
    });
  }, [supportRows, activeFilterPill]);

  // Tokens detectados
  const detectedTokens = useMemo(() => {
    return detectDeckTokens(mainRows, officialTokens);
  }, [mainRows, officialTokens]);

  // Contagem de Metagame com as novas regras da comunidade
  const metagameCounts = useMemo(() => {
    let staplesCount = 0;
    let engineCount = 0;
    let commonCount = 0;
    let techsCount = 0;

    mainRows.forEach((r) => {
      const usage = cardUsageMap[r.code];
      const presence = usage
        ? usage.presenceRate <= 1 && usage.presenceRate > 0
          ? usage.presenceRate * 100
          : usage.presenceRate
        : 0;

      if (presence >= 75) staplesCount += r.quantity;
      else if (presence >= 50) engineCount += r.quantity;
      else if (presence >= 25) commonCount += r.quantity;
      else techsCount += r.quantity;
    });

    return { staplesCount, engineCount, commonCount, techsCount };
  }, [mainRows, cardUsageMap]);

  // Montagem das cartas do Núcleo do Arquétipo (Core Build)
  const coreBuildCards: CoreCardItem[] = useMemo(() => {
    if (archetypeMeta?.coreBuild?.coreCards && archetypeMeta.coreBuild.coreCards.length > 0) {
      return archetypeMeta.coreBuild.coreCards.map((c) => {
        const presence = c.inclusionRate <= 1 ? c.inclusionRate * 100 : c.inclusionRate;
        return {
          id: c.id,
          code: c.code,
          name: c.name,
          namePt: c.namePt,
          imageUrl: c.imageUrl,
          imageMediumUrl: c.imageMediumUrl,
          color: c.color,
          cost: c.cost,
          level: c.level,
          type: c.cardType,
          presenceRate: presence,
          recommendedCopies: c.recommendedCopies || 4,
          tier: (presence >= 75 ? "STAPLE" : presence >= 50 ? "KEY" : "COMMON") as MetagameTier,
        };
      });
    }

    // Fallback inteligente com telemetria VEDA: filtra cartas essenciais do deck atual
    // com taxa de presença alta (>=50%) ou 3-4 cópias no arsenal
    return mainRows
      .filter((r) => {
        const usage = cardUsageMap[r.code];
        const rate = usage
          ? usage.presenceRate <= 1 && usage.presenceRate > 0
            ? usage.presenceRate * 100
            : usage.presenceRate
          : 0;
        return rate >= 50 || r.quantity >= 3;
      })
      .map((r) => {
        const usage = cardUsageMap[r.code];
        const presence = usage
          ? usage.presenceRate <= 1 && usage.presenceRate > 0
            ? usage.presenceRate * 100
            : usage.presenceRate
          : Math.min(100, r.quantity * 25);
        return {
          id: r.id,
          code: r.code,
          name: r.name,
          namePt: r.namePt,
          imageUrl: r.imageUrl,
          imageMediumUrl: r.imageMediumUrl,
          color: r.color,
          cost: r.cost,
          level: r.level,
          type: r.type,
          presenceRate: presence,
          recommendedCopies: usage?.avgCopies ? Math.round(usage.avgCopies) : r.quantity,
          tier: (presence >= 75 ? "STAPLE" : presence >= 50 ? "KEY" : "COMMON") as MetagameTier,
        };
      })
      .sort((a, b) => b.presenceRate - a.presenceRate || b.recommendedCopies - a.recommendedCopies);
  }, [archetypeMeta, mainRows, cardUsageMap]);

  // Sugestões complementares para o Core Build Modal (opções flexíveis e techs)
  const suggestedCoreCards: CoreCardItem[] = useMemo(() => {
    if (archetypeMeta?.coreBuild?.suggestedCards && archetypeMeta.coreBuild.suggestedCards.length > 0) {
      return archetypeMeta.coreBuild.suggestedCards.map((c) => {
        const presence = c.inclusionRate <= 1 ? c.inclusionRate * 100 : c.inclusionRate;
        return {
          id: c.id,
          code: c.code,
          name: c.name,
          namePt: c.namePt,
          imageUrl: c.imageUrl,
          imageMediumUrl: c.imageMediumUrl,
          color: c.color,
          cost: c.cost,
          level: c.level,
          type: c.cardType,
          presenceRate: presence,
          recommendedCopies: c.recommendedCopies || 2,
          tier: (presence >= 25 ? "COMMON" : "TECH") as MetagameTier,
        };
      });
    }

    const coreIds = new Set(coreBuildCards.map((c) => c.id));
    return mainRows
      .filter((r) => !coreIds.has(r.id))
      .map((r) => {
        const usage = cardUsageMap[r.code];
        const presence = usage
          ? usage.presenceRate <= 1 && usage.presenceRate > 0
            ? usage.presenceRate * 100
            : usage.presenceRate
          : Math.min(100, r.quantity * 20);
        return {
          id: r.id,
          code: r.code,
          name: r.name,
          namePt: r.namePt,
          imageUrl: r.imageUrl,
          imageMediumUrl: r.imageMediumUrl,
          color: r.color,
          cost: r.cost,
          level: r.level,
          type: r.type,
          presenceRate: presence,
          recommendedCopies: usage?.avgCopies ? Math.round(usage.avgCopies) : r.quantity,
          tier: (presence >= 25 ? "COMMON" : "TECH") as MetagameTier,
        };
      })
      .sort((a, b) => b.presenceRate - a.presenceRate);
  }, [archetypeMeta, mainRows, cardUsageMap, coreBuildCards]);

  // Lista de Source Decks da Amostra (torneios reais colhidos e decks públicos compatíveis)
  const sourceDecks: SourceDeckEntry[] = useMemo(() => {
    if (archetypeMeta?.sourceDecks && archetypeMeta.sourceDecks.length > 0) {
      return archetypeMeta.sourceDecks;
    }

    const myCodeSet = new Set(mainRows.map((r) => r.code));
    const deckNameLower = (deck?.name || "").toLowerCase();
    const result: SourceDeckEntry[] = [];

    // 1. Torneios reais: busca entradas de torneios competitivos que usaram este arquétipo ou lista similar
    if (tournamentsData.length > 0) {
      for (const t of tournamentsData) {
        const entries = t.entries || [];
        for (const entry of entries) {
          const entryArchLower = (entry.archetype || "").toLowerCase();
          const snapshotItems = entry.deckSnapshot?.items || [];
          let sharedCards = 0;
          for (const item of snapshotItems) {
            if (item.card?.code && myCodeSet.has(item.card.code)) {
              sharedCards++;
            }
          }

          const nameMatches =
            (deckNameLower.includes("unicorn") && entryArchLower.includes("unicorn")) ||
            (entryArchLower && deckNameLower.includes(entryArchLower)) ||
            (entryArchLower && entryArchLower.includes(deckNameLower));

          if (sharedCards >= 3 || (nameMatches && (sharedCards >= 1 || snapshotItems.length === 0))) {
            result.push({
              id: entry.id,
              name: entry.deck?.name || (entry.archetype ? `${entry.archetype} (${t.name})` : t.name),
              shareId: entry.deck?.shareId,
              author: entry.playerName || tr("Piloto de Torneio", "Tournament Player"),
              tournament: t.name,
              tournamentId: t.id,
              tournamentDate: t.dateStart,
              organizer: t.organizer,
              tier: t.tier ? String(t.tier) : undefined,
              sourceUrl: t.sourceUrl,
              placement: entry.placement ? `${entry.placement}º lugar` : "Top Cut",
              date: t.dateStart,
            });
          }
        }
      }
    }

    // 2. Outros decks públicos cadastrados da comunidade com afinidade nesta lista
    if (communityDecks.length > 0) {
      const scoredDecks = communityDecks
        .filter((d) => d.id !== deck?.id)
        .map((d) => {
          const items = d.items || [];
          let sharedCards = 0;
          for (const it of items) {
            if (it.card?.code && myCodeSet.has(it.card.code)) {
              sharedCards++;
            }
          }
          return { deck: d, sharedCards };
        })
        .filter((item) => item.sharedCards >= 3)
        .sort((a, b) => b.sharedCards - a.sharedCards);

      for (const item of scoredDecks.slice(0, 10)) {
        if (!result.some((r) => r.id === item.deck.id || (r.shareId && r.shareId === item.deck.shareId))) {
          result.push({
            id: item.deck.id,
            name: item.deck.name,
            shareId: item.deck.shareId,
            author: item.deck.user?.displayName || item.deck.user?.username || "Piloto Registrado",
            tournament: tr("Arsenal Público Gundam TCG", "Gundam TCG Public Decks"),
            placement: tr(`${item.sharedCards} cartas em comum`, `${item.sharedCards} cards in common`),
            date: item.deck.updatedAt || item.deck.createdAt,
          });
        }
      }
    }

    if (result.length > 0) {
      return result;
    }

    // 3. Fallback: Lista base registrada no hangar
    if (deck) {
      return [
        {
          id: deck.id,
          name: deck.name,
          shareId: deck.shareId,
          author: deck.user?.displayName || deck.user?.username || "Piloto Registrado",
          tournament: "Arsenal Competitivo Gundam TCG",
          placement: "Lista Registrada",
          date: deck.updatedAt || deck.createdAt,
        },
      ];
    }
    return [];
  }, [archetypeMeta, deck, mainRows, communityDecks, tournamentsData]);

  // Pílulas interativas de Traits e Links
  const { traitList, linkList, quickCountersCount, burstCount } = useMemo(() => {
    const traits = new Map<string, number>();
    const links = new Map<string, number>();
    let quick = 0;
    let burst = 0;

    mainRows.forEach((r) => {
      if (r.trait) traits.set(r.trait, (traits.get(r.trait) || 0) + r.quantity);
      if (r.effect) {
        const linkMatch = r.effect.match(/\[(?:Link|Pair)\s*:\s*([^\]]+)\]/i);
        if (linkMatch && linkMatch[1]) {
          const lName = linkMatch[1].trim();
          links.set(lName, (links.get(lName) || 0) + r.quantity);
        }
        if (/(?:quick|counter|blocker)/i.test(r.effect)) quick += r.quantity;
        if (/burst/i.test(r.effect)) burst += r.quantity;
      }
    });

    return {
      traitList: Array.from(traits.entries()).sort((a, b) => b[1] - a[1]),
      linkList: Array.from(links.entries()).sort((a, b) => b[1] - a[1]),
      quickCountersCount: quick,
      burstCount: burst,
    };
  }, [mainRows]);

  // Abre modal de detalhe filtrando o deck principal (mesmo do Deckbuilder)
  const openStatDetail = (label: string, value: string, matcher: (row: DeckRow) => boolean) => {
    setStatDetail({ label, value });
    setStatDetailRows(mainRows.filter(matcher));
  };

  // Exportação para MSA / Wing Table
  const exportMSA = async () => {
    if (!mainRows.length) return;
    const lines = mainRows.map((r) => `${r.quantity}x ${r.code}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success(tr("Deck copiado no formato MSA / Exburst!", "Deck copied in MSA / Exburst format!"));
  };

  // Clonar no Deckbuilder
  const cloneToDeckbuilder = () => {
    if (!deck) return;
    const entries = allRows.map((r) => ({
      cardId: r.printId || r.id,
      quantity: r.quantity,
      section: r.section,
    }));
    localStorage.setItem(
      "gundam_deckbuilder_draft",
      JSON.stringify({
        deckName: tr(`${deck.name} (Cópia)`, `${deck.name} (Copy)`),
        visibility: "PUBLIC",
        entries,
      })
    );
    toast.success(tr("Deck copiado! Abrindo no deckbuilder...", "Deck copied! Opening in the deckbuilder..."));
    navigate("/deckbuilder/novo");
  };

  const togglePill = (key: "type" | "color" | "trait" | "link" | "quick" | "burst", value: string) => {
    setActiveFilterPill((prev) => (prev?.key === key && prev?.value === value ? null : { key, value }));
  };

  // Conversão para cache de cartas para o VedaTelemetryAssistant
  const cardCacheMap = useMemo(() => {
    const cache: Record<string, CardRecord> = {};
    allRows.forEach((r) => {
      cache[r.id] = r;
      if (r.printId) cache[r.printId] = r;
    });
    return cache;
  }, [allRows]);

  const deckEntries = useMemo(() => {
    return allRows.map((r) => ({
      cardId: r.id,
      quantity: r.quantity,
      section: r.section as "main" | "resource" | "ex_base" | "ex_resource",
    }));
  }, [allRows]);

  if (loading) {
    return (
      <PublicShell breadcrumbs={[{ label: "Decks", href: "/decks" }, { label: "Carregando..." }]}>
        <div className="py-24 text-center">
          <div className="mx-auto size-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-400 font-mono">
            {tr("Acessando especificações táticas no terminal Anaheim HUB...", "Loading deck...")}
          </p>
        </div>
      </PublicShell>
    );
  }

  if (error || !deck) {
    return (
      <PublicShell breadcrumbs={[{ label: "Decks", href: "/decks" }, { label: "Erro" }]}>
        <div className="p-8 border border-red-500/30 bg-red-950/20 text-center text-red-200">
          <p className="font-heading text-xl uppercase">{tr("Deck não localizado", "Deck not found")}</p>
          <p className="mt-2 text-sm text-red-300">{error || tr("O deck solicitado não foi encontrado ou é privado.", "The deck wasn't found or is private.")}</p>
          <Button
            onClick={() => navigate("/decks")}
            className="mt-4 rounded-none bg-red-600 hover:bg-red-500 text-white"
          >
            {tr("Voltar para os decks", "Back to decks")}
          </Button>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell ad
      breadcrumbs={[
        { label: "Decks", href: "/decks" },
        { label: deck.name || tr("Especificação de Deck", "Deck") },
      ]}
      title={deck.name}
      description={deck.user?.displayName || deck.user?.username || "Jogador"}
    >
      <div className="space-y-6">
        {/* BANNER DO HANGAR OZ COM METADADOS DO DECK */}
        <Card className="panel-cut rounded-none border-primary/30 hero-surface overflow-hidden">
          <div className="relative min-h-[220px] sm:min-h-[260px] w-full overflow-hidden border-b border-white/10 bg-slate-950">
            <img loading="lazy" decoding="async"
              src={deck.coverImage || ozHangarBanner}
              alt={deck.name}
              className="h-full w-full object-cover object-center brightness-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-transparent" />

            <div className="absolute left-6 bottom-4 right-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge className="rounded-none border-emerald-500/50 bg-emerald-950/80 text-emerald-300 text-[10px] uppercase font-mono">
                    {deck.format || tr("Padrão Construído", "Standard Constructed")}
                  </Badge>
                  <span className="text-[10px] font-mono text-slate-400">REGISTRO #{deck.shareId}</span>
                </div>

                <h1 className="font-heading text-2xl sm:text-4xl uppercase text-white tracking-wider drop-shadow-md">
                  {deck.name}
                </h1>

                <p className="mt-1.5 text-xs text-slate-300 flex items-center gap-2">
                  <span className="font-mono text-slate-400 uppercase text-[11px]">{tr("Piloto / Autor:", "Player / Author:")}</span>
                  <strong className="text-primary font-semibold text-sm">
                    {deck.user?.displayName || deck.user?.username || tr("Piloto Anônimo", "Anonymous Player")}
                  </strong>
                </p>
              </div>

              {/* Botões de Favorito e Visualizações */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={toggleLike}
                  className={`rounded-none border-white/20 transition-all ${
                    liked
                      ? "bg-rose-500/20 border-rose-400 text-rose-300"
                      : "bg-slate-900/80 text-slate-200 hover:text-white"
                  }`}
                >
                  <Heart className={`mr-1.5 size-4 ${liked ? "fill-rose-500 text-rose-500" : ""}`} />
                  <span>{likeCount}</span>
                </Button>
                <div className="flex items-center gap-1.5 px-3 py-1.5 border border-white/15 bg-slate-900/80 text-xs font-mono text-slate-300">
                  <Eye className="size-3.5 text-slate-300" />
                  <span>{deck.viewCount || 1} {tr("visualizações", "views")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* BARRA DE TELEMETRIA RÁPIDA E AÇÕES TÁTICAS */}
          <CardContent className="p-4 sm:p-5 bg-white dark:bg-slate-950/90 border-t border-slate-200 dark:border-white/10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Badges de calibração */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-none border-sky-400/50 bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 text-xs font-mono">
                  {telemetry.mainDeckCount}/{DECK_MAIN_SIZE} {tr("Deck Principal", "Main Deck")}
                </Badge>
                <Badge className="rounded-none border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-xs font-mono">
                  {resourceRows.reduce((acc, r) => acc + r.quantity, 0)}/{DECK_RESOURCE_SIZE} Recursos
                </Badge>
                <Badge className="rounded-none border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-mono">
                  {tr("Sinergia", "Synergy")}: {telemetry.synergyScore}/100 ({telemetry.synergyLabel})
                </Badge>
                {telemetry.dominantColor && (
                  <Badge className="rounded-none border-primary/40 bg-primary/10 text-primary text-xs font-mono">
                    {tr("Cor", "Color")}: {telemetry.dominantColor}
                  </Badge>
                )}
              </div>

              {/* Ações Táticas: Simular Draw, Exportar Imagem, Clonar */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpeningHandOpen(true)}
                  className="rounded-none border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 font-mono transition-all"
                  title={tr("Simular compra de mão inicial (5 cartas) e testar mulligan", "Simulate drawing an opening hand (5 cards) and test the mulligan")}
                >
                  <Eye className="mr-1.5 size-3.5 text-emerald-600 dark:text-emerald-400" />
                  {tr("Simular Draw", "Simulate Draw")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportMSA}
                  className="rounded-none border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/5 text-xs text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 font-mono"
                >
                  <Copy className="mr-1.5 size-3.5" /> {tr("Copiar MSA", "Copy MSA")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImageModalOpen(true)}
                  className="rounded-none border-sky-400/50 bg-sky-50 dark:bg-sky-950/30 text-xs text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40 font-mono transition-all"
                >
                  <Download className="mr-1.5 size-3.5 text-sky-600 dark:text-sky-400" />
                  {tr("Exportar Imagem", "Export Image")}
                </Button>
                <Button
                  size="sm"
                  onClick={cloneToDeckbuilder}
                  className="rounded-none bg-primary hover:bg-primary/90 text-primary-foreground font-heading uppercase text-xs tracking-wider shadow-lg shadow-primary/20"
                >
                  <Wrench className="mr-1.5 size-3.5" /> {tr("Copiar para o deckbuilder", "Copy to deckbuilder")}
                </Button>
              </div>
            </div>

            {deck.notes && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <span className="font-semibold text-primary uppercase tracking-wider font-mono mr-2">
                  {tr("Diretrizes do Piloto:", "Player notes:")}
                </span>
                {deck.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* NAVEGAÇÃO DE ABAS: CARTAS vs. ESTATÍSTICAS & TELEMETRIA */}
        <div className="flex border-b border-slate-200 dark:border-white/10 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("cartas")}
            className={`px-6 py-3 font-heading uppercase tracking-wider text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "cartas"
                ? "border-primary text-primary bg-primary/10 font-bold"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Layers className="size-4" />
            <span>{tr("Decklist & Estrutura", "Decklist & Structure")}</span>
            <span className="text-xs font-mono ml-1 text-slate-500 dark:text-slate-400">({telemetry.mainDeckCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("estatisticas")}
            className={`px-6 py-3 font-heading uppercase tracking-wider text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "estatisticas"
                ? "border-primary text-primary bg-primary/10 font-bold"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <BarChart3 className="size-4" />
            <span>{tr("Estatísticas", "Stats")}</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* ABA 1: DECKLIST & ESTRUTURA                              */}
        {/* ======================================================== */}
        {activeTab === "cartas" ? (
          <div className="space-y-6">
            {/* BARRA SUPERIOR DE LEGENDA TÁTICA E NÚCLEO DO ARQUÉTIPO */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 panel-cut">
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                <span className="text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold">{tr("Classificação:", "Classification:")}</span>
                <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <span className="size-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <span>{tr("Staple (≥75%)", "Staple (≥75%)")}</span>
                </span>
                <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                  <span className="size-2 rounded-full bg-amber-500 dark:bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                  <span>{tr("Peça-Chave / Engine (≥50%)", "Key Piece / Engine (≥50%)")}</span>
                </span>
                <span className="flex items-center gap-1.5 text-sky-700 dark:text-sky-400">
                  <span className="size-2 rounded-full bg-sky-500 dark:bg-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
                  <span>{tr("Comum / Suporte (≥25%)", "Common / Support (≥25%)")}</span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <span className="size-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                  <span>{tr("Opção Tática / Tech (&lt;25%)", "Tech Option (&lt;25%)")}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSourceDecksModalOpen(true)}
                  className="rounded-none border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/5 text-xs text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white font-mono"
                >
                  <Database className="size-3.5 mr-1.5 text-primary" />
                  {tr("Amostra", "Sample")} ({sourceDecks.length})
                </Button>
                <Button
                  size="sm"
                  onClick={() => setBuildCoreModalOpen(true)}
                  className="rounded-none bg-primary text-primary-foreground font-heading uppercase text-xs tracking-wider hover:bg-primary/90 shadow-md shadow-primary/20"
                >
                  <Sparkles className="size-3.5 mr-1.5" />
                  {tr("Estrutura do Núcleo", "Core Structure")} ({coreBuildCards.reduce((acc, c) => acc + (c.recommendedCopies || 1), 0)}/50)
                </Button>
              </div>
            </div>

            {/* GRADE DO DECK PRINCIPAL */}
            <Card className="panel-cut rounded-none surface-panel border-slate-200 dark:border-white/10">
              <CardContent className="p-5 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-primary inline-block" />
                    <h3 className="font-heading text-lg uppercase tracking-wider text-slate-900 dark:text-white">
                      {tr("Deck Principal", "Main Deck")} ({telemetry.mainDeckCount} / {DECK_MAIN_SIZE})
                    </h3>
                  </div>
                  {activeFilterPill && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveFilterPill(null)}
                      className="text-xs text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 h-7 px-2 font-mono"
                    >
                      {tr("Remover filtro", "Remove filter")} ({activeFilterPill.value}) ✕
                    </Button>
                  )}
                </div>

                {/* Seção 1: UNIDADES */}
                {filteredUnitRows.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-slate-400">
                      <span className="font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                        {tr("Unidades", "Units")} ({filteredUnitRows.reduce((acc, r) => acc + r.quantity, 0)})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-3">
                      {filteredUnitRows.map((row) => (
                        <ReadOnlyCardTile
                          key={`${row.id}-main-unit`}
                          row={row}
                          usage={cardUsageMap[row.code]}
                          onPreview={() => setPreviewIndex(visibleRows.findIndex((r) => r === row))}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Seção 2: PILOTOS, COMANDOS E BASES */}
                {filteredSupportRows.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-slate-400">
                      <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        {tr("Pilotos, Comandos e Bases", "Pilots, Commands and Bases")} ({filteredSupportRows.reduce((acc, r) => acc + r.quantity, 0)})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-3">
                      {filteredSupportRows.map((row) => (
                        <ReadOnlyCardTile
                          key={`${row.id}-main-support`}
                          row={row}
                          usage={cardUsageMap[row.code]}
                          onPreview={() => setPreviewIndex(visibleRows.findIndex((r) => r === row))}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* PÍLULAS INTERATIVAS (FILTROS ABAIXO DO DECK - 100% PT-BR) */}
                <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-3 select-none">
                  {/* Tipos de Carta */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      {tr("Tipos de Carta", "Card Types")} · <span className="text-slate-500 dark:text-slate-400 italic">{tr("Clique para filtrar", "Click to filter")}</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {telemetry.typeBreakdown.map((item) => {
                        const active = activeFilterPill?.key === "type" && activeFilterPill.value === item.name;
                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => togglePill("type", item.name)}
                            className={`px-2.5 py-1 text-[11px] font-mono rounded-full border transition-all flex items-center gap-1.5 ${
                              active
                                ? "bg-primary text-primary-foreground font-bold border-primary"
                                : "bg-slate-100 dark:bg-slate-900/80 border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-white/30"
                            }`}
                          >
                            <span className="size-1.5 rounded-full bg-primary" />
                            <span>{item.name}:</span>
                            <span className={active ? "text-primary-foreground" : "text-primary font-bold"}>
                              {item.value}
                            </span>
                          </button>
                        );
                      })}

                      {/* Cores */}
                      {telemetry.colorBreakdown.map((item) => {
                        const active = activeFilterPill?.key === "color" && activeFilterPill.value === item.name;
                        const hex = (GAME_COLOR_HEX as any)[item.name] || "#64748b";
                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => togglePill("color", item.name)}
                            className={`px-2.5 py-1 text-[11px] font-mono rounded-full border transition-all flex items-center gap-1.5 ${
                              active
                                ? "bg-primary text-primary-foreground font-bold border-primary"
                                : "bg-slate-100 dark:bg-slate-900/80 border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-white/30"
                            }`}
                          >
                            <span className="size-2 rounded-full" style={{ backgroundColor: hex }} />
                            <span>{item.name}:</span>
                            <span className={active ? "text-primary-foreground" : "text-slate-900 dark:text-white font-bold"}>
                              {item.value}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Traits da Esquadra */}
                  {traitList.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        {tr("Traits do deck", "Deck traits")} ({traitList.length} traits)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {traitList.map(([trait, count]) => {
                          const active = activeFilterPill?.key === "trait" && activeFilterPill.value === trait;
                          return (
                            <button
                              key={trait}
                              type="button"
                              onClick={() => togglePill("trait", trait)}
                              className={`px-2.5 py-0.5 text-[10px] font-mono rounded-full border transition-all flex items-center gap-1 ${
                                active
                                  ? "bg-amber-400 text-slate-950 font-bold border-amber-300"
                                  : "bg-slate-100 dark:bg-slate-900/60 border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                              }`}
                            >
                              <span>{trait}</span>
                              <span className={active ? "text-slate-950" : "text-amber-600 dark:text-amber-300 font-bold"}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Links, Respostas Rápidas e Burst */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono">
                    {linkList.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {linkList.slice(0, 4).map(([link, count]) => {
                          const active = activeFilterPill?.key === "link" && activeFilterPill.value === link;
                          return (
                            <button
                              key={link}
                              type="button"
                              onClick={() => togglePill("link", link)}
                              className={`px-2 py-0.5 rounded border ${
                                active
                                  ? "bg-purple-500 text-white border-purple-400"
                                  : "bg-purple-50 dark:bg-slate-900/60 border-purple-300 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-white"
                              }`}
                            >
                              [Link: {link}] {count}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {quickCountersCount > 0 && (
                      <button
                        type="button"
                        onClick={() => togglePill("quick", "quick")}
                        className={`px-2 py-0.5 rounded border ${
                          activeFilterPill?.key === "quick"
                            ? "bg-rose-500 text-white border-rose-400"
                            : "bg-rose-50 dark:bg-slate-900/60 border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-white"
                        }`}
                      >
                        {tr("Respostas Rápidas", "Quick Responses")} ({quickCountersCount})
                      </button>
                    )}

                    {burstCount > 0 && (
                      <button
                        type="button"
                        onClick={() => togglePill("burst", "burst")}
                        className={`px-2 py-0.5 rounded border ${
                          activeFilterPill?.key === "burst"
                            ? "bg-amber-500 text-slate-950 font-bold border-amber-400"
                            : "bg-amber-50 dark:bg-slate-900/60 border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white"
                        }`}
                      >
                        {tr("Gatilhos Burst", "Burst Triggers")} ({burstCount})
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DECK DE RECURSOS */}
            {resourceRows.length > 0 && (
              <Card className="panel-cut rounded-none surface-panel border-slate-200 dark:border-white/10">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3 mb-4">
                    <h3 className="font-heading text-base uppercase text-slate-900 dark:text-white">
                      {tr("Deck de Recursos", "Resource Deck")} ({resourceRows.reduce((acc, r) => acc + r.quantity, 0)} / {DECK_RESOURCE_SIZE})
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-3">
                    {resourceRows.map((row) => (
                      <ReadOnlyCardTile
                        key={`${row.id}-res`}
                        row={row}
                        usage={cardUsageMap[row.code]}
                        onPreview={() => setPreviewIndex(visibleRows.findIndex((r) => r === row))}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* COMPONENTES EX */}
            {(exBaseRow || exResourceRow) && (
              <Card className="panel-cut rounded-none surface-panel border-slate-200 dark:border-white/10">
                <CardContent className="p-5">
                  <h3 className="font-heading text-base uppercase text-amber-600 dark:text-amber-400 mb-3">
                    {tr("Componentes EX Iniciais", "Starting EX Components")}
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    {exBaseRow && (
                      <div className="w-32">
                        <p className="text-[10px] uppercase font-mono text-amber-600 dark:text-amber-400 mb-1">{tr("Base EX", "EX Base")}</p>
                        <ReadOnlyCardTile
                          row={exBaseRow}
                          onPreview={() => setPreviewIndex(visibleRows.findIndex((r) => r === exBaseRow))}
                        />
                      </div>
                    )}
                    {exResourceRow && (
                      <div className="w-32">
                        <p className="text-[10px] uppercase font-mono text-amber-600 dark:text-amber-400 mb-1">{tr("Recurso EX", "EX Resource")}</p>
                        <ReadOnlyCardTile
                          row={exResourceRow}
                          onPreview={() => setPreviewIndex(visibleRows.findIndex((r) => r === exResourceRow))}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          /* ======================================================== */
          /* ABA 2: ESTATÍSTICAS & TELEMETRIA (100% PARIDADE DECKBUILDER) */
          /* ======================================================== */
          <div className="space-y-6">
            {/* CALIBRAÇÃO TÉCNICA DA LISTA & SINERGIA 0-100 */}
            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">
                      {tr("Diagnóstico do deck", "Deck check")}
                    </p>
                    <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                      {tr("Calibração Técnica da Lista", "List Calibration")}
                      <MetricTooltip
                        metric="leitura-rapida"
                        what={tr("Cinco checagens rápidas da lista: volume de cartas, variedade, cópias no limite (4x), cobertura por keywords e linha principal (trait dominante).", "Five quick checks on the list: card count, variety, copies at the limit (4x), keyword coverage and main line (dominant trait).")}
                        howToRead={tr("Borda azul = ok, borda âmbar = vale revisar. É diagnóstico, não bloqueia o deck de ser legal.", "Blue border = ok, amber border = worth a look. It's a check, it doesn't make the deck illegal.")}
                      />
                    </h3>
                  </div>
                  <div className="panel-cut border border-primary/30 bg-primary/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-portal">
                      {tr("Sinergia estimada", "Estimated synergy")}
                      <MetricTooltip
                        metric="sinergia-estimada"
                        what={tr("Nota de 0 a 100 que estima o quão coeso o deck está: pesa cor dominante, trait dominante, cobertura de keywords e variedade de cartas.", "A 0–100 score estimating how cohesive the deck is: weighs dominant color, dominant trait, keyword coverage and card variety.")}
                        howToRead={tr("80+ = sinergia forte; 55–79 = em formação; abaixo = base ainda dispersa. É uma heurística do portal, não uma regra oficial.", "80+ = strong synergy; 55–79 = taking shape; below = still scattered. It's a site heuristic, not an official rule.")}
                      />
                    </p>
                    <p className="mt-2 font-heading text-4xl heading-portal">{telemetry.synergyScore}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-primary">{telemetry.synergyLabel}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {telemetry.diagnostics.map((item) => (
                    <div
                      key={item.label}
                      className={`panel-cut border p-4 ${
                        item.kind === "ok" ? "border-primary/30 bg-primary/10" : "border-amber-400/30 bg-amber-500/10"
                      }`}
                    >
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-portal">{item.label}</p>
                      <p className="mt-2 text-sm leading-7 heading-portal">{item.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* IDENTIDADE TÁTICA DA LISTA */}
            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Análise do deck", "Deck analysis")}</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                  {tr("Identidade Tática da Lista", "List Identity")}
                  <MetricTooltip
                    metric="identidade-lista"
                    what={tr("Os pilares do arquétipo que o sistema detectou na lista: cor-base, trait-base, série-base e tipo-base, com quantas cartas sustentam cada um.", "The archetype pillars the system found in the list: base color, base trait, base series and base type, with how many cards support each.")}
                    howToRead={tr("Quanto mais definidos os quatro, mais focado o deck. Vazio = ainda faltam cartas pro sistema cravar o arquétipo.", "The clearer all four are, the more focused the deck. Empty = not enough cards yet to pin down the archetype.")}
                  />
                </h3>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {telemetry.archetypeBlocks.length ? (
                    telemetry.archetypeBlocks.map((block) => (
                      <div key={block.label} className="panel-cut border surface-strong p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{block.label}</p>
                        <p className="mt-2 text-lg heading-portal">{block.value}</p>
                        <p className="mt-2 text-sm text-muted-portal">{block.hint}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-portal">{tr("Adicione mais cartas para o sistema identificar melhor o arquétipo.", "Add more cards so the system can identify the archetype.")}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ASSISTENTE DE TELEMETRIA VEDA */}
            <VedaTelemetryAssistant
              entries={deckEntries}
              cardCache={cardCacheMap}
              onAddCard={(card) => {
                toast.info(tr(`Para adicionar ${card.namePt || card.name}, use o botão tr("Copiar para o deckbuilder", "Copy to deckbuilder").`, `To add ${card.namePt || card.name}, use the "Copy to deckbuilder" button.`));
              }}
              availableCards={allRows}
            />

            {/* TOP CORES & TOP TRAITS */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Sinergia de cor", "Color synergy")}</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                    {tr("Top cores do deck", "Top deck colors")}
                    <MetricTooltip
                      metric="top-cores"
                      what={tr("Quantas cartas de cada cor há no deck principal, da mais usada pra menos.", "How many cards of each color are in the main deck, most used first.")}
                      howToRead={tr("Um deck usa no máximo 2 cores. Se a 2ª cor aparece com poucas cartas, decida se compensa mantê-la. Clique numa cor pra ver as cartas.", "A deck uses at most 2 colors. If the 2nd color has few cards, decide whether it's worth keeping. Click a color to see the cards.")}
                    />
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {tr("Um deck só pode ter até 2 cores — se a 2ª cor aparecer com pouca presença, pode ser corte de teste ou fixação demais.", "A deck can have at most 2 colors — if the 2nd color barely shows up, it may be a test cut or too much splashing.")}
                  </p>
                  <div className="mt-5 space-y-3">
                    {telemetry.colorBreakdown.length ? (
                      telemetry.colorBreakdown.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => openStatDetail("Cor", item.name, (row) => row.color === item.name)}
                          className="group block w-full text-left transition hover:opacity-80"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="heading-portal">{item.name}</span>
                            <span className="flex items-center gap-1 text-muted-portal">
                              {item.value} · {item.pct}%
                              <ChevronRight className="size-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-none bg-white/5">
                            <div
                              className="h-full"
                              style={{ width: `${item.pct}%`, backgroundColor: GAME_COLOR_HEX[item.name] || "#94a3b8" }}
                            />
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-muted-portal">{tr("Adicione cartas ao deck principal para ver a distribuição.", "Add cards to the main deck to see the breakdown.")}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Sinergia de trait", "Trait synergy")}</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                    {tr("Top traits do deck", "Top deck traits")}
                    <MetricTooltip
                      metric="top-traits"
                      what={tr("As traits (marcadores temáticos, tipo 'Zeon' ou 'White Base Team') que mais se repetem entre as cartas.", "The traits (theme tags like 'Zeon' or 'White Base Team') that repeat most among the cards.")}
                      howToRead={tr("Trait repetido costuma indicar sinergia real — efeitos que reagem a uma trait específica. Clique pra ver as cartas.", "A repeated trait usually means real synergy — effects that react to that trait. Click to see the cards.")}
                    />
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {tr("Traits repetidos indicam sinergia real (habilidade que reage a trait específica) — não só tema visual.", "Repeated traits signal real synergy (abilities that react to a specific trait) — not just looks.")}
                  </p>
                  <div className="mt-5 space-y-3">
                    {telemetry.traitBreakdown.length ? (
                      telemetry.traitBreakdown.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => openStatDetail(tr("Trait", "Trait"), item.name, (row) => (row.trait || "Sem trait") === item.name)}
                          className="group block w-full text-left transition hover:opacity-80"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="heading-portal">{item.name}</span>
                            <span className="flex items-center gap-1 text-muted-portal">
                              {item.value} · {item.pct}%
                              <ChevronRight className="size-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-none bg-white/5">
                            <div className="h-full bg-amber-400" style={{ width: `${item.pct}%` }} />
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-muted-portal">{tr("Adicione cartas ao deck principal para ver a distribuição.", "Add cards to the main deck to see the breakdown.")}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* SÉRIES NO DECK & COMPOSIÇÃO POR TIPO */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Sinergia de série", "Series synergy")}</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                    {tr("Séries no deck", "Series in the deck")}
                    <MetricTooltip
                      metric="series-no-deck"
                      what={tr("De quais obras (séries de anime/filme) vêm as cartas do deck.", "Which works (anime/film series) the deck's cards come from.")}
                      howToRead={tr("Muitas cartas da mesma série tendem a combinar tematicamente, às vezes mecanicamente. Clique numa série pra ver as cartas.", "Many cards from the same series tend to fit thematically, sometimes mechanically. Click a series to see the cards.")}
                    />
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {tr("Vários cards da mesma série costumam ter sinergia temática (nem sempre mecânica) entre si.", "Several cards from the same series often share a theme (not always mechanics).")}
                  </p>
                  <div className="mt-5 space-y-3">
                    {telemetry.seriesBreakdown.length ? (
                      telemetry.seriesBreakdown.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => openStatDetail(tr("Série", "Series"), item.name, (row) => (row.series || "Sem série definida") === item.name)}
                          className="group block w-full text-left transition hover:opacity-80"
                        >
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="min-w-0 truncate heading-portal">{item.name}</span>
                            <span className="flex shrink-0 items-center gap-1 text-muted-portal">
                              {item.value} · {item.pct}%
                              <ChevronRight className="size-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-none bg-white/5">
                            <div className="h-full bg-accent" style={{ width: `${item.pct}%` }} />
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-muted-portal">{tr("Adicione cartas ao deck principal para ver a distribuição.", "Add cards to the main deck to see the breakdown.")}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Composição por tipo", "Composition by type")}</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                    {tr("Tipos no deck", "Types in the deck")}
                    <MetricTooltip
                      metric="tipos-no-deck"
                      what={tr("Proporção de Unidade / Piloto / Comando / Base na lista principal.", "Share of Unit / Pilot / Command / Base in the main list.")}
                      howToRead={tr("Mostra se o deck tem recurso pra jogo longo ou é só pressão inicial. Clique num tipo pra ver as cartas.", "Shows whether the deck has gas for a long game or is just early pressure. Click a type to see the cards.")}
                    />
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {tr("Unidade/Piloto/Comando/Base em proporção — mostra se o deck tem gás pra jogo tardio ou é só pressão inicial.", "Unit/Pilot/Command/Base share — shows whether the deck has gas for the late game or is just early pressure.")}
                  </p>
                  <div className="mt-5 space-y-3">
                    {telemetry.typeBreakdown.length ? (
                      telemetry.typeBreakdown.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => openStatDetail("Tipo", item.name, (row) => (row.type || "UNIT").toUpperCase() === item.name.toUpperCase())}
                          className="group block w-full text-left transition hover:opacity-80"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="heading-portal">{item.name}</span>
                            <span className="flex items-center gap-1 text-muted-portal">
                              {item.value} · {item.pct}%
                              <ChevronRight className="size-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-none bg-white/5">
                            <div className="h-full bg-emerald-400" style={{ width: `${item.pct}%` }} />
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-muted-portal">{tr("Adicione cartas ao deck principal para ver a distribuição.", "Add cards to the main deck to see the breakdown.")}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* KEYWORDS DE EFEITO & GATILHO */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Cobertura de keywords", "Keyword coverage")}</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                    {tr("Keywords de efeito", "Effect keywords")}
                    <MetricTooltip
                      metric="keywords-efeito"
                      what={tr("Quantas cartas têm cada keyword de efeito (Repair, Breach, Blocker, Support...) — o que a carta FAZ.", "How many cards have each effect keyword (Repair, Breach, Blocker, Support...) — what the card DOES.")}
                      howToRead={tr("Mais cartas com a mesma keyword = plano mecânico mais consistente. O % é sobre o deck principal. Clique pra ver as cartas.", "More cards with the same keyword = a more consistent plan. The % is of the main deck. Click to see the cards.")}
                    />
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {tr("O que a carta FAZ mecanicamente (Repair, Breach, Blocker...) — construção matemática de sinergia, não só tema.", "What the card DOES mechanically (Repair, Breach, Blocker...) — real synergy, not just theme.")}
                  </p>
                  <div className="mt-5 space-y-3">
                    {telemetry.effectKeywords.length ? (
                      telemetry.effectKeywords.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => openStatDetail(tr("Keyword de efeito", "Effect keyword"), item.name, (row) => Boolean(row.keywords?.includes(item.name)))}
                          className="group block w-full text-left transition hover:opacity-80"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="heading-portal">{item.name}</span>
                            <span className="flex items-center gap-1 text-muted-portal">
                              {item.count} · {item.pct}%
                              <ChevronRight className="size-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-none bg-white/5">
                            <div className="h-full bg-primary" style={{ width: `${item.pct}%` }} />
                          </div>
                          {item.valueBreakdown ? (
                            <p className="mt-1 text-[11px] text-slate-500">
                              {item.valueBreakdown.map(([val, qty]) => `${qty}x ${item.name} ${val}`).join(", ")}
                            </p>
                          ) : null}
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-muted-portal">{tr("Nenhuma keyword de efeito detectada ainda neste deck.", "No effect keywords found in this deck yet.")}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Cobertura de keywords", "Keyword coverage")}</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                    {tr("Keywords de gatilho", "Trigger keywords")}
                    <MetricTooltip
                      metric="keywords-gatilho"
                      what={tr("Quantas cartas ativam em cada momento do jogo (Deploy, Burst, Once per Turn, Attack...) — QUANDO a carta reage.", "How many cards trigger at each moment of the game (Deploy, Burst, Once per Turn, Attack...) — WHEN the card reacts.")}
                      howToRead={tr("Ajuda a ver se o deck depende de um único momento do turno. Clique pra ver as cartas.", "Helps you see if the deck depends on a single moment of the turn. Click to see the cards.")}
                    />
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {tr("QUANDO a carta ativa (Deploy, Burst, Once per Turn...) — ajuda a ver se o deck depende de um momento específico do turno.", "WHEN the card triggers (Deploy, Burst, Once per Turn...) — helps you see if the deck depends on a specific moment of the turn.")}
                  </p>
                  <div className="mt-5 space-y-3">
                    {telemetry.triggerKeywords.length ? (
                      telemetry.triggerKeywords.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => openStatDetail(tr("Keyword de gatilho", "Trigger keyword"), item.name, (row) => Boolean(row.triggerKeywords?.includes(item.name)))}
                          className="group block w-full text-left transition hover:opacity-80"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="heading-portal">{item.name}</span>
                            <span className="flex items-center gap-1 text-muted-portal">
                              {item.count} · {item.pct}%
                              <ChevronRight className="size-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-none bg-white/5">
                            <div className="h-full bg-accent" style={{ width: `${item.pct}%` }} />
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-muted-portal">{tr("Nenhuma keyword de gatilho detectada ainda neste deck.", "No trigger keywords found in this deck yet.")}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* GRÁFICO 01 (CURVA DE CUSTO) & GRÁFICO 02 (DISTRIBUIÇÃO POR COR) */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Gráfico 01", "Chart 01")}</p>
                      <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                        {tr("Curva de custo", "Cost curve")}
                        <MetricTooltip
                          metric="curva-custo"
                          what={tr("Quantas cartas do deck principal existem em cada valor de custo.", "How many main deck cards there are at each cost.")}
                          howToRead={tr("Curva concentrada em custo baixo joga cedo; muita carta cara exige sobreviver até montar recurso. Clique numa barra pra ver as cartas.", "A low-cost curve plays early; many expensive cards mean surviving until you have the resources. Click a bar to see the cards.")}
                        />
                      </h3>
                    </div>
                  </div>
                  <div className="mt-6 h-[260px]">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                      <BarChart data={telemetry.curveData}>
                        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="cost" tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar
                          dataKey="quantity"
                          radius={0}
                          fill="var(--color-quantity)"
                          onClick={(entry: any) =>
                            openStatDetail("Custo", `${entry.cost}`, (row) => String(row.cost) === entry.cost)
                          }
                          className="cursor-pointer"
                        />
                      </BarChart>
                    </ChartContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Gráfico 02", "Chart 02")}</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                    {tr("Distribuição por cor", "Color distribution")}
                    <MetricTooltip
                      metric="distribuicao-cor"
                      what={tr("A mesma contagem de cores do deck, agora em gráfico de pizza.", "The same color count, as a pie chart.")}
                      howToRead={tr("A maior fatia é a cor-base do deck. Clique numa fatia pra ver as cartas.", "The biggest slice is the deck's base color. Click a slice to see the cards.")}
                    />
                  </h3>
                  <div className="mt-6 h-[260px]">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                        <Pie
                          data={telemetry.colorPieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={52}
                          outerRadius={90}
                          strokeWidth={2}
                          onClick={(entry: any) =>
                            openStatDetail("Cor", entry.name, (row) => row.color === entry.name)
                          }
                          className="cursor-pointer"
                        >
                          {telemetry.colorPieData.map((entry) => (
                            <Cell key={entry.name} fill={GAME_COLOR_HEX[entry.name] || "#94a3b8"} />
                          ))}
                        </Pie>
                        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                      </PieChart>
                    </ChartContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* CONSISTÊNCIA: MÃO INICIAL (PROBABILIDADE HIPERGEOMÉTRICA) */}
            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Consistência", "Consistency")}</p>
                    <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                      {tr("Mão inicial", "Opening hand")}
                      <MetricTooltip
                        metric="mao-inicial"
                        what={tr("Probabilidade de a sua mão de abertura (5 cartas compradas do deck principal embaralhado) conter certos tipos de carta. Cálculo hipergeométrico.", "Probability that your opening hand (5 cards from the shuffled main deck) contains certain card types. Hypergeometric math.")}
                        howToRead={tr("Quanto maior a %, mais confiável é abrir bem. 'Com 1 mulligan' conta a mão original OU a redistribuída — pela regra oficial, o mulligan é um sorteio novo e independente, não uma troca parcial.", "The higher the %, the more reliable your opening. 'With 1 mulligan' counts the original hand OR the redraw — under the official rules the mulligan is a fresh, independent draw, not a partial swap.")}
                      />
                    </h3>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-none font-mono text-xs"
                    disabled={telemetry.mainDeckCount === 0}
                    onClick={() => setOpeningHandOpen(true)}
                  >
                    <Eye className="mr-2 size-4 text-primary" />
                    {tr("Simular abertura de mão", "Simulate opening hand")}
                  </Button>
                </div>

                {telemetry.mainDeckCount > 0 ? (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <button
                      type="button"
                      onClick={() =>
                        openStatDetail(
                          tr("Mão inicial", "Opening hand"),
                          tr("Unidade/Base jogável cedo (≤T2)", "Unit/Base playable early (≤T2)"),
                          (row) => isBoardDevelopmentCard(row) && earliestPlayableTurn(row) <= LOW_COST_MAX
                        )
                      }
                      className="group panel-cut border surface-strong p-4 text-left transition hover:opacity-80"
                    >
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        {tr("Unidade/Base jogável cedo (≤T2)", "Unit/Base playable early (≤T2)")}
                        <MetricTooltip
                          metric="custo-baixo-contagem"
                          what={tr("Quantas Unidades/Bases do deck principal têm turno mínimo (o maior entre custo e nível) até T2.", "How many main deck Units/Bases have a minimum turn (the higher of cost and level) of T2 or less.")}
                          howToRead={tr("São as cartas que realmente desenvolvem o campo já nos primeiros turnos — Piloto/Comando de custo baixo não contam, e nível alto também trava o turno mesmo com custo baixo. Clique pra ver quais são.", "These are the cards that actually build your board in the first turns — cheap Pilots/Commands don't count, and a high level also delays the turn even with a low cost. Click to see them.")}
                        />
                      </p>
                      <p className="mt-2 flex items-center gap-1 text-lg heading-portal font-mono">
                        {telemetry.handOdds.lowCostCount} de {telemetry.mainDeckCount}
                        <ChevronRight className="size-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                      </p>
                      <p className="mt-2 text-sm text-muted-portal">
                        {Math.round((telemetry.handOdds.lowCostCount / telemetry.mainDeckCount) * 100)}% {tr("da lista principal.", "of the main list.")}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openStatDetail(
                          tr("Mão inicial", "Opening hand"),
                          tr("Unidade/Base jogável cedo na abertura", "Unit/Base playable early in the opening hand"),
                          (row) => isBoardDevelopmentCard(row) && earliestPlayableTurn(row) <= LOW_COST_MAX
                        )
                      }
                      className="group panel-cut border border-primary/30 bg-primary/10 p-4 text-left transition hover:opacity-80"
                    >
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-portal">
                        {tr("Unidade/Base jogável cedo na abertura", "Unit/Base playable early in the opening hand")}
                        <MetricTooltip
                          metric="custo-baixo-abertura"
                          what={tr("Chance de a mão de abertura (5 cartas) ter pelo menos 1 Unidade/Base com turno mínimo (custo E nível) até T2.", "Chance the opening hand (5 cards) has at least 1 Unit/Base with a minimum turn (cost AND level) of T2 or less.")}
                          howToRead={tr("Acima de ~70% costuma ser confortável. Abaixo disso, considere adicionar Unidades/Bases baratas E de nível baixo — custo baixo sozinho não garante jogo cedo. Clique pra ver quais contam.", "Above ~70% is usually comfortable. Below that, consider adding Units/Bases that are cheap AND low level — low cost alone doesn't guarantee an early play. Click to see which count.")}
                        />
                      </p>
                      <p className="mt-2 flex items-center gap-1 font-heading text-4xl heading-portal">
                        {Math.round(telemetry.handOdds.openingHand * 100)}%
                        <ChevronRight className="size-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                      </p>
                      <p className="mt-2 text-sm text-muted-portal">
                        {tr("De abrir com pelo menos 1 Unidade/Base jogável cedo, em 5 compradas.", "Of opening with at least 1 early-playable Unit/Base, in 5 cards drawn.")}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openStatDetail(
                          tr("Mão inicial", "Opening hand"),
                          tr("Unit jogável cedo na abertura", "Unit playable early in the opening hand"),
                          (row) =>
                            row.type === "UNIT" &&
                            typeof row.level === "number" &&
                            row.level >= 1 &&
                            earliestPlayableTurn(row) <= LOW_LEVEL_MAX
                        )
                      }
                      className="group panel-cut border border-accent/30 bg-accent/10 p-4 text-left transition hover:opacity-80"
                    >
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-portal">
                        {tr("Unit jogável cedo na abertura", "Unit playable early in the opening hand")}
                        <MetricTooltip
                          metric="nivel-baixo-abertura"
                          what={tr("Chance de abrir com pelo menos 1 Unidade cujo turno mínimo (o maior entre custo e nível) seja até T3.", "Chance of opening with at least 1 Unit whose minimum turn (the higher of cost and level) is T3 or less.")}
                          howToRead={tr("Uma Unidade de nível baixo mas custo alto (ou vice-versa) ainda não é jogável cedo — os dois precisam estar baixos. Clique pra ver quais Units contam.", "A Unit with low level but high cost (or vice versa) still isn't playable early — both need to be low. Click to see which Units count.")}
                        />
                      </p>
                      <p className="mt-2 flex items-center gap-1 font-heading text-4xl heading-portal">
                        {Math.round(telemetry.lowLevelStats.openingHand * 100)}%
                        <ChevronRight className="size-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                      </p>
                      <p className="mt-2 text-sm text-muted-portal">
                        {tr(`De abrir com pelo menos 1 Unit Lv.1–3 (${telemetry.lowLevelStats.lowLevelUnitCount} na lista), em 5 compradas.`, `Of opening with at least 1 Lv.1–3 Unit (${telemetry.lowLevelStats.lowLevelUnitCount} in the list), in 5 cards drawn.`)}
                      </p>
                    </button>

                    <div className="panel-cut border surface-strong p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        {tr("Com 1 mulligan", "With 1 mulligan")}
                        <MetricTooltip
                          metric="custo-baixo-mulligan"
                          what={tr("A mesma chance de custo baixo, mas contando a mão original OU a redistribuída pelo mulligan.", "The same low-cost chance, counting the original hand OR the mulligan redraw.")}
                          howToRead={tr("É sempre ≥ a chance sem mulligan — é o piso realista, já que o mulligan é grátis e independente.", "Always ≥ the chance without a mulligan — the realistic floor, since the mulligan is free and independent.")}
                        />
                      </p>
                      <p className="mt-2 text-lg heading-portal font-mono">
                        {Math.round(telemetry.handOdds.withMulligan * 100)}%
                      </p>
                      <p className="mt-2 text-sm text-muted-portal">
                        {tr("Unidade/Base jogável cedo, contando a mão original ou a redistribuída.", "Unit/Base playable early, counting the original hand or the redraw.")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-6 text-sm text-muted-portal">{tr("Adicione cartas ao deck principal para calcular a chance de abertura.", "Add cards to the main deck to calculate the opening odds.")}</p>
                )}

                {telemetry.mainDeckCount > 0 ? (
                  <Collapsible open={handOddsBreakdownOpen} onOpenChange={setHandOddsBreakdownOpen} className="mt-5 border-t border-white/10 pt-4">
                    <CollapsibleTrigger asChild>
                      <button type="button" className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary transition hover:opacity-80">
                        <ChevronDown className={`size-3.5 transition-transform ${handOddsBreakdownOpen ? "rotate-180" : ""}`} />
                        {tr("Ver detalhamento do cálculo", "See the calculation")}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-3">
                      <p className="text-sm text-muted-portal">
                        {tr("Cálculo hipergeométrico — probabilidade de comprar pelo menos 1 sucesso numa amostra sem reposição:", "Hypergeometric math — probability of drawing at least 1 success in a sample without replacement:")}
                      </p>
                      <div className="panel-cut border surface-strong p-4 font-mono text-xs text-soft">
                        <p>P(pelo menos 1) = 1 − C(N−K, n) / C(N, n)</p>
                        <p className="mt-2 text-slate-500">{tr("onde:", "where:")}</p>
                        <p className="mt-1">N = {telemetry.mainDeckCount} <span className="text-slate-500">{tr("(cartas no deck principal)", "(cards in the main deck)")}</span></p>
                        <p>K = {telemetry.handOdds.lowCostCount} <span className="text-slate-500">{tr("(Unidade/Base jogável até o T2, os \"sucessos\")", "(Units/Bases playable by T2, the \"successes\")")}</span></p>
                        <p>n = 5 <span className="text-slate-500">{tr("(tamanho da mão comprada)", "(hand size drawn)")}</span></p>
                        <p className="mt-2 border-t border-white/10 pt-2">
                          P = 1 − C({telemetry.mainDeckCount - telemetry.handOdds.lowCostCount}, 5) / C({telemetry.mainDeckCount}, 5) ={" "}
                          <span className="text-primary">{(telemetry.handOdds.openingHand * 100).toFixed(2)}%</span>
                        </p>
                      </div>
                      <p className="text-sm text-muted-portal">
                        {tr(
                          `'Com 1 mulligan' trata cada tentativa como um sorteio independente da mesma população de ${telemetry.mainDeckCount} cartas (mulligan oficial: devolve a mão, embaralha e compra 5 de novo — não é uma troca parcial). A chance de acertar em pelo menos uma das duas tentativas é 1 − (1 − P)² = `,
                          `'With 1 mulligan' treats each attempt as an independent draw from the same ${telemetry.mainDeckCount} cards (official mulligan: return the hand, shuffle and draw 5 again — not a partial swap). The chance of hitting in at least one of the two attempts is 1 − (1 − P)² = `,
                        )}<span className="text-primary">{(telemetry.handOdds.withMulligan * 100).toFixed(2)}%</span>.
                      </p>
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
              </CardContent>
            </Card>

            {/* GRÁFICO 03: COMPOSIÇÃO POR TIPO */}
            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Gráfico 03", "Chart 03")}</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                  {tr("Composição por tipo", "Composition by type")}
                  <MetricTooltip
                    metric="composicao-tipo"
                    what={tr("Quantidade de cartas por tipo (Unidade, Piloto, Comando, Base), em barras horizontais.", "Number of cards per type (Unit, Pilot, Command, Base), as horizontal bars.")}
                    howToRead={tr("É o mesmo dado de 'Tipos no deck', em gráfico. Clique numa barra pra ver as cartas.", "Same data as 'Types in the deck', as a chart. Click a bar to see the cards.")}
                  />
                </h3>
                <div className="mt-6 h-[250px]">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart layout="vertical" data={telemetry.typeBarData} margin={{ left: 12, right: 12 }}>
                      <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.08)" />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={90} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="quantity"
                        radius={0}
                        fill="var(--color-quantity)"
                        onClick={(entry: any) =>
                          openStatDetail("Tipo", entry.name, (row) => (row.type || "UNIT").toUpperCase() === entry.name.toUpperCase())
                        }
                        className="cursor-pointer"
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            {/* GRÁFICOS 04, 05, 06: NÍVEL, AP, HP DAS UNIDADES */}
            {unitRows.length > 0 ? (
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="panel-cut rounded-none surface-panel">
                  <CardContent className="p-6">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Gráfico 04", "Chart 04")}</p>
                    <h3 className="mt-2 font-heading text-2xl uppercase heading-portal">
                      {tr("Curva de nível", "Level curve")}
                      <MetricTooltip
                        metric="curva-nivel"
                        what={tr("Distribuição das Unidades do deck principal por Lv. (Lv.6 e acima somam na faixa 6+).", "Main deck Units by Lv. (Lv.6 and above are grouped as 6+).")}
                        howToRead={tr("Nível alto exige mais recurso pra jogar. Concentração em nível baixo abre mais cedo. Clique numa barra pra ver as cartas.", "High level needs more resources to play. Low levels open earlier. Click a bar to see the cards.")}
                      />
                    </h3>
                    <div className="mt-6 h-[220px]">
                      <ChartContainer config={chartConfig} className="h-full w-full">
                        <BarChart data={telemetry.levelData}>
                          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="level" tickLine={false} axisLine={false} />
                          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar
                            dataKey="quantity"
                            radius={0}
                            fill="var(--color-quantity)"
                            onClick={(entry: any) =>
                              openStatDetail(
                                tr("Nível", "Level"),
                                entry.level,
                                (row) =>
                                  row.type === "UNIT" &&
                                  (entry.level === "6+" ? Number(row.level) >= 6 : String(row.level) === entry.level)
                              )
                            }
                            className="cursor-pointer"
                          />
                        </BarChart>
                      </ChartContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="panel-cut rounded-none surface-panel">
                  <CardContent className="p-6">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Gráfico 05", "Chart 05")}</p>
                    <h3 className="mt-2 font-heading text-2xl uppercase heading-portal">
                      {tr("Distribuição de AP", "AP distribution")}
                      <MetricTooltip
                        metric="distribuicao-ap"
                        what={tr("AP (poder de ataque) das Unidades do deck principal.", "AP (attack power) of the main deck Units.")}
                        howToRead={tr("AP alto pressiona mais e vence trocas; AP baixo depende de keyword ou pareamento. Clique numa barra pra ver as cartas.", "High AP pressures more and wins trades; low AP relies on keywords or pairing. Click a bar to see the cards.")}
                      />
                    </h3>
                    <div className="mt-6 h-[220px]">
                      <ChartContainer config={chartConfig} className="h-full w-full">
                        <BarChart data={telemetry.apData}>
                          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="ap" tickLine={false} axisLine={false} />
                          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar
                            dataKey="quantity"
                            radius={0}
                            fill="var(--color-quantity)"
                            onClick={(entry: any) =>
                              openStatDetail("AP", entry.ap, (row) => row.type === "UNIT" && String(row.ap) === entry.ap)
                            }
                            className="cursor-pointer"
                          />
                        </BarChart>
                      </ChartContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="panel-cut rounded-none surface-panel">
                  <CardContent className="p-6">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Gráfico 06", "Chart 06")}</p>
                    <h3 className="mt-2 font-heading text-2xl uppercase heading-portal">
                      {tr("Distribuição de HP", "HP distribution")}
                      <MetricTooltip
                        metric="distribuicao-hp"
                        what={tr("HP (pontos de vida) das Unidades do deck principal.", "HP (hit points) of the main deck Units.")}
                        howToRead={tr("HP alto sobrevive a mais dano e a remoções por dano; HP baixo cai fácil de Blocker e efeitos. Clique numa barra pra ver as cartas.", "High HP survives more damage and damage-based removal; low HP falls easily to Blockers and effects. Click a bar to see the cards.")}
                      />
                    </h3>
                    <div className="mt-6 h-[220px]">
                      <ChartContainer config={chartConfig} className="h-full w-full">
                        <BarChart data={telemetry.hpData}>
                          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="hp" tickLine={false} axisLine={false} />
                          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar
                            dataKey="quantity"
                            radius={0}
                            fill="var(--color-quantity)"
                            onClick={(entry: any) =>
                              openStatDetail("HP", entry.hp, (row) => row.type === "UNIT" && String(row.hp) === entry.hp)
                            }
                            className="cursor-pointer"
                          />
                        </BarChart>
                      </ChartContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {/* BASE DE METAGAME DO ARSENAL (REGRAS DA COMUNIDADE EM PT-BR) */}
            <Card className="panel-cut rounded-none surface-panel border-slate-200 dark:border-white/10">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="size-5 text-primary" />
                    <h3 className="font-heading text-xl uppercase tracking-wider text-slate-900 dark:text-white">
                      {tr("Base do meta", "Meta basis")}
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    {tr(`Calculado sobre ${sourceDecks.length} deck(s) cadastrados`, `Based on ${sourceDecks.length} recorded deck(s)`)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Staples */}
                  <div className="p-4 bg-white dark:bg-slate-950/80 border border-emerald-500/40 panel-cut">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      <span className="text-xs font-mono uppercase text-emerald-700 dark:text-emerald-400 font-bold">
                        Staples (≥75%)
                      </span>
                    </div>
                    <p className="font-heading text-2xl text-slate-900 dark:text-white mt-2">
                      {metagameCounts.staplesCount} {tr("cartas", "cards")}
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-mono ml-2">
                        ({Math.round((metagameCounts.staplesCount / (telemetry.mainDeckCount || 1)) * 100)}%)
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{tr("Cartas indispensáveis da lista", "Must-have cards")}</p>
                  </div>

                  {/* Engine / Peça-Chave */}
                  <div className="p-4 bg-white dark:bg-slate-950/80 border border-amber-500/40 panel-cut">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-500 dark:bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                      <span className="text-xs font-mono uppercase text-amber-700 dark:text-amber-400 font-bold">
                        {tr("Peça-Chave / Engine (≥50%)", "Key Piece / Engine (≥50%)")}
                      </span>
                    </div>
                    <p className="font-heading text-2xl text-slate-900 dark:text-white mt-2">
                      {metagameCounts.engineCount} {tr("cartas", "cards")}
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-mono ml-2">
                        ({Math.round((metagameCounts.engineCount / (telemetry.mainDeckCount || 1)) * 100)}%)
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{tr("Núcleo mecânico do arquétipo", "Archetype engine")}</p>
                  </div>

                  {/* Comum / Suporte */}
                  <div className="p-4 bg-white dark:bg-slate-950/80 border border-sky-500/40 panel-cut">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-sky-500 dark:bg-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
                      <span className="text-xs font-mono uppercase text-sky-700 dark:text-sky-400 font-bold">
                        {tr("Comum / Suporte (≥25%)", "Common / Support (≥25%)")}
                      </span>
                    </div>
                    <p className="font-heading text-2xl text-slate-900 dark:text-white mt-2">
                      {metagameCounts.commonCount} {tr("cartas", "cards")}
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-mono ml-2">
                        ({Math.round((metagameCounts.commonCount / (telemetry.mainDeckCount || 1)) * 100)}%)
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{tr("Opções regulares ou flexíveis", "Regular or flexible picks")}</p>
                  </div>

                  {/* Opção Tática / Tech */}
                  <div className="p-4 bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-700 panel-cut">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                      <span className="text-xs font-mono uppercase text-slate-700 dark:text-slate-300 font-bold">
                        {tr("Opção Tática / Tech (&lt;25%)", "Tech Option (&lt;25%)")}
                      </span>
                    </div>
                    <p className="font-heading text-2xl text-slate-900 dark:text-white mt-2">
                      {metagameCounts.techsCount} {tr("cartas", "cards")}
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-mono ml-2">
                        ({Math.round((metagameCounts.techsCount / (telemetry.mainDeckCount || 1)) * 100)}%)
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{tr("Respostas para matchups específicos", "Answers for specific matchups")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* TOKENS GERADOS EM BATALHA */}
            {detectedTokens.length > 0 && (
              <Card className="panel-cut rounded-none surface-panel border-amber-500/30">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
                    <Zap className="size-5 text-amber-500 dark:text-amber-400" />
                    <h3 className="font-heading text-xl uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      {tr("Tokens Gerados em Batalha", "Tokens Created in Battle")} ({detectedTokens.length})
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {detectedTokens.map((token) => {
                      const tokenImg = token.imageMediumUrl || token.imageUrl;
                      return (
                        <div
                          key={token.tokenCode}
                          className="flex gap-3 p-3 border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/80 items-start panel-cut"
                        >
                          <div className="w-16 shrink-0 aspect-[63/88] border border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-slate-900 overflow-hidden">
                            {tokenImg ? (
                              <img loading="lazy" decoding="async"
                                src={tokenImg}
                                alt={token.tokenName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] font-mono text-slate-500">
                                {token.tokenCode}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-heading text-base text-slate-900 dark:text-white truncate">
                                {token.tokenNamePt || token.tokenName}
                              </span>
                              <Badge
                                variant="outline"
                                className="rounded-none border-amber-500/50 text-amber-600 dark:text-amber-300 text-[10px] font-mono px-1.5 py-0"
                              >
                                {token.tokenCode}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-3 text-xs font-mono text-slate-600 dark:text-slate-300">
                              <span>AP: <strong className="text-slate-900 dark:text-white">{token.ap ?? "—"}</strong></span>
                              <span>HP: <strong className="text-slate-900 dark:text-white">{token.hp ?? "—"}</strong></span>
                            </div>

                            <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 pt-1">
                              {tr("Gerado por:", "Created by:")}{" "}
                              <span className="text-primary font-semibold">
                                {token.generatedBy.map((g) => `${g.quantity}x ${g.name}`).join(", ")}
                              </span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* MODAIS GLOBAIS */}
      <CardPreviewModal
        rows={visibleRows}
        index={previewIndex}
        onNavigate={setPreviewIndex}
        onClose={() => setPreviewIndex(null)}
      />

      {previewCard && (
        <CardPreviewModal
          rows={[previewCard]}
          index={0}
          onNavigate={() => {}}
          onClose={() => setPreviewCard(null)}
        />
      )}

      <OpeningHandModal
        open={openingHandOpen}
        onClose={() => setOpeningHandOpen(false)}
        cards={mainRows}
      />

      <StatDetailModal
        title={statDetail}
        rows={statDetailRows}
        onClose={() => setStatDetail(null)}
        onPreviewCard={(card) => {
          const matched = allRows.find((r) => r.id === card.id || r.code === card.code);
          if (matched) setPreviewCard(matched);
        }}
      />

      <BuildCoreDeckModal
        open={buildCoreModalOpen}
        onClose={() => setBuildCoreModalOpen(false)}
        archetypeName={archetypeMeta?.archetype?.name || deck?.name || "Deck"}
        coreCards={coreBuildCards}
        suggestedCards={suggestedCoreCards}
      />

      <SourceDecksModal
        open={sourceDecksModalOpen}
        onClose={() => setSourceDecksModalOpen(false)}
        archetypeName={archetypeMeta?.archetype?.name || deck?.name || "Deck"}
        sourceDecks={sourceDecks}
      />

      {imageModalOpen && (
        <ExportDeckImageModal
          open={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          deckName={deck.name}
          authorName={deck.user?.displayName || deck.user?.username || "Jogador"}
          shareId={deck.shareId || params?.shareId}
          mainCards={mainRows.map((r) => ({
            code: r.code,
            name: r.namePt || r.name,
            quantity: r.quantity,
            imageUrl: r.imageUrl,
            imageMediumUrl: r.imageMediumUrl,
            color: r.color,
            cardType: r.type,
            cost: r.cost,
          }))}
          resourceCards={resourceRows.map((r) => ({
            code: r.code,
            name: r.namePt || r.name,
            quantity: r.quantity,
            imageUrl: r.imageUrl,
            imageMediumUrl: r.imageMediumUrl,
            color: r.color,
            cardType: "RESOURCE",
          }))}
          exCards={[exBaseRow, exResourceRow].filter(Boolean).map((r: any) => ({
            code: r.code,
            name: r.namePt || r.name,
            quantity: r.quantity,
            imageUrl: r.imageUrl,
            imageMediumUrl: r.imageMediumUrl,
            color: r.color,
            cardType: r.type,
          }))}
          colors={telemetry.colorBreakdown.map((c) => c.name)}
          statsSummary={{
            avgCost: (mainRows.reduce((sum, r) => sum + (r.cost || 0) * r.quantity, 0) / (telemetry.mainDeckCount || 1)).toFixed(2),
            synergyScore: telemetry.synergyScore,
            turn1Odds: telemetry.handOdds.openingHand,
            turn2Odds: telemetry.handOdds.withMulligan,
            units: telemetry.typeBreakdown.find((t) => t.name === "UNIT" || t.name === "Unidade")?.value ?? 0,
            pilots: telemetry.typeBreakdown.find((t) => t.name === "PILOT" || t.name === "Piloto")?.value ?? 0,
            commands: telemetry.typeBreakdown.find((t) => t.name === "COMMAND" || t.name === "Comando")?.value ?? 0,
            bases: telemetry.typeBreakdown.find((t) => t.name === "BASE" || t.name === "Base")?.value ?? 0,
            costCurve: telemetry.curveData.map((c) => ({ cost: c.cost, count: c.quantity })),
            levelCurve: telemetry.levelData.map((l) => ({ level: l.level, count: l.quantity })),
            colorCounts: Object.fromEntries(telemetry.colorBreakdown.map((c) => [c.name, c.value])),
            staplesCount: metagameCounts.staplesCount,
            engineCount: metagameCounts.engineCount,
            techsCount: metagameCounts.techsCount,
            commonCount: metagameCounts.commonCount,
          }}
        />
      )}
    </PublicShell>
  );
}
