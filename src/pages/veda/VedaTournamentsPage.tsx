import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  Flag,
  Globe,
  Layers,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  Trophy,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { VedaShell } from "@/components/veda/VedaShell";
import { VedaArchetypeBadge } from "@/components/veda/VedaArchetypeBadge";
import { VedaPlayerLink } from "@/components/veda/VedaPlayerLink";
import { VedaSourceCredit } from "@/components/veda/VedaSourceCredit";
import { VedaEmptyView, VedaErrorView, VedaLoadingView } from "@/components/veda/VedaStateViews";
import { vedaApi, type VedaTournamentQueryParams } from "@/lib/veda/api";
import type { Paginated, VedaFilters, VedaTournamentCard, VedaTournamentDetail } from "@/lib/veda/types";
import { TOURNAMENT_TIER_OPTIONS } from "@/lib/gundam-catalog";

const PAGE_SIZE = 24;
const DEFAULT_SEASON = "GD05";

function formatDatePtBr(raw?: string | null): string {
  if (!raw) return "Data a definir";
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

function readFiltersFromUrl() {
  const searchPart = window.location.hash.includes("?")
    ? window.location.hash.substring(window.location.hash.indexOf("?"))
    : window.location.search;
  const sp = new URLSearchParams(searchPart);
  const rawSeason = sp.get("season");
  return {
    country: sp.get("country") || "",
    season: rawSeason !== null ? rawSeason : DEFAULT_SEASON,
    tier: sp.get("tier") || "",
    source: sp.get("source") || "",
    uf: sp.get("uf") || "",
    city: sp.get("city") || "",
    q: sp.get("q") || "",
    page: Math.max(1, parseInt(sp.get("page") || "1", 10) || 1),
  };
}

export default function VedaTournamentsPage() {
  const [, navigate] = useLocation();

  // Estados locais reativos dos filtros e paginação
  const initial = useMemo(() => readFiltersFromUrl(), []);
  const [country, setCountry] = useState(initial.country);
  const [season, setSeason] = useState(initial.season);
  const [tier, setTier] = useState(initial.tier);
  const [source, setSource] = useState(initial.source);
  const [uf, setUf] = useState(initial.uf);
  const [city, setCity] = useState(initial.city);
  const [q, setQ] = useState(initial.q);
  const [page, setPage] = useState(initial.page);
  const [searchDraft, setSearchDraft] = useState(initial.q);

  const [filtersMeta, setFiltersMeta] = useState<VedaFilters | null>(null);
  const [data, setData] = useState<Paginated<VedaTournamentCard> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Estados para expansão inline de detalhes dos torneios
  const [expandedTournaments, setExpandedTournaments] = useState<Record<string, boolean>>({});
  const [tournamentDetails, setTournamentDetails] = useState<Record<string, VedaTournamentDetail>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});

  const currentSeasonCode = useMemo(() => {
    return filtersMeta?.seasons.find((s) => s.isCurrent)?.code || DEFAULT_SEASON;
  }, [filtersMeta]);

  // Carrega opções de filtro do backend e sincroniza temporada atual se necessário
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
      .catch(() => {
        // Fallback silencioso
      });
    return () => {
      active = false;
    };
  }, []);

  const lastNavigatedQs = useRef<string | null>(null);

  // Sincroniza estado com a URL (mantendo links compartilháveis e preservando histórico)
  useEffect(() => {
    const sp = new URLSearchParams();
    if (country) sp.set("country", country);
    if (season) sp.set("season", season);
    if (tier) sp.set("tier", tier);
    if (source) sp.set("source", source);
    if (uf) sp.set("uf", uf);
    if (city) sp.set("city", city);
    if (q) sp.set("q", q);
    if (page > 1) sp.set("page", String(page));

    const qs = sp.toString();
    if (lastNavigatedQs.current !== qs) {
      lastNavigatedQs.current = qs;
      const targetPath = `/torneios${qs ? `?${qs}` : ""}`;
      navigate(targetPath, { replace: true });
    }
  }, [country, season, tier, source, uf, city, q, page, navigate]);

  // Sincroniza quando o usuário clica nos botões Voltar/Avançar do navegador
  useEffect(() => {
    const handlePopState = () => {
      const f = readFiltersFromUrl();
      lastNavigatedQs.current = null;
      setCountry(f.country);
      setSeason(f.season);
      setTier(f.tier);
      setSource(f.source);
      setUf(f.uf);
      setCity(f.city);
      setQ(f.q);
      setSearchDraft(f.q);
      setPage(f.page);
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("hashchange", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("hashchange", handlePopState);
    };
  }, []);

  const resetAllFilters = useCallback(() => {
    setCountry("");
    setSeason(currentSeasonCode);
    setTier("");
    setSource("");
    setUf("");
    setCity("");
    setQ("");
    setSearchDraft("");
    setPage(1);
  }, [currentSeasonCode]);

  // Alterna e carrega dados expandidos de um torneio
  const toggleExpandTournament = useCallback(
    async (id: string) => {
      setExpandedTournaments((prev) => ({
        ...prev,
        [id]: !prev[id],
      }));

      if (!tournamentDetails[id] && !loadingDetails[id]) {
        setLoadingDetails((prev) => ({ ...prev, [id]: true }));
        try {
          const detail = await vedaApi.getTournament(id);
          setTournamentDetails((prev) => ({ ...prev, [id]: detail }));
        } catch {
          // Fallback silencioso
        } finally {
          setLoadingDetails((prev) => ({ ...prev, [id]: false }));
        }
      }
    },
    [tournamentDetails, loadingDetails],
  );

  // Carrega torneios quando filtros mudam
  const loadTournaments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const queryParams: VedaTournamentQueryParams = {
        country: country || undefined,
        season: season && season !== "all" ? season : undefined,
        tier: (tier as any) || undefined,
        source: source || undefined,
        uf: uf || undefined,
        city: city || undefined,
        q: q || undefined,
        offset,
        limit: PAGE_SIZE,
      };

      const result = await vedaApi.getTournaments(queryParams);
      setData(result);
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar os torneios.");
    } finally {
      setLoading(false);
    }
  }, [page, country, season, tier, source, uf, city, q]);

  useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const isCurrentSeasonActive = season === currentSeasonCode;
  const hasActiveFilters = Boolean(
    country || (!isCurrentSeasonActive && season) || tier || source || uf || city || q
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQ(searchDraft.trim());
    setPage(1);
  };

  return (
    <VedaShell
      title="Torneios & Relatórios Oficiais"
      description="Base unificada de torneios competitivos do Gundam TCG no Brasil e no mundo. Classificações consolidadas, decklists congeladas e divisão do metagame."
      breadcrumbs={[{ label: "Torneios" }]}
    >
      <div className="space-y-6">
        {/* Barra de Filtros e Busca Tática */}
        <div className="panel-cut border dark:border-white/10 dark:bg-slate-950/80 light:border-slate-300 light:bg-white p-4 sm:p-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Toggle Rápido: Todos vs Brasil */}
            <div className="inline-flex rounded-md border dark:border-white/15 dark:bg-slate-900/80 light:border-slate-300 light:bg-slate-100 p-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCountry("");
                  setUf("");
                  setCity("");
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider transition-colors rounded-xs cursor-pointer ${
                  !country
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Exibir todos os torneios mundiais e nacionais"
              >
                <Globe className="size-3.5" />
                Todos
              </button>
              <button
                type="button"
                onClick={() => {
                  setCountry("Brasil");
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider transition-colors rounded-xs cursor-pointer ${
                  country.toLowerCase() === "brasil"
                    ? "bg-amber-500 text-slate-950 shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Exibir apenas torneios realizados no Brasil"
              >
                <Flag className="size-3.5" />
                Brasil 🇧🇷
              </button>
            </div>

            {/* Campo de Busca por Nome */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Buscar torneio pelo nome ou loja..."
                className="pl-9 h-10 rounded-none dark:border-white/15 dark:bg-white/5 dark:text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 placeholder:text-slate-500 font-mono text-xs focus-visible:border-primary"
              />
              {searchDraft && searchDraft !== q && (
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-mono uppercase bg-primary text-primary-foreground font-bold cursor-pointer"
                >
                  Filtrar
                </button>
              )}
            </form>

            {/* Toggle Filtros no Mobile */}
            <div className="flex items-center gap-2 sm:hidden">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMobileFiltersOpen((prev) => !prev)}
                className="w-full rounded-none border-slate-300 dark:border-white/20 text-xs font-mono uppercase text-slate-700 dark:text-slate-300"
              >
                <Filter className="mr-1.5 size-3.5" />
                {mobileFiltersOpen ? "Ocultar Filtros" : "Exibir Filtros"}
              </Button>
              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetAllFilters}
                  className="rounded-none text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  title="Limpar todos os filtros"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              )}
            </div>

            {/* Totalizador de Registros */}
            <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-slate-500 dark:text-slate-400">
              {data && (
                <span>
                  Mostrando <strong className="dark:text-white light:text-slate-900">{data.total}</strong> evento(s)
                </span>
              )}
              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetAllFilters}
                  className="h-8 rounded-none dark:border-white/15 dark:bg-white/5 dark:text-slate-300 light:border-slate-300 light:bg-slate-100 light:text-slate-700 hover:text-white hover:bg-white/10 text-[11px] font-mono uppercase"
                >
                  <RotateCcw className="mr-1 size-3" />
                  Limpar Filtros
                </Button>
              )}
            </div>
          </div>

          {/* Linha de Seletores (Desktop ou Mobile Aberto) */}
          <div
            className={`grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 pt-3 border-t dark:border-white/10 light:border-slate-200 ${
              mobileFiltersOpen ? "block" : "hidden sm:grid"
            }`}
          >
            {/* Temporada */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 tracking-wider font-semibold">
                Temporada
              </label>
              <select
                value={season}
                onChange={(e) => {
                  setSeason(e.target.value);
                  setPage(1);
                }}
                className="w-full h-8 px-2 rounded-none border dark:border-white/15 dark:bg-slate-900 dark:text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 text-xs font-mono focus:border-primary outline-none"
              >
                <option value="all">Todas as Temporadas</option>
                {filtersMeta ? (
                  filtersMeta.seasons.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} {s.isCurrent ? "(Atual)" : ""}
                    </option>
                  ))
                ) : (
                  <option value={DEFAULT_SEASON}>Temporada GD05 (Atual)</option>
                )}
              </select>
            </div>

            {/* Categoria / Tier */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 tracking-wider font-semibold">
                Categoria
              </label>
              <select
                value={tier}
                onChange={(e) => {
                  setTier(e.target.value);
                  setPage(1);
                }}
                className="w-full h-8 px-2 rounded-none border dark:border-white/15 dark:bg-slate-900 dark:text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 text-xs font-mono focus:border-primary outline-none"
              >
                <option value="">Todas as Categorias</option>
                {TOURNAMENT_TIER_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Estado / UF */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 tracking-wider font-semibold">
                Estado (UF)
              </label>
              <select
                value={uf}
                onChange={(e) => {
                  setUf(e.target.value);
                  setCity("");
                  setPage(1);
                }}
                className="w-full h-8 px-2 rounded-none border dark:border-white/15 dark:bg-slate-900 dark:text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 text-xs font-mono focus:border-primary outline-none"
              >
                <option value="">Todos os Estados</option>
                {filtersMeta?.ufs.map((u) => (
                  <option key={u.uf} value={u.uf}>
                    {u.uf}
                  </option>
                ))}
              </select>
            </div>

            {/* Cidade (habilitado se UF selecionada ou global) */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 tracking-wider font-semibold">
                Cidade
              </label>
              <select
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setPage(1);
                }}
                className="w-full h-8 px-2 rounded-none border dark:border-white/15 dark:bg-slate-900 dark:text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 text-xs font-mono focus:border-primary outline-none"
              >
                <option value="">Todas as Cidades</option>
                {(
                  (uf
                    ? filtersMeta?.ufs.find((u) => u.uf === uf)?.cities
                    : filtersMeta?.ufs.flatMap((u) => u.cities)) || []
                )
                  .filter((c, i, arr) => arr.indexOf(c) === i)
                  .sort()
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>

            {/* Fonte dos Dados */}
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 tracking-wider font-semibold">
                Origem / Fonte
              </label>
              <select
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setPage(1);
                }}
                className="w-full h-8 px-2 rounded-none border dark:border-white/15 dark:bg-slate-900 dark:text-white light:border-slate-300 light:bg-slate-50 light:text-slate-900 text-xs font-mono focus:border-primary outline-none"
              >
                <option value="">Todas as Fontes</option>
                <option value="digilab">DigiLab (Brasil)</option>
                <option value="egman">Egman Events (Mundial)</option>
                <option value="manual">Cadastro no Site</option>
              </select>
            </div>
          </div>
        </div>

        {/* Conteúdo: Loading, Erro, Vazio ou Lista */}
        {loading ? (
          <VedaLoadingView label="Consultando arquivos de torneio do Veda System..." />
        ) : error ? (
          <VedaErrorView error={error} onRetry={loadTournaments} />
        ) : !data || data.items.length === 0 ? (
          <VedaEmptyView
            title="Nenhum torneio encontrado"
            description="Nenhum evento registrado corresponde aos critérios informados."
            actionLabel="Limpar Filtros"
            onAction={resetAllFilters}
          />
        ) : (
          <div className="space-y-6">
            {/* Grade de Torneios Responsiva: 1 col celular, 2 col tablet, 3 col desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.items.map((tournament) => {
                const isExpanded = Boolean(expandedTournaments[tournament.id]);
                const details = tournamentDetails[tournament.id];
                const isLoadingDetail = Boolean(loadingDetails[tournament.id]);

                const hasRegionalLink = Boolean(tournament.place.uf);
                const regionalUrl = hasRegionalLink
                  ? `/metagame/regional?uf=${encodeURIComponent(tournament.place.uf || "")}${
                      tournament.place.city ? `&cidade=${encodeURIComponent(tournament.place.city)}` : ""
                    }`
                  : null;

                return (
                  <div
                    key={tournament.id}
                    className="panel-cut border dark:border-white/10 dark:bg-slate-950/70 light:border-slate-200 light:bg-white light:shadow-sm p-4 sm:p-5 flex flex-col justify-between transition-all hover:border-primary/50 dark:hover:bg-slate-950/90 light:hover:border-primary/50 group"
                  >
                    <div className="space-y-3">
                      {/* Linha de topo: Tier + Temporada + Data */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary text-[10px] font-mono uppercase font-semibold">
                            {tierLabel(tournament.tier)}
                          </Badge>
                          {tournament.season && (
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase dark:bg-white/5 light:bg-slate-100 px-1.5 py-0.5 border dark:border-white/10 light:border-slate-200 font-semibold">
                              {tournament.season}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {formatDatePtBr(tournament.date)}
                        </span>
                      </div>

                      {/* Nome do Torneio (Link) */}
                      <div>
                        <Link
                          href={`/torneios/${tournament.id}`}
                          className="font-heading text-lg sm:text-xl uppercase dark:text-white light:text-slate-900 group-hover:text-primary transition-colors block line-clamp-2"
                          title={tournament.name}
                        >
                          {tournament.name}
                        </Link>

                        {/* Localidade com Link Regional se houver cidade/UF */}
                        {(tournament.place.store || tournament.place.city || tournament.place.uf || tournament.place.country) && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <MapPin className="size-3 text-slate-400 shrink-0" />
                            <span className="truncate">
                              {tournament.place.store ? `${tournament.place.store} · ` : ""}
                              {regionalUrl ? (
                                <Link
                                  href={regionalUrl}
                                  className="text-slate-700 dark:text-slate-300 hover:text-primary underline decoration-dotted transition-colors font-medium"
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
                          </div>
                        )}
                      </div>

                      {/* Bloco do Campeão */}
                      <div className="panel-cut border dark:border-white/10 dark:bg-slate-900/60 light:border-slate-200 light:bg-slate-50 p-3 space-y-1.5">
                        <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400 font-bold">
                          <Trophy className="size-3 shrink-0" />
                          <span>Campeão do Torneio</span>
                        </div>

                        {tournament.winner ? (
                          <div className="flex flex-col gap-1">
                            <div className="text-sm font-semibold dark:text-white light:text-slate-900">
                              <VedaPlayerLink player={tournament.winner.player} />
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              {tournament.winner.archetype ? (
                                <VedaArchetypeBadge archetype={tournament.winner.archetype} />
                              ) : (
                                <span className="text-xs text-slate-500 font-mono">Arquétipo não informado</span>
                              )}
                              {tournament.winner.entryId && (
                                <Link
                                  href={`/torneios/${tournament.id}/lista/${tournament.winner.entryId}`}
                                  className="text-[10px] font-mono uppercase text-primary hover:underline decoration-dotted shrink-0 font-semibold"
                                >
                                  Ver lista
                                </Link>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 font-mono">Campeão não registrado</p>
                        )}
                      </div>

                      {/* Métricas do Torneio */}
                      <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Users className="size-3 text-slate-400 shrink-0" />
                          <span>
                            {tournament.participantCount || tournament.entriesCount} pilotos
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="size-3 text-slate-400 shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {tournament.decklistsCount} {tournament.decklistsCount === 1 ? "decklist" : "decklists"}
                          </span>
                        </span>
                      </div>

                      {/* Seção Expandida (Top Cut / Standings Completos) */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t dark:border-white/10 light:border-slate-200 space-y-2.5 animate-in fade-in-50 duration-200">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-500 dark:text-amber-400 font-bold flex items-center gap-1">
                              <Trophy className="size-3" /> Classificação / Top Cut
                            </span>
                            {details?.roundCount && (
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                {details.roundCount} rodadas
                              </span>
                            )}
                          </div>

                          {isLoadingDetail ? (
                            <div className="flex items-center justify-center py-4 text-xs font-mono text-slate-400 gap-2">
                              <Loader2 className="size-4 animate-spin text-primary" />
                              <span>Carregando colocações e súmulas...</span>
                            </div>
                          ) : details?.standings && details.standings.length > 0 ? (
                            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                              {details.standings.slice(0, 8).map((standing) => (
                                <div
                                  key={standing.entryId}
                                  className="flex items-center justify-between gap-2 rounded-xs border dark:border-white/5 dark:bg-white/[0.02] light:border-slate-200 light:bg-slate-50 p-2 text-xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className={`size-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${
                                        standing.placement === 1
                                          ? "bg-amber-500/20 text-amber-500 border border-amber-500/40"
                                          : standing.placement === 2
                                          ? "bg-slate-300/30 text-slate-700 dark:text-slate-300 border border-slate-400/40"
                                          : standing.placement === 3
                                          ? "bg-amber-700/20 text-amber-700 dark:text-amber-500 border border-amber-700/40"
                                          : "bg-slate-800 text-slate-400"
                                      }`}
                                    >
                                      {standing.placementLabel}
                                    </span>
                                    <div className="truncate min-w-0">
                                      <p className="truncate font-semibold dark:text-white light:text-slate-900 text-xs">
                                        {standing.player.name}
                                      </p>
                                      {standing.archetype && (
                                        <p className="truncate text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                          {standing.archetype.name}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {standing.record && (
                                      <span className="font-mono text-[10px] text-slate-600 dark:text-cyan-300 px-1 py-0.5 rounded-xs dark:bg-black/40 light:bg-slate-200">
                                        {standing.record}
                                      </span>
                                    )}
                                    {standing.hasDecklist && (
                                      <Link
                                        href={`/torneios/${tournament.id}/lista/${standing.entryId}`}
                                        className="text-[10px] font-mono uppercase text-primary hover:underline font-semibold"
                                      >
                                        Deck
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 font-mono py-2">
                              Colocações detalhadas disponíveis no relatório oficial.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Rodapé do Card: Crédito da Fonte + Toggle de Expansão + Ação de Detalhe */}
                    <div className="mt-4 pt-3 border-t dark:border-white/10 light:border-slate-200 flex items-center justify-between gap-2">
                      <VedaSourceCredit source={tournament.source} sourceUrl={tournament.sourceUrl} />

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => toggleExpandTournament(tournament.id)}
                          className="h-7 rounded-none dark:border-white/20 dark:bg-white/5 dark:text-slate-300 light:border-slate-300 light:bg-slate-50 light:text-slate-700 hover:text-white hover:bg-white/10 text-[11px] font-mono uppercase font-semibold"
                          title={isExpanded ? "Recolher detalhes" : "Expandir classificação e pódio"}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="size-3 mr-1" />
                              Recolher
                            </>
                          ) : (
                            <>
                              <ChevronDown className="size-3 mr-1" />
                              Expandir Top
                            </>
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="h-7 rounded-none border-primary/30 bg-primary/10 text-[11px] font-mono uppercase text-primary hover:bg-primary/20 hover:text-white font-semibold"
                        >
                          <Link href={`/torneios/${tournament.id}`}>Relatório</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Barra de Paginação */}
            {totalPages > 1 && (
              <div className="panel-cut border dark:border-white/10 dark:bg-slate-950/80 light:border-slate-300 light:bg-white p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Página <strong className="dark:text-white light:text-slate-900">{page}</strong> de{" "}
                  <strong className="dark:text-white light:text-slate-900">{totalPages}</strong> ({data.total} torneios)
                </span>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => {
                      setPage((p) => Math.max(1, p - 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="h-8 rounded-none dark:border-white/15 dark:bg-white/5 light:border-slate-300 light:bg-slate-50 text-xs font-mono uppercase disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="size-3.5 mr-1" />
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => {
                      setPage((p) => Math.min(totalPages, p + 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="h-8 rounded-none dark:border-white/15 dark:bg-white/5 light:border-slate-300 light:bg-slate-50 text-xs font-mono uppercase disabled:opacity-30 cursor-pointer"
                  >
                    Próxima
                    <ChevronRight className="size-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </VedaShell>
  );
}
