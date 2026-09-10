/* Deck compartilhado v11.0 — visualização imersiva do Arsenal da OZ com telemetria VEDA estilo Exburst,
 * layout balanceado (~62% cartas / ~38% estatísticas), 6 histogramas numéricos, probabilidade de Turno 1,
 * tokens gerados oficiais (T-001 a T-020), classificação de metagame e modal de exportação de imagem. */
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

import { api, mapApiCard, type ApiDeck } from "@/lib/api";
import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FeaturedCoverImage } from "@/components/deck/FeaturedCoverImage";
import { DECK_MAIN_SIZE, DECK_RESOURCE_SIZE, NON_COUNTED_SECTIONS } from "@/lib/deck-legality";
import { calculateDeckCostLevelCurve, buildLevelCurve } from "@/lib/deck-level-stats";
import { lowCostStats } from "@/lib/deck-cost-stats";
import { computeDeckPilotCoverage } from "@/lib/deck-pilot-coverage";
import { type ExportCardEntry } from "@/utils/deckImageExport";
import { ExportDeckImageModal } from "@/components/deck/ExportDeckImageModal";
import { TelemetryHistogram } from "@/components/deck/TelemetryHistogram";
import { computeAdvancedDeckStats } from "@/lib/deck-advanced-stats";
import { detectDeckTokens, type DetectedToken } from "@/lib/deck-tokens";
import { GAME_COLOR_HEX } from "@/lib/gundam-catalog";

type DeckRow = ReturnType<typeof mapApiCard> & { quantity: number; section: string };

