/* Coleções — índice público de expansões com contagem de cartas e entrada para páginas filtradas por set. */
import { useEffect, useState } from "react";
import { Link } from "wouter";

import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function CollectionsPage() {
  const [sets, setSets] = useState<Array<{ id: string; code: string; namePt?: string | null; nameEn: string; releaseDate?: string | null; _count?: { cards: number } }>>([]);

  useEffect(() => {
    api.listSets().then(setSets).catch(() => undefined);
  }, []);

  return (
    <PortalShell breadcrumbs={[{ label: "Coleções" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Expansões</p>
                <h2 className="mt-2 font-heading text-5xl uppercase">Coleções e sets do portal</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">Cada coleção agora tem sua própria entrada pública para leitura filtrada por expansão, em vez de depender só do catálogo geral.</p>
              </div>
              <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{sets.length} sets</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sets.map((set) => (
            <Card key={set.id} className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{set.code}</p>
                    <h3 className="mt-2 font-heading text-3xl uppercase leading-none">{set.namePt || set.nameEn}</h3>
                  </div>
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{set._count?.cards ?? 0} cartas</Badge>
                </div>
                <p className="text-sm leading-7 text-slate-300">{set.releaseDate ? new Date(set.releaseDate).toLocaleDateString("pt-BR") : "Data não cadastrada"}</p>
                <div>
                  <Link href={`/sets/${set.code}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Abrir coleção</Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
