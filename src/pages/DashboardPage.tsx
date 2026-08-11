/* Minha área v8.1 — hub do usuário com atalhos reais para decks, pastas e configurações, apenas após autenticação. */
import { useEffect, useState } from "react";
import { Link } from "wouter";

import { useAuth } from "@/contexts/AuthContext";
import { api, type ApiBinder, type ApiDeck } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  const { user } = useAuth();
  const [decks, setDecks] = useState<ApiDeck[]>([]);
  const [binders, setBinders] = useState<ApiBinder[]>([]);

  useEffect(() => {
    Promise.all([api.listMyDecks(), api.listMyBinders()])
      .then(([deckRows, binderRows]) => {
        setDecks(deckRows);
        setBinders(binderRows);
      })
      .catch(() => undefined);
  }, []);

  const publicDecks = decks.filter((deck) => deck.visibility === "PUBLIC");
  const binderItemTotal = binders.reduce((sum, binder) => sum + binder.items.length, 0);

  return (
    <PortalShell breadcrumbs={[{ label: "Minha Área" }]}> 
      <div className="space-y-8">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6 lg:p-8 2xl:p-10">
            <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-primary">Área do usuário</Badge>
            <h2 className="mt-5 max-w-5xl font-heading text-5xl uppercase leading-[0.9] sm:text-6xl 2xl:text-7xl">Bem-vindo, <span className="text-primary">{user?.displayName}</span>.</h2>
            <p className="mt-5 max-w-4xl text-sm leading-7 text-slate-300">Seu dashboard concentra decks, configurações, idioma das cartas e binders organizados do seu jeito, com compartilhamento externo.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90"><Link href="/deckbuilder">Criar / editar deck</Link></Button>
              <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"><Link href="/profile">Abrir configurações</Link></Button>
              <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"><Link href="/binders">Meus binders</Link></Button>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {[
            ["Decks salvos", String(decks.length)],
            ["Decks públicos", String(publicDecks.length)],
            ["Binders", String(binders.length)],
            ["Cartas guardadas", String(binderItemTotal)],
          ].map(([label, value]) => (
            <Card key={label} className="panel-cut rounded-none surface-panel"><CardContent className="p-5 2xl:p-6"><p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">{label}</p><p className="mt-4 font-heading text-5xl leading-none">{value}</p></CardContent></Card>
          ))}
        </section>

        <section className="grid gap-6 2xl:grid-cols-[0.86fr_1.14fr]">
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6 2xl:p-7">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Atalhos</p>
              <div className="mt-5 space-y-4">
                {[["Criar deck novo", "/deckbuilder/new"],["Configurações do usuário", "/profile"],["Meus binders", "/binders"]].map(([label, href]) => (
                  <Link key={href} href={href} className="panel-cut block border border-white/10 bg-slate-950/60 p-4 text-lg transition hover:bg-white/10 dark:bg-slate-950/60 dark:text-white light:border-slate-300/80 light:bg-slate-50 light:text-slate-900">{label}</Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6 2xl:p-7">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Meus decks</p>
              <div className="mt-5 space-y-4">
                {decks.length ? decks.map((deck) => (
                  <div key={deck.id} className="panel-cut border surface-strong p-4 dark:bg-slate-950/60 light:border-slate-300/80 light:bg-slate-50">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg dark:text-white light:text-slate-900">{deck.name}</p>
                        <p className="mt-2 text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{deck.items.reduce((sum, item) => sum + item.quantity, 0)} cartas · {deck.visibility.toLowerCase()}</p>
                      </div>
                      {deck.visibility !== "PRIVATE" ? <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">share ativo</Badge> : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link href={`/deckbuilder/${deck.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] nav-hover-soft dark:text-white light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir deck no editor</Link>
                      {deck.visibility !== "PRIVATE" ? <Link href={`/deck/${deck.shareId}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] nav-hover-soft dark:text-white light:border-slate-400/90 light:bg-white light:text-slate-950">Ver versão pública</Link> : null}
                    </div>
                  </div>
                )) : <p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">Nenhum deck salvo ainda.</p>}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </PortalShell>
  );
}
