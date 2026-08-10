/* Deckbuilder tático — filtros reais da pool, persistência por usuário, diagnóstico operacional e navegação contextual. */
import { useEffect, useMemo, useState } from "react";
import { Copy, Eye, ExternalLink, ImagesIcon, Minus, Plus, Save, Share2, Trash2, Upload } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { api, mapApiCard, API_BASE_URL, type ApiDeck, type CardFilters } from "@/lib/api";
import { DECK_MAIN_SIZE, DECK_RESOURCE_SIZE, NON_COUNTED_SECTIONS, computeDeckLegality, type DeckLegalityData } from "@/lib/deck-legality";
import { CARD_TYPE_OPTIONS, groupCardsByType } from "@/lib/gundam-catalog";
import { PortalShell } from "@/components/layout/PortalShell";
import { FeaturedCoverImage } from "@/components/deck/FeaturedCoverImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { CardRecord, DeckEntry } from "@/modules/core/types";

type DeckVisibility = "PRIVATE" | "UNLISTED" | "PUBLIC";
type PoolFilters = Pick<CardFilters, "q" | "color" | "cardType" | "series" | "trait">;
type PoolMeta = {
  colors: string[];
  cardTypes: string[];
  series: string[];
  traits: string[];
  keywords: string[];
  sets: Array<{ code: string; namePt?: string | null; nameEn: string }>;
};

const defaultPoolFilters: PoolFilters = { q: "", color: "", cardType: "", series: "", trait: "" };

function calculateStats(cardCache: Record<string, CardRecord>, entries: DeckEntry[]) {
  const expandedAll = entries
    .map((entry) => {
      const card = cardCache[entry.cardId];
      return card ? { ...card, quantity: entry.quantity, section: entry.section || "main" } : null;
    })
    .filter(Boolean) as (CardRecord & { quantity: number; section: string })[];

  // Estatísticas de curva/cor/tipo fazem sentido só pro deck principal — o deck de
  // recursos não tem custo nem essas dimensões de análise (ver docs/14-motor-regras-deck.md).
  const expanded = expandedAll.filter((item) => item.section !== "resource" && !NON_COUNTED_SECTIONS.has(item.section));
  const resourceDeckCount = expandedAll.filter((item) => item.section === "resource").reduce((sum, item) => sum + item.quantity, 0);

  const mainDeckCount = expanded.reduce((sum, item) => sum + item.quantity, 0);
  const lowCostCount = expanded.filter((item) => item.cost <= 2).reduce((sum, item) => sum + item.quantity, 0);
  const avgCost = mainDeckCount ? expanded.reduce((sum, item) => sum + item.cost * item.quantity, 0) / mainDeckCount : 0;
  const cardsWithKeywords = expanded.filter((item) => item.keywords.length > 0).reduce((sum, item) => sum + item.quantity, 0);
  const cardsAtLimit = expanded.filter((item) => item.quantity >= 4).length;

  const colorMap = expanded.reduce<Record<string, number>>((acc, item) => {
    acc[item.color] = (acc[item.color] ?? 0) + item.quantity;
    return acc;
  }, {});

  const typeMap = expanded.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + item.quantity;
    return acc;
  }, {});

  const traitMap = expanded.reduce<Record<string, number>>((acc, item) => {
    const key = item.trait || "Sem trait";
    acc[key] = (acc[key] ?? 0) + item.quantity;
    return acc;
  }, {});

  return {
    mainDeckCount,
    resourceDeckCount,
    lowCostRate: mainDeckCount ? Math.round((lowCostCount / mainDeckCount) * 100) : 0,
    avgCost: avgCost.toFixed(2),
    cardsWithKeywords,
    cardsAtLimit,
    colorMap,
    typeMap,
    traitMap,
  };
}

const chartConfig = {
  quantity: { label: "Quantidade", color: "#47a0ff" },
  value: { label: "Quantidade", color: "#47a0ff" },
} satisfies ChartConfig;

const pieColors = ["#47a0ff", "#4fd1c5", "#f59e0b", "#ef4444", "#a78bfa", "#94a3b8"];

type DeckRow = CardRecord & { quantity: number; section: string };

/** Tile de carta na pool — imagem em destaque (não texto), clique pra adicionar direto,
 *  igual ao padrão de deckbuilder de jogo real (Master Duel, MTG Arena, YGO Omega) em vez
 *  da linha de texto que existia antes. Badge de quantidade no canto quando já está no
 *  deck; nome/custo só aparecem no hover, pra não poluir a grade. */
