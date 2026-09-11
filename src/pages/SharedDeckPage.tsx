/* Deck compartilhado v12.0 — Arsenal Tático da OZ & Laboratório Anaheim HUB
 * Identidade visual própria militar-tecnológica 100% em PT-BR.
 * Métricas: Cores usadas, cartas por cor, tipos, histogramas de Custo, Nível, AP e HP,
 * Curva Média, Diagrama e Gauge de Sinergia, Totais/Porcentagens de Metagame (Staples, Engine, Techs, Comum),
 * Taxa de uso nas cartas (% e total de decks), Probabilidade de Turno 1 e Turno 2,
 * e Simulador de Draw (Mão Inicial). */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Flame,
  Gauge,
  Heart,
  Layers,
  PieChart,
  Shield,
  Sparkles,
  Swords,
  Wrench,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import ozHangarBanner from "@/assets/home/oz_deck_hangar.jpg";
import { api, mapApiCard, type ApiDeck } from "@/lib/api";
import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DECK_MAIN_SIZE, DECK_RESOURCE_SIZE, NON_COUNTED_SECTIONS } from "@/lib/deck-legality";
import { calculateDeckCostLevelCurve, buildLevelCurve } from "@/lib/deck-level-stats";
import { ExportDeckImageModal } from "@/components/deck/ExportDeckImageModal";
import { TelemetryHistogram } from "@/components/deck/TelemetryHistogram";
import { OpeningHandModal } from "@/components/deck/OpeningHandModal";
import { detectDeckTokens, type DetectedToken } from "@/lib/deck-tokens";
import { GAME_COLOR_HEX } from "@/lib/gundam-catalog";

type DeckRow = ReturnType<typeof mapApiCard> & { quantity: number; section: string };

interface CardUsageInfo {
  deckCount: number;
  totalDecks: number;
  presenceRate: number;
  avgCopies: number;
}

/** Combinação hipergeométrica exata: nCr */
function combinations(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  if (r === 0 || r === n) return 1;
  let c = 1;
  for (let i = 1; i <= r; i++) {
    c = (c * (n - (r - i))) / i;
  }
  return c;
}

