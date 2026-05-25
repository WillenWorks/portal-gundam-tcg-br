/* Detalhe de carta — leitura individual via API com dados táticos, keywords e rulings relacionadas. */
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";

import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function CardDetailPage() {
  const [, params] = useRoute<{ id: string }>("/cards/:id");
  const [card, setCard] = useState<any | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params?.id) return;
    api.getCard(params.id).then(setCard).catch((err) => setError(err.message));
  }, [params?.id]);

  return (
    <PortalShell>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white">
          <CardContent className="p-6">
            {error ? (
              <p className="text-sm text-red-300">{error}</p>
            ) : !card ? (
              <p className="text-sm text-slate-300">Carregando detalhe da carta...</p>
            ) : (
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Carta individual</p>
                  <h2 className="mt-2 font-heading text-5xl uppercase">{card.namePt || card.nameEn}</h2>
                  <p className="mt-3 text-sm uppercase tracking-[0.18em] text-primary">{card.code}</p>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{card.effectPt || card.effectEn || "Sem texto cadastrado."}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{card.color || "Sem cor"}</Badge>
                  <Badge className="rounded-none border border-white/15 bg-white/5 text-slate-200">{card.cardType || "Sem tipo"}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {card ? (
          <>
            <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-4 p-5">
                  <h3 className="font-heading text-3xl uppercase">Ficha técnica</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                    <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">Custo: {card.cost ?? "—"}</div>
                    <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">Level: {card.level ?? "—"}</div>
                    <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">AP: {card.ap ?? "—"}</div>
                    <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">HP: {card.hp ?? "—"}</div>
                    <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">Trait: {card.trait || "—"}</div>
                    <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">Série: {card.series || "—"}</div>
                    <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">Raridade: {card.rarity || "—"}</div>
                    <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">Set: {card.set?.code || "—"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {card.keywordTags?.length ? card.keywordTags.map((keyword: string) => <Badge key={keyword} variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{keyword}</Badge>) : <Badge variant="outline" className="rounded-none border-white/20 text-slate-400">sem keyword</Badge>}
                  </div>
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-4 p-5">
                  <h3 className="font-heading text-3xl uppercase">Contexto e fontes</h3>
                  <div className="space-y-3 text-sm leading-7 text-slate-300">
                    <p><span className="text-slate-500">Nome EN:</span> {card.nameEn}</p>
                    <p><span className="text-slate-500">Nome PT:</span> {card.namePt || "—"}</p>
                    <p><span className="text-slate-500">URL oficial:</span> {card.officialUrl ? <a href={card.officialUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">Abrir referência oficial</a> : "—"}</p>
                    <p><span className="text-slate-500">Origem da imagem:</span> {card.imageSourceUrl || "—"}</p>
                    <p><span className="text-slate-500">Set:</span> {card.set ? `${card.set.code} · ${card.set.namePt || card.set.nameEn}` : "—"}</p>
                  </div>
                  <div className="pt-2">
                    <Link href="/cards" className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Voltar ao catálogo</Link>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
              <CardContent className="space-y-4 p-5">
                <h3 className="font-heading text-3xl uppercase">Rulings relacionadas</h3>
                {card.rulings?.length ? card.rulings.map((rule: any) => (
                  <div key={rule.id} className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{rule.sourceType}</Badge>
                      {rule.relatedKeyword ? <Badge variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{rule.relatedKeyword}</Badge> : null}
                    </div>
                    <h4 className="mt-3 text-2xl uppercase text-white">{rule.title}</h4>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{rule.answerPt || rule.questionPt || "Sem resumo cadastrado."}</p>
                    <div className="mt-4">
                      <Link href={`/rules/${rule.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Abrir detalhe da ruling</Link>
                    </div>
                  </div>
                )) : <p className="text-sm text-slate-400">Nenhuma ruling vinculada a esta carta ainda.</p>}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </PortalShell>
  );
}
