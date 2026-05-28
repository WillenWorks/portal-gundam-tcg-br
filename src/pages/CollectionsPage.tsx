/* Coleções v8 — capa, data de lançamento e atalho direto para catálogo filtrado por set. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function CollectionsPage() {
  const [sets, setSets] = useState<Array<{ id: string; code: string; namePt?: string | null; nameEn: string; releaseDate?: string | null; _count?: { cards: number }; coverImage?: string | null; setType?: string; shortDescription?: string | null }>>([]);
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    api.listSets().then(setSets).catch(() => undefined);
  }, []);

  return (
    <PublicShell breadcrumbs={[{ label: "Coleções" }]} title="Coleções" description="Boosters e starter decks com entrada própria, data de lançamento e salto direto para o catálogo filtrado.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sets.map((set) => {
          const release = set.releaseDate ? new Date(set.releaseDate) : null;
          const isFuture = release ? release.getTime() > today.getTime() : false;
          return (
            <Card key={set.id} className="panel-cut rounded-none border-white/10 bg-white/5 text-white dark:text-white light:text-slate-900">
              <CardContent className="space-y-4 p-4">
                <div className="overflow-hidden border border-white/10 bg-slate-950/60 aspect-[16/8] dark:bg-slate-950/60 light:bg-slate-100">
                  {set.coverImage ? <img src={set.coverImage} alt={set.namePt || set.nameEn} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.24em] text-slate-500">{set.code}</div>}
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{set.code} · {set.setType || "BOOSTER"}</p>
                    <h3 className="mt-2 font-heading text-2xl uppercase leading-none">{set.namePt || set.nameEn}</h3>
                  </div>
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{set._count?.cards ?? 0} cartas</Badge>
                </div>
                <p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{release ? `${isFuture ? "Lançamento previsto" : "Lançado em"} ${release.toLocaleDateString("pt-BR")}` : "Data não cadastrada"}</p>
                <p className="text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{set.shortDescription || "Entrada preparada para ligar coleção, páginas de cartas e futuros assets visuais."}</p>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/cards?setCode=${encodeURIComponent(set.code)}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900">Ver cartas</Link>
                  <Link href={`/sets/${set.code}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900">Abrir coleção</Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PublicShell>
  );
}