/** Probabilidade de comprar ao menos 1 carta válida em uma amostra sem reposição */
function hypergeometricAtLeastOne(popSize: number, successCount: number, sampleSize: number): number {
  if (popSize <= 0 || sampleSize <= 0) return 0;
  if (successCount <= 0) return 0;
  if (successCount >= popSize) return 1;
  const failures = popSize - successCount;
  if (failures < sampleSize) return 1;
  const pZero = combinations(failures, sampleSize) / combinations(popSize, sampleSize);
  return Math.max(0, Math.min(1, 1 - pZero));
}

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
  return (
    <div className="flex flex-col border border-white/10 bg-slate-950/80 transition-all hover:border-sky-400 hover:shadow-lg hover:shadow-sky-500/15">
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

        {/* Quantidade no topo direito */}
        <span className="absolute right-1 top-1 flex size-6 items-center justify-center bg-sky-500 font-mono text-xs font-black text-slate-950 shadow-md">
          {row.quantity}x
        </span>

        {/* Custo no topo esquerdo */}
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

      {/* Taxa de Uso da Carta no Metagame (exibida diretamente na carta) */}
      <div className="border-t border-white/10 bg-slate-950 p-1 text-[9px] font-mono text-slate-400 leading-tight">
        {usage ? (
          <div className="flex items-center justify-between gap-1">
            <span className="text-sky-400 font-bold">
              {Math.round(usage.presenceRate * 100)}% decks
            </span>
            <span className="text-slate-400 truncate">
              ({usage.deckCount}/{usage.totalDecks}) · {usage.avgCopies}x
            </span>
          </div>
        ) : (
          <span className="text-slate-400 block truncate">{row.code}</span>
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
      <DialogContent aria-describedby={undefined} className="w-[380px] max-h-[90vh] overflow-y-auto border-white/10 bg-slate-950 text-white">
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
                className="absolute left-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/80 text-white transition hover:bg-sky-500 hover:text-slate-950"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate((index + 1) % rows.length)}
                title="Próxima carta"
                className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/80 text-white transition hover:bg-sky-500 hover:text-slate-950"
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
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [openingHandOpen, setOpeningHandOpen] = useState(false);

  // Curtidas
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // Tokens Oficiais carregados da API
  const [officialTokens, setOfficialTokens] = useState<any[]>([]);

  // Mapa de taxa de uso de cartas no metagame
  const [cardUsageMap, setCardUsageMap] = useState<Record<string, CardUsageInfo>>({});

  // Filtro interativo nas pílulas de cartas
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

        // Carrega estatísticas de metagame para todas as cartas do deck
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

  const allRows = useMemo(() => {
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

  // Separação entre Unidades e Piloto/Comando/Base
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

  // Estatísticas e Curvas
  const stats = useMemo(() => {
    const mainCount = mainRows.reduce((sum, item) => sum + item.quantity, 0);
    const resourceCount = resourceRows.reduce((sum, item) => sum + item.quantity, 0);
    const { avgCostLevel } = calculateDeckCostLevelCurve(mainRows);

    // Cores
    const colorCounts: Record<string, number> = {};
    mainRows.forEach((r) => {
      if (r.color) {
        colorCounts[r.color] = (colorCounts[r.color] || 0) + r.quantity;
      }
    });

    // Tipos
    const typeCounts: Record<string, number> = {
      UNIT: 0,
      PILOT: 0,
      COMMAND: 0,
      BASE: 0,
    };
    mainRows.forEach((r) => {
      const t = (r.type || "UNIT").toUpperCase();
      typeCounts[t] = (typeCounts[t] || 0) + r.quantity;
    });

    // Curva de custo
    const costMap = new Map<number, number>();
    mainRows.forEach((r) => costMap.set(r.cost ?? 0, (costMap.get(r.cost ?? 0) || 0) + r.quantity));
    const costCurve = [0, 1, 2, 3, 4, 5, 6, 7].map((c) => ({
      cost: c === 7 ? "7+" : `${c}`,
      count: c === 7
        ? Array.from(costMap.entries()).filter(([cost]) => cost >= 7).reduce((acc, [, val]) => acc + val, 0)
        : costMap.get(c) || 0,
    }));

    // Curva de nível
    const levelMap = new Map<number, number>();
    mainRows.forEach((r) => {
      if (typeof r.level === "number") {
        levelMap.set(r.level, (levelMap.get(r.level) || 0) + r.quantity);
      }
    });
    const levelCurve = [1, 2, 3, 4, 5, 6, 7].map((lvl) => ({
      level: lvl === 7 ? "7+" : `${lvl}`,
      count: lvl === 7
        ? Array.from(levelMap.entries()).filter(([l]) => l >= 7).reduce((acc, [, val]) => acc + val, 0)
        : levelMap.get(lvl) || 0,
    }));

    // AP / HP das Unidades
    const units = mainRows.filter((r) => (r.type || "").toUpperCase() === "UNIT");
    const apBins = [
      { label: "1000-2000", min: 1000, max: 2000, count: 0 },
      { label: "3000-4000", min: 3000, max: 4000, count: 0 },
      { label: "5000-6000", min: 5000, max: 6000, count: 0 },
      { label: "7000+", min: 7000, max: 99999, count: 0 },
    ];
    const hpBins = [
      { label: "1-2", min: 1, max: 2, count: 0 },
      { label: "3-4", min: 3, max: 4, count: 0 },
      { label: "5-6", min: 5, max: 6, count: 0 },
      { label: "7+", min: 7, max: 99, count: 0 },
    ];

    units.forEach((u) => {
      if (typeof u.ap === "number") {
        const b = apBins.find((bin) => (u.ap ?? 0) >= bin.min && (u.ap ?? 0) <= bin.max);
        if (b) b.count += u.quantity;
      }
      if (typeof u.hp === "number") {
        const b = hpBins.find((bin) => (u.hp ?? 0) >= bin.min && (u.hp ?? 0) <= bin.max);
        if (b) b.count += u.quantity;
      }
    });

    // Métrica de Jogada Inicial: Turno 1 e Turno 2 (Cálculo Hipergeométrico com Mulligan)
    // Turno 1: 5 cartas iniciais + 1 compra = 6 cartas. Cartas elegíveis: Custo 1
    const cost1Cards = mainRows.filter((r) => (r.cost ?? 99) <= 1).reduce((acc, r) => acc + r.quantity, 0);
    const pT1Raw = hypergeometricAtLeastOne(mainCount, cost1Cards, 6);
    const pT1Mulligan = 1 - Math.pow(1 - pT1Raw, 2);

    // Turno 2: 5 cartas iniciais + 2 compras = 7 cartas. Cartas elegíveis: Custo <= 2
    const cost2Cards = mainRows.filter((r) => (r.cost ?? 99) <= 2).reduce((acc, r) => acc + r.quantity, 0);
    const pT2Raw = hypergeometricAtLeastOne(mainCount, cost2Cards, 7);
    const pT2Mulligan = 1 - Math.pow(1 - pT2Raw, 2);

    // Sinergia do Deck e Componentes do Diagrama
    const dominantColorCount = Math.max(...Object.values(colorCounts), 0);
    const colorCohesionPct = mainCount > 0 ? Math.round((dominantColorCount / mainCount) * 100) : 0;
    const unitCount = typeCounts["UNIT"] || 0;
    const pilotCount = typeCounts["PILOT"] || 0;
    const dockingRatioPct = unitCount > 0 ? Math.min(Math.round((pilotCount / (unitCount * 0.4)) * 100), 100) : 0;
    const fourCopiesCount = mainRows.filter((r) => r.quantity === 4).length;
    const consistencyPct = Math.min(Math.round((fourCopiesCount / 8) * 100), 100);
    const synergyScore = Math.round(colorCohesionPct * 0.4 + dockingRatioPct * 0.35 + consistencyPct * 0.25);

    // Classificação por Base de Metagame
    let staplesCount = 0;
    let engineCount = 0;
    let techsCount = 0;
    let commonCount = 0;

    mainRows.forEach((r) => {
      const usage = cardUsageMap[r.code];
      const rate = usage?.presenceRate ?? 0;
      if (rate >= 0.55) {
        staplesCount += r.quantity;
      } else if (r.trait && /gundam|zaft|orb|zeon|federation|spacy/i.test(r.trait)) {
        engineCount += r.quantity;
      } else if (/(?:counter|quick|blocker|burst)/i.test(r.effect || "")) {
        techsCount += r.quantity;
      } else {
        commonCount += r.quantity;
      }
    });

    return {
      mainCount,
      resourceCount,
      unique: mainRows.length + resourceRows.length,
      avgCost: avgCostLevel,
      colors: Object.keys(colorCounts),
      colorCounts,
      typeCounts,
      costCurve,
      levelCurve,
      apBins,
      hpBins,
      unitsCount: unitCount,
      synergyScore,
      synergyBreakdown: {
        colorCohesionPct,
        dockingRatioPct,
        consistencyPct,
      },
      turn1: {
        eligibleCount: cost1Cards,
        raw: pT1Raw,
        mulligan: pT1Mulligan,
      },
      turn2: {
        eligibleCount: cost2Cards,
        raw: pT2Raw,
        mulligan: pT2Mulligan,
      },
      metagame: {
        staplesCount,
        engineCount,
        techsCount,
        commonCount,
      },
    };
  }, [mainRows, resourceRows, cardUsageMap]);

  // Tokens detectados nas cartas do deck
  const detectedTokens = useMemo(() => {
    return detectDeckTokens(mainRows, officialTokens);
  }, [mainRows, officialTokens]);

  // Agrupamento de Traits e Links para pílulas interativas
  const { traitList, linkList, quickCountersCount, burstCount } = useMemo(() => {
    const traits = new Map<string, number>();
    const links = new Map<string, number>();
    let quick = 0;
    let burst = 0;

    mainRows.forEach((r) => {
      if (r.trait) {
        traits.set(r.trait, (traits.get(r.trait) || 0) + r.quantity);
      }
      if (r.effect) {
        const linkMatch = r.effect.match(/\[(?:Link|Pair)\s*:\s*([^\]]+)\]/i);
        if (linkMatch && linkMatch[1]) {
          const lName = linkMatch[1].trim();
          links.set(lName, (links.get(lName) || 0) + r.quantity);
        }
        if (/(?:quick|counter|blocker)/i.test(r.effect)) {
          quick += r.quantity;
        }
        if (/burst/i.test(r.effect)) {
          burst += r.quantity;
        }
      }
    });

    return {
      traitList: Array.from(traits.entries()).sort((a, b) => b[1] - a[1]),
      linkList: Array.from(links.entries()).sort((a, b) => b[1] - a[1]),
      quickCountersCount: quick,
      burstCount: burst,
    };
  }, [mainRows]);

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
    toast.success("Deck clonado! Abrindo no Hangar de Criação...");
    navigate("/deckbuilder/novo");
  };

  const togglePill = (key: "type" | "color" | "trait" | "link" | "quick" | "burst", value: string) => {
    setActiveFilterPill((prev) => (prev?.key === key && prev?.value === value ? null : { key, value }));
  };

  if (loading) {
    return (
      <PublicShell breadcrumbs={[{ label: "Decks", href: "/decks" }, { label: "Carregando..." }]}>
        <div className="py-24 text-center">
          <div className="mx-auto size-12 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
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
        {/* HERO CARD COM BANNER PADRÃO OZ HANGAR */}
        <Card className="panel-cut rounded-none border-sky-500/30 hero-surface overflow-hidden">
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

                {/* Exibição limpa do Piloto (sem a frase redundante) */}
                <p className="mt-1.5 text-xs text-slate-300 flex items-center gap-2">
                  <span className="font-mono text-slate-400 uppercase text-[11px]">Piloto / Autor:</span>
                  <strong className="text-sky-300 font-semibold text-sm">
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
                  {stats.mainCount}/{DECK_MAIN_SIZE} Deck Principal
                </Badge>
                <Badge className="rounded-none border-white/20 bg-white/5 text-slate-300 text-xs font-mono">
                  {stats.resourceCount}/{DECK_RESOURCE_SIZE} Recursos
                </Badge>
                <Badge className="rounded-none border-amber-400/40 bg-amber-950/30 text-amber-300 text-xs font-mono">
                  Curva Média: {stats.avgCost}
                </Badge>
                <Badge className="rounded-none border-emerald-500/40 bg-emerald-950/30 text-emerald-300 text-xs font-mono">
                  Sinergia: {stats.synergyScore}%
                </Badge>
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
                  className="rounded-none border-white/20 bg-white/5 text-xs text-white hover:bg-white/10"
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
                  className="rounded-none bg-sky-600 hover:bg-sky-500 text-white font-heading uppercase text-xs tracking-wider shadow-lg shadow-sky-600/20"
                >
                  <Wrench className="mr-1.5 size-3.5" /> Clonar no Hangar
                </Button>
              </div>
            </div>

            {deck.notes && (
              <div className="mt-3 pt-3 border-t border-white/10 text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold text-sky-400 uppercase tracking-wider font-mono mr-2">
                  Diretrizes do Piloto:
                </span>
                {deck.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* LAYOUT BALANCEADO: ESQUERDA (CARTAS) / DIREITA (TELEMETRIA ANAHEIM HUB) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUNA ESQUERDA: CARTAS DO DECK (col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="panel-cut rounded-none surface-panel border-white/10">
              <CardContent className="p-5 space-y-6">
                {/* Header do Deck Principal */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-sky-400 inline-block" />
                    <h3 className="font-heading text-lg uppercase tracking-wider text-white">
                      Deck Principal ({stats.mainCount} / {DECK_MAIN_SIZE})
                    </h3>
                  </div>
                  {activeFilterPill && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveFilterPill(null)}
                      className="text-xs text-rose-400 hover:text-rose-300 h-7 px-2"
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
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2.5">
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
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <span className="font-bold text-amber-400 uppercase tracking-wider">
                        Pilotos, Comandos e Bases ({filteredSupportRows.reduce((acc, r) => acc + r.quantity, 0)})
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2.5">
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
                      Tipos de Carta ({Object.keys(stats.typeCounts).filter((t) => stats.typeCounts[t] > 0).length} tipos) ·{" "}
                      <span className="text-slate-500 italic">Clique para filtrar</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(stats.typeCounts)
                        .filter(([, count]) => count > 0)
                        .map(([t, count]) => {
                          const active = activeFilterPill?.key === "type" && activeFilterPill.value === t;
                          const labelPt =
                            t === "UNIT" ? "Unidade" : t === "PILOT" ? "Piloto" : t === "COMMAND" ? "Comando" : "Base";
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => togglePill("type", t)}
                              className={`px-2.5 py-1 text-[11px] font-mono rounded-full border transition-all flex items-center gap-1.5 ${
                                active
                                  ? "bg-sky-500 text-slate-950 font-bold border-sky-400"
                                  : "bg-slate-900/80 border-white/10 text-slate-300 hover:border-white/30"
                              }`}
                            >
                              <span className="size-1.5 rounded-full bg-sky-400" />
                              <span>{labelPt}:</span>
                              <span className={active ? "text-slate-950" : "text-sky-300 font-bold"}>
                                {count}
                              </span>
                            </button>
                          );
                        })}

                      {/* Cores */}
                      {Object.entries(stats.colorCounts).map(([c, count]) => {
                        const active = activeFilterPill?.key === "color" && activeFilterPill.value === c;
                        const hex = (GAME_COLOR_HEX as any)[c] || "#64748b";
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => togglePill("color", c)}
                            className={`px-2.5 py-1 text-[11px] font-mono rounded-full border transition-all flex items-center gap-1.5 ${
                              active
                                ? "bg-sky-500 text-slate-950 font-bold border-sky-400"
                                : "bg-slate-900/80 border-white/10 text-slate-300 hover:border-white/30"
                            }`}
                          >
                            <span className="size-2 rounded-full" style={{ backgroundColor: hex }} />
                            <span>{c}:</span>
                            <span className={active ? "text-slate-950" : "text-white font-bold"}>
                              {count}
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
                      Deck de Recursos ({stats.resourceCount} / {DECK_RESOURCE_SIZE})
                    </h3>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
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
                      <div className="w-28">
                        <p className="text-[10px] uppercase font-mono text-amber-400 mb-1">Base EX</p>
                        <ReadOnlyCardTile
                          row={exBaseRow}
                          onPreview={() => setPreviewIndex(visibleRows.findIndex((r) => r === exBaseRow))}
                        />
                      </div>
                    )}
                    {exResourceRow && (
                      <div className="w-28">
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

          {/* COLUNA DIREITA: TELEMETRIA TÁTICA ANAHEIM HUB (col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            {/* BLOCO 1: CURVAS DE COMBATE & HISTOGRAMAS (CUSTO, NÍVEL, AP, HP) */}
            <Card className="panel-cut rounded-none surface-panel border-white/10">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="size-4 text-sky-400" />
                    <h3 className="font-heading text-base uppercase tracking-wider text-white">
                      Curvas & Telemetria do Mobile Suit
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">VEDA-OS</span>
                </div>

                {/* Grid 2x2 de Histogramas em Barras Táticas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TelemetryHistogram
                    title="Curva de Custo"
                    bins={stats.costCurve.map((c, idx) => ({ label: `${c.cost}`, value: idx, count: c.count }))}
                  />
                  <TelemetryHistogram
                    title="Curva de Nível"
                    bins={stats.levelCurve.map((l, idx) => ({ label: `${l.level}`, value: idx, count: l.count }))}
                  />
                  <TelemetryHistogram
                    title="Distribuição de AP (Poder)"
                    bins={stats.apBins.map((a, idx) => ({ label: a.label, value: idx, count: a.count }))}
                  />
                  <TelemetryHistogram
                    title="Distribuição de HP (Blindagem)"
                    bins={stats.hpBins.map((h, idx) => ({ label: h.label, value: idx, count: h.count }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* BLOCO 2: DIAGRAMA E PORCENTAGEM DE SINERGIA */}
            <Card className="panel-cut rounded-none surface-panel border-white/10">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Gauge className="size-4 text-emerald-400" />
                    <h3 className="font-heading text-base uppercase tracking-wider text-white">
                      Diagrama de Sinergia da Esquadra
                    </h3>
                  </div>
                  <Badge className="rounded-none border-emerald-500/40 bg-emerald-950/40 text-emerald-300 font-mono text-xs">
                    {stats.synergyScore}% EFICIÊNCIA
                  </Badge>
                </div>

                <div className="space-y-3 pt-1">
                  {/* Barra 1: Coesão de Cores */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Coesão de Cores ({stats.colors.join("/")}):</span>
                      <strong className="text-white">{stats.synergyBreakdown.colorCohesionPct}%</strong>
                    </div>
                    <div className="h-2 w-full bg-slate-900 border border-white/10">
                      <div
                        className="h-full bg-sky-400 transition-all duration-500"
                        style={{ width: `${stats.synergyBreakdown.colorCohesionPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Barra 2: Conexão Piloto / MS (Docking) */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Conexão Piloto / MS ({stats.typeCounts.PILOT}P / {stats.typeCounts.UNIT}MS):</span>
                      <strong className="text-white">{stats.synergyBreakdown.dockingRatioPct}%</strong>
                    </div>
                    <div className="h-2 w-full bg-slate-900 border border-white/10">
                      <div
                        className="h-full bg-amber-400 transition-all duration-500"
                        style={{ width: `${stats.synergyBreakdown.dockingRatioPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Barra 3: Consistência de Playsets (4 cópias) */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Consistência de Playsets (4x):</span>
                      <strong className="text-white">{stats.synergyBreakdown.consistencyPct}%</strong>
                    </div>
                    <div className="h-2 w-full bg-slate-900 border border-white/10">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-500"
                        style={{ width: `${stats.synergyBreakdown.consistencyPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* BLOCO 3: PROBABILIDADE DE CURVA INICIAL (TURNO 1 & TURNO 2) */}
            <Card className="panel-cut rounded-none surface-panel border-white/10">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="size-4 text-sky-400" />
                    <h3 className="font-heading text-base uppercase tracking-wider text-white">
                      Dinâmica & Ritmo de Jogo
                    </h3>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOpeningHandOpen(true)}
                    className="text-xs text-sky-400 hover:text-sky-300 h-7 px-2 font-mono"
                  >
                    Testar Draw ➔
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Turno 1 */}
                  <div className="p-3.5 bg-slate-950/80 border border-white/10 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Chance de Jogada no Turno 1
                    </span>
                    <p className="font-heading text-3xl text-sky-400">
                      {Math.round(stats.turn1.mulligan * 100)}%
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">
                      Custo 1 disponível ({stats.turn1.eligibleCount} cartas) · {Math.round(stats.turn1.raw * 100)}% sem mulligan
                    </p>
                  </div>

                  {/* Turno 2 */}
                  <div className="p-3.5 bg-slate-950/80 border border-white/10 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Chance de Jogada no Turno 2
                    </span>
                    <p className="font-heading text-3xl text-emerald-400">
                      {Math.round(stats.turn2.mulligan * 100)}%
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">
                      Custo ≤ 2 ({stats.turn2.eligibleCount} cartas) · {Math.round(stats.turn2.raw * 100)}% sem mulligan
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* BLOCO 4: TOKENS GERADOS EM BATALHA (MOSTRADO APENAS SE HOUVER GERADORES) */}
            {detectedTokens.length > 0 && (
              <Card className="panel-cut rounded-none surface-panel border-amber-500/30">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <Zap className="size-4 text-amber-400" />
                    <h3 className="font-heading text-base uppercase tracking-wider text-amber-400">
                      Tokens Gerados em Batalha ({detectedTokens.length})
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {detectedTokens.map((token) => {
                      const tokenImg = token.imageMediumUrl || token.imageUrl;
                      return (
                        <div
                          key={token.tokenCode}
                          className="flex gap-3 p-3 border border-white/10 bg-slate-950/80 items-start"
                        >
                          <div className="w-14 shrink-0 aspect-[63/88] border border-white/15 bg-slate-900 overflow-hidden">
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
                              <span className="font-heading text-sm text-white truncate">
                                {token.tokenNamePt || token.tokenName}
                              </span>
                              <Badge variant="outline" className="rounded-none border-amber-500/50 text-amber-300 text-[10px] font-mono px-1.5 py-0">
                                {token.tokenCode}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
                              <span>AP: <strong className="text-white">{token.ap ?? "—"}</strong></span>
                              <span>HP: <strong className="text-white">{token.hp ?? "—"}</strong></span>
                            </div>

                            <p className="text-[10px] font-mono text-slate-400 pt-0.5 truncate">
                              Gerado por:{" "}
                              <span className="text-sky-300">
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

            {/* BLOCO 5: CLASSIFICAÇÃO TÁTICA DE METAGAME (TOTAIS & PORCENTAGENS) */}
            <Card className="panel-cut rounded-none surface-panel border-white/10">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <Shield className="size-4 text-emerald-400" />
                  <h3 className="font-heading text-base uppercase tracking-wider text-white">
                    Base de Metagame do Arsenal
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* Staples */}
                  <div className="p-3 bg-slate-950/80 border border-white/10">
                    <span className="text-[10px] font-mono uppercase text-sky-400 font-bold block">
                      Staples
                    </span>
                    <p className="font-heading text-xl text-white mt-1">
                      {stats.metagame.staplesCount} cartas{" "}
                      <span className="text-xs text-slate-400 font-mono">
                        ({Math.round((stats.metagame.staplesCount / stats.mainCount) * 100)}%)
                      </span>
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Presença ≥ 55% no meta</p>
                  </div>

                  {/* Engine */}
                  <div className="p-3 bg-slate-950/80 border border-white/10">
                    <span className="text-[10px] font-mono uppercase text-amber-400 font-bold block">
                      Engine / Núcleo
                    </span>
                    <p className="font-heading text-xl text-white mt-1">
                      {stats.metagame.engineCount} cartas{" "}
                      <span className="text-xs text-slate-400 font-mono">
                        ({Math.round((stats.metagame.engineCount / stats.mainCount) * 100)}%)
                      </span>
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Pilares do arquétipo</p>
                  </div>

                  {/* Techs */}
                  <div className="p-3 bg-slate-950/80 border border-white/10">
                    <span className="text-[10px] font-mono uppercase text-purple-400 font-bold block">
                      Techs / Flex
                    </span>
                    <p className="font-heading text-xl text-white mt-1">
                      {stats.metagame.techsCount} cartas{" "}
                      <span className="text-xs text-slate-400 font-mono">
                        ({Math.round((stats.metagame.techsCount / stats.mainCount) * 100)}%)
                      </span>
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Respostas e counters</p>
                  </div>

                  {/* Comum */}
                  <div className="p-3 bg-slate-950/80 border border-white/10">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                      Base Comum
                    </span>
                    <p className="font-heading text-xl text-white mt-1">
                      {stats.metagame.commonCount} cartas{" "}
                      <span className="text-xs text-slate-400 font-mono">
                        ({Math.round((stats.metagame.commonCount / stats.mainCount) * 100)}%)
                      </span>
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Cartas de utilidade</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* MODAL CARROSSEL DE CARTAS AMPLIADAS */}
      <CardPreviewModal
        rows={visibleRows}
        index={previewIndex}
        onNavigate={setPreviewIndex}
        onClose={() => setPreviewIndex(null)}
      />

      {/* SIMULADOR DE MÃO INICIAL (DRAW) */}
      <OpeningHandModal
        open={openingHandOpen}
        onClose={() => setOpeningHandOpen(false)}
        cards={mainRows}
      />

      {/* MODAL DE EXPORTAÇÃO DE IMAGEM COM SELO OZ E 2ª IMAGEM DE ESTATÍSTICAS */}
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
          colors={stats.colors}
          statsSummary={{
            avgCost: stats.avgCost,
            synergyScore: stats.synergyScore,
            turn1Odds: stats.turn1.mulligan,
            turn2Odds: stats.turn2.mulligan,
            units: stats.typeCounts.UNIT,
            pilots: stats.typeCounts.PILOT,
            commands: stats.typeCounts.COMMAND,
            bases: stats.typeCounts.BASE,
            costCurve: stats.costCurve,
            levelCurve: stats.levelCurve,
            colorCounts: stats.colorCounts,
            staplesCount: stats.metagame.staplesCount,
            engineCount: stats.metagame.engineCount,
            techsCount: stats.metagame.techsCount,
            commonCount: stats.metagame.commonCount,
          }}
        />
      )}
    </PublicShell>
  );
}
