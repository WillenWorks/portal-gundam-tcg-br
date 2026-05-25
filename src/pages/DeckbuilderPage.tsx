/* Deckbuilder tático — filtros reais da pool, persistência por usuário, diagnóstico operacional e navegação contextual. */
import { useEffect, useMemo, useState } from "react";
import { Copy, Plus, Save, Share2, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { useAuth } from "@/contexts/AuthContext";
import { api, mapApiCard, type ApiDeck, type CardFilters } from "@/lib/api";
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

function calculateStats(cards: CardRecord[], entries: DeckEntry[]) {
  const expanded = entries
    .map((entry) => {
      const card = cards.find((item) => item.id === entry.cardId);
      return card ? { ...card, quantity: entry.quantity } : null;
    })
    .filter(Boolean) as (CardRecord & { quantity: number })[];

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
  const [poolFilters, setPoolFilters] = useState<PoolFilters>(defaultPoolFilters);
  const [poolQueryDraft, setPoolQueryDraft] = useState("");
  const [poolMeta, setPoolMeta] = useState<PoolMeta>({ colors: [], cardTypes: [], series: [], traits: [], keywords: [], sets: [] });
  const [loadingPool, setLoadingPool] = useState(true);
  const [loadingDecks, setLoadingDecks] = useState(false);
  const [poolPage, setPoolPage] = useState(1);
  const [poolPageSize] = useState(24);
  const [poolTotal, setPoolTotal] = useState(0);
  const [poolTotalPages, setPoolTotalPages] = useState(1);

  const loadCards = async (filters: PoolFilters = poolFilters, page: number = poolPage) => {
    setLoadingPool(true);
    try {
      const result = await api.listCardsPage({ ...filters, sort: "code_asc" }, { page, pageSize: poolPageSize });
      setCards(result.items.map(mapApiCard));
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

  const applyDeck = (deck: ApiDeck) => {
    setSelectedDeckId(deck.id);
    setSelectedShareId(deck.shareId);
    setDeckName(deck.name);
    setVisibility(deck.visibility);
    setEntries(deck.items.map((item) => ({ cardId: item.cardId, quantity: item.quantity })));
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
          const card = cards.find((item) => item.id === entry.cardId);
          return card ? { ...card, quantity: entry.quantity } : null;
        })
        .filter(Boolean) as (CardRecord & { quantity: number })[],
    [entries, cards],
  );

  const stats = useMemo(() => calculateStats(cards, entries), [cards, entries]);

  const curveData = useMemo(() => {
    const map = new Map<number, number>();
    deckRows.forEach((row) => map.set(row.cost, (map.get(row.cost) ?? 0) + row.quantity));
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([cost, quantity]) => ({ cost: String(cost), quantity }));
  }, [deckRows]);

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
    deckRows.forEach((row) => {
      const key = row.series || "";
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + row.quantity);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }, [deckRows]);

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
    const existing = new Set(entries.map((item) => item.cardId));
    return cards
      .filter((card) => !existing.has(card.id))
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
  }, [cards, entries, dominantColor, dominantTrait, dominantSeries, deckRows, stats.lowCostRate]);

  const setPoolFilter = (key: keyof PoolFilters, value: string) => {
    setPoolPage(1);
    setPoolFilters((current) => ({ ...current, [key]: value }));
  };
  const resetPoolFilters = () => {
    setPoolPage(1);
    setPoolQueryDraft("");
    setPoolFilters(defaultPoolFilters);
  };

  const increment = (cardId: string) => {
    setEntries((current) => {
      const found = current.find((item) => item.cardId === cardId);
      if (found) return current.map((item) => (item.cardId === cardId ? { ...item, quantity: Math.min(4, item.quantity + 1) } : item));
      return [...current, { cardId, quantity: 1 }];
    });
  };

  const decrement = (cardId: string) => {
    setEntries((current) => current.map((item) => (item.cardId === cardId ? { ...item, quantity: item.quantity - 1 } : item)).filter((item) => item.quantity > 0));
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
      items: entries.map((item) => ({ ...item, section: "main" })),
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
    setEntries([]);
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
    const text = deckRows.map((row) => `${row.quantity}x ${row.code} - ${row.namePt || row.name}`).join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("Decklist copiada em texto.");
  };

  return (
    <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Deckbuilder" }]}>
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Deckbuilder via API</p>
                <h2 className="mt-2 font-heading text-4xl uppercase">Pool filtrada para montar o deck</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">A pool agora pode ser refinada por cor, tipo, série e trait antes de entrar na lista. Isso acelera montagem, revisão e testes por arquétipo.</p>
              </div>
            </div>

            {!isAuthenticated ? (
              <div className="mt-6 panel-cut border border-white/10 bg-slate-950/60 p-5">
                <p className="text-sm leading-7 text-slate-300">Faça login para salvar múltiplos decks por usuário no backend Prisma.</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Senha" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
                </div>
                <Button className="mt-4 rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => login(email, password)}>Entrar</Button>
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <Input value={poolQueryDraft} onChange={(e) => setPoolQueryDraft(e.target.value)} placeholder="Nome, código, série ou trait" className="rounded-none border-white/15 bg-slate-950/70 text-white placeholder:text-slate-500 xl:col-span-2" />
              <select value={poolFilters.color} onChange={(e) => setPoolFilter("color", e.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white"><option value="">Todas as cores</option>{poolMeta.colors.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={poolFilters.cardType} onChange={(e) => setPoolFilter("cardType", e.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white"><option value="">Todos os tipos</option>{poolMeta.cardTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={poolFilters.series} onChange={(e) => setPoolFilter("series", e.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white"><option value="">Todas as séries</option>{poolMeta.series.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={poolFilters.trait} onChange={(e) => setPoolFilter("trait", e.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white"><option value="">Todas as traits</option>{poolMeta.traits.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{poolTotal} cartas encontradas</Badge>
              <Badge variant="outline" className="rounded-none border-white/20 text-slate-300">{poolActiveFilters} filtros ativos</Badge>
              <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={resetPoolFilters}>Limpar filtros</Button>
            </div>

            <div className="mt-6 space-y-3 max-h-[760px] overflow-auto pr-1">
              {loadingPool ? <p className="text-sm text-slate-400">Carregando pool filtrada...</p> : null}
              {!loadingPool && !cards.length ? <p className="text-sm text-slate-400">Nenhuma carta encontrada nessa combinação de filtros.</p> : null}
              {cards.map((card) => {
                const qtyInDeck = entries.find((item) => item.cardId === card.id)?.quantity ?? 0;
                return (
                  <div key={card.id} className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.code}</p>
                        <p className="mt-1 text-lg text-white">{card.namePt || card.name}</p>
                        <p className="text-sm text-slate-400">{card.color} · {card.type} · custo {card.cost} · {card.trait || "sem trait"}</p>
                      </div>
                      <Badge variant="outline" className="rounded-none border-white/20 text-slate-300">no deck: {qtyInDeck}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => increment(card.id)}>Adicionar</Button>
                      <Link href={`/cards/${card.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Abrir carta</Link>
                      {card.keywords[0] ? <Link href={`/rules?relatedKeyword=${encodeURIComponent(card.keywords[0])}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Ver rulings</Link> : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Página {poolPage} de {poolTotalPages} · exibindo {cards.length} de {poolTotal} resultados</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white disabled:opacity-40" disabled={poolPage <= 1 || loadingPool} onClick={() => setPoolPage((current) => Math.max(1, current - 1))}>Anterior</Button>
                <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white disabled:opacity-40" disabled={poolPage >= poolTotalPages || loadingPool} onClick={() => setPoolPage((current) => Math.min(poolTotalPages, current + 1))}>Próxima</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Sessão atual</p>
                  <p className="mt-2 text-sm text-slate-300">{user ? `${user.displayName} · ${user.role}` : "Visitante"}</p>
                  <Input value={deckName} onChange={(e) => setDeckName(e.target.value)} className="mt-4 rounded-none border-white/15 bg-slate-950/70 font-heading text-3xl uppercase text-white" />
                </div>
                <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{stats.mainDeckCount} cartas</Badge>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(["PRIVATE", "UNLISTED", "PUBLIC"] as DeckVisibility[]).map((mode) => (
                  <button key={mode} type="button" onClick={() => setVisibility(mode)} className={`rounded-none border px-3 py-2 text-xs uppercase tracking-[0.18em] transition ${visibility === mode ? "border-primary/40 bg-primary/12 text-white" : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"}`}>
                    {mode}
                  </button>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveDeck}><Save className="mr-2 size-4" />Salvar deck</Button>
                <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={createNewDeck}><Plus className="mr-2 size-4" />Novo deck</Button>
                <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={copyShareLink}><Share2 className="mr-2 size-4" />Compartilhar</Button>
                <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={copyDecklist}><Copy className="mr-2 size-4" />Copiar decklist</Button>
                {selectedShareId ? <Button variant="ghost" className="rounded-none text-slate-300 hover:bg-white/10 hover:text-white" onClick={copyShareLink}><Copy className="mr-2 size-4" />{selectedShareId}</Button> : null}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="panel-cut border border-white/10 bg-slate-950/60 p-4"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Curva média</p><p className="mt-2 font-heading text-4xl text-white">{stats.avgCost}</p></div>
                <div className="panel-cut border border-white/10 bg-slate-950/60 p-4"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Custo baixo</p><p className="mt-2 font-heading text-4xl text-white">{stats.lowCostRate}%</p></div>
                <div className="panel-cut border border-white/10 bg-slate-950/60 p-4"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Traço dominante</p><p className="mt-2 text-sm leading-7 text-slate-300">{topTraits[0] ? `${topTraits[0][0]} · ${topTraits[0][1]}` : "—"}</p></div>
              </div>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Diagnóstico operacional</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase">Leitura rápida do deck</h3>
                </div>
                <div className="panel-cut border border-primary/30 bg-primary/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Sinergia estimada</p>
                  <p className="mt-2 font-heading text-4xl text-white">{synergyScore}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-primary">{synergyLabel}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {diagnostics.map((item) => (
                  <div key={item.label} className={`panel-cut border p-4 ${item.kind === "ok" ? "border-primary/30 bg-primary/10" : "border-amber-400/30 bg-amber-500/10"}`}>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                    <p className="mt-2 text-sm leading-7 text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Blocos por arquétipo</p>
                <h3 className="mt-2 font-heading text-3xl uppercase">Identidade atual da lista</h3>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {archetypeBlocks.length ? archetypeBlocks.map((block) => (
                    <div key={block.label} className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{block.label}</p>
                      <p className="mt-2 text-lg text-white">{block.value}</p>
                      <p className="mt-2 text-sm text-slate-400">{block.hint}</p>
                    </div>
                  )) : <p className="text-sm text-slate-400">Adicione mais cartas para o sistema identificar melhor o arquétipo.</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Sugestões de contexto</p>
                <h3 className="mt-2 font-heading text-3xl uppercase">Recomendações por carta</h3>
                <div className="mt-6 space-y-4">
                  {recommendationCards.length ? recommendationCards.map((card) => (
                    <div key={card.id} className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.code}</p>
                          <p className="mt-1 text-lg text-white">{card.namePt || card.name}</p>
                          <p className="text-sm text-slate-400">score {card.score} · {card.color} · custo {card.cost}</p>
                        </div>
                        <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => increment(card.id)}>Adicionar</Button>
                      </div>
                      <ul className="mt-3 space-y-1 text-sm text-slate-300">
                        {card.reasons.map((reason: string) => <li key={reason}>• {reason}</li>)}
                      </ul>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link href={`/cards/${card.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Abrir carta</Link>
                        {card.keywords[0] ? <Link href={`/rules?relatedKeyword=${encodeURIComponent(card.keywords[0])}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Ver rulings</Link> : null}
                      </div>
                    </div>
                  )) : <p className="text-sm text-slate-400">Ainda não há sinais suficientes para recomendar cartas. Monte um núcleo inicial ou limpe filtros muito restritos.</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Gráfico 01</p>
                    <h3 className="mt-2 font-heading text-3xl uppercase">Curva de custo</h3>
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

            <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Gráfico 02</p>
                <h3 className="mt-2 font-heading text-3xl uppercase">Distribuição por cor</h3>
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

          <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Gráfico 03</p>
              <h3 className="mt-2 font-heading text-3xl uppercase">Composição por tipo</h3>
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
            <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-heading text-3xl uppercase">Meus decks persistidos</h3>
                  {loadingDecks ? <Badge variant="outline" className="rounded-none border-white/20 text-slate-300">Atualizando</Badge> : null}
                </div>
                {decks.map((deck) => (
                  <div key={deck.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4">
                    <div>
                      <p className="text-lg text-white">{deck.name}</p>
                      <p className="text-sm text-slate-400">{deck.items.reduce((sum, item) => sum + item.quantity, 0)} cartas · {deck.visibility.toLowerCase()} · {deck.isPrimary ? "primário" : "secundário"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => applyDeck(deck)}>Carregar</Button>
                      {deck.shareId ? <Link href={`/deck/${deck.shareId}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Abrir</Link> : null}
                      <Button variant="ghost" className="rounded-none text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => removeDeck(deck.id)}><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
            <CardContent className="p-6">
              <h3 className="font-heading text-3xl uppercase">Decklist atual</h3>
              <div className="mt-6 space-y-3 max-h-[520px] overflow-auto pr-1">
                {deckRows.length ? deckRows.map((row) => (
                  <div key={row.id} className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{row.code}</p>
                        <p className="mt-1 text-lg text-white">{row.namePt || row.name}</p>
                        <p className="text-sm text-slate-400">{row.color} · {row.type} · custo {row.cost} · {row.trait || "sem trait"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => decrement(row.id)}>-</Button>
                        <div className="min-w-10 text-center text-lg text-white">{row.quantity}</div>
                        <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => increment(row.id)}>+</Button>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link href={`/cards/${row.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Abrir carta</Link>
                      {row.keywords[0] ? <Link href={`/rules?relatedKeyword=${encodeURIComponent(row.keywords[0])}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Rulings</Link> : null}
                    </div>
                  </div>
                )) : <p className="text-sm text-slate-400">Sua decklist ainda está vazia. Use a pool filtrada à esquerda para começar.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalShell>
  );
}
