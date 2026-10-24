/* Deckbuilder tático — filtros reais da pool, persistência por usuário, diagnóstico operacional e navegação contextual. */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  ExternalLink,
  Globe,
  ImagesIcon,
  Lock,
  Minus,
  Plus,
  Save,
  Share2,
  Shield,
  Swords,
  Upload,
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { OpeningHandModal } from "@/components/deck/OpeningHandModal";
import { useAuth } from "@/contexts/AuthContext";
import { api, mapApiCard, type ApiDeck, type CardFilters } from "@/lib/api";
import { DECKBUILDER_DRAFT_KEY, parseDeckbuilderDraft, type DeckbuilderDraft } from "@/lib/deckbuilder-draft";
import { DECK_MAIN_SIZE, DECK_RESOURCE_SIZE, NON_COUNTED_SECTIONS, computeDeckLegality, type DeckLegalityData } from "@/lib/deck-legality";
import { computeDeckPilotCoverage } from "@/lib/deck-pilot-coverage";
import { CARD_TYPE_OPTIONS, GAME_COLOR_HEX, groupCardsByType } from "@/lib/gundam-catalog";
import { MultiSelectFilter } from "@/components/catalog/MultiSelectFilter";
import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { MetricTooltip } from "@/components/deck/MetricTooltip";
import { VedaTelemetryAssistant } from "@/components/deck/VedaTelemetryAssistant";
import type { CardRecord, DeckEntry } from "@/modules/core/types";
import { LOW_LEVEL_MAX, OPENING_HAND_SIZE, buildLevelCurve, lowLevelUnitStats } from "@/lib/deck-level-stats";
import { LOW_COST_MAX, lowCostStats } from "@/lib/deck-cost-stats";
import { earliestPlayableTurn, isBoardDevelopmentCard } from "@/lib/opening-hand-score";
import { ExportDeckImageModal } from "@/components/deck/ExportDeckImageModal";
import { ZeroCopilotDrawer } from "@/components/deckbuilder/ZeroCopilotDrawer";
import { CardPlayabilityBadge } from "@/components/catalog/CardPlayabilityBadge";
import { useAllCardsPlayability } from "@/components/catalog/useCardPlayability";
import { DeckSimulatorNotice, DeckSimulatorPill, type UnplayableCardSummary } from "@/components/deck/DeckSimulatorNotice";
import type { CardStatusEntry, PlayabilityStatus } from "@/lib/api";
import { useCardLanguage, cardText, KeywordTooltip, getTranslationPendingBadge } from "@/i18n";
import { CardInspectorPlayabilityBadge } from "@/modules/simulator/ui/CardInspectorPlayabilityBadge";
import { formatCardText } from "@/lib/utils";
import type { CardLanguage } from "@/i18n/types";
import { tr as trNow, useSiteLanguage } from "@/i18n/siteLanguage";

function getCardDisplayName(card: { name?: string; namePt?: string; nameEn?: string } | null | undefined, isPt: boolean): string {
  if (!card) return "";
  if (isPt) {
    return card.namePt || card.name || card.nameEn || "";
  }
  return card.nameEn || card.name || card.namePt || "";
}

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

// Mesma lista das 7 keywords de efeito extraidas no backend (ver
// prisma/extract-keyword-effects.mjs) -- mantidas em sincronia manual, sao poucas e
// mudam raramente (so em atualizacao de regra oficial do jogo).
const EFFECT_KEYWORD_LIST = ["Repair", "Breach", "Support", "Blocker", "First Strike", "High-Maneuver", "Suppression"];
const NUMERIC_KEYWORDS = new Set(["Repair", "Breach", "Support"]);
const TRIGGER_KEYWORD_LIST = ["Deploy", "Burst", "Once per Turn", "During Link", "During Pair", "When Paired", "Attack", "Activate"];

function extractKeywordValue(effect: string, name: string): number | null {
  if (!effect) return null;
  const match = effect.match(new RegExp(`\\b${name}\\s+(\\d+)\\b`, "i"));
  return match ? Number(match[1]) : null;
}

// Mão inicial é sempre 5 cartas compradas do deck principal embaralhado (Comprehensive
// Rules 6 -- ver data/rulings-batch-01.json, "Can I mulligan my starting hand?": um
// mulligan devolve a mão inteira pro fundo do deck, embaralha e compra 5 novas -- ou
// seja, é um segundo sorteio independente da mesma população de N cartas, não um
// redesenho parcial. P(pelo menos 1 sucesso) = 1 - P(0 sucessos), calculado direto por
// produto de razões em vez de fatorial/combinação pra não estourar precisão com N até 50.
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
  // Corrigido a partir de erro relatado pelo usuário: "custo baixo" sozinho ignorava
  // que (1) Piloto/Comando não desenvolvem campo mesmo baratos e (2) o nível também
  // trava o turno mínimo real (ver opening-hand-score.ts: turno = max(custo, nível)).
  const lowCostCount = expanded
    .filter((item) => isBoardDevelopmentCard(item) && earliestPlayableTurn(item) <= LOW_COST_MAX)
    .reduce((sum, item) => sum + item.quantity, 0);
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
    lowCostCount,
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
  quantity: { label: "Quantidade", color: "var(--primary)" },
  value: { label: "Quantidade", color: "var(--primary)" },
} satisfies ChartConfig;


type DeckRow = CardRecord & { quantity: number; section: string };

/** Tile de carta na pool — imagem em destaque (não texto), clique pra adicionar direto,
 *  igual ao padrão de deckbuilder de jogo real (Master Duel, MTG Arena, YGO Omega) em vez
 *  da linha de texto que existia antes. Badge de quantidade no canto quando já está no
 *  deck; nome/custo só aparecem no hover, pra não poluir a grade. */
