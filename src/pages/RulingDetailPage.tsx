/* Detalhe de ruling — leitura individual via API com breadcrumbs, contexto e atalhos para carta e keyword relacionada. */
import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

const sourceLabels: Record<string, string> = {
  OFFICIAL_RULES: "Official Rules",
  OFFICIAL_FAQ: "Official FAQ",
  COMMUNITY_EXPLAINER: "Community Explainer",
};

export default function RulingDetailPage() {
  const [, params] = useRoute<{ id: string }>("/rules/:id");
  const [rule, setRule] = useState<any | null>(null);
  const [moreRules, setMoreRules] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!params?.id) return;
      setError("");
      setRule(null);
      setMoreRules([]);

      try {
        const detail = await api.getRuling(params.id);
        if (!active) return;
        setRule(detail);

        // Relacionadas: por keyword quando tem (mais especifico), senao pela mesma
        // categoria (title) -- sem isso, a maioria das rulings (que sao por fase de
        // jogo, nao por keyword) nunca mostrava nenhuma relacionada.
        const relatedKeyword = detail.relatedKeyword || "";
        const result = await api.listRulings(relatedKeyword ? { relatedKeyword, sort: "updated_desc" } : { title: detail.title, sort: "updated_desc" });
        if (!active) return;
        setMoreRules(result.filter((item) => item.id !== detail.id).slice(0, 5));
      } catch (err: any) {
        if (!active) return;
        setError(err.message || "Falha ao carregar a ruling.");
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [params?.id]);

  const breadcrumbs = useMemo<Array<{ label: string; href?: string }>>(() => {
    if (!rule) return [{ label: "Regras", href: "/rules" }, { label: params?.id || "Detalhe" }];
    const trail: Array<{ label: string; href?: string }> = [{ label: "Regras", href: "/rules" }];
    if (rule.card) trail.push({ label: rule.card.code || rule.card.namePt || rule.card.nameEn, href: `/cards/${rule.card.id}` });
    trail.push({ label: rule.title || "Ruling" });
    return trail;
  }, [rule, params?.id]);

  return (
    <PublicShell breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6">
            {error ? (
              <p className="text-sm text-red-300">{error}</p>
            ) : !rule ? (
              <p className="text-sm text-slate-300">Carregando detalhe da ruling...</p>
            ) : (
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Ruling individual</p>
                  <h2 className="mt-2 font-heading text-5xl uppercase">{rule.title}</h2>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{rule.answerPt || rule.questionPt || "Sem conteúdo cadastrado."}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{sourceLabels[rule.sourceType] || rule.sourceType}</Badge>
                  {rule.relatedKeyword ? <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{rule.relatedKeyword}</Badge> : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {rule ? (
          <>
            <div className="flex flex-wrap gap-3">
              <Link href="/rules" className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Voltar para regras</Link>
              {rule.card ? <Link href={`/cards/${rule.card.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Ir para a carta</Link> : null}
              {rule.relatedKeyword ? <Link href={`/rules?relatedKeyword=${encodeURIComponent(rule.relatedKeyword)}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir trilha da keyword</Link> : <Link href={`/rules?title=${encodeURIComponent(rule.title)}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Ver mais desta categoria</Link>}
              {rule.card?.namePt || rule.card?.nameEn ? <Link href={`/rules?q=${encodeURIComponent(rule.card.namePt || rule.card.nameEn)}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Buscar pelo nome da carta</Link> : null}
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="space-y-5 p-5">
                  <h3 className="font-heading text-3xl uppercase">Pergunta e resposta</h3>
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Pergunta PT-BR</p>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{rule.questionPt || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Resposta PT-BR</p>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{rule.answerPt || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Exemplo de uso</p>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{rule.examplePlayPt || "—"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="space-y-5 p-5">
                  <h3 className="font-heading text-3xl uppercase">Metadados</h3>
                  <div className="space-y-3 text-sm leading-7 text-slate-300">
                    <p><span className="text-slate-500">Fonte:</span> {sourceLabels[rule.sourceType] || rule.sourceType}</p>
                    <p><span className="text-slate-500">Keyword:</span> {rule.relatedKeyword || "—"}</p>
                    <p><span className="text-slate-500">Status da tradução:</span> {rule.translationStatus || "—"}</p>
                    <p><span className="text-slate-500">Referência original:</span> {rule.originalUrl ? <a href={rule.originalUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">Abrir fonte</a> : "—"}</p>
                  </div>

                  <div className="panel-cut border surface-strong p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Carta relacionada</p>
                    {rule.card ? (
                      <>
                        <p className="mt-2 text-lg text-white">{rule.card.namePt || rule.card.nameEn}</p>
                        <p className="mt-2 text-sm text-slate-400">{rule.card.code} · {rule.card.cardType} · {rule.card.color || "sem cor"}</p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Link href={`/cards/${rule.card.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir detalhe da carta</Link>
                          {rule.card.set?.code ? <Link href={`/sets/${rule.card.set.code}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir coleção</Link> : null}
                        </div>
                      </>
                    ) : <p className="mt-2 text-sm text-slate-400">Nenhuma carta vinculada.</p>}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="space-y-4 p-5">
                <h3 className="font-heading text-3xl uppercase">Mais rulings relacionadas</h3>
                {moreRules.length ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {moreRules.map((item) => (
                      <div key={item.id} className="panel-cut border surface-strong p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{sourceLabels[item.sourceType] || item.sourceType}</Badge>
                          {item.relatedKeyword ? <Badge variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{item.relatedKeyword}</Badge> : null}
                        </div>
                        <h4 className="mt-3 text-2xl uppercase text-white">{item.title}</h4>
                        <p className="mt-3 text-sm leading-7 text-slate-300">{item.answerPt || item.questionPt || "Sem resumo cadastrado."}</p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Link href={`/rules/${item.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir detalhe</Link>
                          {item.card ? <Link href={`/cards/${item.card.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Ir para carta</Link> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Não encontrei outras rulings com a mesma keyword ainda.</p>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </PublicShell>
  );
}
