import { GAME_COLOR_HEX, GAME_COLOR_LABEL_PT } from "@/lib/gundam-catalog";
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
  if (!colors || colors.length === 0) return null;

  const dotSizeClass = size === "xs" ? "size-2" : size === "md" ? "size-3.5" : "size-2.5";
  const textSizeClass = size === "xs" ? "text-[10px]" : size === "md" ? "text-xs" : "text-[11px]";

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {colors.map((color, idx) => {
        const hex = GAME_COLOR_HEX[color] || "#94a3b8";
        const label = GAME_COLOR_LABEL_PT[color] || color;

        return (
          <span
            key={`${color}-${idx}`}
            className={`inline-flex items-center gap-1 font-mono uppercase ${textSizeClass} text-slate-700 dark:text-slate-300`}
            title={`Cor: ${label}`}
          >
            <span
              className={`rounded-full shrink-0 ${dotSizeClass} shadow-[0_0_6px_rgba(0,0,0,0.5)]`}
              style={{ backgroundColor: hex }}
            />
            {showLabel && <span>{label}</span>}
          </span>
        );
      })}
    </div>
  );
}
