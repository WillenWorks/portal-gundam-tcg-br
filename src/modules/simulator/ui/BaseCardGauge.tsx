/* docs/19, Sessão 3 — moldura de Base com barra de integridade.
 *
 * Sprint 5 (refinamento Arena 3D) — sem rótulos ("BASE", "BASE EX", "3/3 EX
 * BASE"): a carta + a barra de HP + o número de dano sobreposto contam tudo.
 * EX Base = moldura dourada (`--accent`). `title`/`aria-label` carregam a
 * leitura textual como tooltip. Alvo legal realçado em verde. */
import { cn } from "@/lib/utils";
import type { CardInstance } from "@/modules/simulator/engine/types";
import { effectiveHp } from "@/modules/simulator/engine/types";
import { isGenericArtCard, type ArtLookup } from "./cardArt";
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

const WIDTH = "w-[calc(var(--card-w,3.5rem)*0.62)]";

export function BaseCardGauge({ base, art, legalTarget, selected, onSelect, onInspect, onHoverCard }: BaseCardGaugeProps) {
  if (!base) {
    return (
      <div
        title="Base: nenhuma em jogo"
        aria-label="Base: nenhuma em jogo"
        className={cn("aspect-[63/88] border border-dashed border-white/10 bg-white/[0.015]", WIDTH)}
      />
    );
  }

  const maxHp = effectiveHp(base);
  const remaining = Math.max(0, maxHp - base.damage);
  const pct = maxHp > 0 ? Math.round((remaining / maxHp) * 100) : 0;
  const isEx = base.def.isToken ?? false;
  const title = `Base${isEx ? " EX" : ""} · ${remaining}/${maxHp} HP${base.damage > 0 ? ` · ${base.damage} de dano` : ""}`;

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() => (legalTarget && onSelect ? onSelect(base) : onInspect?.(base))}
      onMouseEnter={onHoverCard ? () => onHoverCard(base) : undefined}
      onMouseLeave={onHoverCard ? () => onHoverCard(null) : undefined}
      onFocus={onHoverCard ? () => onHoverCard(base) : undefined}
      onBlur={onHoverCard ? () => onHoverCard(null) : undefined}
      className={cn(
        "relative block border",
        WIDTH,
        legalTarget
          ? "border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]"
          : selected
            ? "border-primary"
            : isEx
              ? "border-accent/60"
              : "border-amber-500/25",
      )}
    >
      <CardFace
        nameEn={base.def.nameEn}
        code={base.def.code}
        art={art}
        size="sm"
        className="w-full"
        backFallback={isGenericArtCard(base.def.cardType, base.def.isToken)}
      />
      {base.damage > 0 ? (
        <span className="absolute right-0 top-0 z-10 bg-red-600/95 px-1 py-0.5 text-[8px] font-black tabular-nums text-white">
          -{base.damage}
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/70">
        <div
          className={cn("h-full transition-all duration-150 motion-reduce:transition-none", pct > 50 ? "bg-emerald-500" : pct > 25 ? "bg-amber-500" : "bg-red-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}
