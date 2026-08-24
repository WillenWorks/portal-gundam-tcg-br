/* Base de regras v10 — navegação hierárquica (grupo temático → categoria → pergunta)
 * em accordion quando não há busca ativa, lista plana quando há. Grupos batem com a
 * estrutura real do Comprehensive Rules oficial (Preparação → Turno → Batalha →
 * Keywords → Terminologia → Motor de Regras), não é ordem arbitrária. */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { PublicShell } from "@/components/layout/PublicShell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, mapApiRule, type RulingFilters } from "@/lib/api";
import { translateRuleTitle } from "@/lib/ruleLabels";
import type { RuleEntry } from "@/modules/core/types";

const defaultFilters: RulingFilters = { q: "", sourceType: "", relatedKeyword: "", title: "", sort: "updated_desc" };
const sourceLabels: Record<string, string> = { OFFICIAL_RULES: "Official Rules", OFFICIAL_FAQ: "Official FAQ", COMMUNITY_EXPLAINER: "Community Explainer" };

// Mesma ordem de leitura do Comprehensive Rules oficial (secoes 6 -> 7 -> 8 -> 13 ->
// 5 -> 9/10/11), nao ordem alfabetica arbitraria -- assim quem esta aprendendo segue
// a progressao natural do jogo. relatedPhase sem correspondencia aqui cai no grupo
// "Outras" no final, nada fica escondido.
const PHASE_GROUPS: Array<{ key: string; label: string; phases: string[] }> = [
  { key: "preparing", label: "Preparação", phases: ["preparing_to_play"] },
  { key: "turn", label: "Fluxo do Turno", phases: ["turn_flow", "start_phase", "draw_phase", "resource_phase", "main_phase", "end_phase"] },
  { key: "battle", label: "Batalha", phases: ["battle", "action_step"] },
  { key: "keywords", label: "Keywords", phases: ["keywords"] },
  { key: "terminology", label: "Terminologia", phases: ["terminology"] },
  { key: "engine", label: "Motor de Regras", phases: ["effects", "rules_management"] },
];

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

