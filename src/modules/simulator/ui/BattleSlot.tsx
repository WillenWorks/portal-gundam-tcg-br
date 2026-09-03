/* docs/19, Sessão 3 — um dos 6 slots fixos da Battle Area. Moldura tática
 * escura com acento ciano/dourado; Unit com badges de AP efetivo / HP
 * restante; overlay "RESTED"; Piloto acoplado (DockedPilot) com badge LINK;
 * realce verde/dourado quando é alvo legal de uma ação. Botões de ação com
 * área de toque de 44px+ (era ~20px antes — o relato original do Willen).
 *
 * Sprint 2 (redesenho "Nível Arena") — slot vazio ganha textura de hangar
 * (moldura ciano tracejada de alta visibilidade); AP/HP viram badges de canto
 * (inferior esquerdo / direito) com indicador de dano acumulado; botões de
 * combate crescem pra >= 44px. */
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CardInstance } from "@/modules/simulator/engine/types";
import { effectiveAp, effectiveHp, hasKeyword } from "@/modules/simulator/engine/types";
import type { ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";
import { DockedPilot } from "./DockedPilot";

export interface BattleSlotActions {
  onAttack?: (unit: CardInstance) => void;
  onDeclareTarget?: (unit: CardInstance) => void;
  onBlocker?: (unit: CardInstance) => void;
}

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

  return (
    <div
      ref={registerRef}
      className={cn(
        "relative flex flex-col border bg-gradient-to-b from-slate-900/80 to-black/80 transition-shadow",
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
        className={cn("relative block w-full", legalTarget ? "cursor-pointer" : "cursor-zoom-in")}
      >
        <CardFace nameEn={unit.def.nameEn} code={unit.def.code} art={art} size="sm" className="w-full" dimmed={unit.rested}>
          {/* AP / HP efetivos — badges de canto (Sprint 2) */}
          <span
            className={cn(
              "absolute bottom-0 left-0 min-w-[1.25rem] px-1 py-0.5 text-center text-[9px] font-black tabular-nums",
              apBuffed ? "bg-amber-500 text-black" : "bg-cyan-600/95 text-white",
            )}
            aria-label={`AP ${ap}`}
          >
            {ap}
          </span>
          <span
            className={cn(
              "absolute bottom-0 right-0 flex items-baseline gap-0.5 px-1 py-0.5 text-[9px] font-black tabular-nums",
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

      {(actions?.onAttack || actions?.onDeclareTarget || actions?.onBlocker) ? (
        <div className="flex flex-col gap-0.5 p-0.5">
          {actions.onAttack && !unit.rested ? (
            <Button size="sm" variant="outline" className="h-11 w-full rounded-none px-1 text-[11px]" disabled={busy} onClick={() => actions.onAttack!(unit)}>
              Atacar
            </Button>
          ) : null}
          {actions.onDeclareTarget ? (
            <Button size="sm" className="h-11 w-full rounded-none bg-emerald-600 px-1 text-[11px] text-white hover:bg-emerald-500" disabled={busy} onClick={() => actions.onDeclareTarget!(unit)}>
              Mirar aqui
            </Button>
          ) : null}
          {actions.onBlocker && !unit.rested && hasKeyword(unit, "Blocker") ? (
            <Button size="sm" variant="outline" className="h-11 w-full rounded-none border-sky-500/50 px-1 text-[11px] text-sky-300" disabled={busy} onClick={() => actions.onBlocker!(unit)}>
              Blocker
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
