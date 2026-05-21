/* Internal route page — painel principal do sistema. */
import { Link } from "wouter";
import { ArrowRight, Bot, Database, LayoutDashboard, Swords } from "lucide-react";

import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dashboardService } from "@/services/portal-service";

export default function DashboardPage() {
  const metrics = dashboardService.metrics();
  const queue = dashboardService.adminQueue().slice(0, 3);

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
                A landing virou <span className="text-primary">portal navegável</span>.
              </h2>
              <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300">
                Já existe uma espinha dorsal interna para navegar pelos módulos, consultar mocks estruturados, operar a fila
                administrativa e iniciar o deckbuilder. O próximo salto natural é trocar os serviços mockados por API e Prisma.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link href="/deckbuilder">Abrir deckbuilder <ArrowRight className="ml-2 size-4" /></Link>
                </Button>
                <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <Link href="/admin">Ir para admin</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {[
              { icon: LayoutDashboard, label: "Rotas", text: "Sidebar, breadcrumbs e páginas separadas por domínio." },
              { icon: Database, label: "Serviços", text: "Camada isolada para trocar mock por backend com mínimo retrabalho." },
              { icon: Bot, label: "IA", text: "Pontos definidos para FAQ contextual, tradução assistida e apoio editorial." },
              { icon: Swords, label: "Build", text: "Deckbuilder MVP já mede curva, custo baixo, tipos e cores." },
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
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Fila operacional</p>
              <div className="mt-5 space-y-4">
                {queue.map((item) => (
                  <div key={item.id} className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.type}</p>
                    <p className="mt-2 text-lg text-white">{item.title}</p>
                    <p className="mt-2 text-sm text-slate-400">
                      {item.status} · {item.owner} · {item.updatedAt}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Ordem recomendada dos próximos módulos</p>
              <ol className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
                <li>1. ligar persistência real para cartas, decks, rulings e eventos</li>
                <li>2. criar CRUD administrativo com formulários e validação</li>
                <li>3. salvar decks localmente/no banco e permitir edição</li>
                <li>4. publicar páginas de detalhe para carta, ruling e torneio</li>
                <li>5. encaixar IA nos fluxos com supervisão humana</li>
              </ol>
            </CardContent>
          </Card>
        </section>
      </div>
    </PortalShell>
  );
}
