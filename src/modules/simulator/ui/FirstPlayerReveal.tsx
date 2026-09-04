/* Sprint "Mulligan" — revelação de quem joga primeiro (sorteio aleatório no
 * pareamento). Overlay transitório: aparece no 1º render da partida e some por
 * clique ou depois de alguns segundos. O pai controla a visibilidade. */
import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface FirstPlayerRevealProps {
  goesFirst: boolean;
  onDismiss: () => void;
  /** ms até sumir sozinho (default 3500). */
  autoDismissMs?: number;
}

export function FirstPlayerReveal({ goesFirst, onDismiss, autoDismissMs = 3500 }: FirstPlayerRevealProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [onDismiss, autoDismissMs]);

  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Continuar"
      className="fixed inset-0 z-[55] flex cursor-pointer items-center justify-center bg-slate-950/80 backdrop-blur-sm"
    >
      <div className="panel-cut hero-surface flex flex-col items-center gap-2 border border-primary/40 px-8 py-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-portal">Sorteio de iniciativa</p>
        <p
          className={cn(
            "text-2xl font-black uppercase tracking-[0.08em] sm:text-3xl",
            goesFirst ? "text-primary" : "text-amber-300",
          )}
        >
          {goesFirst ? "Você joga primeiro" : "Oponente joga primeiro"}
        </p>
        <p className="text-[11px] text-muted-portal">
          {goesFirst
            ? "Você não compra carta no seu 1º turno."
            : "Você começa com 1 EX Resource e compra normalmente."}
        </p>
      </div>
    </button>
  );
}
