/* docs/19, Sessão 3 (polimento) — registro de elementos de tabuleiro por
 * chave (instanceId de Unit, ou "player:A"/"player:B" pras Battle Areas),
 * pra o `CombatLane` conseguir medir posição real de DOM e desenhar a linha
 * de mira ponto-a-ponto. Os ref-callbacks são estáveis por chave (não
 * recriados a cada render), então o React não fica chamando `ref(null)` +
 * `ref(el)` à toa. */
import { useCallback, useRef } from "react";

export interface BoardElements {
  /** ref-callback estável pra pendurar num elemento sob a `key` dada. */
  register: (key: string) => (el: HTMLElement | null) => void;
  /** `getBoundingClientRect()` (coords de viewport) do elemento registrado, ou `null`. */
  rectOf: (key: string) => DOMRect | null;
}

export function useBoardElements(): BoardElements {
  const elements = useRef(new Map<string, HTMLElement>()).current;
  const callbacks = useRef(new Map<string, (el: HTMLElement | null) => void>()).current;

  const register = useCallback(
    (key: string) => {
      let cb = callbacks.get(key);
      if (!cb) {
        cb = (el: HTMLElement | null) => {
          if (el) elements.set(key, el);
          else elements.delete(key);
        };
        callbacks.set(key, cb);
      }
      return cb;
    },
    [callbacks, elements],
  );

  const rectOf = useCallback((key: string) => elements.get(key)?.getBoundingClientRect() ?? null, [elements]);

  return { register, rectOf };
}

/** Chave do registro pra Battle Area de um jogador (alvo quando o ataque é "no jogador"). */
export function playerAreaKey(playerId: string): string {
  return `player:${playerId}`;
}

/** Frente 4 (docs/38 §3.4) — chave da coluna Base/Escudos (lateral esquerda).
 *  A seta de ataque "no jogador" mira AQUI, não no centro da Battle Area. */
export function playerShieldKey(playerId: string): string {
  return `shield:${playerId}`;
}
