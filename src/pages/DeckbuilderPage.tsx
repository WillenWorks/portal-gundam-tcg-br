/* Deckbuilder tático — filtros reais da pool, persistência por usuário, diagnóstico operacional e navegação contextual. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Plus, Save, Share2, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { useAuth } from "@/contexts/AuthContext";
import { api, mapApiCard, type ApiDeck, type CardFilters } from "@/lib/api";
import { DECK_MAIN_SIZE, DECK_RESOURCE_SIZE, computeDeckLegality, type DeckLegalityData } from "@/lib/deck-legality";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
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
  const expanded = expandedAll.filter((item) => item.section !== "resource");
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

function DeckRowCard({ row, onIncrement, onDecrement }: { row: DeckRow; onIncrement: (card: CardRecord) => void; onDecrement: (printId: string) => void }) {
  return (
    <div className="panel-cut border surface-strong p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{row.code}</p>
          <p className="mt-1 text-lg heading-portal">{row.namePt || row.name}</p>
          <p className="text-sm text-muted-portal">{row.color} · {row.type} · custo {row.cost} · {row.trait || "sem trait"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={() => onDecrement(row.printId || row.id)}>-</Button>
          <div className="min-w-10 text-center text-lg heading-portal">{row.quantity}</div>
          <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onIncrement(row)}>+</Button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href={`/cards/${row.cardModelId || row.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir carta</Link>
        {row.keywords[0] ? <Link href={`/rules?relatedKeyword=${encodeURIComponent(row.keywords[0])}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Rulings</Link> : null}
      </div>
    </div>
  );
}

export default function DeckbuilderPage() {
  const { user, isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState(import.meta.env.DEV ? "pilot@gundambr.local" : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? "pilot123" : "");
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [decks, setDecks] = useState<ApiDeck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const [deckName, setDeckName] = useState("Novo Deck");
  const [entries, setEntries] = useState<DeckEntry[]>([]);
  const [visibility, setVisibility] = useState<DeckVisibility>("PRIVATE");
  const [coverImage, setCoverImage] = useState("");
  const [featuredCardIds, setFeaturedCardIds] = useState<string[]>([]);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [poolFilters, setPoolFilters] = useState<PoolFilters>(defaultPoolFilters);
  const [poolQueryDraft, setPoolQueryDraft] = useState("");
  const [poolMeta, setPoolMeta] = useState<PoolMeta>({ colors: [], cardTypes: [], series: [], traits: [], keywords: [], sets: [] });
  const [loadingPool, setLoadingPool] = useState(true);
  const [loadingDecks, setLoadingDecks] = useState(false);
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

  const applyDeck = (deck: ApiDeck) => {
    setSelectedDeckId(deck.id);
    setSelectedShareId(deck.shareId);
    setDeckName(deck.name);
    setVisibility(deck.visibility);
    setCoverImage(deck.coverImage || "");
    setFeaturedCardIds((deck.featuredCardIds || []).slice(0, 2));
    // deck.items[].card já vem incluído na resposta (ver server/index.ts) como a
    // impressão crua (Card) — usa direto, sem precisar de outra chamada à API.
    const deckCards = (deck.items || []).map((item: any) => item.card).filter(Boolean).map(mapApiCard);
    cacheCards(deckCards);
    setEntries(deck.items.map((item: any) => ({ cardId: item.card?.id ?? item.cardId, quantity: item.quantity, section: (item.section as "main" | "resource") || "main" })));
  };

  const loadDecks = async () => {
    if (!isAuthenticated) return;
    setLoadingDecks(true);
    try {
      const result = await api.listMyDecks();
      setDecks(result);
      const primary = result.find((deck) => deck.isPrimary) ?? result[0];
      if (primary) applyDeck(primary);
    } finally {
      setLoadingDecks(false);
    }
  };

  useEffect(() => {
    loadPoolMeta().catch(() => undefined);
    loadLegality().catch(() => undefined);
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

  useEffect(() => {
    loadDecks().catch(() => undefined);
  }, [isAuthenticated]);

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

  const mainDeckRows = useMemo(() => deckRows.filter((row) => row.section !== "resource"), [deckRows]);
  const resourceDeckRows = useMemo(() => deckRows.filter((row) => row.section === "resource"), [deckRows]);

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
    return cards
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
  }, [cards, entries, cardCache, dominantColor, dominantTrait, dominantSeries, deckRows, stats.lowCostRate]);

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
    const printId = card.printId || card.id;
    const modelId = card.cardModelId || card.id;
    const section = getSectionForCardType(card.type);
    const limit = getCopyLimit(modelId, card.type);
    const currentTotal = entries.filter((entry) => (cardCache[entry.cardId]?.cardModelId || entry.cardId) === modelId).reduce((sum, entry) => sum + entry.quantity, 0);
    if (currentTotal >= limit) {
      toast.error(limit === 0 ? `${card.namePt || card.name} está banida — não pode ser usada.` : `Limite de ${limit} cópia(s) de "${card.namePt || card.name}" já atingido.`);
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
    if (!isAuthenticated) {
      toast.error("Faça login para persistir múltiplos decks.");
      return;
    }

    const payload = {
      name: deckName,
      format: "constructed",
      visibility,
      isPrimary: true,
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
    }
    await loadDecks();
    toast.success("Deck salvo no backend.");
  };

  const createNewDeck = () => {
    setSelectedDeckId(null);
    setSelectedShareId(null);
    setDeckName(`Novo Deck ${decks.length + 1}`);
    setVisibility("PRIVATE");
    setCoverImage("");
    setFeaturedCardIds([]);
    setEntries([]);
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("entity", "decks");
      formData.append("referenceCode", deckName || "deck");
      formData.append("label", "cover");
      const uploaded = await api.uploadAssetImage(formData);
      setCoverImage(uploaded.imageUrl);
      toast.success("Capa do deck enviada.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar a capa do deck.");
    } finally {
      if (event.target) event.target.value = "";
      setUploadingCover(false);
    }
  };

  const toggleFeaturedCard = (cardId: string) => {
    setFeaturedCardIds((current) => {
      if (current.includes(cardId)) return current.filter((id) => id !== cardId);
      if (current.length >= 2) { toast.error("Escolha no máximo duas cartas de destaque."); return current; }
      return [...current, cardId];
    });
  };

  const removeDeck = async (id: string) => {
    await api.deleteMyDeck(id);
    await loadDecks();
    toast.success("Deck removido.");
  };

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

  return (
    <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Deckbuilder" }]}>
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

            {!isAuthenticated ? (
              <div className="mt-6 panel-cut border surface-strong p-5">
                <p className="text-sm leading-7 text-soft">Faça login para salvar múltiplos decks por usuário no backend Prisma.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="field-shell" />
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Senha" className="field-shell" />
                </div>
                <Button className="mt-4 rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => login(email, password)}>Entrar</Button>
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <Input value={poolQueryDraft} onChange={(e) => setPoolQueryDraft(e.target.value)} placeholder="Nome, código, série ou trait" className="field-shell xl:col-span-2" />
              <select value={poolFilters.color} onChange={(e) => setPoolFilter("color", e.target.value)} className="field-shell h-10 px-3 text-sm"><option value="">Todas as cores</option>{poolMeta.colors.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={poolFilters.cardType} onChange={(e) => setPoolFilter("cardType", e.target.value)} className="field-shell h-10 px-3 text-sm"><option value="">Todos os tipos</option>{poolMeta.cardTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={poolFilters.series} onChange={(e) => setPoolFilter("series", e.target.value)} className="field-shell h-10 px-3 text-sm"><option value="">Todas as séries</option>{poolMeta.series.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={poolFilters.trait} onChange={(e) => setPoolFilter("trait", e.target.value)} className="field-shell h-10 px-3 text-sm"><option value="">Todas as traits</option>{poolMeta.traits.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{poolTotal} cartas encontradas</Badge>
              <Badge variant="outline" className="rounded-none border-white/20 text-soft">{poolActiveFilters} filtros ativos</Badge>
              <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={resetPoolFilters}>Limpar filtros</Button>
            </div>

            <div className="mt-6 space-y-3 max-h-[760px] overflow-auto pr-1">
              {loadingPool ? <p className="text-sm text-muted-portal">Carregando pool filtrada...</p> : null}
              {!loadingPool && !cards.length ? <p className="text-sm text-muted-portal">Nenhuma carta encontrada nessa combinação de filtros.</p> : null}
              {cards.map((card) => {
                const qtyInDeck = entries.filter((entry) => (cardCache[entry.cardId]?.cardModelId || entry.cardId) === card.id).reduce((sum, entry) => sum + entry.quantity, 0);
                const limit = getCopyLimit(card.id, card.type);
                const section = getSectionForCardType(card.type);
                return (
                  <div key={card.id} className="panel-cut border surface-strong p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.code}{section === "resource" ? <span className="ml-2 text-accent">· vai pro deck de recursos</span> : null}</p>
                        <p className="mt-1 text-lg heading-portal">{card.namePt || card.name}</p>
                        <p className="text-sm text-muted-portal">{card.color} · {card.type} · custo {card.cost} · {card.trait || "sem trait"}</p>
                      </div>
                      <Badge variant="outline" className={`rounded-none ${limit === 0 ? "border-red-400/40 text-red-300" : "border-white/20 text-soft"}`}>{limit === 0 ? "banida" : limit === Infinity ? `no deck: ${qtyInDeck}` : `no deck: ${qtyInDeck}/${limit}`}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" disabled={qtyInDeck >= limit} onClick={() => increment(card)}>Adicionar</Button>
                      <Link href={`/cards/${card.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir carta</Link>
                      {card.keywords[0] ? <Link href={`/rules?relatedKeyword=${encodeURIComponent(card.keywords[0])}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Ver rulings</Link> : null}
                    </div>
                  </div>
                );
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
          <Card className="panel-cut rounded-none border-primary/30 hero-surface">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Sessão atual</p>
                  <p className="mt-2 text-sm text-soft">{user ? `${user.displayName} · ${user.role}` : "Visitante"}</p>
                  <Input value={deckName} onChange={(e) => setDeckName(e.target.value)} className="field-shell mt-4 font-heading text-3xl uppercase heading-portal heading-portal" />
                </div>
                <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{stats.mainDeckCount} cartas</Badge>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(["PRIVATE", "UNLISTED", "PUBLIC"] as DeckVisibility[]).map((mode) => (
                  <button key={mode} type="button" onClick={() => setVisibility(mode)} className={`rounded-none border px-3 py-2 text-xs uppercase tracking-[0.18em] transition ${visibility === mode ? "border-primary/40 bg-primary/12 text-white" : "border-white/15 bg-white/5 text-soft hover:bg-white/10 hover:text-white"}`}>
                    {mode}
                  </button>
                ))}
              </div>

              <div className={`mt-4 panel-cut border p-4 ${liveLegality.valid ? "border-emerald-400/30 bg-emerald-400/10" : "border-amber-400/30 bg-amber-400/10"}`}>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex size-2.5 rounded-full ${liveLegality.valid ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-300">{liveLegality.valid ? "Deck válido pra torneio" : `${liveLegality.issues.length} pendência(s) de legalidade`}</p>
                </div>
                {liveLegality.issues.length ? (
                  <ul className="mt-3 space-y-1.5 text-sm leading-6 text-slate-300">
                    {liveLegality.issues.map((issue, index) => <li key={`${issue.type}-${index}`} className="flex gap-2"><span className="text-amber-400">•</span>{issue.message}</li>)}
                  </ul>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 border-y border-white/10 py-5 lg:grid-cols-[180px_1fr]">
                <div className="relative min-h-28 overflow-hidden border border-white/15 bg-slate-950/60">
                  {coverImage ? <img src={coverImage} alt="Capa do deck" className="h-full w-full object-cover" /> : <div className="flex h-full min-h-28 items-center justify-center px-4 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">Sem capa</div>}
                  <input ref={coverUploadInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                </div>
                <div className="space-y-3">
                  <div><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Capa editorial</p><p className="mt-1 text-sm text-soft">Envie uma imagem do computador para representar o deck.</p></div>
                  <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:text-white" disabled={uploadingCover} onClick={() => coverUploadInputRef.current?.click()}>{uploadingCover ? "Enviando…" : "Enviar capa"}</Button>{coverImage ? <Button type="button" variant="ghost" className="rounded-none text-slate-400 hover:text-white" onClick={() => setCoverImage("")}>Remover</Button> : null}</div>
                  <div className="pt-2"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Cartas de destaque · até 2</p><p className="mt-1 text-sm text-soft">Escolha cartas já cadastradas na pool carregada.</p><div className="mt-3 grid max-h-40 gap-2 overflow-auto pr-1 sm:grid-cols-2">{cards.map((card) => { const active = featuredCardIds.includes(card.id); return <button key={card.id} type="button" onClick={() => toggleFeaturedCard(card.id)} className={`flex items-center gap-2 border p-2 text-left text-xs transition ${active ? "border-primary bg-primary/15 text-white" : "border-white/15 bg-white/5 text-soft hover:bg-white/10"}`}><span className={`flex size-5 shrink-0 items-center justify-center border text-[10px] ${active ? "border-primary bg-primary text-primary-foreground" : "border-white/20"}`}>{active ? "✓" : ""}</span><span className="min-w-0"><span className="block truncate font-medium">{card.namePt || card.name}</span><span className="block truncate text-[10px] text-slate-500">{card.code}</span></span></button>; })}</div></div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveDeck}><Save className="mr-2 size-4" />Salvar deck</Button>
                <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={createNewDeck}><Plus className="mr-2 size-4" />Novo deck</Button>
                <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={copyShareLink}><Share2 className="mr-2 size-4" />Compartilhar</Button>
                <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={copyDecklist}><Copy className="mr-2 size-4" />Copiar decklist</Button>
                {selectedShareId ? <Button variant="ghost" className="rounded-none text-soft hover:bg-white/10 hover:text-white" onClick={copyShareLink}><Copy className="mr-2 size-4" />{selectedShareId}</Button> : null}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="panel-cut border surface-strong p-4"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Curva média</p><p className="mt-2 font-heading text-4xl heading-portal">{stats.avgCost}</p></div>
                <div className="panel-cut border surface-strong p-4"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Custo baixo</p><p className="mt-2 font-heading text-4xl heading-portal">{stats.lowCostRate}%</p></div>
                <div className="panel-cut border surface-strong p-4"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Traço dominante</p><p className="mt-2 text-sm leading-7 text-soft">{topTraits[0] ? `${topTraits[0][0]} · ${topTraits[0][1]}` : "—"}</p></div>
              </div>
            </CardContent>
          </Card>

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
                <div className="mt-6 space-y-4">
                  {recommendationCards.length ? recommendationCards.map((card) => (
                    <div key={card.id} className="panel-cut border surface-strong p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.code}</p>
                          <p className="mt-1 text-lg heading-portal">{card.namePt || card.name}</p>
                          <p className="text-sm text-muted-portal">score {card.score} · {card.color} · custo {card.cost}</p>
                        </div>
                        <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => increment(card)}>Adicionar</Button>
                      </div>
                      <ul className="mt-3 space-y-1 text-sm text-soft">
                        {card.reasons.map((reason: string) => <li key={reason}>• {reason}</li>)}
                      </ul>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link href={`/cards/${card.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir carta</Link>
                        {card.keywords[0] ? <Link href={`/rules?relatedKeyword=${encodeURIComponent(card.keywords[0])}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Ver rulings</Link> : null}
                      </div>
                    </div>
                  )) : <p className="text-sm text-muted-portal">Ainda não há sinais suficientes para recomendar cartas. Monte um núcleo inicial ou limpe filtros muito restritos.</p>}
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

          {isAuthenticated ? (
            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-heading text-3xl uppercase heading-portal">Meus decks persistidos</h3>
                  {loadingDecks ? <Badge variant="outline" className="rounded-none border-white/20 text-soft">Atualizando</Badge> : null}
                </div>
                {decks.map((deck) => (
                  <div key={deck.id} className="panel-cut flex items-center justify-between gap-4 border surface-strong p-4">
                    <div>
                      <p className="text-lg heading-portal">{deck.name}</p>
                      <p className="text-sm text-muted-portal">{deck.items.reduce((sum, item) => sum + item.quantity, 0)} cartas · {deck.visibility.toLowerCase()} · {deck.isPrimary ? "primário" : "secundário"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={() => applyDeck(deck)}>Carregar</Button>
                      {deck.shareId ? <Link href={`/deck/${deck.shareId}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir</Link> : null}
                      <Button variant="ghost" className="rounded-none text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => removeDeck(deck.id)}><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-heading text-3xl uppercase heading-portal">Deck principal</h3>
                <Badge className={`rounded-none border ${stats.mainDeckCount === DECK_MAIN_SIZE ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-amber-400/40 bg-amber-400/10 text-amber-300"}`}>{stats.mainDeckCount}/{DECK_MAIN_SIZE}</Badge>
              </div>
              <div className="mt-6 space-y-3 max-h-[520px] overflow-auto pr-1">
                {mainDeckRows.length ? mainDeckRows.map((row) => <DeckRowCard key={row.printId || row.id} row={row} onIncrement={increment} onDecrement={decrement} />) : <p className="text-sm text-muted-portal">Seu deck principal ainda está vazio. Use a pool filtrada à esquerda para começar.</p>}
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
              <div className="mt-4 space-y-3 max-h-[280px] overflow-auto pr-1">
                {resourceDeckRows.length ? resourceDeckRows.map((row) => <DeckRowCard key={row.printId || row.id} row={row} onIncrement={increment} onDecrement={decrement} />) : <p className="text-sm text-muted-portal">Nenhuma carta de recurso adicionada ainda — filtre por tipo "Resource" na pool.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalShell>
  );
}
