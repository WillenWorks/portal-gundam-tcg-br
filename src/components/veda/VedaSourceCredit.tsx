import { ExternalLink } from "lucide-react";
import type { VedaSource } from "@/lib/veda/types";

export interface VedaSourceCreditProps {
  source?: VedaSource | null;
  sourceUrl?: string | null;
  className?: string;
  compact?: boolean;
}

export function VedaSourceCredit({
  source,
  sourceUrl,
  className = "",
  compact = false,
}: VedaSourceCreditProps) {
  if (!source && !sourceUrl) return null;

  const url = sourceUrl || source?.url || null;
  const isDigilab = source?.id === "digilab" || (url && url.includes("digilab"));
  const defaultAttribution = isDigilab
    ? "Dados: DigiLab (digilab.cards)"
    : source?.id === "egman"
      ? "Fonte: Egman Events"
      : source?.attribution || "Dados de Torneio";

  const attributionText = source?.attribution || defaultAttribution;

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 font-mono text-[11px] text-slate-400 hover:text-primary transition-colors ${className}`}
        title={`Abrir página oficial da fonte: ${url}`}
      >
        <span>{attributionText}</span>
        <ExternalLink className="size-3 shrink-0" />
      </a>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[11px] text-slate-400 ${className}`}
    >
      <span>{attributionText}</span>
    </span>
  );
}
