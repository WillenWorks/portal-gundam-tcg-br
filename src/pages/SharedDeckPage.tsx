/* Deck compartilhado v8 — leitura pública com estatísticas rápidas e lista estruturada. */
import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";

import { api, mapApiCard, type ApiDeck } from "@/lib/api";
import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function SharedDeckPage() {
  const [, params] = useRoute<{ shareId: string }>("/deck/:shareId");
  const [deck, setDeck] = useState<ApiDeck | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params?.shareId) return;
    api.getSharedDeck(params.shareId).then(setDeck).catch((err) => setError(err.message));
  }, [params?.shareId]);

  const rows = useMemo(() => {
    if (!deck) return [];
    return deck.items.map((item) => {
      const card = item.card ? mapApiCard(item.card) : null;
      return card ? { ...card, quantity: item.quantity, section: item.section } : null;
    }).filter(Boolean) as Array<ReturnType<typeof mapApiCard> & { quantity: number; section: string }>;
  }, [deck]);

  const stats = useMemo(() => {
    const total = rows.reduce((sum, item) => sum + item.quantity, 0);
    const avgCost = total ? rows.reduce((sum, item) => sum + item.cost * item.quantity, 0) / total : 0;
    return { total, avgCost: avgCost.toFixed(2), unique: rows.length };
  }, [rows]);

  return (
    <PublicShell title={deck?.name || "Deck compartilhado"} description="Versão pública estática para estudo da lista, sem abrir o modo de edição do dashboard.">
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6">
            {error ? <p className="text-sm text-red-300">{error}</p> : !deck ? <p className="text-sm text-slate-300 dark:text-slate-300 light:text-slate-600">Carregando deck compartilhado...</p> : (
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Share link público</p>
                  <p className="mt-3 text-sm text-slate-300 dark:text-slate-300 light:text-slate-600">Owner: {deck.user?.displayName || "Usuário"}</p>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{deck.notes || "Sem notas públicas."}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{stats.total} cartas</Badge>
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{stats.unique} únicas</Badge>
                  <Badge className="rounded-none border border-white/15 bg-white/5 dark:text-slate-200 light:text-slate-700">curva {stats.avgCost}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
          <CardContent className="p-6">
            <h3 className="font-heading text-3xl uppercase">Lista pública</h3>
            <div className="mt-6 space-y-3">
              {rows.map((row) => (
                <div key={`${row.id}-${row.section}`} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{row.code} · {row.section}</p>
                    <p className="mt-1 text-lg">{row.namePt || row.name}</p>
                    <p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{row.color} · {row.type} · custo {row.cost}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-heading text-primary">x{row.quantity}</div>
                    <Link href={`/cards/${row.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900">Abrir carta</Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
