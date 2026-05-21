import { useEffect, useMemo, useState } from "react";
import { Share2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { usePortalDb } from "@/hooks/use-portal-db";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { catalogService, deckService } from "@/services/portal-service";

export default function DeckbuilderPage() {
  const { deck, cards } = usePortalDb();
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState(deck.entries);
  const [deckName, setDeckName] = useState(deck.name);

  useEffect(() => {
    setEntries(deck.entries);
    setDeckName(deck.name);
  }, [deck]);

  const searchPool = useMemo(() => catalogService.listCards(), [cards]);

  const filteredPool = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return searchPool;
    return searchPool.filter((card) =>
      [card.name, card.namePt, card.code, card.trait, card.series, ...card.keywords]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [query, searchPool]);

  const deckRows = useMemo(() => deckService.expandEntries(entries), [entries, cards]);
  const stats = useMemo(() => deckService.calculateStats(entries), [entries, cards]);

  const persistCurrentDeck = () => {
    deckService.persistDeck({ ...deck, name: deckName, entries });
    toast.success("Deck persistido no navegador.");
  };

  const increment = (cardId: string) => {
    setEntries((current) => {
      const found = current.find((item) => item.cardId === cardId);
      if (found) {
        return current.map((item) => (item.cardId === cardId ? { ...item, quantity: Math.min(4, item.quantity + 1) } : item));
      }
      return [...current, { cardId, quantity: 1 }];
    });
  };

  const decrement = (cardId: string) => {
    setEntries((current) =>
      current
        .map((item) => (item.cardId === cardId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0),
    );
  };

  return (
    <PortalShell>
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">MVP persistente</p>
                <h2 className="mt-2 font-heading text-4xl uppercase">Montagem inicial de deck</h2>
              </div>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar cartas para adicionar"
                className="max-w-sm rounded-none border-white/15 bg-slate-950/70 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="mt-6 space-y-3 max-h-[720px] overflow-auto pr-1">
              {filteredPool.map((card) => (
                <div key={card.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.code}</p>
                    <p className="mt-1 text-lg text-white">{card.namePt || card.name}</p>
                    <p className="text-sm text-slate-400">{card.color} · {card.type} · custo {card.cost}</p>
                  </div>
                  <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => increment(card.id)}>
                    Adicionar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Deck em edição</p>
                  <Input
                    value={deckName}
                    onChange={(event) => setDeckName(event.target.value)}
                    className="mt-3 rounded-none border-white/15 bg-slate-950/70 font-heading text-3xl uppercase text-white placeholder:text-slate-500"
                  />
                  <p className="mt-3 text-sm leading-7 text-slate-300">Formato {deck.format} · visibilidade {deck.visibility}</p>
                </div>
                <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{stats.mainDeckCount} cartas</Badge>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Curva média</p>
                  <p className="mt-2 font-heading text-4xl text-white">{stats.avgCost}</p>
                </div>
                <div className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Custo baixo</p>
                  <p className="mt-2 font-heading text-4xl text-white">{stats.lowCostRate}%</p>
                </div>
                <div className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Cores</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{Object.entries(stats.colorMap).map(([color, qty]) => `${color} ${qty}`).join(" · ") || "—"}</p>
                </div>
                <div className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Tipos</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{Object.entries(stats.typeMap).map(([type, qty]) => `${type} ${qty}`).join(" · ") || "—"}</p>
                </div>
              </div>

              <p className="mt-5 text-sm leading-7 text-slate-300">{stats.consistencyNote}</p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={persistCurrentDeck}>
                  <Save className="mr-2 size-4" /> Salvar deck
                </Button>
                <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <Share2 className="mr-2 size-4" /> Compartilhar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Lista atual</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase">Decklist</h3>
                </div>
              </div>

              <div className="mt-6 space-y-3 max-h-[640px] overflow-auto pr-1">
                {deckRows.map((row) => (
                  <div key={row.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{row.code}</p>
                      <p className="mt-1 text-lg text-white">{row.namePt || row.name}</p>
                      <p className="text-sm text-slate-400">{row.color} · {row.type} · custo {row.cost}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => decrement(row.id)}>
                        -
                      </Button>
                      <div className="min-w-10 text-center text-lg text-white">{row.quantity}</div>
                      <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => increment(row.id)}>
                        +
                      </Button>
                      <Button variant="ghost" className="rounded-none text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => decrement(row.id)}>
                        <Trash2 className="size-4" />
                      </Button>
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
