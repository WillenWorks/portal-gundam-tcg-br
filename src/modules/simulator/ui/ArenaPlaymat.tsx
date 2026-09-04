/* Sprint 1 (redesenho visual "Nível Arena") — o Virtual Canvas 16:9 da mesa de
 * jogo. Referência: o playmat fixo de Master Duel + a topologia oficial de zonas
 * do Gundam TCG (Mobile Suit Arena).
 *
 * Sprint 6 · P2 (escala widescreen + alinhamento de zonas):
 *  - o canvas continua travado em `aspect-[16/9]` (Virtual Canvas), mas o
 *    espaço lateral que sobra em monitor ultrawide agora é USADO pela página:
 *    o `CardInspectorPanel` cresce (`flex-1`) pra preencher a asa esquerda, com
 *    um espelho `flex-1` à direita mantendo a arena centrada.
 *  - `ShieldStation`/`DeckStation` têm largura EXPLÍCITA comum (`--card-w * 0.62`):
 *    Base, cascata de Shields e as 3 pilhas alinham na mesma coluna.
 *
 * Espelhamento 180° do playmat oficial (rodada Willen 2026-09-03) — o lado do
 * oponente é o do jogador GIRADO 180°: colunas trocam de lado E invertem a
 * ordem vertical.
 *   ┌───────────┬────────────────────────────┬───────────┐
 *   │ ESQUERDA  │        CENTRO              │  DIREITA  │
 *   │  opp:     │   [recursos do oponente]  │  opp:     │
 *   │  Deck     │   [Battle Area oponente]  │  Shields  │
 *   │  Trash    │  ═══════ THE SEAM ═══════ │  Base     │
 *   │  Exílio   │   [Battle Area jogador]   │  Shields  │
 *   │           │   [recursos do jogador]   │  Base     │
 *   │  self:    │                           │  self:    │
 *   │  Exílio   │                           │  Base     │
 *   │  Trash    │                           │  Shields  │
 *   │  Deck     │                           │           │
 *   └───────────┴────────────────────────────┴───────────┘
 * Cada metade alinha o conteúdo à seam (`items-end` no oponente, `items-start`
 * no jogador): as duas Battle Areas ficam coladas no centro; os recursos do
 * oponente sobem pro TOPO da tela. `ShieldStation`/`DeckStation` recebem
 * `mirrored` pra inverter a ordem dos filhos no lado do oponente.
 *
 * Perspectiva 3D (Sprint 5): `perspective` no canvas + `rotateX` sutil na mesa; a
 * metade do oponente recua (`scale .95 / opacity .9`).
 *
 * IMPORTANTE — SEM `transformStyle: preserve-3d` (2026-09-03): com `preserve-3d`
 * + `rotateX`, as duas metades viram camadas 3D e o hit-test do browser passava
 * a errar QUAL camada recebe o clique perto da seam — os botões de canto das
 * Units do jogador ficavam inclicáveis (lutamos com isso 4×). Sem `preserve-3d`
 * a subárvore é achatada num plano só e o `z-index` volta a funcionar normal; o
 * `rotateX` continua dando o tilt, só que num plano clicável.
 *
 * Componente apresentacional puro e prop-driven: cada peça é um slot
 * (`ReactNode`) que o `SimulatorMatchPage` preenche. O hover → inspetor lateral
 * não passa por aqui (o pai liga o `onHoverCard` de cada leaf). */
import { cloneElement, isValidElement, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useArenaScale } from "./useArenaScale";

/** As zonas de um lado da arena (oponente ou jogador). */
export interface ArenaSide {
  /** trilha de escudos em cascata vertical. */
  shields: ReactNode;
  /** carta de Base + medidor de durabilidade. */
  base: ReactNode;
  /** linha horizontal de recursos (ativos / rested / EX). */
  resources: ReactNode;
  /** pilha do deck. */
  deck: ReactNode;
  /** pilha de descarte. */
  trash: ReactNode;
  /** pilha de exílio. */
  exile: ReactNode;
  /** os 6 slots de batalha, renderizados pelo pai (fragmento com 6 filhos). */
  battleRow: ReactNode;
  /** ref-callback pra o `CombatLane` medir a Battle Area (alvo "no jogador"). */
  battleAreaRef?: (el: HTMLElement | null) => void;
  /** só o oponente: leitura da mão (contagem de cartas). */
  handSummary?: ReactNode;
}

