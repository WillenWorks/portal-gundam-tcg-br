/* Frente 4 (docs/38 §4) — sequências de microinteração de setup do simulador:
 *  - `shuffle`      : deck sendo embaralhado (3 cartas deslizando)
 *  - `deal-hand`    : 5 cartas saem da pilha pra zona da mão
 *  - `mulligan`     : as 5 voltam pra pilha → embaralha → 5 novas saem
 *  - `deal-shields` : 6 cartas saem da pilha pra a zona de escudos
 *
 * Componente APRESENTACIONAL e auto-contido: renderiza um overlay `fixed`
 * (`pointer-events-none`) com card-backs animados por CSS (`src/index.css`
 * `sim-anim-*`, todos com `motion-reduce`). `onDone` dispara quando a
 * sequência termina (ou imediatamente sob `prefers-reduced-motion`).
 *
 * Hoje é disparado sob demanda pela página de preview (`SimulatorLayoutPreviewPage`).
 * Ligar no fluxo real (início de partida / resolução do Mulligan / colocação
 * dos escudos) fica como follow-up — precisa de hooks de evento do motor em
 * `SimulatorMatchPage` + refs das zonas em `ArenaSide`. */
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { cardBackUrl } from "./cardArt";

export type DeckDealMode = "shuffle" | "deal-hand" | "mulligan" | "deal-shields";

interface DeckDealAnimationProps {
  mode: DeckDealMode;
  onDone: () => void;
  /** rótulo curto mostrado sobre a animação (ex.: "Embaralhando…"). */
  label?: string;
}

const CARD_W = 48;

/** posições-alvo (px, relativas ao centro do palco) por modo. */
function targets(mode: DeckDealMode): { dx: number; dy: number }[] {
  if (mode === "deal-shields") {
    // coluna vertical (zona de escudos, à esquerda)
    return Array.from({ length: 6 }, (_, i) => ({ dx: -170, dy: -70 + i * 16 }));
  }
  // leque horizontal (zona da mão, embaixo)
  return Array.from({ length: 5 }, (_, i) => ({ dx: -140 + i * 70, dy: 96 }));
}

const DEAL_STAGGER = 110;
const SHUFFLE_MS = 1300;

export function DeckDealAnimation({ mode, onDone, label }: DeckDealAnimationProps) {
  const reduced = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  // fases pro mulligan: return → shuffle → deal. Outros modos têm 1 fase só.
  const [phase, setPhase] = useState<"return" | "shuffle" | "deal">(
    mode === "mulligan" ? "return" : mode === "shuffle" ? "shuffle" : "deal",
  );
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => onDoneRef.current(), 60);
      return () => clearTimeout(t);
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const dealMs = () => targets(mode).length * DEAL_STAGGER + 360;

    if (mode === "shuffle") {
      timers.push(setTimeout(() => onDoneRef.current(), SHUFFLE_MS));
    } else if (mode === "deal-hand" || mode === "deal-shields") {
      timers.push(setTimeout(() => onDoneRef.current(), dealMs()));
    } else {
      // mulligan
      timers.push(setTimeout(() => setPhase("shuffle"), 340));
      timers.push(setTimeout(() => setPhase("deal"), 340 + SHUFFLE_MS));
      timers.push(setTimeout(() => onDoneRef.current(), 340 + SHUFFLE_MS + dealMs()));
    }
    return () => timers.forEach(clearTimeout);
  }, [mode, reduced]);

  const pts = targets(mode);
  const shuffling = !reduced && phase === "shuffle";
  const showTravel = !reduced && (phase === "deal" || phase === "return");

  return (
    <div className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center" aria-hidden>
      <div className="relative flex h-64 w-80 items-center justify-center">
        {label ? (
          <p className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-arena border border-primary/40 bg-slate-950/90 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
            {label}
          </p>
        ) : null}

        {/* pilha do deck (referência) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {[0, 1, 2].map((i) => (
            <img
              key={i}
              src={cardBackUrl}
              alt=""
              style={{ width: CARD_W, marginTop: i === 0 ? 0 : -CARD_W * 1.36, marginLeft: i * 2 }}
              className={cn(
                "block aspect-[63/88] rounded-arena border border-primary/40 object-cover shadow-lg",
                shuffling && "sim-anim-shuffle",
              )}
            />
          ))}
        </div>

        {/* cartas viajando pra zona-alvo (deal) ou voltando (return) */}
        {showTravel &&
          pts.map((t, i) => (
            <img
              key={i}
              src={cardBackUrl}
              alt=""
              style={
                {
                  width: CARD_W,
                  "--dx": `${t.dx}px`,
                  "--dy": `${t.dy}px`,
                  animationDelay: `${i * DEAL_STAGGER}ms`,
                } as React.CSSProperties
              }
              className={cn(
                "absolute left-1/2 top-1/2 -ml-6 -mt-8 block aspect-[63/88] rounded-arena border border-primary/50 object-cover shadow-xl",
                phase === "deal" ? "sim-anim-deal" : "sim-anim-return",
              )}
            />
          ))}
      </div>
    </div>
  );
}
