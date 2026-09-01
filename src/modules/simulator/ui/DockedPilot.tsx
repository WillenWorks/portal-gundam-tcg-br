/* docs/19, Sessão 3 — Piloto "acoplado" (docking) visualmente na base da
 * Unit pareada. Badge LINK dourado brilhante quando a Link Condition
 * (Comprehensive Rules 3-2-6) está satisfeita. */
import { cn } from "@/lib/utils";
import type { CardInstance } from "@/modules/simulator/engine/types";
import { satisfiesLinkCondition } from "@/modules/simulator/engine/types";
import { artSrc, type ArtLookup } from "./cardArt";

interface DockedPilotProps {
  pilot: CardInstance;
  unit: CardInstance;
  art: ArtLookup;
  onInspect?: (card: CardInstance) => void;
}

export function DockedPilot({ pilot, unit, art, onInspect }: DockedPilotProps) {
  const linked = satisfiesLinkCondition(pilot.def, unit.def);
  const src = artSrc(art, pilot.def.code, "xs");

  return (
    <button
      type="button"
      onClick={onInspect ? () => onInspect(pilot) : undefined}
      className={cn(
        "group/pilot flex w-full items-center gap-1 border-t px-1 py-0.5 text-left",
        linked ? "border-amber-400/70 bg-amber-500/15" : "border-white/10 bg-black/50",
      )}
    >
      <span className="size-4 shrink-0 overflow-hidden rounded-full border border-white/20 bg-black/40">
        {src ? <img src={src} alt={pilot.def.nameEn} className="h-full w-full object-cover" /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate text-[8px] font-medium text-slate-200">{pilot.def.nameEn}</span>
      {linked ? (
        <span className="shrink-0 animate-pulse rounded-none bg-amber-400 px-1 text-[7px] font-black uppercase tracking-wide text-black shadow-[0_0_8px_rgba(251,191,36,0.6)]">
          Link
        </span>
      ) : (
        <span className="shrink-0 rounded-none bg-white/15 px-1 text-[7px] font-bold uppercase text-slate-300">Pair</span>
      )}
    </button>
  );
}
