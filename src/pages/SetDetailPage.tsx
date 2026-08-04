/* Coleção individual v9 — hero com capa, metadados do set e grade pública de cartas com preview real. */
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function SetDetailPage() {
  const [, params] = useRoute<{ code: string }>("/sets/:code");
  const [setData, setSetData] = useState<any | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params?.code) return;
    api.getSet(params.code).then(setSetData).catch((err) => setError(err.message));
  }, [params?.code]);

  const releaseDate = setData?.releaseDate ? new Date(setData.releaseDate) : null;

  return (
    <PublicShell breadcrumbs={[{ label: "Coleções", href: "/sets" }, { label: setData?.code || params?.code || "Coleção" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6">
            {error ? (
              <p className="text-sm text-red-300">{error}</p>
            ) : !setData ? (
              <p className="text-sm text-slate-300">Carregando coleção...</p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
                <div className="overflow-hidden border border-white/10 bg-slate-950/60 aspect-[16/10] dark:bg-slate-950/60 light:bg-slate-100">
                  {setData.coverImage ? (
                    <img src={setData.coverImage} alt={setData.namePt || setData.nameEn} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                      <span className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Sem capa local</span>
                      <span className="font-heading text-4xl uppercase text-slate-300 dark:text-slate-300 light:text-slate-700">{setData.code}</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{setData.setType || "BOOSTER"}</Badge>
                    <Badge variant="outline" className="rounded-none border-white/15 bg-white/5 text-slate-200 dark:text-slate-200 light:text-slate-700">
                      {setData._count?.cards ?? setData.cards?.length ?? 0} cartas
                    </Badge>
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-400">Coleção individual</p>
                  <h2 className="mt-2 font-heading text-5xl uppercase leading-none">{setData.namePt || setData.nameEn}</h2>
                  <p className="mt-3 text-sm uppercase tracking-[0.18em] text-primary">{setData.code}</p>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                    {setData.shortDescription || "Página pública pronta para virar a entrada principal de cada coleção, com capa própria, metadados e leitura contextual de cartas."}
                  </p>
                  <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                    <div className="panel-cut border surface-strong p-3">Lançamento: {releaseDate ? releaseDate.toLocaleDateString("pt-BR") : "não cadastrado"}</div>
                    <div className="panel-cut border surface-strong p-3">Nome EN: {setData.nameEn}</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {setData ? (
          <>
            <div className="flex flex-wrap gap-3">
              <Link href={`/cards?setCode=${setData.code}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir no catálogo filtrado</Link>
              {setData.officialUrl ? <a href={setData.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Fonte oficial</a> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {setData.cards.map((card: any) => (
                <Card key={card.id} className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
                  <CardContent className="space-y-4 p-5">
                    <div className="overflow-hidden border border-white/10 bg-slate-950/60 aspect-[3/4] dark:bg-slate-950/60 light:bg-slate-100">
                      {(card.imageSmallUrl || card.thumbUrl || card.imageUrl) ? (
                        <img src={card.imageSmallUrl || card.thumbUrl || card.imageUrl} alt={card.namePt || card.nameEn} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.24em] text-slate-500">Sem arte</div>
                      )}
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.code}</p>
                        <h3 className="mt-2 font-heading text-3xl uppercase leading-none">{card.namePt || card.nameEn}</h3>
                      </div>
                      <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{card.color || "—"}</Badge>
                    </div>
                    <p className="text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{card.cardType}{card.cost != null ? ` · custo ${card.cost}` : ""}{card.trait ? ` · trait ${card.trait}` : ""}</p>
                    {card.keywordTags?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {card.keywordTags.slice(0, 4).map((keyword: string) => <Badge key={keyword} variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{keyword}</Badge>)}
                      </div>
                    ) : null}
                    <Link href={`/cards/${card.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir detalhe</Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </PublicShell>
  );
}