function PoolCardTile({ card, qtyInDeck, limit, section, onAdd, onDecrement, onOpenGallery, onSwapExComponent, onPreview }: { card: CardRecord; qtyInDeck: number; limit: number; section: "main" | "resource"; onAdd: (card: CardRecord) => void; onDecrement: (printId: string) => void; onOpenGallery: (modelId: string) => void; onSwapExComponent: (section: "ex_base" | "ex_resource", printId: string) => void; onPreview: (card: CardRecord) => void }) {
  const exSection = card.type === "EX_BASE" ? "ex_base" : card.type === "EX_RESOURCE" ? "ex_resource" : null;
  const banned = limit === 0;
  const atLimit = qtyInDeck >= limit;
  const image = card.imageMediumUrl || card.imageUrl;
  const printId = card.printId || card.id;
  const modelId = card.cardModelId || card.id;
  const handleClick = () => (exSection ? onSwapExComponent(exSection, printId) : onAdd(card));
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={!exSection && atLimit}
        title={exSection ? `Usar essa arte pro ${exSection === "ex_base" ? "EX Base" : "EX Resource"} do deck` : banned ? `${card.namePt || card.name} — banida` : atLimit ? `${card.namePt || card.name} — limite atingido` : `Adicionar ${card.namePt || card.name}`}
        className={`relative block aspect-[63/88] w-full overflow-hidden border transition ${banned ? "border-red-400/50" : "border-white/15 group-hover:border-primary/60"} ${!exSection && atLimit ? "opacity-45" : ""}`}
      >
        {image ? (
          <img src={image} alt={card.namePt || card.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.05]" />
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-950/80 p-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">{card.namePt || card.name}</div>
        )}

        {!exSection && qtyInDeck > 0 ? <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{qtyInDeck}</span> : null}
        {banned ? <span className="absolute inset-x-0 top-0 bg-red-500/90 py-0.5 text-center text-[9px] uppercase tracking-[0.16em] text-white">banida</span> : null}
        {exSection ? <span className="absolute inset-x-0 top-0 bg-slate-700/90 py-0.5 text-center text-[9px] uppercase tracking-[0.16em] text-white">carta única</span> : null}
        {!banned && !exSection && section === "resource" ? <span className="absolute inset-x-0 top-0 bg-accent/90 py-0.5 text-center text-[9px] uppercase tracking-[0.16em] text-slate-950">recurso</span> : null}

        <div className="absolute inset-x-0 bottom-0 bg-slate-950/90 p-1.5 text-left">
          <p className="truncate text-[11px] font-medium text-white">{card.namePt || card.name}</p>
        </div>
      </button>

      {!exSection ? (
        <button type="button" onClick={() => onOpenGallery(modelId)} title="Ver todas as artes desta carta" className="absolute left-1 top-1 flex size-6 items-center justify-center rounded-full bg-slate-950/80 text-white opacity-100 transition hover:bg-primary hover:text-primary-foreground lg:opacity-0 lg:group-hover:opacity-100">
          <ImagesIcon className="size-3.5" />
        </button>
      ) : null}

      {!exSection ? (
        <div className="absolute inset-x-1 bottom-1 flex items-center justify-between opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
          <button type="button" onClick={() => onDecrement(printId)} disabled={qtyInDeck <= 0} title={`Remover 1 cópia`} className="flex size-6 items-center justify-center rounded-full bg-slate-950/85 text-white transition hover:bg-red-500 disabled:pointer-events-none disabled:opacity-30">
            <Minus className="size-3.5" />
          </button>
          <button type="button" onClick={() => onPreview(card)} title="Ver imagem grande" className="flex size-6 items-center justify-center rounded-full bg-slate-950/85 text-white transition hover:bg-white/20">
            <Eye className="size-3.5" />
          </button>
          <button type="button" onClick={() => onAdd(card)} disabled={atLimit} title="Adicionar 1 cópia" className="flex size-6 items-center justify-center rounded-full bg-slate-950/85 text-white transition hover:bg-primary hover:text-primary-foreground disabled:pointer-events-none disabled:opacity-30">
            <Plus className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Tile compacto da decklist — mesma grade visual da pool, mas clicar remove uma
 *  cópia (simétrico: pool adiciona, decklist remove). Botão "+" só aparece no
 *  hover, pra não competir com o clique principal. */
function DeckGridTile({ row, onIncrement, onDecrement, onOpenGallery, onPreview }: { row: DeckRow; onIncrement: (card: CardRecord) => void; onDecrement: (printId: string) => void; onOpenGallery: (modelId: string) => void; onPreview: (card: CardRecord) => void }) {
  const image = row.imageMediumUrl || row.imageUrl;
  const printId = row.printId || row.id;
  const modelId = row.cardModelId || row.id;
  return (
    <div className="group relative">
      <div className="relative block aspect-[63/88] w-full overflow-hidden border border-white/15 transition group-hover:border-primary/50">
        {image ? <img src={image} alt={row.namePt || row.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-slate-950/80 p-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">{row.namePt || row.name}</div>}
        <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{row.quantity}</span>
        <div className="absolute inset-x-0 bottom-6 bg-slate-950/90 p-1.5 text-left">
          <p className="truncate text-[11px] font-medium text-white">{row.namePt || row.name}</p>
        </div>
      </div>
      <button type="button" onClick={() => onOpenGallery(modelId)} title="Ver todas as artes desta carta" className="absolute left-1 top-1 flex size-6 items-center justify-center rounded-full bg-slate-950/80 text-white opacity-100 transition hover:bg-primary hover:text-primary-foreground lg:opacity-0 lg:group-hover:opacity-100">
        <ImagesIcon className="size-3.5" />
      </button>
      <div className="absolute inset-x-1 bottom-1 flex items-center justify-between opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
        <button type="button" onClick={() => onDecrement(printId)} title={`Remover 1 cópia de ${row.namePt || row.name}`} className="flex size-6 items-center justify-center rounded-full bg-slate-950/85 text-white transition hover:bg-red-500">
          <Minus className="size-3.5" />
        </button>
        <button type="button" onClick={() => onPreview(row)} title="Ver imagem grande" className="flex size-6 items-center justify-center rounded-full bg-slate-950/85 text-white transition hover:bg-white/20">
          <Eye className="size-3.5" />
        </button>
        <button type="button" onClick={() => onIncrement(row)} title={`Adicionar mais uma cópia de ${row.namePt || row.name}`} className="flex size-6 items-center justify-center rounded-full bg-slate-950/85 text-white transition hover:bg-primary hover:text-primary-foreground">
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/** EX Base / EX Resource — mesmo visual da decklist, mas sem número (é sempre 1,
 *  mostrar "1" seria ruído) e com um botão de reset no lugar de +/-, já que a
 *  troca de arte acontece clicando na carta na pool (ver PoolCardTile), não aqui. */
function ExComponentTile({ label, row, onReset }: { label: string; row: DeckRow | undefined; onReset: () => void }) {
  const image = row?.imageMediumUrl || row?.imageUrl;
  return (
    <div className="group relative">
      <div className="relative block aspect-[63/88] w-full overflow-hidden border border-white/15">
        {image ? <img src={image} alt={row?.namePt || label} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-slate-950/80 p-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</div>}
        <span className="absolute inset-x-0 top-0 bg-slate-700/90 py-0.5 text-center text-[9px] uppercase tracking-[0.16em] text-white">{label}</span>
        <div className="absolute inset-x-0 bottom-0 bg-slate-950/90 p-1.5 text-left">
          <p className="truncate text-[10px] font-medium text-white">{row?.namePt || row?.name || "Carregando…"}</p>
        </div>
      </div>
      <button type="button" onClick={onReset} title={`Voltar ${label} pra arte padrão`} className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-slate-950/80 text-[13px] text-white opacity-100 transition hover:bg-primary hover:text-primary-foreground lg:opacity-0 lg:group-hover:opacity-100">↺</button>
    </div>
  );
}

/** Modal de galeria de arte — abre a partir do botão no canto superior esquerdo de
 *  qualquer tile (pool ou decklist). Busca as impressões da carta sob demanda (só
 *  quando abre) e cada impressão tem seus próprios +/-, respeitando o mesmo limite
 *  de cópia por code que a pool já usa (increment já soma entre impressões). */
function AltArtModal({
  modelId,
  onClose,
  entries,
  getCopyLimit,
  onIncrement,
  onDecrement,
}: {
  modelId: string | null;
  onClose: () => void;
  entries: DeckEntry[];
  getCopyLimit: (cardModelId: string, cardType?: string) => number;
  onIncrement: (card: CardRecord) => void;
  onDecrement: (printId: string) => void;
}) {
  const [prints, setPrints] = useState<CardRecord[] | null>(null);
  const [modelLabel, setModelLabel] = useState("");

  useEffect(() => {
    if (!modelId) { setPrints(null); return; }
    let active = true;
    setPrints(null);
    api.getCard(modelId).then((data) => {
      if (!active) return;
      setModelLabel(data.namePt || data.nameEn || "");
      const modelFields = { cardModelId: modelId, nameEn: data.nameEn, namePt: data.namePt, cardType: data.cardType, color: data.color, cost: data.cost, level: data.level, ap: data.ap, hp: data.hp, trait: data.trait, series: data.series, sourceTitle: data.sourceTitle, keywordTags: data.keywordTags, effectPt: data.effectPt, effectEn: data.effectEn };
      const mapped = (data.prints || []).map((print: any) => mapApiCard({ ...print, ...modelFields }));
      setPrints(mapped);
    }).catch(() => { if (active) setPrints([]); });
    return () => { active = false; };
  }, [modelId]);

  if (!modelId) return null;
  const limit = prints?.[0] ? getCopyLimit(modelId, prints[0].type) : 4;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl lg:max-w-4xl border-white/10 bg-slate-950 text-white">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Galeria de arte</p>
            <h3 className="font-heading text-2xl uppercase heading-portal">{modelLabel || "Carregando…"}</h3>
          </div>
        </div>
        {!prints ? (
          <p className="py-8 text-center text-sm text-muted-portal">Carregando impressões...</p>
        ) : prints.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-portal">Não achei impressões dessa carta.</p>
        ) : (
          <div className="grid max-h-[65vh] grid-cols-2 gap-4 overflow-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
            {prints.map((print) => {
              const printId = print.printId || print.id;
              const qty = entries.filter((entry) => entry.cardId === printId).reduce((sum, entry) => sum + entry.quantity, 0);
              const image = print.imageMediumUrl || print.imageUrl;
              return (
                <div key={printId} className="border border-white/10 bg-slate-900/60 p-2.5">
                  <div className="aspect-[63/88] overflow-hidden border border-white/10 bg-slate-950/70">
                    {image ? <img src={image} alt={print.namePt || print.name} className="h-full w-full object-cover" /> : null}
                  </div>
                  <p className="mt-2 truncate text-[11px] text-slate-400">{print.code}</p>
                  <div className="mt-2 flex items-center justify-center gap-2.5">
                    <button type="button" onClick={() => onDecrement(printId)} disabled={qty <= 0} className="flex size-8 shrink-0 items-center justify-center rounded-none border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"><Minus className="size-4" /></button>
                    <span className="w-6 shrink-0 text-center text-sm font-bold">{qty}</span>
                    <button type="button" onClick={() => onIncrement(print)} disabled={qty >= limit} className="flex size-8 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-30"><Plus className="size-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="border-t border-white/10 pt-3 text-xs text-slate-500">Limite de {limit === Infinity ? "cópia livre" : `${limit} cópia(s)`} somado entre todas as artes desta carta.</p>
      </DialogContent>
    </Dialog>
  );
}

/** Preview em alta resolução — só a imagem grande + link pra abrir o detalhe da carta
 *  numa aba nova (não navega pra fora do deckbuilder, senão perde o estado da sessão). */
function CardPreviewModal({ card, onClose }: { card: CardRecord | null; onClose: () => void }) {
  if (!card) return null;
  const image = card.imageLargeUrl || card.imageMediumUrl || card.imageUrl;
  const modelId = card.cardModelId || card.id;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-white/10 bg-slate-950 text-white">
        <div className="overflow-hidden border border-white/10 bg-slate-950/70">
          {image ? <img src={image} alt={card.namePt || card.name} className="w-full" /> : null}
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="min-w-0 truncate text-sm text-soft">{card.namePt || card.name} · {card.code}</p>
          <a href={`/#/cards/${modelId}`} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-none border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.16em] text-white nav-hover-soft hover:text-white">
            <ExternalLink className="size-3.5" />Abrir detalhe
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DeckbuilderPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute<{ id: string }>("/deckbuilder/:id");
  const deckId = params?.id && params.id !== "new" ? params.id : null;

  const [cards, setCards] = useState<CardRecord[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [activeTab, setActiveTab] = useState<"montar" | "estatisticas">("montar");
  const [groupMainByType, setGroupMainByType] = useState(false);
  const [altArtModelId, setAltArtModelId] = useState<string | null>(null);
  const [previewCard, setPreviewCard] = useState<CardRecord | null>(null);
  const [deckImagePreviewUrl, setDeckImagePreviewUrl] = useState<string | null>(null);
  const [deckImageBlob, setDeckImageBlob] = useState<Blob | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [deckName, setDeckName] = useState("Novo Deck");
  const [entries, setEntries] = useState<DeckEntry[]>([]);
  const [visibility, setVisibility] = useState<DeckVisibility>("PRIVATE");
  const [coverImage, setCoverImage] = useState("");
  const [featuredCardIds, setFeaturedCardIds] = useState<string[]>([]);
  // Detalhes (nome + imagem) das cartas de destaque escolhidas — independente da pool
  // principal, já que a busca de destaque agora é própria (pode achar qualquer carta do
  // catálogo, não só o que está na tela). Populado ao carregar um deck existente (via
  // deck.featuredCards, já resolvido pelo back-end) ou ao escolher pela busca dedicada.
  const [featuredCardDetails, setFeaturedCardDetails] = useState<Record<string, { id: string; name: string; imageUrl: string | null }>>({});
  const [featuredQuery, setFeaturedQuery] = useState("");
  const [featuredResults, setFeaturedResults] = useState<CardRecord[]>([]);
  const [featuredSearching, setFeaturedSearching] = useState(false);
  const [poolFilters, setPoolFilters] = useState<PoolFilters>(defaultPoolFilters);
  const [poolQueryDraft, setPoolQueryDraft] = useState("");
  const [poolMeta, setPoolMeta] = useState<PoolMeta>({ colors: [], cardTypes: [], series: [], traits: [], keywords: [], sets: [] });
  const [loadingPool, setLoadingPool] = useState(true);
  const [loadingDeck, setLoadingDeck] = useState(Boolean(deckId));
  const [poolPage, setPoolPage] = useState(1);
  const [poolPageSize] = useState(24);
  const [poolTotal, setPoolTotal] = useState(0);
  const [poolTotalPages, setPoolTotalPages] = useState(1);
  // Cache separado da pool paginada, indexado por printId — guarda TODA carta já vista
  // (seja pela pool ou por um deck carregado), pra decklist nunca "perder" uma carta só
  // porque o filtro ou a página da pool mudou depois de adicionada.
  const [cardCache, setCardCache] = useState<Record<string, CardRecord>>({});
  const [legalityData, setLegalityData] = useState<{ rules: { maxCopiesDefault: number }; banned: any[]; restricted: any[]; banGroups: any[] } | null>(null);

  const cacheCards = (records: CardRecord[]) => {
    setCardCache((current) => {
      const next = { ...current };
      for (const record of records) if (record.printId) next[record.printId] = record;
      return next;
    });
  };

  /** Deck de recursos: só cartas Resource entram nele, sem limite de cópia
   *  (regra oficial — "Resource deck: no restriction on same-card copies").
   *  Todo o resto vai pro deck principal. */
  const getSectionForCardType = (cardType: string): "main" | "resource" => (cardType === "RESOURCE" ? "resource" : "main");

  /** Máximo de cópias permitido pro modelo (code) — banida=0, restrita=limite
   *  customizado, senão o padrão oficial (4). Cartas Resource não têm limite
   *  de cópia (Infinity), mesmo que restritas por algum motivo. Soma TODAS as
   *  impressões desse modelo já no deck, já que o limite é por code, não por
   *  arte específica (ver docs/14-motor-regras-deck.md). */
  const getCopyLimit = (cardModelId: string, cardType?: string) => {
    if (!legalityData) return cardType === "RESOURCE" ? Infinity : 4;
    if (legalityData.banned.some((c) => c.id === cardModelId)) return 0;
    if (cardType === "RESOURCE") return Infinity;
    const restricted = legalityData.restricted.find((c) => c.id === cardModelId);
    if (restricted) return restricted.restrictedCopies ?? 2;
    return legalityData.rules.maxCopiesDefault;
  };

  const loadCards = async (filters: PoolFilters = poolFilters, page: number = poolPage) => {
    setLoadingPool(true);
    try {
      const result = await api.listCardsPage({ ...filters, sort: "code_asc" }, { page, pageSize: poolPageSize });
      const mapped = result.items.map(mapApiCard);
      setCards(mapped);
      cacheCards(mapped);
      setPoolTotal(result.total);
      setPoolTotalPages(result.totalPages);
    } finally {
      setLoadingPool(false);
    }
  };

  const loadPoolMeta = async () => {
    const result = await api.getCardFilters();
    setPoolMeta(result);
  };

  const loadLegality = async () => {
    try {
      const result = await api.getDeckLegalityData();
      setLegalityData(result);
    } catch {
      // Sem dado de legalidade, o deckbuilder cai pro limite padrão de 4 — não bloqueia o uso.
    }
  };

  const [exBaseOptions, setExBaseOptions] = useState<CardRecord[]>([]);
  const [defaultResourceOption, setDefaultResourceOption] = useState<CardRecord | null>(null);
  const [exResourceOptions, setExResourceOptions] = useState<CardRecord[]>([]);

  /** EX Base e EX Resource são componente fixo — carrega as artes disponíveis uma vez
   *  (são poucos codes, cabe tudo numa página só) pro seletor "trocar arte". */
  const loadExComponents = async () => {
    try {
      const [baseResult, resourceResult, defaultResourceResult] = await Promise.all([
        api.listCardsPage({ cardType: "EX_BASE" } as PoolFilters, { page: 1, pageSize: 100 }),
        api.listCardsPage({ cardType: "EX_RESOURCE" } as PoolFilters, { page: 1, pageSize: 100 }),
        api.listCardsPage({ cardType: "RESOURCE", sort: "code_asc" } as PoolFilters, { page: 1, pageSize: 1 }),
      ]);
      const baseCards = baseResult.items.map(mapApiCard);
      const resourceCards = resourceResult.items.map(mapApiCard);
      const defaultResourceCards = defaultResourceResult.items.map(mapApiCard);
      setExBaseOptions(baseCards);
      setExResourceOptions(resourceCards);
      setDefaultResourceOption(defaultResourceCards[0] || null);
      cacheCards([...baseCards, ...resourceCards, ...defaultResourceCards]);
    } catch {
      // Sem opções carregadas, os dois seletores ficam vazios — não impede o resto do deckbuilder.
    }
  };

  // Garante que todo deck tem exatamente 1 EX Base + 1 EX Resource assim que as opções
  // carregam (padrão: code EXB-001/EXR-001, a arte "básica" das imagens oficiais) — sem
  // isso o jogador teria que lembrar de configurar isso toda vez, e é componente fixo
  // do jogo, não uma escolha real de deckbuilding.
  useEffect(() => {
    if (loadingDeck || (!exBaseOptions.length && !exResourceOptions.length)) return;
    setEntries((current) => {
      let next = current;
      if (!next.some((item) => item.section === "ex_base") && exBaseOptions.length) {
        const defaultCard = exBaseOptions.find((c) => c.code === "EXB-001") || exBaseOptions[0];
        next = [...next, { cardId: defaultCard.printId || defaultCard.id, quantity: 1, section: "ex_base" }];
      }
      if (!next.some((item) => item.section === "ex_resource") && exResourceOptions.length) {
        const defaultCard = exResourceOptions.find((c) => c.code === "EXR-001") || exResourceOptions[0];
        next = [...next, { cardId: defaultCard.printId || defaultCard.id, quantity: 1, section: "ex_resource" }];
      }
      return next;
    });
  }, [exBaseOptions, exResourceOptions, loadingDeck]);

  // Preenche o deck de recursos com 10 cópias de 1 resource padrão só quando ele está
  // TOTALMENTE vazio — diferente do EX Base/Resource, isso não é um slot travado: é só
  // um ponto de partida conveniente, o jogador continua livre pra adicionar/remover
  // qualquer resource pela pool normalmente depois. Não mexe se já tiver algo lá (deck
  // carregado do banco, ou o jogador já começou a montar essa parte).
  useEffect(() => {
    if (loadingDeck || !defaultResourceOption) return;
    setEntries((current) => {
      if (current.some((item) => item.section === "resource")) return current;
      const printId = defaultResourceOption.printId || defaultResourceOption.id;
      return [...current, { cardId: printId, quantity: DECK_RESOURCE_SIZE, section: "resource" }];
    });
  }, [defaultResourceOption, loadingDeck]);

  const setExComponentArt = (section: "ex_base" | "ex_resource", printId: string) => {
    const options = section === "ex_base" ? exBaseOptions : exResourceOptions;
    const card = options.find((item) => (item.printId || item.id) === printId);
    if (!card) return;
    cacheCards([card]);
    setEntries((current) => current.map((item) => (item.section === section ? { ...item, cardId: printId } : item)));
  };

  const resetExComponent = (section: "ex_base" | "ex_resource") => {
    const options = section === "ex_base" ? exBaseOptions : exResourceOptions;
    const defaultCode = section === "ex_base" ? "EXB-001" : "EXR-001";
    const defaultCard = options.find((item) => item.code === defaultCode) || options[0];
    if (!defaultCard) return;
    setExComponentArt(section, defaultCard.printId || defaultCard.id);
  };

  const applyDeck = (deck: ApiDeck) => {
    setSelectedDeckId(deck.id);
    setSelectedShareId(deck.shareId);
    setIsPrimary(deck.isPrimary);
    setDeckName(deck.name);
    setVisibility(deck.visibility);
    setCoverImage(deck.coverImage || "");
    setFeaturedCardIds((deck.featuredCardIds || []).slice(0, 2));
    setFeaturedCardDetails(Object.fromEntries((deck.featuredCards || []).map((card: any) => [card.id, card])));
    // deck.items[].card já vem incluído na resposta (ver server/index.ts) como a
    // impressão crua (Card) — usa direto, sem precisar de outra chamada à API.
    const deckCards = (deck.items || []).map((item: any) => item.card).filter(Boolean).map(mapApiCard);
    cacheCards(deckCards);
    setEntries(deck.items.map((item: any) => ({ cardId: item.card?.id ?? item.cardId, quantity: item.quantity, section: (item.section as DeckEntry["section"]) || "main" })));
  };

  const loadDeck = async (id: string) => {
    setLoadingDeck(true);
    try {
      const deck = await api.getMyDeck(id);
      applyDeck(deck);
    } catch {
      toast.error("Deck não encontrado.");
      navigate("/deckbuilder");
    } finally {
      setLoadingDeck(false);
    }
  };

  useEffect(() => {
    if (deckId) loadDeck(deckId).catch(() => undefined);
  }, [deckId]);

  useEffect(() => {
    loadPoolMeta().catch(() => undefined);
    loadLegality().catch(() => undefined);
    loadExComponents().catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPoolFilters((current) => (current.q === poolQueryDraft ? current : { ...current, q: poolQueryDraft }));
      setPoolPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [poolQueryDraft]);

  useEffect(() => {
    loadCards(poolFilters, poolPage).catch(() => undefined);
  }, [poolFilters, poolPage, poolPageSize]);

  const deckRows = useMemo(
    () =>
      entries
        .map((entry) => {
          const card = cardCache[entry.cardId];
          return card ? { ...card, quantity: entry.quantity, section: entry.section || "main" } : null;
        })
        .filter(Boolean) as (CardRecord & { quantity: number; section: string })[],
    [entries, cardCache],
  );

  const mainDeckRows = useMemo(() => deckRows.filter((row) => row.section !== "resource" && !NON_COUNTED_SECTIONS.has(row.section)), [deckRows]);
  const [mainViewMode, setMainViewMode] = useState<"grid" | "type">("grid");
  const groupedMainRows = useMemo(() => groupCardsByType(mainDeckRows), [mainDeckRows]);
  const resourceDeckRows = useMemo(() => deckRows.filter((row) => row.section === "resource"), [deckRows]);
  const exBaseRow = useMemo(() => deckRows.find((row) => row.section === "ex_base"), [deckRows]);
  const exResourceRow = useMemo(() => deckRows.find((row) => row.section === "ex_resource"), [deckRows]);

  // Converte o formato bruto de /api/decks/legality (arrays simples, do jeito que a API
  // devolve) pro formato que computeDeckLegality espera (Set/Map) — mesmo motor do
  // Pacote A, rodando aqui no navegador pra validar em tempo real sem round-trip a
  // cada clique (ver src/lib/deck-legality.ts).
  const legalityEngineData: DeckLegalityData = useMemo(() => ({
    banned: new Set((legalityData?.banned || []).map((c: any) => c.id)),
    restricted: new Map((legalityData?.restricted || []).map((c: any) => [c.id, c.restrictedCopies ?? 2])),
    banGroups: new Map((legalityData?.banGroups || []).map((g: any) => [g.id, { label: g.label, maxDistinct: g.maxDistinct, memberIds: new Set(g.members.map((m: any) => m.id)) }])),
  }), [legalityData]);

  const liveLegality = useMemo(
    () => computeDeckLegality(deckRows.map((row) => ({ cardModelId: row.cardModelId || row.id, cardType: row.type, color: row.color, quantity: row.quantity, section: row.section })), legalityEngineData),
    [deckRows, legalityEngineData],
  );

  const stats = useMemo(() => calculateStats(cardCache, entries), [cardCache, entries]);

  const curveData = useMemo(() => {
    const map = new Map<number, number>();
    mainDeckRows.forEach((row) => map.set(row.cost, (map.get(row.cost) ?? 0) + row.quantity));
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([cost, quantity]) => ({ cost: String(cost), quantity }));
  }, [mainDeckRows]);

  const colorData = useMemo(() => Object.entries(stats.colorMap).map(([name, value]) => ({ name, value })), [stats.colorMap]);
  const typeData = useMemo(() => Object.entries(stats.typeMap).map(([name, quantity]) => ({ name, quantity })), [stats.typeMap]);
  const topTraits = useMemo(() => Object.entries(stats.traitMap).sort((a, b) => b[1] - a[1]).slice(0, 3), [stats.traitMap]);
  const poolActiveFilters = useMemo(() => Object.values(poolFilters).filter(Boolean).length, [poolFilters]);

  const diagnostics = useMemo(() => {
    const notes: Array<{ kind: "ok" | "warn"; label: string; value: string }> = [];
    notes.push({ kind: stats.mainDeckCount > 0 ? "ok" : "warn", label: "Volume atual", value: `${stats.mainDeckCount} cartas na lista` });
    notes.push({ kind: deckRows.length >= 10 ? "ok" : "warn", label: "Variedade", value: `${deckRows.length} cartas únicas` });
    notes.push({ kind: stats.cardsAtLimit > 0 ? "ok" : "warn", label: "Cópias no limite", value: `${stats.cardsAtLimit} cartas em 4x` });
    notes.push({ kind: stats.cardsWithKeywords > 0 ? "ok" : "warn", label: "Cobertura por keywords", value: `${stats.cardsWithKeywords} cartas com keywords mapeadas` });
    notes.push({ kind: topTraits.length > 0 ? "ok" : "warn", label: "Linha principal", value: topTraits[0] ? `${topTraits[0][0]} · ${topTraits[0][1]}` : "Sem trait dominante ainda" });
    return notes;
  }, [stats, deckRows.length, topTraits]);

  const dominantColor = useMemo(() => [...colorData].sort((a, b) => b.value - a.value)[0]?.name || "", [colorData]);
  const dominantTrait = useMemo(() => topTraits[0]?.[0] || "", [topTraits]);
  const dominantSeries = useMemo(() => {
    const map = new Map<string, number>();
    mainDeckRows.forEach((row) => {
      const key = row.series || "";
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + row.quantity);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }, [mainDeckRows]);

  // Candidatos de recomendação buscados à parte da pool que o usuário está navegando —
  // sem isso, um filtro de cor/tipo ativo na pool "sequestrava" a recomendação (só podia
  // sugerir dentro do que já estava filtrado, mesmo que a melhor sinergia estivesse fora).
  // Refaz sempre que trait/série/cor dominante do deck muda, não quando o usuário troca filtro.
  const [recommendationPool, setRecommendationPool] = useState<CardRecord[]>([]);
  useEffect(() => {
    if (!dominantTrait && !dominantSeries && !dominantColor) { setRecommendationPool([]); return; }
    let active = true;
    Promise.all([
      dominantTrait ? api.listCardsPage({ trait: dominantTrait } as CardFilters, { page: 1, pageSize: 40 }).catch(() => null) : null,
      dominantSeries ? api.listCardsPage({ series: dominantSeries } as CardFilters, { page: 1, pageSize: 40 }).catch(() => null) : null,
      dominantColor ? api.listCardsPage({ color: dominantColor } as CardFilters, { page: 1, pageSize: 40 }).catch(() => null) : null,
    ]).then(([byTrait, bySeries, byColor]) => {
      if (!active) return;
      const merged = new Map<string, CardRecord>();
      for (const result of [byTrait, bySeries, byColor]) {
        if (!result) continue;
        for (const card of result.items.map(mapApiCard)) merged.set(card.id, card);
      }
      setRecommendationPool([...merged.values()]);
    });
    return () => { active = false; };
  }, [dominantTrait, dominantSeries, dominantColor]);

  const synergyScore = useMemo(() => {
    if (!deckRows.length) return 0;
    let points = 0;
    if (dominantColor && colorData.find((item) => item.name === dominantColor && item.value >= Math.max(8, stats.mainDeckCount * 0.35))) points += 35;
    if (dominantTrait && topTraits[0]?.[1] >= Math.max(6, stats.mainDeckCount * 0.25)) points += 35;
    if (stats.cardsWithKeywords >= Math.max(4, Math.floor(stats.mainDeckCount * 0.2))) points += 15;
    if (deckRows.length >= 12) points += 15;
    return Math.min(100, points);
  }, [deckRows.length, dominantColor, dominantTrait, colorData, stats.mainDeckCount, stats.cardsWithKeywords, topTraits]);

  const synergyLabel = synergyScore >= 80 ? "sinergia forte" : synergyScore >= 55 ? "sinergia em formação" : "base ainda dispersa";

  const archetypeBlocks = useMemo(() => {
    const blocks: Array<{ label: string; value: string; hint: string }> = [];
    if (dominantColor) blocks.push({ label: "Cor-base", value: dominantColor, hint: "Maior presença atual na lista." });
    if (dominantTrait) blocks.push({ label: "Trait-base", value: dominantTrait, hint: "Núcleo de identidade do deck." });
    if (dominantSeries) blocks.push({ label: "Série-base", value: dominantSeries, hint: "Linha temática mais recorrente." });
    const mainType = [...typeData].sort((a, b) => b.quantity - a.quantity)[0];
    if (mainType) blocks.push({ label: "Tipo-base", value: mainType.name, hint: "Tipo mais frequente na composição." });
    return blocks;
  }, [dominantColor, dominantTrait, dominantSeries, typeData]);

  const recommendationCards = useMemo(() => {
    const existingModelIds = new Set(entries.map((entry) => cardCache[entry.cardId]?.cardModelId).filter(Boolean));
    const candidates = new Map<string, CardRecord>();
    for (const card of cards) candidates.set(card.id, card);
    for (const card of recommendationPool) candidates.set(card.id, card);
    return [...candidates.values()]
      .filter((card) => !existingModelIds.has(card.id))
      .map((card) => {
        let score = 0;
        const reasons: string[] = [];
        if (dominantColor && card.color === dominantColor) {
          score += 4;
          reasons.push(`combina com a cor-base ${dominantColor}`);
        }
        if (dominantTrait && card.trait === dominantTrait) {
          score += 5;
          reasons.push(`fortalece a trait ${dominantTrait}`);
        }
        if (dominantSeries && card.series === dominantSeries) {
          score += 3;
          reasons.push(`segue a série ${dominantSeries}`);
        }
        if (card.keywords.some((keyword) => deckRows.some((row) => row.keywords.includes(keyword)))) {
          score += 3;
          reasons.push("compartilha keywords já presentes");
        }
        if (card.cost <= 2 && stats.lowCostRate < 35) {
          score += 2;
          reasons.push("ajuda a baixar a curva");
        }
        return { ...card, score, reasons };
      })
      .filter((card) => card.score > 0)
      .sort((a, b) => b.score - a.score || a.cost - b.cost)
      .slice(0, 6);
  }, [cards, recommendationPool, entries, cardCache, dominantColor, dominantTrait, dominantSeries, deckRows, stats.lowCostRate]);

  const setPoolFilter = (key: keyof PoolFilters, value: string) => {
    setPoolPage(1);
    setPoolFilters((current) => ({ ...current, [key]: value }));
  };
  const resetPoolFilters = () => {
    setPoolPage(1);
    setPoolQueryDraft("");
    setPoolFilters(defaultPoolFilters);
  };

  const increment = (card: CardRecord) => {
    // EX Base / EX Resource não entram pela pool normal — usar o clique de troca
    // de arte (ver PoolCardTile/onSwapExComponent). Isso aqui é só rede de segurança.
    if (card.type === "EX_BASE" || card.type === "EX_RESOURCE") return;
    const printId = card.printId || card.id;
    const modelId = card.cardModelId || card.id;
    const section = getSectionForCardType(card.type);
    const limit = getCopyLimit(modelId, card.type);
    const currentTotal = entries.filter((entry) => (cardCache[entry.cardId]?.cardModelId || entry.cardId) === modelId).reduce((sum, entry) => sum + entry.quantity, 0);
    if (currentTotal >= limit) {
      toast.error(limit === 0 ? `${card.namePt || card.name} está banida — não pode ser usada.` : `Limite de ${limit} cópia(s) de "${card.namePt || card.name}" já atingido.`);
      return;
    }
    // Limite do deck de recursos é no TOTAL (exatamente 10), separado do limite por
    // carta (que é livre entre si) — sem isso dava pra passar de 10 sem aviso nenhum.
    if (section === "resource" && stats.resourceDeckCount >= DECK_RESOURCE_SIZE) {
      toast.error(`Deck de recursos já tem ${DECK_RESOURCE_SIZE} cartas — remova uma antes de adicionar outra.`);
      return;
    }
    cacheCards([card]);
    setEntries((current) => {
      const found = current.find((item) => item.cardId === printId);
      if (found) return current.map((item) => (item.cardId === printId ? { ...item, quantity: item.quantity + 1 } : item));
      return [...current, { cardId: printId, quantity: 1, section }];
    });
  };

  const decrement = (printId: string) => {
    setEntries((current) => current.map((item) => (item.cardId === printId ? { ...item, quantity: item.quantity - 1 } : item)).filter((item) => item.quantity > 0));
  };

  const saveDeck = async () => {
    const payload = {
      name: deckName,
      format: "constructed",
      visibility,
      isPrimary,
      coverImage: coverImage || null,
      featuredCardIds: featuredCardIds.slice(0, 2),
      items: entries.map((item) => ({ cardId: item.cardId, quantity: item.quantity, section: item.section || "main" })),
    };

    if (selectedDeckId) {
      const updated = await api.updateMyDeck(selectedDeckId, payload);
      setSelectedShareId(updated.shareId);
    } else {
      const created = await api.createMyDeck(payload);
      setSelectedDeckId(created.id);
      setSelectedShareId(created.shareId);
      // Troca a URL de /deckbuilder/new pra /deckbuilder/:id — assim um F5 ou
      // "voltar" do navegador não tenta criar outro deck do zero por engano.
      navigate(`/deckbuilder/${created.id}`, { replace: true });
    }
    toast.success("Deck salvo no backend.");
  };


  const toggleFeaturedCard = (card: { id: string; name: string; imageUrl: string | null }) => {
    setFeaturedCardIds((current) => {
      if (current.includes(card.id)) return current.filter((id) => id !== card.id);
      if (current.length >= 2) { toast.error("Escolha no máximo duas cartas de destaque."); return current; }
      return [...current, card.id];
    });
    setFeaturedCardDetails((current) => ({ ...current, [card.id]: card }));
  };

  // Busca dedicada pras cartas de destaque — decoupled da pool principal de propósito,
  // pra achar qualquer carta do catálogo (não só o que está filtrado na tela agora).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = featuredQuery.trim();
      if (!trimmed) { setFeaturedResults([]); return; }
      setFeaturedSearching(true);
      api.listCardsPage({ q: trimmed } as CardFilters, { page: 1, pageSize: 12 })
        .then((result) => setFeaturedResults(result.items.map(mapApiCard)))
        .finally(() => setFeaturedSearching(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [featuredQuery]);

  const copyShareLink = async () => {
    if (!selectedShareId) {
      toast.error("Salve o deck primeiro para gerar o share link.");
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}#/deck/${selectedShareId}`;
    await navigator.clipboard.writeText(url);
    toast.success("Share link copiado.");
  };

  const copyDecklist = async () => {
    if (!deckRows.length) {
      toast.error("Monte pelo menos uma carta para copiar a decklist.");
      return;
    }
    const mainText = mainDeckRows.map((row) => `${row.quantity}x ${row.code} - ${row.namePt || row.name}`).join("\n");
    const resourceText = resourceDeckRows.map((row) => `${row.quantity}x ${row.code} - ${row.namePt || row.name}`).join("\n");
    const text = [`Deck principal (${stats.mainDeckCount}/${DECK_MAIN_SIZE}):`, mainText || "(vazio)", "", `Deck de recursos (${stats.resourceDeckCount}/${DECK_RESOURCE_SIZE}):`, resourceText || "(vazio)"].join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("Decklist copiada em texto.");
  };

  /** Formato Exburst/MSA (Mobile Suit Arena) — "4x CODE" por linha, sem cabeçalho, sem
   *  nome, EX Base/Resource fora (não fazem parte do deckbuilding nesses simuladores
   *  também). É o formato que a comunidade usa pra importar deck pronto no MSA — ver
   *  msafixer.com, que documenta esse como "Exburst Format". */
  const copyDecklistMSA = async () => {
    if (!mainDeckRows.length && !resourceDeckRows.length) {
      toast.error("Monte pelo menos uma carta para copiar a decklist.");
      return;
    }
    const lines = [...mainDeckRows, ...resourceDeckRows].map((row) => `${row.quantity}x ${row.code}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Decklist copiada no formato MSA/Exburst.");
  };

  /** Importa uma decklist colada em texto — aceita "4x CODE", "4 CODE" ou só "CODE"
   *  (1 cópia), uma por linha, mesmo formato que a exportação MSA/Exburst gera (então
   *  o que sai daqui volta a entrar sem editar nada). Substitui o deck principal e o
   *  de recursos atuais — EX Base/Resource ficam intocados, não fazem parte do formato.
   *  Busca cada code em paralelo (não é 1 chamada por linha sequencial). */
  const importDecklistText = async (text: string) => {
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    const parsed = lines.map((line) => {
      const match = line.match(/^(\d+)\s*x?\s+(\S+)$/i) || line.match(/^(\S+)$/);
      if (!match) return null;
      if (match.length === 3) return { quantity: Number(match[1]) || 1, code: match[2].toUpperCase() };
      return { quantity: 1, code: match[1].toUpperCase() };
    }).filter(Boolean) as Array<{ quantity: number; code: string }>;

    if (!parsed.length) { toast.error("Não consegui reconhecer nenhuma linha nesse texto."); return; }

    setImporting(true);
    try {
      const results = await Promise.all(
        parsed.map(async (item) => {
          const result = await api.listCardsPage({ q: item.code } as PoolFilters, { page: 1, pageSize: 5 }).catch(() => null);
          const match = result?.items.map(mapApiCard).find((card) => card.code.toUpperCase() === item.code);
          return { ...item, card: match || null };
        }),
      );

      const found = results.filter((r) => r.card);
      const missing = results.filter((r) => !r.card);

      const newEntries: DeckEntry[] = found.map((r) => {
        const card = r.card!;
        cacheCards([card]);
        return { cardId: card.printId || card.id, quantity: r.quantity, section: card.type === "RESOURCE" ? "resource" : "main" };
      });

      setEntries((current) => [...current.filter((e) => e.section === "ex_base" || e.section === "ex_resource"), ...newEntries]);
      setImportModalOpen(false);
      setImportText("");

      if (missing.length) {
        toast.warning(`${found.length} carta(s) importada(s). ${missing.length} código(s) não encontrado(s): ${missing.map((m) => m.code).join(", ")}`);
      } else {
        toast.success(`${found.length} carta(s) importada(s) com sucesso.`);
      }
    } finally {
      setImporting(false);
    }
  };

  /** Imagem PNG da decklist inteira, tipo pôster (como o ExBurst faz) — desenha a grade
   *  de cartas num canvas e baixa como arquivo. Cliente-side, sem servidor — mas por
   *  isso depende de as imagens das cartas permitirem uso entre domínios (CORS). Se a
   *  fonte não permitir, o canvas fica "contaminado" e a exportação falha com aviso
   *  claro em vez de travar silenciosamente. */
  const generateDeckImage = async () => {
    if (!mainDeckRows.length && !resourceDeckRows.length) {
      toast.error("Monte pelo menos uma carta para gerar a imagem.");
      return;
    }
    setGeneratingImage(true);
    try {
      const CARD_W = 140;
      const CARD_H = Math.round((CARD_W * 88) / 63);
      const GAP = 10;
      const COLS = 8;
      const MARGIN = 24;
      const SECTION_LABEL_H = 26;
      const SECTION_GAP = 30;

      // Passa pelo nosso proxy (ver server/index.ts: /api/image-proxy) — o CDN de
      // origem (tcgplayer-cdn.tcgplayer.com) não libera CORS pra uso em canvas de outro
      // domínio, então canvas.toBlob() ficaria "contaminado" e travaria com a imagem
      // crua. Same-origin (via nosso proxy) resolve isso.
      const proxied = (src: string) => (src ? `${API_BASE_URL}/image-proxy?url=${encodeURIComponent(src)}` : "");
      const loadImage = (src: string): Promise<HTMLImageElement | null> =>
        new Promise((resolve) => {
          if (!src) { resolve(null); return; }
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = proxied(src);
        });

      const buildSection = async (rows: DeckRow[]) => {
        const images = await Promise.all(rows.map((row) => loadImage(row.imageMediumUrl || row.imageUrl || "")));
        return rows.map((row, i) => ({ row, image: images[i] }));
      };
      const [mainSection, resourceSection] = await Promise.all([buildSection(mainDeckRows), buildSection(resourceDeckRows)]);

      const sectionRows = (count: number) => Math.max(1, Math.ceil(count / COLS));
      const sectionHeight = (count: number) => SECTION_LABEL_H + sectionRows(count) * (CARD_H + GAP);
      const totalWidth = MARGIN * 2 + COLS * CARD_W + (COLS - 1) * GAP;
      const totalHeight = MARGIN + 44 + sectionHeight(mainSection.length) + SECTION_GAP + sectionHeight(resourceSection.length) + MARGIN;

      const canvas = document.createElement("canvas");
      canvas.width = totalWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas não suportado neste navegador.");

      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, totalWidth, totalHeight);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText(deckName || "Deck", MARGIN, MARGIN + 22);

      let cursorY = MARGIN + 44;
      const drawSection = (label: string, section: { row: DeckRow; image: HTMLImageElement | null }[]) => {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText(label.toUpperCase(), MARGIN, cursorY);
        const gridTop = cursorY + SECTION_LABEL_H;
        section.forEach((entry, index) => {
          const col = index % COLS;
          const row = Math.floor(index / COLS);
          const x = MARGIN + col * (CARD_W + GAP);
          const y = gridTop + row * (CARD_H + GAP);
          if (entry.image) {
            ctx.drawImage(entry.image, x, y, CARD_W, CARD_H);
          } else {
            ctx.fillStyle = "#1e293b";
            ctx.fillRect(x, y, CARD_W, CARD_H);
            ctx.fillStyle = "#64748b";
            ctx.font = "11px sans-serif";
            ctx.fillText(entry.row.code, x + 8, y + CARD_H / 2);
          }
          ctx.fillStyle = "#3b82f6";
          ctx.beginPath();
          ctx.arc(x + CARD_W - 14, y + 14, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 13px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(entry.row.quantity), x + CARD_W - 14, y + 15);
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
        });
        cursorY = gridTop + sectionRows(section.length) * (CARD_H + GAP) + SECTION_GAP;
      };

      drawSection(`Deck principal (${stats.mainDeckCount}/${DECK_MAIN_SIZE})`, mainSection);
      drawSection(`Deck de recursos (${stats.resourceDeckCount}/${DECK_RESOURCE_SIZE})`, resourceSection);

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Não consegui gerar o arquivo da imagem.");

      setDeckImageBlob(blob);
      setDeckImagePreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(blob); });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar a imagem.");
    } finally {
      setGeneratingImage(false);
    }
  };

  const confirmDownloadDeckImage = () => {
    if (!deckImageBlob) return;
    const url = URL.createObjectURL(deckImageBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(deckName || "deck").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Imagem baixada.");
  };

  const closeDeckImagePreview = () => {
    setDeckImagePreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return null; });
    setDeckImageBlob(null);
  };


  return (
    <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Decks", href: "/deckbuilder" }, { label: deckId ? deckName || "Editando" : "Novo deck" }]}>
      {loadingDeck ? (
        <p className="text-sm text-muted-portal">Carregando deck...</p>
      ) : (
      <div className="space-y-6">
        {/* Barra compacta — nome, visibilidade, status de validade e ações, tudo visível sem rolar */}
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <Input value={deckName} onChange={(e) => setDeckName(e.target.value)} className="field-shell font-heading text-xl uppercase heading-portal sm:max-w-xs" />
              <div className="flex flex-wrap gap-1.5">
                {(["PRIVATE", "UNLISTED", "PUBLIC"] as DeckVisibility[]).map((mode) => (
                  <button key={mode} type="button" onClick={() => setVisibility(mode)} className={`rounded-none border px-2.5 py-1.5 text-[11px] uppercase tracking-[0.14em] transition ${visibility === mode ? "border-primary/40 bg-primary/12 text-white" : "border-white/15 bg-white/5 text-soft hover:bg-white/10 hover:text-white"}`}>
                    {mode}
                  </button>
                ))}
              </div>
              <div className={`inline-flex items-center gap-2 rounded-none border px-3 py-1.5 text-xs uppercase tracking-[0.14em] ${liveLegality.valid ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-amber-400/30 bg-amber-400/10 text-amber-300"}`} title={liveLegality.issues.map((i) => i.message).join(" · ")}>
                <span className={`inline-flex size-2 rounded-full ${liveLegality.valid ? "bg-emerald-400" : "bg-amber-400"}`} />
                {liveLegality.valid ? "Válido" : `${liveLegality.issues.length} pendência(s)`} · {stats.mainDeckCount}/{DECK_MAIN_SIZE} · {stats.resourceDeckCount}/{DECK_RESOURCE_SIZE}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveDeck}><Save className="mr-2 size-4" />Salvar</Button>
              <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={() => navigate("/deckbuilder/new")}><Plus className="mr-2 size-4" />Novo</Button>
              <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={copyShareLink}><Share2 className="mr-2 size-4" />Compartilhar</Button>
              <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={() => setImportModalOpen(true)}><Upload className="mr-2 size-4" />Importar</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"><Copy className="mr-2 size-4" />Exportar</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-none border-white/10 bg-slate-950 text-white">
                  <DropdownMenuItem onClick={copyDecklist} className="cursor-pointer focus:bg-white/10 focus:text-white">Copiar decklist (texto)</DropdownMenuItem>
                  <DropdownMenuItem onClick={copyDecklistMSA} className="cursor-pointer focus:bg-white/10 focus:text-white">Copiar formato MSA/Exburst</DropdownMenuItem>
                  <DropdownMenuItem onClick={generateDeckImage} disabled={generatingImage} className="cursor-pointer focus:bg-white/10 focus:text-white">{generatingImage ? "Gerando…" : "Baixar imagem (PNG)"}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {/* Abas — Montar é o padrão (pool + decklist), Estatísticas junta diagnóstico/arquétipo/recomendações/gráficos */}
        <div className="flex gap-2 border-b border-white/10">
          {([["montar", "Montar"], ["estatisticas", "Estatísticas"]] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)} className={`border-b-2 px-4 py-2.5 text-sm uppercase tracking-[0.18em] transition ${activeTab === key ? "border-primary text-white" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === "montar" ? (
        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="panel-cut rounded-none surface-panel">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Deckbuilder via API</p>
                <h2 className="mt-2 font-heading text-4xl uppercase">Pool filtrada para montar o deck</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-soft">A pool agora pode ser refinada por cor, tipo, série e trait antes de entrar na lista. Isso acelera montagem, revisão e testes por arquétipo.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <Input value={poolQueryDraft} onChange={(e) => setPoolQueryDraft(e.target.value)} placeholder="Nome, código, série ou trait" className="field-shell xl:col-span-2" />
              <select value={poolFilters.color} onChange={(e) => setPoolFilter("color", e.target.value)} className="field-shell h-10 px-3 text-sm"><option value="">Todas as cores</option>{poolMeta.colors.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={poolFilters.cardType} onChange={(e) => setPoolFilter("cardType", e.target.value)} className="field-shell h-10 px-3 text-sm"><option value="">Todos os tipos</option>{poolMeta.cardTypes.map((item) => <option key={item} value={item}>{CARD_TYPE_OPTIONS.find((opt) => opt.value === item)?.label || item}</option>)}</select>
              <select value={poolFilters.series} onChange={(e) => setPoolFilter("series", e.target.value)} className="field-shell h-10 px-3 text-sm"><option value="">Todas as séries</option>{poolMeta.series.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={poolFilters.trait} onChange={(e) => setPoolFilter("trait", e.target.value)} className="field-shell h-10 px-3 text-sm"><option value="">Todas as traits</option>{poolMeta.traits.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{poolTotal} cartas encontradas</Badge>
              <Badge variant="outline" className="rounded-none border-white/20 text-soft">{poolActiveFilters} filtros ativos</Badge>
              <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={resetPoolFilters}>Limpar filtros</Button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2.5 sm:grid-cols-5 xl:grid-cols-6">
              {loadingPool ? <p className="col-span-full text-sm text-muted-portal">Carregando pool filtrada...</p> : null}
              {!loadingPool && !cards.length ? <p className="col-span-full text-sm text-muted-portal">Nenhuma carta encontrada nessa combinação de filtros.</p> : null}
              {cards.map((card) => {
                const qtyInDeck = entries.filter((entry) => (cardCache[entry.cardId]?.cardModelId || entry.cardId) === card.id).reduce((sum, entry) => sum + entry.quantity, 0);
                const limit = getCopyLimit(card.id, card.type);
                const section = getSectionForCardType(card.type);
                return <PoolCardTile key={card.id} card={card} qtyInDeck={qtyInDeck} limit={limit} section={section} onAdd={increment} onDecrement={decrement} onOpenGallery={setAltArtModelId} onSwapExComponent={setExComponentArt} onPreview={setPreviewCard} />;
              })}
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Página {poolPage} de {poolTotalPages} · exibindo {cards.length} de {poolTotal} resultados</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white disabled:opacity-40 light:border-slate-400/90 light:bg-white light:text-slate-950" disabled={poolPage <= 1 || loadingPool} onClick={() => setPoolPage((current) => Math.max(1, current - 1))}>Anterior</Button>
                <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white disabled:opacity-40 light:border-slate-400/90 light:bg-white light:text-slate-950" disabled={poolPage >= poolTotalPages || loadingPool} onClick={() => setPoolPage((current) => Math.min(poolTotalPages, current + 1))}>Próxima</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h3 className="font-heading text-3xl uppercase heading-portal">Deck principal</h3>
                <div className="flex items-center gap-3">
                  <div className="flex border border-white/15">
                    <button type="button" onClick={() => setMainViewMode("grid")} className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition ${mainViewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-white/5 text-soft hover:bg-white/10"}`}>Grade única</button>
                    <button type="button" onClick={() => setMainViewMode("type")} className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition ${mainViewMode === "type" ? "bg-primary text-primary-foreground" : "bg-white/5 text-soft hover:bg-white/10"}`}>Por tipo</button>
                  </div>
                  <Badge className={`rounded-none border ${stats.mainDeckCount === DECK_MAIN_SIZE ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-amber-400/40 bg-amber-400/10 text-amber-300"}`}>{stats.mainDeckCount}/{DECK_MAIN_SIZE}</Badge>
                </div>
              </div>
              <div className="mt-6 max-h-[440px] overflow-auto pr-1">
                {!mainDeckRows.length ? <p className="text-sm text-muted-portal">Seu deck principal ainda está vazio. Use a pool filtrada à esquerda para começar.</p> : mainViewMode === "grid" ? (
                  <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 xl:grid-cols-8">
                    {mainDeckRows.map((row) => <DeckGridTile key={row.printId || row.id} row={row} onIncrement={increment} onDecrement={decrement} onOpenGallery={setAltArtModelId} onPreview={setPreviewCard} />)}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {groupedMainRows.map((group) => (
                      <div key={group.type}>
                        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">{group.label} · {group.rows.reduce((sum, r) => sum + r.quantity, 0)}</p>
                        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 xl:grid-cols-8">
                          {group.rows.map((row) => <DeckGridTile key={row.printId || row.id} row={row} onIncrement={increment} onDecrement={decrement} onOpenGallery={setAltArtModelId} onPreview={setPreviewCard} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-heading text-3xl uppercase heading-portal">Deck de recursos</h3>
                <Badge className={`rounded-none border ${stats.resourceDeckCount === DECK_RESOURCE_SIZE ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-amber-400/40 bg-amber-400/10 text-amber-300"}`}>{stats.resourceDeckCount}/{DECK_RESOURCE_SIZE}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Só cartas do tipo Resource entram aqui — sem limite de cópia entre si.</p>
              <div className="mt-4 grid grid-cols-4 gap-2.5 sm:grid-cols-6 xl:grid-cols-8 max-h-[400px] overflow-auto pr-1">
                {resourceDeckRows.length ? resourceDeckRows.map((row) => <DeckGridTile key={row.printId || row.id} row={row} onIncrement={increment} onDecrement={decrement} onOpenGallery={setAltArtModelId} onPreview={setPreviewCard} />) : <p className="col-span-full text-sm text-muted-portal">Nenhuma carta de recurso adicionada ainda — filtre por tipo "Resource" na pool.</p>}
              </div>
            </CardContent>
          </Card>

          {/* EX Base / EX Resource — sempre presentes, arte trocável clicando na carta na
              pool (busque "ex base"/"ex resource" — desbloqueada, marcada "carta única").
              Fica acima da capa editorial: é parte do deck de verdade, a capa é cosmética. */}
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">EX Base / EX Resource</p>
              <p className="mt-1 text-xs leading-5 text-muted-portal">Sempre inclusos, arte padrão por padrão. Pra trocar, busque "ex base" ou "ex resource" na pool e clique na arte desejada.</p>
              <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
                <ExComponentTile label="EX Base" row={exBaseRow} onReset={() => resetExComponent("ex_base")} />
                <ExComponentTile label="EX Resource" row={exResourceRow} onReset={() => resetExComponent("ex_resource")} />
              </div>
            </CardContent>
          </Card>

          {/* Estilo visual — opcional, recolhido por padrão pra não competir com a decklist.
              Capa = as próprias cartas escolhidas, divididas ao meio (sem processar imagem,
              não temos arte sem moldura/SAMPLE na base — ver FeaturedCoverImage). */}
          <details className="panel-cut border surface-strong open:pb-5">
            <summary className="cursor-pointer select-none p-5 text-xs uppercase tracking-[0.22em] text-slate-500">Estilo visual do deck (opcional)</summary>
            <div className="grid gap-4 px-5 lg:grid-cols-[180px_1fr]">
              <div className="relative min-h-28 overflow-hidden border border-white/15 bg-slate-950/60">
                <FeaturedCoverImage cards={featuredCardIds.map((id) => featuredCardDetails[id]).filter(Boolean)} />
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Cartas de referência · até 2</p>
                  <p className="mt-1 text-sm text-soft">A capa do deck é montada com a arte dessas cartas, uma de cada lado. Busque em todo o catálogo, não só na pool filtrada ao lado.</p>
                </div>
                {featuredCardIds.length ? (
                  <div className="flex flex-wrap gap-2">
                    {featuredCardIds.map((id) => {
                      const card = featuredCardDetails[id];
                      if (!card) return null;
                      return (
                        <button key={id} type="button" onClick={() => toggleFeaturedCard(card)} className="flex items-center gap-2 border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs text-white transition hover:bg-primary/20">
                          {card.name} <span className="text-primary">✕</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <Input value={featuredQuery} onChange={(e) => setFeaturedQuery(e.target.value)} placeholder="Buscar carta por nome ou código" className="field-shell" />
                <div className="grid max-h-52 gap-2 overflow-auto pr-1 sm:grid-cols-2">
                  {featuredSearching ? <p className="col-span-full text-xs text-muted-portal">Buscando…</p> : null}
                  {!featuredSearching && featuredQuery.trim() && !featuredResults.length ? <p className="col-span-full text-xs text-muted-portal">Nenhuma carta encontrada.</p> : null}
                  {featuredResults.map((card) => {
                    const active = featuredCardIds.includes(card.id);
                    const cardData = { id: card.id, name: card.namePt || card.name, imageUrl: card.imageMediumUrl || card.imageUrl || null };
                    return (
                      <button key={card.id} type="button" onClick={() => toggleFeaturedCard(cardData)} disabled={!active && featuredCardIds.length >= 2} className={`flex items-center gap-2 border p-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? "border-primary bg-primary/15 text-white" : "border-white/15 bg-white/5 text-soft hover:bg-white/10"}`}>
                        <span className={`flex size-5 shrink-0 items-center justify-center border text-[10px] ${active ? "border-primary bg-primary text-primary-foreground" : "border-white/20"}`}>{active ? "✓" : ""}</span>
                        <span className="min-w-0"><span className="block truncate font-medium">{card.namePt || card.name}</span><span className="block truncate text-[10px] text-slate-500">{card.code}</span></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </details>
        </div>
        </div>
        ) : (
        <div className="space-y-6">
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Diagnóstico operacional</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">Leitura rápida do deck</h3>
                </div>
                <div className="panel-cut border border-primary/30 bg-primary/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-portal">Sinergia estimada</p>
                  <p className="mt-2 font-heading text-4xl heading-portal">{synergyScore}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-primary">{synergyLabel}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {diagnostics.map((item) => (
                  <div key={item.label} className={`panel-cut border p-4 ${item.kind === "ok" ? "border-primary/30 bg-primary/10" : "border-amber-400/30 bg-amber-500/10"}`}>
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-portal">{item.label}</p>
                    <p className="mt-2 text-sm leading-7 heading-portal">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Blocos por arquétipo</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">Identidade atual da lista</h3>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {archetypeBlocks.length ? archetypeBlocks.map((block) => (
                    <div key={block.label} className="panel-cut border surface-strong p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{block.label}</p>
                      <p className="mt-2 text-lg heading-portal">{block.value}</p>
                      <p className="mt-2 text-sm text-muted-portal">{block.hint}</p>
                    </div>
                  )) : <p className="text-sm text-muted-portal">Adicione mais cartas para o sistema identificar melhor o arquétipo.</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Sugestões de contexto</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">Recomendações por carta</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Reage ao que já está no deck (trait, cor e série dominantes) — vai ficando mais precisa conforme você adiciona cartas.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {recommendationCards.length ? recommendationCards.map((card) => (
                    <div key={card.id} className="panel-cut border surface-strong p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs uppercase tracking-[0.18em] text-slate-500">{card.code}</p>
                          <p className="truncate text-sm font-medium heading-portal">{card.namePt || card.name}</p>
                          <p className="text-[11px] text-muted-portal">{card.color} · custo {card.cost}</p>
                        </div>
                        <Button size="sm" className="shrink-0 rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => increment(card)}>+</Button>
                      </div>
                    </div>
                  )) : <p className="col-span-full text-sm text-muted-portal">Ainda não há sinais suficientes para recomendar cartas. Monte um núcleo inicial ou limpe filtros muito restritos.</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Gráfico 01</p>
                    <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">Curva de custo</h3>
                  </div>
                </div>
                <div className="mt-6 h-[260px]">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart data={curveData}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="cost" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="quantity" radius={0} fill="var(--color-quantity)" />
                    </BarChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Gráfico 02</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">Distribuição por cor</h3>
                <div className="mt-6 h-[260px]">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                      <Pie data={colorData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={90} strokeWidth={2}>
                        {colorData.map((entry, index) => <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />)}
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                    </PieChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Gráfico 03</p>
              <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">Composição por tipo</h3>
              <div className="mt-6 h-[250px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart layout="vertical" data={typeData} margin={{ left: 12, right: 12 }}>
                    <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={90} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="quantity" radius={0} fill="var(--color-quantity)" />
                  </BarChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        </div>
        )}
      </div>
      )}
      <AltArtModal modelId={altArtModelId} onClose={() => setAltArtModelId(null)} entries={entries} getCopyLimit={getCopyLimit} onIncrement={increment} onDecrement={decrement} />
      <CardPreviewModal card={previewCard} onClose={() => setPreviewCard(null)} />
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="sm:max-w-lg border-white/10 bg-slate-950 text-white">
          <div className="border-b border-white/10 pb-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Importar decklist</p>
            <h3 className="font-heading text-2xl uppercase heading-portal">Colar lista em texto</h3>
            <p className="mt-2 text-sm text-soft">Uma carta por linha, formato "4x CODE" (mesmo que a exportação MSA/Exburst gera). Substitui o deck principal e o de recursos atuais — EX Base/Resource não são afetados.</p>
          </div>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={10} placeholder={"4x ST01-001\n2x ST01-002\n..."} className="field-shell w-full resize-none p-3 font-mono text-xs" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:text-white" onClick={() => setImportModalOpen(false)}>Cancelar</Button>
            <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" disabled={importing || !importText.trim()} onClick={() => importDecklistText(importText)}>{importing ? "Importando…" : "Importar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(deckImagePreviewUrl)} onOpenChange={(open) => !open && closeDeckImagePreview()}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl border-white/10 bg-slate-950 text-white">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Pré-visualização</p>
              <h3 className="font-heading text-2xl uppercase heading-portal">Imagem da decklist</h3>
            </div>
          </div>
          {deckImagePreviewUrl ? <img src={deckImagePreviewUrl} alt="Prévia da decklist" className="max-h-[65vh] w-full overflow-auto border border-white/10 object-contain" /> : null}
          <div className="flex justify-end gap-2 border-t border-white/10 pt-3">
            <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:text-white" onClick={closeDeckImagePreview}>Cancelar</Button>
            <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={confirmDownloadDeckImage}><Save className="mr-2 size-4" />Baixar PNG</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PortalShell>
  );
}