function PoolCardTile({ card, qtyInDeck, limit, section, playabilityEntry, onAdd, onDecrement, onOpenGallery, onSwapExComponent, onPreview }: { card: CardRecord; qtyInDeck: number; limit: number; section: "main" | "resource"; playabilityEntry?: CardStatusEntry | null; onAdd: (card: CardRecord) => void; onDecrement: (printId: string) => void; onOpenGallery: (modelId: string) => void; onSwapExComponent: (section: "ex_base" | "ex_resource", printId: string) => void; onPreview: (card: CardRecord) => void }) {
  const { tr } = useSiteLanguage();
  const { isPt } = useCardLanguage();
  const cardName = getCardDisplayName(card, isPt);
  const exSection = card.type === "EX_BASE" ? "ex_base" : card.type === "EX_RESOURCE" ? "ex_resource" : null;
  const banned = limit === 0;
  const atLimit = qtyInDeck >= limit;
  const image = card.imageMediumUrl || card.imageUrl;
  const printId = card.printId || card.id;
  const modelId = card.cardModelId || card.id;
  const handleClick = () => (exSection ? onSwapExComponent(exSection, printId) : onAdd(card));
  const isUnplayable = playabilityEntry && playabilityEntry.status !== "apta";
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={!exSection && atLimit}
        title={exSection ? tr(`Usar essa arte pro ${exSection === "ex_base" ? "EX Base" : "EX Resource"} do deck`, `Use this art for the deck's ${exSection === "ex_base" ? "EX Base" : "EX Resource"}`) : banned ? tr(`${cardName} — banida`, `${cardName} — banned`) : atLimit ? tr(`${cardName} — limite atingido`, `${cardName} — limit reached`) : tr(`Adicionar ${cardName}`, `Add ${cardName}`)}
        className={`relative block aspect-[63/88] w-full overflow-hidden border transition ${
          banned
            ? "border-red-400/50"
            : isUnplayable
              ? "border-amber-400/60 shadow-[0_0_8px_rgba(251,191,36,0.2)] group-hover:border-amber-300"
              : "border-white/15 group-hover:border-primary/60"
        } ${!exSection && atLimit ? "opacity-45" : ""}`}
      >
        {image ? (
          <img loading="lazy" decoding="async" src={image} alt={cardName} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.05]" />
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-950/80 p-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">{cardName}</div>
        )}

        {!exSection && qtyInDeck > 0 ? <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{qtyInDeck}</span> : null}
        {banned ? <span className="absolute inset-x-0 top-0 bg-red-500/90 py-0.5 text-center text-[9px] uppercase tracking-[0.16em] text-white">{tr("banida", "banned")}</span> : null}
        {exSection ? <span className="absolute inset-x-0 top-0 bg-slate-700/90 py-0.5 text-center text-[9px] uppercase tracking-[0.16em] text-white">{tr("carta única", "unique card")}</span> : null}
        {!banned && !exSection && section === "resource" ? <span className="absolute inset-x-0 top-0 bg-accent/90 py-0.5 text-center text-[9px] uppercase tracking-[0.16em] text-slate-950">{tr("recurso", "resource")}</span> : null}

        <div className="absolute inset-x-0 bottom-0 bg-slate-950/90 p-1.5 text-left">
          <p className="truncate text-[11px] font-medium text-white">{cardName}</p>
        </div>
      </button>

      {!exSection ? (
        <button type="button" onClick={() => onOpenGallery(modelId)} title={tr("Ver todas as artes desta carta", "See all arts of this card")} className="absolute left-1 top-1 flex size-6 items-center justify-center rounded-full bg-slate-950/80 text-white opacity-100 transition hover:bg-primary hover:text-primary-foreground lg:opacity-0 lg:group-hover:opacity-100">
          <ImagesIcon className="size-3.5" />
        </button>
      ) : null}

      {!exSection && card.code ? (
        <div className="absolute left-1 top-8 z-10">
          <CardPlayabilityBadge
            code={card.code}
            entry={playabilityEntry}
            size="xs"
            showLabel={false}
          />
        </div>
      ) : null}

      {!exSection ? (
        <div className="absolute inset-x-1 bottom-1 flex items-center justify-between opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
          <button type="button" onClick={() => onDecrement(printId)} disabled={qtyInDeck <= 0} title={tr("Remover 1 cópia", "Remove 1 copy")} className="flex size-6 items-center justify-center rounded-full bg-slate-950/85 text-white transition hover:bg-red-500 disabled:pointer-events-none disabled:opacity-30">
            <Minus className="size-3.5" />
          </button>
          <button type="button" onClick={() => onPreview(card)} title={tr("Ver imagem grande", "View large image")} className="flex size-6 items-center justify-center rounded-full bg-slate-950/85 text-white transition hover:bg-white/20">
            <Eye className="size-3.5" />
          </button>
          <button type="button" onClick={() => onAdd(card)} disabled={atLimit} title={tr("Adicionar 1 cópia", "Add 1 copy")} className="flex size-6 items-center justify-center rounded-full bg-slate-950/85 text-white transition hover:bg-primary hover:text-primary-foreground disabled:pointer-events-none disabled:opacity-30">
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
function DeckGridTile({ row, playabilityEntry, onIncrement, onDecrement, onOpenGallery, onPreview }: { row: DeckRow; playabilityEntry?: CardStatusEntry | null; onIncrement: (card: CardRecord) => void; onDecrement: (printId: string) => void; onOpenGallery: (modelId: string) => void; onPreview: (card: CardRecord) => void }) {
  const { tr } = useSiteLanguage();
  const { isPt } = useCardLanguage();
  const cardName = getCardDisplayName(row, isPt);
  const image = row.imageMediumUrl || row.imageUrl;
  const printId = row.printId || row.id;
  const modelId = row.cardModelId || row.id;
  const isUnplayable = playabilityEntry && playabilityEntry.status !== "apta";
  return (
    <div className="group relative">
      <div
        className={`relative block aspect-[63/88] w-full overflow-hidden border transition ${
          isUnplayable
            ? "border-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.25)] group-hover:border-amber-300"
            : "border-white/15 group-hover:border-primary/50"
        }`}
      >
        {image ? <img loading="lazy" decoding="async" src={image} alt={cardName} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-slate-950/80 p-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">{cardName}</div>}
        <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{row.quantity}</span>
        <div className="absolute inset-x-0 bottom-6 bg-slate-950/90 p-1.5 text-left">
          <p className="truncate text-[11px] font-medium text-white">{cardName}</p>
        </div>
      </div>
      <button type="button" onClick={() => onOpenGallery(modelId)} title={tr("Ver todas as artes desta carta", "See all arts of this card")} className="absolute left-1 top-1 flex size-6 items-center justify-center rounded-full bg-slate-950/80 text-white opacity-100 transition hover:bg-primary hover:text-primary-foreground lg:opacity-0 lg:group-hover:opacity-100">
        <ImagesIcon className="size-3.5" />
      </button>
      {row.code ? (
        <div className="absolute left-1 top-8 z-10">
          <CardPlayabilityBadge
            code={row.code}
            entry={playabilityEntry}
            size="xs"
            showLabel={false}
          />
        </div>
      ) : null}
      <div className="absolute inset-x-1 bottom-1 flex items-center justify-between opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
        <button type="button" onClick={() => onDecrement(printId)} title={tr(`Remover 1 cópia de ${cardName}`, `Remove 1 copy of ${cardName}`)} className="flex size-6 items-center justify-center rounded-full bg-slate-950/85 text-white transition hover:bg-red-500">
          <Minus className="size-3.5" />
        </button>
        <button type="button" onClick={() => onPreview(row)} title={tr("Ver imagem grande", "View large image")} className="flex size-6 items-center justify-center rounded-full bg-slate-950/85 text-white transition hover:bg-white/20">
          <Eye className="size-3.5" />
        </button>
        <button type="button" onClick={() => onIncrement(row)} title={tr(`Adicionar mais uma cópia de ${cardName}`, `Add another copy of ${cardName}`)} className="flex size-6 items-center justify-center rounded-full bg-slate-950/85 text-white transition hover:bg-primary hover:text-primary-foreground">
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
  const { tr } = useSiteLanguage();
  const { isPt } = useCardLanguage();
  const cardName = getCardDisplayName(row, isPt);
  const image = row?.imageMediumUrl || row?.imageUrl;
  return (
    <div className="group relative">
      <div className="relative block aspect-[63/88] w-full overflow-hidden border border-white/15">
        {image ? <img loading="lazy" decoding="async" src={image} alt={cardName || label} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-slate-950/80 p-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</div>}
        <span className="absolute inset-x-0 top-0 bg-slate-700/90 py-0.5 text-center text-[9px] uppercase tracking-[0.16em] text-white">{label}</span>
        <div className="absolute inset-x-0 bottom-0 bg-slate-950/90 p-1.5 text-left">
          <p className="truncate text-[10px] font-medium text-white">{cardName || tr("Carregando…", "Loading…")}</p>
        </div>
      </div>
      <button type="button" onClick={onReset} title={tr(`Voltar ${label} pra arte padrão`, `Reset ${label} to the default art`)} className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-slate-950/80 text-[13px] text-white opacity-100 transition hover:bg-primary hover:text-primary-foreground lg:opacity-0 lg:group-hover:opacity-100">↺</button>
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
  const { tr } = useSiteLanguage();
  const { isPt } = useCardLanguage();
  const [prints, setPrints] = useState<CardRecord[] | null>(null);
  const [modelLabel, setModelLabel] = useState("");

  useEffect(() => {
    if (!modelId) { setPrints(null); return; }
    let active = true;
    setPrints(null);
    api.getCard(modelId).then((data) => {
      if (!active) return;
      setModelLabel(getCardDisplayName(data, isPt));
      const modelFields = { cardModelId: modelId, nameEn: data.nameEn, namePt: data.namePt, cardType: data.cardType, color: data.color, cost: data.cost, level: data.level, ap: data.ap, hp: data.hp, trait: data.trait, series: data.series, sourceTitle: data.sourceTitle, keywordTags: data.keywordTags, effectPt: data.effectPt, effectEn: data.effectEn };
      const mapped = (data.prints || []).map((print: any) => mapApiCard({ ...print, ...modelFields }));
      setPrints(mapped);
    }).catch(() => { if (active) setPrints([]); });
    return () => { active = false; };
  }, [modelId, isPt]);

  if (!modelId) return null;
  const limit = prints?.[0] ? getCopyLimit(modelId, prints[0].type) : 4;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-2xl lg:max-w-4xl border-white/10 bg-slate-950 text-white">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{tr("Galeria de arte", "Art gallery")}</p>
            <DialogTitle className="font-heading text-2xl uppercase heading-portal">{modelLabel || tr("Carregando…", "Loading…")}</DialogTitle>
          </div>
        </div>
        {!prints ? (
          <p className="py-8 text-center text-sm text-muted-portal">{tr("Carregando impressões...", "Loading prints...")}</p>
        ) : prints.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-portal">{tr("Não achei impressões dessa carta.", "No prints found for this card.")}</p>
        ) : (
          <div className="grid max-h-[65vh] grid-cols-2 gap-4 overflow-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
            {prints.map((print) => {
              const printId = print.printId || print.id;
              const qty = entries.filter((entry) => entry.cardId === printId).reduce((sum, entry) => sum + entry.quantity, 0);
              const image = print.imageMediumUrl || print.imageUrl;
              return (
                <div key={printId} className="border border-white/10 bg-slate-900/60 p-2.5">
                  <div className="aspect-[63/88] overflow-hidden border border-white/10 bg-slate-950/70">
                    {image ? <img loading="lazy" decoding="async" src={image} alt={getCardDisplayName(print, isPt)} className="h-full w-full object-cover" /> : null}
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
        <p className="border-t border-white/10 pt-3 text-xs text-slate-500">{tr(`Limite de ${limit === Infinity ? "cópia livre" : `${limit} cópia(s)`} somado entre todas as artes desta carta.`, `Limit of ${limit === Infinity ? "unlimited copies" : `${limit} cop${limit === 1 ? "y" : "ies"}`} across all arts of this card.`)}</p>
      </DialogContent>
    </Dialog>
  );
}

/** Preview em alta resolução com detalhes, tradução de efeito, keywords e selo de jogabilidade. */
function CardPreviewModal({ card, onClose }: { card: (CardRecord & { quantity?: number }) | null; onClose: () => void }) {
  const { tr } = useSiteLanguage();
  const { isPt } = useCardLanguage();
  const [langOverride, setLangOverride] = useState<CardLanguage | null>(null);
  if (!card) return null;
  const activeLang: CardLanguage = langOverride ?? (isPt ? "PT_BR" : "EN");
  const isEffectivePt = activeLang === "PT_BR";
  const displayName = getCardDisplayName(card, isEffectivePt);
  const secondaryName = isEffectivePt ? (card.nameEn || card.name) : (card.namePt || "");
  const image = card.imageLargeUrl || card.imageMediumUrl || card.imageUrl;
  const modelId = card.cardModelId || card.id;
  const resolvedEffect = cardText(card, undefined, activeLang);
  const keywords = Array.from(new Set([...(card.keywords || []), ...(card.triggerKeywords || [])]));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-xl max-h-[90vh] overflow-y-auto border-white/10 bg-slate-950 text-white p-5">
        <DialogTitle className="sr-only">{tr(`Carta ampliada: ${displayName}`, `Enlarged card: ${displayName}`)}</DialogTitle>
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div className="space-y-2">
            <div className="aspect-[63/88] w-full overflow-hidden border border-white/10 bg-slate-950/70">
              {image ? <img loading="lazy" decoding="async" src={image} alt={displayName} className="h-full w-full object-cover" /> : null}
            </div>
            {card.quantity !== undefined ? <p className="text-center text-xs text-slate-400">{card.quantity}x {tr("nesse deck", "in this deck")}</p> : null}
            <div className="flex justify-center">
              <a href={`/cards/${modelId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-none border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white nav-hover-soft hover:text-white">
                <ExternalLink className="size-3" />{tr("Abrir detalhe", "Open details")}
              </a>
            </div>
          </div>
          <div className="space-y-3 min-w-0">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">{card.code}</p>
                <CardInspectorPlayabilityBadge code={card.code} />
              </div>
              <h3 className="font-heading text-xl uppercase leading-tight mt-0.5">{displayName}</h3>
              {secondaryName && secondaryName !== displayName ? (
                <p className="text-xs text-slate-400">{secondaryName}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs text-slate-300">
              <span className="border border-white/10 bg-white/5 px-1.5 py-0.5">{card.color}</span>
              <span className="border border-white/10 bg-white/5 px-1.5 py-0.5">{card.type}</span>
              <span className="border border-white/10 bg-white/5 px-1.5 py-0.5">Custo: {card.cost}</span>
              {card.level !== undefined ? <span className="border border-white/10 bg-white/5 px-1.5 py-0.5">Lv: {card.level}</span> : null}
              {card.ap !== undefined ? <span className="border border-white/10 bg-white/5 px-1.5 py-0.5">AP: {card.ap}</span> : null}
              {card.hp !== undefined ? <span className="border border-white/10 bg-white/5 px-1.5 py-0.5">HP: {card.hp}</span> : null}
            </div>

            {card.trait || card.series ? (
              <p className="text-xs text-slate-400">
                {card.trait ? <span><span className="text-slate-500">Trait:</span> {card.trait} </span> : null}
                {card.series ? <span><span className="text-slate-500">{tr("Mídia:", "Media:")}</span> {card.series}</span> : null}
              </p>
            ) : null}

            {keywords.length > 0 ? (
              <div className="flex flex-wrap gap-1 border-t border-white/10 pt-2">
                {keywords.map((kw) => (
                  <KeywordTooltip key={kw} keyword={kw} showLink={false}>
                    <span className="border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{kw}</span>
                  </KeywordTooltip>
                ))}
              </div>
            ) : null}

            <div className="border-t border-white/10 pt-2 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="uppercase tracking-wider text-slate-400 font-semibold">
                  {isEffectivePt ? "Efeito" : "Effect"}
                </span>
                <div className="flex items-center gap-1.5">
                  {resolvedEffect.isPending ? (
                    <span className="text-amber-300 border border-amber-400/40 bg-amber-500/10 px-1 py-0.5">
                      {getTranslationPendingBadge(activeLang)}
                    </span>
                  ) : null}
                  <div className="inline-flex rounded-none border border-white/20 p-0.5">
                    <button
                      type="button"
                      onClick={() => setLangOverride("PT_BR")}
                      className={`px-1.5 py-0.5 transition ${activeLang === "PT_BR" ? "bg-primary font-bold text-primary-foreground" : "text-slate-400 hover:text-white"}`}
                    >
                      PT
                    </button>
                    <button
                      type="button"
                      onClick={() => setLangOverride("EN")}
                      className={`px-1.5 py-0.5 transition ${activeLang === "EN" ? "bg-primary font-bold text-primary-foreground" : "text-slate-400 hover:text-white"}`}
                    >
                      EN
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-line max-h-40 overflow-y-auto pr-1">
                {formatCardText(resolvedEffect.text || card.effect) || (isEffectivePt ? "Sem texto de efeito cadastrado." : "No effect text registered.")}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Expande cada linha do deck principal em N cópias individuais (uma por quantidade)
// pra sortear uma mão com a probabilidade real de cada carta -- é a mesma população


/** Modal de detalhe — abre a partir de qualquer estatística clicável (cor, trait,
 *  série, tipo, keyword) mostrando exatamente quais cartas do deck contribuem pra
 *  aquele número. Lista ou imagem, alternável — clicar numa carta abre o preview
 *  grande dela (reaproveita CardPreviewModal). */
// A dica curta de cada métrica agora vem do componente reutilizável e acessível
// MetricTooltip (@/components/deck/MetricTooltip) — cada número da tela tem "o que é"
// + "como ler" e um marcador data-metric, auditado por DeckbuilderPage.metrics.test.

function StatDetailModal({ title, rows, onClose, onPreviewCard }: { title: { label: string; value: string } | null; rows: DeckRow[]; onClose: () => void; onPreviewCard: (card: DeckRow) => void }) {
  const { tr } = useSiteLanguage();
  const { isPt } = useCardLanguage();
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  if (!title) return null;
  const total = rows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-2xl max-h-[85vh] overflow-y-auto border-white/10 bg-slate-950 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{title.label}</p>
            <DialogTitle className="font-heading text-2xl uppercase heading-portal">{title.value}</DialogTitle>
            <p className="mt-1 text-xs text-slate-500">{tr(`${rows.length} carta(s) única(s) · ${total} no total`, `${rows.length} unique card(s) · ${total} in total`)}</p>
          </div>
          <div className="flex border border-white/15">
            <button type="button" onClick={() => setViewMode("grid")} className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-white/5 text-soft hover:bg-white/10"}`}>{tr("Imagens", "Images")}</button>
            <button type="button" onClick={() => setViewMode("list")} className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-white/5 text-soft hover:bg-white/10"}`}>{tr("Lista", "List")}</button>
          </div>
        </div>

        {!rows.length ? <p className="py-8 text-center text-sm text-muted-portal">{tr("Nenhuma carta encontrada.", "No cards found.")}</p> : viewMode === "grid" ? (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
            {rows.map((row) => {
              const image = row.imageMediumUrl || row.imageUrl;
              const cardName = getCardDisplayName(row, isPt);
              return (
                <button key={row.printId || row.id} type="button" onClick={() => onPreviewCard(row)} className="group relative block aspect-[63/88] overflow-hidden border border-white/15 transition hover:border-primary/50">
                  {image ? <img loading="lazy" decoding="async" src={image} alt={cardName} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-slate-950/80 p-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">{cardName}</div>}
                  <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{row.quantity}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const image = row.imageMediumUrl || row.imageUrl;
              const cardName = getCardDisplayName(row, isPt);
              return (
                <button key={row.printId || row.id} type="button" onClick={() => onPreviewCard(row)} className="flex w-full items-center gap-3 border border-white/10 bg-white/5 p-2 text-left transition hover:border-primary/40 hover:bg-white/10">
                  <div className="h-14 w-10 shrink-0 overflow-hidden border border-white/10 bg-slate-950/70">{image ? <img loading="lazy" decoding="async" src={image} alt={cardName} className="h-full w-full object-cover" /> : null}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium heading-portal">{cardName}</p>
                    <p className="text-xs text-slate-500">{row.code} · {row.color}</p>
                  </div>
                  <span className="shrink-0 text-sm text-muted-portal">{row.quantity}x</span>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


export default function DeckbuilderPage() {
  const { tr } = useSiteLanguage();
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { isPt } = useCardLanguage();
  const [, params] = useRoute<{ id: string }>("/deckbuilder/:id");
  const deckId = params?.id && params.id !== "new" && params.id !== "novo" ? params.id : null;

  const [cards, setCards] = useState<CardRecord[]>([]);
  const { cards: playabilityCards, isReady: playabilityReady } = useAllCardsPlayability();
  const [filterOnlyPlayable, setFilterOnlyPlayable] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [activeTab, setActiveTab] = useState<"montar" | "estatisticas">("montar");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [altArtModelId, setAltArtModelId] = useState<string | null>(null);
  const [openingHandOpen, setOpeningHandOpen] = useState(false);
  /** ZERO SYSTEM — Assistente Copilot do Hangar OZ. */
  const [zeroCopilotOpen, setZeroCopilotOpen] = useState(false);
  const [previewCard, setPreviewCard] = useState<CardRecord | null>(null);
  const [statDetail, setStatDetail] = useState<{ label: string; value: string } | null>(null);
  const [statDetailRows, setStatDetailRows] = useState<DeckRow[]>([]);
  const [handOddsBreakdownOpen, setHandOddsBreakdownOpen] = useState(false);
  const [exportImageModalOpen, setExportImageModalOpen] = useState(false);
  const [generatingImage] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [deckName, setDeckName] = useState(() => trNow("Novo Deck", "New Deck"));
  const [entries, setEntries] = useState<DeckEntry[]>([]);
  const [visibility, setVisibility] = useState<DeckVisibility>("PUBLIC");
  const [coverImage, setCoverImage] = useState("");
  const [featuredCardIds, setFeaturedCardIds] = useState<string[]>([]);
  // Detalhes (nome + imagem) das cartas de destaque escolhidas — independente da pool
  // principal, já que a busca de destaque agora é própria (pode achar qualquer carta do
  // catálogo, não só o que está na tela). Populado ao carregar um deck existente (via
  // deck.featuredCards, já resolvido pelo back-end) ou ao escolher pela busca dedicada.
  const [, setFeaturedCardDetails] = useState<Record<string, { id: string; name: string; imageUrl: string | null }>>({});
  const [featuredQuery] = useState("");
  const [, setFeaturedResults] = useState<CardRecord[]>([]);
  const [, setFeaturedSearching] = useState(false);
  const [poolFilters, setPoolFilters] = useState<PoolFilters>(defaultPoolFilters);
  const [poolQueryDraft, setPoolQueryDraft] = useState("");
  const [poolMeta, setPoolMeta] = useState<PoolMeta>({ colors: [], cardTypes: [], series: [], traits: [], keywords: [], sets: [] });
  const [loadingPool, setLoadingPool] = useState(true);
  const [loadingDeck, setLoadingDeck] = useState(Boolean(deckId));
  const [poolPage, setPoolPage] = useState(1);
  const [poolPageSize, setPoolPageSize] = useState(24);
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
  const getSectionForCardType = (cardType?: string): "main" | "resource" => (cardType?.toUpperCase() === "RESOURCE" ? "resource" : "main");

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

  const loadCards = async (
    filters: PoolFilters = poolFilters,
    page: number = poolPage,
    onlyPlayable: boolean = filterOnlyPlayable,
  ) => {
    setLoadingPool(true);
    try {
      if (onlyPlayable && playabilityReady) {
        const result = await api.listCards({ ...filters, sort: "code_asc" });
        const allMapped = (result as any[]).map(mapApiCard);
        const filtered = allMapped.filter((card) => {
          const cardCode = card.code?.trim().toUpperCase();
          const entry = cardCode ? playabilityCards[cardCode] : null;
          return entry ? entry.status === "apta" : false;
        });
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / poolPageSize));
        const safePage = Math.min(page, totalPages);
        const start = (safePage - 1) * poolPageSize;
        const paged = filtered.slice(start, start + poolPageSize);
        setCards(paged);
        cacheCards(paged);
        setPoolTotal(total);
        setPoolTotalPages(totalPages);
      } else {
        const result = await api.listCardsPage({ ...filters, sort: "code_asc" }, { page, pageSize: poolPageSize });
        const mapped = result.items.map(mapApiCard);
        setCards(mapped);
        cacheCards(mapped);
        setPoolTotal(result.total);
        setPoolTotalPages(result.totalPages);
      }
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

  // Preenche o deck de recursos ate DECK_RESOURCE_SIZE (10) com o resource padrao --
  // roda 1 vez quando o deck termina de carregar (nao fica competindo com o jogador
  // decrementando durante a edicao). Antes so checava "existe pelo menos 1 resource"
  // e parava ali -- se o deck tivesse 7/10 espalhados em varias artes, nunca completava
  // e ficava pendente pra sempre. Agora soma o total de verdade e completa a diferenca
  // com a arte padrao, seja sendo do zero ou completando o que ja tem. Nao trava slot
  // fixo (diferente do EX Base/Resource) -- o jogador continua livre pra trocar/remover
  // qualquer resource pela pool normalmente depois.
  useEffect(() => {
    if (loadingDeck || !defaultResourceOption) return;
    setEntries((current) => {
      const resourceTotal = current.filter((item) => item.section === "resource").reduce((sum, item) => sum + item.quantity, 0);
      const missing = DECK_RESOURCE_SIZE - resourceTotal;
      if (missing <= 0) return current;
      const printId = defaultResourceOption.printId || defaultResourceOption.id;
      const existingDefaultEntry = current.find((item) => item.section === "resource" && item.cardId === printId);
      if (existingDefaultEntry) {
        return current.map((item) => (item === existingDefaultEntry ? { ...item, quantity: item.quantity + missing } : item));
      }
      return [...current, { cardId: printId, quantity: missing, section: "resource" }];
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
      toast.error(tr("Deck não encontrado.", "Deck not found."));
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
    loadCards(poolFilters, poolPage, filterOnlyPlayable).catch(() => undefined);
  }, [poolFilters, poolPage, poolPageSize, filterOnlyPlayable, playabilityReady]);

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

  // Diagnóstico de jogabilidade no simulador em tempo real (docs/agentes/prompts/A3-status-cartas.md)
  const deckPlayability = useMemo(() => {
    const unplayableMap = new Map<string, UnplayableCardSummary>();
    let totalUnplayableCopies = 0;

    for (const row of mainDeckRows) {
      const code = row.code?.trim().toUpperCase();
      if (!code) continue;
      const entry = playabilityCards[code] || null;
      const status: PlayabilityStatus = entry?.status ?? (playabilityReady ? "fora" : "apta");
      if (status !== "apta") {
        totalUnplayableCopies += row.quantity;
        const existing = unplayableMap.get(code);
        if (existing) {
          existing.count += row.quantity;
        } else {
          unplayableMap.set(code, {
            card: row,
            entry,
            count: row.quantity,
            status,
            motivo: entry?.motivo,
            missingClauses: entry?.missingClauses,
          });
        }
      }
    }

    const unplayableCards = Array.from(unplayableMap.values());
    return {
      playable: unplayableCards.length === 0,
      unplayableCards,
      totalUnplayableCopies,
      unplayableCodes: unplayableCards.map((c) => c.card.code),
    };
  }, [mainDeckRows, playabilityCards, playabilityReady]);
  const [mainViewMode, setMainViewMode] = useState<"grid" | "type">("grid");
  const [mainTileColumns, setMainTileColumns] = useState(8);
  const [mainSortField, setMainSortField] = useState<"default" | "color" | "level" | "cost" | "trait" | "name">("default");
  const sortedMainDeckRows = useMemo(() => {
    if (mainSortField === "default") return mainDeckRows;
    return [...mainDeckRows].sort((a, b) => {
      if (mainSortField === "color") return (a.color || "").localeCompare(b.color || "");
      if (mainSortField === "level") return (a.level ?? 0) - (b.level ?? 0);
      if (mainSortField === "cost") return (a.cost ?? 0) - (b.cost ?? 0);
      if (mainSortField === "trait") return (a.trait || "").localeCompare(b.trait || "");
      return getCardDisplayName(a, isPt).localeCompare(getCardDisplayName(b, isPt));
    });
  }, [mainDeckRows, mainSortField, isPt]);
  const groupedMainRows = useMemo(() => groupCardsByType(sortedMainDeckRows), [sortedMainDeckRows]);
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

  // Ponte deckbuilder -> simulador (docs/48b): aviso não-bloqueante quando uma Unit
  // com Link Condition por nome de Piloto não tem nenhuma fonte daquele Piloto no
  // deck (Piloto nativo ou Command/Pilot). Não é legalidade — é completude de deck.
  const pilotCoverageGaps = useMemo(
    () => computeDeckPilotCoverage(mainDeckRows.map((row) => ({ code: row.code, name: row.name, cardType: row.type, linkText: row.linkText, pilotName: row.pilotName, effect: row.effect }))),
    [mainDeckRows],
  );

  const stats = useMemo(() => calculateStats(cardCache, entries), [cardCache, entries]);

  const curveData = useMemo(() => {
    const map = new Map<number, number>();
    mainDeckRows.forEach((row) => map.set(row.cost, (map.get(row.cost) ?? 0) + row.quantity));
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([cost, quantity]) => ({ cost: String(cost), quantity }));
  }, [mainDeckRows]);

  // Chance de abrir com pelo menos 1 carta de custo baixo (≤2) na mão inicial de 5,
  // e a mesma conta considerando 1 mulligan (ver deck-cost-stats.ts). Espelha
  // lowLevelStats (nível baixo), só que o "sucesso" aqui é o custo, não o nível.
  const handOdds = useMemo(() => lowCostStats(mainDeckRows, stats.mainDeckCount), [mainDeckRows, stats.mainDeckCount]);

  const colorData = useMemo(() => Object.entries(stats.colorMap).map(([name, value]) => ({ name, value })), [stats.colorMap]);
  const typeData = useMemo(() => Object.entries(stats.typeMap).map(([name, quantity]) => ({ name: CARD_TYPE_OPTIONS.find((opt) => opt.value === name)?.label || name, quantity })), [stats.typeMap]);

  // AP/HP só existem em Unidades (ver CardRecord) -- por isso os histogramas abaixo
  // filtram por type === "UNIT" antes de agrupar, senão as barras ficariam poluídas
  // com pilotos/comandos que não têm esses atributos (inspirado nos histogramas
  // "AP Range"/"HP Range" do ExBurst, que fazem o mesmo recorte).
  const unitRows = useMemo(() => mainDeckRows.filter((row) => row.type === "UNIT"), [mainDeckRows]);
  const apData = useMemo(() => {
    const map = new Map<number, number>();
    unitRows.forEach((row) => { if (typeof row.ap === "number") map.set(row.ap, (map.get(row.ap) ?? 0) + row.quantity); });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([ap, quantity]) => ({ ap: String(ap), quantity }));
  }, [unitRows]);
  const hpData = useMemo(() => {
    const map = new Map<number, number>();
    unitRows.forEach((row) => { if (typeof row.hp === "number") map.set(row.hp, (map.get(row.hp) ?? 0) + row.quantity); });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([hp, quantity]) => ({ hp: String(hp), quantity }));
  }, [unitRows]);
  // Curva de nível das Units (docs/38 §5) -- espelha a Curva de custo, mas em Lv. com 6+ agrupado.
  const levelData = useMemo(() => buildLevelCurve(unitRows), [unitRows]);
  // Chance de abrir com pelo menos 1 Unit de nível baixo (Lv.1-3) -- abertura sólida no turno 1.
  const lowLevelStats = useMemo(() => lowLevelUnitStats(unitRows, stats.mainDeckCount), [unitRows, stats.mainDeckCount]);
  const topTraits = useMemo(() => Object.entries(stats.traitMap).sort((a, b) => b[1] - a[1]).slice(0, 3), [stats.traitMap]);
  const poolActiveFilters = useMemo(() => Object.values(poolFilters).filter(Boolean).length, [poolFilters]);

  const diagnostics = useMemo(() => {
    const notes: Array<{ kind: "ok" | "warn"; label: string; value: string }> = [];
    notes.push({ kind: stats.mainDeckCount > 0 ? "ok" : "warn", label: tr("Volume atual", "Card count"), value: tr(`${stats.mainDeckCount} cartas na lista`, `${stats.mainDeckCount} cards in the list`) });
    notes.push({ kind: deckRows.length >= 10 ? "ok" : "warn", label: tr("Variedade", "Variety"), value: tr(`${deckRows.length} cartas únicas`, `${deckRows.length} unique cards`) });
    notes.push({ kind: stats.cardsAtLimit > 0 ? "ok" : "warn", label: tr("Cópias no limite", "Copies at the limit"), value: tr(`${stats.cardsAtLimit} cartas em 4x`, `${stats.cardsAtLimit} cards at 4x`) });
    notes.push({ kind: stats.cardsWithKeywords > 0 ? "ok" : "warn", label: tr("Cobertura por keywords", "Keyword coverage"), value: tr(`${stats.cardsWithKeywords} cartas com keywords mapeadas`, `${stats.cardsWithKeywords} cards with mapped keywords`) });
    notes.push({ kind: topTraits.length > 0 ? "ok" : "warn", label: tr("Linha principal", "Main line"), value: topTraits[0] ? `${topTraits[0][0]} · ${topTraits[0][1]}` : tr("Sem trait dominante ainda", "No dominant trait yet") });
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

  const synergyLabel = synergyScore >= 80 ? tr("sinergia forte", "strong synergy") : synergyScore >= 55 ? tr("sinergia em formação", "synergy taking shape") : tr("base ainda dispersa", "still scattered");

  const archetypeBlocks = useMemo(() => {
    const blocks: Array<{ label: string; value: string; hint: string }> = [];
    const total = stats.mainDeckCount || 1;
    if (dominantColor) {
      const count = stats.colorMap[dominantColor] || 0;
      blocks.push({ label: tr("Cor-base", "Base color"), value: dominantColor, hint: tr(`${count}/${stats.mainDeckCount} cartas · ${Math.round((count / total) * 100)}% do deck principal.`, `${count}/${stats.mainDeckCount} cards · ${Math.round((count / total) * 100)}% of the main deck.`) });
    }
    if (dominantTrait) {
      const count = stats.traitMap[dominantTrait] || 0;
      blocks.push({ label: tr("Trait-base", "Base trait"), value: dominantTrait, hint: tr(`${count}/${stats.mainDeckCount} cartas · núcleo de identidade do deck.`, `${count}/${stats.mainDeckCount} cards · the deck's identity core.`) });
    }
    if (dominantSeries) blocks.push({ label: tr("Série-base", "Base series"), value: dominantSeries, hint: tr("Linha temática mais recorrente.", "Most recurring theme.") });
    const mainType = [...typeData].sort((a, b) => b.quantity - a.quantity)[0];
    if (mainType) blocks.push({ label: tr("Tipo-base", "Base type"), value: mainType.name, hint: tr(`${mainType.quantity}/${stats.mainDeckCount} cartas · tipo mais frequente.`, `${mainType.quantity}/${stats.mainDeckCount} cards · most common type.`) });
    return blocks;
  }, [dominantColor, dominantTrait, dominantSeries, typeData, stats.colorMap, stats.traitMap, stats.mainDeckCount]);

  // Segunda cor (deck pode ter ate 2, ver DECK_MAX_COLORS) e traits secundarios --
  // arquétipo de verdade raramente é 1 cor+1 trait só, é a combinação. archetypeBlocks
  // já mostra o dominante; isso aqui expõe o que vem depois, que estava calculado
  // (topTraits) mas nunca aparecia na tela.
  const colorBreakdown = useMemo(() => {
    const total = stats.mainDeckCount || 1;
    return [...colorData].sort((a, b) => b.value - a.value).slice(0, 3).map((item) => ({ ...item, pct: Math.round((item.value / total) * 100) }));
  }, [colorData, stats.mainDeckCount]);

  const traitBreakdown = useMemo(() => {
    const total = stats.mainDeckCount || 1;
    return topTraits.map(([name, value]) => ({ name, value, pct: Math.round((value / total) * 100) }));
  }, [topTraits, stats.mainDeckCount]);

  const seriesBreakdown = useMemo(() => {
    const total = stats.mainDeckCount || 1;
    const map = new Map<string, number>();
    mainDeckRows.forEach((row) => {
      const key = row.series || "Sem série definida";
      map.set(key, (map.get(key) || 0) + row.quantity);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, value]) => ({ name, value, pct: Math.round((value / total) * 100) }));
  }, [mainDeckRows, stats.mainDeckCount]);

  const typeBreakdown = useMemo(() => {
    const total = stats.mainDeckCount || 1;
    return [...typeData].sort((a, b) => b.quantity - a.quantity).map((item) => ({ name: item.name, value: item.quantity, pct: Math.round((item.quantity / total) * 100) }));
  }, [typeData, stats.mainDeckCount]);

  // Detalhamento por valor (ex: "2x Breach 2, 1x Breach 5") -- so pras 3 keywords de
  // efeito numericas. O valor sai reprocessando o texto do efeito no navegador mesmo
  // (nao precisa de campo novo no banco: keywordTags ja guarda so o nome, de proposito
  // -- valor especifico so importa aqui, pro detalhamento visual).
  const effectKeywordBreakdown = useMemo(() => {
    const total = stats.mainDeckCount || 1;
    return EFFECT_KEYWORD_LIST.map((name) => {
      const rows = mainDeckRows.filter((row) => row.keywords.includes(name));
      const count = rows.reduce((sum, r) => sum + r.quantity, 0);
      if (!count) return null;
      let valueBreakdown: Array<[number, number]> | null = null;
      if (NUMERIC_KEYWORDS.has(name)) {
        const valMap = new Map<number, number>();
        rows.forEach((row) => {
          const val = extractKeywordValue(row.effect, name);
          if (val !== null) valMap.set(val, (valMap.get(val) || 0) + row.quantity);
        });
        valueBreakdown = [...valMap.entries()].sort((a, b) => a[0] - b[0]);
      }
      return { name, count, pct: Math.round((count / total) * 100), valueBreakdown };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [mainDeckRows, stats.mainDeckCount]);

  const triggerKeywordBreakdown = useMemo(() => {
    const total = stats.mainDeckCount || 1;
    return TRIGGER_KEYWORD_LIST.map((name) => {
      const count = mainDeckRows.filter((row) => row.triggerKeywords?.includes(name)).reduce((sum, r) => sum + r.quantity, 0);
      return count ? { name, count, pct: Math.round((count / total) * 100) } : null;
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [mainDeckRows, stats.mainDeckCount]);

  /** Abre o modal de detalhe filtrando o deck principal pelo criterio clicado --
   *  reaproveitado por todo bloco clicavel (cor, trait, serie, tipo, keyword). */
  const openStatDetail = (label: string, value: string, matcher: (row: DeckRow) => boolean) => {
    setStatDetail({ label, value });
    setStatDetailRows(mainDeckRows.filter(matcher));
  };

  const recommendationCards = useMemo(() => {
    const existingModelIds = new Set(entries.map((entry) => cardCache[entry.cardId]?.cardModelId).filter(Boolean));
    const candidates = new Map<string, CardRecord>();
    for (const card of cards) candidates.set(card.id, card);
    for (const card of recommendationPool) candidates.set(card.id, card);

    const neededPilots = new Set<string>(
      pilotCoverageGaps.flatMap((g) => g.pilotNames.map((p) => p.toLowerCase().trim())).filter(Boolean),
    );
    const ownPilotNames = mainDeckRows
      .filter((r) => r.type === "PILOT" || r.pilotName)
      .map((r) => (r.pilotName || r.name).toLowerCase());

    return [...candidates.values()]
      .filter((card) => !existingModelIds.has(card.id))
      .map((card) => {
        let score = 0;
        const reasons: string[] = [];

        // Sinergia de Link direto de Piloto necessário
        const cardPilotTarget = (card.pilotName || card.name || "").toLowerCase();
        const matchesNeededPilot = [...neededPilots].some((wanted: string) => cardPilotTarget.includes(wanted) || wanted.includes(cardPilotTarget));
        if (matchesNeededPilot) {
          score += 15;
          reasons.push(tr("preenche bônus de Link de Unidade do seu deck", "completes a Link bonus for a Unit in your deck"));
        }

        // Sinergia de Unidade cujo Link Condition ativa com Piloto já no deck
        if (card.type === "UNIT" && card.linkText) {
          const linkWanted = (card.linkText || "").toLowerCase();
          if (ownPilotNames.some((pilot) => linkWanted.includes(pilot))) {
            score += 12;
            reasons.push(tr("ativa bônus de Link com Piloto já presente", "enables a Link bonus with a Pilot already in the deck"));
          }
        }

        if (dominantColor && card.color === dominantColor) {
          score += 4;
          reasons.push(tr(`combina com a cor-base ${dominantColor}`, `matches the base color ${dominantColor}`));
        }
        if (dominantTrait && card.trait === dominantTrait) {
          score += 5;
          reasons.push(`fortalece a trait ${dominantTrait}`);
        }
        if (dominantSeries && card.series === dominantSeries) {
          score += 3;
          reasons.push(tr(`segue a série ${dominantSeries}`, `matches the ${dominantSeries} series`));
        }
        if (card.keywords.some((keyword) => deckRows.some((row) => row.keywords.includes(keyword)))) {
          score += 3;
          reasons.push(tr("compartilha keywords já presentes", "shares keywords already in the deck"));
        }
        if (isBoardDevelopmentCard(card) && earliestPlayableTurn(card) <= LOW_COST_MAX && stats.lowCostRate < 35) {
          score += 2;
          reasons.push("ajuda a baixar a curva");
        }
        return { ...card, score, reasons };
      })
      .filter((card) => card.score > 0)
      .sort((a, b) => b.score - a.score || a.cost - b.cost)
      .slice(0, 8);
  }, [cards, recommendationPool, entries, cardCache, pilotCoverageGaps, mainDeckRows, dominantColor, dominantTrait, dominantSeries, deckRows, stats.lowCostRate]);

  const setPoolFilter = (key: keyof PoolFilters, value: string) => {
    setPoolPage(1);
    setPoolFilters((current) => ({ ...current, [key]: value }));
  };
  const resetPoolFilters = () => {
    setPoolPage(1);
    setPoolQueryDraft("");
    setPoolFilters(defaultPoolFilters);
    setFilterOnlyPlayable(false);
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
      toast.error(limit === 0 ? tr(`${getCardDisplayName(card, isPt)} está banida — não pode ser usada.`, `${getCardDisplayName(card, isPt)} is banned — it can't be used.`) : tr(`Limite de ${limit} cópia(s) de "${getCardDisplayName(card, isPt)}" já atingido.`, `Limit of ${limit} cop${limit === 1 ? "y" : "ies"} of "${getCardDisplayName(card, isPt)}" reached.`));
      return;
    }
    // Limite do deck de recursos é no TOTAL (exatamente 10), separado do limite por
    // carta (que é livre entre si) — sem isso dava pra passar de 10 sem aviso nenhum.
    if (section === "resource" && stats.resourceDeckCount >= DECK_RESOURCE_SIZE) {
      toast.error(tr(`Deck de recursos já tem ${DECK_RESOURCE_SIZE} cartas — remova uma antes de adicionar outra.`, `The resource deck already has ${DECK_RESOURCE_SIZE} cards — remove one before adding another.`));
      return;
    }
    cacheCards([card]);
    setEntries((current) => {
      const found = current.find((item) => item.cardId === printId);
      if (found) return current.map((item) => (item.cardId === printId ? { ...item, quantity: item.quantity + 1 } : item));
      return [...current, { cardId: printId, quantity: 1, section }];
    });
  };

  const zeroCopilotCards = useMemo(() => {
    return entries.map((entry) => {
      const card = cardCache[entry.cardId];
      return {
        cardCode: card?.code || entry.cardId,
        quantity: entry.quantity,
        cost: card?.cost,
        level: card?.level,
        cardType: card?.type,
        isPilot: card?.type === "Pilot" || Boolean(card?.pilotName),
        color: card?.color,
        name: getCardDisplayName(card, isPt) || card?.name || "",
        effect: card?.effect,
        imageUrl: card?.imageUrl,
      };
    });
  }, [entries, cardCache, isPt]);

  const handleZeroCopilotAdd = async (cardCode: string) => {
    const foundInCache = Object.values(cardCache).find((c) => c.code === cardCode);
    if (foundInCache) {
      increment(foundInCache);
      toast.success(tr(`+1 cópia de ${getCardDisplayName(foundInCache, isPt)} adicionada ao deck.`, `+1 copy of ${getCardDisplayName(foundInCache, isPt)} added to the deck.`));
      return;
    }
    try {
      const results = await api.listCards({ q: cardCode });
      const found = (results as any[]).find((c: any) => c.code === cardCode) || results[0];
      if (found) {
        const record = mapApiCard(found);
        cacheCards([record]);
        increment(record);
        toast.success(tr(`+1 cópia de ${getCardDisplayName(record, isPt)} adicionada ao deck.`, `+1 copy of ${getCardDisplayName(record, isPt)} added to the deck.`));
      } else {
        toast.error(tr(`Carta ${cardCode} não encontrada no arsenal.`, `Card ${cardCode} not found.`));
      }
    } catch {
      toast.error(tr(`Falha ao buscar carta ${cardCode}.`, `Couldn't fetch card ${cardCode}.`));
    }
  };

  const handleZeroCopilotInspect = async (cardCode: string) => {
    const foundInCache = Object.values(cardCache).find((c) => c.code === cardCode);
    if (foundInCache) {
      setPreviewCard(foundInCache);
      return;
    }
    try {
      const results = await api.listCards({ q: cardCode });
      const found = (results as any[]).find((c: any) => c.code === cardCode) || results[0];
      if (found) {
        const record = mapApiCard(found);
        cacheCards([record]);
        setPreviewCard(record);
      }
    } catch {
      /* silencia */
    }
  };

  // Resource sempre soma 10 de verdade, em tempo real. Decrementar uma arte que NAO
  // e a padrao compensa aumentando a padrao na hora (voce troca uma copia por outra,
  // o total nunca cai). Decrementar a PROPRIA arte padrao NAO se autocura de proposito
  // -- senao voce nunca conseguiria abrir espaco pra trocar por uma arte nova (o
  // increment ja trava em 10, entao abrir espaco decrementando o padrao e o unico
  // jeito de entrar uma arte diferente). Usa o total real (nao so +1), entao mesmo se
  // o padrao tiver sido reduzido antes, o proximo decremento de outra arte completa
  // a diferenca toda de uma vez, nao so 1.
  const decrement = (printId: string) => {
    setEntries((current) => {
      const target = current.find((item) => item.cardId === printId);
      let next = current.map((item) => (item.cardId === printId ? { ...item, quantity: item.quantity - 1 } : item)).filter((item) => item.quantity > 0);

      if (target?.section === "resource" && defaultResourceOption) {
        const defaultPrintId = defaultResourceOption.printId || defaultResourceOption.id;
        if (printId !== defaultPrintId) {
          const resourceTotal = next.filter((item) => item.section === "resource").reduce((sum, item) => sum + item.quantity, 0);
          const missing = DECK_RESOURCE_SIZE - resourceTotal;
          if (missing > 0) {
            const existingDefault = next.find((item) => item.section === "resource" && item.cardId === defaultPrintId);
            next = existingDefault
              ? next.map((item) => (item === existingDefault ? { ...item, quantity: item.quantity + missing } : item))
              : [...next, { cardId: defaultPrintId, quantity: missing, section: "resource" }];
          }
        }
      }
      return next;
    });
  };

  const handleSaveClick = () => {
    if (!isAuthenticated) {
      // Salva rascunho em localStorage para visitantes
      const draft = {
        deckName,
        visibility,
        coverImage,
        featuredCardIds,
        entries,
      };
      localStorage.setItem(DECKBUILDER_DRAFT_KEY, JSON.stringify(draft));
      setAuthModalOpen(true);
      return;
    }
    setSaveModalOpen(true);
  };

  const executeSaveDeck = async () => {
    const payload = {
      name: deckName,
      format: "constructed",
      visibility,
      isPrimary,
      coverImage: coverImage || null,
      featuredCardIds: featuredCardIds.slice(0, 2),
      items: entries.map((item) => ({ cardId: item.cardId, quantity: item.quantity, section: item.section || "main" })),
    };

    try {
      if (selectedDeckId) {
        const updated = await api.updateMyDeck(selectedDeckId, payload);
        setSelectedShareId(updated.shareId);
      } else {
        const created = await api.createMyDeck(payload);
        setSelectedDeckId(created.id);
        setSelectedShareId(created.shareId);
        navigate(`/deckbuilder/${created.id}`, { replace: true });
      }
      setSaveModalOpen(false);
      localStorage.removeItem(DECKBUILDER_DRAFT_KEY);
      toast.success(
        visibility === "PUBLIC"
          ? tr("Deck salvo e publicado!", "Deck saved and published!")
          : tr("Deck salvo com sucesso como projeto privado!", "Deck saved as a private deck!")
      );
    } catch (err: any) {
      toast.error(err?.message || tr("Erro ao salvar deck no servidor.", "Couldn't save the deck."));
    }
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
      if (!isAuthenticated) {
        toast.error(tr("Para gerar um link permanente, entre na sua conta e salve o deck.", "To get a permanent link, sign in and save the deck."));
        setAuthModalOpen(true);
      } else {
        toast.error(tr("Salve o deck primeiro para gerar o link permanente.", "Save the deck first to get the permanent link."));
        setSaveModalOpen(true);
      }
      return;
    }
    const url = `${window.location.origin}/deck/${selectedShareId}`;
    await navigator.clipboard.writeText(url);
    toast.success(tr("Link permanente de compartilhamento copiado.", "Permanent share link copied."));
  };

  const copyDecklist = async () => {
    if (!deckRows.length) {
      toast.error(tr("Monte pelo menos uma carta para copiar a decklist.", "Add at least one card to copy the decklist."));
      return;
    }
    const mainText = mainDeckRows.map((row) => `${row.quantity}x ${row.code} - ${getCardDisplayName(row, isPt)}`).join("\n");
    const resourceText = resourceDeckRows.map((row) => `${row.quantity}x ${row.code} - ${getCardDisplayName(row, isPt)}`).join("\n");
    const text = [tr(`Deck principal (${stats.mainDeckCount}/${DECK_MAIN_SIZE}):`, `Main deck (${stats.mainDeckCount}/${DECK_MAIN_SIZE}):`), mainText || tr("(vazio)", "(empty)"), "", tr(`Deck de recursos (${stats.resourceDeckCount}/${DECK_RESOURCE_SIZE}):`, `Resource deck (${stats.resourceDeckCount}/${DECK_RESOURCE_SIZE}):`), resourceText || tr("(vazio)", "(empty)")].join("\n");
    await navigator.clipboard.writeText(text);
    toast.success(tr("Decklist copiada em texto.", "Decklist copied as text."));
  };

  /** Formato Exburst/MSA (Mobile Suit Arena) — "4x CODE" por linha */
  const copyDecklistMSA = async () => {
    if (!mainDeckRows.length && !resourceDeckRows.length) {
      toast.error(tr("Monte pelo menos uma carta para copiar a decklist.", "Add at least one card to copy the decklist."));
      return;
    }
    const lines = [...mainDeckRows, ...resourceDeckRows].map((row) => `${row.quantity}x ${row.code}`);
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success(tr("Decklist copiada no formato MSA/Exburst.", "Decklist copied in MSA/Exburst format."));
  };

  /** Formato Wing Table */
  const copyDecklistWingTable = async () => {
    if (!mainDeckRows.length && !resourceDeckRows.length) {
      toast.error(tr("Monte pelo menos uma carta para copiar a decklist.", "Add at least one card to copy the decklist."));
      return;
    }
    const lines: string[] = ["// Main Deck"];
    for (const row of mainDeckRows) {
      lines.push(`${row.quantity}x ${row.code}`);
    }
    if (resourceDeckRows.length > 0) {
      lines.push("", "// Resource Deck");
      for (const row of resourceDeckRows) {
        lines.push(`${row.quantity}x ${row.code}`);
      }
    }
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success(tr("Decklist copiada no formato Wing Table.", "Decklist copied in Wing Table format."));
  };

  /** Importa uma decklist colada em texto */
  const importDecklistText = async (text: string) => {
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    const parsed = lines.map((line) => {
      // Ignora comentários de seção como // Main Deck ou # Resource Deck
      if (line.startsWith("//") || line.startsWith("#")) return null;
      const match = line.match(/^(\d+)\s*x?\s+(\S+)$/i) || line.match(/^(\S+)$/);
      if (!match) return null;
      if (match.length === 3) return { quantity: Number(match[1]) || 1, code: match[2].toUpperCase() };
      return { quantity: 1, code: match[1].toUpperCase() };
    }).filter(Boolean) as Array<{ quantity: number; code: string }>;

    if (!parsed.length) { toast.error(tr("Não consegui reconhecer nenhuma linha nesse texto.", "Couldn't recognize any line in that text.")); return; }

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
        const isResource =
          card.type?.toUpperCase() === "RESOURCE" ||
          (card as any).cardType?.toUpperCase() === "RESOURCE" ||
          card.code?.toUpperCase().startsWith("RESOURCE-") ||
          card.code?.toUpperCase().startsWith("RES-");
        return { cardId: card.printId || card.id, quantity: r.quantity, section: isResource ? "resource" : "main" };
      });

      setEntries((current) => [...current.filter((e) => e.section === "ex_base" || e.section === "ex_resource"), ...newEntries]);
      setImportModalOpen(false);
      setImportText("");

      if (missing.length) {
        toast.warning(tr(`${found.length} carta(s) importada(s). ${missing.length} código(s) não encontrado(s): ${missing.map((m) => m.code).join(", ")}`, `${found.length} card(s) imported. ${missing.length} code(s) not found: ${missing.map((m) => m.code).join(", ")}`));
      } else {
        toast.success(tr(`${found.length} carta(s) importada(s) com sucesso.`, `${found.length} card(s) imported.`));
      }
    } finally {
      setImporting(false);
    }
  };

  // Leitura automática de ?lista= na URL (ex: /deckbuilder/novo?lista=GD01-001:4,ST01-010:3)
  const [urlListImported, setUrlListImported] = useState(false);
  useEffect(() => {
    if (deckId || urlListImported) return;
    const searchPart = window.location.hash.includes("?")
      ? window.location.hash.substring(window.location.hash.indexOf("?"))
      : window.location.search;
    const sp = new URLSearchParams(searchPart);
    const listaParam = sp.get("lista");
    if (!listaParam) return;

    setUrlListImported(true);
    // Converte formato "GD01-001:4,ST01-010:3" em linhas de texto
    const lines = listaParam
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const parts = item.split(":");
        if (parts.length === 2) {
          const code = parts[0].trim();
          const qty = Number(parts[1]) || 1;
          return `${qty} ${code}`;
        }
        return item;
      })
      .join("\n");

    if (lines) {
      importDecklistText(lines).then(() => {
        setDeckName(tr("Deck Importado de Torneio", "Deck Imported from Tournament"));
      });
    }
  }, [deckId, urlListImported]);

  // Rascunho gravado por "Copiar deck", "Montar núcleo", "Carregar" (lista de torneio) ou pelo visitante que tentou
  // salvar sem conta. Antes ninguém lia esse rascunho e o deckbuilder abria vazio. Lido uma vez e apagado.
  const draftReadRef = useRef(false);
  useEffect(() => {
    if (deckId || draftReadRef.current) return;
    draftReadRef.current = true;
    if (new URLSearchParams(window.location.search).get("lista")) return;
    let draft: DeckbuilderDraft | null = null;
    try {
      draft = parseDeckbuilderDraft(localStorage.getItem(DECKBUILDER_DRAFT_KEY));
      localStorage.removeItem(DECKBUILDER_DRAFT_KEY);
    } catch {
      draft = null;
    }
    if (draft) applyDraft(draft).catch(() => undefined);
  }, [deckId]);

  const applyDraft = async (draft: DeckbuilderDraft) => {
    setLoadingDeck(true);
    try {
      const ids = [...new Set(draft.entries.map((entry) => entry.cardId))];
      const fetched = await Promise.all(ids.map((id) => api.getCardPrint(id).then(mapApiCard).catch(() => null)));
      const byId = new Map<string, CardRecord>();
      ids.forEach((id, i) => {
        const card = fetched[i];
        if (card) byId.set(id, card);
      });
      cacheCards([...byId.values()]);

      // id de modelo vira a impressão devolvida; Resource que veio como "main" (núcleo) vai para o deck de recursos
      const merged = new Map<string, DeckEntry>();
      for (const entry of draft.entries) {
        const card = byId.get(entry.cardId);
        if (!card) continue;
        const section = entry.section === "main" ? getSectionForCardType(card.type) : entry.section;
        const printId = card.printId || card.id;
        const key = `${section}:${printId}`;
        const current = merged.get(key);
        merged.set(key, { cardId: printId, section, quantity: (current?.quantity ?? 0) + entry.quantity });
      }

      if (draft.deckName) setDeckName(draft.deckName);
      setVisibility(draft.visibility);
      if (draft.coverImage) setCoverImage(draft.coverImage);
      if (draft.featuredCardIds.length) setFeaturedCardIds(draft.featuredCardIds);
      setEntries([...merged.values()]);

      const missing = ids.length - byId.size;
      if (missing) {
        toast.warning(tr(`Deck carregado, mas ${missing} carta(s) não foram encontradas.`, `Deck loaded, but ${missing} card(s) were not found.`));
      }
    } finally {
      setLoadingDeck(false);
    }
  };

  /** Modal de Exportação de Imagem com Prévia Reativa e Toggles (Exburst style) */
  const generateDeckImage = () => {
    if (!mainDeckRows.length && !resourceDeckRows.length) {
      toast.error(tr("Monte pelo menos uma carta para gerar a imagem.", "Add at least one card to generate the image."));
      return;
    }
    setExportImageModalOpen(true);
  };

  return (
    <PublicShell breadcrumbs={[{ label: "Decks", href: "/decks" }, { label: "Deckbuilder", href: "/deckbuilder" }, { label: deckId ? deckName || tr("Editando", "Editing") : tr("Novo projeto", "New deck") }]}>
      {loadingDeck ? (
        <p className="text-sm text-muted-portal">{tr("Carregando deck...", "Loading deck...")}</p>
      ) : (
      <div className="space-y-6">
        {/* Barra compacta — nome, visibilidade traduzida, status de validade e ações */}
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                className="field-shell font-heading text-xl uppercase heading-portal sm:max-w-xs"
                placeholder={tr("Nome do Deck", "Deck Name")}
              />

              {/* Seletor visual e intuitivo de visibilidade (Traduzido) */}
              <div className="flex items-center gap-1 bg-slate-900/80 p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => setVisibility("PUBLIC")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider transition ${
                    visibility === "PUBLIC"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title={tr("Público: visível para toda a comunidade", "Public: visible to the whole community")}
                >
                  <Globe className="size-3.5" />
                  {tr("Público", "Public")}
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility("PRIVATE")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider transition ${
                    visibility === "PRIVATE"
                      ? "bg-slate-700/60 text-slate-200 border border-white/20 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title={tr("Privado: visível só para você", "Private: only you can see it")}
                >
                  <Lock className="size-3.5" />
                  {tr("Privado", "Private")}
                </button>
              </div>

              <div className={`inline-flex items-center gap-2 rounded-none border px-3 py-1.5 text-xs uppercase tracking-[0.14em] ${liveLegality.valid ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-amber-400/30 bg-amber-400/10 text-amber-300"}`} title={liveLegality.issues.map((i) => i.message).join(" · ")}>
                <span className={`inline-flex size-2 rounded-full ${liveLegality.valid ? "bg-emerald-400" : "bg-amber-400"}`} />
                {liveLegality.valid ? tr("Válido", "Valid") : tr(`${liveLegality.issues.length} pendência(s)`, `${liveLegality.issues.length} issue(s)`)} · {stats.mainDeckCount}/{DECK_MAIN_SIZE} · {stats.resourceDeckCount}/{DECK_RESOURCE_SIZE}
              </div>

              <DeckSimulatorPill
                isPlayable={deckPlayability.playable}
                unplayableCount={deckPlayability.unplayableCards.length}
                unplayableCodes={deckPlayability.unplayableCodes}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 font-heading uppercase tracking-wider text-xs px-4 h-9 shadow-md shadow-primary/20"
                onClick={handleSaveClick}
                title={tr("Salvar deck", "Save deck")}
              >
                <Save className="mr-1.5 size-4" />
                {tr("Salvar Deck", "Save Deck")}
              </Button>

              {/* ZERO COPILOT — Assistente IA (docs/54, docs/55) */}
              <Button
                data-testid="zero-copilot-btn"
                className="rounded-none border border-cyan-500/50 bg-cyan-950/70 text-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-200 font-heading uppercase tracking-wider text-xs px-3.5 h-9 shadow-md shadow-cyan-500/20 transition-all"
                onClick={() => setZeroCopilotOpen(true)}
                title={tr("Abrir o assistente de IA — sugestões de consistência e cartas", "Open the AI assistant — consistency and card suggestions")}
              >
                <BrainCircuit className="mr-1.5 size-4 text-cyan-400" />
                {tr("Assistente IA", "AI Assistant")}
                <span className="ml-1.5 rounded-none bg-cyan-500/30 px-1 py-0.2 text-[9px] font-mono font-bold text-cyan-200 border border-cyan-400/40">
                  IA
                </span>
              </Button>

              <Tooltip><TooltipTrigger asChild>
                <Button size="icon" variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white size-9" onClick={copyShareLink}><Share2 className="size-4" /></Button>
              </TooltipTrigger><TooltipContent>{tr("Compartilhar Link", "Share Link")}</TooltipContent></Tooltip>

              <Tooltip><TooltipTrigger asChild>
                <Button size="icon" variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white size-9" onClick={() => setImportModalOpen(true)}><Download className="size-4" /></Button>
              </TooltipTrigger><TooltipContent>{tr("Importar Lista (Texto)", "Import List (Text)")}</TooltipContent></Tooltip>

              <DropdownMenu>
                <Tooltip><TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white size-9"><Upload className="size-4" /></Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger><TooltipContent>{tr("Exportar", "Export")}</TooltipContent></Tooltip>
                <DropdownMenuContent align="end" className="rounded-none border-white/10 bg-slate-950 text-white min-w-[220px]">
                  <DropdownMenuItem onClick={copyDecklist} className="cursor-pointer focus:bg-white/10 focus:text-white text-xs">
                    Copiar decklist (texto simples)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={copyDecklistMSA} className="cursor-pointer focus:bg-white/10 focus:text-white text-xs">
                    {tr("Copiar formato MSA / Exburst", "Copy MSA / Exburst format")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={copyDecklistWingTable} className="cursor-pointer focus:bg-white/10 focus:text-white text-xs">
                    {tr("Copiar formato Wing Table", "Copy Wing Table format")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={generateDeckImage} disabled={generatingImage} className="cursor-pointer focus:bg-white/10 focus:text-white text-xs font-semibold text-primary">
                    {generatingImage ? tr("Gerando imagem...", "Generating image...") : tr("Baixar imagem do deck (PNG)", "Download deck image (PNG)")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {/* Abas — Montar é o padrão (pool + decklist), Estatísticas junta diagnóstico/arquétipo/recomendações/gráficos */}
        <div className="flex gap-2 border-b border-white/10">
          {([["montar", tr("Montar", "Build")], ["estatisticas", tr("Estatísticas", "Stats")]] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)} className={`border-b-2 px-4 py-2.5 text-sm uppercase tracking-[0.18em] transition ${activeTab === key ? "border-primary text-white" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === "montar" ? (
        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr] 2xl:grid-cols-[1fr_1fr] 3xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="panel-cut rounded-none surface-panel">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Deckbuilder</p>
                <h2 className="mt-2 font-heading text-4xl uppercase">{tr("Escolha as cartas", "Pick your cards")}</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-soft">{tr("Filtre por cor, tipo, série e trait e clique na carta para adicionar ao deck.", "Filter by color, type, series and trait and click a card to add it to the deck.")}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <Input value={poolQueryDraft} onChange={(e) => setPoolQueryDraft(e.target.value)} placeholder={tr("Nome, código, série ou trait", "Name, code, series or trait")} className="field-shell xl:col-span-2" />
              <MultiSelectFilter label={tr("Cores", "Colors")} options={poolMeta.colors} value={poolFilters.color ?? ""} onChange={(v) => setPoolFilter("color", v)} />
              <select value={poolFilters.cardType} onChange={(e) => setPoolFilter("cardType", e.target.value)} className="field-shell h-10 px-3 text-sm"><option value="">{tr("Todos os tipos", "All types")}</option>{poolMeta.cardTypes.map((item) => <option key={item} value={item}>{CARD_TYPE_OPTIONS.find((opt) => opt.value === item)?.label || item}</option>)}</select>
              <select value={poolFilters.series} onChange={(e) => setPoolFilter("series", e.target.value)} className="field-shell h-10 px-3 text-sm"><option value="">{tr("Todas as séries", "All series")}</option>{poolMeta.series.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <MultiSelectFilter label="Traits" options={poolMeta.traits} value={poolFilters.trait ?? ""} onChange={(v) => setPoolFilter("trait", v)} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{poolTotal} {tr("cartas encontradas", "cards found")}</Badge>
              <Badge variant="outline" className="rounded-none border-white/20 text-soft">{poolActiveFilters} {tr("filtros ativos", "active filters")}</Badge>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const next = !filterOnlyPlayable;
                  setFilterOnlyPlayable(next);
                  setPoolPage(1);
                  loadCards(poolFilters, 1, next);
                }}
                className={`rounded-none border text-xs uppercase tracking-wider transition ${
                  filterOnlyPlayable
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                    : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
                title={tr("Filtrar pool para exibir apenas cartas 100% aptas para jogar no simulador", "Show only cards fully ready for the simulator")}
              >
                <CheckCircle2 className={`mr-1.5 size-3.5 ${filterOnlyPlayable ? "text-emerald-400" : "text-slate-400"}`} />
                {filterOnlyPlayable ? tr("Só aptas no simulador", "Simulator-ready only") : tr("Todas as cartas", "All cards")}
              </Button>
              <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={resetPoolFilters}>{tr("Limpar filtros", "Clear filters")}</Button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 4xl:grid-cols-9">
              {loadingPool ? <p className="col-span-full text-sm text-muted-portal">{tr("Carregando pool filtrada...", "Loading cards...")}</p> : null}
              {!loadingPool && !cards.length ? <p className="col-span-full text-sm text-muted-portal">{tr("Nenhuma carta encontrada nessa combinação de filtros.", "No cards match these filters.")}</p> : null}
              {cards.map((card) => {
                const qtyInDeck = entries.filter((entry) => (cardCache[entry.cardId]?.cardModelId || entry.cardId) === card.id).reduce((sum, entry) => sum + entry.quantity, 0);
                const limit = getCopyLimit(card.id, card.type);
                const section = getSectionForCardType(card.type);
                return (
                  <PoolCardTile
                    key={card.id}
                    card={card}
                    qtyInDeck={qtyInDeck}
                    limit={limit}
                    section={section}
                    playabilityEntry={playabilityCards[card.code?.trim().toUpperCase()] || null}
                    onAdd={increment}
                    onDecrement={decrement}
                    onOpenGallery={setAltArtModelId}
                    onSwapExComponent={setExComponentArt}
                    onPreview={setPreviewCard}
                  />
                );
              })}
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{tr(`Página ${poolPage} de ${poolTotalPages} · exibindo ${cards.length} de ${poolTotal} resultados`, `Page ${poolPage} of ${poolTotalPages} · showing ${cards.length} of ${poolTotal} results`)}</p>
              <div className="flex flex-wrap items-center gap-2">
                <select value={poolPageSize} onChange={(e) => { setPoolPageSize(Number(e.target.value)); setPoolPage(1); }} className="field-shell h-9 px-2 text-xs" title={tr("Cartas por página", "Cards per page")}>
                  {[12, 24, 48, 96].map((n) => <option key={n} value={n}>{n}/{tr("página", "page")}</option>)}
                </select>
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
                <h3 className="font-heading text-3xl uppercase heading-portal">{tr("Deck principal", "Main deck")}</h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <ImagesIcon className="size-3.5 text-slate-500" />
                    <input type="range" min={4} max={10} value={14 - mainTileColumns} onChange={(e) => setMainTileColumns(14 - Number(e.target.value))} className="w-20 accent-primary" title={tr("Tamanho das imagens", "Image size")} />
                  </div>
                  <select value={mainSortField} onChange={(e) => setMainSortField(e.target.value as typeof mainSortField)} className="field-shell h-9 px-2 text-xs" title={tr("Ordenar por", "Sort by")}>
                    <option value="default">{tr("Ordem de adição", "Order added")}</option>
                    <option value="color">{tr("Cor", "Color")}</option>
                    <option value="level">Nível</option>
                    <option value="cost">{tr("Custo", "Cost")}</option>
                    <option value="trait">Trait</option>
                    <option value="name">{tr("Nome", "Name")}</option>
                  </select>
                  <div className="flex border border-white/15">
                    <button type="button" onClick={() => setMainViewMode("grid")} className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition ${mainViewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-white/5 text-soft hover:bg-white/10"}`}>{tr("Grade única", "Single grid")}</button>
                    <button type="button" onClick={() => setMainViewMode("type")} disabled={mainSortField !== "default"} title={mainSortField !== "default" ? tr("Desative a ordenação (\"Ordem de adição\") pra usar agrupamento por tipo", "Turn off sorting (\"Order added\") to group by type") : undefined} className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-40 ${mainViewMode === "type" ? "bg-primary text-primary-foreground" : "bg-white/5 text-soft hover:bg-white/10"}`}>{tr("Por tipo", "By type")}</button>
                  </div>
                  <Badge className={`rounded-none border ${stats.mainDeckCount === DECK_MAIN_SIZE ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-amber-400/40 bg-amber-400/10 text-amber-300"}`}>{stats.mainDeckCount}/{DECK_MAIN_SIZE}</Badge>
                </div>
              </div>
              <div className="mt-6 max-h-[440px] overflow-auto pr-1">
                {!mainDeckRows.length ? <p className="text-sm text-muted-portal">{tr("Seu deck principal ainda está vazio. Use a pool filtrada à esquerda para começar.", "Your main deck is still empty. Use the card list on the left to start.")}</p> : mainViewMode === "grid" || mainSortField !== "default" ? (
                  <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${mainTileColumns}, minmax(0, 1fr))` }}>
                    {sortedMainDeckRows.map((row) => <DeckGridTile key={row.printId || row.id} row={row} playabilityEntry={playabilityCards[row.code?.trim().toUpperCase()] || null} onIncrement={increment} onDecrement={decrement} onOpenGallery={setAltArtModelId} onPreview={setPreviewCard} />)}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {groupedMainRows.map((group) => (
                      <div key={group.type}>
                        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">{group.label} · {group.rows.reduce((sum, r) => sum + r.quantity, 0)}</p>
                        <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${mainTileColumns}, minmax(0, 1fr))` }}>
                          {group.rows.map((row) => <DeckGridTile key={row.printId || row.id} row={row} playabilityEntry={playabilityCards[row.code?.trim().toUpperCase()] || null} onIncrement={increment} onDecrement={decrement} onOpenGallery={setAltArtModelId} onPreview={setPreviewCard} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <DeckSimulatorNotice
                unplayableCards={deckPlayability.unplayableCards}
                totalUnplayableCopies={deckPlayability.totalUnplayableCopies}
                mainDeckCount={stats.mainDeckCount}
                expectedDeckSize={DECK_MAIN_SIZE}
              />
              {/* Atalho montar → jogar: só para deck salvo, completo e todo apto no simulador. O Treino usa a versão SALVA. */}
              {deckId && deckPlayability.playable && stats.mainDeckCount === DECK_MAIN_SIZE && stats.resourceDeckCount === DECK_RESOURCE_SIZE ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full rounded-none border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10"
                  onClick={() => navigate(`/simulador/treino?deck=${encodeURIComponent(deckId)}`)}
                >
                  <Swords className="mr-2 size-4" aria-hidden />
                  {tr("Treinar com este deck (versão salva)", "Practice with this deck (saved version)")}
                </Button>
              ) : null}
              {pilotCoverageGaps.length ? (
                <div className="mt-4 border border-amber-400/30 bg-amber-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-amber-300">{tr("Cobertura de Piloto de Link", "Link Pilot Coverage")} · {pilotCoverageGaps.length}</p>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-200/90">
                    {pilotCoverageGaps.map((gap) => (
                      <li key={gap.unitCode}>⚠️ {gap.message}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs leading-5 text-amber-200/60">{tr("Não bloqueia o deck — só marca Units que nunca formariam Link porque o Piloto nomeado não está na lista (nem como Piloto, nem como Comando/Piloto).", "Doesn't block the deck — it only flags Units that could never Link because the named Pilot isn't in the list (as a Pilot or a Command/Pilot).")}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-heading text-3xl uppercase heading-portal">{tr("Deck de recursos", "Resource deck")}</h3>
                <Badge className={`rounded-none border ${stats.resourceDeckCount === DECK_RESOURCE_SIZE ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-amber-400/40 bg-amber-400/10 text-amber-300"}`}>{stats.resourceDeckCount}/{DECK_RESOURCE_SIZE}</Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{tr("Só cartas do tipo Resource entram aqui — sem limite de cópia entre si.", "Only Resource cards go here — no copy limit between them.")}</p>
              <div className="mt-4 grid grid-cols-4 gap-2.5 sm:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-9 3xl:grid-cols-10 4xl:grid-cols-12 max-h-[400px] overflow-auto pr-1">
                {resourceDeckRows.length ? resourceDeckRows.map((row) => <DeckGridTile key={row.printId || row.id} row={row} playabilityEntry={playabilityCards[row.code?.trim().toUpperCase()] || null} onIncrement={increment} onDecrement={decrement} onOpenGallery={setAltArtModelId} onPreview={setPreviewCard} />) : <p className="col-span-full text-sm text-muted-portal">Nenhuma carta de recurso adicionada ainda — filtre por tipo "Resource" na pool.</p>}
              </div>
            </CardContent>
          </Card>

          {/* EX Base / EX Resource — sempre presentes, arte trocável clicando na carta na
              pool (busque "ex base"/"ex resource" — desbloqueada, marcada tr("carta única", "unique card")).
              Fica acima da capa editorial: é parte do deck de verdade, a capa é cosmética. */}
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">EX Base / EX Resource</p>
              <p className="mt-1 text-xs leading-5 text-muted-portal">{tr("Sempre inclusos, arte padrão por padrão. Pra trocar, busque \"ex base\" ou \"ex resource\" na pool e clique na arte desejada.", "Always included, with the default art. To change it, search \"ex base\" or \"ex resource\" in the card list and click the art you want.")}</p>
              <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
                <ExComponentTile label="EX Base" row={exBaseRow} onReset={() => resetExComponent("ex_base")} />
                <ExComponentTile label="EX Resource" row={exResourceRow} onReset={() => resetExComponent("ex_resource")} />
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
        ) : !isAuthenticated ? (
          <Card className="panel-cut rounded-none border border-amber-500/40 bg-slate-950/90 text-white p-8 sm:p-14 text-center relative overflow-hidden my-6">
            <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-20" />
            <div className="max-w-xl mx-auto space-y-4 relative z-10">
              <div className="size-16 rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 shadow-xl shadow-amber-500/10">
                <Lock className="size-8" />
              </div>
              <Badge variant="outline" className="rounded-none border-amber-500/50 bg-amber-950/40 text-amber-400 uppercase font-mono text-xs px-3 py-1">
                {tr("ESTATÍSTICAS COMPLETAS", "FULL STATS")}
              </Badge>
              <h2 className="font-heading text-2xl sm:text-3xl uppercase tracking-wider text-white">
                {tr("Disponível com conta gratuita", "Available with a free account")}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed font-sans">
                {tr("A análise completa — com análise avançada de curva de custos e níveis, distribuição hipergeométrica de probabilidade de mão inicial, índice de docking sinérgico de pilotos e recomendações inteligentes de metagame — está disponível exclusivamente para Pilotos Cadastrados da OZ.", "The full analysis — advanced cost and level curves, hypergeometric opening hand odds, pilot pairing synergy and metagame recommendations — is available to registered players.")}
              </p>
              <div className="p-3 border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 text-xs font-mono">
                ✓ O rascunho do seu deck atual está salvo localmente e será mantido intacto após entrar.
              </div>
              <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
                <Button
                  size="lg"
                  onClick={() => {
                    localStorage.setItem(DECKBUILDER_DRAFT_KEY, JSON.stringify({ deckName, visibility, entries }));
                    navigate("/login");
                  }}
                  className="rounded-none bg-primary text-primary-foreground font-heading uppercase tracking-wider text-sm px-6 shadow-lg shadow-primary/20"
                >
                  {tr("Criar conta e ver as estatísticas", "Create an account and see the stats")}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    localStorage.setItem(DECKBUILDER_DRAFT_KEY, JSON.stringify({ deckName, visibility, entries }));
                    navigate("/login");
                  }}
                  className="rounded-none border-white/20 font-heading uppercase tracking-wider text-sm px-6"
                >
                  {tr("Fazer Login", "Sign In")}
                </Button>
              </div>
            </div>
          </Card>
        ) : (
        <div className="space-y-6">
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Diagnóstico do deck", "Deck check")}</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Calibração Técnica da Lista", "List Calibration")}<MetricTooltip metric="leitura-rapida" what={tr("Cinco checagens rápidas da lista: volume de cartas, variedade, cópias no limite (4x), cobertura por keywords e linha principal (trait dominante).", "Five quick checks on the list: card count, variety, copies at the limit (4x), keyword coverage and main line (dominant trait).")} howToRead={tr("Borda azul = ok, borda âmbar = vale revisar. É diagnóstico, não bloqueia o deck de ser legal.", "Blue border = ok, amber border = worth a look. It's a check, it doesn't make the deck illegal.")} /></h3>
                </div>
                <div className="panel-cut border border-primary/30 bg-primary/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-portal">{tr("Sinergia estimada", "Estimated synergy")}<MetricTooltip metric="sinergia-estimada" what={tr("Nota de 0 a 100 que estima o quão coeso o deck está: pesa cor dominante, trait dominante, cobertura de keywords e variedade de cartas.", "A 0–100 score estimating how cohesive the deck is: weighs dominant color, dominant trait, keyword coverage and card variety.")} howToRead={tr("80+ = sinergia forte; 55–79 = em formação; abaixo = base ainda dispersa. É uma heurística do portal, não uma regra oficial.", "80+ = strong synergy; 55–79 = taking shape; below = still scattered. It's a site heuristic, not an official rule.")} /></p>
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

          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Análise do deck", "Deck analysis")}</p>
              <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Identidade Tática da Lista", "List Identity")}<MetricTooltip metric="identidade-lista" what={tr("Os pilares do arquétipo que o sistema detectou na lista: cor-base, trait-base, série-base e tipo-base, com quantas cartas sustentam cada um.", "The archetype pillars the system found in the list: base color, base trait, base series and base type, with how many cards support each.")} howToRead={tr("Quanto mais definidos os quatro, mais focado o deck. Vazio = ainda faltam cartas pro sistema cravar o arquétipo.", "The clearer all four are, the more focused the deck. Empty = not enough cards yet to pin down the archetype.")} /></h3>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {archetypeBlocks.length ? archetypeBlocks.map((block) => (
                  <div key={block.label} className="panel-cut border surface-strong p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{block.label}</p>
                    <p className="mt-2 text-lg heading-portal">{block.value}</p>
                    <p className="mt-2 text-sm text-muted-portal">{block.hint}</p>
                  </div>
                )) : <p className="text-sm text-muted-portal">{tr("Adicione mais cartas para o sistema identificar melhor o arquétipo.", "Add more cards so the system can identify the archetype.")}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Assistente de Telemetria e Recomendações Preditivas VEDA */}
          <VedaTelemetryAssistant
            entries={entries}
            cardCache={cardCache}
            onAddCard={increment}
            availableCards={cards}
          />

          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Sugestões", "Suggestions")}</p>
              <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Recomendações por carta", "Card recommendations")}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">{tr("Reage ao que já está no deck (pilotos necessários para Link, trait, cor e série dominantes).", "Reacts to what's already in the deck (pilots needed for Link, dominant trait, color and series).")}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {recommendationCards.length ? recommendationCards.map((card) => (
                  <div key={card.id} className="panel-cut border surface-strong p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs uppercase tracking-[0.18em] text-slate-500">{card.code}</p>
                        <p className="truncate text-sm font-medium heading-portal">{getCardDisplayName(card, isPt)}</p>
                        <p className="text-[11px] text-muted-portal">{card.color} · custo {card.cost}</p>
                      </div>
                      <Button size="sm" className="shrink-0 rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => increment(card)}>+</Button>
                    </div>
                  </div>
                )) : <p className="col-span-full text-sm text-muted-portal">{tr("Ainda não há sinais suficientes para recomendar cartas. Monte um núcleo inicial ou limpe filtros muito restritos.", "Not enough signals to recommend cards yet. Build an initial core or clear overly strict filters.")}</p>}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Sinergia de cor", "Color synergy")}</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Top cores do deck", "Top deck colors")}<MetricTooltip metric="top-cores" what={tr("Quantas cartas de cada cor há no deck principal, da mais usada pra menos.", "How many cards of each color are in the main deck, most used first.")} howToRead={tr("Um deck usa no máximo 2 cores. Se a 2ª cor aparece com poucas cartas, decida se compensa mantê-la. Clique numa cor pra ver as cartas.", "A deck uses at most 2 colors. If the 2nd color has few cards, decide whether it's worth keeping. Click a color to see the cards.")} /></h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{tr("Um deck só pode ter até 2 cores — se a 2ª cor aparecer com pouca presença, pode ser corte de teste ou fixação demais.", "A deck can have at most 2 colors — if the 2nd color barely shows up, it may be a test cut or too much splashing.")}</p>
                <div className="mt-5 space-y-3">
                  {colorBreakdown.length ? colorBreakdown.map((item) => (
                    <button key={item.name} type="button" onClick={() => openStatDetail(tr("Cor", "Color"), item.name, (row) => row.color === item.name)} className="group block w-full text-left transition hover:opacity-80">
                      <div className="flex items-center justify-between text-sm"><span className="heading-portal">{item.name}</span><span className="flex items-center gap-1 text-muted-portal">{item.value} · {item.pct}%<ChevronRight className="size-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" /></span></div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-none bg-white/5"><div className="h-full" style={{ width: `${item.pct}%`, backgroundColor: GAME_COLOR_HEX[item.name] || "#94a3b8" }} /></div>
                    </button>
                  )) : <p className="text-sm text-muted-portal">{tr("Adicione cartas ao deck principal para ver a distribuição.", "Add cards to the main deck to see the breakdown.")}</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Sinergia de trait", "Trait synergy")}</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Top traits do deck", "Top deck traits")}<MetricTooltip metric="top-traits" what={tr("As traits (marcadores temáticos, tipo 'Zeon' ou 'White Base Team') que mais se repetem entre as cartas.", "The traits (theme tags like 'Zeon' or 'White Base Team') that repeat most among the cards.")} howToRead={tr("Trait repetido costuma indicar sinergia real — efeitos que reagem a uma trait específica. Clique pra ver as cartas.", "A repeated trait usually means real synergy — effects that react to that trait. Click to see the cards.")} /></h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{tr("Traits repetidos indicam sinergia real (habilidade que reage a trait específica) — não só tema visual.", "Repeated traits signal real synergy (abilities that react to a specific trait) — not just looks.")}</p>
                <div className="mt-5 space-y-3">
                  {traitBreakdown.length ? traitBreakdown.map((item) => (
                    <button key={item.name} type="button" onClick={() => openStatDetail(tr("Trait", "Trait"), item.name, (row) => (row.trait || "Sem trait") === item.name)} className="group block w-full text-left transition hover:opacity-80">
                      <div className="flex items-center justify-between text-sm"><span className="heading-portal">{item.name}</span><span className="flex items-center gap-1 text-muted-portal">{item.value} · {item.pct}%<ChevronRight className="size-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" /></span></div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-none bg-white/5"><div className="h-full bg-primary" style={{ width: `${item.pct}%` }} /></div>
                    </button>
                  )) : <p className="text-sm text-muted-portal">{tr("Adicione cartas com trait definido para ver a distribuição.", "Add cards with a trait to see the breakdown.")}</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Sinergia de série", "Series synergy")}</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Séries no deck", "Series in the deck")}<MetricTooltip metric="series-no-deck" what={tr("De quais obras (séries de anime/filme) vêm as cartas do deck.", "Which works (anime/film series) the deck's cards come from.")} howToRead={tr("Muitas cartas da mesma série tendem a combinar tematicamente, às vezes mecanicamente. Clique numa série pra ver as cartas.", "Many cards from the same series tend to fit thematically, sometimes mechanically. Click a series to see the cards.")} /></h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{tr("Vários cards da mesma série costumam ter sinergia temática (nem sempre mecânica) entre si.", "Several cards from the same series often share a theme (not always mechanics).")}</p>
                <div className="mt-5 space-y-3">
                  {seriesBreakdown.length ? seriesBreakdown.map((item) => (
                    <button key={item.name} type="button" onClick={() => openStatDetail(tr("Série", "Series"), item.name, (row) => (row.series || "Sem série definida") === item.name)} className="group block w-full text-left transition hover:opacity-80">
                      <div className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 truncate heading-portal">{item.name}</span><span className="flex shrink-0 items-center gap-1 text-muted-portal">{item.value} · {item.pct}%<ChevronRight className="size-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" /></span></div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-none bg-white/5"><div className="h-full bg-accent" style={{ width: `${item.pct}%` }} /></div>
                    </button>
                  )) : <p className="text-sm text-muted-portal">{tr("Adicione cartas ao deck principal para ver a distribuição.", "Add cards to the main deck to see the breakdown.")}</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Composição por tipo", "Composition by type")}</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Tipos no deck", "Types in the deck")}<MetricTooltip metric="tipos-no-deck" what={tr("Proporção de Unidade / Piloto / Comando / Base na lista principal.", "Share of Unit / Pilot / Command / Base in the main list.")} howToRead={tr("Mostra se o deck tem recurso pra jogo longo ou é só pressão inicial. Clique num tipo pra ver as cartas.", "Shows whether the deck has gas for a long game or is just early pressure. Click a type to see the cards.")} /></h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{tr("Unidade/Piloto/Comando/Base em proporção — mostra se o deck tem gás pra jogo tardio ou é só pressão inicial.", "Unit/Pilot/Command/Base share — shows whether the deck has gas for the late game or is just early pressure.")}</p>
                <div className="mt-5 space-y-3">
                  {typeBreakdown.length ? typeBreakdown.map((item) => (
                    <button key={item.name} type="button" onClick={() => openStatDetail("Tipo", item.name, (row) => (CARD_TYPE_OPTIONS.find((opt) => opt.value === row.type)?.label || row.type) === item.name)} className="group block w-full text-left transition hover:opacity-80">
                      <div className="flex items-center justify-between text-sm"><span className="heading-portal">{item.name}</span><span className="flex items-center gap-1 text-muted-portal">{item.value} · {item.pct}%<ChevronRight className="size-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" /></span></div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-none bg-white/5"><div className="h-full bg-emerald-400" style={{ width: `${item.pct}%` }} /></div>
                    </button>
                  )) : <p className="text-sm text-muted-portal">{tr("Adicione cartas ao deck principal para ver a distribuição.", "Add cards to the main deck to see the breakdown.")}</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Cobertura de keywords", "Keyword coverage")}</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Keywords de efeito", "Effect keywords")}<MetricTooltip metric="keywords-efeito" what={tr("Quantas cartas têm cada keyword de efeito (Repair, Breach, Blocker, Support...) — o que a carta FAZ.", "How many cards have each effect keyword (Repair, Breach, Blocker, Support...) — what the card DOES.")} howToRead={tr("Mais cartas com a mesma keyword = plano mecânico mais consistente. O % é sobre o deck principal. Clique pra ver as cartas.", "More cards with the same keyword = a more consistent plan. The % is of the main deck. Click to see the cards.")} /></h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{tr("O que a carta FAZ mecanicamente (Repair, Breach, Blocker...) — construção matemática de sinergia, não só tema.", "What the card DOES mechanically (Repair, Breach, Blocker...) — real synergy, not just theme.")}</p>
                <div className="mt-5 space-y-3">
                  {effectKeywordBreakdown.length ? effectKeywordBreakdown.map((item) => (
                    <button key={item.name} type="button" onClick={() => openStatDetail(tr("Keyword de efeito", "Effect keyword"), item.name, (row) => row.keywords.includes(item.name))} className="group block w-full text-left transition hover:opacity-80">
                      <div className="flex items-center justify-between text-sm"><span className="heading-portal">{item.name}</span><span className="flex items-center gap-1 text-muted-portal">{item.count} · {item.pct}%<ChevronRight className="size-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" /></span></div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-none bg-white/5"><div className="h-full bg-primary" style={{ width: `${item.pct}%` }} /></div>
                      {item.valueBreakdown ? <p className="mt-1 text-[11px] text-slate-500">{item.valueBreakdown.map(([val, qty]) => `${qty}x ${item.name} ${val}`).join(", ")}</p> : null}
                    </button>
                  )) : <p className="text-sm text-muted-portal">{tr("Nenhuma keyword de efeito detectada ainda neste deck.", "No effect keywords found in this deck yet.")}</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Cobertura de keywords", "Keyword coverage")}</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Keywords de gatilho", "Trigger keywords")}<MetricTooltip metric="keywords-gatilho" what={tr("Quantas cartas ativam em cada momento do jogo (Deploy, Burst, Once per Turn, Attack...) — QUANDO a carta reage.", "How many cards trigger at each moment of the game (Deploy, Burst, Once per Turn, Attack...) — WHEN the card reacts.")} howToRead={tr("Ajuda a ver se o deck depende de um único momento do turno. Clique pra ver as cartas.", "Helps you see if the deck depends on a single moment of the turn. Click to see the cards.")} /></h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{tr("QUANDO a carta ativa (Deploy, Burst, Once per Turn...) — ajuda a ver se o deck depende de um momento específico do turno.", "WHEN the card triggers (Deploy, Burst, Once per Turn...) — helps you see if the deck depends on a specific moment of the turn.")}</p>
                <div className="mt-5 space-y-3">
                  {triggerKeywordBreakdown.length ? triggerKeywordBreakdown.map((item) => (
                    <button key={item.name} type="button" onClick={() => openStatDetail(tr("Keyword de gatilho", "Trigger keyword"), item.name, (row) => Boolean(row.triggerKeywords?.includes(item.name)))} className="group block w-full text-left transition hover:opacity-80">
                      <div className="flex items-center justify-between text-sm"><span className="heading-portal">{item.name}</span><span className="flex items-center gap-1 text-muted-portal">{item.count} · {item.pct}%<ChevronRight className="size-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" /></span></div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-none bg-white/5"><div className="h-full bg-accent" style={{ width: `${item.pct}%` }} /></div>
                    </button>
                  )) : <p className="text-sm text-muted-portal">{tr("Nenhuma keyword de gatilho detectada ainda neste deck.", "No trigger keywords found in this deck yet.")}</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Gráfico 01", "Chart 01")}</p>
                    <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Curva de custo", "Cost curve")}<MetricTooltip metric="curva-custo" what={tr("Quantas cartas do deck principal existem em cada valor de custo.", "How many main deck cards there are at each cost.")} howToRead={tr("Curva concentrada em custo baixo joga cedo; muita carta cara exige sobreviver até montar recurso. Clique numa barra pra ver as cartas.", "A low-cost curve plays early; many expensive cards mean surviving until you have the resources. Click a bar to see the cards.")} /></h3>
                  </div>
                </div>
                <div className="mt-6 h-[260px]">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart data={curveData}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="cost" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="quantity" radius={0} fill="var(--color-quantity)" onClick={(entry: any) => openStatDetail(tr("Custo", "Cost"), `${entry.cost}`, (row) => String(row.cost) === entry.cost)} className="cursor-pointer" />
                    </BarChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Gráfico 02", "Chart 02")}</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Distribuição por cor", "Color distribution")}<MetricTooltip metric="distribuicao-cor" what={tr("A mesma contagem de cores do deck, agora em gráfico de pizza.", "The same color count, as a pie chart.")} howToRead={tr("A maior fatia é a cor-base do deck. Clique numa fatia pra ver as cartas.", "The biggest slice is the deck's base color. Click a slice to see the cards.")} /></h3>
                <div className="mt-6 h-[260px]">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                      <Pie data={colorData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={90} strokeWidth={2} onClick={(entry: any) => openStatDetail(tr("Cor", "Color"), entry.name, (row) => row.color === entry.name)} className="cursor-pointer">
                        {colorData.map((entry) => <Cell key={entry.name} fill={GAME_COLOR_HEX[entry.name] || "#94a3b8"} />)}
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
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Consistência", "Consistency")}</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Mão inicial", "Opening hand")}<MetricTooltip metric="mao-inicial" what={tr("Probabilidade de a sua mão de abertura (5 cartas compradas do deck principal embaralhado) conter certos tipos de carta. Cálculo hipergeométrico.", "Probability that your opening hand (5 cards from the shuffled main deck) contains certain card types. Hypergeometric math.")} howToRead={tr("Quanto maior a %, mais confiável é abrir bem. 'Com 1 mulligan' conta a mão original OU a redistribuída — pela regra oficial, o mulligan é um sorteio novo e independente, não uma troca parcial.", "The higher the %, the more reliable your opening. 'With 1 mulligan' counts the original hand OR the redraw — under the official rules the mulligan is a fresh, independent draw, not a partial swap.")} /></h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-none border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
                    onClick={() => setZeroCopilotOpen(true)}
                  >
                    <BrainCircuit className="mr-1.5 size-4 text-cyan-400" />
                    {tr("Assistente IA", "AI Assistant")}
                  </Button>
                  <Button variant="outline" className="rounded-none" disabled={stats.mainDeckCount === 0} onClick={() => setOpeningHandOpen(true)}>
                    <Eye className="mr-2 size-4" />
                    {tr("Simular abertura", "Simulate opening")}
                  </Button>
                </div>
              </div>
              {stats.mainDeckCount > 0 ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <button type="button" onClick={() => openStatDetail(tr("Mão inicial", "Opening hand"), tr("Unidade/Base jogável cedo (≤T2)", "Unit/Base playable early (≤T2)"), (row) => isBoardDevelopmentCard(row) && earliestPlayableTurn(row) <= LOW_COST_MAX)} className="group panel-cut border surface-strong p-4 text-left transition hover:opacity-80">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{tr("Unidade/Base jogável cedo (≤T2)", "Unit/Base playable early (≤T2)")}<MetricTooltip metric="custo-baixo-contagem" what={tr("Quantas Unidades/Bases do deck principal têm turno mínimo (o maior entre custo e nível) até T2.", "How many main deck Units/Bases have a minimum turn (the higher of cost and level) of T2 or less.")} howToRead={tr("São as cartas que realmente desenvolvem o campo já nos primeiros turnos — Piloto/Comando de custo baixo não contam aqui, e nível alto também trava o turno mesmo com custo baixo. Poucas = risco de mão travada no começo. Clique pra ver quais são.", "These are the cards that actually build your board in the first turns — cheap Pilots/Commands don't count here, and a high level also delays the turn even with a low cost. Few = risk of a stuck early hand. Click to see them.")} /></p>
                    <p className="mt-2 flex items-center gap-1 text-lg heading-portal">{stats.lowCostCount} de {stats.mainDeckCount}<ChevronRight className="size-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" /></p>
                    <p className="mt-2 text-sm text-muted-portal">{stats.lowCostRate}% {tr("da lista principal.", "of the main list.")}</p>
                  </button>
                  <button type="button" onClick={() => openStatDetail(tr("Mão inicial", "Opening hand"), tr("Unidade/Base jogável cedo na abertura", "Unit/Base playable early in the opening hand"), (row) => isBoardDevelopmentCard(row) && earliestPlayableTurn(row) <= LOW_COST_MAX)} className="group panel-cut border border-primary/30 bg-primary/10 p-4 text-left transition hover:opacity-80">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-portal">{tr("Unidade/Base jogável cedo na abertura", "Unit/Base playable early in the opening hand")}<MetricTooltip metric="custo-baixo-abertura" what={tr("Chance de a mão de abertura (5 cartas) ter pelo menos 1 Unidade/Base com turno mínimo (custo E nível) até T2.", "Chance the opening hand (5 cards) has at least 1 Unit/Base with a minimum turn (cost AND level) of T2 or less.")} howToRead={tr("Acima de ~70% costuma ser confortável. Abaixo disso, considere adicionar Unidades/Bases baratas E de nível baixo — custo baixo sozinho não garante jogo cedo. Clique pra ver quais contam.", "Above ~70% is usually comfortable. Below that, consider adding Units/Bases that are cheap AND low level — low cost alone doesn't guarantee an early play. Click to see which count.")} /></p>
                    <p className="mt-2 flex items-center gap-1 font-heading text-4xl heading-portal">{Math.round(handOdds.openingHand * 100)}%<ChevronRight className="size-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" /></p>
                    <p className="mt-2 text-sm text-muted-portal">{tr("De abrir com pelo menos 1 carta de custo baixo, em 5 compradas.", "Of opening with at least 1 low-cost card, in 5 cards drawn.")}</p>
                  </button>
                  <button type="button" onClick={() => openStatDetail(tr("Mão inicial", "Opening hand"), tr("Unit jogável cedo na abertura", "Unit playable early in the opening hand"), (row) => row.type === "UNIT" && typeof row.level === "number" && row.level >= 1 && earliestPlayableTurn(row) <= LOW_LEVEL_MAX)} className="group panel-cut border border-accent/30 bg-accent/10 p-4 text-left transition hover:opacity-80">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-portal">{tr("Unit jogável cedo na abertura", "Unit playable early in the opening hand")}<MetricTooltip metric="nivel-baixo-abertura" what={tr("Chance de abrir com pelo menos 1 Unidade cujo turno mínimo (o maior entre custo e nível) seja até T3.", "Chance of opening with at least 1 Unit whose minimum turn (the higher of cost and level) is T3 or less.")} howToRead={tr("Uma Unidade de nível baixo mas custo alto (ou vice-versa) ainda não é jogável cedo — os dois precisam estar baixos. Clique pra ver quais Units contam.", "A Unit with low level but high cost (or vice versa) still isn't playable early — both need to be low. Click to see which Units count.")} /></p>
                    <p className="mt-2 flex items-center gap-1 font-heading text-4xl heading-portal">{Math.round(lowLevelStats.openingHand * 100)}%<ChevronRight className="size-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-primary" /></p>
                    <p className="mt-2 text-sm text-muted-portal">{tr(`De abrir com pelo menos 1 Unit Lv.1–3 (${lowLevelStats.lowLevelUnitCount} na lista), em 5 compradas.`, `Of opening with at least 1 Lv.1–3 Unit (${lowLevelStats.lowLevelUnitCount} in the list), in 5 cards drawn.`)}</p>
                  </button>
                  <div className="panel-cut border surface-strong p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{tr("Com 1 mulligan", "With 1 mulligan")}<MetricTooltip metric="custo-baixo-mulligan" what={tr("A mesma chance de custo baixo, mas contando a mão original OU a redistribuída pelo mulligan.", "The same low-cost chance, counting the original hand OR the mulligan redraw.")} howToRead={tr("É sempre ≥ a chance sem mulligan — é o piso realista, já que o mulligan é grátis e independente.", "Always ≥ the chance without a mulligan — the realistic floor, since the mulligan is free and independent.")} /></p>
                    <p className="mt-2 text-lg heading-portal">{Math.round(handOdds.withMulligan * 100)}%</p>
                    <p className="mt-2 text-sm text-muted-portal">{tr("Unidade/Base jogável cedo, contando a mão original ou a redistribuída.", "Unit/Base playable early, counting the original hand or the redraw.")}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-6 text-sm text-muted-portal">{tr("Adicione cartas ao deck principal para calcular a chance de abertura.", "Add cards to the main deck to calculate the opening odds.")}</p>
              )}
              {stats.mainDeckCount > 0 ? (
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
                      <p className="mt-1">N = {stats.mainDeckCount} <span className="text-slate-500">{tr("(cartas no deck principal)", "(cards in the main deck)")}</span></p>
                      <p>K = {stats.lowCostCount} <span className="text-slate-500">{tr("(Unidade/Base jogável até o T2, os \"sucessos\")", "(Units/Bases playable by T2, the \"successes\")")}</span></p>
                      <p>n = {OPENING_HAND_SIZE} <span className="text-slate-500">{tr("(tamanho da mão comprada)", "(hand size drawn)")}</span></p>
                      <p className="mt-2 border-t border-white/10 pt-2">P = 1 − C({stats.mainDeckCount - stats.lowCostCount}, {OPENING_HAND_SIZE}) / C({stats.mainDeckCount}, {OPENING_HAND_SIZE}) = <span className="text-primary">{(handOdds.openingHand * 100).toFixed(2)}%</span></p>
                    </div>
                    <p className="text-sm text-muted-portal">
                      {tr(
                        `'Com 1 mulligan' trata cada tentativa como um sorteio independente da mesma população de ${stats.mainDeckCount} cartas (mulligan oficial: devolve a mão, embaralha e compra 5 de novo — não é uma troca parcial). A chance de acertar em pelo menos uma das duas tentativas é 1 − (1 − P)² = `,
                        `'With 1 mulligan' treats each attempt as an independent draw from the same ${stats.mainDeckCount} cards (official mulligan: return the hand, shuffle and draw 5 again — not a partial swap). The chance of hitting in at least one of the two attempts is 1 − (1 − P)² = `,
                      )}<span className="text-primary">{(handOdds.withMulligan * 100).toFixed(2)}%</span>.
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              ) : null}
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Gráfico 03", "Chart 03")}</p>
              <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Composição por tipo", "Composition by type")}<MetricTooltip metric="composicao-tipo" what={tr("Quantidade de cartas por tipo (Unidade, Piloto, Comando, Base), em barras horizontais.", "Number of cards per type (Unit, Pilot, Command, Base), as horizontal bars.")} howToRead={tr("É o mesmo dado de 'Tipos no deck', em gráfico. Clique numa barra pra ver as cartas.", "Same data as 'Types in the deck', as a chart. Click a bar to see the cards.")} /></h3>
              <div className="mt-6 h-[250px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart layout="vertical" data={typeData} margin={{ left: 12, right: 12 }}>
                    <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={90} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="quantity" radius={0} fill="var(--color-quantity)" onClick={(entry: any) => openStatDetail("Tipo", entry.name, (row) => (CARD_TYPE_OPTIONS.find((opt) => opt.value === row.type)?.label || row.type) === entry.name)} className="cursor-pointer" />
                  </BarChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          {unitRows.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Gráfico 04", "Chart 04")}</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Curva de nível", "Level curve")}<MetricTooltip metric="curva-nivel" what={tr("Distribuição das Unidades do deck principal por Lv. (Lv.6 e acima somam na faixa 6+).", "Main deck Units by Lv. (Lv.6 and above are grouped as 6+).")} howToRead={tr("Nível alto exige mais recurso pra jogar. Concentração em nível baixo abre mais cedo. Clique numa barra pra ver as cartas.", "High level needs more resources to play. Low levels open earlier. Click a bar to see the cards.")} /></h3>
                <div className="mt-6 h-[220px]">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart data={levelData}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="level" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="quantity" radius={0} fill="var(--color-quantity)" onClick={(entry: any) => openStatDetail("Nível", entry.level, (row) => row.type === "UNIT" && (entry.level === "6+" ? Number(row.level) >= 6 : String(row.level) === entry.level))} className="cursor-pointer" />
                    </BarChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Gráfico 05", "Chart 05")}</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Distribuição de AP", "AP distribution")}<MetricTooltip metric="distribuicao-ap" what={tr("AP (poder de ataque) das Unidades do deck principal.", "AP (attack power) of the main deck Units.")} howToRead={tr("AP alto pressiona mais e vence trocas; AP baixo depende de keyword ou pareamento. Clique numa barra pra ver as cartas.", "High AP pressures more and wins trades; low AP relies on keywords or pairing. Click a bar to see the cards.")} /></h3>
                <div className="mt-6 h-[220px]">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart data={apData}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="ap" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="quantity" radius={0} fill="var(--color-quantity)" onClick={(entry: any) => openStatDetail("AP", entry.ap, (row) => row.type === "UNIT" && String(row.ap) === entry.ap)} className="cursor-pointer" />
                    </BarChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">{tr("Gráfico 06", "Chart 06")}</p>
                <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">{tr("Distribuição de HP", "HP distribution")}<MetricTooltip metric="distribuicao-hp" what={tr("HP (pontos de vida) das Unidades do deck principal.", "HP (hit points) of the main deck Units.")} howToRead={tr("HP alto sobrevive a mais dano e a remoções por dano; HP baixo cai fácil de Blocker e efeitos. Clique numa barra pra ver as cartas.", "High HP survives more damage and damage-based removal; low HP falls easily to Blockers and effects. Click a bar to see the cards.")} /></h3>
                <div className="mt-6 h-[220px]">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart data={hpData}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="hp" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="quantity" radius={0} fill="var(--color-quantity)" onClick={(entry: any) => openStatDetail("HP", entry.hp, (row) => row.type === "UNIT" && String(row.hp) === entry.hp)} className="cursor-pointer" />
                    </BarChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          ) : null}
        </div>
        )}
      </div>
      )}
      <AltArtModal modelId={altArtModelId} onClose={() => setAltArtModelId(null)} entries={entries} getCopyLimit={getCopyLimit} onIncrement={increment} onDecrement={decrement} />
      <CardPreviewModal card={previewCard} onClose={() => setPreviewCard(null)} />
      <StatDetailModal title={statDetail} rows={statDetailRows} onClose={() => setStatDetail(null)} onPreviewCard={setPreviewCard} />
      <OpeningHandModal open={openingHandOpen} onClose={() => setOpeningHandOpen(false)} cards={mainDeckRows} />
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg border-white/10 bg-slate-950 text-white">
          <div className="border-b border-white/10 pb-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{tr("Importar decklist", "Import decklist")}</p>
            <DialogTitle className="font-heading text-2xl uppercase heading-portal">{tr("Colar lista em texto", "Paste a text list")}</DialogTitle>
            <p className="mt-2 text-sm text-soft">{tr("Uma carta por linha, formato \"4x CODE\" (mesmo que a exportação MSA/Exburst gera). Substitui o deck principal e o de recursos atuais — EX Base/Resource não são afetados.", "One card per line, \"4x CODE\" format (same as the MSA/Exburst export). Replaces the current main and resource decks — EX Base/Resource aren't affected.")}</p>
          </div>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={10} placeholder={"4x ST01-001\n2x ST01-002\n..."} className="field-shell w-full resize-none p-3 font-mono text-xs" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:text-white" onClick={() => setImportModalOpen(false)}>{tr("Cancelar", "Cancel")}</Button>
            <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" disabled={importing || !importText.trim()} onClick={() => importDecklistText(importText)}>{importing ? "Importando…" : "Importar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
      {exportImageModalOpen && (
        <ExportDeckImageModal
          open={exportImageModalOpen}
          onClose={() => setExportImageModalOpen(false)}
          deckName={deckName || "Novo Deck"}
          authorName={user?.displayName || user?.username || "Jogador"}
          shareId={selectedShareId || "OZ-SPEC"}
          mainCards={mainDeckRows.map((r) => ({
            code: r.code,
            name: getCardDisplayName(r, isPt),
            quantity: r.quantity,
            imageUrl: r.imageUrl,
            imageMediumUrl: r.imageMediumUrl,
            color: r.color,
            cardType: r.type,
          }))}
          resourceCards={resourceDeckRows.map((r) => ({
            code: r.code,
            name: getCardDisplayName(r, isPt),
            quantity: r.quantity,
            imageUrl: r.imageUrl,
            imageMediumUrl: r.imageMediumUrl,
            color: r.color,
            cardType: "RESOURCE",
          }))}
          exCards={[exBaseRow, exResourceRow].filter(Boolean).map((r: any) => ({
            code: r.code,
            name: getCardDisplayName(r, isPt),
            quantity: r.quantity,
            imageUrl: r.imageUrl,
            imageMediumUrl: r.imageMediumUrl,
            color: r.color,
            cardType: r.type,
          }))}
          colors={Object.keys(stats.colorMap).filter((c) => (stats.colorMap[c] ?? 0) > 0)}
        />
      )}

      {/* MODAL DE SALVAR DECK COM SELEÇÃO PÚBLICO / PRIVADO INTUITIVA E TRADUZIDA */}
      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent className="rounded-none border-primary/40 bg-slate-950 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl uppercase tracking-wider text-primary flex items-center gap-2">
              <Save className="size-5" /> {tr("Salvar deck", "Save deck")}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              {tr("Defina o nome e a visibilidade do seu projeto de Mobile Suits.", "Set the name and visibility of your deck.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-400 font-mono block mb-1.5">
                {tr("Nome do Projeto / Deck", "Deck Name")}
              </label>
              <Input
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                className="field-shell"
                placeholder="Ex: Tallgeese Heavy Assault"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-slate-400 font-mono block mb-2">
                {tr("Visibilidade da Lista", "Visibility")}
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setVisibility("PUBLIC")}
                  className={`p-3 border text-left flex flex-col justify-between transition-all ${
                    visibility === "PUBLIC"
                      ? "border-emerald-500 bg-emerald-950/30 text-white shadow-sm ring-1 ring-emerald-500"
                      : "border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/30 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-heading text-sm uppercase text-emerald-400 mb-1">
                    <Globe className="size-4" /> {tr("Público", "Public")}
                  </div>
                  <p className="text-[0.7rem] text-slate-300 leading-snug">
                    {tr("Aparece na lista de decks públicos para toda a comunidade.", "Shows up in the public decks list for everyone.")}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setVisibility("PRIVATE")}
                  className={`p-3 border text-left flex flex-col justify-between transition-all ${
                    visibility === "PRIVATE"
                      ? "border-primary bg-primary/20 text-white shadow-sm ring-1 ring-primary"
                      : "border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/30 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-heading text-sm uppercase text-sky-400 mb-1">
                    <Lock className="size-4" /> {tr("Privado", "Private")}
                  </div>
                  <p className="text-[0.7rem] text-slate-300 leading-snug">
                    {tr("Visível só para você. Não aparece na lista de decks públicos.", "Only you can see it. It doesn't show up in the public decks list.")}
                  </p>
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="rounded-none border-white/20"
              />
              <span>{tr("Definir como meu deck principal ativo", "Set as my main active deck")}</span>
            </label>

            {!deckPlayability.playable ? (
              <div
                data-testid="save-modal-simulator-warning"
                className="border border-amber-500/40 bg-amber-950/30 p-2.5 text-xs text-amber-200/90 leading-relaxed"
              >
                <div className="flex items-center gap-1.5 font-bold text-amber-300 uppercase mb-1">
                  <AlertTriangle className="size-3.5" />
                  {tr("Atenção: Cartas em revisão no simulador", "Heads up: cards under review in the simulator")}
                </div>
                {tr(`Este projeto contém ${deckPlayability.unplayableCards.length} carta(s) ainda em revisão (${deckPlayability.unplayableCodes.join(", ")}). Você pode salvá-lo normalmente, mas ele só poderá entrar em partidas do simulador quando o motor implementar todas as cláusulas pendentes.`, `This deck has ${deckPlayability.unplayableCards.length} card(s) still under review (${deckPlayability.unplayableCodes.join(", ")}). You can save it as usual, but it can only be used in simulator matches once all pending clauses are implemented.`)}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <Button
                variant="outline"
                onClick={() => setSaveModalOpen(false)}
                className="rounded-none border-white/20"
              >
                {tr("Cancelar", "Cancel")}
              </Button>
              <Button
                onClick={executeSaveDeck}
                className="rounded-none bg-primary text-primary-foreground font-heading uppercase tracking-wider"
              >
                {tr("Confirmar e Salvar", "Confirm and Save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE IDENTIFICAÇÃO DE PILOTO PARA VISITANTES */}
      <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
        <DialogContent className="rounded-none border-amber-500/50 bg-slate-950 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Shield className="size-5" /> {tr("Identificação de Piloto Necessária", "Sign-in Required")}
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-xs leading-relaxed">
              {tr("Para salvar, gerar um link permanente ou publicar o deck, entre na sua conta.", "To save, get a permanent link or publish the deck, sign in.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 text-xs">
              ✓ {tr("Seu rascunho com", "Your draft with")} <strong>{stats.mainDeckCount} {tr("cartas", "cards")}</strong> {tr("foi preservado localmente no seu navegador e não será perdido.", "was saved locally in your browser and won't be lost.")}
            </div>

            <p className="text-xs text-slate-400">
              {tr("Cadastre-se gratuitamente ou faça login para salvar permanentemente, gerar link público e ver as estatísticas completas do deck.", "Sign up for free or sign in to save permanently, get a public link and see the full deck stats.")}
            </p>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setAuthModalOpen(false)}
                className="rounded-none border-white/20"
              >
                {tr("Continuar Montando", "Keep Building")}
              </Button>
              <Button
                onClick={() => {
                  setAuthModalOpen(false);
                  navigate("/login");
                }}
                className="rounded-none bg-primary text-primary-foreground font-heading uppercase tracking-wider"
              >
                {tr("Criar Conta / Login", "Sign Up / Sign In")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ZERO COPILOT DRAWER — Hangar OZ (docs/54, docs/55) */}
      <ZeroCopilotDrawer
        open={zeroCopilotOpen}
        onClose={() => setZeroCopilotOpen(false)}
        deckCards={zeroCopilotCards}
        deckName={deckName}
        colors={Object.keys(stats.colorMap)}
        onAddCard={handleZeroCopilotAdd}
        onInspectCard={handleZeroCopilotInspect}
      />
    </PublicShell>
  );
}