interface ArenaPlaymatProps {
  opponent: ArenaSide;
  self: ArenaSide;
  /** leque da mão do jogador, ancorado no rodapé. */
  hand: ReactNode;
  /** overlay absoluto sobre todo o canvas (ex.: feixe de mira do `CombatLane`). */
  overlay?: ReactNode;
  className?: string;
  /** V6.1 (docs/32) — botão "Expandir tabuleiro": o pai já escondeu o
   *  `CardInspectorPanel`/espelho, liberando a largura toda pra esta coluna
   *  central. `expanded` solta a trava de `aspect-[16/9]` do canvas (V6.2,
   *  docs/33) — `useArenaScale` mede a caixa real e recalcula `--card-w`
   *  sozinho, não precisa de fórmula separada pra este modo. */
  expanded?: boolean;
}

/** perspectiva fixa da mesa — não depende de `--card-w`, então fica fora do
 *  hook de escala (ver `useArenaScale.ts`). */
const PERSPECTIVE_STYLE: CSSProperties = { perspective: "1200px", perspectiveOrigin: "50% 65%" };

/** inclinação tática da mesa (Master Duel) — SEM `preserve-3d` (ver docstring):
 *  a subárvore achata num plano clicável, o tilt fica só no visual. */
const TABLE_STYLE: CSSProperties = { transform: "rotateX(5deg)" };
/** o lado do oponente recua um pouco (2D, achatado). */
const OPPONENT_STYLE: CSSProperties = { transform: "scale(0.96)" };

/** V6.2 (docs/33): se o `--card-w` calculado por `useArenaScale` cair a essa
 *  altura ou menos, a caixa disponível está cramped demais pra cascata do
 *  Shield (que pede altura extra) — troca pro modo achatado. Limiar sobre o
 *  RESULTADO real da medição (não mais um breakpoint de viewport chutado —
 *  era exatamente isso que causava as rodadas anteriores baterem em
 *  limiares diferentes por arquivo, docs/32 §achado de raiz). */
const SHIELD_COMPACT_THRESHOLD_PX = 64; // 4rem

