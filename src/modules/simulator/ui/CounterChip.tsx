/* Fase C (docs/19) — chip compacto de contador. Número grande em mono; a
 * forma/cor carrega o estado (âmbar = aviso, vermelho = crítico). Vira
 * <button> com alvo de toque >= 44px quando recebe `onClick`; sem `onClick`
 * é só leitura. Reusado pelo PileTray como gatilho da bandeja. */
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CounterChipTone = "normal" | "warn" | "crit";

interface CounterChipProps {
  label: string;
  count: number;
  tone?: CounterChipTone;
  icon?: LucideIcon;
  onClick?: () => void;
}

const TONE_CLASS: Record<CounterChipTone, string> = {
  normal: "border-white/15 text-slate-200",
  warn: "border-amber-400/70 text-amber-300",
  crit: "border-red-500/70 text-red-400",
};

export function CounterChip({ label, count, tone = "normal", icon: Icon, onClick }: CounterChipProps) {
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