// Item folha do accordion: mostra a PERGUNTA como gatilho e expande a RESPOSTA
// direto ali, sem sair da página -- só quem quiser o detalhe completo (fonte,
// metadados, carta vinculada, mais rulings da mesma categoria) clica no link.
function RuleRow({ item }: { item: RuleEntry }) {
  const hasExtra = Boolean(item.examplePlayPt) || Boolean(item.relatedCards?.length);
  return (
    <AccordionItem value={item.id} className="border-t border-white/10 first:border-t-0">
      <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline dark:text-white light:text-slate-900 [&>svg]:mt-1">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left">
          <span className="min-w-0 flex-1">{item.questionPt || item.title}</span>
          {item.relatedKeyword ? <Badge variant="outline" className="shrink-0 rounded-none border-accent/40 text-accent">{item.relatedKeyword}</Badge> : null}
        </span>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-0">
        <p className="text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{item.summaryPt || "Sem resposta cadastrada."}</p>
        {item.examplePlayPt ? (
          <p className="mt-3 text-sm leading-7 text-slate-400"><span className="text-xs uppercase tracking-[0.2em] text-slate-500">Exemplo: </span>{item.examplePlayPt}</p>
        ) : null}
        <Link href={`/rules/${item.id}`} className="mt-3 inline-block text-xs uppercase tracking-[0.18em] text-primary hover:underline">
          {hasExtra ? "Ver detalhe completo (carta e exemplo vinculados)" : "Ver detalhe completo"}
        </Link>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function RulesPage() {
  const [, navigate] = useLocation();
  const [filters, setFilters] = useState<RulingFilters>(() => readFiltersFromHash());
  const [rules, setRules] = useState<RuleEntry[]>([]);
  const [allRules, setAllRules] = useState<RuleEntry[]>([]);
  const [meta, setMeta] = useState<{ sourceTypes: string[]; relatedKeywords: string[]; titles: string[] }>({ sourceTypes: [], relatedKeywords: [], titles: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.getRulingFilters().then(setMeta).catch(() => undefined); }, []);
  // Carrega tudo 1 vez, sem filtro -- alimenta a navegacao em accordion (modo "navegar").
  useEffect(() => { api.listRulings({ sort: "title_asc" }).then((result) => setAllRules(result.map(mapApiRule))).catch(() => undefined); }, []);
  useEffect(() => {
    setLoading(true);
    api.listRulings(filters).then((result) => setRules(result.map(mapApiRule))).finally(() => setLoading(false));
  }, [filters]);
  useEffect(() => { navigate(buildHash(filters), { replace: true }); }, [filters, navigate]);

  const activeFilters = useMemo(() => Object.entries(filters).filter(([key, value]) => value && key !== "sort").length, [filters]);
  const searchMode = activeFilters > 0;
  const setFilter = (key: keyof RulingFilters, value: string) => setFilters((state) => ({ ...state, [key]: value }));

  const copySearchLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#${buildHash(filters)}`);
    toast.success("Link da busca copiado.");
  };

  // Agrupa: grupo tematico (fase do jogo) -> categoria (titulo) -> lista de perguntas.
  const grouped = useMemo(() => {
    const byPhase = new Map<string, RuleEntry[]>();
    for (const item of allRules) {
      const phase = item.relatedPhase || "other";
      if (!byPhase.has(phase)) byPhase.set(phase, []);
      byPhase.get(phase)!.push(item);
    }
    const knownPhases = new Set(PHASE_GROUPS.flatMap((g) => g.phases));
    const groups = PHASE_GROUPS.map((g) => {
      const items = g.phases.flatMap((p) => byPhase.get(p) || []);
      const byTitle = new Map<string, RuleEntry[]>();
      for (const item of items) {
        if (!byTitle.has(item.title)) byTitle.set(item.title, []);
        byTitle.get(item.title)!.push(item);
      }
      return { key: g.key, label: g.label, count: items.length, categories: [...byTitle.entries()].map(([title, rows]) => ({ title, rows })) };
    }).filter((g) => g.count > 0);
    const otherItems = [...byPhase.entries()].filter(([phase]) => !knownPhases.has(phase)).flatMap(([, items]) => items);
    if (otherItems.length) {
      const byTitle = new Map<string, RuleEntry[]>();
      for (const item of otherItems) {
        if (!byTitle.has(item.title)) byTitle.set(item.title, []);
        byTitle.get(item.title)!.push(item);
      }
      groups.push({ key: "other", label: "Outras", count: otherItems.length, categories: [...byTitle.entries()].map(([title, rows]) => ({ title, rows })) });
    }
    return groups;
  }, [allRules]);

  return (
    <PublicShell title="Regras" description="Explicação mecânica em português das keywords, fases e situações de jogo — a keyword em si sempre fica em inglês, como aparece na carta. Baseado nas regras e FAQs oficiais, redigido do zero.">
      <div className="space-y-6">
        <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Base de regras</p>
                <h2 className="mt-2 font-heading text-4xl uppercase">{searchMode ? "Resultado da busca" : "Navegue por assunto"}</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{searchMode ? `${rules.length} resultado(s) encontrado(s).` : "Organizado na mesma ordem do jogo: preparação, turno, batalha, keywords, terminologia."}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{allRules.length} itens no total</Badge>
                <button type="button" onClick={copySearchLink} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900"><Copy className="mr-2 size-4" />Copiar busca</button>
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-5">
              <Input value={filters.q ?? ""} onChange={(event) => setFilter("q", event.target.value)} placeholder="Buscar por título, pergunta ou resposta" className="rounded-none xl:col-span-2" />
              <select value={filters.title ?? ""} onChange={(event) => setFilter("title", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm dark:text-white light:bg-white light:text-slate-900"><option value="">Todas as categorias</option>{meta.titles.map((item) => <option key={item} value={item}>{translateRuleTitle(item)}</option>)}</select>
              <select value={filters.sourceType ?? ""} onChange={(event) => setFilter("sourceType", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm dark:text-white light:bg-white light:text-slate-900"><option value="">Todas as fontes</option>{meta.sourceTypes.map((item) => <option key={item} value={item}>{sourceLabels[item] || item}</option>)}</select>
              <select value={filters.relatedKeyword ?? ""} onChange={(event) => setFilter("relatedKeyword", event.target.value)} className="h-10 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm dark:text-white light:bg-white light:text-slate-900"><option value="">Todas as keywords</option>{meta.relatedKeywords.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            </div>
            {searchMode ? (
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="rounded-none border-white/20 text-slate-300 dark:text-slate-300 light:text-slate-600">{activeFilters} filtro(s) ativo(s)</Badge>
                <button type="button" onClick={() => setFilters(defaultFilters)} className="rounded-none border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900">Limpar e voltar pra navegação</button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {searchMode ? (
          loading ? <p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">Buscando...</p> : !rules.length ? (
            <Card className="panel-cut rounded-none surface-panel"><CardContent className="p-8 text-center text-sm text-muted-portal">Nenhuma ruling encontrada com esse filtro.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {rules.map((item) => (
                <Card key={item.id} className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{translateRuleTitle(item.title)}</Badge>
                      <Badge variant="outline" className="rounded-none border-white/20 text-slate-300 dark:text-slate-300 light:text-slate-600">{item.source}</Badge>
                      {item.relatedKeyword ? <Badge variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{item.relatedKeyword}</Badge> : null}
                    </div>
                    <p className="mt-4 text-sm font-medium leading-6 dark:text-white light:text-slate-900">{item.questionPt || item.title}</p>
                    <p className="mt-2 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{item.summaryPt}</p>
                    <div className="mt-4"><Link href={`/rules/${item.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900">Abrir detalhe</Link></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : (
          <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
            <CardContent className="p-2 sm:p-4">
              <Accordion type="multiple" className="w-full">
                {grouped.map((group) => (
                  <AccordionItem key={group.key} value={group.key} className="border-white/10">
                    <AccordionTrigger className="px-3 text-lg uppercase tracking-wide hover:no-underline">
                      <span className="flex items-center gap-3"><span>{group.label}</span><Badge variant="outline" className="rounded-none border-white/20 text-xs text-slate-400 dark:text-slate-400 light:text-slate-500">{group.count}</Badge></span>
                    </AccordionTrigger>
                    <AccordionContent className="px-1">
                      <Accordion type="multiple" className="w-full">
                        {group.categories.map((cat) => (
                          <AccordionItem key={cat.title} value={cat.title} className="border-white/5">
                            <AccordionTrigger className="px-3 py-2.5 text-sm text-slate-300 hover:no-underline dark:text-slate-300 light:text-slate-600">
                              <span className="flex items-center gap-3">{translateRuleTitle(cat.title)}<Badge variant="outline" className="rounded-none border-white/15 text-[11px] text-slate-500">{cat.rows.length}</Badge></span>
                            </AccordionTrigger>
                            <AccordionContent className="p-0">
                              <Accordion type="multiple" className="w-full border-t border-white/10">
                                {cat.rows.map((row) => <RuleRow key={row.id} item={row} />)}
                              </Accordion>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}
      </div>
    </PublicShell>
  );
}
