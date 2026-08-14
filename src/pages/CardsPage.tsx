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
import { api, type CardFilters } from "@/lib/api";
import { CARD_TYPE_OPTIONS } from "@/lib/gundam-catalog";
import { formatCardText } from "@/lib/utils";
import { MultiSelectFilter } from "@/components/catalog/MultiSelectFilter";

const cardTypeLabel = (value?: string | null) => CARD_TYPE_OPTIONS.find((item) => item.value === value)?.label || value || "—";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 9999] as const;
const DEFAULT_PAGE_SIZE = 10;

const defaultFilters: CardFilters = {
  q: "",
  color: "",
  cardType: "",
  series: "",
  trait: "",
  keyword: "",
  setCode: "",
  sort: "created_desc",
};

function readFiltersFromHash(): { filters: CardFilters; page: number; pageSize: number } {
  const hash = window.location.hash || "#/database";
  const [, query = ""] = hash.split("?");
  const params = new URLSearchParams(query);
  return {
    filters: {
      q: params.get("q") ?? "",
      color: params.get("color") ?? "",
      cardType: params.get("cardType") ?? "",
      series: params.get("series") ?? "",
      trait: params.get("trait") ?? "",
      keyword: params.get("keyword") ?? "",
      setCode: params.get("setCode") ?? "",
      sort: params.get("sort") ?? "created_desc",
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

export default function CardsPage() {
  const [location, navigate] = useLocation();
  const basePath = useMemo(() => location.split("?")[0], [location]);
  const initial = useMemo(() => readFiltersFromHash(), []);
  const [filters, setFilters] = useState<CardFilters>(initial.filters);
  const [page, setPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState(initial.pageSize);
  const [cards, setCards] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [meta, setMeta] = useState<{ colors: string[]; cardTypes: string[]; series: string[]; traits: string[]; keywords: string[]; sets: Array<{ code: string; namePt?: string | null; nameEn: string }> }>({ colors: [], cardTypes: [], series: [], traits: [], keywords: [], sets: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCardFilters().then(setMeta).catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    api.listCardsPage(filters, { page, pageSize })
      .then((result) => {
        setCards(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      })
      .finally(() => setLoading(false));
  }, [filters, page, pageSize]);

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
  const readPrimaryEffect = (card: any) => {
    const sections = Array.isArray(card.textSectionsJson) ? card.textSectionsJson : [];
    const section = sections.find((item: any) => item?.textPt || item?.textEn);
    return section?.textPt || section?.textEn || card.effectPt || card.effectEn || "Sem texto cadastrado.";
  };
  const formatEffect = (card: any) => formatCardText(readPrimaryEffect(card));
  const readFlags = (card: any) => [card.hasBurst && "Burst", card.hasMain && "Main", card.hasAction && "Action", card.oncePerTurn && "Once per turn"].filter(Boolean) as string[];

  const copySearchLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#${buildHash(basePath, filters, page, pageSize)}`);
    toast.success("Link da busca copiado.");
  };

  return (
    <PublicShell breadcrumbs={[{ label: "Catálogo" }]} title="Catálogo de Cartas" description="Catálogo completo de cartas com filtros combinados e link de busca pra compartilhar. Estatísticas avançadas por carta chegam nas próximas atualizações.">
      <div className="space-y-6">
        <Card className="panel-cut rounded-none surface-panel">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Busca avançada</p>
                <h2 className="mt-2 font-heading text-4xl uppercase dark:text-white light:text-slate-900">Catálogo filtrado de cartas</h2>
                <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">Filtre por cor, tipo, série, trait, keyword ou coleção. Os filtros ficam salvos no link, então dá pra compartilhar uma busca pronta com qualquer pessoa.</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{total} resultados</Badge>
                <button type="button" onClick={copySearchLink} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] nav-hover-soft dark:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"><Copy className="mr-2 size-4" />Copiar busca</button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
              <Input value={filters.q ?? ""} onChange={(event) => setFilter("q", event.target.value)} placeholder="Nome, código, trait, efeito ou série" className="field-shell sm:col-span-2 lg:col-span-6 light:border-slate-300/80 light:bg-white light:text-slate-900" />
              <div className="lg:col-span-3"><MultiSelectFilter label="Cores" options={meta.colors} value={filters.color ?? ""} onChange={(v) => setFilter("color", v)} /></div>
              <select value={filters.cardType ?? ""} onChange={(event) => setFilter("cardType", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white lg:col-span-3 light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="">Todos os tipos</option>{meta.cardTypes.map((item) => <option key={item} value={item}>{cardTypeLabel(item)}</option>)}</select>
              <select value={filters.series ?? ""} onChange={(event) => setFilter("series", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white lg:col-span-3 light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="">Todas as séries</option>{meta.series.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <div className="lg:col-span-3"><MultiSelectFilter label="Traits" options={meta.traits} value={filters.trait ?? ""} onChange={(v) => setFilter("trait", v)} /></div>
              <select value={filters.keyword ?? ""} onChange={(event) => setFilter("keyword", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white lg:col-span-3 light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="">Todas as keywords</option>{meta.keywords.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={filters.setCode ?? ""} onChange={(event) => setFilter("setCode", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white lg:col-span-3 light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="">Todos os sets</option>{meta.sets.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.namePt || item.nameEn}</option>)}</select>
              <select value={filters.sort ?? "created_desc"} onChange={(event) => setFilter("sort", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white lg:col-span-3 light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="created_desc">Últimas cadastradas</option><option value="code_asc">Ordenar por código</option><option value="name_asc">Ordenar por nome</option><option value="cost_asc">Menor custo</option><option value="cost_desc">Maior custo</option></select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="rounded-none border-white/20 text-slate-300 dark:text-slate-300 light:border-slate-300/80 light:text-slate-700">{activeFilters > 0 ? `${activeFilters} filtros ativos` : "sem filtros extras"}</Badge>
              <button type="button" onClick={resetFilters} className="rounded-none border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] nav-hover-soft dark:text-white light:border-slate-400/90 light:bg-white light:text-slate-950">Limpar filtros</button>
              <Link href="/sets" className="rounded-none border border-primary/30 bg-primary/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-primary transition hover:bg-primary/15">Ver coleções</Link>
              <div className="ml-auto flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                <span>Por página</span>
                <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-9 rounded-none border border-white/15 bg-slate-950/70 px-2 text-sm text-white light:border-slate-300/80 light:bg-white light:text-slate-900">
                  {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size === 9999 ? "Todas" : size}</option>)}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? <p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">Carregando catálogo...</p> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {cards.map((card) => {
            const keywords = [...(card.triggerKeywords || []), ...(card.effectKeywords || []), ...readFlags(card)];
            const hasAp = card.ap !== null && card.ap !== undefined;
            const hasHp = card.hp !== null && card.hp !== undefined;
            const traitText = (card.traits || []).join(", ") || card.trait || "";
            const seriesText = card.series || card.sourceTitle || "";
            return (
              <Card key={card.id} className="panel-cut rounded-none surface-panel">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start gap-4">
                    <Link href={`/cards/${card.id}`} className="block aspect-[63/88] w-16 shrink-0 overflow-hidden border border-white/15">
                      {card.imageMediumUrl || card.imageUrl ? <img src={card.imageMediumUrl || card.imageUrl} alt={card.namePt || card.nameEn} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-slate-950/60 text-[8px] uppercase text-slate-600">sem arte</div>}
                    </Link>
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.code}</p>
                        <h3 className="mt-2 line-clamp-2 min-h-[4.5rem] font-heading text-3xl uppercase leading-none dark:text-white light:text-slate-900">{card.namePt || card.nameEn}</h3>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{card.color || "—"}</Badge>
                        {card.printCount > 1 ? <Badge variant="outline" className="rounded-none border-accent/40 text-accent">{card.printCount} artes</Badge> : null}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-300 dark:text-slate-300 light:text-slate-700">
                    <div className="panel-cut border surface-strong p-3 light:border-slate-300/80 light:bg-slate-50">Tipo: {cardTypeLabel(card.cardType)}</div>
                    <div className="panel-cut border surface-strong p-3 light:border-slate-300/80 light:bg-slate-50">Custo: {card.cost ?? "—"}</div>
                    {hasAp ? <div className="panel-cut border surface-strong p-3 light:border-slate-300/80 light:bg-slate-50">AP: {card.ap}</div> : null}
                    {hasHp ? <div className="panel-cut border surface-strong p-3 light:border-slate-300/80 light:bg-slate-50">HP: {card.hp}</div> : null}
                  </div>

                  {traitText || seriesText ? (
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Trait / Série</p>
                      <p className="mt-2 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{[traitText, seriesText].filter(Boolean).join(" · ")}</p>
                    </div>
                  ) : null}

                  {keywords.length ? (
                    <div className="flex flex-wrap gap-2">
                      {keywords.map((keyword: string) => (
                        <Badge key={keyword} variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{keyword}</Badge>
                      ))}
                    </div>
                  ) : null}

                  <p className="whitespace-pre-line text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{formatEffect(card)}</p>
                  <div>
                    <div className="flex flex-wrap gap-2 pb-1">{card.set?.code ? <Badge variant="outline" className="rounded-none border-white/20 text-slate-300 dark:text-slate-300 light:border-slate-300/80 light:text-slate-700">{card.set.code}</Badge> : null}{(card.cardSubtypes || []).slice(0,2).map((item: string) => <Badge key={item} variant="outline" className="rounded-none border-white/20 text-slate-300 dark:text-slate-300 light:border-slate-300/80 light:text-slate-700">{item}</Badge>)}</div><Link href={`/cards/${card.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] nav-hover-soft dark:text-white light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir detalhe</Link>
                  </div>
                </CardContent>
              </Card>
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
