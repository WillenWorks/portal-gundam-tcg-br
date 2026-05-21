import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { catalogService, dashboardService, rulesService, tournamentService } from "@/services/portal-service";

export default function AdminPage() {
  const queue = dashboardService.adminQueue();
  const cards = catalogService.listCards();
  const rules = rulesService.list();
  const tournaments = tournamentService.list();

  return (
    <PortalShell>
      <Tabs defaultValue="queue" className="space-y-6">
        <TabsList className="h-auto flex-wrap rounded-none border border-white/10 bg-white/5 p-1">
          <TabsTrigger value="queue" className="rounded-none uppercase tracking-[0.18em]">Fila</TabsTrigger>
          <TabsTrigger value="cards" className="rounded-none uppercase tracking-[0.18em]">Cartas</TabsTrigger>
          <TabsTrigger value="rules" className="rounded-none uppercase tracking-[0.18em]">Rulings</TabsTrigger>
          <TabsTrigger value="events" className="rounded-none uppercase tracking-[0.18em]">Eventos</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          <div className="grid gap-4 xl:grid-cols-2">
            {queue.map((item) => (
              <Card key={item.id} className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{item.type}</Badge>
                    <Badge variant="outline" className="rounded-none border-white/20 text-slate-300">{item.status}</Badge>
                  </div>
                  <h3 className="mt-4 font-heading text-3xl uppercase leading-none">{item.title}</h3>
                  <p className="mt-4 text-sm text-slate-400">Responsável: {item.owner} · atualizado {item.updatedAt}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cards">
          <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Base de cartas</p>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm text-slate-300">
                  <thead className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    <tr>
                      <th className="pb-3">Código</th>
                      <th className="pb-3">Carta</th>
                      <th className="pb-3">Cor</th>
                      <th className="pb-3">Tipo</th>
                      <th className="pb-3">Custo</th>
                      <th className="pb-3">Keywords</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((card) => (
                      <tr key={card.id} className="border-t border-white/10">
                        <td className="py-3">{card.code}</td>
                        <td className="py-3">{card.namePt || card.name}</td>
                        <td className="py-3">{card.color}</td>
                        <td className="py-3">{card.type}</td>
                        <td className="py-3">{card.cost}</td>
                        <td className="py-3">{card.keywords.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <div className="grid gap-4 xl:grid-cols-2">
            {rules.map((rule) => (
              <Card key={rule.id} className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                <CardContent className="p-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{rule.category}</Badge>
                    <Badge variant="outline" className="rounded-none border-white/20 text-slate-300">{rule.source}</Badge>
                  </div>
                  <h3 className="mt-4 font-heading text-3xl uppercase leading-none">{rule.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{rule.summaryPt}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="events">
          <div className="grid gap-4 xl:grid-cols-2">
            {tournaments.map((event) => (
              <Card key={event.id} className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{event.season} · {event.format}</p>
                  <h3 className="mt-3 font-heading text-3xl uppercase leading-none">{event.name}</h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    {event.players} jogadores · vencedor: {event.winner} · {event.decks.length} arquétipos no snapshot.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </PortalShell>
  );
}
