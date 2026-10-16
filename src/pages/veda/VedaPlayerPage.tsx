import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  ChevronLeft,
  Info,
  Layers,
  Medal,
  Trophy,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VedaShell } from "@/components/veda/VedaShell";
import { VedaArchetypeBadge } from "@/components/veda/VedaArchetypeBadge";
import { VedaPlacementBadge } from "@/components/veda/VedaPlacementBadge";
import { VedaErrorView, VedaLoadingView } from "@/components/veda/VedaStateViews";
import { vedaApi } from "@/lib/veda/api";
import type { VedaPlayer } from "@/lib/veda/types";

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

export default function VedaPlayerPage() {
  const [, params] = useRoute<{ slug: string }>("/jogadores/:slug");
  const playerSlug = params?.slug ? decodeURIComponent(params.slug) : "";

  const [player, setPlayer] = useState<VedaPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string>("");

  const loadPlayerData = async () => {
    if (!playerSlug) return;
    setLoading(true);
    setError(null);
    try {
      const result = await vedaApi.getPlayer(playerSlug, {
        season: selectedSeason || undefined,
      });
      setPlayer(result);
    } catch (err: any) {
      setError(err?.message || "Jogador não encontrado.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlayerData();
  }, [playerSlug, selectedSeason]);

  if (loading) {
    return (
      <VedaShell
        breadcrumbs={[
          { label: "Torneios", href: "/torneios" },
          { label: "Carregando jogador..." },
        ]}
      >
        <VedaLoadingView label="Recuperando dossiê de torneios do jogador..." />
      </VedaShell>
    );
  }

  if (error || !player) {
    return (
      <VedaShell
        breadcrumbs={[
          { label: "Torneios", href: "/torneios" },
          { label: "Jogador não encontrado" },
        ]}
      >
        <VedaErrorView
          title="Jogador não encontrado"
          error={error || "Não há registros de torneios para o identificador informado."}
          onRetry={loadPlayerData}
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

  return (
    <VedaShell
      breadcrumbs={[
        { label: "Torneios", href: "/torneios" },
        { label: "Jogadores" },
        { label: player.player.name },
      ]}
    >
      <div className="space-y-6">
        {/* Cabeçalho do Jogador (Dossiê de Piloto) */}
        <div className="panel-cut border border-primary/30 hero-surface p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 border border-primary/30">
                <User className="size-6 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
                  Piloto Registrado
                </p>
                <h1 className="font-heading text-2xl sm:text-3xl uppercase text-white tracking-wide">
                  {player.player.name}
                </h1>
              </div>
            </div>

            {/* Filtro Rápido de Temporada */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-600 dark:text-slate-400 uppercase">Recorte:</span>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="h-8 px-2 rounded-none border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-mono focus:border-primary outline-none"
              >
                <option value="">Todas as Temporadas</option>
                <option value="GD05">Temporada GD05</option>
                <option value="GD04">Temporada GD04</option>
                <option value="GD03">Temporada GD03</option>
                <option value="GD02">Temporada GD02</option>
                <option value="GD01">Temporada GD01</option>
              </select>
            </div>
          </div>

          {/* Cards de Métricas do Jogador */}
          <div className="grid grid-cols-3 gap-3">
            <div className="panel-cut border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/60 p-3 sm:p-4 text-center sm:text-left">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Torneios Disputados</p>
              <p className="mt-1 font-heading text-2xl sm:text-3xl text-slate-900 dark:text-white">{player.tournaments}</p>
            </div>
            <div className="panel-cut border border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/20 p-3 sm:p-4 text-center sm:text-left">
              <p className="text-[10px] font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1 justify-center sm:justify-start">
                <Trophy className="size-3 text-amber-500 dark:text-amber-400" />
                Títulos (1º Lugar)
              </p>
              <p className="mt-1 font-heading text-2xl sm:text-3xl text-amber-600 dark:text-amber-300">{player.wins}</p>
            </div>
            <div className="panel-cut border border-primary/30 bg-primary/10 p-3 sm:p-4 text-center sm:text-left">
              <p className="text-[10px] font-mono uppercase tracking-wider text-primary flex items-center gap-1 justify-center sm:justify-start">
                <Medal className="size-3" />
                Top 8 Alcançado
              </p>
              <p className="mt-1 font-heading text-2xl sm:text-3xl text-primary">{player.top8}</p>
            </div>
          </div>

          {/* Aviso sobre Homônimos (Decisão do usuário e Contrato §2) */}
          <div className="flex items-start gap-2 pt-2 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
            <Info className="size-3.5 shrink-0 text-slate-500 dark:text-slate-400 mt-0.5" />
            <p className="leading-relaxed">
              Nomes de jogadores são exibidos completos a partir das súmulas oficiais dos torneios. Homônimos podem ser
              agrupados sob o mesmo registro histórico.
            </p>
          </div>
        </div>

        {/* Arquétipos Mais Jogados pelo Jogador */}
        {player.archetypes && player.archetypes.length > 0 && (
          <div className="panel-cut border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/80 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
              <Layers className="size-4 text-primary" />
              <h2 className="font-heading text-lg sm:text-xl uppercase text-slate-900 dark:text-white">
                Arquétipos Mais Utilizados
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {player.archetypes.map(({ archetype, count }) => (
                <div
                  key={archetype.slug}
                  className="panel-cut border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-3 flex items-center justify-between gap-2 hover:border-primary/40 transition-colors"
                >
                  <VedaArchetypeBadge archetype={archetype} />
                  <Badge variant="outline" className="border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-300 text-[10px] font-mono shrink-0">
                    {count} {count === 1 ? "torneio" : "torneios"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Histórico Completo de Resultados */}
        <div className="panel-cut border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/80 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" />
              <h2 className="font-heading text-lg sm:text-xl uppercase text-slate-900 dark:text-white">
                Histórico de Participações & Resultados
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {player.results.length} resultado(s) registrado(s)
            </span>
          </div>

          {player.results.length === 0 ? (
            <p className="py-8 text-center text-xs font-mono text-slate-500">
              Nenhum resultado registrado para o recorte selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/15 text-[10px] font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-white/5">
                    <th className="py-2.5 px-3 w-16">Colocação</th>
                    <th className="py-2.5 px-3">Torneio</th>
                    <th className="py-2.5 px-3">Arquétipo</th>
                    <th className="py-2.5 px-3 w-24">Placar</th>
                    <th className="py-2.5 px-3 text-right w-32">Decklist</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10 font-mono">
                  {player.results.map((res) => {
                    const regionalUrl = res.place?.uf
                      ? `/metagame/regional?uf=${encodeURIComponent(res.place.uf)}${
                          res.place.city ? `&cidade=${encodeURIComponent(res.place.city)}` : ""
                        }`
                      : null;

                    return (
                      <tr key={res.entryId} className="hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-3">
                          <VedaPlacementBadge placement={res.placement} placementLabel={res.placementLabel} />
                        </td>
                        <td className="py-3 px-3 font-sans">
                          <div>
                            <Link
                              href={`/torneios/${res.tournamentId}`}
                              className="font-medium text-slate-800 dark:text-slate-200 hover:text-primary transition-colors block"
                            >
                              {res.tournamentName}
                            </Link>
                            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-0.5">
                              <span>{formatDatePtBr(res.date)}</span>
                              {res.place?.uf && (
                                <>
                                  <span>·</span>
                                  {regionalUrl ? (
                                    <Link
                                      href={regionalUrl}
                                      className="hover:text-primary underline decoration-dotted"
                                    >
                                      {res.place.city ? `${res.place.city}, ` : ""}
                                      {res.place.uf}
                                    </Link>
                                  ) : (
                                    <span>{res.place.uf}</span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {res.archetype ? (
                            <VedaArchetypeBadge archetype={res.archetype} />
                          ) : (
                            <span className="text-slate-500 font-mono">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{res.record || "—"}</td>
                        <td className="py-3 px-3 text-right">
                          {res.hasDecklist ? (
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="h-7 rounded-none border-primary/30 bg-primary/10 text-[11px] font-mono uppercase text-primary hover:bg-primary/20 hover:text-slate-900 dark:hover:text-white"
                            >
                              <Link href={`/torneios/${res.tournamentId}/lista/${res.entryId}`}>
                                Ver Lista
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-mono">
                              Não informada
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </VedaShell>
  );
}
