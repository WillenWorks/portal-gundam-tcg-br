/* Sprint "Mulligan" — revelação de quem joga primeiro (sorteio aleatório no
 * pareamento). Overlay transitório: aparece no 1º render da partida e some por
 * clique ou depois de alguns segundos. O pai controla a visibilidade. */
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { cardBackUrl } from "./cardArt";

interface FirstPlayerRevealProps {
  goesFirst: boolean;
  onDismiss: () => void;
  /** ms até sumir sozinho (default 3500). */
  autoDismissMs?: number;
}

export function FirstPlayerReveal({ goesFirst, onDismiss, autoDismissMs = 3500 }: FirstPlayerRevealProps) {
  // `onDismiss` costuma ser uma closure nova a cada render do pai (o
  // SimulatorMatchPage re-renderiza a cada 1s pelo relógio do turno). Ler via
  // ref mantém o timeout ancorado no mount — senão ele era recriado sem parar
  // e o auto-dismiss nunca chegava aos 3.5s.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    const t = setTimeout(() => onDismissRef.current(), autoDismissMs);
    return () => clearTimeout(t);
  }, [autoDismissMs]);

  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Continuar"
      className="fixed inset-0 z-[55] flex cursor-pointer items-center justify-center bg-slate-950/80 backdrop-blur-sm"
    >
      <div className="panel-cut hero-surface flex flex-col items-center gap-2 border border-primary/40 px-8 py-6 text-center">
        {/* Frente 4 (docs/38 §4.4) — "embaralhamento": 3 cartas deslizam
            lateralmente na abertura da partida (o deck acabou de ser
            embaralhado). Decorativo; `motion-reduce` desliga. */}
        <div className="mb-1 flex justify-center motion-reduce:hidden" aria-hidden>
          {[0, 90, 180].map((delay, i) => (
            <img
              key={i}
              src={cardBackUrl}
              alt=""
              className="-ml-4 h-14 w-10 rounded-arena border border-primary/30 object-cover shadow-lg first:ml-0 animate-in slide-in-from-left-6 fade-in duration-500 ease-out"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
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
          {goesFirst ? "Você abre a partida." : "Você começa com 1 EX Resource ativo."}
        </p>
      </div>
    </button>
  );
}
