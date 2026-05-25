/* Coleção individual — página pública do set com lista filtrada por expansão e atalhos para cartas. */
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

  return (
    <PublicShell breadcrumbs={[{ label: "Coleções", href: "/sets" }, { label: setData?.code || params?.code || "Coleção" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white">
          <CardContent className="p-6">
            {error ? <p className="text-sm text-red-300">{error}</p> : !setData ? <p className="text-sm text-slate-300">Carregando coleção...</p> : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Coleção individual</p>
                  <h2 className="mt-2 font-heading text-5xl uppercase">{setData.namePt || setData.nameEn}</h2>
                  <p className="mt-3 text-sm uppercase tracking-[0.18em] text-primary">{setData.code}</p>
                  <p className="mt-4 text-sm leading-7 text-slate-300">Use esta página como entrada filtrada por expansão. O catálogo geral continua útil, mas aqui a leitura já nasce contextualizada por coleção.</p>
                </div>
                <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{setData._count?.cards ?? setData.cards?.length ?? 0} cartas</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {setData ? (
          <>
            <div className="flex flex-wrap gap-3">
              <Link href={`/cards?setCode=${setData.code}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Abrir no catálogo filtrado</Link>
              {setData.officialUrl ? <a href={setData.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Fonte oficial</a> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {setData.cards.map((card: any) => (
                <Card key={card.id} className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.code}</p>
                        <h3 className="mt-2 font-heading text-3xl uppercase leading-none">{card.namePt || card.nameEn}</h3>
                      </div>
                      <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{card.color || "—"}</Badge>
                    </div>
                    <p className="text-sm leading-7 text-slate-300">{card.cardType} · custo {card.cost ?? "—"} · trait {card.trait || "—"}</p>
                    <div className="flex flex-wrap gap-2">
                      {card.keywordTags?.slice(0, 4).map((keyword: string) => <Badge key={keyword} variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{keyword}</Badge>)}
                    </div>
                    <Link href={`/cards/${card.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Abrir detalhe</Link>
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
