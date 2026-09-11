import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export interface StatDetailRow {
  id: string;
  code: string;
  name: string;
  namePt?: string | null;
  imageUrl?: string | null;
  imageMediumUrl?: string | null;
  imageLargeUrl?: string | null;
  quantity: number;
  color?: string | null;
  printId?: string;
}

interface StatDetailModalProps {
  title: { label: string; value: string } | null;
  rows: StatDetailRow[];
  onClose: () => void;
  onPreviewCard: (card: StatDetailRow) => void;
}

export function StatDetailModal({ title, rows, onClose, onPreviewCard }: StatDetailModalProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  if (!title) return null;
  const total = rows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-2xl max-h-[85vh] overflow-y-auto border-white/10 bg-slate-950 text-white panel-cut">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{title.label}</p>
            <DialogTitle className="font-heading text-2xl uppercase heading-portal">{title.value}</DialogTitle>
            <p className="mt-1 text-xs text-slate-400 font-mono">
              {rows.length} carta(s) única(s) · {total} cópia(s) no total
            </p>
          </div>
          <div className="flex border border-white/15">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition ${
                viewMode === "grid" ? "bg-primary text-primary-foreground font-semibold" : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              Imagens
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition ${
                viewMode === "list" ? "bg-primary text-primary-foreground font-semibold" : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              Lista
            </button>
          </div>
        </div>

        {!rows.length ? (
          <p className="py-8 text-center text-sm text-muted-portal">Nenhuma carta encontrada para este filtro.</p>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 pt-2">
            {rows.map((row) => {
              const image = row.imageMediumUrl || row.imageUrl;
              return (
                <button
                  key={row.printId || row.id}
                  type="button"
                  onClick={() => onPreviewCard(row)}
                  className="group relative block aspect-[63/88] overflow-hidden border border-white/15 transition hover:border-primary hover:scale-[1.02]"
                >
                  {image ? (
                    <img src={image} alt={row.namePt || row.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-slate-900 p-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      {row.namePt || row.name}
                    </div>
                  )}
                  <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-none bg-primary text-[11px] font-bold text-primary-foreground shadow">
                    {row.quantity}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2 pt-2">
            {rows.map((row) => {
              const image = row.imageMediumUrl || row.imageUrl;
              return (
                <button
                  key={row.printId || row.id}
                  type="button"
                  onClick={() => onPreviewCard(row)}
                  className="flex w-full items-center gap-3 border border-white/10 bg-white/5 p-2 text-left transition hover:border-primary/40 hover:bg-white/10"
                >
                  <div className="h-14 w-10 shrink-0 overflow-hidden border border-white/10 bg-slate-900">
                    {image ? <img src={image} alt={row.namePt || row.name} className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium heading-portal">{row.namePt || row.name}</p>
                    <p className="text-xs font-mono text-slate-400">
                      {row.code} {row.color ? `· ${row.color}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-mono text-primary font-bold">{row.quantity}x</span>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
