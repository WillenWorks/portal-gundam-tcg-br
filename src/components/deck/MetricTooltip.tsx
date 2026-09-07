/* Ícone "?" ao lado de uma métrica — clique abre uma explicação curta em pt-BR:
 * o que o número é e como lê-lo. Clique (não hover) de propósito: hover não existe
 * em touch. Acessível: o botão referencia o texto por aria-describedby e a dica tem
 * role="tooltip"; o marcador data-metric permite auditar a cobertura na tela. */
import { useEffect, useId, useRef, useState } from "react";

export type MetricTooltipProps = {
  /** Identificador estável da métrica — vira o atributo data-metric, usado pelo
   *  teste de cobertura pra garantir que todo número da tela tem explicação. */
  metric: string;
  /** O que o número representa. Frase curta, sem jargão. */
  what: string;
  /** Como interpretar o número (o que é bom, o que acender alerta). */
  howToRead: string;
  className?: string;
};

export function MetricTooltip({ metric, what, howToRead, className }: MetricTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      data-metric={metric}
      className={`relative inline-block align-middle ${className ?? ""}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-describedby={tooltipId}
        aria-expanded={open}
        aria-label={`O que é esta métrica: ${what}`}
        className="ml-2 inline-flex size-4 items-center justify-center rounded-full border border-white/25 text-[10px] leading-none text-slate-400 transition hover:border-primary hover:text-primary light:border-slate-400 light:text-slate-500"
      >
        ?
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        hidden={!open}
        className="absolute left-0 top-6 z-20 w-64 border border-border bg-popover p-2.5 text-[11px] font-normal normal-case leading-4 tracking-normal text-popover-foreground shadow-xl [font-family:var(--font-body)]"
      >
        <span className="block font-semibold text-foreground">O que é</span>
        <span className="mt-0.5 block">{what}</span>
        <span className="mt-2 block font-semibold text-foreground">Como ler</span>
        <span className="mt-0.5 block">{howToRead}</span>
      </span>
    </span>
  );
}
