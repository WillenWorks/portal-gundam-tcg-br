import { normalizeDeckColors, resolveGameColorHex, resolveGameColorLabelPt } from "@/lib/gundam-catalog";
import type { GameColor } from "@/lib/veda/types";

export interface VedaColorPillsProps {
  colors?: GameColor[] | string[];
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

export function VedaColorPills({
  colors = [],
  size = "sm",
  showLabel = false,
  className = "",
}: VedaColorPillsProps) {
  const normalized = normalizeDeckColors(colors);
  if (normalized.length === 0) return null;

  const dotSizeClass = size === "xs" ? "size-2.5" : size === "md" ? "size-3.5" : "size-3";
  const textSizeClass = size === "xs" ? "text-[10px]" : size === "md" ? "text-xs" : "text-[11px]";

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {normalized.map((color, idx) => {
        const hex = resolveGameColorHex(color);
        const label = resolveGameColorLabelPt(color) || color;

        return (
          <span
            key={`${color}-${idx}`}
            className={`inline-flex items-center gap-1 font-mono uppercase ${textSizeClass} text-slate-700 dark:text-slate-300`}
            title={`Cor: ${label}`}
          >
            <span
              className={`rounded-full shrink-0 ${dotSizeClass} border border-slate-400/80 dark:border-white/40 shadow-[0_0_6px_rgba(0,0,0,0.45)]`}
              style={{ backgroundColor: hex }}
            />
            {showLabel && <span>{label}</span>}
          </span>
        );
      })}
    </div>
  );
}
