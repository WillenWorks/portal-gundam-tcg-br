import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
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
import type { Paginated, VedaFilters, VedaTournamentCard } from "@/lib/veda/types";
import { TOURNAMENT_TIER_OPTIONS } from "@/lib/gundam-catalog";

const PAGE_SIZE = 24;

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

export default function VedaTournamentsPage() {
  const [location, navigate] = useLocation();

  // Parse dos filtros da URL (compartilhável)
  const currentParams = useMemo(() => {
    const searchPart = window.location.hash.includes("?")
      ? window.location.hash.substring(window.location.hash.indexOf("?"))
      : window.location.search;
    return new URLSearchParams(searchPart);
  }, [location]);

  const seasonParam = currentParams.get("season") || "";
  const tierParam = currentParams.get("tier") || "";
  const sourceParam = currentParams.get("source") || "";
  const ufParam = currentParams.get("uf") || "";
  const cityParam = currentParams.get("city") || "";
  const qParam = currentParams.get("q") || "";
  const pageParam = parseInt(currentParams.get("page") || "1", 10) || 1;

  // Estados locais
  const [filtersMeta, setFiltersMeta] = useState<VedaFilters | null>(null);
  const [data, setData] = useState<Paginated<VedaTournamentCard> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(qParam);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Sincroniza busca com rascunho quando a URL muda
  useEffect(() => {
    setSearchDraft(qParam);
  }, [qParam]);

  // Atualiza parâmetros da URL preservando o histórico
  const updateQueryParam = useCallback(
    (newParams: Record<string, string | number | null>) => {
      const sp = new URLSearchParams(
        window.location.hash.includes("?")
          ? window.location.hash.substring(window.location.hash.indexOf("?"))
          : window.location.search,
      );

      for (const [key, val] of Object.entries(newParams)) {
        if (val === null || val === "" || val === undefined) {
          sp.delete(key);
        } else {
          sp.set(key, String(val));
        }
      }

      // Ao mudar qualquer filtro além da própria página, volta para a página 1
      if (!("page" in newParams)) {
        sp.delete("page");
      }

      const qs = sp.toString();
      const targetPath = `/torneios${qs ? `?${qs}` : ""}`;
      navigate(targetPath);
    },
    [navigate],
  );

  const resetAllFilters = useCallback(() => {
    setSearchDraft("");
    navigate("/torneios");
  }, [navigate]);

  // Carrega opções de filtro uma vez
  useEffect(() => {
    let active = true;
    vedaApi
      .getFilters()
      .then((meta) => {
        if (active) setFiltersMeta(meta);
      })
      .catch(() => {
        // Fallback silencioso
      });
    return () => {
      active = false;
    };
  }, []);

  // Carrega torneios quando filtros mudam
  const loadTournaments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = (pageParam - 1) * PAGE_SIZE;
      const queryParams: VedaTournamentQueryParams = {
        season: seasonParam || undefined,
        tier: (tierParam as any) || undefined,
        source: sourceParam || undefined,
        uf: ufParam || undefined,
        city: cityParam || undefined,
        q: qParam || undefined,
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
  }, [pageParam, seasonParam, tierParam, sourceParam, ufParam, cityParam, qParam]);

  useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const hasActiveFilters = Boolean(seasonParam || tierParam || sourceParam || ufParam || cityParam || qParam);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQueryParam({ q: searchDraft.trim() || null });
  };

  return (
    <VedaShell
      title="Torneios & Relatórios Oficiais"
      description="Base unificada de torneios competitivos do Gundam TCG no Brasil e no mundo. Classificações consolidadas, decklists congeladas e divisão do metagame."
      breadcrumbs={[{ label: "Torneios" }]}
    >
      <div className="space-y-6">
        {/* Barra de Filtros e Busca Tática */}
        <div className="panel-cut border border-white/10 bg-slate-950/80 p-4 sm:p-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Campo de Busca por Nome */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Buscar torneio pelo nome ou loja..."
                className="pl-9 h-10 rounded-none border-white/15 bg-white/5 text-xs text-white placeholder:text-slate-500 font-mono focus-visible:border-primary"
              />
              {searchDraft && searchDraft !== qParam && (
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-mono uppercase bg-primary text-primary-foreground"
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
                className="w-full rounded-none border-white/20 text-xs font-mono uppercase"
              >
                <Filter className="mr-1.5 size-3.5" />
                {mobileFiltersOpen ? "Ocultar Filtros" : "Exibir Filtros"}
              </Button>
              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetAllFilters}
                  className="rounded-none text-xs text-slate-400 hover:text-white"
                  title="Limpar todos os filtros"
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              )}
            </div>

            {/* Totalizador de Registros */}
            <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-slate-400">
              {data && (
                <span>
                  Mostrando <strong className="text-white">{data.total}</strong> evento(s)
                </span>
              )}
              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetAllFilters}
                  className="h-8 rounded-none border-white/15 bg-white/5 text-[11px] font-mono uppercase text-slate-300 hover:text-white hover:bg-white/10"
                >
                  <RotateCcw className="mr-1 size-3" />
                  Limpar Filtros
                </Button>
              )}
            </div>
          </div>

          {/* Linha de Seletores (Desktop ou Mobile Aberto) */}
          <div
            className={`grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 pt-3 border-t border-white/10 ${
              mobileFiltersOpen ? "block" : "hidden sm:grid"
            }`}
          >
            {/* Temporada */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                Temporada
              </label>
              <select
                value={seasonParam}
                onChange={(e) => updateQueryParam({ season: e.target.value || null })}
                className="w-full h-8 px-2 rounded-none border border-white/15 bg-slate-900 text-xs text-white font-mono focus:border-primary outline-none"
              >
                <option value="">Todas as Temporadas</option>
                {filtersMeta?.seasons.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} {s.isCurrent ? "(Atual)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Categoria / Tier */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                Categoria
              </label>
              <select
                value={tierParam}
                onChange={(e) => updateQueryParam({ tier: e.target.value || null })}
                className="w-full h-8 px-2 rounded-none border border-white/15 bg-slate-900 text-xs text-white font-mono focus:border-primary outline-none"
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
              <label className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                Estado (UF)
              </label>
              <select
                value={ufParam}
                onChange={(e) => updateQueryParam({ uf: e.target.value || null, city: null })}
                className="w-full h-8 px-2 rounded-none border border-white/15 bg-slate-900 text-xs text-white font-mono focus:border-primary outline-none"
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
              <label className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                Cidade
              </label>
              <select
                value={cityParam}
                onChange={(e) => updateQueryParam({ city: e.target.value || null })}
                className="w-full h-8 px-2 rounded-none border border-white/15 bg-slate-900 text-xs text-white font-mono focus:border-primary outline-none"
              >
                <option value="">Todas as Cidades</option>
                {(
                  (ufParam
                    ? filtersMeta?.ufs.find((u) => u.uf === ufParam)?.cities
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
              <label className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                Origem / Fonte
              </label>
              <select
                value={sourceParam}
                onChange={(e) => updateQueryParam({ source: e.target.value || null })}
                className="w-full h-8 px-2 rounded-none border border-white/15 bg-slate-900 text-xs text-white font-mono focus:border-primary outline-none"
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
                const hasRegionalLink = Boolean(tournament.place.uf);
                const regionalUrl = hasRegionalLink
                  ? `/metagame/regional?uf=${encodeURIComponent(tournament.place.uf || "")}${
                      tournament.place.city ? `&cidade=${encodeURIComponent(tournament.place.city)}` : ""
                    }`
                  : null;

                return (
                  <div
                    key={tournament.id}
                    className="panel-cut border border-white/10 bg-slate-950/70 p-4 sm:p-5 flex flex-col justify-between transition-all hover:border-primary/50 hover:bg-slate-950/90 group"
                  >
                    <div className="space-y-3">
                      {/* Linha de topo: Tier + Temporada + Data */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary text-[10px] font-mono uppercase">
                            {tierLabel(tournament.tier)}
                          </Badge>
                          {tournament.season && (
                            <span className="text-[10px] font-mono text-slate-400 uppercase bg-white/5 px-1.5 py-0.5 border border-white/10">
                              {tournament.season}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          {formatDatePtBr(tournament.date)}
                        </span>
                      </div>

                      {/* Nome do Torneio (Link) */}
                      <div>
                        <Link
                          href={`/torneios/${tournament.id}`}
                          className="font-heading text-lg sm:text-xl uppercase text-white group-hover:text-primary transition-colors block line-clamp-2"
                          title={tournament.name}
                        >
                          {tournament.name}
                        </Link>

                        {/* Localidade com Link Regional se houver cidade/UF */}
                        {(tournament.place.store || tournament.place.city || tournament.place.uf) && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
                            <MapPin className="size-3 text-slate-400 shrink-0" />
                            <span className="truncate">
                              {tournament.place.store ? `${tournament.place.store} · ` : ""}
                              {regionalUrl ? (
                                <Link
                                  href={regionalUrl}
                                  className="text-slate-300 hover:text-primary underline decoration-dotted transition-colors"
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
                      <div className="panel-cut border border-white/10 bg-slate-900/60 p-3 space-y-1.5">
                        <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-amber-400">
                          <Trophy className="size-3 shrink-0" />
                          <span>Campeão do Torneio</span>
                        </div>

                        {tournament.winner ? (
                          <div className="flex flex-col gap-1">
                            <div className="text-sm font-semibold">
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
                                  className="text-[10px] font-mono uppercase text-primary hover:text-white underline decoration-dotted shrink-0"
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
                      <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Users className="size-3 text-slate-400 shrink-0" />
                          <span>
                            {tournament.participantCount || tournament.entriesCount} jogadores
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="size-3 text-slate-400 shrink-0" />
                          <span className="text-slate-300">
                            {tournament.decklistsCount} {tournament.decklistsCount === 1 ? "decklist" : "decklists"}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Rodapé do Card: Crédito da Fonte + Ação de Detalhe */}
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                      <VedaSourceCredit source={tournament.source} sourceUrl={tournament.sourceUrl} />

                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="h-7 rounded-none border-primary/30 bg-primary/10 text-[11px] font-mono uppercase text-primary hover:bg-primary/20 hover:text-white"
                      >
                        <Link href={`/torneios/${tournament.id}`}>Ver Relatório</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Barra de Paginação */}
            {totalPages > 1 && (
              <div className="panel-cut border border-white/10 bg-slate-950/80 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-mono text-slate-400">
                  Página <strong className="text-white">{pageParam}</strong> de{" "}
                  <strong className="text-white">{totalPages}</strong> ({data.total} torneios)
                </span>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pageParam <= 1}
                    onClick={() => updateQueryParam({ page: pageParam - 1 })}
                    className="h-8 rounded-none border-white/15 bg-white/5 text-xs font-mono uppercase disabled:opacity-30"
                  >
                    <ChevronLeft className="size-3.5 mr-1" />
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pageParam >= totalPages}
                    onClick={() => updateQueryParam({ page: pageParam + 1 })}
                    className="h-8 rounded-none border-white/15 bg-white/5 text-xs font-mono uppercase disabled:opacity-30"
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
