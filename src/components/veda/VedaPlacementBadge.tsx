import { Trophy } from "lucide-react";

export interface VedaPlacementBadgeProps {
  placement?: number | null;
  placementLabel?: string | null;
  className?: string;
  showIcon?: boolean;
}

export function VedaPlacementBadge({
  placement,
  placementLabel,
  className = "",
  showIcon = false,
}: VedaPlacementBadgeProps) {
  const label = placementLabel || (placement ? `${placement}º` : "—");
  const isWinner = placement === 1 || label.startsWith("1");
  const isSecond = placement === 2 || label.startsWith("2");
  const isTop4 = (placement !== null && placement !== undefined && placement <= 4) || label.includes("4");
  const isTop8 = (placement !== null && placement !== undefined && placement <= 8) || label.includes("8");

  let colorClasses = "border-white/15 bg-white/5 text-slate-300";
  if (isWinner) {
    colorClasses = "border-amber-400/60 bg-amber-400/15 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.25)] font-bold";
  } else if (isSecond) {
    colorClasses = "border-slate-300/50 bg-slate-300/10 text-slate-200 font-semibold";
  } else if (isTop4) {
    colorClasses = "border-amber-600/50 bg-amber-600/10 text-amber-200";
  } else if (isTop8) {
    colorClasses = "border-primary/40 bg-primary/10 text-primary";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono uppercase tracking-wider border rounded-none ${colorClasses} ${className}`}
    >
      {showIcon && isWinner && <Trophy className="size-3 text-amber-400 shrink-0" />}
      <span>{label}</span>
    </span>
  );
}
