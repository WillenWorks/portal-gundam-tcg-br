import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { api, mapApiCard, type ApiDeck } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CardRecord, DeckEntry } from "@/modules/core/types";

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

export default function DeckbuilderPage() {
  const { user, isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState(import.meta.env.DEV ? "admin@gundambr.local" : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? "admin123" : "");
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [decks, setDecks] = useState<ApiDeck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [deckName, setDeckName] = useState("Novo Deck");
  const [entries, setEntries] = useState<DeckEntry[]>([]);

  const loadCards = async () => {
    const result = await api.listCards();
    setCards(result.map(mapApiCard));
  };

  const loadDecks = async () => {
    if (!isAuthenticated) return;
    const result = await api.listMyDecks();
    setDecks(result);
    const primary = result.find((deck) => deck.isPrimary) ?? result[0];
    if (primary) {
      setSelectedDeckId(primary.id);
      setDeckName(primary.name);
      setEntries(primary.items.map((item) => ({ cardId: item.cardId, quantity: item.quantity })));
    }
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
      visibility: "PRIVATE",
      isPrimary: true,
      items: entries.map((item) => ({ ...item, section: "main" })),
    };

    if (selectedDeckId) await api.updateMyDeck(selectedDeckId, payload);
    else {
      const created = await api.createMyDeck(payload);
      setSelectedDeckId(created.id);
    }
    await loadDecks();
    toast.success("Deck salvo no backend.");
  };

  const createNewDeck = () => {
    setSelectedDeckId(null);
    setDeckName(`Novo Deck ${decks.length + 1}`);
    setEntries([]);
  };

  const removeDeck = async (id: string) => {
    await api.deleteMyDeck(id);
    await loadDecks();
    toast.success("Deck removido.");
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

              <div className="mt-6 flex flex-wrap gap-3">
                <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveDeck}><Save className="mr-2 size-4" />Salvar deck</Button>
                <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={createNewDeck}><Plus className="mr-2 size-4" />Novo deck</Button>
                <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Share2 className="mr-2 size-4" />Compartilhar</Button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="panel-cut border border-white/10 bg-slate-950/60 p-4"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Curva média</p><p className="mt-2 font-heading text-4xl text-white">{stats.avgCost}</p></div>
                <div className="panel-cut border border-white/10 bg-slate-950/60 p-4"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Custo baixo</p><p className="mt-2 font-heading text-4xl text-white">{stats.lowCostRate}%</p></div>
                <div className="panel-cut border border-white/10 bg-slate-950/60 p-4"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Cores</p><p className="mt-2 text-sm leading-7 text-slate-300">{Object.entries(stats.colorMap).map(([color, qty]) => `${color} ${qty}`).join(" · ") || "—"}</p></div>
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
                      <p className="text-sm text-slate-400">{deck.items.reduce((sum, item) => sum + item.quantity, 0)} cartas · {deck.isPrimary ? "primário" : "secundário"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => { setSelectedDeckId(deck.id); setDeckName(deck.name); setEntries(deck.items.map((item) => ({ cardId: item.cardId, quantity: item.quantity }))); }}>Carregar</Button>
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
