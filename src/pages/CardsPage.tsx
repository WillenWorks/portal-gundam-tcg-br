import { useMemo, useState } from "react";

import { PortalShell } from "@/components/layout/PortalShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { catalogService } from "@/services/portal-service";

export default function CardsPage() {
  const [query, setQuery] = useState("");
  const allCards = catalogService.listCards();
  const filtered = useMemo(() => catalogService.searchCards(query), [query]);

  return (
    <PortalShell>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
          <CardContent className="grid gap-4 p-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Busca inicial</p>
              <h2 className="mt-2 font-heading text-4xl uppercase">Catálogo navegável de cartas</h2>
            </div>
            <div className="w-full max-w-md">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, código, série, trait ou keyword"
                className="rounded-none border-white/15 bg-slate-950/70 text-white placeholder:text-slate-500"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((card) => (
            <Card key={card.id} className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{card.code}</p>
                    <h3 className="mt-2 font-heading text-3xl uppercase leading-none">{card.namePt || card.name}</h3>
                  </div>
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{card.color}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                  <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">Tipo: {card.type}</div>
                  <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">Custo: {card.cost}</div>
                  <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">AP: {card.ap ?? "—"}</div>
                  <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">HP: {card.hp ?? "—"}</div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Trait / Série</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{card.trait} · {card.series}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {card.keywords.map((keyword) => (
                    <Badge key={keyword} variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">
                      {keyword}
                    </Badge>
                  ))}
                </div>

                <p className="text-sm leading-7 text-slate-300">{card.effect}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-sm text-slate-400">Exibindo {filtered.length} de {allCards.length} cartas mockadas.</p>
      </div>
    </PortalShell>
  );
}