export function ArenaPlaymat({ opponent, self, hand, overlay, className, expanded }: ArenaPlaymatProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const [compact, setCompact] = useState(false);

  useArenaScale(containerRef, groupRef, {
    onScale: (px) => setCompact(px <= SHIELD_COMPACT_THRESHOLD_PX),
  });

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative mx-auto flex flex-col overflow-hidden",
        // V6.3 (docs/34) — tamanho-padrão único: antes, Battle Row/Mão usavam
        // `--card-w` cheio (1x) enquanto Shield/Deck/Trash/Exílio/Base
        // usavam `--card-w * 0.62` cada um escrevendo a conta na mão (achado
        // do Willen: Unit ficava o DOBRO do resto, sem padrão nenhum entre
        // as peças). `--card-w-std`, derivada 1 vez aqui, é a ÚNICA fonte —
        // todo mundo (incluindo Battle Row/Mão agora) referencia ela, nunca
        // mais reescreve `*0.62` cada um por conta própria.
        "[--card-w-std:calc(var(--card-w)*0.62)]",
        // V6.2 (docs/33): `expanded` solta a trava de 16:9 — sem isso, a caixa
        // do canvas nunca crescia além de altura×16/9 mesmo com as asas
        // escondidas (largura sobrando ficava sempre de fora, inalcançável,
        // print "CapturaWide2" do Willen). Modo normal mantém 16:9.
        expanded ? "h-full w-full" : "aspect-[16/9] max-h-full max-w-full",
        "panel-cut hero-surface border border-primary/20",
        className,
      )}
      style={PERSPECTIVE_STYLE}
    >
      <div className="flex min-h-0 flex-1 flex-col" style={TABLE_STYLE}>
        {/* ── Metade do oponente (recuada, ancorada na seam) ────────────── */}
        {/* Sprint 6 — o grupo [pilhas][teatro][base/shields] é CENTRADO com gap
            pequeno; o teatro não é mais `flex-1` (era o que abria o vão lateral). */}
        <div className="flex min-h-0 flex-1 items-end justify-center gap-2 px-1 opacity-90" style={OPPONENT_STYLE}>
          <DeckStation side={opponent} mirrored />
          <OpponentTheater side={opponent} />
          <ShieldStation side={opponent} mirrored compact={compact} />
        </div>

        <Seam />

        {/* ── Metade do jogador (primeiro plano) ─────────────────────────────
            `pt-3`: recua o campo do jogador da seam (pedido do Willen) pra os
            botões do canto sup. direito das Units NÃO caírem em cima da Battle
            Area do oponente / da seam. Sobra espaço no rodapé do canvas.
            `groupRef` (V6.2, docs/33): mede o grupo [Shield/Teatro/Deck] deste
            lado — já naturalmente sem stretch (`items-start`, não
            `items-stretch`) — pra `useArenaScale` calcular `--card-w` a
            partir do tamanho REAL renderizado, não de uma fórmula chutada. Só
            precisa medir 1 dos 2 lados (mesmo tamanho — o oponente só tem o
            `scale(.96)` cosmético por cima, não muda o card-w necessário). */}
        <div className="flex min-h-0 flex-1 items-start justify-center px-1 pt-3">
          {/* `groupRef` vai no wrapper INTERNO, não nesta linha — esta linha é
              `flex-1` (altura ALOCADA pela metade jogador/oponente, não o
              tamanho natural do conteúdo); o wrapper interno não tem
              `flex-1`/stretch nenhum, então mede exatamente o que os 3 filhos
              pedem de verdade (nem mais, nem menos). `gap-2` migrou pra cá. */}
          <div ref={groupRef} className="flex items-start gap-2">
            <ShieldStation side={self} compact={compact} />
            <SelfTheater side={self} />
            <DeckStation side={self} />
          </div>
        </div>
      </div>

      {/* ── Rodapé: mão ancorada (fora da inclinação, pra leitura). Altura
          mínima reservada (Sprint 6 · P3) pra a mão não encolher junto com o
          canvas a ponto de cortar a carta. ───────────────────────────────── */}
      <div className="shrink-0 min-h-[calc(var(--card-w,3.5rem)*1.75)] border-t border-primary/15 bg-slate-950/40">
        {hand}
      </div>

      {overlay ? <div className="pointer-events-none absolute inset-0 z-30">{overlay}</div> : null}
    </div>
  );
}

/** largura comum das colunas laterais — Base, cascata de Shields e pilhas alinham nela.
 *  V6.3 (docs/34): `--card-w-std` (definida no canvas root), não mais `*0.62` repetido aqui. */
const STATION_WIDTH = "w-[var(--card-w-std,2.17rem)]";

/** largura da fileira de 6 slots (`repeat(6, --card-w-std)` + 5 gaps de
 * `gap-1.5` = 5×0.375rem = 1.875rem, V6.3 docs/34) — a linha de recursos
 * usa a MESMA largura pra alinhar com a Battle Area. */
const BATTLE_ROW_WIDTH = "calc(var(--card-w-std, 2.17rem) * 6 + 1.875rem)";

/** trilha de recursos: centrada, travada na largura da Battle Area, scroll fantasma. */
function ResourceLane({ children }: { children: ReactNode }) {
  return (
    <div
      className="scrollbar-ghost mx-auto flex min-w-0 max-w-full justify-center overflow-x-auto overscroll-x-contain"
      style={{ width: BATTLE_ROW_WIDTH }}
    >
      {children}
    </div>
  );
}

/**
 * Coluna Base + Shields. Jogador (não-espelhado): Base no topo, Shields
 * descendo. Oponente (`mirrored`, rotação 180° do playmat): Shields no topo,
 * Base embaixo — encostada na seam, entre os shields e a Battle Area dele.
 */
