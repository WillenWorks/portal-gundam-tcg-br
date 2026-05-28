/* Binder compartilhado v8 — leitura pública segura da wishlist ou coleção possuída. */
import { useEffect, useState } from "react";
import { useRoute } from "wouter";

import { PublicShell } from "@/components/layout/PublicShell";
import { api, type ApiBinder } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function SharedBinderPage() {
  const [, params] = useRoute<{ shareId: string }>("/binder/:shareId");
  const [binder, setBinder] = useState<ApiBinder | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params?.shareId) return;
    api.getSharedBinder(params.shareId).then(setBinder).catch((err) => setError(err.message));
  }, [params?.shareId]);

  return (
    <PublicShell breadcrumbs={[{ label: binder?.name || "Pasta compartilhada" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white dark:text-white light:text-slate-900">
          <CardContent className="p-6">
            {error ? <p className="text-sm text-red-300">{error}</p> : !binder ? <p className="text-sm text-slate-300 dark:text-slate-300 light:text-slate-600">Carregando pasta...</p> : (
              <>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Compartilhamento externo</p>
                <h2 className="mt-2 font-heading text-5xl uppercase">{binder.name}</h2>
                <p className="mt-4 text-sm text-slate-300 dark:text-slate-300 light:text-slate-600">{binder.user?.displayName || "Usuário"} · {binder.kind === "WISHLIST" ? "Lista de desejos" : "Cartas possuídas"}</p>
                {binder.description ? <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{binder.description}</p> : null}
              </>
            )}
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {binder?.items.map((item) => (
            <Card key={item.id} className="panel-cut rounded-none border-white/10 bg-white/5 text-white dark:text-white light:text-slate-900">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.card.code}</p>
                    <h3 className="text-2xl uppercase">{item.card.namePt || item.card.nameEn}</h3>
                  </div>
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">x{item.quantity}</Badge>
                </div>
                <p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{item.card.set?.code || "sem coleção"} · {item.card.cardType}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
