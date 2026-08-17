/* Base de regras v8 — manutenção simples de PT/EN, filtros e preservação da fonte original. */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, mapApiRule, type RulingFilters } from "@/lib/api";
import type { RuleEntry } from "@/modules/core/types";

const defaultFilters: RulingFilters = { q: "", sourceType: "", relatedKeyword: "", title: "", sort: "updated_desc" };
const sourceLabels: Record<string, string> = { OFFICIAL_RULES: "Official Rules", OFFICIAL_FAQ: "Official FAQ", COMMUNITY_EXPLAINER: "Community Explainer" };

function readFiltersFromHash(): RulingFilters {
  const hash = window.location.hash || "#/rules";
  const [, query = ""] = hash.split("?");
  const params = new URLSearchParams(query);
  return { q: params.get("q") ?? "", sourceType: params.get("sourceType") ?? "", relatedKeyword: params.get("relatedKeyword") ?? "", title: params.get("title") ?? "", sort: params.get("sort") ?? "updated_desc" };
}

function buildHash(filters: RulingFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  const query = params.toString();
  return query ? `/rules?${query}` : "/rules";
}

export default function RulesPage() {
  const [, navigate] = useLocation();
  const [filters, setFilters] = useState<RulingFilters>(() => readFiltersFromHash());
  const [rules, setRules] = useState<RuleEntry[]>([]);
  const [meta, setMeta] = useState<{ sourceTypes: string[]; relatedKeywords: string[]; titles: string[] }>({ sourceTypes: [], relatedKeywords: [], titles: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.getRulingFilters().then(setMeta).catch(() => undefined); }, []);
  useEffect(() => {
    setLoading(true);
    api.listRulings(filters).then((result) => setRules(result.map(mapApiRule))).finally(() => setLoading(false));
  }, [filters]);
  useEffect(() => { navigate(buildHash(filters), { replace: true }); }, [filters, navigate]);

  const activeFilters = useMemo(() => Object.entries(filters).filter(([, value]) => value).length - (filters.sort ? 1 : 0), [filters]);
  const setFilter = (key: keyof RulingFilters, value: string) => setFilters((state) => ({ ...state, [key]: value }));

  const copySearchLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#${buildHash(filters)}`);
    toast.success("Link da busca copiado.");
  };

  return (
    <PublicShell title="Regras" description="Base pensada para inclusão simples em PT-BR e EN, mantendo o vínculo com a fonte oficial e futura área de exemplos visuais.">
      <div className="space-y-6">
        <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Knowledge base via API</p>
                <h2 className="mt-2 font-heading text-4xl uppercase">Rulings com origem preservada</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">Cada item mantém trilha de fonte, suporte bilíngue e espaço preparado para exemplos com imagem no futuro.</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{rules.length} itens</Badge>
                <button type="button" onClick={copySearchLink} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900"><Copy className="mr-2 size-4" />Copiar busca</button>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-5">
              <Input value={filters.q ?? ""} onChange={(event) => setFilter("q", event.target.value)} placeholder="Buscar por título, pergunta ou resposta" className="rounded-none xl:col-span-2" />
              <select value={filters.title ?? ""} onChange={(event) => setFilter("title", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm dark:text-white light:bg-white light:text-slate-900"><option value="">Todas as categorias</option>{meta.titles.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              <select value={filters.sourceType ?? ""} onChange={(event) => setFilter("sourceType", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm dark:text-white light:bg-white light:text-slate-900"><option value="">Todas as fontes</option>{meta.sourceTypes.map((item) => <option key={item} value={item}>{sourceLabels[item] || item}</option>)}</select>
              <select value={filters.relatedKeyword ?? ""} onChange={(event) => setFilter("relatedKeyword", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm dark:text-white light:bg-white light:text-slate-900"><option value="">Todas as keywords</option>{meta.relatedKeywords.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="rounded-none border-white/20 text-slate-300 dark:text-slate-300 light:text-slate-600">{activeFilters > 0 ? `${activeFilters} filtros ativos` : "sem filtros extras"}</Badge>
              <button type="button" onClick={() => setFilters(defaultFilters)} className="rounded-none border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900">Limpar filtros</button>
            </div>
          </CardContent>
        </Card>
        {loading ? <p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">Carregando base da API...</p> : null}
        <div className="space-y-4">
          {rules.map((item) => (
            <Card key={item.id} className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{item.category}</Badge>
                  <Badge variant="outline" className="rounded-none border-white/20 text-slate-300 dark:text-slate-300 light:text-slate-600">{item.source}</Badge>
                  {item.relatedKeyword ? <Badge variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{item.relatedKeyword}</Badge> : null}
                </div>
                <h3 className="mt-4 font-heading text-3xl uppercase leading-none">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{item.summaryPt}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">Fonte-base: {item.originalRef}</p>
                <div className="mt-4"><Link href={`/rules/${item.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900">Abrir detalhe</Link></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
