/* Minha área v8 — hub do usuário com atalhos reais para decks, pastas e configurações. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

import { useAuth } from "@/contexts/AuthContext";
import { api, type ApiBinder, type ApiDeck } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function DashboardPage() {
  const { user, isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState(import.meta.env.DEV ? "pilot@gundambr.local" : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? "pilot123" : "");
  const [decks, setDecks] = useState<ApiDeck[]>([]);
  const [binders, setBinders] = useState<ApiBinder[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([api.listMyDecks(), api.listMyBinders()]).then(([deckRows, binderRows]) => {
      setDecks(deckRows);
      setBinders(binderRows);
    }).catch(() => undefined);
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <PortalShell breadcrumbs={[{ label: "Minha Área" }]}> 
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white dark:text-white light:text-slate-900">
          <CardContent className="space-y-5 p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Área pessoal</p>
              <h2 className="mt-2 font-heading text-5xl uppercase">Entre para acessar seus recursos</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">Decks, listas compartilháveis, configurações e preferências de idioma ficam centralizados aqui.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-none" />
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Senha" className="rounded-none" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => login(email, password)}>Entrar</Button>
              <Button asChild variant="outline" className="rounded-none"><Link href="/decks">Explorar decks públicos</Link></Button>
            </div>
          </CardContent>
        </Card>
      </PortalShell>
    );
  }

  const publicDecks = decks.filter((deck) => deck.visibility === "PUBLIC");
  const wishlist = binders.find((item) => item.kind === "WISHLIST");
  const owned = binders.find((item) => item.kind === "OWNED");

  return (
    <PortalShell breadcrumbs={[{ label: "Minha Área" }]}> 
      <div className="space-y-8">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white dark:text-white light:text-slate-900">
          <CardContent className="p-6 lg:p-8">
            <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-primary">Área do usuário</Badge>
            <h2 className="mt-5 font-heading text-6xl uppercase leading-[0.9]">Bem-vindo, <span className="text-primary">{user?.displayName}</span>.</h2>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">Seu dashboard agora concentra decks, configurações, idioma das cartas, wishlist e cartas possuídas com compartilhamento externo.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90"><Link href="/deckbuilder">Criar / editar deck</Link></Button>
              <Button asChild variant="outline" className="rounded-none"><Link href="/profile">Abrir configurações</Link></Button>
              <Button asChild variant="outline" className="rounded-none"><Link href="/wishlist">Lista de desejos</Link></Button>
              <Button asChild variant="outline" className="rounded-none"><Link href="/owned">Cartas possuídas</Link></Button>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Decks salvos", String(decks.length)],
            ["Decks públicos", String(publicDecks.length)],
            ["Desejos", String(wishlist?.items.length || 0)],
            ["Possuídas", String(owned?.items.length || 0)],
          ].map(([label, value]) => (
            <Card key={label} className="panel-cut rounded-none border-white/10 bg-white/5 text-white dark:text-white light:text-slate-900"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">{label}</p><p className="mt-4 font-heading text-5xl leading-none">{value}</p></CardContent></Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white dark:text-white light:text-slate-900">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Atalhos</p>
              <div className="mt-5 space-y-4">
                {[["Criar deck novo", "/deckbuilder"],["Configurações do usuário", "/profile"],["Editar lista de desejos", "/wishlist"],["Editar cartas possuídas", "/owned"]].map(([label, href]) => (
                  <Link key={href} href={href} className="panel-cut block border border-white/10 bg-slate-950/60 p-4 text-lg transition hover:bg-white/10 dark:bg-slate-950/60 light:bg-slate-50">{label}</Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white dark:text-white light:text-slate-900">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Meus decks</p>
              <div className="mt-5 space-y-4">
                {decks.length ? decks.map((deck) => (
                  <div key={deck.id} className="panel-cut border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg">{deck.name}</p>
                        <p className="mt-2 text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{deck.items.reduce((sum, item) => sum + item.quantity, 0)} cartas · {deck.visibility.toLowerCase()}</p>
                      </div>
                      {deck.visibility !== "PRIVATE" ? <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">share ativo</Badge> : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link href="/deckbuilder" className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900">Abrir deck no editor</Link>
                      {deck.visibility !== "PRIVATE" ? <Link href={`/deck/${deck.shareId}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900">Ver versão pública</Link> : null}
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
