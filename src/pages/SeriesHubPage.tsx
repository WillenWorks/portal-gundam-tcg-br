/* Universe Hub v1 — vitrine pública das séries/mídias (TaxonomyEntry kind=SOURCE_TITLE):
 * sinopse curta, era e link pra página de lore completa. Mesmo esqueleto visual de
 * CollectionsPage (capa 16:8, badges de metadados, CTA) pra manter a identidade Anaheim Hub. */
import { useEffect, useState } from "react";
import { Link } from "wouter";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ParallaxHeroBanner } from "@/components/catalog/ParallaxHeroBanner";
import { api, type SeriesMetadata, type TaxonomyEntry } from "@/lib/api";

export default function SeriesHubPage() {
  const [series, setSeries] = useState<TaxonomyEntry[]>([]);

  useEffect(() => {
    api.listTaxonomies("SOURCE_TITLE").then(setSeries).catch(() => undefined);
  }, []);

  return (
    <PublicShell
      breadcrumbs={[{ label: "Universo Gundam" }]}
      heroBanner={
        <ParallaxHeroBanner
          image="/images/unicorn_blueprint_banner.png"
          eyebrow="Arquivo Central de Lore"
          title="Universo Gundam"
          badge={`${series.length} séries catalogadas`}
        />
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {series.map((entry) => {
          const meta = (entry.metadataJson || {}) as SeriesMetadata;
          const mobileSuitCount = meta.mobileSuits?.length ?? 0;
          const pilotCount = meta.pilots?.length ?? 0;

          return (
            <Card key={entry.id} className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
              <CardContent className="space-y-4 p-4">
                <div className="overflow-hidden border border-white/10 bg-slate-950/60 aspect-[16/8] dark:bg-slate-950/60 light:bg-slate-100">
                  {entry.coverImage ? (
                    <img src={entry.coverImage} alt={entry.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center px-4">
                      <span className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Sem capa local</span>
                      <span className="font-heading text-2xl uppercase text-slate-300 dark:text-slate-300 light:text-slate-700">{entry.name}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{meta.alias || meta.era || "Mídia catalogada"}</p>
                    <h3 className="mt-2 line-clamp-2 font-heading text-2xl uppercase leading-none">{entry.name}</h3>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {meta.era ? (
                    <Badge variant="outline" className="rounded-none border-white/15 bg-white/5 text-slate-300 dark:text-slate-300 light:text-slate-700">{meta.era}</Badge>
                  ) : null}
                  {mobileSuitCount ? (
                    <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{mobileSuitCount} mobile suits</Badge>
                  ) : null}
                  {pilotCount ? (
                    <Badge variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{pilotCount} pilotos</Badge>
                  ) : null}
                </div>

                <p className="line-clamp-3 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">
                  {meta.synopsis || entry.description || "Página de lore em preparação — sinopse, mobile suits e pilotos chegam em breve."}
                </p>

                <div className="flex flex-wrap gap-3">
                  <Link href={`/database?series=${encodeURIComponent(entry.name)}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900">
                    Ver cartas
                  </Link>
                  <Link href={`/series/${entry.slug}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900">
                    Abrir lore
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {series.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">Nenhuma série catalogada ainda.</p>
        ) : null}
      </div>
    </PublicShell>
  );
}
