import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Relógio de segundos da tela de partida. Antes, a `SimulatorMatchPage` guardava `now` em estado e re-renderizava a
 * página inteira a cada 1 s (e recriava timers de overlay com callback inline). Aqui um único ticker, alinhado à
 * virada do segundo, avisa só os componentes que leem o relógio (`useClockNow`). Sem nenhum inscrito, o ticker para.
 */

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

/** instante do segundo atual (ms, múltiplo de 1000): estável dentro do mesmo segundo, como pede o useSyncExternalStore */
export function currentSecond(now = Date.now()): number {
  return Math.floor(now / 1000) * 1000;
}

function schedule() {
  // alinha à virada do segundo (+5 ms de folga), para não pular nem repetir um número no contador
  timer = setTimeout(() => {
    for (const l of [...listeners]) l();
    if (listeners.size) schedule();
    else timer = undefined;
  }, 1005 - (Date.now() % 1000));
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === undefined) schedule();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
}

const snapshot = () => currentSecond();

/** relógio local, atualizado a cada virada de segundo; re-renderiza só quem chama */
export function useClockNow(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** segundos que faltam até `target` (epoch local, ms), arredondados para cima; null sem alvo */
export function secondsUntil(target: number | null, now: number): number | null {
  return target === null ? null : Math.max(0, Math.ceil((target - now) / 1000));
}

/** segundos desde `since` (epoch local, ms), arredondados para baixo; null sem referência */
export function secondsSince(since: number | null, now: number): number | null {
  return since === null ? null : Math.max(0, Math.floor((now - since) / 1000));
}

/**
 * Verdadeiro a partir do instante `target` (epoch local, ms). Re-renderiza quem chama uma vez só, na passagem,
 * em vez de a cada segundo. Novo `target` (ex.: o oponente voltou e o "visto por último" mudou) recomeça a espera.
 */
export function useIsPast(target: number | null): boolean {
  const [reached, setReached] = useState<number | null>(null);
  useEffect(() => {
    if (target === null) return;
    const t = setTimeout(() => setReached(target), Math.max(0, target - Date.now()));
    return () => clearTimeout(t);
  }, [target]);
  return target !== null && reached === target;
}
