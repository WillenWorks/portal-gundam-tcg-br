import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import {
  Activity,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  Flame,
  Gauge,
  Heart,
  Layers,
  Shield,
  ShieldCheck,
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
import { StatDetailModal, type StatDetailRow } from "@/components/deck/StatDetailModal";
import { BuildCoreDeckModal, type CoreCardItem } from "@/components/deck/BuildCoreDeckModal";
import { SourceDecksModal } from "@/components/deck/SourceDecksModal";
import { VedaTelemetryAssistant } from "@/components/deck/VedaTelemetryAssistant";

import {
  computeUnifiedDeckTelemetry,
  getCardMetagameTier,
  LOW_COST_MAX,
  LOW_LEVEL_MAX,
  METAGAME_TIERS,
  type DeckCardModel,
} from "@/lib/deck-analytics-engine";
import { detectDeckTokens } from "@/lib/deck-tokens";
import { GAME_COLOR_HEX } from "@/lib/gundam-catalog";
import { mapApiCard } from "@/lib/api";
import type { CardRecord } from "@/modules/core/types";

import ozHangarBanner from "@/assets/oz-hangar-deck-banner.jpg";

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
  const image = row.imageMediumUrl || row.imageUrl;
  // presenceRate no backend varia de 0 a 100
  const presence = usage
    ? usage.presenceRate <= 1 && usage.presenceRate > 0
      ? usage.presenceRate * 100
      : usage.presenceRate
    : 0;
  const tierStyle = getCardMetagameTier(presence);

  return (
    <div
      className={`flex flex-col border ${tierStyle.borderClass} bg-slate-950/90 transition-all hover:scale-[1.02] hover:shadow-xl relative group`}
    >
      <button
        type="button"
        onClick={onPreview}
        title={`Ver ${row.namePt || row.name} em tamanho grande`}
        className="group relative block aspect-[63/88] w-full overflow-hidden bg-slate-900/60"
      >
        {image ? (
          <img
            src={image}
            alt={row.namePt || row.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-slate-950/90 p-2 text-center">
            <p className="text-[10px] font-mono uppercase text-slate-500">{row.code}</p>
            <p className="mt-1 text-xs font-semibold text-slate-300">{row.namePt || row.name}</p>
          </div>
        )}

        {/* Quantidade no deck (canto superior direito) */}
        <span className="absolute right-1 top-1 flex size-6 items-center justify-center bg-primary font-mono text-xs font-black text-primary-foreground shadow-md">
          {row.quantity}x
        </span>

        {/* Custo (canto superior esquerdo) */}
        {typeof row.cost === "number" && (
          <span className="absolute left-1 top-1 flex size-5 items-center justify-center bg-slate-950/90 border border-white/20 font-mono text-[10px] font-bold text-amber-300">
            {row.cost}
          </span>
        )}

        {/* Drawer informativo no hover */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-slate-950/95 p-2 text-left backdrop-blur-sm transition-all duration-200 group-hover:translate-y-0">
          <p className="truncate text-xs font-semibold text-white">{row.namePt || row.name}</p>
          <p className="truncate text-[10px] font-mono text-slate-400">
            {row.code} · {row.type}
          </p>
        </div>
      </button>

      {/* Painel Tático Inferior: Tier, Taxa de Uso e Seletor de Cópias */}
      <div className="border-t border-white/10 bg-slate-950 p-1.5 text-[10px] font-mono text-slate-300 space-y-1">
        {usage ? (
          <>
            <div className="flex items-center justify-between gap-1">
              <span className={`px-1 py-0.2 border text-[9px] font-semibold uppercase ${tierStyle.badgeClass}`}>
                {tierStyle.label.split(" / ")[0]}
              </span>
              <span className="font-bold text-white font-mono">
                {presence.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-[9px] text-slate-400">
              <span>{usage.deckCount}/{usage.totalDecks} decks</span>
              <span>Méd: {usage.avgCopies ? usage.avgCopies.toFixed(1) : "0.0"}x</span>
            </div>
          </>
        ) : (
          <div className="text-[9px] text-slate-500 text-center py-0.5">
            Sem dados de meta
          </div>
        )}

        {/* Pílulas de Quantidade de Cópias (1 2 3 4) - destaque na cópia ativa deste deck */}
        <div className="grid grid-cols-4 gap-0.5 pt-0.5">
          {[1, 2, 3, 4].map((copyNum) => {
            const isActive = row.quantity === copyNum;
            return (
              <div
                key={copyNum}
                className={`flex items-center justify-center py-0.5 text-[9px] font-bold transition-all ${
                  isActive
                    ? `${tierStyle.badgeClass} font-mono shadow-sm border`
                    : "bg-white/5 text-slate-600 border border-white/5"
                }`}
                title={`${copyNum} cópia(s)${isActive ? " (em uso neste deck)" : ""}`}
              >
                {copyNum}
              </div>
            );
          })}
        </div>
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
        <DialogTitle className="sr-only">{`Carta ampliada: ${card.namePt || card.name}`}</DialogTitle>
        <div className="relative mx-auto h-[447px] w-[320px] overflow-hidden border border-white/10 bg-slate-950/70">
          {image ? (
            <img src={image} alt={card.namePt || card.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500 font-mono text-xs">Arte indisponível</div>
          )}
          {rows.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => onNavigate((index - 1 + rows.length) % rows.length)}
                title="Carta anterior"
                className="absolute left-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/80 text-white transition hover:bg-primary hover:text-primary-foreground"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate((index + 1) % rows.length)}
                title="Próxima carta"
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
            href={`#/card/${card.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 underline font-mono pt-1"
          >
            <ExternalLink className="size-3.5" /> Detalhes da Carta
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SharedDeckPage() {
  const [, params] = useRoute<{ shareId: string }>("/deck/:shareId");
  const [, navigate] = useLocation();

  const [deck, setDeck] = useState<ApiDeck | null>(null);
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

        // Tenta buscar arquétipo para recuperar sourceDecks e coreBuild oficiais
        api
          .getMetaArchetypes()
          .then((archetypes) => {
            if (archetypes && archetypes.length > 0) {
              const matched =
                archetypes.find((a) => a.key === (loadedDeck as any).archetypeId) ||
                archetypes[0];
              if (matched) {
                api
                  .getArchetypeBreakdown(matched.key)
                  .then((bd) => setArchetypeMeta(bd))
                  .catch(() => {});
              }
            }
          })
          .catch(() => {});
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
      toast.success(res.liked ? "Deck marcado como favorito!" : "Curtida removida.");
    } catch {
      toast.error("Você precisa estar logado para curtir decks.");
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
    () => allRows.filter((row) => row.section !== "resource" && !NON_COUNTED_SECTIONS.has(row.section)),
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
      return archetypeMeta.coreBuild.coreCards.map((c) => ({
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
        presenceRate: c.inclusionRate <= 1 ? c.inclusionRate * 100 : c.inclusionRate,
        recommendedCopies: c.recommendedCopies || 4,
      }));
    }

    // Fallback inteligente: filtra cartas do deck atual com taxa >= 50%
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
          : 100;
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
        };
      });
  }, [archetypeMeta, mainRows, cardUsageMap]);

  // Sugestões complementares para o Core Build Modal (25% a 49%)
  const suggestedCoreCards: CoreCardItem[] = useMemo(() => {
    if (archetypeMeta?.coreBuild?.suggestedCards && archetypeMeta.coreBuild.suggestedCards.length > 0) {
      return archetypeMeta.coreBuild.suggestedCards.map((c) => ({
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
        presenceRate: c.inclusionRate <= 1 ? c.inclusionRate * 100 : c.inclusionRate,
        recommendedCopies: c.recommendedCopies || 2,
      }));
    }

    return mainRows
      .filter((r) => {
        const usage = cardUsageMap[r.code];
        const rate = usage
          ? usage.presenceRate <= 1 && usage.presenceRate > 0
            ? usage.presenceRate * 100
            : usage.presenceRate
          : 0;
        return rate >= 25 && rate < 50;
      })
      .map((r) => {
        const usage = cardUsageMap[r.code];
        const presence = usage
          ? usage.presenceRate <= 1 && usage.presenceRate > 0
            ? usage.presenceRate * 100
            : usage.presenceRate
          : 30;
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
        };
      });
  }, [archetypeMeta, mainRows, cardUsageMap]);

  // Lista de Source Decks da Amostra
  const sourceDecks: SourceDeckEntry[] = useMemo(() => {
    if (archetypeMeta?.sourceDecks && archetypeMeta.sourceDecks.length > 0) {
      return archetypeMeta.sourceDecks;
    }
    if (deck) {
      return [
        {
          id: deck.id,
          name: deck.name,
          shareId: deck.shareId,
          author: deck.user?.displayName || deck.user?.username || "Piloto Registrado",
          tournament: "Arsenal Competitivo Gundam TCG",
          placement: "#1",
          date: deck.updatedAt || deck.createdAt,
        },
      ];
    }
    return [];
  }, [archetypeMeta, deck]);

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
    toast.success("Deck copiado no formato MSA / Exburst!");
  };

  const exportWingTable = async () => {
    if (!mainRows.length) return;
    const lines = [
      "// Main Deck",
      ...mainRows.map((r) => `${r.quantity}x ${r.code}`),
      ...(resourceRows.length ? ["// Resource Deck", ...resourceRows.map((r) => `${r.quantity}x ${r.code}`)] : []),
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Deck copiado no formato Wing Table!");
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
        deckName: `${deck.name} (Cópia)`,
        visibility: "PRIVATE",
        entries,
      })
    );
    toast.success("Deck clonado! Abrindo no Hangar OZ...");
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
            Acessando especificações táticas no terminal Anaheim HUB...
          </p>
        </div>
      </PublicShell>
    );
  }

  if (error || !deck) {
    return (
      <PublicShell breadcrumbs={[{ label: "Decks", href: "/decks" }, { label: "Erro" }]}>
        <div className="p-8 border border-red-500/30 bg-red-950/20 text-center text-red-200">
          <p className="font-heading text-xl uppercase">Deck não localizado</p>
          <p className="mt-2 text-sm text-red-300">{error || "O deck solicitado não foi encontrado ou é privado."}</p>
          <Button
            onClick={() => navigate("/decks")}
            className="mt-4 rounded-none bg-red-600 hover:bg-red-500 text-white"
          >
            Voltar para o Arsenal
          </Button>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      breadcrumbs={[
        { label: "Decks", href: "/decks" },
        { label: deck.name || "Especificação de Deck" },
      ]}
      title={deck.name}
      description={deck.user?.displayName || deck.user?.username || "Piloto da OZ"}
    >
      <div className="space-y-6">
        {/* BANNER DO HANGAR OZ COM METADADOS DO DECK */}
        <Card className="panel-cut rounded-none border-primary/30 hero-surface overflow-hidden">
          <div className="relative min-h-[220px] sm:min-h-[260px] w-full overflow-hidden border-b border-white/10 bg-slate-950">
            <img
              src={deck.coverImage || ozHangarBanner}
              alt={deck.name}
              className="h-full w-full object-cover object-center brightness-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-transparent" />

            <div className="absolute left-6 bottom-4 right-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge className="rounded-none border-emerald-500/50 bg-emerald-950/80 text-emerald-300 text-[10px] uppercase font-mono">
                    {deck.format || "Padrão Construído"}
                  </Badge>
                  <span className="text-[10px] font-mono text-slate-400">REGISTRO #{deck.shareId}</span>
                </div>

                <h1 className="font-heading text-2xl sm:text-4xl uppercase text-white tracking-wider drop-shadow-md">
                  {deck.name}
                </h1>

                <p className="mt-1.5 text-xs text-slate-300 flex items-center gap-2">
                  <span className="font-mono text-slate-400 uppercase text-[11px]">Piloto / Autor:</span>
                  <strong className="text-primary font-semibold text-sm">
                    {deck.user?.displayName || deck.user?.username || "Piloto Anônimo"}
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
                      ? "bg-rose-950/60 border-rose-500 text-rose-400"
                      : "bg-slate-900/80 text-slate-300 hover:text-white"
                  }`}
                >
                  <Heart className={`mr-1.5 size-4 ${liked ? "fill-rose-500 text-rose-500" : ""}`} />
                  <span>{likeCount}</span>
                </Button>
                <div className="flex items-center gap-1.5 px-3 py-1.5 border border-white/15 bg-slate-900/80 text-xs font-mono text-slate-400">
                  <Eye className="size-3.5 text-slate-400" />
                  <span>{deck.viewCount || 1} visualizações</span>
                </div>
              </div>
            </div>
          </div>

          {/* BARRA DE TELEMETRIA RÁPIDA E AÇÕES TÁTICAS */}
          <CardContent className="p-4 sm:p-5 bg-slate-950/90">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Badges de calibração */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-none border-sky-400/40 bg-sky-950/30 text-sky-300 text-xs font-mono">
                  {telemetry.mainDeckCount}/{DECK_MAIN_SIZE} Deck Principal
                </Badge>
                <Badge className="rounded-none border-white/20 bg-white/5 text-slate-300 text-xs font-mono">
                  {resourceRows.reduce((acc, r) => acc + r.quantity, 0)}/{DECK_RESOURCE_SIZE} Recursos
                </Badge>
                <Badge className="rounded-none border-emerald-500/40 bg-emerald-950/30 text-emerald-300 text-xs font-mono">
                  Sinergia: {telemetry.synergyScore}/100 ({telemetry.synergyLabel})
                </Badge>
                {telemetry.dominantColor && (
                  <Badge className="rounded-none border-primary/40 bg-primary/10 text-primary text-xs font-mono">
                    Cor: {telemetry.dominantColor}
                  </Badge>
                )}
              </div>

              {/* Ações Táticas: Simular Draw, Exportar Imagem, Clonar */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpeningHandOpen(true)}
                  className="rounded-none border-emerald-500/50 bg-emerald-950/30 text-xs text-emerald-300 hover:bg-emerald-900/40 font-mono transition-all"
                  title="Simular compra de mão inicial (5 cartas) e testar mulligan"
                >
                  <Eye className="mr-1.5 size-3.5 text-emerald-400" />
                  Simular Draw
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportMSA}
                  className="rounded-none border-white/20 bg-white/5 text-xs text-white hover:bg-white/10 font-mono"
                >
                  <Copy className="mr-1.5 size-3.5" /> Copiar MSA
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImageModalOpen(true)}
                  className="rounded-none border-sky-400/50 bg-sky-950/30 text-xs text-sky-300 hover:bg-sky-900/40 font-mono transition-all"
                >
                  <Download className="mr-1.5 size-3.5 text-sky-400" />
                  Exportar Imagem
                </Button>
                <Button
                  size="sm"
                  onClick={cloneToDeckbuilder}
                  className="rounded-none bg-primary hover:bg-primary/90 text-primary-foreground font-heading uppercase text-xs tracking-wider shadow-lg shadow-primary/20"
                >
                  <Wrench className="mr-1.5 size-3.5" /> Clonar no Hangar OZ
                </Button>
              </div>
            </div>

            {deck.notes && (
              <div className="mt-3 pt-3 border-t border-white/10 text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold text-primary uppercase tracking-wider font-mono mr-2">
                  Diretrizes do Piloto:
                </span>
                {deck.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* NAVEGAÇÃO DE ABAS: CARTAS vs. ESTATÍSTICAS & TELEMETRIA */}
        <div className="flex border-b border-white/10 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("cartas")}
            className={`px-6 py-3 font-heading uppercase tracking-wider text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "cartas"
                ? "border-primary text-primary bg-primary/10 font-bold"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="size-4" />
            <span>Decklist & Estrutura</span>
            <span className="text-xs font-mono ml-1 text-slate-400">({telemetry.mainDeckCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("estatisticas")}
            className={`px-6 py-3 font-heading uppercase tracking-wider text-sm border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "estatisticas"
                ? "border-primary text-primary bg-primary/10 font-bold"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <BarChart3 className="size-4" />
            <span>Estatísticas & Telemetria</span>
            <Badge className="rounded-none border-primary/50 bg-primary/20 text-primary font-mono text-[10px] ml-1">
              VEDA
            </Badge>
          </button>
        </div>

        {/* ======================================================== */}
        {/* ABA 1: DECKLIST & ESTRUTURA                              */}
        {/* ======================================================== */}
        {activeTab === "cartas" ? (
          <div className="space-y-6">
            {/* BARRA SUPERIOR DE LEGENDA TÁTICA E NÚCLEO DO ARQUÉTIPO */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 border border-white/10 bg-slate-900/60 panel-cut">
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                <span className="text-slate-400 uppercase tracking-wider text-[11px] font-bold">Classificação:</span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  <span>Staple (≥75%)</span>
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="size-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                  <span>Peça-Chave / Engine (≥50%)</span>
                </span>
                <span className="flex items-center gap-1.5 text-sky-400">
                  <span className="size-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
                  <span>Comum / Suporte (≥25%)</span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="size-2 rounded-full bg-slate-500" />
                  <span>Opção Tática / Tech (&lt;25%)</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSourceDecksModalOpen(true)}
                  className="rounded-none border-white/20 bg-white/5 text-xs text-slate-200 hover:text-white font-mono"
                >
                  <Database className="size-3.5 mr-1.5 text-primary" />
                  Amostra ({sourceDecks.length})
                </Button>
                <Button
                  size="sm"
                  onClick={() => setBuildCoreModalOpen(true)}
                  className="rounded-none bg-primary text-primary-foreground font-heading uppercase text-xs tracking-wider hover:bg-primary/90 shadow-md shadow-primary/20"
                >
                  <Sparkles className="size-3.5 mr-1.5" />
                  Estrutura do Núcleo ({coreBuildCards.reduce((acc, c) => acc + (c.recommendedCopies || 1), 0)}/50)
                </Button>
              </div>
            </div>

            {/* GRADE DO DECK PRINCIPAL */}
            <Card className="panel-cut rounded-none surface-panel border-white/10">
              <CardContent className="p-5 space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-primary inline-block" />
                    <h3 className="font-heading text-lg uppercase tracking-wider text-white">
                      Deck Principal ({telemetry.mainDeckCount} / {DECK_MAIN_SIZE})
                    </h3>
                  </div>
                  {activeFilterPill && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveFilterPill(null)}
                      className="text-xs text-rose-400 hover:text-rose-300 h-7 px-2 font-mono"
                    >
                      Remover filtro ({activeFilterPill.value}) ✕
                    </Button>
                  )}
                </div>

                {/* Seção 1: UNIDADES */}
                {filteredUnitRows.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <span className="font-bold text-sky-400 uppercase tracking-wider">
                        Unidades ({filteredUnitRows.reduce((acc, r) => acc + r.quantity, 0)})
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
                  <div className="space-y-3 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <span className="font-bold text-amber-400 uppercase tracking-wider">
                        Pilotos, Comandos e Bases ({filteredSupportRows.reduce((acc, r) => acc + r.quantity, 0)})
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
                <div className="pt-4 border-t border-white/10 space-y-3 select-none">
                  {/* Tipos de Carta */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Tipos de Carta · <span className="text-slate-500 italic">Clique para filtrar</span>
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
                                : "bg-slate-900/80 border-white/10 text-slate-300 hover:border-white/30"
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
                                : "bg-slate-900/80 border-white/10 text-slate-300 hover:border-white/30"
                            }`}
                          >
                            <span className="size-2 rounded-full" style={{ backgroundColor: hex }} />
                            <span>{item.name}:</span>
                            <span className={active ? "text-primary-foreground" : "text-white font-bold"}>
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
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        Características da Esquadra ({traitList.length} traits)
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
                                  : "bg-slate-900/60 border-white/10 text-slate-400 hover:text-white"
                              }`}
                            >
                              <span>{trait}</span>
                              <span className={active ? "text-slate-950" : "text-amber-300 font-bold"}>
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
                                  : "bg-slate-900/60 border-purple-500/30 text-purple-300 hover:text-white"
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
                            : "bg-slate-900/60 border-rose-500/30 text-rose-300 hover:text-white"
                        }`}
                      >
                        Respostas Rápidas ({quickCountersCount})
                      </button>
                    )}

                    {burstCount > 0 && (
                      <button
                        type="button"
                        onClick={() => togglePill("burst", "burst")}
                        className={`px-2 py-0.5 rounded border ${
                          activeFilterPill?.key === "burst"
                            ? "bg-amber-500 text-slate-950 font-bold border-amber-400"
                            : "bg-slate-900/60 border-amber-500/30 text-amber-300 hover:text-white"
                        }`}
                      >
                        Gatilhos Burst ({burstCount})
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DECK DE RECURSOS */}
            {resourceRows.length > 0 && (
              <Card className="panel-cut rounded-none surface-panel border-white/10">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                    <h3 className="font-heading text-base uppercase text-white">
                      Deck de Recursos ({resourceRows.reduce((acc, r) => acc + r.quantity, 0)} / {DECK_RESOURCE_SIZE})
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
              <Card className="panel-cut rounded-none surface-panel border-white/10">
                <CardContent className="p-5">
                  <h3 className="font-heading text-base uppercase text-amber-400 mb-3">
                    Componentes EX Iniciais
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    {exBaseRow && (
                      <div className="w-32">
                        <p className="text-[10px] uppercase font-mono text-amber-400 mb-1">Base EX</p>
                        <ReadOnlyCardTile
                          row={exBaseRow}
                          onPreview={() => setPreviewIndex(visibleRows.findIndex((r) => r === exBaseRow))}
                        />
                      </div>
                    )}
                    {exResourceRow && (
                      <div className="w-32">
                        <p className="text-[10px] uppercase font-mono text-amber-400 mb-1">Recurso EX</p>
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
                      Diagnóstico operacional · Telemetria do Hangar & Sistema VEDA
                    </p>
                    <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                      Calibração Técnica da Lista
                      <MetricTooltip
                        metric="leitura-rapida"
                        what="Cinco checagens rápidas da lista: volume de cartas, variedade, cópias no limite (4x), cobertura por keywords e linha principal (trait dominante)."
                        howToRead="Borda azul = ok, borda âmbar = vale revisar. É diagnóstico, não bloqueia o deck de ser legal."
                      />
                    </h3>
                  </div>
                  <div className="panel-cut border border-primary/30 bg-primary/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-portal">
                      Sinergia estimada
                      <MetricTooltip
                        metric="sinergia-estimada"
                        what="Nota de 0 a 100 que estima o quão coeso o deck está: pesa cor dominante, trait dominante, cobertura de keywords e variedade de cartas."
                        howToRead="80+ = sinergia forte; 55–79 = em formação; abaixo = base ainda dispersa. É uma heurística do portal, não uma regra oficial."
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
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Processamento VEDA</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                  Identidade Tática da Lista
                  <MetricTooltip
                    metric="identidade-lista"
                    what="Os pilares do arquétipo que o sistema detectou na lista: cor-base, trait-base, série-base e tipo-base, com quantas cartas sustentam cada um."
                    howToRead="Quanto mais definidos os quatro, mais focado o deck. Vazio = ainda faltam cartas pro sistema cravar o arquétipo."
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
                    <p className="text-sm text-muted-portal">Adicione mais cartas para o sistema identificar melhor o arquétipo.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ASSISTENTE DE TELEMETRIA VEDA */}
            <VedaTelemetryAssistant
              entries={deckEntries}
              cardCache={cardCacheMap}
              onAddCard={(card) => {
                toast.info(`Para adicionar ${card.namePt || card.name}, use o botão "Clonar no Hangar OZ".`);
              }}
              availableCards={allRows}
            />

            {/* TOP CORES & TOP TRAITS */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Sinergia de cor</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                    Top cores do deck
                    <MetricTooltip
                      metric="top-cores"
                      what="Quantas cartas de cada cor há no deck principal, da mais usada pra menos."
                      howToRead="Um deck usa no máximo 2 cores. Se a 2ª cor aparece com poucas cartas, decida se compensa mantê-la. Clique numa cor pra ver as cartas."
                    />
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Um deck só pode ter até 2 cores — se a 2ª cor aparecer com pouca presença, pode ser corte de teste ou fixação demais.
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
                      <p className="text-sm text-muted-portal">Adicione cartas ao deck principal para ver a distribuição.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Sinergia de trait</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                    Top traits do deck
                    <MetricTooltip
                      metric="top-traits"
                      what="As traits (marcadores temáticos, tipo 'Zeon' ou 'White Base Team') que mais se repetem entre as cartas."
                      howToRead="Trait repetido costuma indicar sinergia real — efeitos que reagem a uma trait específica. Clique pra ver as cartas."
                    />
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Traits repetidos indicam sinergia real (habilidade que reage a trait específica) — não só tema visual.
                  </p>
                  <div className="mt-5 space-y-3">
                    {telemetry.traitBreakdown.length ? (
                      telemetry.traitBreakdown.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => openStatDetail("Trait", item.name, (row) => (row.trait || "Sem trait") === item.name)}
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
                      <p className="text-sm text-muted-portal">Adicione cartas ao deck principal para ver a distribuição.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* SÉRIES NO DECK & COMPOSIÇÃO POR TIPO */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Sinergia de série</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                    Séries no deck
                    <MetricTooltip
                      metric="series-no-deck"
                      what="De quais obras (séries de anime/filme) vêm as cartas do deck."
                      howToRead="Muitas cartas da mesma série tendem a combinar tematicamente, às vezes mecanicamente. Clique numa série pra ver as cartas."
                    />
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Vários cards da mesma série costumam ter sinergia temática (nem sempre mecânica) entre si.
                  </p>
                  <div className="mt-5 space-y-3">
                    {telemetry.seriesBreakdown.length ? (
                      telemetry.seriesBreakdown.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => openStatDetail("Série", item.name, (row) => (row.series || "Sem série definida") === item.name)}
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
                      <p className="text-sm text-muted-portal">Adicione cartas ao deck principal para ver a distribuição.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Composição por tipo</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                    Tipos no deck
                    <MetricTooltip
                      metric="tipos-no-deck"
                      what="Proporção de Unidade / Piloto / Comando / Base na lista principal."
                      howToRead="Mostra se o deck tem recurso pra jogo longo ou é só pressão inicial. Clique num tipo pra ver as cartas."
                    />
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Unidade/Piloto/Comando/Base em proporção — mostra se o deck tem gás pra jogo tardio ou é só pressão inicial.
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
                      <p className="text-sm text-muted-portal">Adicione cartas ao deck principal para ver a distribuição.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* KEYWORDS DE EFEITO & GATILHO */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Cobertura de keywords</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                    Keywords de efeito
                    <MetricTooltip
                      metric="keywords-efeito"
                      what="Quantas cartas têm cada keyword de efeito (Repair, Breach, Blocker, Support...) — o que a carta FAZ."
                      howToRead="Mais cartas com a mesma keyword = plano mecânico mais consistente. O % é sobre o deck principal. Clique pra ver as cartas."
                    />
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    O que a carta FAZ mecanicamente (Repair, Breach, Blocker...) — construção matemática de sinergia, não só tema.
                  </p>
                  <div className="mt-5 space-y-3">
                    {telemetry.effectKeywords.length ? (
                      telemetry.effectKeywords.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => openStatDetail("Keyword de efeito", item.name, (row) => Boolean(row.keywords?.includes(item.name)))}
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
                      <p className="text-sm text-muted-portal">Nenhuma keyword de efeito detectada ainda neste deck.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Cobertura de keywords</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                    Keywords de gatilho
                    <MetricTooltip
                      metric="keywords-gatilho"
                      what="Quantas cartas ativam em cada momento do jogo (Deploy, Burst, Once per Turn, Attack...) — QUANDO a carta reage."
                      howToRead="Ajuda a ver se o deck depende de um único momento do turno. Clique pra ver as cartas."
                    />
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    QUANDO a carta ativa (Deploy, Burst, Once per Turn...) — ajuda a ver se o deck depende de um momento específico do turno.
                  </p>
                  <div className="mt-5 space-y-3">
                    {telemetry.triggerKeywords.length ? (
                      telemetry.triggerKeywords.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => openStatDetail("Keyword de gatilho", item.name, (row) => Boolean(row.triggerKeywords?.includes(item.name)))}
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
                      <p className="text-sm text-muted-portal">Nenhuma keyword de gatilho detectada ainda neste deck.</p>
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
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Gráfico 01</p>
                      <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                        Curva de custo
                        <MetricTooltip
                          metric="curva-custo"
                          what="Quantas cartas do deck principal existem em cada valor de custo."
                          howToRead="Curva concentrada em custo baixo joga cedo; muita carta cara exige sobreviver até montar recurso. Clique numa barra pra ver as cartas."
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
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Gráfico 02</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                    Distribuição por cor
                    <MetricTooltip
                      metric="distribuicao-cor"
                      what="A mesma contagem de cores do deck, agora em gráfico de pizza."
                      howToRead="A maior fatia é a cor-base do deck. Clique numa fatia pra ver as cartas."
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
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Consistência</p>
                    <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                      Mão inicial
                      <MetricTooltip
                        metric="mao-inicial"
                        what="Probabilidade de a sua mão de abertura (5 cartas compradas do deck principal embaralhado) conter certos tipos de carta. Cálculo hipergeométrico."
                        howToRead="Quanto maior a %, mais confiável é abrir bem. 'Com 1 mulligan' conta a mão original OU a redistribuída — pela regra oficial, o mulligan é um sorteio novo e independente, não uma troca parcial."
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
                    Simular abertura de mão
                  </Button>
                </div>

                {telemetry.mainDeckCount > 0 ? (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <button
                      type="button"
                      onClick={() =>
                        openStatDetail(
                          "Mão inicial",
                          "Cartas de custo baixo (≤2)",
                          (row) =>
                            typeof row.cost === "number" &&
                            Number.isFinite(row.cost) &&
                            row.cost >= 0 &&
                            row.cost <= LOW_COST_MAX
                        )
                      }
                      className="group panel-cut border surface-strong p-4 text-left transition hover:opacity-80"
                    >
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Cartas de custo baixo (≤2)
                        <MetricTooltip
                          metric="custo-baixo-contagem"
                          what="Quantas cartas do deck principal custam 2 ou menos."
                          howToRead="São as cartas jogáveis já nos primeiros turnos. Poucas = risco de mão travada no começo. Clique pra ver quais são."
                        />
                      </p>
                      <p className="mt-2 flex items-center gap-1 text-lg heading-portal font-mono">
                        {telemetry.handOdds.lowCostCount} de {telemetry.mainDeckCount}
                        <ChevronRight className="size-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                      </p>
                      <p className="mt-2 text-sm text-muted-portal">
                        {Math.round((telemetry.handOdds.lowCostCount / telemetry.mainDeckCount) * 100)}% da lista principal.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openStatDetail(
                          "Mão inicial",
                          "Carta de custo baixo na abertura",
                          (row) =>
                            typeof row.cost === "number" &&
                            Number.isFinite(row.cost) &&
                            row.cost >= 0 &&
                            row.cost <= LOW_COST_MAX
                        )
                      }
                      className="group panel-cut border border-primary/30 bg-primary/10 p-4 text-left transition hover:opacity-80"
                    >
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-portal">
                        Carta de custo baixo na abertura
                        <MetricTooltip
                          metric="custo-baixo-abertura"
                          what="Chance de a mão de abertura (5 cartas) ter pelo menos 1 carta de custo ≤2."
                          howToRead="Acima de ~70% costuma ser confortável. Abaixo disso, considere adicionar cartas baratas. Clique pra ver quais contam."
                        />
                      </p>
                      <p className="mt-2 flex items-center gap-1 font-heading text-4xl heading-portal">
                        {Math.round(telemetry.handOdds.openingHand * 100)}%
                        <ChevronRight className="size-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                      </p>
                      <p className="mt-2 text-sm text-muted-portal">
                        De abrir com pelo menos 1 carta de custo baixo, em 5 compradas.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openStatDetail(
                          "Mão inicial",
                          "Unit de nível baixo na abertura",
                          (row) =>
                            row.type === "UNIT" &&
                            typeof row.level === "number" &&
                            row.level >= 1 &&
                            row.level <= LOW_LEVEL_MAX
                        )
                      }
                      className="group panel-cut border border-accent/30 bg-accent/10 p-4 text-left transition hover:opacity-80"
                    >
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-portal">
                        Unit de nível baixo na abertura
                        <MetricTooltip
                          metric="nivel-baixo-abertura"
                          what="Chance de abrir com pelo menos 1 Unidade de Lv.1 a Lv.3."
                          howToRead="Units de nível baixo entram cedo e seguram o tabuleiro no início. Clique pra ver quais Units contam."
                        />
                      </p>
                      <p className="mt-2 flex items-center gap-1 font-heading text-4xl heading-portal">
                        {Math.round(telemetry.lowLevelStats.openingHand * 100)}%
                        <ChevronRight className="size-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                      </p>
                      <p className="mt-2 text-sm text-muted-portal">
                        De abrir com pelo menos 1 Unit Lv.1–3 ({telemetry.lowLevelStats.lowLevelUnitCount} na lista), em 5 compradas.
                      </p>
                    </button>

                    <div className="panel-cut border surface-strong p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Com 1 mulligan
                        <MetricTooltip
                          metric="custo-baixo-mulligan"
                          what="A mesma chance de custo baixo, mas contando a mão original OU a redistribuída pelo mulligan."
                          howToRead="É sempre ≥ a chance sem mulligan — é o piso realista, já que o mulligan é grátis e independente."
                        />
                      </p>
                      <p className="mt-2 text-lg heading-portal font-mono">
                        {Math.round(telemetry.handOdds.withMulligan * 100)}%
                      </p>
                      <p className="mt-2 text-sm text-muted-portal">
                        Custo baixo, contando a mão original ou a redistribuída.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-6 text-sm text-muted-portal">Adicione cartas ao deck principal para calcular a chance de abertura.</p>
                )}

                {telemetry.mainDeckCount > 0 ? (
                  <Collapsible open={handOddsBreakdownOpen} onOpenChange={setHandOddsBreakdownOpen} className="mt-5 border-t border-white/10 pt-4">
                    <CollapsibleTrigger asChild>
                      <button type="button" className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary transition hover:opacity-80">
                        <ChevronDown className={`size-3.5 transition-transform ${handOddsBreakdownOpen ? "rotate-180" : ""}`} />
                        Ver detalhamento do cálculo
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-3">
                      <p className="text-sm text-muted-portal">
                        Cálculo hipergeométrico — probabilidade de comprar pelo menos 1 sucesso numa amostra sem reposição:
                      </p>
                      <div className="panel-cut border surface-strong p-4 font-mono text-xs text-soft">
                        <p>P(pelo menos 1) = 1 − C(N−K, n) / C(N, n)</p>
                        <p className="mt-2 text-slate-500">onde:</p>
                        <p className="mt-1">N = {telemetry.mainDeckCount} <span className="text-slate-500">(cartas no deck principal)</span></p>
                        <p>K = {telemetry.handOdds.lowCostCount} <span className="text-slate-500">(cartas de custo ≤2, os "sucessos")</span></p>
                        <p>n = 5 <span className="text-slate-500">(tamanho da mão comprada)</span></p>
                        <p className="mt-2 border-t border-white/10 pt-2">
                          P = 1 − C({telemetry.mainDeckCount - telemetry.handOdds.lowCostCount}, 5) / C({telemetry.mainDeckCount}, 5) ={" "}
                          <span className="text-primary">{(telemetry.handOdds.openingHand * 100).toFixed(2)}%</span>
                        </p>
                      </div>
                      <p className="text-sm text-muted-portal">
                        "Com 1 mulligan" trata cada tentativa como um sorteio independente da mesma população de {telemetry.mainDeckCount} cartas
                        (mulligan oficial: devolve a mão, embaralha e compra 5 de novo — não é uma troca parcial). A chance de acertar em pelo
                        menos uma das duas tentativas é 1 − (1 − P)² = <span className="text-primary">{(telemetry.handOdds.withMulligan * 100).toFixed(2)}%</span>.
                      </p>
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
              </CardContent>
            </Card>

            {/* GRÁFICO 03: COMPOSIÇÃO POR TIPO */}
            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Gráfico 03</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">
                  Composição por tipo
                  <MetricTooltip
                    metric="composicao-tipo"
                    what="Quantidade de cartas por tipo (Unidade, Piloto, Comando, Base), em barras horizontais."
                    howToRead="É o mesmo dado de 'Tipos no deck', em gráfico. Clique numa barra pra ver as cartas."
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
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Gráfico 04</p>
                    <h3 className="mt-2 font-heading text-2xl uppercase heading-portal">
                      Curva de nível
                      <MetricTooltip
                        metric="curva-nivel"
                        what="Distribuição das Unidades do deck principal por Lv. (Lv.6 e acima somam na faixa 6+)."
                        howToRead="Nível alto exige mais recurso pra jogar. Concentração em nível baixo abre mais cedo. Clique numa barra pra ver as cartas."
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
                                "Nível",
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
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Gráfico 05</p>
                    <h3 className="mt-2 font-heading text-2xl uppercase heading-portal">
                      Distribuição de AP
                      <MetricTooltip
                        metric="distribuicao-ap"
                        what="AP (poder de ataque) das Unidades do deck principal."
                        howToRead="AP alto pressiona mais e vence trocas; AP baixo depende de keyword ou pareamento. Clique numa barra pra ver as cartas."
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
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Gráfico 06</p>
                    <h3 className="mt-2 font-heading text-2xl uppercase heading-portal">
                      Distribuição de HP
                      <MetricTooltip
                        metric="distribuicao-hp"
                        what="HP (pontos de vida) das Unidades do deck principal."
                        howToRead="HP alto sobrevive a mais dano e a remoções por dano; HP baixo cai fácil de Blocker e efeitos. Clique numa barra pra ver as cartas."
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
            <Card className="panel-cut rounded-none surface-panel border-white/10">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="size-5 text-primary" />
                    <h3 className="font-heading text-xl uppercase tracking-wider text-white">
                      Base de Metagame do Arsenal
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Calculado sobre {sourceDecks.length} deck(s) cadastrados
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Staples */}
                  <div className="p-4 bg-slate-950/80 border border-emerald-500/40 panel-cut">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      <span className="text-xs font-mono uppercase text-emerald-400 font-bold">
                        Staples (≥75%)
                      </span>
                    </div>
                    <p className="font-heading text-2xl text-white mt-2">
                      {metagameCounts.staplesCount} cartas
                      <span className="text-xs text-slate-400 font-mono ml-2">
                        ({Math.round((metagameCounts.staplesCount / (telemetry.mainDeckCount || 1)) * 100)}%)
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">Cartas indispensáveis da lista</p>
                  </div>

                  {/* Engine / Peça-Chave */}
                  <div className="p-4 bg-slate-950/80 border border-amber-500/40 panel-cut">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                      <span className="text-xs font-mono uppercase text-amber-400 font-bold">
                        Peça-Chave / Engine (≥50%)
                      </span>
                    </div>
                    <p className="font-heading text-2xl text-white mt-2">
                      {metagameCounts.engineCount} cartas
                      <span className="text-xs text-slate-400 font-mono ml-2">
                        ({Math.round((metagameCounts.engineCount / (telemetry.mainDeckCount || 1)) * 100)}%)
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">Núcleo mecânico do arquétipo</p>
                  </div>

                  {/* Comum / Suporte */}
                  <div className="p-4 bg-slate-950/80 border border-sky-500/40 panel-cut">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
                      <span className="text-xs font-mono uppercase text-sky-400 font-bold">
                        Comum / Suporte (≥25%)
                      </span>
                    </div>
                    <p className="font-heading text-2xl text-white mt-2">
                      {metagameCounts.commonCount} cartas
                      <span className="text-xs text-slate-400 font-mono ml-2">
                        ({Math.round((metagameCounts.commonCount / (telemetry.mainDeckCount || 1)) * 100)}%)
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">Opções regulares ou flexíveis</p>
                  </div>

                  {/* Opção Tática / Tech */}
                  <div className="p-4 bg-slate-950/80 border border-slate-700 panel-cut">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-slate-500" />
                      <span className="text-xs font-mono uppercase text-slate-300 font-bold">
                        Opção Tática / Tech (&lt;25%)
                      </span>
                    </div>
                    <p className="font-heading text-2xl text-white mt-2">
                      {metagameCounts.techsCount} cartas
                      <span className="text-xs text-slate-400 font-mono ml-2">
                        ({Math.round((metagameCounts.techsCount / (telemetry.mainDeckCount || 1)) * 100)}%)
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">Respostas para matchups específicos</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* TOKENS GERADOS EM BATALHA */}
            {detectedTokens.length > 0 && (
              <Card className="panel-cut rounded-none surface-panel border-amber-500/30">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <Zap className="size-5 text-amber-400" />
                    <h3 className="font-heading text-xl uppercase tracking-wider text-amber-400">
                      Tokens Gerados em Batalha ({detectedTokens.length})
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {detectedTokens.map((token) => {
                      const tokenImg = token.imageMediumUrl || token.imageUrl;
                      return (
                        <div
                          key={token.tokenCode}
                          className="flex gap-3 p-3 border border-white/10 bg-slate-950/80 items-start panel-cut"
                        >
                          <div className="w-16 shrink-0 aspect-[63/88] border border-white/15 bg-slate-900 overflow-hidden">
                            {tokenImg ? (
                              <img
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
                              <span className="font-heading text-base text-white truncate">
                                {token.tokenNamePt || token.tokenName}
                              </span>
                              <Badge
                                variant="outline"
                                className="rounded-none border-amber-500/50 text-amber-300 text-[10px] font-mono px-1.5 py-0"
                              >
                                {token.tokenCode}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
                              <span>AP: <strong className="text-white">{token.ap ?? "—"}</strong></span>
                              <span>HP: <strong className="text-white">{token.hp ?? "—"}</strong></span>
                            </div>

                            <p className="text-[11px] font-mono text-slate-400 pt-1">
                              Gerado por:{" "}
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
        archetypeName={deck.name}
        coreCards={coreBuildCards}
        suggestedCards={suggestedCoreCards}
      />

      <SourceDecksModal
        open={sourceDecksModalOpen}
        onClose={() => setSourceDecksModalOpen(false)}
        archetypeName={deck.name}
        sourceDecks={sourceDecks}
      />

      {imageModalOpen && (
        <ExportDeckImageModal
          open={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          deckName={deck.name}
          authorName={deck.user?.displayName || deck.user?.username || "Piloto da OZ"}
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
            turn1Odds: telemetry.handOdds.withMulligan,
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
