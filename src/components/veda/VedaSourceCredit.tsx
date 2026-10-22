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
  const isDigilab = source?.id === "digilab" || Boolean(url && url.includes("digilab"));
  const isEgman = source?.id === "egman" || Boolean(url && url.includes("egmanevents"));

  const sourceLabel = isDigilab
    ? compact
      ? "DigiLab"
      : "Fonte: DigiLab"
    : isEgman
      ? compact
        ? "Egman Events"
        : "Fonte: Egman Events"
      : source?.name
        ? compact
          ? source.name
          : `Fonte: ${source.name}`
        : source?.attribution || "Reportado no AnaheimHub";

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 hover:text-primary transition-colors ${className}`}
        title={`Abrir página analisada da fonte: ${url}`}
      >
        <span>{sourceLabel}</span>
        <ExternalLink className="size-3 shrink-0" />
      </a>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 ${className}`}
    >
      <span>{sourceLabel}</span>
    </span>
  );
}
