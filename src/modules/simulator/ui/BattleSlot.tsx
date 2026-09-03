/* docs/19, Sessão 3 — um dos 6 slots fixos da Battle Area. Moldura tática
 * escura com acento ciano/dourado; Unit com badges de AP efetivo / HP
 * restante; overlay "RESTED"; Piloto acoplado (DockedPilot) com badge LINK;
 * realce verde/dourado quando é alvo legal de uma ação.
 *
 * Sprint 5 (refinamento Arena 3D) — o slot é RIGOROSAMENTE `aspect-[63/88]`:
 * os botões de ação rápida ("Atacar" / "Mirar aqui" / "Blocker") viraram
 * OVERLAY absoluto sobre a carta (não somam mais 44px de altura, que fazia as
 * Units colidirem na seam). O Piloto acoplado também é overlay na base. */
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CardInstance } from "@/modules/simulator/engine/types";
import { effectiveAp, effectiveHp, hasKeyword } from "@/modules/simulator/engine/types";
import { isGenericArtCard, type ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";
import { DockedPilot } from "./DockedPilot";

export interface BattleSlotActions {
  onAttack?: (unit: CardInstance) => void;
  onDeclareTarget?: (unit: CardInstance) => void;
  onBlocker?: (unit: CardInstance) => void;
}

/** botão de ação em overlay: sólido de alto contraste, compacto, não estica o slot. */
const ACTION_BTN =
  "h-7 w-full rounded-none bg-primary/95 px-1 text-[10px] font-bold text-black shadow-lg hover:bg-primary/90";

interface BattleSlotProps {
  unit: CardInstance | null;
  /** Pilot pareado com esta Unit (achado pelo pai via `pairedPilotId`). */
  pilot: CardInstance | null;
  art: ArtLookup;
  /** alvo legal de uma seleção/ataque em andamento — realça em verde/dourado. */
  legalTarget?: boolean;
  selected?: boolean;
  isAttacker?: boolean;
  busy?: boolean;
  onSelect?: (unit: CardInstance) => void;
  onInspect?: (card: CardInstance) => void;
  /** hover / foco na Unit (ou `null` ao sair) — alimenta o inspetor lateral (Sprint 3). */
  onHoverCard?: (card: CardInstance | null) => void;
  actions?: BattleSlotActions;
  /** ref-callback pra o CombatLane medir a posição desta Unit (linha de mira). */
  registerRef?: (el: HTMLElement | null) => void;
}

export function BattleSlot({
  unit,
  pilot,
  art,
  legalTarget,
  selected,
  isAttacker,
  busy,
  onSelect,
  onInspect,
  onHoverCard,
  actions,
  registerRef,
}: BattleSlotProps) {
  if (!unit) {
    return (
      <div className="relative aspect-[63/88] w-full border border-dashed border-cyan-500/20 bg-slate-900/40">
        <div className="absolute inset-1 border border-cyan-500/10" aria-hidden />
      </div>
    );
  }

  // passa o Pilot pareado direto (BattleSlot não tem o GameState) pra que o
  // modificador impresso de AP/HP dele (Comprehensive Rules 3-3-5) apareça nos badges.
  const ap = effectiveAp(unit, undefined, pilot);
  const hpRemaining = Math.max(0, effectiveHp(unit, undefined, pilot) - unit.damage);
  const apBuffed = ap !== (unit.def.ap ?? 0);
  const hpDamaged = unit.damage > 0;
  // com Piloto acoplado, a faixa dele ocupa a base — os números sobem um degrau.
  const badgeBottom = pilot ? "bottom-[1.1rem]" : "bottom-0";

  const showAttack = actions?.onAttack && !unit.rested;
  const showTarget = Boolean(actions?.onDeclareTarget);
  const showBlocker = actions?.onBlocker && !unit.rested && hasKeyword(unit, "Blocker");
  const showActions = showAttack || showTarget || showBlocker;

  return (
    <div
      ref={registerRef}
      className={cn(
        "relative aspect-[63/88] w-full border bg-gradient-to-b from-slate-900/80 to-black/80 transition-shadow",
        legalTarget
          ? "border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.55)]"
          : selected || isAttacker
            ? "border-primary shadow-[0_0_10px_rgba(56,189,248,0.5)]"
            : "border-cyan-500/20",
      )}
    >
      <button
        type="button"
        onClick={() => (legalTarget && onSelect ? onSelect(unit) : onInspect?.(unit))}
        onMouseEnter={onHoverCard ? () => onHoverCard(unit) : undefined}
        onMouseLeave={onHoverCard ? () => onHoverCard(null) : undefined}
        onFocus={onHoverCard ? () => onHoverCard(unit) : undefined}
        onBlur={onHoverCard ? () => onHoverCard(null) : undefined}
        className={cn("relative block h-full w-full", legalTarget ? "cursor-pointer" : "cursor-zoom-in")}
      >
        <CardFace
          nameEn={unit.def.nameEn}
          code={unit.def.code}
          art={art}
          size="sm"
          className="h-full w-full"
          dimmed={unit.rested}
          backFallback={isGenericArtCard(unit.def.cardType, unit.def.isToken)}
        >
          {/* AP / HP efetivos — badges de canto (sobem quando há Piloto acoplado) */}
          <span
            className={cn(
              "absolute left-0 z-10 min-w-[1.25rem] px-1 py-0.5 text-center text-[9px] font-black tabular-nums",
              badgeBottom,
              apBuffed ? "bg-amber-500 text-black" : "bg-cyan-600/95 text-white",
            )}
            aria-label={`AP ${ap}`}
          >
            {ap}
          </span>
          <span
            className={cn(
              "absolute right-0 z-10 flex items-baseline gap-0.5 px-1 py-0.5 text-[9px] font-black tabular-nums",
              badgeBottom,
              hpDamaged ? "bg-red-600/95 text-white" : "bg-slate-700/95 text-white",
            )}
            aria-label={`HP ${hpRemaining}`}
          >
            {hpRemaining}
            {hpDamaged ? <span className="text-[7px] font-bold text-red-200">-{unit.damage}</span> : null}
          </span>
          {unit.rested ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45">
              <span className="rotate-[-12deg] border border-slate-300/60 bg-black/70 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-slate-200">
                Rested
              </span>
            </div>
          ) : null}
          {hasKeyword(unit, "Blocker") ? (
            <span className="absolute left-0.5 top-0.5 rounded-none bg-sky-500/90 px-1 text-[7px] font-bold uppercase text-black">Blk</span>
          ) : null}
        </CardFace>
      </button>

      {pilot ? <DockedPilot pilot={pilot} unit={unit} art={art} onInspect={onInspect} /> : null}

      {showActions ? (
        <div className="absolute inset-x-1 bottom-1 z-20 flex flex-col gap-0.5">
          {showAttack ? (
            <Button size="sm" className={ACTION_BTN} disabled={busy} onClick={() => actions!.onAttack!(unit)}>
              Atacar
            </Button>
          ) : null}
          {showTarget ? (
            <Button
              size="sm"
              className={cn(ACTION_BTN, "bg-emerald-500 hover:bg-emerald-400")}
              disabled={busy}
              onClick={() => actions!.onDeclareTarget!(unit)}
            >
              Mirar aqui
            </Button>
          ) : null}
          {showBlocker ? (
            <Button size="sm" className={ACTION_BTN} disabled={busy} onClick={() => actions!.onBlocker!(unit)}>
              Blocker
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
