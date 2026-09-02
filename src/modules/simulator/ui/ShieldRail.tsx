/* Fase C (docs/19) — trilha horizontal de pips de Shield (substitui a pilha
 * sobreposta do ShieldStack). Sem versos, sem stack: é só a leitura da
 * contagem. Pip cheio = glifo de escudo preenchido; pip vazio = contorno
 * tracejado. O número grande fica sempre visível ao lado e vira vermelho em
 * `count <= 2`, com um aviso hairline quando o lethal está a 1 golpe.
 *
 * `selectable` (ex.: efeito que mira uma shield): cada pip CHEIO vira um
 * <button> com hit-area >= 44px, mesmo com o glifo pequeno. */
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
}

export function ShieldRail({
  count,
  max = 6,
  selectable,
  selectedIndexes = [],
  onSelectIndex,
  justBroken,
}: ShieldRailProps) {
  const total = Math.max(max, count);
  const low = count <= 2;
  const pips = Array.from({ length: total }, (_, i) => i < count);

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "font-mono text-lg font-black leading-none tabular-nums",
            low ? "text-red-400" : "text-slate-200",
          )}
        >
          {count}
        </span>
        <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">Shields</span>
        <div
          className={cn(
            "flex items-center gap-0.5 rounded-none",
            justBroken && "ring-1 ring-red-500/60",
          )}
          role="list"
          aria-label={`${count} de ${total} shields`}
        >
          {pips.map((full, i) => {
            const selected = selectedIndexes.includes(i);
            const pickable = Boolean(selectable && full && onSelectIndex);
            const pip = (
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
                className="flex size-11 items-center justify-center rounded-none hover:bg-white/5"
              >
                {pip}
              </button>
            ) : (
              <span key={i} role="listitem">
                {pip}
              </span>
            );
          })}
        </div>
      </div>
      {count === 1 ? (
        <p className="text-[8px] font-semibold uppercase tracking-wide text-red-400">1 golpe do lethal</p>
      ) : count === 0 ? (
        <p className="text-[8px] font-semibold uppercase tracking-wide text-red-400">sem shields — dano direto</p>
      ) : null}
    </div>
  );
}