function ShieldStation({ side, mirrored, compact }: { side: ArenaSide; mirrored?: boolean; compact?: boolean }) {
  // V6.2 (docs/33): `side.shields` já vem pronto (o `<ShieldRail>` é montado
  // pelo `SimulatorMatchPage.tsx`, antes do `ArenaPlaymat` existir) — a única
  // forma de injetar o `compact` calculado aqui é clonar o elemento com a
  // prop extra. Guard `isValidElement` por segurança (`ArenaSide.shields` é
  // tipado como `ReactNode` genérico).
  const shields = isValidElement(side.shields) ? cloneElement(side.shields as ReactElement<{ compact?: boolean }>, { compact }) : side.shields;
  return (
    <div className={cn("flex shrink-0 flex-col items-center gap-1 py-1", STATION_WIDTH)}>
      {mirrored ? (
        <>
          {shields}
          {side.base}
        </>
      ) : (
        <>
          {side.base}
          {shields}
        </>
      )}
    </div>
  );
}

/**
 * Coluna Exílio / Trash / Deck. Jogador: Exílio no topo, Deck embaixo (perto de
 * você). Oponente (`mirrored`): Deck no topo, Exílio embaixo (perto da seam) —
 * o playmat dele girado 180°.
 */
function DeckStation({ side, mirrored }: { side: ArenaSide; mirrored?: boolean }) {
  return (
    <div className={cn("flex shrink-0 flex-col items-center gap-1 py-1", STATION_WIDTH)}>
      {mirrored ? (
        <>
          {side.deck}
          {side.trash}
          {side.exile}
        </>
      ) : (
        <>
          {side.exile}
          {side.trash}
          {side.deck}
        </>
      )}
    </div>
  );
}

/** Centro da metade do oponente (espelho 180°): recursos NO TOPO, Battle Area
 *  encostada na seam. */
function OpponentTheater({ side }: { side: ArenaSide }) {
  return (
    <div className="flex min-w-0 shrink-0 flex-col items-center justify-end gap-1 pb-1">
      {side.handSummary ? <div className="flex justify-center">{side.handSummary}</div> : null}
      <ResourceLane>{side.resources}</ResourceLane>
      <BattleRow gridRef={side.battleAreaRef}>{side.battleRow}</BattleRow>
    </div>
  );
}

/** Centro da metade do jogador: Battle Area encostada na seam + recursos logo abaixo. */
function SelfTheater({ side }: { side: ArenaSide }) {
  return (
    <div className="flex min-w-0 shrink-0 flex-col items-center justify-start gap-1 pt-1">
      <BattleRow gridRef={side.battleAreaRef}>{side.battleRow}</BattleRow>
      <ResourceLane>{side.resources}</ResourceLane>
    </div>
  );
}

function BattleRow({
  children,
  gridRef,
}: {
  children: ReactNode;
  gridRef?: (el: HTMLElement | null) => void;
}) {
  return (
    // V6.3 (docs/34): `--card-w-std` — Battle Row diminui pro tamanho-padrão
    // das outras peças (Shield/Deck/Base), não mais o dobro delas.
    // V6.3 (docs/34): `gap-1.5` (era `gap-1`) — um pouco mais de respiro entre
    // slots vizinhos, pra clicar nos ícones de ação (Etapa 6) sem risco de
    // errar pro slot ao lado.
    <div ref={gridRef} className="mx-auto grid gap-1.5" style={{ gridTemplateColumns: "repeat(6, var(--card-w-std, 2.17rem))" }}>
      {children}
    </div>
  );
}

function Seam() {
  // `pointer-events-none`: é só decoração (`aria-hidden`); a faixa desfocada de
  // 8px NUNCA pode interceptar clique nos botões de carta que encostam na seam.
  return (
    <div className="pointer-events-none relative mx-auto h-px w-full shrink-0" aria-hidden>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/45 to-transparent" />
      <div className="absolute inset-x-0 -top-1 h-2 bg-gradient-to-r from-transparent via-primary/10 to-transparent blur-[1px]" />
    </div>
  );
}
