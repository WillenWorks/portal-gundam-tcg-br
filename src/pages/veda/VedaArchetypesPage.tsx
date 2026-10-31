import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ChevronRight,
  RotateCcw,
  Trophy,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { VedaShell } from "@/components/veda/VedaShell";
import { VedaArchetypeBadge } from "@/components/veda/VedaArchetypeBadge";
import { VedaEmptyView, VedaErrorView, VedaLoadingView } from "@/components/veda/VedaStateViews";
import { vedaApi, type VedaArchetypesQueryParams } from "@/lib/veda/api";
import type { VedaArchetypeRow, VedaFilters } from "@/lib/veda/types";
import { resolveGameColorHex, TOURNAMENT_TIER_OPTIONS } from "@/lib/gundam-catalog";
import { DEFAULT_ANALYSIS_SEASON } from "@/lib/seasons";

const DEFAULT_SEASON = DEFAULT_ANALYSIS_SEASON;

function readFiltersFromUrl() {
  const searchPart = window.location.hash.includes("?")
    ? window.location.hash.substring(window.location.hash.indexOf("?"))
    : window.location.search;
  const sp = new URLSearchParams(searchPart);
  const rawSeason = sp.get("season");
  return {
    season: rawSeason !== null ? rawSeason : DEFAULT_SEASON,
    rawSeasonHasParam: rawSeason !== null,
    tier: sp.get("tier") || "",
    country: sp.get("country") || "",
    uf: sp.get("uf") || "",
  };
}

