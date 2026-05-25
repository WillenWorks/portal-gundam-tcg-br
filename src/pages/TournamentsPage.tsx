import { usePortalDb } from "@/hooks/use-portal-db";
import { PublicShell } from "@/components/layout/PublicShell";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function TournamentsPage() {
  const { tournaments } = usePortalDb();

  return (
    <PublicShell>
      <div className="space-y-6">
        {tournaments.map((tournament) => (
          <Card key={tournament.id} className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    {tournament.season} · {tournament.format} · {tournament.date}
                  </p>
                  <h2 className="mt-2 font-heading text-4xl uppercase leading-none">{tournament.name}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    {tournament.players} jogadores · deck vencedor: {tournament.winner}
                  </p>
                </div>
                <div className="panel-cut border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                  Snapshot persistido localmente e pronto para sincronização futura.
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-3">
                {tournament.decks.map((deck) => (
                  <div key={deck.archetype} className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                    <p className="font-heading text-2xl uppercase leading-none text-white">{deck.archetype}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">Share no field</p>
                    <div className="mt-2 flex items-center gap-3">
                      <Progress value={deck.share} className="h-2 rounded-none bg-slate-800" />
                      <span className="text-sm text-slate-300">{deck.share}%</span>
                    </div>
                    <p className="mt-4 text-sm text-slate-300">Conversão top cut: {deck.topCutConversion}%</p>
                    <p className="mt-4 text-sm leading-7 text-slate-400">Staples: {deck.stapleCards.join(", ")}</p>
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
