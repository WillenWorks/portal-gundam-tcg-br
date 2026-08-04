/* Catálogo público de cartas — filtros compostos via /api/cards, estado sincronizado com a URL. */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { PublicShell } from "@/components/layout/PublicShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api, type CardFilters } from "@/lib/api";

const defaultFilters: CardFilters = {
  q: "",
  color: "",
  cardType: "",
  series: "",
  trait: "",
  keyword: "",
  setCode: "",
  sort: "code_asc",
};

function readFiltersFromHash(): CardFilters {
  const hash = window.location.hash || "#/database";
  const [, query = ""] = hash.split("?");
  const params = new URLSearchParams(query);
  return {
    q: params.get("q") ?? "",
    color: params.get("color") ?? "",
    cardType: params.get("cardType") ?? "",
    series: params.get("series") ?? "",
    trait: params.get("trait") ?? "",
    keyword: params.get("keyword") ?? "",
    setCode: params.get("setCode") ?? "",
    sort: params.get("sort") ?? "code_asc",
  };
}

function buildHash(filters: CardFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `/database?${query}` : "/database";
}

export default function CardsPage() {
  const [, navigate] = useLocation();
  const [filters, setFilters] = useState<CardFilters>(() => readFiltersFromHash());
  const [cards, setCards] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ colors: string[]; cardTypes: string[]; series: string[]; traits: string[]; keywords: string[]; sets: Array<{ code: string; namePt?: string | null; nameEn: string }> }>({ colors: [], cardTypes: [], series: [], traits: [], keywords: [], sets: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCardFilters().then(setMeta).catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    api.listCards(filters)
      .then((result) => setCards(result))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    navigate(buildHash(filters), { replace: true });
  }, [filters, navigate]);

  const activeFilters = useMemo(
    () => Object.entries(filters).filter(([, value]) => value).length - (filters.sort ? 1 : 0),
    [filters],
  );

  const setFilter = (key: keyof CardFilters, value: string) => setFilters((state) => ({ ...state, [key]: value }));
  const resetFilters = () => setFilters(defaultFilters);
  const readPrimaryEffect = (card: any) => {
    const sections = Array.isArray(card.textSectionsJson) ? card.textSectionsJson : [];
    const section = sections.find((item: any) => item?.textPt || item?.textEn);
    return section?.textPt || section?.textEn || card.effectPt || card.effectEn || "Sem texto cadastrado.";
  };
  const readFlags = (card: any) => [card.hasBurst && "Burst", card.hasMain && "Main", card.hasAction && "Action", card.oncePerTurn && "Once per turn"].filter(Boolean) as string[];

  const copySearchLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#${buildHash(filters)}`);
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
                <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{cards.length} resultados</Badge>
                <button type="button" onClick={copySearchLink} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] nav-hover-soft dark:text-white light:border-slate-400/90 light:bg-white light:text-slate-950"><Copy className="mr-2 size-4" />Copiar busca</button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
              <Input value={filters.q ?? ""} onChange={(event) => setFilter("q", event.target.value)} placeholder="Nome, código, trait, efeito ou série" className="field-shell sm:col-span-2 lg:col-span-6 light:border-slate-300/80 light:bg-white light:text-slate-900" />
              <select value={filters.color ?? ""} onChange={(event) => setFilter("color", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white lg:col-span-3 light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="">Todas as cores</option>{meta.colors.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={filters.cardType ?? ""} onChange={(event) => setFilter("cardType", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white lg:col-span-3 light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="">Todos os tipos</option>{meta.cardTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={filters.series ?? ""} onChange={(event) => setFilter("series", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white lg:col-span-3 light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="">Todas as séries</option>{meta.series.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={filters.trait ?? ""} onChange={(event) => setFilter("trait", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white lg:col-span-3 light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="">Todas as traits</option>{meta.traits.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={filters.keyword ?? ""} onChange={(event) => setFilter("keyword", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white lg:col-span-3 light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="">Todas as keywords</option>{meta.keywords.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={filters.setCode ?? ""} onChange={(event) => setFilter("setCode", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white lg:col-span-3 light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="">Todos os sets</option>{meta.sets.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.namePt || item.nameEn}</option>)}</select>
              <select value={filters.sort ?? "code_asc"} onChange={(event) => setFilter("sort", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white lg:col-span-3 light:border-slate-300/80 light:bg-white light:text-slate-900"><option value="code_asc">Ordenar por código</option><option value="name_asc">Ordenar por nome</option><option value="cost_asc">Menor custo</option><option value="cost_desc">Maior custo</option><option value="updated_desc">Mais recentes</option></select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="rounded-none border-white/20 text-slate-300 dark:text-slate-300 light:border-slate-300/80 light:text-slate-700">{activeFilters > 0 ? `${activeFilters} filtros ativos` : "sem filtros extras"}</Badge>
              <button type="button" onClick={resetFilters} className="rounded-none border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] nav-hover-soft dark:text-white light:border-slate-400/90 light:bg-white light:text-slate-950">Limpar filtros</button>
              <Link href="/sets" className="rounded-none border border-primary/30 bg-primary/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-primary transition hover:bg-primary/15">Ver coleções</Link>
            </div>
          </CardContent>
        </Card>

        {loading ? <p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">Carregando catálogo...</p> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {cards.map((card) => (
            <Card key={card.id} className="panel-cut rounded-none surface-panel">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.code}</p>
                    <h3 className="mt-2 font-heading text-3xl uppercase leading-none dark:text-white light:text-slate-900">{card.namePt || card.nameEn}</h3>
                  </div>
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{card.color || "—"}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm text-slate-300 dark:text-slate-300 light:text-slate-700">
                  <div className="panel-cut border surface-strong p-3 light:border-slate-300/80 light:bg-slate-50">Tipo: {card.cardType || "—"}</div>
                  <div className="panel-cut border surface-strong p-3 light:border-slate-300/80 light:bg-slate-50">Custo: {card.cost}</div>
                  <div className="panel-cut border surface-strong p-3 light:border-slate-300/80 light:bg-slate-50">AP: {card.ap ?? "—"}</div>
                  <div className="panel-cut border surface-strong p-3 light:border-slate-300/80 light:bg-slate-50">HP: {card.hp ?? "—"}</div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Trait / Série</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{(card.traits || []).join(", ") || card.trait || "—"} · {card.series || card.sourceTitle || "—"}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[...(card.triggerKeywords || []), ...(card.effectKeywords || []), ...readFlags(card)].length ? [...(card.triggerKeywords || []), ...(card.effectKeywords || []), ...readFlags(card)].map((keyword: string) => (
                    <Badge key={keyword} variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{keyword}</Badge>
                  )) : <Badge variant="outline" className="rounded-none border-white/20 text-slate-400 dark:text-slate-400 light:border-slate-300/80 light:text-slate-500">sem keyword</Badge>}
                </div>

                <p className="text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{readPrimaryEffect(card)}</p>
                <div>
                  <div className="flex flex-wrap gap-2 pb-1">{card.set?.code ? <Badge variant="outline" className="rounded-none border-white/20 text-slate-300 dark:text-slate-300 light:border-slate-300/80 light:text-slate-700">{card.set.code}</Badge> : null}{(card.cardSubtypes || []).slice(0,2).map((item: string) => <Badge key={item} variant="outline" className="rounded-none border-white/20 text-slate-300 dark:text-slate-300 light:border-slate-300/80 light:text-slate-700">{item}</Badge>)}</div><Link href={`/cards/${card.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] nav-hover-soft dark:text-white light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir detalhe</Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
