/* Catálogo público de cartas — filtros compostos via /api/cards, estado sincronizado com a URL, paginado. */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { PublicShell } from "@/components/layout/PublicShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ParallaxHeroBanner } from "@/components/catalog/ParallaxHeroBanner";
import { api, type CardFilters } from "@/lib/api";
import { CARD_TYPE_OPTIONS, GAME_COLOR_HEX } from "@/lib/gundam-catalog";
import { MultiSelectFilter } from "@/components/catalog/MultiSelectFilter";
import { normalizeRarityLabel, groupRaritiesByLabel, expandRarityFilter } from "@/lib/rarityLabels";

const cardTypeLabel = (value?: string | null) => CARD_TYPE_OPTIONS.find((item) => item.value === value)?.label || value || "—";

// Cores distintas por categoria de raridade -- leitura instantânea de valor da carta
// sem precisar ler o texto do badge (Scryfall/Limitless style).
const RARITY_BADGE_STYLE: Record<string, string> = {
  Common: "border-slate-400/40 bg-slate-400/10 text-slate-300",
  Uncommon: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  Rare: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  "Super Rare": "border-violet-400/40 bg-violet-400/10 text-violet-300",
  "Legend Rare": "border-amber-400/40 bg-amber-400/10 text-amber-300",
  Secret: "border-rose-400/40 bg-rose-400/10 text-rose-300",
  Promo: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
};
const DEFAULT_RARITY_STYLE = "border-white/20 bg-white/5 text-slate-300";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 9999] as const;
const DEFAULT_PAGE_SIZE = 20;

const defaultFilters: CardFilters = {
  q: "",
  color: "",
  cardType: "",
  series: "",
  trait: "",
  keyword: "",
  setCode: "",
  rarity: "",
  sort: "code_asc",
};

// Lê os filtros da URL REAL (?color=Blue), não do hash -- o wouter guarda a query da
// navegação em window.location.search mesmo em roteamento por hash (ver
// src/lib/hashLocationWithQuery.ts), então é ali que qualquer link com filtro embutido
// (clique numa cor/série/trait/coleção/raridade em outra página) deixa o valor.
function readFiltersFromLocation(): { filters: CardFilters; page: number; pageSize: number } {
  const params = new URLSearchParams(window.location.search);
  return {
    filters: {
      q: params.get("q") ?? "",
      color: params.get("color") ?? "",
      cardType: params.get("cardType") ?? "",
      series: params.get("series") ?? "",
      trait: params.get("trait") ?? "",
      keyword: params.get("keyword") ?? "",
      setCode: params.get("setCode") ?? "",
      rarity: normalizeRarityLabel(params.get("rarity") ?? "") || (params.get("rarity") ?? ""),
      sort: params.get("sort") ?? "code_asc",
    },
    page: Number(params.get("page")) || 1,
    pageSize: Number(params.get("pageSize")) || DEFAULT_PAGE_SIZE,
  };
}

function buildHash(basePath: string, filters: CardFilters, page: number, pageSize: number) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (page > 1) params.set("page", String(page));
  if (pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(pageSize));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

// O link de busca copiado precisa refletir a mesma URL real que o app produz ao
// navegar (query em window.location.search, hash só com o caminho) -- senão colar o
// link copiado numa aba nova nem bate com a rota certa.
function buildShareUrl(basePath: string, filters: CardFilters, page: number, pageSize: number) {
  const target = buildHash(basePath, filters, page, pageSize);
  const [path, query = ""] = target.split("?");
  const search = query ? `?${query}` : "";
  return `${window.location.origin}${window.location.pathname}${search}#${path}`;
}

