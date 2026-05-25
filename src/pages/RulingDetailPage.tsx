/* Detalhe de ruling — leitura individual via API com pergunta, resposta, fonte e carta relacionada. */
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";

import { PortalShell } from "@/components/layout/PortalShell";
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
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params?.id) return;
    api.getRuling(params.id).then(setRule).catch((err) => setError(err.message));
  }, [params?.id]);

  return (
    <PortalShell>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white">
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
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
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

            <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
              <CardContent className="space-y-5 p-5">
                <h3 className="font-heading text-3xl uppercase">Metadados</h3>
                <div className="space-y-3 text-sm leading-7 text-slate-300">
                  <p><span className="text-slate-500">Fonte:</span> {sourceLabels[rule.sourceType] || rule.sourceType}</p>
                  <p><span className="text-slate-500">Keyword:</span> {rule.relatedKeyword || "—"}</p>
                  <p><span className="text-slate-500">Status da tradução:</span> {rule.translationStatus || "—"}</p>
                  <p><span className="text-slate-500">Referência original:</span> {rule.originalUrl ? <a href={rule.originalUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">Abrir fonte</a> : "—"}</p>
                </div>

                <div className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Carta relacionada</p>
                  {rule.card ? (
                    <>
                      <p className="mt-2 text-lg text-white">{rule.card.namePt || rule.card.nameEn}</p>
                      <div className="mt-4">
                        <Link href={`/cards/${rule.card.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Abrir detalhe da carta</Link>
                      </div>
                    </>
                  ) : <p className="mt-2 text-sm text-slate-400">Nenhuma carta vinculada.</p>}
                </div>

                <div>
                  <Link href="/rules" className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Voltar para regras</Link>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </PortalShell>
  );
}
