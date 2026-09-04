/* Sprint 1 (redesenho visual "Nível Arena") — o Virtual Canvas 16:9 da mesa de
 * jogo. Referência: o playmat fixo de Master Duel + a topologia oficial de zonas
 * do Gundam TCG (Mobile Suit Arena).
 *
 * Sprint 6 · P2 (escala widescreen + alinhamento de zonas):
 *  - o canvas continua travado em `aspect-[16/9]` (Virtual Canvas), mas o
 *    espaço lateral que sobra em monitor ultrawide agora é USADO pela página:
 *    o `CardInspectorPanel` cresce (`flex-1`) pra preencher a asa esquerda, com
 *    um espelho `flex-1` à direita mantendo a arena centrada.
 *  - `ShieldStation`/`DeckStation` têm largura EXPLÍCITA comum (`--card * 0.62`):
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
 * Perspectiva 3D (Sprint 5): `perspective` no canvas + `rotateX(8°)` na mesa; a
 * metade do oponente recua (`scale .95 / opacity .9`). Se a mira do `CombatLane`
 * sair de eixo em QA, é só reduzir/remover o `rotateX`.
 *
 * Componente apresentacional puro e prop-driven: cada peça é um slot
 * (`ReactNode`) que o `SimulatorMatchPage` preenche. O hover → inspetor lateral
 * não passa por aqui (o pai liga o `onHoverCard` de cada leaf). */
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

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
}

/** escala única de toda carta + perspectiva da mesa. */
const CANVAS_STYLE = {
  "--card": "clamp(3.5rem, 6.5vw, 6.2rem)",
  perspective: "1200px",
  perspectiveOrigin: "50% 65%",
} as CSSProperties;

/** inclinação tática da mesa (Master Duel). */
const TABLE_STYLE: CSSProperties = { transform: "rotateX(8deg)", transformStyle: "preserve-3d" };
/** o lado do oponente recua em profundidade. */
const OPPONENT_STYLE: CSSProperties = { transform: "scale(0.95)" };

export function ArenaPlaymat({ opponent, self, hand, overlay, className }: ArenaPlaymatProps) {
  return (
    <div
      className={cn(
        "relative mx-auto flex aspect-[16/9] max-h-full max-w-full flex-col overflow-hidden",
        "panel-cut hero-surface border border-primary/20",
        className,
      )}
      style={CANVAS_STYLE}
    >
      <div className="flex min-h-0 flex-1 flex-col" style={TABLE_STYLE}>
        {/* ── Metade do oponente (recuada, ancorada na seam) ────────────── */}
        {/* Sprint 6 — o grupo [pilhas][teatro][base/shields] é CENTRADO com gap
            pequeno; o teatro não é mais `flex-1` (era o que abria o vão lateral). */}
        <div className="flex min-h-0 flex-1 items-end justify-center gap-2 px-1 opacity-90" style={OPPONENT_STYLE}>
          <DeckStation side={opponent} mirrored />
          <OpponentTheater side={opponent} />
          <ShieldStation side={opponent} mirrored />
        </div>

        <Seam />

        {/* ── Metade do jogador (primeiro plano) ─────────────────────────────
            `pt-3`: recua o campo do jogador da seam (pedido do Willen) pra os
            botões do canto sup. direito das Units NÃO caírem em cima da Battle
            Area do oponente / da seam. Sobra espaço no rodapé do canvas. */}
        <div className="flex min-h-0 flex-1 items-start justify-center gap-2 px-1 pt-3">
          <ShieldStation side={self} />
          <SelfTheater side={self} />
          <DeckStation side={self} />
        </div>
      </div>

      {/* ── Rodapé: mão ancorada (fora da inclinação, pra leitura). Altura
          mínima reservada (Sprint 6 · P3) pra a mão não encolher junto com o
          canvas a ponto de cortar a carta. ───────────────────────────────── */}
      <div className="shrink-0 min-h-[calc(var(--card,3.5rem)*1.75)] border-t border-primary/15 bg-slate-950/40">
        {hand}
      </div>

      {overlay ? <div className="pointer-events-none absolute inset-0 z-30">{overlay}</div> : null}
    </div>
  );
}

/** largura comum das colunas laterais — Base, cascata de Shields e pilhas alinham nela. */
const STATION_WIDTH = "w-[calc(var(--card,3.5rem)*0.62)]";

/** largura da fileira de 6 slots (`repeat(6, --card)` + 5 gaps de `gap-1`) — a
 * linha de recursos usa a MESMA largura pra alinhar com a Battle Area. */
const BATTLE_ROW_WIDTH = "calc(var(--card, 3.5rem) * 6 + 1.25rem)";

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
function ShieldStation({ side, mirrored }: { side: ArenaSide; mirrored?: boolean }) {
  return (
    <div className={cn("flex shrink-0 flex-col items-center gap-1 py-1", STATION_WIDTH)}>
      {mirrored ? (
        <>
          {side.shields}
          {side.base}
        </>
      ) : (
        <>
          {side.base}
          {side.shields}
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
    <div ref={gridRef} className="mx-auto grid gap-1" style={{ gridTemplateColumns: "repeat(6, var(--card, 3.5rem))" }}>
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
