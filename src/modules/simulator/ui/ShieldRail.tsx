/* Fase C (docs/19) — trilha de Shields.
 *
 * Sprint 5 (refinamento Arena 3D) — SEM textos redundantes ("6 SHIELDS", o
 * número grande, os avisos de lethal): a contagem se lê pelas próprias peças.
 * `title` carrega a informação como tooltip.
 *  - vertical: 6 versos de carta em CASCATA sobreposta, de cima pra baixo
 *    (topologia Mobile Suit Arena). Peça viva = moldura ciano; quebrada =
 *    fantasma tracejado; `count <= 2` tinge as vivas de vermelho.
 *  - horizontal: glifos de escudo em linha (mantém o formato antigo pros
 *    callers que não pedem orientação).
 *
 * `selectable` (efeito que mira uma shield): cada peça VIVA vira <button> com
 * hit-area >= 44px. */
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShieldRailProps {
  count: number;
  max?: number;
  selectable?: boolean;
  selectedIndexes?: number[];
  onSelectIndex?: (index: number) => void;
  /** realce transitório de dano recém-tomado (o pai controla por quanto tempo). */
  justBroken?: boolean;
  /** "vertical" = cascata na coluna lateral; "horizontal" (padrão) = linha de glifos. */
  orientation?: "horizontal" | "vertical";
}

export function ShieldRail({
  count,
  max = 6,
  selectable,
  selectedIndexes = [],
  onSelectIndex,
  justBroken,
  orientation = "horizontal",
}: ShieldRailProps) {
  const total = Math.max(max, count);
  const low = count <= 2;
  const vertical = orientation === "vertical";
  const label = `${count} de ${total} shields${count <= 1 ? " — lethal a 1 golpe" : ""}`;

  return (
    <div
      role="list"
      aria-label={label}
      title={label}
      className={cn(
        "rounded-none",
        vertical ? "flex flex-col items-center" : "flex items-center gap-0.5",
        justBroken && "ring-1 ring-red-500/60",
      )}
    >
      {Array.from({ length: total }, (_, i) => {
        const full = i < count;
        const selected = selectedIndexes.includes(i);
        const pickable = Boolean(selectable && full && onSelectIndex);
        const cascade = vertical && i > 0 ? "-mt-[calc(var(--card,3.5rem)*0.62)]" : undefined;

        const piece = vertical ? (
          <span
            className={cn(
              "block aspect-[63/88] w-[calc(var(--card,3.5rem)*0.62)] border transition-colors duration-100 motion-reduce:transition-none",
              full
                ? selected
                  ? "border-emerald-400 bg-emerald-500/30"
                  : low
                    ? "border-red-500/70 bg-red-500/10"
                    : "border-primary/60 bg-primary/15"
                : "border-dashed border-white/12 bg-transparent",
            )}
          />
        ) : (
          <span
            className={cn(
              "flex size-3.5 items-center justify-center border transition-colors duration-100 motion-reduce:transition-none",
              full
                ? selected
                  ? "border-emerald-400 bg-emerald-500/30 text-emerald-300"
                  : low
                    ? "border-red-500/70 text-red-400"
                    : "border-primary/50 text-primary"
                : "border-dashed border-white/15 text-transparent",
            )}
          >
            <Shield className="size-2.5" aria-hidden fill={full ? "currentColor" : "none"} />
          </span>
        );

        return pickable ? (
          <button
            key={i}
            type="button"
            onClick={() => onSelectIndex?.(i)}
            aria-pressed={selected}
            aria-label={`Shield ${i + 1}`}
            className={cn(
              "relative flex items-center justify-center rounded-none hover:brightness-125",
              vertical ? "min-h-11 w-full" : "size-11",
              cascade,
            )}
          >
            {piece}
          </button>
        ) : (
          <span key={i} role="listitem" className={cn(vertical && "flex w-full justify-center", cascade)}>
            {piece}
          </span>
        );
      })}
    </div>
  );
}
