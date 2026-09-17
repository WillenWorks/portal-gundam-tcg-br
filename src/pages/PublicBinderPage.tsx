/* Pastas de Coleção Públicas v1 — sucessora de SharedBinderPage: mesmo carregamento por
 * shareId, mas com dois modos de visualização (Grid denso e Fichário 3D — spread de 2
 * páginas de 9 bolsos com flip em rotateY via framer-motion), filtro por tag (Para Troca /
 * Desejo, ver BinderPage.tsx onde o dono marca) e link de compartilhamento rápido. */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Copy, ExternalLink, LayoutGrid, ArrowLeftRight, Gift } from "lucide-react";
import { toast } from "sonner";

import { PublicShell } from "@/components/layout/PublicShell";
import { api, mapApiCard, type ApiBinder, type BinderItemTag } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BinderRow = ReturnType<typeof mapApiCard> & { quantity: number; tag?: BinderItemTag | null };

const TAG_LABEL: Record<BinderItemTag, string> = { FOR_TRADE: "Para Troca", WISHLIST: "Desejo" };
const TAG_BADGE_CLASS: Record<BinderItemTag, string> = {
  FOR_TRADE: "border-amber-400/60 bg-amber-400/90 text-amber-950",
  WISHLIST: "border-violet-400/60 bg-violet-400/90 text-violet-950",
};