export default function CardsPage() {
  const [location, navigate] = useLocation();
  const basePath = useMemo(() => location.split("?")[0], [location]);
  const initial = useMemo(() => readFiltersFromLocation(), []);
  const [filters, setFilters] = useState<CardFilters>(initial.filters);
  const [page, setPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState(initial.pageSize);
  const [cards, setCards] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [meta, setMeta] = useState<{ colors: string[]; cardTypes: string[]; series: string[]; traits: string[]; keywords: string[]; rarities: string[]; sets: Array<{ code: string; namePt?: string | null; nameEn: string }> }>({ colors: [], cardTypes: [], series: [], traits: [], keywords: [], rarities: [], sets: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCardFilters().then(setMeta).catch(() => undefined);
  }, []);

  // Raridade é filtrada/exibida pelo rótulo canônico (Common, Legend Rare...), mas a API
  // guarda o valor cru por impressão (C+, LR++...) -- agrupa uma vez a partir do que
  // /cards/filters devolveu e expande de volta na hora de consultar.
  const rarityGroups = useMemo(() => groupRaritiesByLabel(meta.rarities), [meta.rarities]);

  useEffect(() => {
    setLoading(true);
    const apiFilters: CardFilters = { ...filters, rarity: expandRarityFilter(filters.rarity ?? "", rarityGroups) };
    api.listCardsPage(apiFilters, { page, pageSize })
      .then((result) => {
        setCards(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      })
      .finally(() => setLoading(false));
  }, [filters, page, pageSize, rarityGroups]);

  useEffect(() => {
    navigate(buildHash(basePath, filters, page, pageSize), { replace: true });
  }, [basePath, filters, page, pageSize, navigate]);

  const activeFilters = useMemo(
    () => Object.entries(filters).filter(([, value]) => value).length - (filters.sort ? 1 : 0),
    [filters],
  );

  const setFilter = (key: keyof CardFilters, value: string) => {
    setFilters((state) => ({ ...state, [key]: value }));
    setPage(1);
  };
  const resetFilters = () => {
    setFilters(defaultFilters);
    setPage(1);
  };

  const copySearchLink = async () => {
    await navigator.clipboard.writeText(buildShareUrl(basePath, filters, page, pageSize));
    toast.success("Link da busca copiado.");
  };
  const rarityOptions = useMemo(() => Array.from(rarityGroups.keys()).sort(), [rarityGroups]);

  return (
    <PublicShell
      breadcrumbs={[{ label: "Database de Cards" }]}
      heroBanner={
        <ParallaxHeroBanner
          image="/images/unicorn_blueprint_banner.png"
          eyebrow="Anaheim Electronics · UC 0096 / Project UC"
          title="Database de Cards"
          badge={`${total} cartas indexadas`}
        />
      }
    >
      <div className="space-y-6">
        <Card className="panel-cut rounded-none surface-panel">
          <CardContent className="space-y-4 p-5">
            {/* Linha de Comando Principal — busca rápida & ações */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <Input
                value={filters.q ?? ""}
                onChange={(event) => setFilter("q", event.target.value)}
                placeholder="Nome, código, trait, efeito ou série"
                className="field-shell h-11 flex-1 text-sm light:border-slate-300/80 light:bg-white light:text-slate-900"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={copySearchLink} className="inline-flex h-11 items-center rounded-none border border-white/15 bg-white/5 px-4 text-xs uppercase tracking-[0.18em] nav-hover-soft dark:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"><Copy className="mr-2 size-4" />Copiar busca</button>
                <button type="button" onClick={resetFilters} className="inline-flex h-11 items-center rounded-none border border-white/15 bg-white/5 px-4 text-xs uppercase tracking-[0.18em] nav-hover-soft dark:text-white light:border-slate-400/90 light:bg-white light:text-slate-950">Limpar filtros</button>
                <Badge variant="outline" className="h-11 rounded-none border-white/20 px-3 text-slate-300 dark:text-slate-300 light:border-slate-300/80 light:text-slate-700">{activeFilters > 0 ? `${activeFilters} filtros ativos` : "sem filtros extras"}</Badge>
                <Badge className="h-11 rounded-none border border-accent/40 bg-accent/10 px-3 text-accent">{total} resultados</Badge>
              </div>
            </div>

            {/* Barra de Parâmetros Principais */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MultiSelectFilter label="Cores" options={meta.colors} value={filters.color ?? ""} onChange={(v) => setFilter("color", v)} />
              <select value={filters.cardType ?? ""} onChange={(event) => setFilter("cardType", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="">Todos os tipos</option>{meta.cardTypes.map((item) => <option key={item} value={item}>{cardTypeLabel(item)}</option>)}</select>
              <select value={filters.setCode ?? ""} onChange={(event) => setFilter("setCode", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="">Todas as coleções</option>{meta.sets.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.namePt || item.nameEn}</option>)}</select>
              <select value={filters.rarity ?? ""} onChange={(event) => setFilter("rarity", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="">Todas as raridades</option>{rarityOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            </div>

            {/* Barra de Parâmetros de Lore & Ordenação */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <select value={filters.series ?? ""} onChange={(event) => setFilter("series", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="">Todas as séries</option>{meta.series.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <MultiSelectFilter label="Traits" options={meta.traits} value={filters.trait ?? ""} onChange={(v) => setFilter("trait", v)} />
              <select value={filters.keyword ?? ""} onChange={(event) => setFilter("keyword", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="">Todas as keywords</option>{meta.keywords.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={filters.sort ?? "code_asc"} onChange={(event) => setFilter("sort", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="code_asc">Ordenar por código</option><option value="created_desc">Últimas cadastradas</option><option value="name_asc">Ordenar por nome</option><option value="cost_asc">Menor custo</option><option value="cost_desc">Maior custo</option></select>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                <span className="shrink-0">Por página</span>
                <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-10 w-full rounded-none border border-white/15 bg-slate-950/70 px-2 text-sm text-white light:border-slate-300/80 light:bg-white light:text-slate-900">
                  {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size === 9999 ? "Todas" : size}</option>)}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? <p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">Carregando catálogo...</p> : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {cards.map((card) => {
            const traitText = (card.traits || []).join(", ") || card.trait || "";
            const seriesText = card.series || card.sourceTitle || "";
            const rarityLabel = card.rarity ? normalizeRarityLabel(card.rarity) : "";
            return (
              <div key={card.id} className="group">
                <Link href={`/cards/${card.id}`} className="relative block aspect-[63/88] w-full overflow-hidden border border-white/15 bg-slate-950/60 transition-all duration-200 group-hover:scale-[1.03] group-hover:border-primary/60">
                  {card.imageMediumUrl || card.imageUrl ? (
                    <img src={card.imageMediumUrl || card.imageUrl} alt={card.namePt || card.nameEn} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-center text-[10px] uppercase tracking-[0.2em] text-slate-600">Sem arte</div>
                  )}
                  {card.color ? (
                    <span className="absolute left-1 top-1 rounded-none border border-white/20 bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.06em] text-white" style={{ borderColor: `${GAME_COLOR_HEX[card.color] ?? "#94a3b8"}80` }}>{card.color}</span>
                  ) : null}
                  <div className="absolute right-1 top-1 flex flex-col items-end gap-1">
                    {rarityLabel ? <span className={`rounded-none border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.06em] ${RARITY_BADGE_STYLE[rarityLabel] ?? DEFAULT_RARITY_STYLE}`}>{rarityLabel}</span> : null}
                    {card.printCount > 1 ? <span className="rounded-none border border-accent/40 bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.06em] text-accent">{card.printCount} artes</span> : null}
                  </div>
                </Link>
                <div className="mt-1.5 space-y-0.5 px-0.5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">{card.code}</p>
                  <p className="line-clamp-2 min-h-[2.2em] text-[13px] font-semibold leading-tight text-white dark:text-white light:text-slate-900">{card.namePt || card.nameEn}</p>
                  {traitText || seriesText ? (
                    <button
                      type="button"
                      onClick={() => setFilter(traitText ? "trait" : "series", traitText ? (card.traits?.[0] || card.trait) : seriesText)}
                      title={`Filtrar por ${traitText || seriesText}`}
                      className="block truncate text-left text-[11px] text-slate-500 transition hover:text-primary hover:underline"
                    >
                      {traitText || seriesText}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 light:border-slate-300/60">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Página {page} de {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-none border-white/20 light:border-slate-400/90" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</Button>
              <Button variant="outline" size="sm" className="rounded-none border-white/20 light:border-slate-400/90" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Próxima</Button>
            </div>
          </div>
        ) : null}
      </div>
    </PublicShell>
  );
}
