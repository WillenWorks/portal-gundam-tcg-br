/* Decks públicos — vitrine aberta com owners, quantidade de cartas e atalho para os links compartilhados. */
import { useEffect, useState } from "react";
import { Link } from "wouter";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api, type ApiDeck } from "@/lib/api";

export default function PublicDecksPage() {
  const [decks, setDecks] = useState<ApiDeck[]>([]);

  useEffect(() => {
    api.listPublicDecks().then(setDecks).catch(() => undefined);
  }, []);

  return (
    <PublicShell breadcrumbs={[{ label: "Decks Públicos" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Área pública</p>
                <h2 className="mt-2 font-heading text-5xl uppercase">Decks compartilhados pela comunidade</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">Mesmo sem login, o usuário já consegue navegar nas listas públicas, abrir perfis e estudar construções abertas do meta.</p>
              </div>
              <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{decks.length} decks</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {decks.map((deck) => (
            <Card key={deck.id} className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Deck público</p>
                    <h3 className="mt-2 font-heading text-3xl uppercase leading-none">{deck.name}</h3>
                  </div>
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{deck.items.reduce((sum, item) => sum + item.quantity, 0)} cartas</Badge>
                </div>
                <p className="text-sm leading-7 text-slate-300">Owner: {deck.user?.displayName || "Usuário"}{deck.user?.username ? ` · @${deck.user.username}` : ""}</p>
                <p className="text-sm leading-7 text-slate-300">{deck.notes || "Sem notas públicas."}</p>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/deck/${deck.shareId}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Abrir deck</Link>
                  {deck.user?.username ? <Link href={`/u/${deck.user.username}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Abrir perfil</Link> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