const POCKETS_PER_PAGE = 9;

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
          {card.tag ? <Badge className={cn("rounded-none border", TAG_BADGE_CLASS[card.tag])}>{TAG_LABEL[card.tag]}</Badge> : null}
          <a href={`/#/cards/${card.cardModelId || card.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-none border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.16em] text-white nav-hover-soft hover:text-white">
            <ExternalLink className="size-3.5" />Abrir detalhe
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PocketTile({ row, onOpen }: { row: BinderRow | undefined; onOpen: () => void }) {
  if (!row) {
    return <div className="aspect-[63/88] w-full border border-dashed border-white/10 bg-white/[0.015]" />;
  }
  const image = row.imageMediumUrl || row.imageUrl;
  return (
    <button type="button" onClick={onOpen} title={`Ver ${row.namePt || row.name} em tamanho grande`} className="group relative block aspect-[63/88] w-full overflow-hidden border border-white/15 bg-slate-950/60 transition hover:border-primary/50">
      {image ? <img src={image} alt={row.namePt || row.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">{row.namePt || row.name}</div>}
      <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{row.quantity}</span>
      {row.tag ? <span className={cn("absolute inset-x-0 bottom-0 border-t px-1 py-0.5 text-center text-[9px] font-bold uppercase tracking-[0.1em]", TAG_BADGE_CLASS[row.tag])}>{TAG_LABEL[row.tag]}</span> : null}
    </button>
  );
}

function BinderFolio3D({ rows, onOpenCard }: { rows: BinderRow[]; onOpenCard: (index: number) => void }) {
  const [spread, setSpread] = useState(0);
  const [direction, setDirection] = useState(1);

  const pages = useMemo(() => {
    const chunks: BinderRow[][] = [];
    for (let i = 0; i < rows.length; i += POCKETS_PER_PAGE) chunks.push(rows.slice(i, i + POCKETS_PER_PAGE));
    return chunks.length ? chunks : [[]];
  }, [rows]);

  const totalSpreads = Math.ceil(pages.length / 2);
  const leftPage = pages[spread * 2];
  const rightPage = pages[spread * 2 + 1];

  const goTo = (next: number) => {
    if (next < 0 || next >= totalSpreads) return;
    setDirection(next > spread ? 1 : -1);
    setSpread(next);
  };

  const renderPage = (page: BinderRow[] | undefined, side: "left" | "right") => {
    if (!page) return <div className="aspect-[3/4] w-full" />;
    return (
      <div className={cn("grid grid-cols-3 gap-2 border border-white/10 bg-slate-950/80 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.5)]", side === "left" ? "border-r-0" : "border-l-0")}>
        {Array.from({ length: POCKETS_PER_PAGE }).map((_, i) => (
          <PocketTile key={i} row={page[i]} onOpen={() => onOpenCard(rows.indexOf(page[i]))} />
        ))}
        {!page.length ? <p className="col-span-3 py-8 text-center text-xs uppercase tracking-[0.2em] text-slate-600">Página vazia</p> : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-3xl" style={{ perspective: 1800 }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={spread}
            custom={direction}
            initial={{ rotateY: direction * 55, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -direction * 55, opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            style={{ transformStyle: "preserve-3d" }}
            className="grid grid-cols-2 gap-0"
          >
            {renderPage(leftPage, "left")}
            {renderPage(rightPage, "right")}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button type="button" variant="outline" size="sm" className="rounded-none" disabled={spread <= 0} onClick={() => goTo(spread - 1)}><ChevronLeft className="mr-1 size-4" />Página anterior</Button>
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Folhas {spread * 2 + 1}–{Math.min(spread * 2 + 2, pages.length)} de {pages.length}</span>
        <Button type="button" variant="outline" size="sm" className="rounded-none" disabled={spread >= totalSpreads - 1} onClick={() => goTo(spread + 1)}>Próxima página<ChevronRight className="ml-1 size-4" /></Button>
      </div>
    </div>
  );
}

export default function PublicBinderPage() {
  const [, params] = useRoute<{ shareId: string }>("/binder/:shareId");
  const [, navigate] = useLocation();
  const [binder, setBinder] = useState<ApiBinder | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<"grid" | "folio">("grid");
  const [tagFilter, setTagFilter] = useState<BinderItemTag | "ALL">("ALL");

  useEffect(() => {
    if (!params?.shareId) return;
    api.getSharedBinder(params.shareId).then(setBinder).catch(() => navigate("/", { replace: true }));
  }, [params?.shareId, navigate]);

  const rows = useMemo(() => {
    if (!binder) return [];
    return binder.items.map((item) => ({ ...mapApiCard(item.card), quantity: item.quantity, tag: item.tag ?? null }));
  }, [binder]);

  const filteredRows = useMemo(() => (tagFilter === "ALL" ? rows : rows.filter((row) => row.tag === tagFilter)), [rows, tagFilter]);

  const tradeCount = useMemo(() => rows.filter((r) => r.tag === "FOR_TRADE").length, [rows]);
  const wishCount = useMemo(() => rows.filter((r) => r.tag === "WISHLIST").length, [rows]);

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link da pasta copiado.");
    } catch {
      toast.error("Não deu pra copiar automaticamente. Copie a URL da barra de endereço.");
    }
  };

  return (
    <PublicShell breadcrumbs={[{ label: binder?.name || "Pasta compartilhada" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6">
            {!binder ? <p className="text-sm text-slate-300 dark:text-slate-300 light:text-slate-600">Carregando pasta...</p> : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Pasta de coleção pública</p>
                    <h2 className="mt-2 font-heading text-5xl uppercase">{binder.name}</h2>
                    <p className="mt-4 text-sm text-slate-300 dark:text-slate-300 light:text-slate-600">{binder.user?.displayName || "Usuário"}</p>
                  </div>
                  <Button type="button" variant="outline" className="shrink-0 rounded-none" onClick={copyShareLink}><Copy className="mr-2 size-4" />Copiar link</Button>
                </div>
                {binder.description ? <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{binder.description}</p> : null}
              </>
            )}
          </CardContent>
        </Card>

        {binder ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant={tagFilter === "ALL" ? "default" : "outline"} className="rounded-none" onClick={() => setTagFilter("ALL")}>Todas ({rows.length})</Button>
                <Button type="button" size="sm" variant={tagFilter === "FOR_TRADE" ? "default" : "outline"} className="rounded-none" onClick={() => setTagFilter("FOR_TRADE")}><ArrowLeftRight className="mr-1.5 size-3.5" />Para Troca ({tradeCount})</Button>
                <Button type="button" size="sm" variant={tagFilter === "WISHLIST" ? "default" : "outline"} className="rounded-none" onClick={() => setTagFilter("WISHLIST")}><Gift className="mr-1.5 size-3.5" />Desejo ({wishCount})</Button>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant={mode === "grid" ? "default" : "outline"} className="rounded-none" onClick={() => setMode("grid")}><LayoutGrid className="mr-1.5 size-3.5" />Grid</Button>
                <Button type="button" size="sm" variant={mode === "folio" ? "default" : "outline"} className="rounded-none" onClick={() => setMode("folio")}>Fichário 3D</Button>
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma carta com esse filtro.</p>
            ) : mode === "grid" ? (
              <div className="grid grid-cols-5 gap-3 sm:grid-cols-7 xl:grid-cols-9">
                {filteredRows.map((row) => (
                  <div key={row.printId || row.id} className="relative">
                    <PocketTile row={row} onOpen={() => setPreviewIndex(rows.indexOf(row))} />
                  </div>
                ))}
              </div>
            ) : (
              <BinderFolio3D rows={filteredRows} onOpenCard={(index) => setPreviewIndex(rows.indexOf(filteredRows[index]))} />
            )}
          </>
        ) : null}
      </div>
      <CardPreviewModal rows={rows} index={previewIndex} onNavigate={setPreviewIndex} onClose={() => setPreviewIndex(null)} />
    </PublicShell>
  );
}
