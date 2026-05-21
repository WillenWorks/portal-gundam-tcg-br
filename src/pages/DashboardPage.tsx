import { Link } from "wouter";
import { ArrowRight, Bot, Database, LayoutDashboard, Swords } from "lucide-react";

import { usePortalDb } from "@/hooks/use-portal-db";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  const { metrics, cards, rules, tournaments, deck } = usePortalDb();

  const queue = [
    { id: "q1", type: "Carta", title: `${cards.length} cartas persistidas`, status: "Ativo" },
    { id: "q2", type: "Ruling", title: `${rules.length} rulings e FAQs prontos para revisão`, status: "Ativo" },
    { id: "q3", type: "Evento", title: `${tournaments.length} eventos no snapshot competitivo`, status: "Ativo" },
  ];

  return (
    <PortalShell>
      <div className="space-y-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.label} className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{metric.label}</p>
                <p className="mt-4 font-heading text-5xl leading-none text-white">{metric.value}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{metric.note}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/30 text-white">
            <CardContent className="p-6 lg:p-8">
              <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-primary">
                Centro de comando
              </Badge>
              <h2 className="mt-5 font-heading text-6xl uppercase leading-[0.9]">
                Dados persistidos e <span className="text-primary">admin operável</span>.
              </h2>
              <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300">
                O portal agora grava estado persistente no navegador e já segue uma estrutura alinhada à modelagem Prisma. Isso
                permite testar fluxo de CRUD, deckbuilder e navegação antes de encaixar a API real por cima.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link href="/deckbuilder">Abrir deckbuilder <ArrowRight className="ml-2 size-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <Link href="/admin">Operar admin</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {[
              { icon: LayoutDashboard, label: "Rotas", text: "Portal interno segue organizado por domínio com shell compartilhado." },
              { icon: Database, label: "Persistência", text: `Deck atual: ${deck.name}. Cards, rulings e eventos sobrevivem a refresh no navegador.` },
              { icon: Bot, label: "IA", text: "A camada de dados ficou pronta para depois receber geração assistida e curadoria com revisão." },
              { icon: Swords, label: "Build", text: "Deckbuilder agora pode editar e salvar seu estado no store persistente atual." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.label} className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                  <CardContent className="flex items-start gap-4 p-5">
                    <div className="flex size-12 items-center justify-center border border-white/10 bg-slate-950/70 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
                      <p className="mt-2 text-lg leading-7 text-white">{item.text}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Fila operacional derivada</p>
              <div className="mt-5 space-y-4">
                {queue.map((item) => (
                  <div key={item.id} className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.type}</p>
                    <p className="mt-2 text-lg text-white">{item.title}</p>
                    <p className="mt-2 text-sm text-slate-400">Status: {item.status}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Próximo encaixe recomendado</p>
              <ol className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
                <li>1. trocar o store local por API real ligada ao Prisma</li>
                <li>2. adicionar autenticação e papéis admin/editor/user</li>
                <li>3. publicar página de detalhe para carta, ruling e torneio</li>
                <li>4. salvar múltiplos decks por usuário</li>
                <li>5. criar importadores para cartas, rulings e resultados de eventos</li>
              </ol>
            </CardContent>
          </Card>
        </section>
      </div>
    </PortalShell>
  );
}
