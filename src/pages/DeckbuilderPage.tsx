import { useEffect, useMemo, useState } from "react";
import { Copy, Plus, Save, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { useAuth } from "@/contexts/AuthContext";
import { api, mapApiCard, type ApiDeck } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import type { CardRecord, DeckEntry } from "@/modules/core/types";

type DeckVisibility = "PRIVATE" | "UNLISTED" | "PUBLIC";

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

  return {
    mainDeckCount,
    lowCostRate: mainDeckCount ? Math.round((lowCostCount / mainDeckCount) * 100) : 0,
    avgCost: avgCost.toFixed(2),
    colorMap: expanded.reduce<Record<string, number>>((acc, item) => {
      acc[item.color] = (acc[item.color] ?? 0) + item.quantity;
      return acc;
    }, {}),
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
  const [query, setQuery] = useState("");
  const [deckName, setDeckName] = useState("Novo Deck");
  const [entries, setEntries] = useState<DeckEntry[]>([]);
  const [visibility, setVisibility] = useState<DeckVisibility>("PRIVATE");

  const loadCards = async () => {
    const result = await api.listCards();
    setCards(result.map(mapApiCard));
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
    const result = await api.listMyDecks();
    setDecks(result);
    const primary = result.find((deck) => deck.isPrimary) ?? result[0];
    if (primary) applyDeck(primary);
  };

  useEffect(() => {
    loadCards().catch(() => undefined);
  }, []);

  useEffect(() => {
    loadDecks().catch(() => undefined);
  }, [isAuthenticated]);

  const filteredPool = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((card) => [card.name, card.namePt, card.code, card.series, card.trait, ...card.keywords].some((value) => String(value).toLowerCase().includes(q)));
  }, [query, cards]);

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

  const typeData = useMemo(() => {
    const map = new Map<string, number>();
    deckRows.forEach((row) => map.set(row.type, (map.get(row.type) ?? 0) + row.quantity));
    return Array.from(map.entries()).map(([name, quantity]) => ({ name, quantity }));
  }, [deckRows]);

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

  return (
    <PortalShell>
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Deckbuilder via API</p>
                <h2 className="mt-2 font-heading text-4xl uppercase">Múltiplos decks por usuário</h2>
              </div>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cartas para adicionar" className="max-w-sm rounded-none border-white/15 bg-slate-950/70 text-white placeholder:text-slate-500" />
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

            <div className="mt-6 space-y-3 max-h-[740px] overflow-auto pr-1">
              {filteredPool.map((card) => (
                <div key={card.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.code}</p>
                    <p className="mt-1 text-lg text-white">{card.namePt || card.name}</p>
                    <p className="text-sm text-slate-400">{card.color} · {card.type} · custo {card.cost}</p>
                  </div>
                  <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => increment(card.id)}>Adicionar</Button>
                </div>
              ))}
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
                {selectedShareId ? <Button variant="ghost" className="rounded-none text-slate-300 hover:bg-white/10 hover:text-white" onClick={copyShareLink}><Copy className="mr-2 size-4" />{selectedShareId}</Button> : null}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="panel-cut border border-white/10 bg-slate-950/60 p-4"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Curva média</p><p className="mt-2 font-heading text-4xl text-white">{stats.avgCost}</p></div>
                <div className="panel-cut border border-white/10 bg-slate-950/60 p-4"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Custo baixo</p><p className="mt-2 font-heading text-4xl text-white">{stats.lowCostRate}%</p></div>
                <div className="panel-cut border border-white/10 bg-slate-950/60 p-4"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Cores</p><p className="mt-2 text-sm leading-7 text-slate-300">{Object.entries(stats.colorMap).map(([color, qty]) => `${color} ${qty}`).join(" · ") || "—"}</p></div>
              </div>
            </CardContent>
          </Card>

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
                <h3 className="font-heading text-3xl uppercase">Meus decks persistidos</h3>
                {decks.map((deck) => (
                  <div key={deck.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4">
                    <div>
                      <p className="text-lg text-white">{deck.name}</p>
                      <p className="text-sm text-slate-400">{deck.items.reduce((sum, item) => sum + item.quantity, 0)} cartas · {deck.visibility.toLowerCase()} · {deck.isPrimary ? "primário" : "secundário"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => applyDeck(deck)}>Carregar</Button>
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
                {deckRows.map((row) => (
                  <div key={row.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{row.code}</p>
                      <p className="mt-1 text-lg text-white">{row.namePt || row.name}</p>
                      <p className="text-sm text-slate-400">{row.color} · {row.type} · custo {row.cost}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => decrement(row.id)}>-</Button>
                      <div className="min-w-10 text-center text-lg text-white">{row.quantity}</div>
                      <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => increment(row.id)}>+</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalShell>
  );
}
