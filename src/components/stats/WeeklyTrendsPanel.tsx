/* Evolução Semanal do Metagame (Fase 3, ver PLANO_METAGAME_TORNEIOS_TELEMETRIA.md §2.3/§3 e prompt A6) --
 * Agrupa os resultados competitivos reais de torneios reportados semana a semana.
 * Sinaliza visualmente semanas e arquétipos com amostra pequena (< 6 listas na semana ou < 3 listas no arquétipo)
 * e explicita a ponderação amostral de eventos de grande porte (Regionais > Lojas).
 */
import { useEffect, useState } from "react";
import {
  CalendarDays,
  TrendingUp,
  Filter,
  X,
  AlertTriangle,
  Info,
  CheckCircle2,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, type WeeklyTrendsResponse } from "@/lib/api";
import { GAME_COLOR_HEX, GAME_COLOR_LABEL_PT, TOURNAMENT_TIER_OPTIONS } from "@/lib/gundam-catalog";
import { DataSourceNote } from "@/components/stats/DataSourceNote";

const FALLBACK_COLOR = "#94a3b8";

export function WeeklyTrendsPanel({ seasonId }: { seasonId?: string }) {
  const [data, setData] = useState<WeeklyTrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedArchetypeFilter, setSelectedArchetypeFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<"weeks" | "table">("weeks");

  useEffect(() => {
    setLoading(true);
    api.getWeeklyTrends({
      seasonId,
      tier: selectedTier === "ALL" ? undefined : selectedTier,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [seasonId, selectedTier, startDate, endDate]);

  const weeks = data?.weeks || [];
  const topArchetypes = data?.topArchetypes || [];

  return (
    <Card className="panel-cut rounded-none border-primary/30 hero-surface">
      <CardContent className="p-6">
        {/* Header do Módulo */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-accent" />
              <p className="text-xs uppercase tracking-[0.24em] text-primary font-mono font-semibold">
                Série Temporal Semanal · Metagame Competitivo
              </p>
              <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent text-[10px] font-mono uppercase">
                Fase 3
              </Badge>
            </div>
            <h2 className="mt-2 font-heading text-3xl uppercase tracking-wider text-white">
              Evolução Semanal dos Arquétipos
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
              Acompanhe a trajetória e as oscilações de presença (Meta Share %) e taxa de vitória dos principais arquétipos semana a semana, com sinalização de amostragem e ponderação amostral de eventos.
            </p>
          </div>

          {/* Alternância de Visualização */}
          <div className="flex items-center border border-white/15 bg-slate-950 p-1 panel-cut">
            <Button
              size="sm"
              variant={viewMode === "weeks" ? "default" : "ghost"}
              onClick={() => setViewMode("weeks")}
              className="h-8 rounded-none text-xs font-mono uppercase tracking-wider"
            >
              <CalendarDays className="mr-1.5 size-3.5" />
              Por Semana
            </Button>
            <Button
              size="sm"
              variant={viewMode === "table" ? "default" : "ghost"}
              onClick={() => setViewMode("table")}
              className="h-8 rounded-none text-xs font-mono uppercase tracking-wider"
            >
              <TrendingUp className="mr-1.5 size-3.5" />
              Comparativo
            </Button>
          </div>
        </div>

        {/* NOTA DE PROVENIÊNCIA E TRANSPARÊNCIA */}
        {data?.provenance && (
          <DataSourceNote
            provenance={data.provenance}
            labelPrefix="Série temporal semanal baseada em"
            weightNote="Cada lista conta igual, independente do tamanho do torneio. Use o filtro de tipo de evento para ver só os maiores."
            className="mt-4"
          />
        )}

        {/* BARRA DE FILTROS (Tier, Período, Arquétipo) */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-mono">
            <Filter className="size-3.5 text-primary" />
            <span className="uppercase tracking-wider text-[11px]">Tipo de Torneio:</span>
          </div>
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="field-shell h-8 rounded-none border border-white/15 bg-slate-950/70 px-2.5 text-xs text-white"
          >
            <option value="ALL">Todos os tipos de evento</option>
            {TOURNAMENT_TIER_OPTIONS.map((tier) => (
              <option key={tier.value} value={tier.value}>
                {tier.label}
              </option>
            ))}
          </select>

          {topArchetypes.length > 0 && (
            <select
              value={selectedArchetypeFilter}
              onChange={(e) => setSelectedArchetypeFilter(e.target.value)}
              className="field-shell h-8 rounded-none border border-white/15 bg-slate-950/70 px-2.5 text-xs text-white"
            >
              <option value="">Todos os Arquétipos</option>
              {topArchetypes.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}

          <div className="flex flex-wrap items-center gap-2 text-slate-400 font-mono">
            <span className="uppercase tracking-wider text-[11px]">De:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="field-shell h-8 rounded-none border border-white/15 bg-slate-950/70 px-2 text-xs text-white"
            />
            <span className="uppercase tracking-wider text-[11px]">Até:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="field-shell h-8 rounded-none border border-white/15 bg-slate-950/70 px-2 text-xs text-white"
            />
          </div>

          {(selectedTier !== "ALL" || startDate || endDate || selectedArchetypeFilter) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedTier("ALL");
                setStartDate("");
                setEndDate("");
                setSelectedArchetypeFilter("");
              }}
              className="h-8 px-2 text-xs text-slate-400 hover:text-white"
            >
              <X className="mr-1 size-3" /> Limpar filtros
            </Button>
          )}
        </div>

        {/* REGRA DE CONFIABILIDADE E PONDERAÇÃO */}
        <div className="mt-3 flex items-start gap-2 rounded-none border border-accent/20 bg-accent/5 p-3 text-xs text-slate-300">
          <Info className="size-4 shrink-0 text-accent mt-0.5" />
          <p>
            <strong>Diretriz de Confiabilidade:</strong> Semanas com menos de 6 listas ou arquétipos com menos de 3 entradas no período são destacados como <span className="text-amber-400 font-mono font-semibold">amostra pequena</span>. Nessas faixas, variações percentuais pontuais não representam necessariamente migração estrutural de metagame.
          </p>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        {loading ? (
          <p className="mt-6 text-sm text-slate-400 font-mono py-8 text-center animate-pulse">
            CONSOLIDANDO SÉRIE TEMPORAL SEMANAL...
          </p>
        ) : weeks.length === 0 ? (
          <div className="mt-6 panel-cut border border-white/10 bg-slate-950/60 p-6 text-center">
            <p className="text-sm text-slate-400">
              Ainda não há dados suficientes de torneios com datas registradas neste recorte para montar a linha do tempo semanal.
            </p>
          </div>
        ) : viewMode === "weeks" ? (
          /* MODO 1: CARDS SEMANAIS */
          <div className="mt-6 space-y-4">
            {weeks.map((week) => {
              const filteredArchetypes = selectedArchetypeFilter
                ? week.archetypes.filter((a) => a.name === selectedArchetypeFilter)
                : week.archetypes;

              return (
                <div
                  key={week.weekKey}
                  className="panel-cut border border-white/10 bg-slate-950/70 p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center panel-cut border border-primary/40 bg-primary/10 font-heading text-sm text-primary">
                        {week.weekKey.split("-")[1]}
                      </div>
                      <div>
                        <h4 className="font-heading text-base uppercase text-white">
                          {week.weekLabel}
                        </h4>
                        <p className="text-xs text-slate-400 font-mono">
                          {week.totalLists} listas analisadas em {week.totalEvents} evento(s)
                        </p>
                      </div>
                    </div>

                    {/* Badge de Amostra Pequena na Semana */}
                    {week.isSmallSample ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge className="rounded-none border border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px] font-mono uppercase flex items-center gap-1">
                            <AlertTriangle className="size-3 text-amber-400" />
                            Amostra preliminar ({week.totalLists} listas)
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="bg-slate-900 border-white/20 text-xs text-slate-200">
                          {week.sampleWarning || "Poucas listas nesta semana — os dados têm maior volatilidade."}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Badge className="rounded-none border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[10px] font-mono uppercase flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-emerald-400" />
                        Amostra Robusta
                      </Badge>
                    )}
                  </div>

                  {/* Listagem de Arquétipos da Semana */}
                  {filteredArchetypes.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-500 font-mono">
                      Nenhum registro para o filtro aplicado nesta semana.
                    </p>
                  ) : (
                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredArchetypes.map((arch) => (
                        <div
                          key={arch.name}
                          className="panel-cut border border-white/5 bg-slate-900/60 p-3 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1.5 mb-1.5">
                              <div className="flex items-center gap-1">
                                {arch.colors.map((c) => (
                                  <span
                                    key={c}
                                    title={GAME_COLOR_LABEL_PT[c] || c}
                                    className="size-2 rounded-full"
                                    style={{ backgroundColor: GAME_COLOR_HEX[c] || FALLBACK_COLOR }}
                                  />
                                ))}
                                <span className="font-heading text-sm uppercase text-white truncate max-w-[140px]">
                                  {arch.name}
                                </span>
                              </div>
                              {arch.isSmallSample && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] uppercase font-mono tracking-wider text-amber-400 border-amber-500/40 bg-amber-500/10"
                                  title="Menos de 3 listas deste arquétipo nesta semana."
                                >
                                  Poucos dados
                                </Badge>
                              )}
                            </div>

                            {/* Barra de Meta Share */}
                            <div className="space-y-1 mt-2">
                              <div className="flex items-center justify-between text-[11px] font-mono">
                                <span className="text-slate-400">Presença:</span>
                                <span className="text-white font-bold">{(arch.share * 100).toFixed(1)}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-800 rounded-none overflow-hidden">
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${Math.min(100, Math.round(arch.share * 100))}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono text-slate-400">
                            <span>{arch.lists} lista(s)</span>
                            <span>
                              Winrate: <strong className="text-emerald-400">{arch.winRate != null ? `${Math.round(arch.winRate * 100)}%` : "—"}</strong>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* MODO 2: COMPARATIVO EM TABELA */
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-left uppercase text-slate-400">
                  <th className="py-2.5 pr-3">Semana</th>
                  <th className="py-2.5 pr-3">Amostra</th>
                  <th className="py-2.5 pr-3">Confiabilidade</th>
                  <th className="py-2.5 pr-3">Arquétipo Líder</th>
                  <th className="py-2.5 pr-3">Share Líder</th>
                  <th className="py-2.5 pr-3">2º Arquétipo</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => {
                  const leader = week.archetypes[0];
                  const runnerUp = week.archetypes[1];
                  return (
                    <tr key={week.weekKey} className="border-b border-white/5 text-slate-300">
                      <td className="py-2.5 pr-3 font-bold text-primary">{week.weekLabel}</td>
                      <td className="py-2.5 pr-3">{week.totalLists} listas ({week.totalEvents} eventos)</td>
                      <td className="py-2.5 pr-3">
                        {week.isSmallSample ? (
                          <span className="text-amber-400">⚠️ Amostra reduzida</span>
                        ) : (
                          <span className="text-emerald-400">✓ Amostra robusta</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-white">{leader ? leader.name : "—"}</td>
                      <td className="py-2.5 pr-3 text-accent font-bold">
                        {leader ? `${(leader.share * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-400">
                        {runnerUp ? `${runnerUp.name} (${(runnerUp.share * 100).toFixed(1)}%)` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
