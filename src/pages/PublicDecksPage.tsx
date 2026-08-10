/* Decks públicos v8 — cards compactos, autor, data e navegação para leitura pública. */
import { useEffect, useState } from "react";
import { Link } from "wouter";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FeaturedCoverImage } from "@/components/deck/FeaturedCoverImage";
import { NON_COUNTED_SECTIONS } from "@/lib/deck-legality";
import { api, type ApiDeck } from "@/lib/api";

export default function PublicDecksPage() {
  const [decks, setDecks] = useState<ApiDeck[]>([]);

  useEffect(() => {
    api.listPublicDecksPage({ page: 1, pageSize: 24 }).then((result) => setDecks(result.items)).catch(() => undefined);
  }, []);

  return (
    <PublicShell breadcrumbs={[{ label: "Decks Públicos" }]} title="Decks públicos" description="Listas compartilhadas pela comunidade para estudo, referência e comparação de build.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {decks.map((deck) => {
          const quantity = deck.items.filter((item) => !NON_COUNTED_SECTIONS.has(item.section)).reduce((sum, item) => sum + item.quantity, 0);
          return (
            <Card key={deck.id} className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
              <CardContent className="space-y-4 p-4">
                <Link href={`/deck/${deck.shareId}`} className="block overflow-hidden border border-white/10 bg-slate-950/60 aspect-[16/7] dark:bg-slate-950/60 light:bg-slate-100">
                  {deck.coverImage ? <img src={deck.coverImage} alt={deck.name} className="h-full w-full object-cover" /> : <FeaturedCoverImage cards={deck.featuredCards} fallbackLabel="Deck público" />}
                </Link>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{deck.user?.displayName || "Usuário"}</p>
                    <h3 className="mt-2 font-heading text-2xl uppercase leading-none">{deck.name}</h3>
                    <p className="mt-2 text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{deck.createdAt ? new Date(deck.createdAt).toLocaleDateString("pt-BR") : "sem data"}</p>
                  </div>
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{quantity} cartas</Badge>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/deck/${deck.shareId}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900">Abrir deck</Link>
                  <span className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400 light:text-slate-500">Perfil social em breve</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PublicShell>
  );
}
