/* docs/19, Sessão 3 + Fase A do redesenho visual — gaveta de mão. Usada em
 * TODA tela (não só celular): no board em grid de 5 faixas a mão não cabe mais
 * numa faixa própria sem espremer a Battle Area, então fica recolhida numa aba
 * na base e sobe por cima do board quando o jogador quer. A ABA abre/fecha por:
 *  - toque / clique (tap), OU
 *  - SWIPE vertical na aba (arrasta pra cima = abre, pra baixo = fecha).
 * Durante o arrasto a aba acompanha um pouco o dedo (feedback tátil); ao soltar,
 * decide pelo limiar/direção. Os handlers ficam só na aba pra não brigar com o
 * scroll horizontal da fileira de cartas. */
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ChevronUp, Hand } from "lucide-react";
import { cn } from "@/lib/utils";

interface HandDrawerProps {
  count: number;
  /** dica curta na aba, ex. "3 jogáveis" — ajuda a decidir se vale abrir. */
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** distância mínima (px) pra um arrasto valer como swipe; abaixo disso é "tap". */
const SWIPE_THRESHOLD = 36;
const TAP_SLOP = 8;

export function HandDrawer({ count, subtitle, open, onToggle, children }: HandDrawerProps) {
  const startY = useRef<number | null>(null);
  const [dragDy, setDragDy] = useState(0);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: ReactPointerEvent) => {
    startY.current = e.clientY;
    setDragDy(0);
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (startY.current === null) return;
    setDragDy(e.clientY - startY.current);
  };

  const finishDrag = () => {
    const dy = dragDy;
    startY.current = null;
    setDragDy(0);
    setDragging(false);
    if (Math.abs(dy) <= TAP_SLOP) {
      onToggle();
      return;
    }
    if (dy <= -SWIPE_THRESHOLD && !open) onToggle();
    else if (dy >= SWIPE_THRESHOLD && open) onToggle();
  };

  // acompanha o dedo só um pouco, e só na direção coerente com o estado atual.
  const nudge = open ? Math.max(0, Math.min(dragDy, 24)) : Math.min(0, Math.max(dragDy, -24));

  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "flex min-h-[44px] w-full touch-none select-none items-center justify-center gap-2 border-t border-primary/30 bg-slate-950/95 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary",
          !dragging && "transition-transform duration-100 motion-reduce:transition-none",
        )}
        style={{ transform: `translateY(${nudge}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <span className="h-1 w-8 rounded-full bg-primary/40" />
        <Hand className="size-4" />
        Mão ({count})
        {subtitle ? <span className="text-primary/70">· {subtitle}</span> : null}
        <ChevronUp className={cn("size-4 transition-transform", open && "rotate-180")} />
      </div>
      <div
        className={cn(
          "overflow-x-auto overflow-y-hidden bg-slate-950/98 transition-[max-height] duration-100 motion-reduce:transition-none",
          open ? "max-h-[38vh]" : "max-h-0",
        )}
      >
        <div className="flex gap-2 p-2">{children}</div>
      </div>
    </div>
  );
}
