/* Minha área v9 — hub do usuário com atalhos reais para decks, pastas e configurações, apenas após autenticação. */
import { useEffect, useState } from "react";
import { BookMarked, Settings, Swords } from "lucide-react";
import { Link } from "wouter";

import { useAuth } from "@/contexts/AuthContext";
import { api, type ApiBinder, type ApiDeck } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DECK_MAIN_SIZE, NON_COUNTED_SECTIONS } from "@/lib/deck-legality";

const shortcuts = [
  { label: "Novo deck", href: "/deckbuilder/new", icon: Swords },
  { label: "Pastas", href: "/binders", icon: BookMarked },
  { label: "Configurações", href: "/profile", icon: Settings },
] as const;

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
  const mainDeckCount = (deck: ApiDeck) => deck.items.filter((item) => item.section !== "resource" && !NON_COUNTED_SECTIONS.has(item.section)).reduce((sum, item) => sum + item.quantity, 0);

  return (
    <PortalShell breadcrumbs={[{ label: "Minha Área" }]}>
      <div className="space-y-8">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6 lg:p-8 2xl:p-10">
            <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-primary">Área do usuário</Badge>
            <h2 className="mt-5 max-w-5xl font-heading text-5xl uppercase leading-[0.9] sm:text-6xl 2xl:text-7xl">Bem-vindo, <span className="text-primary">{user?.displayName}</span>.</h2>
            <p className="mt-5 max-w-4xl text-sm leading-7 text-slate-300">Seus decks, pastas de cartas e preferências de conta, tudo num só lugar.</p>
            <div className="mt-7 grid grid-cols-3 gap-3 sm:max-w-md">
              {shortcuts.map((shortcut) => (
                <Link key={shortcut.href} href={shortcut.href} className="group flex flex-col items-center gap-2 border border-white/15 bg-white/5 px-3 py-4 text-center transition hover:border-primary/50 hover:bg-white/10 light:border-slate-300/80 light:bg-white/70">
                  <shortcut.icon className="size-6 text-primary transition group-hover:scale-110" />
                  <span className="text-[11px] uppercase tracking-[0.14em] text-slate-300 light:text-slate-700">{shortcut.label}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {[
            ["Decks salvos", String(decks.length), "Todos os decks que você já começou a montar."],
            ["Decks públicos", String(publicDecks.length), "Com link compartilhável ativo pra qualquer um ver."],
            ["Pastas", String(binders.length), "Suas listas organizadas — coleção, trocas, o que quiser."],
            ["Cartas guardadas", String(binderItemTotal), "Total de cartas registradas em todas as pastas."],
          ].map(([label, value, caption]) => (
            <Card key={label} className="panel-cut rounded-none surface-panel">
              <CardContent className="p-5 2xl:p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">{label}</p>
                <p className="mt-4 font-heading text-5xl leading-none">{value}</p>
                <p className="mt-3 text-xs leading-5 text-slate-500">{caption}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="panel-cut rounded-none surface-panel">
          <CardContent className="p-6 2xl:p-7">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Meus decks</p>
            <div className="mt-5 space-y-4">
              {decks.length ? decks.map((deck) => (
                <div key={deck.id} className="panel-cut border surface-strong p-4 dark:bg-slate-950/60 light:border-slate-300/80 light:bg-slate-50">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg dark:text-white light:text-slate-900">{deck.name}</p>
                      <p className="mt-2 text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{mainDeckCount(deck)}/{DECK_MAIN_SIZE} · {deck.visibility.toLowerCase()}</p>
                    </div>
                    {deck.visibility !== "PRIVATE" ? <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">share ativo</Badge> : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link href={`/deckbuilder/${deck.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] nav-hover-soft dark:text-white light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir deck no editor</Link>
                    {deck.visibility !== "PRIVATE" ? <Link href={`/deck/${deck.shareId}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] nav-hover-soft dark:text-white light:border-slate-400/90 light:bg-white light:text-slate-950">Ver versão pública</Link> : null}
                  </div>
                </div>
              )) : <p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">Nenhum deck salvo ainda — que tal começar um?</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}
