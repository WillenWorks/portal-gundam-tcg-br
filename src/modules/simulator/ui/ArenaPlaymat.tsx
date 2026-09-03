/* Sprint 1 (redesenho visual "Nível Arena") — o Virtual Canvas 16:9 da mesa de
 * jogo. Referência: o playmat fixo de Master Duel + a topologia oficial de zonas
 * do Gundam TCG (Mobile Suit Arena).
 *
 * Sprint 5.1 (reestruturação do playmat) — 3 colunas, sem `justify-between` (que
 * abria o vazio central):
 *   ┌───────────┬────────────────────────────┬───────────┐
 *   │ ESQUERDA  │        CENTRO (flex-1)      │  DIREITA  │
 *   │ (largura  │  metade do oponente:       │ (largura  │
 *   │  fixa)    │   [resumo mão]             │  fixa)    │
 *   │           │   [recursos] ── colados ── │           │
 *   │  opp:     │   [Battle Area oponente]   │  opp:     │
 *   │  Deck     │  ═══════ THE SEAM ═══════  │  Base+    │
 *   │  station  │   [Battle Area jogador]    │  Shields  │
 *   │           │   [recursos] ── colados ── │           │
 *   │  self:    │                            │  self:    │
 *   │  Base+    │                            │  Deck     │
 *   │  Shields  │                            │  station  │
 *   └───────────┴────────────────────────────┴───────────┘
 * Espelhamento: a coluna Base/Shields fica à ESQUERDA pro jogador e à DIREITA
 * pro oponente; a coluna Deck/Trash/Exílio, o inverso. Cada metade é `flex-1` e
 * alinha o conteúdo à seam (`items-end` no oponente, `items-start` no jogador),
 * então recursos + unidades ficam grudados no centro, sem buracos.
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
        <div className="flex min-h-0 flex-1 items-end gap-1 px-2 opacity-90" style={OPPONENT_STYLE}>
          <DeckStation side={opponent} />
          <OpponentTheater side={opponent} />
          <ShieldStation side={opponent} />
        </div>

        <Seam />

        {/* ── Metade do jogador (primeiro plano, ancorada na seam) ──────── */}
        <div className="flex min-h-0 flex-1 items-start gap-1 px-2">
          <ShieldStation side={self} />
          <SelfTheater side={self} />
          <DeckStation side={self} />
        </div>
      </div>

      {/* ── Rodapé: mão ancorada (fora da inclinação, pra leitura) ───────── */}
      <div className="shrink-0 border-t border-primary/15 bg-slate-950/40">{hand}</div>

      {overlay ? <div className="pointer-events-none absolute inset-0 z-30">{overlay}</div> : null}
    </div>
  );
}

/** Coluna Base + Shields (topo do lado; pro jogador fica à esquerda, pro oponente à direita). */
function ShieldStation({ side }: { side: ArenaSide }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1 py-1">
      {side.base}
      {side.shields}
    </div>
  );
}

/** Coluna Exílio / Trash / Deck (pro jogador à direita, pro oponente à esquerda). */
function DeckStation({ side }: { side: ArenaSide }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1 py-1">
      {side.exile}
      {side.trash}
      {side.deck}
    </div>
  );
}

/** Centro da metade do oponente: resumo da mão + recursos COLADOS acima da Battle Area. */
function OpponentTheater({ side }: { side: ArenaSide }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1 pb-1">
      {side.handSummary ? <div className="flex justify-center">{side.handSummary}</div> : null}
      <div className="w-full min-w-0">{side.resources}</div>
      <BattleRow gridRef={side.battleAreaRef}>{side.battleRow}</BattleRow>
    </div>
  );
}

/** Centro da metade do jogador: Battle Area + recursos COLADOS logo abaixo. */
function SelfTheater({ side }: { side: ArenaSide }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-start gap-1 pt-1">
      <BattleRow gridRef={side.battleAreaRef}>{side.battleRow}</BattleRow>
      <div className="w-full min-w-0">{side.resources}</div>
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
  return (
    <div className="relative mx-auto h-px w-full shrink-0" aria-hidden>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/45 to-transparent" />
      <div className="absolute inset-x-0 -top-1 h-2 bg-gradient-to-r from-transparent via-primary/10 to-transparent blur-[1px]" />
    </div>
  );
}
