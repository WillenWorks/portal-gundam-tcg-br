/* Sprint 1 (redesenho visual "Nível Arena") — o Virtual Canvas 16:9 da mesa de
 * jogo. Referência: o playmat fixo de Master Duel + a topologia oficial de zonas
 * do Gundam TCG (Mobile Suit Arena).
 *
 * Acaba com o `flex-wrap` do layout antigo: as zonas são posicionadas de forma
 * ESTÁTICA num container de proporção travada (`aspect-[16/9]`) que escala
 * uniformemente pelo viewport via a variável de escala única `--card`. Nenhuma
 * transformação CSS arbitrária no tabuleiro (o `CombatLane` mede posições reais
 * com `getBoundingClientRect`).
 *
 * Componente apresentacional puro e prop-driven: cada região é um slot
 * (`ReactNode`) que o `SimulatorMatchPage` preenche com os componentes de zona
 * já existentes (`ShieldRail`, `ResourceMeter`, `BattleSlot`, `PileTray`,
 * `HandFan`, ...). O `overlay` cobre o canvas inteiro (feixe de mira do
 * `CombatLane`).
 *
 * Hover → inspetor lateral (Sprint 3): não passa por aqui — o pai liga o
 * `onHoverCard` de cada leaf (`BattleSlot`, `BaseCardGauge`, `HandFan`) ao
 * estado que alimenta o `CardInspectorPanel` das asas. */
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** As zonas de um lado da arena (oponente ou jogador). */
export interface ArenaSide {
  /** trilha de escudos em cascata vertical (borda esquerda). */
  shields: ReactNode;
  /** carta de Base + medidor de durabilidade. */
  base: ReactNode;
  /** linha horizontal de recursos (ativos / rested / EX). */
  resources: ReactNode;
  /** pilha do deck com profundidade. */
  deck: ReactNode;
  /** pilha de descarte (última carta no topo). */
  trash: ReactNode;
  /** contador da área de exílio. */
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

/** escala única de toda carta a partir do viewport — sem overflow, proporção travada. */
const CANVAS_STYLE = { "--card": "clamp(2.5rem, 5.2vw, 5.2rem)" } as CSSProperties;

export function ArenaPlaymat({ opponent, self, hand, overlay, className }: ArenaPlaymatProps) {
  return (
    <div
      className={cn(
        "relative mx-auto flex aspect-[16/9] max-h-full max-w-full flex-col justify-between overflow-hidden",
        "panel-cut hero-surface border border-primary/20",
        className,
      )}
      style={CANVAS_STYLE}
    >
      {/* ── Zona superior: oponente ─────────────────────────────────────── */}
      <StateZone side={opponent} orientation="opponent" />
      <BattleRow gridRef={opponent.battleAreaRef}>{opponent.battleRow}</BattleRow>

      {/* ── The Seam: canal de combate ──────────────────────────────────── */}
      <Seam />

      {/* ── Zona inferior: jogador ──────────────────────────────────────── */}
      <BattleRow gridRef={self.battleAreaRef}>{self.battleRow}</BattleRow>
      <StateZone side={self} orientation="self" />

      {/* ── Rodapé: mão ancorada ────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-primary/15 bg-slate-950/40">{hand}</div>

      {overlay ? <div className="pointer-events-none absolute inset-0 z-30">{overlay}</div> : null}
    </div>
  );
}

function StateZone({ side, orientation }: { side: ArenaSide; orientation: "opponent" | "self" }) {
  const row = (
    <div className="grid grid-cols-[auto_1fr_auto] items-start gap-2 px-2 py-1.5">
      <div className="flex items-start gap-2">
        <div>{side.shields}</div>
        <div>{side.base}</div>
      </div>
      <div className="min-w-0">{side.resources}</div>
      <div className="flex items-start gap-2">
        {side.deck}
        {side.trash}
        {side.exile}
      </div>
    </div>
  );

  return (
    <div className="shrink-0">
      {orientation === "opponent" ? (
        <>
          {side.handSummary ? (
            <div className="flex justify-center px-2 pt-1.5 pb-0.5">{side.handSummary}</div>
          ) : null}
          {row}
        </>
      ) : (
        row
      )}
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
    <div className="flex min-h-0 flex-1 items-center justify-center px-2">
      <div
        ref={gridRef}
        className="grid gap-1"
        style={{ gridTemplateColumns: "repeat(6, var(--card, 3.5rem))" }}
      >
        {children}
      </div>
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
