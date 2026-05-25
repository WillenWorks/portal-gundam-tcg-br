/* Base de regras — leitura 100% via API, filtros úteis e pesquisa textual para FAQ e rulings. */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, mapApiRule, type RulingFilters } from "@/lib/api";
import type { RuleEntry } from "@/modules/core/types";

const defaultFilters: RulingFilters = {
  q: "",
  sourceType: "",
  relatedKeyword: "",
  sort: "updated_desc",
};

const sourceLabels: Record<string, string> = {
  OFFICIAL_RULES: "Official Rules",
  OFFICIAL_FAQ: "Official FAQ",
  COMMUNITY_EXPLAINER: "Community Explainer",
};

function readFiltersFromHash(): RulingFilters {
  const hash = window.location.hash || "#/rules";
  const [, query = ""] = hash.split("?");
  const params = new URLSearchParams(query);
  return {
    q: params.get("q") ?? "",
    sourceType: params.get("sourceType") ?? "",
    relatedKeyword: params.get("relatedKeyword") ?? "",
    sort: params.get("sort") ?? "updated_desc",
  };
}

function buildHash(filters: RulingFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `/rules?${query}` : "/rules";
}

export default function RulesPage() {
  const [, navigate] = useLocation();
  const [filters, setFilters] = useState<RulingFilters>(() => readFiltersFromHash());
  const [rules, setRules] = useState<RuleEntry[]>([]);
  const [meta, setMeta] = useState<{ sourceTypes: string[]; relatedKeywords: string[] }>({ sourceTypes: [], relatedKeywords: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRulingFilters().then(setMeta).catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    api.listRulings(filters)
      .then((result) => setRules(result.map(mapApiRule)))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    navigate(buildHash(filters), { replace: true });
  }, [filters, navigate]);

  const activeFilters = useMemo(
    () => Object.entries(filters).filter(([, value]) => value).length - (filters.sort ? 1 : 0),
    [filters],
  );

  const setFilter = (key: keyof RulingFilters, value: string) => setFilters((state) => ({ ...state, [key]: value }));
  const resetFilters = () => setFilters(defaultFilters);

  const copySearchLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#${buildHash(filters)}`);
    toast.success("Link da busca copiado.");
  };

  return (
    <PortalShell>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Knowledge base via API</p>
                <h2 className="mt-2 font-heading text-4xl uppercase">Regras, FAQ e explicações em pt-BR</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">A página consulta rulings diretamente do backend e mantém filtros na URL para compartilhar pesquisas temáticas.</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{rules.length} itens</Badge>
                <button type="button" onClick={copySearchLink} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white transition hover:bg-white/10"><Copy className="mr-2 size-4" />Copiar busca</button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-4">
              <Input value={filters.q ?? ""} onChange={(event) => setFilter("q", event.target.value)} placeholder="Buscar por título, pergunta, resposta ou contexto" className="rounded-none border-white/15 bg-slate-950/70 text-white placeholder:text-slate-500 xl:col-span-2" />
              <select value={filters.sourceType ?? ""} onChange={(event) => setFilter("sourceType", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white"><option value="">Todas as fontes</option>{meta.sourceTypes.map((item) => <option key={item} value={item}>{sourceLabels[item] || item}</option>)}</select>
              <select value={filters.relatedKeyword ?? ""} onChange={(event) => setFilter("relatedKeyword", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white"><option value="">Todas as keywords</option>{meta.relatedKeywords.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={filters.sort ?? "updated_desc"} onChange={(event) => setFilter("sort", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white xl:col-span-1"><option value="updated_desc">Mais recentes</option><option value="title_asc">Título A-Z</option></select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="rounded-none border-white/20 text-slate-300">{activeFilters > 0 ? `${activeFilters} filtros ativos` : "sem filtros extras"}</Badge>
              <button type="button" onClick={resetFilters} className="rounded-none border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Limpar filtros</button>
            </div>
          </CardContent>
        </Card>

        {loading ? <p className="text-sm text-slate-400">Carregando base da API...</p> : null}

        <div className="space-y-4">
          {rules.map((item) => (
            <Card key={item.id} className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{item.category}</Badge>
                  <Badge variant="outline" className="rounded-none border-white/20 text-slate-300">{item.source}</Badge>
                  {item.relatedKeyword ? <Badge variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{item.relatedKeyword}</Badge> : null}
                </div>
                <h3 className="mt-4 font-heading text-3xl uppercase leading-none">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-300">{item.summaryPt}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">Fonte-base: {item.originalRef}</p>
                <div className="mt-4">
                  <Link href={`/rules/${item.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Abrir detalhe</Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
