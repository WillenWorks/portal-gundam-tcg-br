/* Fase C (docs/19) — contador compacto.
 *  - `variant="chip"` (padrão): número grande em mono, cor carrega o estado
 *    (âmbar = aviso, vermelho = crítico). Vira <button> com alvo >= 44px quando
 *    recebe `onClick`. Reusado pelo PileTray como gatilho da bandeja.
 *  - `variant="stack"` (Sprint 5): pilha visual (verso de carta / última carta)
 *    com o número num badge de canto — SEM texto "DECK 38". `hideCount` esconde
 *    o número (deck do oponente = segredo de jogo). `title`/`aria-label`
 *    carregam a leitura como tooltip. */
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CounterChipTone = "normal" | "warn" | "crit";

interface CounterChipProps {
  label: string;
  count: number;
  tone?: CounterChipTone;
  icon?: LucideIcon;
  onClick?: () => void;
  variant?: "chip" | "stack";
  /** só `variant="stack"`: conteúdo da pilha (verso / última carta). Default: verso genérico. */
  face?: ReactNode;
  /** só `variant="stack"`: esconde o número (ex.: deck do oponente). */
  hideCount?: boolean;
}

const TONE_CLASS: Record<CounterChipTone, string> = {
  normal: "border-white/15 text-slate-200",
  warn: "border-amber-400/70 text-amber-300",
  crit: "border-red-500/70 text-red-400",
};
const TONE_BADGE: Record<CounterChipTone, string> = {
  normal: "border-white/20 text-slate-100",
  warn: "border-amber-400/70 text-amber-200",
  crit: "border-red-500/70 text-red-300",
};

const STACK_WIDTH = "w-[calc(var(--card,3.5rem)*0.62)]";

export function CounterChip({
  label,
  count,
  tone = "normal",
  icon: Icon,
  onClick,
  variant = "chip",
  face,
  hideCount,
}: CounterChipProps) {
  const readout = hideCount ? label : `${label}: ${count}`;

  if (variant === "stack") {
    const inner = (
      <>
        {/* camadas de profundidade */}
        <span className="absolute inset-0 translate-x-[3px] translate-y-[3px] border border-white/5 bg-slate-950" aria-hidden />
        <span className="absolute inset-0 translate-x-[1.5px] translate-y-[1.5px] border border-white/10 bg-slate-950" aria-hidden />
        <span className="relative block aspect-[63/88] w-full overflow-hidden border border-white/15 bg-gradient-to-br from-slate-800 via-slate-900 to-black">
          {face ?? <span className="absolute left-1/2 top-1/2 size-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20 bg-primary/5" />}
        </span>
        {!hideCount ? (
          <span
            className={cn(
              "absolute -right-1 -top-1 rounded-none border bg-slate-950 px-1 font-mono text-[10px] font-black leading-tight tabular-nums",
              TONE_BADGE[tone],
            )}
          >
            {count}
          </span>
        ) : null}
      </>
    );
    return onClick ? (
      <button
        type="button"
        onClick={onClick}
        title={readout}
        aria-label={readout}
        className={cn("relative block min-h-11 min-w-11 rounded-none transition-[filter] duration-100 hover:brightness-125 motion-reduce:transition-none", STACK_WIDTH)}
      >
        {inner}
      </button>
    ) : (
      <span title={readout} aria-label={readout} className={cn("relative block", STACK_WIDTH)}>
        {inner}
      </span>
    );
  }

  const body = (
    <>
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      <span className="text-[8px] font-semibold uppercase tracking-[0.16em]">{label}</span>
      <span className="font-mono text-base font-black leading-none tabular-nums">{count}</span>
    </>
  );

  const base = cn("inline-flex items-center gap-1.5 rounded-none border bg-black/40 px-2 py-1", TONE_CLASS[tone]);

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`${label}: ${count}`}
        className={cn(
          base,
          "min-h-11 min-w-11 justify-center transition-colors duration-100 hover:border-primary/70 motion-reduce:transition-none",
        )}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={base} aria-label={`${label}: ${count}`}>
      {body}
    </div>
  );
}