function ReadOnlyCardTile({ row, onPreview }: { row: DeckRow; onPreview: () => void }) {
  const image = row.imageMediumUrl || row.imageUrl;
  return (
    <button
      type="button"
      onClick={onPreview}
      title={`Ver ${row.namePt || row.name} em tamanho grande`}
      className="group relative block aspect-[63/88] w-full overflow-hidden border border-white/15 bg-slate-900/60 transition hover:border-sky-400 hover:shadow-lg hover:shadow-sky-500/20"
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

      {/* Badge de quantidade no canto superior direito */}
      <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-none bg-sky-500 font-mono text-xs font-black text-slate-950 shadow-md">
        {row.quantity}x
      </span>

      {/* Custo no canto superior esquerdo */}
      {typeof row.cost === "number" && (
        <span className="absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded-none bg-slate-950/80 border border-white/20 font-mono text-[10px] font-bold text-amber-300">
          {row.cost}
        </span>
      )}

      {/* Legenda expansiva no hover */}
      <div className="absolute inset-x-0 bottom-0 translate-y-full bg-slate-950/95 p-2 text-left backdrop-blur-sm transition-all duration-200 group-hover:translate-y-0">
        <p className="truncate text-xs font-semibold text-white">{row.namePt || row.name}</p>
        <p className="truncate text-[10px] font-mono text-slate-400">
          {row.code} · {row.type}
        </p>
      </div>
    </button>
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

  // Curtidas
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // Tokens Oficiais carregados da API
  const [officialTokens, setOfficialTokens] = useState<any[]>([]);

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
    const typeCounts: Record<string, number> = {};
    mainRows.forEach((r) => {
      const t = r.type || "UNIT";
      typeCounts[t] = (typeCounts[t] || 0) + r.quantity;
    });

    // Curva de custo
    const costMap = new Map<number, number>();
    mainRows.forEach((r) => costMap.set(r.cost, (costMap.get(r.cost) || 0) + r.quantity));
    const costCurve = Array.from(costMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([cost, count]) => ({ cost, count }));

    // Curva de nível
    const levelCurve = buildLevelCurve(mainRows);

    // AP / HP das Unidades
    const units = mainRows.filter((r) => r.type === "UNIT");
    const apMap = new Map<number, number>();
    const hpMap = new Map<number, number>();
    units.forEach((u) => {
      if (typeof u.ap === "number") apMap.set(u.ap, (apMap.get(u.ap) || 0) + u.quantity);
      if (typeof u.hp === "number") hpMap.set(u.hp, (hpMap.get(u.hp) || 0) + u.quantity);
    });

    // Sinergia estimada (0 - 100)
    const dominantColorCount = Math.max(...Object.values(colorCounts), 0);
    const colorCohesion = mainCount > 0 ? (dominantColorCount / mainCount) * 50 : 0;
    const unitCount = typeCounts["UNIT"] || 0;
    const pilotCount = typeCounts["PILOT"] || 0;
    const dockingRatio = unitCount > 0 ? Math.min(pilotCount / (unitCount * 0.4), 1) * 30 : 0;
    const fourCopiesCount = mainRows.filter((r) => r.quantity === 4).length;
    const consistencyScore = Math.min((fourCopiesCount / 8) * 20, 20);
    const synergyScore = Math.round(colorCohesion + dockingRatio + consistencyScore);

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
      unitsCount: units.length,
      synergyScore,
      handOdds: lowCostStats(mainRows, mainCount),
    };
  }, [mainRows, resourceRows]);

  // Tokens detectados nas cartas do deck
  const detectedTokens = useMemo(() => {
    return detectDeckTokens(mainRows, officialTokens);
  }, [mainRows, officialTokens]);

  // Telemetria Aprofundada (Exburst style: 6 Histogramas, Probabilidade T1, Metagame)
  const advancedStats = useMemo(() => {
    return computeAdvancedDeckStats(
      mainRows.map((r) => ({
        code: r.code,
        name: r.name,
        namePt: r.namePt,
        type: r.type,
        cost: r.cost,
        level: r.level,
        ap: r.ap,
        hp: r.hp,
        color: r.color,
        effect: r.effect,
        quantity: r.quantity,
        trait: r.trait,
        triggerKeywords: r.triggerKeywords,
      })),
      stats.mainCount
    );
  }, [mainRows, stats.mainCount]);

  // Agrupamento de Traits e Links para pílulas interativas (Image 3)
  const { traitList, linkList, quickCountersCount } = useMemo(() => {
    const traits = new Map<string, number>();
    const links = new Map<string, number>();
    let quick = 0;

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
      }
    });

    return {
      traitList: Array.from(traits.entries()).sort((a, b) => b[1] - a[1]),
      linkList: Array.from(links.entries()).sort((a, b) => b[1] - a[1]),
      quickCountersCount: quick,
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
        <div className="py-20 text-center">
          <div className="mx-auto size-12 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-400 font-mono">
            Acessando especificações do Mobile Suit na rede OZ...
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
      description={`Projeto tático compartilhado por ${deck.user?.displayName || "Piloto da OZ"}.`}
    >
      <div className="space-y-6">
        {/* HERO CARD COM CAPA E INFORMAÇÕES DE COMANDO */}
        <Card className="panel-cut rounded-none border-sky-500/30 hero-surface overflow-hidden">
          <div className="relative h-48 sm:h-56 w-full overflow-hidden border-b border-white/10 bg-slate-950">
            {deck.coverImage ? (
              <img src={deck.coverImage} alt={deck.name} className="h-full w-full object-cover object-center" />
            ) : (
              <FeaturedCoverImage cards={deck.featuredCards} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

            <div className="absolute left-6 bottom-4 right-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="rounded-none border-emerald-500/50 bg-emerald-950/60 text-emerald-300 text-[10px] uppercase font-mono">
                    {deck.format || "Standard"}
                  </Badge>
                  <span className="text-[10px] font-mono text-slate-400">#{deck.shareId}</span>
                </div>
                <h1 className="font-heading text-2xl sm:text-4xl uppercase text-white tracking-wide drop-shadow-md">
                  {deck.name}
                </h1>
                <p className="mt-1 text-xs text-slate-300 flex items-center gap-2">
                  <span>Piloto / Autor:</span>
                  <strong className="text-white font-medium">
                    {deck.user?.displayName || deck.user?.username || "Piloto Anônimo"}
                  </strong>
                </p>
              </div>

              {/* Botões de Like e Métricas */}
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

          {/* BARRA DE CONTROLE E AÇÕES TÁTICAS */}
          <CardContent className="p-4 sm:p-6 bg-slate-950/80">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Badges de calibração */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-none border-sky-400/40 bg-sky-950/30 text-sky-300 text-xs">
                  {stats.mainCount}/{DECK_MAIN_SIZE} Deck Principal
                </Badge>
                <Badge className="rounded-none border-white/20 bg-white/5 text-slate-300 text-xs">
                  {stats.resourceCount}/{DECK_RESOURCE_SIZE} Recursos
                </Badge>
                <Badge className="rounded-none border-accent/40 bg-accent/10 text-accent text-xs">
                  Curva Média: {stats.avgCost}
                </Badge>
                <Badge className="rounded-none border-emerald-500/40 bg-emerald-950/30 text-emerald-400 text-xs">
                  Sinergia: {stats.synergyScore}%
                </Badge>
              </div>

              {/* Ações de Exportação e Clonagem */}
              <div className="flex flex-wrap items-center gap-2">
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
                  onClick={exportWingTable}
                  className="rounded-none border-white/20 bg-white/5 text-xs text-white hover:bg-white/10"
                >
                  <Copy className="mr-1.5 size-3.5" /> Copiar Wing Table
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImageModalOpen(true)}
                  className="rounded-none border-sky-400/50 bg-sky-950/30 text-xs text-sky-300 hover:bg-sky-900/40 transition-all"
                  title="Exportar imagem do deck com pré-visualização e opções estilo Exburst"
                >
                  <Download className="mr-1.5 size-3.5 text-sky-400" />
                  Exportar Imagem
                </Button>
                <Button
                  size="sm"
                  onClick={cloneToDeckbuilder}
                  className="rounded-none bg-sky-600 hover:bg-sky-500 text-white font-heading uppercase text-xs tracking-wider shadow-lg shadow-sky-600/20"
                >
                  <Wrench className="mr-1.5 size-3.5" /> Clonar no Deckbuilder
                </Button>
              </div>
            </div>

            {deck.notes && (
              <div className="mt-4 pt-4 border-t border-white/10 text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold text-slate-400 uppercase tracking-wider font-mono mr-2">
                  Diretrizes do Piloto:
                </span>
                {deck.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* LAYOUT BALANCEADO EM 2 COLUNAS (IMAGEM 3 - EXBURST STYLE: ~62% CARTAS / ~38% TELEMETRIA) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUNA ESQUERDA: CARTAS DO DECK (~62% / col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            {/* DECK PRINCIPAL */}
            <Card className="panel-cut rounded-none surface-panel border-white/10">
              <CardContent className="p-5 space-y-6">
                {/* Header do Deck Principal */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-sky-400 inline-block" />
                    <h3 className="font-heading text-lg uppercase tracking-wider text-white">
                      Main Deck ({stats.mainCount} / {DECK_MAIN_SIZE})
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

                {/* Seção 1: UNIT */}
                {filteredUnitRows.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <span className="font-bold text-sky-400 uppercase tracking-wider">
                        UNIT ({filteredUnitRows.reduce((acc, r) => acc + r.quantity, 0)})
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2.5">
                      {filteredUnitRows.map((row) => (
                        <ReadOnlyCardTile
                          key={`${row.id}-main-unit`}
                          row={row}
                          onPreview={() => setPreviewIndex(visibleRows.findIndex((r) => r === row))}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Seção 2: PILOT, COMMAND, BASE */}
                {filteredSupportRows.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <span className="font-bold text-amber-400 uppercase tracking-wider">
                        PILOT, COMMAND, BASE ({filteredSupportRows.reduce((acc, r) => acc + r.quantity, 0)})
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2.5">
                      {filteredSupportRows.map((row) => (
                        <ReadOnlyCardTile
                          key={`${row.id}-main-support`}
                          row={row}
                          onPreview={() => setPreviewIndex(visibleRows.findIndex((r) => r === row))}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* PÍLULAS INTERATIVAS DE TIPOS, TRAITS, LINKS E CONTADORES (Image 3) */}
                <div className="pt-4 border-t border-white/10 space-y-3 select-none">
                  {/* Card Types */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Card Types ({Object.keys(stats.typeCounts).length} types) ·{" "}
                      <span className="text-slate-500 italic">Clique para filtrar</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(stats.typeCounts).map(([t, count]) => {
                        const active = activeFilterPill?.key === "type" && activeFilterPill.value === t;
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
                            <span>{t}:</span>
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

                  {/* Traits */}
                  {traitList.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        Traits ({traitList.length} traits)
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

                  {/* Links, Counters e Burst */}
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
                              [{link}] {count}
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
                        Quick Counters ({quickCountersCount})
                      </button>
                    )}

                    {advancedStats.burstCount > 0 && (
                      <button
                        type="button"
                        onClick={() => togglePill("burst", "burst")}
                        className={`px-2 py-0.5 rounded border ${
                          activeFilterPill?.key === "burst"
                            ? "bg-amber-500 text-slate-950 font-bold border-amber-400"
                            : "bg-slate-900/60 border-amber-500/30 text-amber-300 hover:text-white"
                        }`}
                      >
                        Burst ({advancedStats.burstCount})
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

          {/* COLUNA DIREITA: TELEMETRIA & ESTATÍSTICAS (~38% / col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            {/* CARD 1: DECK STATISTICS (6 HISTOGRAMAS NO ESTILO EXBURST - IMAGEM 3) */}
            <Card className="panel-cut rounded-none surface-panel border-white/10">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <BarChart3 className="size-4 text-sky-400" />
                  <h3 className="font-heading text-base uppercase tracking-wider text-white">
                    Deck Statistics
                  </h3>
                </div>

                {/* Grid 2x3 de Histogramas com eixos numéricos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TelemetryHistogram title="Level Range" bins={advancedStats.levelRange} />
                  <TelemetryHistogram title="Cost Range" bins={advancedStats.costRange} />
                  <TelemetryHistogram title="Unit Level Range" bins={advancedStats.unitLevelRange} />
                  <TelemetryHistogram title="Unit Cost Range" bins={advancedStats.unitCostRange} />
                  <TelemetryHistogram title="AP Range" bins={advancedStats.apRange} />
                  <TelemetryHistogram title="HP Range" bins={advancedStats.hpRange} />
                </div>
              </CardContent>
            </Card>

            {/* CARD 2: GAME STATISTICS (PROBABILIDADES, TURNO 1, BURST - IMAGEM 3) */}
            <Card className="panel-cut rounded-none surface-panel border-white/10">
              <CardContent className="p-5 space-y-5">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <Activity className="size-4 text-sky-400" />
                  <h3 className="font-heading text-base uppercase tracking-wider text-white">
                    Game Statistics
                  </h3>
                </div>

                {/* Seção Burst */}
                <div className="space-y-1">
                  <p className="text-xs font-bold font-mono uppercase text-white">Burst</p>
                  <p className="text-[11px] text-slate-400">Cartas que possuem ativação de Burst.</p>
                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="font-heading text-2xl text-amber-400">
                      {advancedStats.burstCount}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">cartas no deck principal</span>
                  </div>
                </div>

                {/* Seção Turn 1 Playable Card */}
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <p className="text-xs font-bold font-mono uppercase text-white">Turn 1 Playable Card</p>
                  <p className="text-[11px] text-slate-400">
                    Probabilidade de ter ao menos 1 unidade ou base de custo 1 no Turno 1.
                  </p>

                  <div className="bg-slate-950/80 p-4 border border-white/10 text-center space-y-2">
                    <p className="font-heading text-4xl text-sky-400">
                      {Math.round(advancedStats.turn1Playable.probabilityTurn1WithMulligan * 100)}%
                    </p>
                    <p className="text-xs font-semibold text-slate-200">
                      Chance de jogada garantida no Turno 1
                    </p>
                    <div className="text-[10px] font-mono text-slate-400 space-y-1 pt-1 border-t border-white/10">
                      <p>
                        {advancedStats.turn1Playable.eligibleCardsCount} cartas de custo 1 e nível ≤ 1 (UNIT / BASE)
                      </p>
                      <p>Turno 1 (6 cartas no total: 5 iniciais + 1 comprada)</p>
                      <p>Nível 1 de jogador, 1 RECURSO disponível</p>
                      <p className="text-sky-300 font-bold">
                        ({Math.round(advancedStats.turn1Playable.probabilityWithMulligan * 100)}% na mão de abertura com mulligan)
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CARD 3: TOKENS GERADOS EM BATALHA (MOSTRADO SOMENTE SE HOUVER CARTAS QUE GEREM TOKENS) */}
            {detectedTokens.length > 0 && (
              <Card className="panel-cut rounded-none surface-panel border-amber-500/30">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <Zap className="size-4 text-amber-400" />
                    <h3 className="font-heading text-base uppercase tracking-wider text-amber-400">
                      Tokens Gerados em Batalha ({detectedTokens.length})
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {detectedTokens.map((token) => {
                      const tokenImg = token.imageMediumUrl || token.imageUrl;
                      return (
                        <div
                          key={token.tokenCode}
                          className="flex gap-3.5 p-3 border border-white/10 bg-slate-950/80 items-start"
                        >
                          {/* Imagem Real do Token */}
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

                          {/* Atributos do Token */}
                          <div className="flex-1 min-w-0 space-y-1.5">
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
                              {token.trait && (
                                <span className="text-slate-400 truncate">[{token.trait}]</span>
                              )}
                            </div>

                            {/* Cartas Geradoras */}
                            <p className="text-[10px] font-mono text-slate-400 pt-0.5">
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

            {/* CARD 4: CLASSIFICAÇÃO TÁTICA DE METAGAME (STAPLES, ENGINE, TECHS E CUSTO MÉDIO) */}
            <Card className="panel-cut rounded-none surface-panel border-white/10">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <Shield className="size-4 text-emerald-400" />
                  <h3 className="font-heading text-base uppercase tracking-wider text-white">
                    Classificação Tática de Metagame
                  </h3>
                </div>

                {/* Comparativo de Custo Médio vs. Metagame */}
                <div className="p-3 bg-slate-950/80 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Custo Médio do Deck:</span>
                    <strong className="text-sky-400 font-heading text-base">{stats.avgCost}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Média do Metagame ({stats.colors.join("/")}):</span>
                    <span className="text-slate-300">{advancedStats.metaComparison.metaAvgCost}</span>
                  </div>
                  <div className="pt-1 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono text-slate-400">Perfil de Velocidade:</span>
                    <Badge className="rounded-none bg-emerald-950/60 border-emerald-500/50 text-emerald-300 text-[10px] font-mono">
                      {advancedStats.metaComparison.speedVerdict}
                    </Badge>
                  </div>
                </div>

                {/* Staples do Deck */}
                {advancedStats.staples.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-mono font-bold uppercase text-sky-400">
                      Staples ({advancedStats.staples.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {advancedStats.staples.map((card) => (
                        <span
                          key={card.code}
                          className="px-2 py-0.5 bg-sky-950/40 border border-sky-500/30 text-sky-300 text-[10px] font-mono rounded"
                          title={card.reason}
                        >
                          {card.quantity}x {card.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Engine do Arquétipo */}
                {advancedStats.engine.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-mono font-bold uppercase text-amber-400">
                      Engine ({advancedStats.engine.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {advancedStats.engine.map((card) => (
                        <span
                          key={card.code}
                          className="px-2 py-0.5 bg-amber-950/40 border border-amber-500/30 text-amber-300 text-[10px] font-mono rounded"
                          title={card.reason}
                        >
                          {card.quantity}x {card.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tech Cards */}
                {advancedStats.techs.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-mono font-bold uppercase text-purple-400">
                      Techs / Flex ({advancedStats.techs.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {advancedStats.techs.map((card) => (
                        <span
                          key={card.code}
                          className="px-2 py-0.5 bg-purple-950/40 border border-purple-500/30 text-purple-300 text-[10px] font-mono rounded"
                          title={card.reason}
                        >
                          {card.quantity}x {card.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* MODAL DE CARROSSEL DE CARTAS AMPLIADAS */}
      <CardPreviewModal
        rows={visibleRows}
        index={previewIndex}
        onNavigate={setPreviewIndex}
        onClose={() => setPreviewIndex(null)}
      />

      {/* MODAL DE PRÉVIA E DOWNLOAD DE IMAGEM (EXBURST STYLE) */}
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
        />
      )}
    </PublicShell>
  );
}
