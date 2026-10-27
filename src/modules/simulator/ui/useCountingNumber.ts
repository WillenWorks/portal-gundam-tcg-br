/* Spec simulador-efeitos-na-mesa (E) — AP/HP contam até o valor novo, um a um (estilo Yu-Gi-Oh), em vez de pular de
 * 2 para 5. Vale para o buff, o debuff, o dano e a volta ao normal na virada do turno. */
import { useEffect, useRef, useState } from "react";
import { getScaledDuration } from "./animationSettings";

/** tempo de cada passo da contagem */
export const COUNT_STEP_MS = 110;
/** a contagem inteira não passa disto (um +6 conta mais rápido que um +1) */
export const COUNT_MAX_MS = 700;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

/**
 * o número mostrado (contando até `value`) e para que lado está contando agora. `resetKey` novo (outra carta no mesmo
 * lugar) mostra o valor direto, sem contar.
 */
export function useCountingNumber(value: number, resetKey?: string): { shown: number; counting: "up" | "down" | null } {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const keyRef = useRef(resetKey);

  useEffect(() => {
    if (keyRef.current !== resetKey) {
      keyRef.current = resetKey;
      shownRef.current = value;
      setShown(value);
      return;
    }
    const from = shownRef.current;
    if (from === value) return;
    const delta = Math.abs(value - from);
    const stepMs = getScaledDuration(Math.min(COUNT_STEP_MS, COUNT_MAX_MS / delta));
    if (prefersReducedMotion() || stepMs <= 0) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const dir = value > from ? 1 : -1;
    const timer = setInterval(() => {
      const next = shownRef.current + dir;
      shownRef.current = next;
      setShown(next);
      if (next === value) clearInterval(timer);
    }, stepMs);
    return () => clearInterval(timer);
  }, [value, resetKey]);

  return { shown, counting: shown === value ? null : value > shown ? "up" : "down" };
}
