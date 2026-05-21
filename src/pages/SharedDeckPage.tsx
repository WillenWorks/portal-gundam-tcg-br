/* Deck compartilhado — leitura pública via shareId com owner e lista principal. */
import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";

import { api, mapApiCard, type ApiDeck } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
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

  return (
    <PortalShell>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white">
          <CardContent className="p-6">
            {error ? (
              <p className="text-sm text-red-300">{error}</p>
            ) : !deck ? (
              <p className="text-sm text-slate-300">Carregando deck compartilhado...</p>
            ) : (
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Share link público</p>
                  <h2 className="mt-2 font-heading text-5xl uppercase">{deck.name}</h2>
                  <p className="mt-3 text-sm text-slate-300">Owner: {deck.user?.displayName || "Usuário"}{deck.user?.username ? <> · <Link href={`/u/${deck.user.username}`} className="text-primary underline-offset-4 hover:underline">@{deck.user.username}</Link></> : null}</p>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{deck.notes || "Sem notas públicas."}</p>
                </div>
                <div className="flex flex-col gap-3">
                  <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{rows.reduce((sum, item) => sum + item.quantity, 0)} cartas</Badge>
                  <Badge className="rounded-none border border-white/15 bg-white/5 text-slate-200">{deck.format}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
          <CardContent className="p-6">
            <h3 className="font-heading text-3xl uppercase">Lista pública</h3>
            <div className="mt-6 space-y-3">
              {rows.map((row) => (
                <div key={`${row.id}-${row.section}`} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{row.code} · {row.section}</p>
                    <p className="mt-1 text-lg text-white">{row.namePt || row.name}</p>
                    <p className="text-sm text-slate-400">{row.color} · {row.type} · custo {row.cost}</p>
                  </div>
                  <div className="text-2xl font-heading text-primary">x{row.quantity}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}
