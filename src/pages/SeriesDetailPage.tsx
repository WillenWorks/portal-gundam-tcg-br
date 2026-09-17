/* Universe Hub v1 — página de lore de uma série (TaxonomyEntry kind=SOURCE_TITLE): hero com
 * capa/era/sinopse, blocos de mobile suits/pilotos/curiosidades (metadataJson) e grade de
 * cartas relacionadas via GET /api/cards?series=. Mesmo esqueleto visual de SetDetailPage. */
import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ExternalLink } from "lucide-react";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api, type SeriesMetadata, type TaxonomyEntry } from "@/lib/api";

export default function SeriesDetailPage() {
  const [, params] = useRoute<{ slug: string }>("/series/:slug");
  const [entry, setEntry] = useState<TaxonomyEntry | null | undefined>(undefined);
  const [cards, setCards] = useState<any[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);

  useEffect(() => {
    if (!params?.slug) return;
    api.listTaxonomies("SOURCE_TITLE")
      .then((list) => setEntry(list.find((item) => item.slug === params.slug) ?? null))
      .catch(() => setEntry(null));
  }, [params?.slug]);

  useEffect(() => {
    if (!entry) return;
    api.listCards({ series: entry.name })
      .then(setCards)
      .catch(() => setCards([]))
      .finally(() => setCardsLoading(false));
  }, [entry]);

  const meta = useMemo(() => (entry?.metadataJson || {}) as SeriesMetadata, [entry]);

  return (
    <PublicShell breadcrumbs={[{ label: "Universo Gundam", href: "/series" }, { label: entry?.name || params?.slug || "Série" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6">
            {entry === null ? (
              <p className="text-sm text-red-300">Série não encontrada.</p>
            ) : !entry ? (
              <p className="text-sm text-slate-300">Carregando série...</p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
                <div className="overflow-hidden border border-white/10 bg-slate-950/60 aspect-[16/10] dark:bg-slate-950/60 light:bg-slate-100">
                  {entry.coverImage ? (
                    <img src={entry.coverImage} alt={entry.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-4">
                      <span className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Sem capa local</span>
                      <span className="font-heading text-3xl uppercase text-slate-300 dark:text-slate-300 light:text-slate-700">{entry.name}</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {meta.alias ? <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{meta.alias}</Badge> : null}
                    {meta.era ? <Badge variant="outline" className="rounded-none border-white/15 bg-white/5 text-slate-200 dark:text-slate-200 light:text-slate-700">{meta.era}</Badge> : null}
                    <Badge variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{cards.length} cartas catalogadas</Badge>
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-400">Lore da série</p>
                  <h2 className="mt-2 font-heading text-5xl uppercase leading-none">{entry.name}</h2>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                    {meta.synopsis || entry.description || "Sinopse em preparação."}
                  </p>
                  {entry.officialUrl ? (
                    <a href={entry.officialUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">
                      <ExternalLink className="size-3.5" />Fonte oficial
                    </a>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {entry ? (
          <>
            {meta.mobileSuits?.length ? (
              <section className="space-y-3">
                <h3 className="font-heading text-2xl uppercase tracking-wide text-white dark:text-white light:text-slate-900">Mobile Suits</h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {meta.mobileSuits.map((ms) => (
                    <Card key={ms.name} className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
                      <CardContent className="space-y-2 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-heading text-xl uppercase leading-none">{ms.name}</h4>
                          {ms.faction ? <Badge variant="outline" className="shrink-0 rounded-none border-white/15 bg-white/5 text-[10px] text-slate-300">{ms.faction}</Badge> : null}
                        </div>
                        {ms.pilot ? <p className="text-xs uppercase tracking-[0.2em] text-primary">Piloto: {ms.pilot}</p> : null}
                        {ms.description ? <p className="text-sm leading-6 text-slate-300 dark:text-slate-300 light:text-slate-600">{ms.description}</p> : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            {meta.pilots?.length ? (
              <section className="space-y-3">
                <h3 className="font-heading text-2xl uppercase tracking-wide text-white dark:text-white light:text-slate-900">Pilotos</h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {meta.pilots.map((pilot) => (
                    <Card key={pilot.name} className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
                      <CardContent className="space-y-2 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-heading text-xl uppercase leading-none">{pilot.name}</h4>
                          {pilot.affiliation ? <Badge variant="outline" className="shrink-0 rounded-none border-white/15 bg-white/5 text-[10px] text-slate-300">{pilot.affiliation}</Badge> : null}
                        </div>
                        {pilot.description ? <p className="text-sm leading-6 text-slate-300 dark:text-slate-300 light:text-slate-600">{pilot.description}</p> : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            {meta.trivia?.length ? (
              <section className="space-y-3">
                <h3 className="font-heading text-2xl uppercase tracking-wide text-white dark:text-white light:text-slate-900">Curiosidades</h3>
                <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
                  <CardContent className="p-5">
                    <ul className="space-y-3">
                      {meta.trivia.map((fact, index) => (
                        <li key={index} className="flex gap-3 text-sm leading-6 text-slate-300 dark:text-slate-300 light:text-slate-600">
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </section>
            ) : null}

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-heading text-2xl uppercase tracking-wide text-white dark:text-white light:text-slate-900">Cartas relacionadas</h3>
                <Link href={`/database?series=${encodeURIComponent(entry.name)}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">
                  Abrir no catálogo filtrado
                </Link>
              </div>

              {cardsLoading ? (
                <p className="text-sm text-slate-400">Carregando cartas...</p>
              ) : cards.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma carta catalogada com essa série ainda.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {cards.map((card: any) => (
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
                            <h4 className="mt-2 line-clamp-2 min-h-[3.6rem] font-heading text-2xl uppercase leading-none">{card.namePt || card.nameEn}</h4>
                          </div>
                          <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{card.color || "—"}</Badge>
                        </div>
                        <Link href={`/cards/${card.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir detalhe</Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </PublicShell>
  );
}
