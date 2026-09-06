/* Deck compartilhado v8 — leitura pública com estatísticas rápidas e lista estruturada. */
import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { ChevronLeft, ChevronRight, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { api, mapApiCard, type ApiDeck } from "@/lib/api";
import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FeaturedCoverImage } from "@/components/deck/FeaturedCoverImage";
import { DECK_MAIN_SIZE, DECK_RESOURCE_SIZE, NON_COUNTED_SECTIONS } from "@/lib/deck-legality";

type DeckRow = ReturnType<typeof mapApiCard> & { quantity: number };

function ReadOnlyCardTile({ row, onPreview }: { row: DeckRow; onPreview: () => void }) {
  const image = row.imageMediumUrl || row.imageUrl;
  return (
    <button type="button" onClick={onPreview} title={`Ver ${row.namePt || row.name} em tamanho grande`} className="group relative block aspect-[63/88] w-full overflow-hidden border border-white/15 transition hover:border-primary/50">
      {image ? <img src={image} alt={row.namePt || row.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-slate-950/80 p-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">{row.namePt || row.name}</div>}
      <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{row.quantity}</span>
      <div className="absolute inset-x-0 bottom-0 translate-y-full bg-slate-950/95 p-1.5 text-left opacity-0 transition duration-150 group-hover:translate-y-0 group-hover:opacity-100">
        <p className="truncate text-[11px] font-medium text-white">{row.namePt || row.name}</p>
      </div>
    </button>
  );
}

/** Modal vira carrossel — setas nas bordas da imagem (não cobrem o meio), navega entre
 *  todas as cartas visíveis (principal + recursos, na ordem exibida na tela) sem fechar
 *  e reabrir. Seta de teclado também funciona, ajuda quem está no desktop. Quantidade
 *  fica no texto abaixo da imagem, de propósito fora da arte. */
function CardPreviewModal({ rows, index, onNavigate, onClose }: { rows: DeckRow[]; index: number | null; onNavigate: (index: number) => void; onClose: () => void }) {
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
          <p className="text-sm text-slate-400">{card.quantity}x nesse deck{rows.length > 1 ? ` · ${index + 1}/${rows.length}` : ""}</p>
          <a href={`/#/cards/${card.cardModelId || card.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-none border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.16em] text-white nav-hover-soft hover:text-white">
            <ExternalLink className="size-3.5" />Abrir detalhe
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SharedDeckPage() {
  const [, params] = useRoute<{ shareId: string }>("/deck/:shareId");
  const [deck, setDeck] = useState<ApiDeck | null>(null);
  const [error, setError] = useState("");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!params?.shareId) return;
    api.getSharedDeck(params.shareId).then(setDeck).catch((err) => setError(err.message));
  }, [params?.shareId]);

  const allRows = useMemo(() => {
    if (!deck) return [];
    return deck.items.map((item) => {
      const card = item.card ? mapApiCard(item.card) : null;
      return card ? { ...card, quantity: item.quantity, section: item.section || "main" } : null;
    }).filter(Boolean) as Array<ReturnType<typeof mapApiCard> & { quantity: number; section: string }>;
  }, [deck]);

  const mainRows = useMemo(() => allRows.filter((row) => row.section !== "resource" && !NON_COUNTED_SECTIONS.has(row.section)), [allRows]);
  const resourceRows = useMemo(() => allRows.filter((row) => row.section === "resource"), [allRows]);

  const exportDecklist = async () => {
    const text = [...mainRows, ...resourceRows].map((row) => `${row.quantity}x ${row.code}`).join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("Decklist copiada (formato MSA/Exburst).");
  };
  const visibleRows = useMemo(() => [...mainRows, ...resourceRows], [mainRows, resourceRows]);

  const stats = useMemo(() => {
    const total = mainRows.reduce((sum, item) => sum + item.quantity, 0);
    const avgCost = total ? mainRows.reduce((sum, item) => sum + item.cost * item.quantity, 0) / total : 0;
    return { total, avgCost: avgCost.toFixed(2), unique: mainRows.length + resourceRows.length };
  }, [mainRows, resourceRows]);

  return (
    <PublicShell title={deck?.name || "Deck compartilhado"} description="Versão pública estática para estudo da lista, sem abrir o modo de edição do dashboard.">
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface overflow-hidden">
          {deck ? (
            <div className="h-40 w-full overflow-hidden border-b border-white/10">
              {deck.coverImage ? <img src={deck.coverImage} alt={deck.name} className="h-full w-full object-cover" /> : <FeaturedCoverImage cards={deck.featuredCards} />}
            </div>
          ) : null}
          <CardContent className="p-6">
            {error ? <p className="text-sm text-red-300">{error}</p> : !deck ? <p className="text-sm text-slate-300 dark:text-slate-300 light:text-slate-600">Carregando deck compartilhado...</p> : (
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Share link público</p>
                  <p className="mt-3 text-sm text-slate-300 dark:text-slate-300 light:text-slate-600">Owner: {deck.user?.displayName || "Usuário"}</p>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{deck.notes || "Sem notas públicas."}</p>
                </div>
                <div className="flex flex-col items-start gap-3 sm:items-end">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{stats.total} cartas</Badge>
                    <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{stats.unique} únicas</Badge>
                    <Badge className="rounded-none border border-white/15 bg-white/5 dark:text-slate-200 light:text-slate-700">curva {stats.avgCost}</Badge>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={exportDecklist}><Copy className="mr-2 size-3.5" />Exportar</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-heading text-3xl uppercase">Deck principal</h3>
              <Badge variant="outline" className="rounded-none border-white/20 text-soft">{stats.total}/{DECK_MAIN_SIZE}</Badge>
            </div>
            <div className="mt-6 grid grid-cols-5 gap-3 sm:grid-cols-7 xl:grid-cols-9">
              {mainRows.map((row) => <ReadOnlyCardTile key={`${row.id}-main`} row={row} onPreview={() => setPreviewIndex(visibleRows.findIndex((r) => r === row))} />)}
            </div>
          </CardContent>
        </Card>

        {resourceRows.length ? (
          <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-heading text-3xl uppercase">Deck de recursos</h3>
                <Badge variant="outline" className="rounded-none border-white/20 text-soft">{resourceRows.reduce((sum, r) => sum + r.quantity, 0)}/{DECK_RESOURCE_SIZE}</Badge>
              </div>
              <div className="mt-6 grid grid-cols-5 gap-3 sm:grid-cols-7 xl:grid-cols-9">
                {resourceRows.map((row) => <ReadOnlyCardTile key={`${row.id}-resource`} row={row} onPreview={() => setPreviewIndex(visibleRows.findIndex((r) => r === row))} />)}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
      <CardPreviewModal rows={visibleRows} index={previewIndex} onNavigate={setPreviewIndex} onClose={() => setPreviewIndex(null)} />
    </PublicShell>
  );
}
