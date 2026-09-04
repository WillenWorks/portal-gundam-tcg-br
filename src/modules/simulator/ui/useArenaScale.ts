/* V6.2 (docs/33) — mede a caixa disponível de verdade em vez de aproximar
 * por `vw`/`vh` (o que 4 rodadas de ajuste visual — docs/30-32 — vinham
 * fazendo, sempre chutando coeficientes). `containerRef` é uma caixa cujo
 * tamanho é resolvido pelo layout de fora (não pelo próprio conteúdo — ver
 * `SimulatorMatchPage.tsx`, o wrapper do `ArenaPlaymat` virou `flex-1` em
 * vez de `shrink-0` de propósito, senão a medição seria circular: a caixa
 * mediria o conteúdo, e o conteúdo se basearia na caixa). `groupRef` é o
 * grupo [DeckStation, Theater, ShieldStation] de UM dos lados — já
 * naturalmente sem stretch (a linha usa `items-start`/`items-end`, não
 * `items-stretch`, então os filhos já renderizam no tamanho real que pedem,
 * não esticado) — medir ele em vez de tentar decompor `card-w * N` cada
 * peça (Station/BattleRow/ResourceLane/cascata do Shield) à mão, que é
 * exatamente o que causou os erros de constante das rodadas anteriores. O
 * navegador já fez essa conta sozinho; só preciso ler o resultado.
 *
 * Como TUDO na arena é `calc(var(--card-w) * constante)`, o grupo medido
 * escala (quase) linearmente com `--card-w` — os únicos termos que não
 * escalam são gaps/paddings fixos em `rem` (pequenos, e o erro que
 * introduzem se auto-corrige a cada resize real, já que a medição sempre
 * usa a ÚLTIMA escala aplicada como referência, nunca uma constante
 * chutada de antemão). O rodapé da mão (`min-h-[calc(var(--card-w)*1.75)]`)
 * entra pela constante EXATA já escrita no próprio componente (`HAND_FOOTER_FACTOR`),
 * não por medição — é um valor conhecido de verdade, não uma estimativa.
 */
import { useEffect, useRef } from "react";

const HAND_FOOTER_FACTOR = 1.75; // ArenaPlaymat.tsx: min-h-[calc(var(--card-w)*1.75)]
const DEFAULT_MIN_PX = 44; // piso de sanidade — nunca ilegível
const DEFAULT_MAX_PX = 320; // teto de sanidade — nunca descontrolado num caso degenerado
const DEFAULT_INITIAL_PX = 56; // 3.5rem @16px — só o chute inicial antes da 1ª medição real

export interface ArenaScaleResult {
  /** `--card-w` calculado, em px — `null` até a 1ª medição real acontecer. */
  cardWPx: number | null;
}

export interface UseArenaScaleOptions {
  minPx?: number;
  maxPx?: number;
  /** roda a cada recálculo, com o valor aplicado (px) — ex.: decidir Shield achatado. */
  onScale?: (cardWPx: number) => void;
}

/**
 * Mede `containerRef` (a caixa disponível) e `groupRef` (o conteúdo que
 * escala com `--card-w`, já naturalmente dimensionado — ver docstring do
 * arquivo) e aplica o `--card-w` resultante DIRETO no `containerRef` via
 * `style.setProperty` (sem passar por re-render do React — CSS reage
 * sozinho, suave em resize contínuo).
 */
export function useArenaScale(
  containerRef: React.RefObject<HTMLElement | null>,
  groupRef: React.RefObject<HTMLElement | null>,
  options: UseArenaScaleOptions = {},
): void {
  const { minPx = DEFAULT_MIN_PX, maxPx = DEFAULT_MAX_PX, onScale } = options;
  const lastAppliedPx = useRef(DEFAULT_INITIAL_PX);
  // "callback sempre fresco" — `onScale` pode ser uma arrow function nova a
  // cada render do caller (é o caso do `ArenaPlaymat`); guardar só a
  // IDENTIDADE mais recente aqui evita recriar o `ResizeObserver` inteiro a
  // cada render (o que aconteceria se `onScale` entrasse direto na
  // dependência do efeito abaixo). Atribuição em `useEffect`, nunca durante
  // o render (`react-hooks/refs` do React 19 sinaliza mutar ref no render).
  const onScaleRef = useRef(onScale);
  useEffect(() => {
    onScaleRef.current = onScale;
  }, [onScale]);

  useEffect(() => {
    const container = containerRef.current;
    const group = groupRef.current;
    if (!container || !group) return;

    // valor inicial, antes da 1ª medição real — evita layout com --card-w vazio.
    container.style.setProperty("--card-w", `${lastAppliedPx.current}px`);

    const recompute = () => {
      const containerRect = container.getBoundingClientRect();
      const groupRect = group.getBoundingClientRect();
      if (groupRect.width <= 0 || groupRect.height <= 0 || containerRect.width <= 0 || containerRect.height <= 0) {
        return;
      }

      const widthPerCardW = groupRect.width / lastAppliedPx.current;
      const heightPerCardW = groupRect.height / lastAppliedPx.current;

      const fromWidth = containerRect.width / widthPerCardW;
      // 2 metades (oponente + jogador) + o rodapé da mão dividem a altura disponível.
      const fromHeight = containerRect.height / (2 * heightPerCardW + HAND_FOOTER_FACTOR);

      const next = Math.max(minPx, Math.min(maxPx, Math.min(fromWidth, fromHeight)));
      if (Math.abs(next - lastAppliedPx.current) < 0.5) return; // evita loop de recálculo por sub-pixel

      lastAppliedPx.current = next;
      container.style.setProperty("--card-w", `${next}px`);
      onScaleRef.current?.(next);
    };

    // `ResizeObserver` não existe no jsdom (ambiente de teste) — sem essa
    // guarda, todo teste que renderiza um consumidor deste hook precisaria
    // lembrar de mockar um global só pra não quebrar o efeito. Sem ele, fica
    // só o piso inicial aplicado acima — comportamento seguro, não é erro.
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    recompute();

    return () => observer.disconnect();
  }, [containerRef, groupRef, minPx, maxPx]);
}
