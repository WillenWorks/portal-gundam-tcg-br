/* Minha área — hub do usuário autenticado com foco em decks, perfil e ações pessoais. */
import { useEffect, useState } from "react";
import { Link } from "wouter";

import { useAuth } from "@/contexts/AuthContext";
import { api, type ApiDeck } from "@/lib/api";
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

  useEffect(() => {
    if (!isAuthenticated) return;
    api.listMyDecks().then(setDecks).catch(() => undefined);
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <PortalShell breadcrumbs={[{ label: "Minha Área" }]}>
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white">
          <CardContent className="space-y-5 p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Área pessoal</p>
              <h2 className="mt-2 font-heading text-5xl uppercase">Entre para acessar seus recursos</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">Criar deck, analisar curva, publicar share link, editar perfil e usar recursos pessoais agora fica concentrado aqui, não mais espalhado na home pública.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Senha" className="rounded-none border-white/15 bg-slate-950/70 text-white" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => login(email, password)}>Entrar</Button>
              <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Link href="/decks">Explorar decks públicos</Link></Button>
            </div>
          </CardContent>
        </Card>
      </PortalShell>
    );
  }

  const publicDecks = decks.filter((deck) => deck.visibility === "PUBLIC");

  return (
    <PortalShell breadcrumbs={[{ label: "Minha Área" }]}>
      <div className="space-y-8">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white">
          <CardContent className="p-6 lg:p-8">
            <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-primary">Área do usuário</Badge>
            <h2 className="mt-5 font-heading text-6xl uppercase leading-[0.9]">Bem-vindo, <span className="text-primary">{user?.displayName}</span>.</h2>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300">Sua área agora concentra criação de deck, estatísticas pessoais, perfil público e compartilhamento. O resto do portal fica aberto para descoberta pública.</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90"><Link href="/deckbuilder">Criar / editar deck</Link></Button>
              <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Link href="/profile">Abrir meu perfil</Link></Button>
              <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Link href="/decks">Ver decks públicos</Link></Button>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Decks salvos", String(decks.length)],
            ["Decks públicos", String(publicDecks.length)],
            ["Usuário", user?.username || "—"],
            ["Perfil", user?.role || "USER"],
          ].map(([label, value]) => (
            <Card key={label} className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p><p className="mt-4 font-heading text-5xl leading-none text-white">{value}</p></CardContent></Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Atalhos</p>
              <div className="mt-5 space-y-4">
                {[
                  ["Criar deck novo", "/deckbuilder"],
                  ["Atualizar perfil público", "/profile"],
                  ["Estudar cartas por coleção", "/sets"],
                  ["Ver decks públicos", "/decks"],
                ].map(([label, href]) => (
                  <Link key={href} href={href} className="panel-cut block border border-white/10 bg-slate-950/60 p-4 text-lg text-white transition hover:bg-white/10">{label}</Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Meus decks</p>
              <div className="mt-5 space-y-4">
                {decks.length ? decks.map((deck) => (
                  <div key={deck.id} className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg text-white">{deck.name}</p>
                        <p className="mt-2 text-sm text-slate-400">{deck.items.reduce((sum, item) => sum + item.quantity, 0)} cartas · {deck.visibility.toLowerCase()}</p>
                      </div>
                      {deck.visibility !== "PRIVATE" ? <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">share ativo</Badge> : null}
                    </div>
                  </div>
                )) : <p className="text-sm text-slate-400">Nenhum deck salvo ainda.</p>}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </PortalShell>
  );
}
