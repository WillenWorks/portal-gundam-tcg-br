/* Binder compartilhado v8 — leitura pública segura da wishlist ou coleção possuída. */
import { useEffect, useState } from "react";
import { useRoute } from "wouter";

import { PublicShell } from "@/components/layout/PublicShell";
import { api, type ApiBinder } from "@/lib/api";
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
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
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
        <div className="grid grid-cols-5 gap-3 sm:grid-cols-7 xl:grid-cols-9">
          {binder?.items.map((item) => {
            const image = item.card?.imageMediumUrl || item.card?.imageUrl;
            return (
              <div key={item.id} className="group relative block aspect-[63/88] overflow-hidden border border-white/15">
                {image ? <img src={image} alt={item.card?.namePt || item.card?.nameEn} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-slate-950/80 p-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.card?.namePt || item.card?.nameEn}</div>}
                <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{item.quantity}</span>
                <div className="absolute inset-x-0 bottom-0 translate-y-full bg-slate-950/95 p-1.5 text-left opacity-0 transition duration-150 group-hover:translate-y-0 group-hover:opacity-100">
                  <p className="truncate text-[11px] font-medium text-white">{item.card?.namePt || item.card?.nameEn}</p>
                  <p className="truncate text-[10px] text-slate-400">{item.card?.code}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PublicShell>
  );
}
