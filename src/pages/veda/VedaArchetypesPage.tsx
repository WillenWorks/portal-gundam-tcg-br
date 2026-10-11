import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  ChevronRight,
  Filter,
  Layers,
  Medal,
  RotateCcw,
  Trophy,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VedaShell } from "@/components/veda/VedaShell";
import { VedaArchetypeBadge } from "@/components/veda/VedaArchetypeBadge";
import { VedaEmptyView, VedaErrorView, VedaLoadingView } from "@/components/veda/VedaStateViews";
import { vedaApi, type VedaArchetypesQueryParams } from "@/lib/veda/api";
import type { VedaArchetypeRow, VedaFilters } from "@/lib/veda/types";
import { GAME_COLOR_HEX, TOURNAMENT_TIER_OPTIONS } from "@/lib/gundam-catalog";

export default function VedaArchetypesPage() {
  const [location, navigate] = useLocation();

  const currentParams = useMemo(() => {
    const searchPart = window.location.hash.includes("?")
      ? window.location.hash.substring(window.location.hash.indexOf("?"))
      : window.location.search;
    return new URLSearchParams(searchPart);
  }, [location]);

  const seasonParam = currentParams.get("season") || "";
  const tierParam = currentParams.get("tier") || "";
  const ufParam = currentParams.get("uf") || "";

  const [filtersMeta, setFiltersMeta] = useState<VedaFilters | null>(null);
  const [rows, setRows] = useState<VedaArchetypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateQueryParam = useCallback(
    (newParams: Record<string, string | null>) => {
      const sp = new URLSearchParams(
        window.location.hash.includes("?")
          ? window.location.hash.substring(window.location.hash.indexOf("?"))
          : window.location.search,
      );

      for (const [key, val] of Object.entries(newParams)) {
        if (val === null || val === "" || val === undefined) {
          sp.delete(key);
        } else {
          sp.set(key, val);
        }
      }

      const qs = sp.toString();
      navigate(`/arquetipos${qs ? `?${qs}` : ""}`);
    },
    [navigate],
  );

  const resetFilters = useCallback(() => {
    navigate("/arquetipos");
  }, [navigate]);

  useEffect(() => {
    let active = true;
    vedaApi
      .getFilters()
      .then((meta) => {
        if (active) setFiltersMeta(meta);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const loadArchetypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams: VedaArchetypesQueryParams = {
        season: seasonParam || undefined,
        tier: (tierParam as any) || undefined,
        uf: ufParam || undefined,
      };
      const result = await vedaApi.getArchetypes(queryParams);
      setRows(result);
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar os arquétipos.");
    } finally {
      setLoading(false);
    }
  }, [seasonParam, tierParam, ufParam]);

  useEffect(() => {
    loadArchetypes();
  }, [loadArchetypes]);

  const hasActiveFilters = Boolean(seasonParam || tierParam || ufParam);
  const totalLists = rows.reduce((acc, r) => acc + r.lists, 0);

  return (
    <VedaShell
      title="Ranking de Arquétipos & Tier List Competitiva"
      description="Presença consolidada no metagame, conversão em Top 8 e taxa de títulos por arquétipo a partir de decklists reais de torneio."
      breadcrumbs={[{ label: "Arquétipos" }]}
    >
      <div className="space-y-6">
        {/* Barra de Filtros de Recorte */}
        <div className="panel-cut border border-white/10 bg-slate-950/80 p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Temporada */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                  Temporada
                </label>
                <select
                  value={seasonParam}
                  onChange={(e) => updateQueryParam({ season: e.target.value || null })}
                  className="h-8 px-2 rounded-none border border-white/15 bg-slate-900 text-xs text-white font-mono focus:border-primary outline-none"
                >
                  <option value="">Todas as Temporadas</option>
                  {filtersMeta?.seasons.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} {s.isCurrent ? "(Atual)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tier / Categoria */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                  Categoria
                </label>
                <select
                  value={tierParam}
                  onChange={(e) => updateQueryParam({ tier: e.target.value || null })}
                  className="h-8 px-2 rounded-none border border-white/15 bg-slate-900 text-xs text-white font-mono focus:border-primary outline-none"
                >
                  <option value="">Todas as Categorias</option>
                  {TOURNAMENT_TIER_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* UF */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                  Estado (UF)
                </label>
                <select
                  value={ufParam}
                  onChange={(e) => updateQueryParam({ uf: e.target.value || null })}
                  className="h-8 px-2 rounded-none border border-white/15 bg-slate-900 text-xs text-white font-mono focus:border-primary outline-none"
                >
                  <option value="">Todo o Brasil / Mundo</option>
                  {filtersMeta?.ufs.map((u) => (
                    <option key={u.uf} value={u.uf}>
                      {u.uf}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
              <span>
                Total de listas no recorte: <strong className="text-white">{totalLists}</strong>
              </span>
              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetFilters}
                  className="h-8 rounded-none border-white/15 bg-white/5 text-[11px] font-mono uppercase text-slate-300 hover:text-white"
                >
                  <RotateCcw className="mr-1 size-3" />
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        {loading ? (
          <VedaLoadingView label="Calculando matriz competitiva dos arquétipos..." />
        ) : error ? (
          <VedaErrorView error={error} onRetry={loadArchetypes} />
        ) : rows.length === 0 ? (
          <VedaEmptyView
            title="Nenhum arquétipo registrado"
            description="Não foram encontrados dados de arquétipos para o recorte especificado."
            actionLabel="Limpar Filtros"
            onAction={resetFilters}
          />
        ) : (
          <div className="panel-cut border border-white/10 bg-slate-950/80 p-4 sm:p-6 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/15 text-[10px] font-mono uppercase tracking-wider text-slate-400 bg-white/5">
                    <th className="py-3 px-3 w-12 text-center">#</th>
                    <th className="py-3 px-3">Arquétipo</th>
                    <th className="py-3 px-3 w-40">Presença no Meta</th>
                    <th className="py-3 px-3 w-28 text-center">Top 8 (%)</th>
                    <th className="py-3 px-3 w-24 text-center">Títulos</th>
                    <th className="py-3 px-3 w-20 text-center">Listas</th>
                    <th className="py-3 px-3 w-20 text-center">Melhor</th>
                    <th className="py-3 px-3 w-24 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 font-mono">
                  {rows.map((row, idx) => {
                    const sharePercent = (row.share * 100).toFixed(1);
                    const top8Percent = (row.top8Share * 100).toFixed(1);
                    const winPercent = (row.winShare * 100).toFixed(1);
                    const primaryColor = row.archetype.colors?.[0];
                    const barColor = primaryColor ? GAME_COLOR_HEX[primaryColor] || "#3b82f6" : "#3b82f6";

                    return (
                      <tr key={row.archetype.slug} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3.5 px-3 text-center text-slate-400 font-bold">
                          {idx === 0 ? (
                            <span className="text-amber-400">1º</span>
                          ) : idx === 1 ? (
                            <span className="text-slate-300">2º</span>
                          ) : idx === 2 ? (
                            <span className="text-amber-600">3º</span>
                          ) : (
                            `${idx + 1}º`
                          )}
                        </td>

                        <td className="py-3.5 px-3">
                          <VedaArchetypeBadge archetype={row.archetype} />
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-white font-bold">{sharePercent}%</span>
                              <span className="text-slate-400">{row.lists} decks</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-900 overflow-hidden border border-white/10">
                              <div
                                className="h-full transition-all"
                                style={{
                                  width: `${Math.min(100, Math.max(3, parseFloat(sharePercent)))}%`,
                                  backgroundColor: barColor,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`font-semibold ${
                              parseFloat(top8Percent) >= 50 ? "text-emerald-400" : "text-slate-200"
                            }`}
                          >
                            {top8Percent}%
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          {row.wins > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-300 font-bold">
                              <Trophy className="size-3 text-amber-400" />
                              {row.wins} ({winPercent}%)
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-center text-slate-300">{row.lists}</td>

                        <td className="py-3.5 px-3 text-center">
                          {row.bestPlacement ? (
                            <span className="text-white font-semibold">{row.bestPlacement}º</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="h-7 rounded-none border-primary/30 bg-primary/10 text-[10px] font-mono uppercase text-primary hover:bg-primary/20 hover:text-white"
                          >
                            <Link href={`/arquetipos/${row.archetype.slug}`}>
                              Detalhes
                              <ChevronRight className="size-3 ml-0.5" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </VedaShell>
  );
}
