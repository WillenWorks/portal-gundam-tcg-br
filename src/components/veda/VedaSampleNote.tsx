import { AlertTriangle, Database } from "lucide-react";
import type { VedaSample } from "@/lib/veda/types";

function formatDatePtBr(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return null;
  }
}

function formatPeriod(start?: string | null, end?: string | null): string | null {
  const s = formatDatePtBr(start);
  const e = formatDatePtBr(end);
  if (s && e) {
    if (s === e) return `em ${s}`;
    return `de ${s} a ${e}`;
  }
  if (s) return `a partir de ${s}`;
  if (e) return `até ${e}`;
  return null;
}

export interface VedaSampleNoteProps {
  sample?: VedaSample | null;
  totalLists?: number;
  totalTournaments?: number;
  from?: string | null;
  to?: string | null;
  isSmall?: boolean;
  labelPrefix?: string;
  variant?: "inline" | "badge" | "banner";
  className?: string;
}

export function VedaSampleNote({
  sample,
  totalLists: directLists,
  totalTournaments: directTournaments,
  from: directFrom,
  to: directTo,
  isSmall: directSmall,
  labelPrefix = "Baseado em",
  variant = "inline",
  className = "",
}: VedaSampleNoteProps) {
  const lists = sample?.lists ?? directLists ?? 0;
  const tournaments = sample?.tournaments ?? directTournaments ?? 0;
  const from = sample?.from ?? directFrom ?? null;
  const to = sample?.to ?? directTo ?? null;
  const isSmall = sample?.small ?? directSmall ?? lists < 10;
  const periodText = formatPeriod(from, to);

  const listsLabel = `${lists} ${lists === 1 ? "lista" : "listas"}`;
  const tourneysLabel = `${tournaments} ${tournaments === 1 ? "torneio" : "torneios"}`;
  const periodPart = periodText ? ` (${periodText})` : "";
  const summaryText = `${labelPrefix} ${listsLabel} de ${tourneysLabel}${periodPart}`;

  if (variant === "badge") {
    return (
      <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
        <span className="inline-flex items-center gap-1 rounded-none border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-mono text-primary uppercase tracking-wider">
          <Database className="size-3 text-primary" />
          <span>{summaryText}</span>
        </span>
        {isSmall && (
          <span className="inline-flex items-center gap-1 rounded-none border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400 uppercase tracking-wider">
            <AlertTriangle className="size-3 text-amber-400" />
            Poucos dados (&lt;10)
          </span>
        )}
      </div>
    );
  }

  if (variant === "banner") {
    return (
      <div className={`panel-cut border border-primary/20 bg-slate-950/70 p-3 text-xs ${className}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-300">
            <Database className="size-3.5 shrink-0 text-primary" />
            <span className="font-mono text-slate-200">{summaryText}</span>
          </div>
          {isSmall && (
            <span className="inline-flex items-center gap-1 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400 uppercase tracking-wider">
              <AlertTriangle className="size-3 text-amber-400" />
              Amostra preliminar (menos de 10 listas registradas)
            </span>
          )}
        </div>
      </div>
    );
  }

  // default: inline
  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs text-slate-300 ${className}`}>
      <span className="inline-flex items-center gap-1.5 font-mono">
        <Database className="size-3 text-primary shrink-0" />
        <span>{summaryText}</span>
      </span>
      {isSmall && (
        <span
          title="Menos de 10 listas registradas neste recorte: índices podem oscilar com novos eventos"
          className="inline-flex items-center gap-1 rounded-none border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.2 text-[10px] font-mono text-amber-400 uppercase tracking-wider"
        >
          <AlertTriangle className="size-2.5 text-amber-400 shrink-0" />
          poucos dados
        </span>
      )}
    </div>
  );
}
