/* Binder compartilhado v8 — leitura pública segura da wishlist ou coleção possuída.
 * Tentativa de acesso a pasta privada (que não seja do dono) vai pra Home, não mostra
 * erro na tela — não expõe nem "essa pasta existe mas é privada". */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

import { PublicShell } from "@/components/layout/PublicShell";
import { api, mapApiCard, type ApiBinder } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type BinderRow = ReturnType<typeof mapApiCard> & { quantity: number };

/** Mesmo carrossel do deck compartilhado — setas na borda da imagem, teclado funciona,
 *  quantidade fica no texto abaixo (fora da arte de propósito). */
function CardPreviewModal({ rows, index, onNavigate, onClose }: { rows: BinderRow[]; index: number | null; onNavigate: (index: number) => void; onClose: () => void }) {
  const card = index !== null ? rows[index] : null;

  useEffect(() => {
    if (index === null || rows.length < 2) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onNavigate((index - 1 + rows.length) % rows.length);
      if (e.key === "ArrowRight") onNavigate((index + 1) % rows.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, rows.length, onNavigate]);

  if (!card || index === null) return null;
  const image = card.imageLargeUrl || card.imageMediumUrl || card.imageUrl;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[380px] max-h-[90vh] overflow-y-auto border-white/10 bg-slate-950 text-white">
        <DialogTitle className="sr-only">{`Carta ampliada: ${card.namePt || card.name}`}</DialogTitle>
        <div className="relative mx-auto h-[447px] w-[320px] overflow-hidden border border-white/10 bg-slate-950/70">
          {image ? <img src={image} alt={card.namePt || card.name} className="h-full w-full object-cover" /> : null}
          {rows.length > 1 ? (
            <>
              <button type="button" onClick={() => onNavigate((index - 1 + rows.length) % rows.length)} title="Carta anterior" className="absolute left-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/80 text-white transition hover:bg-primary hover:text-primary-foreground"><ChevronLeft className="size-5" /></button>
              <button type="button" onClick={() => onNavigate((index + 1) % rows.length)} title="Próxima carta" className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/80 text-white transition hover:bg-primary hover:text-primary-foreground"><ChevronRight className="size-5" /></button>
            </>
          ) : null}
        </div>
        <div className="flex flex-col items-center gap-2 pt-1">
          <p className="text-sm text-slate-400">{card.quantity}x nessa pasta{rows.length > 1 ? ` · ${index + 1}/${rows.length}` : ""}</p>
          <a href={`/#/cards/${card.cardModelId || card.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-none border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.16em] text-white nav-hover-soft hover:text-white">
            <ExternalLink className="size-3.5" />Abrir detalhe
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SharedBinderPage() {
  const [, params] = useRoute<{ shareId: string }>("/binder/:shareId");
  const [, navigate] = useLocation();
  const [binder, setBinder] = useState<ApiBinder | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!params?.shareId) return;
    api.getSharedBinder(params.shareId).then(setBinder).catch(() => navigate("/", { replace: true }));
  }, [params?.shareId]);

  const rows = useMemo(() => {
    if (!binder) return [];
    return binder.items.map((item) => ({ ...mapApiCard(item.card), quantity: item.quantity }));
  }, [binder]);

  return (
    <PublicShell breadcrumbs={[{ label: binder?.name || "Pasta compartilhada" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6">
            {!binder ? <p className="text-sm text-slate-300 dark:text-slate-300 light:text-slate-600">Carregando pasta...</p> : (
              <>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Compartilhamento externo</p>
                <h2 className="mt-2 font-heading text-5xl uppercase">{binder.name}</h2>
                <p className="mt-4 text-sm text-slate-300 dark:text-slate-300 light:text-slate-600">{binder.user?.displayName || "Usuário"}</p>
                {binder.description ? <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{binder.description}</p> : null}
              </>
            )}
          </CardContent>
        </Card>
        <div className="grid grid-cols-5 gap-3 sm:grid-cols-7 xl:grid-cols-9">
          {rows.map((row, i) => {
            const image = row.imageMediumUrl || row.imageUrl;
            return (
              <button key={row.printId || row.id} type="button" onClick={() => setPreviewIndex(i)} title={`Ver ${row.namePt || row.name} em tamanho grande`} className="group relative block aspect-[63/88] w-full overflow-hidden border border-white/15 transition hover:border-primary/50">
                {image ? <img src={image} alt={row.namePt || row.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-slate-950/80 p-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">{row.namePt || row.name}</div>}
                <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{row.quantity}</span>
                <div className="absolute inset-x-0 bottom-0 translate-y-full bg-slate-950/95 p-1.5 text-left opacity-0 transition duration-150 group-hover:translate-y-0 group-hover:opacity-100">
                  <p className="truncate text-[11px] font-medium text-white">{row.namePt || row.name}</p>
                  <p className="truncate text-[10px] text-slate-400">{row.code}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <CardPreviewModal rows={rows} index={previewIndex} onNavigate={setPreviewIndex} onClose={() => setPreviewIndex(null)} />
    </PublicShell>
  );
}
