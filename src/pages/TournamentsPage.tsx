import { PublicShell } from "@/components/layout/PublicShell";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { usePortalDb } from "@/hooks/use-portal-db";

export default function TournamentsPage() {
  const { tournaments } = usePortalDb();

  return (
    <PublicShell
      breadcrumbs={[{ label: "Eventos" }]}
      title="Eventos"
      description="Calendário competitivo, torneios passados e snapshots de meta. A camada de estatísticas avançadas segue prevista, mas ainda fica desabilitada nesta etapa."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">Calendário e histórico</Badge>
          <Badge variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">Estatísticas detalhadas em breve</Badge>
        </div>

        {tournaments.map((tournament) => (
          <Card key={tournament.id} className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">
                    {tournament.season} · {tournament.format} · {tournament.date}
                  </p>
                  <h2 className="mt-2 font-heading text-4xl uppercase leading-none dark:text-white light:text-slate-900">{tournament.name}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">
                    {tournament.players} jogadores · deck vencedor: {tournament.winner}
                  </p>
                </div>
                <div className="panel-cut border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300 dark:text-slate-300 light:border-slate-300/80 light:bg-slate-50 light:text-slate-600">
                  Snapshot persistido localmente e pronto para sincronização futura.
                </div>
              </div>

              <div className="mt-6 grid gap-4 2xl:grid-cols-3">
                {tournament.decks.map((deck) => (
                  <div key={deck.archetype} className="panel-cut border surface-strong p-4 light:border-slate-300/80 light:bg-slate-50">
                    <p className="font-heading text-2xl uppercase leading-none dark:text-white light:text-slate-900">{deck.archetype}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">Share no field</p>
                    <div className="mt-2 flex items-center gap-3">
                      <Progress value={deck.share} className="h-2 rounded-none bg-slate-800 light:bg-slate-200" />
                      <span className="text-sm text-slate-300 dark:text-slate-300 light:text-slate-700">{deck.share}%</span>
                    </div>
                    <p className="mt-4 text-sm text-slate-300 dark:text-slate-300 light:text-slate-600">Conversão top cut: {deck.topCutConversion}%</p>
                    <p className="mt-4 text-sm leading-7 text-slate-400 dark:text-slate-400 light:text-slate-600">Staples: {deck.stapleCards.join(", ")}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PublicShell>
  );
}
