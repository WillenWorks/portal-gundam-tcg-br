import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  Calendar,
  ChevronLeft,
  Crown,
  MapPin,
  PieChart as PieChartIcon,
  Shield,
  Trophy,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VedaShell } from "@/components/veda/VedaShell";
import { VedaArchetypeBadge } from "@/components/veda/VedaArchetypeBadge";
import { VedaPlayerLink } from "@/components/veda/VedaPlayerLink";
import { VedaPlacementBadge } from "@/components/veda/VedaPlacementBadge";
import { VedaSourceCredit } from "@/components/veda/VedaSourceCredit";
import { VedaErrorView, VedaLoadingView } from "@/components/veda/VedaStateViews";
import { vedaApi } from "@/lib/veda/api";
import type { VedaTournamentDetail } from "@/lib/veda/types";
import { GAME_COLOR_HEX, TOURNAMENT_TIER_OPTIONS } from "@/lib/gundam-catalog";

function formatDatePtBr(raw?: string | null): string {
  if (!raw) return "Data não informada";
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return raw;
  }
}

function tierLabel(tier?: string | null) {
  return TOURNAMENT_TIER_OPTIONS.find((t) => t.value === tier)?.label || tier || "Torneio Registrado";
}

export default function VedaTournamentReportPage() {
  const [, params] = useRoute<{ id: string }>("/torneios/:id");
  const tournamentId = params?.id ? decodeURIComponent(params.id) : "";

  const [tournament, setTournament] = useState<VedaTournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = async () => {
    if (!tournamentId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await vedaApi.getTournament(tournamentId);
      setTournament(result);
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar o relatório deste evento.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [tournamentId]);

  if (loading) {
    return (
      <VedaShell breadcrumbs={[{ label: "Torneios", href: "/torneios" }, { label: "Carregando..." }]}>
        <VedaLoadingView label="Compilando relatório operacional do evento..." />
      </VedaShell>
    );
  }

  if (error || !tournament) {
    return (
      <VedaShell breadcrumbs={[{ label: "Torneios", href: "/torneios" }, { label: "Erro" }]}>
        <VedaErrorView
          title="Relatório não encontrado"
          error={error || "Torneio não registrado ou inexistente."}
          onRetry={loadDetail}
        />
        <div className="pt-4 flex justify-center">
          <Button variant="outline" asChild className="rounded-none font-mono text-xs uppercase">
            <Link href="/torneios">
              <ChevronLeft className="mr-1.5 size-3.5" />
              Voltar para Lista de Torneios
            </Link>
          </Button>
        </div>
      </VedaShell>
    );
  }

  const hasRegionalLink = Boolean(tournament.place.uf);
  const regionalUrl = hasRegionalLink
    ? `/metagame/regional?uf=${encodeURIComponent(tournament.place.uf || "")}${
        tournament.place.city ? `&cidade=${encodeURIComponent(tournament.place.city)}` : ""
      }`
    : null;

  return (
    <VedaShell
      breadcrumbs={[{ label: "Torneios", href: "/torneios" }, { label: tournament.name }]}
      source={tournament.source}
      sourceUrl={tournament.sourceUrl}
    >
      <div className="space-y-6">
        {/* Cabeçalho do Evento (Tático Neo-Militar) */}
        <div className="panel-cut border border-primary/30 hero-surface p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary text-xs font-mono uppercase">
                {tierLabel(tournament.tier)}
              </Badge>
              {tournament.season && (
                <span className="text-xs font-mono text-slate-300 uppercase bg-white/5 px-2 py-0.5 border border-white/10">
                  Temporada {tournament.season}
                </span>
              )}
            </div>

            <VedaSourceCredit source={tournament.source} sourceUrl={tournament.sourceUrl} />
          </div>

          <div>
            <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl uppercase text-white tracking-wide">
              {tournament.name}
            </h1>

            {/* Metadados de Localidade e Data */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-300">
              <span className="flex items-center gap-1.5 font-mono">
                <Calendar className="size-3.5 text-primary" />
                {formatDatePtBr(tournament.date)}
              </span>

              {(tournament.place.store || tournament.place.city || tournament.place.uf) && (
                <span className="flex items-center gap-1.5 font-mono">
                  <MapPin className="size-3.5 text-primary" />
                  {tournament.place.store ? `${tournament.place.store} · ` : ""}
                  {regionalUrl ? (
                    <Link
                      href={regionalUrl}
                      className="text-slate-800 dark:text-slate-200 hover:text-primary underline decoration-dotted transition-colors"
                      title="Ver metagame deste estado/cidade"
                    >
                      {tournament.place.city ? `${tournament.place.city}, ` : ""}
                      {tournament.place.uf}
                    </Link>
                  ) : (
                    <span>
                      {tournament.place.city ? `${tournament.place.city}, ` : ""}
                      {tournament.place.country || ""}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Grid de Métricas Operacionais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
            <div className="panel-cut border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/60 p-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Participantes</p>
              <p className="mt-1 font-heading text-xl sm:text-2xl text-slate-900 dark:text-white">
                {tournament.participantCount || tournament.entriesCount}
              </p>
            </div>
            <div className="panel-cut border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/60 p-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Inscrições com Deck</p>
              <p className="mt-1 font-heading text-xl sm:text-2xl text-primary">
                {tournament.decklistsCount}
              </p>
            </div>
            <div className="panel-cut border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/60 p-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Rodadas Suíço</p>
              <p className="mt-1 font-heading text-xl sm:text-2xl text-slate-800 dark:text-slate-200">
                {tournament.roundCount ? `${tournament.roundCount} R` : "—"}
              </p>
            </div>
            <div className="panel-cut border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/60 p-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Status do Snapshot</p>
              <p className="mt-1 font-mono text-xs uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                <Shield className="size-3" />
                Congelado
              </p>
            </div>
          </div>
        </div>

        {/* Destaque do Campeão (se houver) */}
        {tournament.winner && (
          <div className="panel-cut border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-50 dark:from-amber-950/30 dark:via-slate-950/80 dark:to-slate-950/80 p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400">
              <Crown className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
              <span>Campeão do Evento</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="font-heading text-2xl uppercase text-slate-900 dark:text-white">
                  <VedaPlayerLink player={tournament.winner.player} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-400">Arquétipo:</span>
                  {tournament.winner.archetype ? (
                    <VedaArchetypeBadge archetype={tournament.winner.archetype} />
                  ) : (
                    <span className="text-xs text-slate-500 font-mono">Não categorizado</span>
                  )}
                </div>
              </div>

              {tournament.winner.entryId && (
                <Button
                  asChild
                  className="rounded-none bg-amber-500 text-slate-950 hover:bg-amber-400 font-mono text-xs uppercase tracking-wider font-bold shrink-0"
                >
                  <Link href={`/torneios/${tournament.id}/lista/${tournament.winner.entryId}`}>
                    <Trophy className="mr-1.5 size-3.5" />
                    Inspecionar Decklist Campeã
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Quebra do Metagame do Torneio */}
        {tournament.meta && tournament.meta.length > 0 && (
          <div className="panel-cut border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/80 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <PieChartIcon className="size-4 text-primary" />
                <h2 className="font-heading text-lg sm:text-xl uppercase text-slate-900 dark:text-white">
                  Divisão do Metagame do Torneio
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {tournament.meta.length} arquétipo(s) registrado(s)
              </span>
            </div>

            {/* Lista e Barras do Meta */}
            <div className="space-y-3">
              {tournament.meta.map((slice) => {
                const percentage = (slice.share * 100).toFixed(1);
                const primaryColor = slice.archetype.colors?.[0];
                const barColor = primaryColor ? GAME_COLOR_HEX[primaryColor] || "#3b82f6" : "#3b82f6";

                return (
                  <div
                    key={slice.archetype.slug}
                    className="panel-cut border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <VedaArchetypeBadge archetype={slice.archetype} />
                      </div>
                      <div className="flex items-center gap-4 font-mono text-slate-700 dark:text-slate-300">
                        {slice.bestPlacement && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Melhor: <strong className="text-slate-900 dark:text-white">{slice.bestPlacement}º</strong>
                          </span>
                        )}
                        <span>
                          <strong>{slice.count}</strong> {slice.count === 1 ? "lista" : "listas"}
                        </span>
                        <span className="text-primary font-bold">{percentage}%</span>
                      </div>
                    </div>

                    {/* Barra de Distribuição */}
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-950 overflow-hidden border border-slate-200 dark:border-white/10">
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(2, parseFloat(percentage)))}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Classificação Completa do Torneio */}
        <div className="panel-cut border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/80 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" />
              <h2 className="font-heading text-lg sm:text-xl uppercase text-slate-900 dark:text-white">
                Classificação Completa & Inscrições
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {tournament.standings.length} jogador(es)
            </span>
          </div>

          {/* Tabela de Standings */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/15 text-[10px] font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-white/5">
                  <th className="py-2.5 px-3 w-16">Colocação</th>
                  <th className="py-2.5 px-3">Jogador</th>
                  <th className="py-2.5 px-3">Arquétipo</th>
                  <th className="py-2.5 px-3 w-24">Placar</th>
                  <th className="py-2.5 px-3 text-right w-36">Decklist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10 font-mono">
                {tournament.standings.map((st) => (
                  <tr
                    key={st.entryId}
                    className="hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-3 px-3">
                      <VedaPlacementBadge placement={st.placement} placementLabel={st.placementLabel} />
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <VedaPlayerLink player={st.player} />
                    </td>
                    <td className="py-3 px-3">
                      {st.archetype ? (
                        <VedaArchetypeBadge archetype={st.archetype} />
                      ) : (
                        <span className="text-slate-500 font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                      {st.record || "—"}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {st.hasDecklist ? (
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="h-7 rounded-none border-primary/30 bg-primary/10 text-[11px] font-mono uppercase text-primary hover:bg-primary/20 hover:text-slate-900 dark:hover:text-white"
                        >
                          <Link href={`/torneios/${tournament.id}/lista/${st.entryId}`}>
                            Ver Lista
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono">
                          Lista não informada
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </VedaShell>
  );
}
