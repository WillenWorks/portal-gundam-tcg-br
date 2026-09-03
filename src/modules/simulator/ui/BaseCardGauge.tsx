/* docs/19, Sessão 3 — moldura de Base com barra de integridade (HP restante /
 * HP efetivo) e badge de EX Base. Alvo legal realçado em verde/dourado. */
import { cn } from "@/lib/utils";
import type { CardInstance } from "@/modules/simulator/engine/types";
import { effectiveHp } from "@/modules/simulator/engine/types";
import type { ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";

interface BaseCardGaugeProps {
  base: CardInstance | null;
  art: ArtLookup;
  legalTarget?: boolean;
  selected?: boolean;
  onSelect?: (base: CardInstance) => void;
  onInspect?: (card: CardInstance) => void;
  /** hover / foco na Base (ou `null` ao sair) — alimenta o inspetor lateral (Sprint 3). */
  onHoverCard?: (card: CardInstance | null) => void;
}

export function BaseCardGauge({ base, art, legalTarget, selected, onSelect, onInspect, onHoverCard }: BaseCardGaugeProps) {
  if (!base) {
    return (
      <div>
        <p className="mb-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">Base</p>
        <div className="flex aspect-[63/88] w-11 items-center justify-center border border-dashed border-white/10 text-[8px] uppercase text-slate-600">
          sem base
        </div>
      </div>
    );
  }

  const maxHp = effectiveHp(base);
  const remaining = Math.max(0, maxHp - base.damage);
  const pct = maxHp > 0 ? Math.round((remaining / maxHp) * 100) : 0;

  return (
    <div>
      <p className="mb-0.5 flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Base {base.def.isToken ? <span className="rounded-none bg-amber-400 px-1 text-[7px] font-black text-black">EX</span> : null}
      </p>
      <button
        type="button"
        onClick={() => (legalTarget && onSelect ? onSelect(base) : onInspect?.(base))}
        onMouseEnter={onHoverCard ? () => onHoverCard(base) : undefined}
        onMouseLeave={onHoverCard ? () => onHoverCard(null) : undefined}
        onFocus={onHoverCard ? () => onHoverCard(base) : undefined}
        onBlur={onHoverCard ? () => onHoverCard(null) : undefined}
        className={cn(
          "relative block w-11 border",
          legalTarget
            ? "border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]"
            : selected
              ? "border-primary"
              : "border-amber-500/25",
        )}
      >
        <CardFace nameEn={base.def.nameEn} code={base.def.code} art={art} size="sm" className="w-full" />
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/70">
          <div
            className={cn("h-full", pct > 50 ? "bg-emerald-500" : pct > 25 ? "bg-amber-500" : "bg-red-500")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="absolute right-0.5 top-0.5 rounded-none bg-black/75 px-1 text-[7px] font-bold text-white">
          {remaining}/{maxHp}
        </span>
      </button>
    </div>
  );
}