export default function VedaArchetypesPage() {
  const [, navigate] = useLocation();

  const initial = useMemo(() => readFiltersFromUrl(), []);
  // a temporada veio na URL? (ref: limpar o filtro desliga sem re-render, como antes)
  const seasonFromUrl = useRef(initial.rawSeasonHasParam);
  const [season, setSeason] = useState(initial.season);
  const [tier, setTier] = useState(initial.tier);
  const [uf, setUf] = useState(initial.uf);
  // meta local (Brasil) ou global (todas as fontes e países)
  const [country, setCountry] = useState(initial.country);

  const [filtersMeta, setFiltersMeta] = useState<VedaFilters | null>(null);
  const [rows, setRows] = useState<VedaArchetypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentSeasonCode = useMemo(() => {
    return filtersMeta?.seasons.find((s) => s.isCurrent)?.code || DEFAULT_SEASON;
  }, [filtersMeta]);

  // Carrega opções de filtro e alinha temporada se não explicitada
  useEffect(() => {
    let active = true;
    vedaApi
      .getFilters()
      .then((meta) => {
        if (!active) return;
        setFiltersMeta(meta);
        const cur = meta.seasons.find((s) => s.isCurrent)?.code;
        const searchPart = window.location.hash.includes("?")
          ? window.location.hash.substring(window.location.hash.indexOf("?"))
          : window.location.search;
        const sp = new URLSearchParams(searchPart);
        if (sp.get("season") === null && cur && cur !== DEFAULT_SEASON) {
          setSeason(cur);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const isInitialMount = useRef(true);
  const lastNavigatedQs = useRef<string>(
    typeof window !== "undefined"
      ? new URLSearchParams(
          window.location.hash.includes("?")
            ? window.location.hash.substring(window.location.hash.indexOf("?"))
            : window.location.search,
        ).toString()
      : "",
  );

  // Sincroniza estado com a URL apenas após mudanças ativas (evita replaceState na montagem)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const sp = new URLSearchParams();
    if (season && (season !== currentSeasonCode || seasonFromUrl.current)) {
      sp.set("season", season);
    }
    if (tier) sp.set("tier", tier);
    if (country) sp.set("country", country);
    if (uf) sp.set("uf", uf);

    const qs = sp.toString();
    if (lastNavigatedQs.current !== qs) {
      lastNavigatedQs.current = qs;
      navigate(`/arquetipos${qs ? `?${qs}` : ""}`, { replace: true });
    }
  }, [season, tier, country, uf, currentSeasonCode, navigate]);

  // Sincroniza histórico do navegador
  useEffect(() => {
    const handlePopState = () => {
      const searchPart = window.location.hash.includes("?")
        ? window.location.hash.substring(window.location.hash.indexOf("?"))
        : window.location.search;
      const currentQs = new URLSearchParams(searchPart).toString();

      // Se o evento foi disparado pela nossa própria navegação, ignora
      if (currentQs === lastNavigatedQs.current) return;

      lastNavigatedQs.current = currentQs;
      const f = readFiltersFromUrl();
      setSeason(f.season);
      setTier(f.tier);
      setCountry(f.country);
      setUf(f.uf);
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("hashchange", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("hashchange", handlePopState);
    };
  }, []);

  const resetFilters = useCallback(() => {
    seasonFromUrl.current = false;
    setSeason(currentSeasonCode);
    setTier("");
    setCountry("");
    setUf("");
  }, [currentSeasonCode]);

  const loadArchetypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams: VedaArchetypesQueryParams = {
        season: season && season !== "all" ? season : undefined,
        tier: (tier as any) || undefined,
        country: country || undefined,
        uf: uf || undefined,
      };
      const result = await vedaApi.getArchetypes(queryParams);
      setRows(result);
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar os arquétipos.");
    } finally {
      setLoading(false);
    }
  }, [season, tier, country, uf]);

  useEffect(() => {
    loadArchetypes();
  }, [loadArchetypes]);

  const isCurrentSeasonActive = season === currentSeasonCode;
  const hasActiveFilters = Boolean((!isCurrentSeasonActive && season) || tier || country || uf);
  const totalLists = rows.reduce((acc, r) => acc + r.lists, 0);

  return (
    <VedaShell
      title="Arquétipos & Decks Competitivos"
      description="Compare a presença de cada arquétipo no metagame, conversão em Top 8, títulos conquistados e inspecione as listas reais de cada deck."
      breadcrumbs={[{ label: "Arquétipos" }]}
    >
      <div className="space-y-6">
        {/* Barra de Filtros de Recorte */}
        <div className="panel-cut border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/80 p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Temporada */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-slate-600 dark:text-slate-400 tracking-wider">
                  Temporada
                </label>
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="h-8 px-2 rounded-none border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-mono focus:border-primary outline-none"
                >
                  <option value="all">Todas as Temporadas</option>
                  {filtersMeta ? (
                    filtersMeta.seasons.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name} {s.isCurrent ? "(Atual)" : ""}
                      </option>
                    ))
                  ) : (
                    <option value={DEFAULT_SEASON}>Temporada {DEFAULT_SEASON}</option>
                  )}
                </select>
              </div>

              {/* Tier / Categoria */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-slate-600 dark:text-slate-400 tracking-wider">
                  Categoria
                </label>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                  className="h-8 px-2 rounded-none border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-mono focus:border-primary outline-none"
                >
                  <option value="">Todas as Categorias</option>
                  {TOURNAMENT_TIER_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recorte: meta global ou local (Brasil) */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-slate-600 dark:text-slate-400 tracking-wider">
                  Meta
                </label>
                <select
                  aria-label="Meta global ou local"
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    if (!e.target.value) setUf("");
                  }}
                  className="h-8 px-2 rounded-none border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-mono focus:border-primary outline-none"
                >
                  <option value="">Global (todos os países)</option>
                  <option value="Brasil">Local (Brasil)</option>
                </select>
              </div>

              {/* UF */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-slate-600 dark:text-slate-400 tracking-wider">
                  Estado (UF)
                </label>
                <select
                  value={uf}
                  onChange={(e) => setUf(e.target.value)}
                  className="h-8 px-2 rounded-none border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-mono focus:border-primary outline-none"
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

            <div className="flex items-center gap-3 text-xs font-mono text-slate-600 dark:text-slate-400">
              <span>
                Total de listas no recorte: <strong className="text-slate-900 dark:text-white">{totalLists}</strong>
              </span>
              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetFilters}
                  className="h-8 rounded-none border-slate-300 dark:border-white/15 bg-slate-100 dark:bg-white/5 text-[11px] font-mono uppercase text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
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
          <div className="panel-cut border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/80 p-4 sm:p-6 space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/15 text-[10px] font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-white/5">
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
                <tbody className="divide-y divide-slate-200 dark:divide-white/10 font-mono">
                  {rows.map((row, idx) => {
                    const sharePercent = (row.share * 100).toFixed(1);
                    const top8Percent = (row.top8Share * 100).toFixed(1);
                    const winPercent = (row.winShare * 100).toFixed(1);
                    const primaryColor = row.archetype.colors?.[0];
                    const barColor = primaryColor ? resolveGameColorHex(primaryColor, "#3b82f6") : "#3b82f6";

                    return (
                      <tr key={row.archetype.slug} className="hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                        <td className="py-3.5 px-3 text-center text-slate-500 dark:text-slate-400 font-bold">
                          {idx === 0 ? (
                            <span className="text-amber-500 dark:text-amber-400">1º</span>
                          ) : idx === 1 ? (
                            <span className="text-slate-700 dark:text-slate-300">2º</span>
                          ) : idx === 2 ? (
                            <span className="text-amber-700 dark:text-amber-600">3º</span>
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
                              <span className="text-slate-900 dark:text-white font-bold">{sharePercent}%</span>
                              <span className="text-slate-500 dark:text-slate-400">{row.lists} decks</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 overflow-hidden border border-slate-200 dark:border-white/10">
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
                              parseFloat(top8Percent) >= 50
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-700 dark:text-slate-200"
                            }`}
                          >
                            {top8Percent}%
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          {row.wins > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300 font-bold">
                              <Trophy className="size-3 text-amber-500 dark:text-amber-400" />
                              {row.wins} ({winPercent}%)
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-center text-slate-700 dark:text-slate-300">{row.lists}</td>

                        <td className="py-3.5 px-3 text-center">
                          {row.bestPlacement ? (
                            <span className="text-slate-900 dark:text-white font-semibold">{row.bestPlacement}º</span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="h-7 rounded-none border-primary/30 bg-primary/10 text-[10px] font-mono uppercase text-primary hover:bg-primary/20 hover:text-slate-900 dark:hover:text-white"
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
