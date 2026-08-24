import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

import { PublicShell } from "@/components/layout/PublicShell";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

const FORMAT_LABELS: Record<string, string> = { constructed: "Constructed", team_battle: "Team Battle", battle_royale: "Battle Royale" };

/** Agrupa os participantes por arquétipo declarado — só o que dá pra calcular
 *  com dado real cadastrado, sem inventar métrica que não existe (ver reportado
 *  na Prioridade 4: a página antes usava topCutConversion/stapleCards fake). */
function archetypeBreakdown(entries: any[]) {
  const withArchetype = entries.filter((entry) => entry.archetype);
  if (!withArchetype.length) return [];
  const counts = new Map<string, { count: number; bestPlacement: number | null }>();
  for (const entry of withArchetype) {
    const current = counts.get(entry.archetype) || { count: 0, bestPlacement: null };
    current.count += 1;
    if (entry.placement != null && (current.bestPlacement == null || entry.placement < current.bestPlacement)) current.bestPlacement = entry.placement;
    counts.set(entry.archetype, current);
  }
  return Array.from(counts.entries())
    .map(([archetype, data]) => ({ archetype, share: Math.round((data.count / withArchetype.length) * 100), count: data.count, bestPlacement: data.bestPlacement }))
    .sort((a, b) => b.count - a.count);
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listTournaments()
      .then(setTournaments)
      .catch((err: any) => setError(err.message || "Falha ao carregar eventos."))
      .finally(() => setLoading(false));
  }, []);

  // Panorama combinado de todos os eventos ativos -- meta geral e composição
  // registrado/convidado. Não calcula taxa de vitória real (deferido de propósito,
  // ver docs/16-roadmap-ideias-mapeadas.md): só o que dá pra tirar de dado cadastrado
  // sem inventar métrica (mesmo critério do archetypeBreakdown por evento, acima).
  const allEntries = useMemo(() => tournaments.flatMap((tournament) => tournament.entries || []), [tournaments]);
  const overallBreakdown = useMemo(() => archetypeBreakdown(allEntries), [allEntries]);
  const registeredCount = allEntries.filter((entry) => entry.user).length;
  const deckLinkedCount = allEntries.filter((entry) => entry.deck).length;

  return (
    <PublicShell
      breadcrumbs={[{ label: "Eventos" }]}
      title="Eventos"
      description="Calendário competitivo e resultados de torneios cadastrados pela comunidade."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">Calendário e histórico</Badge>
        </div>

        {loading ? <p className="text-sm text-slate-400">Carregando eventos...</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {!loading && !error && !tournaments.length ? <p className="text-sm text-slate-400">Nenhum evento cadastrado ainda.</p> : null}

        {!loading && !error && tournaments.length ? (
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Panorama geral</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="panel-cut border surface-strong p-4 light:border-slate-300/80 light:bg-slate-50">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Eventos</p>
                  <p className="mt-2 font-heading text-3xl leading-none dark:text-white light:text-slate-900">{tournaments.length}</p>
                </div>
                <div className="panel-cut border surface-strong p-4 light:border-slate-300/80 light:bg-slate-50">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Participações registradas</p>
                  <p className="mt-2 font-heading text-3xl leading-none dark:text-white light:text-slate-900">{allEntries.length}</p>
                </div>
                <div className="panel-cut border surface-strong p-4 light:border-slate-300/80 light:bg-slate-50">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Com conta no site</p>
                  <p className="mt-2 font-heading text-3xl leading-none dark:text-white light:text-slate-900">{registeredCount}{allEntries.length ? <span className="ml-2 text-sm text-slate-500">({Math.round((registeredCount / allEntries.length) * 100)}%)</span> : null}</p>
                </div>
                <div className="panel-cut border surface-strong p-4 light:border-slate-300/80 light:bg-slate-50">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Com deck vinculado</p>
                  <p className="mt-2 font-heading text-3xl leading-none dark:text-white light:text-slate-900">{deckLinkedCount}{allEntries.length ? <span className="ml-2 text-sm text-slate-500">({Math.round((deckLinkedCount / allEntries.length) * 100)}%)</span> : null}</p>
                </div>
              </div>

              {overallBreakdown.length ? (
                <div className="mt-6">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Meta geral · arquétipos declarados em todos os eventos</p>
                  <div className="mt-3 grid gap-4 2xl:grid-cols-3">
                    {overallBreakdown.slice(0, 6).map((item) => (
                      <div key={item.archetype} className="panel-cut border surface-strong p-4 light:border-slate-300/80 light:bg-slate-50">
                        <p className="font-heading text-2xl uppercase leading-none dark:text-white light:text-slate-900">{item.archetype}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <Progress value={item.share} className="h-2 rounded-none bg-slate-800 light:bg-slate-200" />
                          <span className="text-sm text-slate-300 dark:text-slate-300 light:text-slate-700">{item.share}%</span>
                        </div>
                        <p className="mt-3 text-sm text-slate-300 dark:text-slate-300 light:text-slate-600">{item.count} entrada(s){item.bestPlacement ? ` · melhor colocação: ${item.bestPlacement}º` : ""}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {tournaments.map((tournament) => {
          const entries: any[] = tournament.entries || [];
          const breakdown = archetypeBreakdown(entries);
          const winner = entries.find((entry) => entry.placement === 1);
          return (
            <Card key={tournament.id} className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">
                      {tournament.season || "Sem temporada"} · {FORMAT_LABELS[tournament.format] || tournament.format} · {tournament.dateStart ? new Date(tournament.dateStart).toLocaleDateString("pt-BR") : "Data a confirmar"}
                    </p>
                    <h2 className="mt-2 font-heading text-4xl uppercase leading-none dark:text-white light:text-slate-900">{tournament.name}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">
                      {entries.length} participante(s) cadastrado(s){tournament.participantCount ? ` de ${tournament.participantCount} declarados` : ""}{winner ? ` · campeão: ${winner.playerName}` : ""}
                    </p>
                  </div>
                  {tournament.organizer || tournament.city ? (
                    <div className="panel-cut border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300 dark:text-slate-300 light:border-slate-300/80 light:bg-slate-50 light:text-slate-600">
                      {tournament.organizer ? <p>{tournament.organizer}</p> : null}
                      {tournament.city ? <p className="text-xs text-slate-500">{tournament.city}{tournament.country ? `, ${tournament.country}` : ""}</p> : null}
                    </div>
                  ) : null}
                </div>

                {breakdown.length ? (
                  <div className="mt-6 grid gap-4 2xl:grid-cols-3">
                    {breakdown.slice(0, 6).map((item) => (
                      <div key={item.archetype} className="panel-cut border surface-strong p-4 light:border-slate-300/80 light:bg-slate-50">
                        <p className="font-heading text-2xl uppercase leading-none dark:text-white light:text-slate-900">{item.archetype}</p>
                        <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">Presença no evento</p>
                        <div className="mt-2 flex items-center gap-3">
                          <Progress value={item.share} className="h-2 rounded-none bg-slate-800 light:bg-slate-200" />
                          <span className="text-sm text-slate-300 dark:text-slate-300 light:text-slate-700">{item.share}%</span>
                        </div>
                        <p className="mt-4 text-sm text-slate-300 dark:text-slate-300 light:text-slate-600">{item.count} jogador(es){item.bestPlacement ? ` · melhor colocação: ${item.bestPlacement}º` : ""}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-6 text-sm text-slate-500">Sem arquétipo declarado pelos participantes ainda.</p>
                )}

                {entries.length ? (
                  <div className="mt-6 space-y-2 border-t border-white/10 pt-6">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Participantes</p>
                    <div className="grid gap-2 lg:grid-cols-2">
                      {[...entries].sort((a, b) => (a.placement ?? Infinity) - (b.placement ?? Infinity)).map((entry) => (
                        <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border border-white/10 bg-slate-950/40 px-3 py-2 text-sm light:border-slate-300/80 light:bg-slate-50">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-slate-500">{entry.placement ? `${entry.placement}º` : "—"}</span>
                            {entry.user ? (
                              <Link href={`/u/${entry.user.username}`} className="text-slate-200 hover:underline dark:text-slate-200 light:text-slate-800">{entry.playerName}</Link>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-300 light:text-slate-700">{entry.playerName}</span>
                            )}
                            {entry.archetype ? <span className="text-xs text-slate-500">· {entry.archetype}</span> : null}
                          </div>
                          {entry.deck ? <Link href={`/deck/${entry.deck.shareId}`} className="text-xs uppercase tracking-[0.14em] text-primary hover:underline">Ver deck</Link> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PublicShell>
  );
}
