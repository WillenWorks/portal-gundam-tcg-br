/* docs/19, Sessão 3 — um dos 6 slots fixos da Battle Area. Moldura tática
 * escura com acento ciano/dourado; Unit com badges de AP efetivo / HP
 * restante; overlay "RESTED"; Piloto acoplado (DockedPilot) com badge LINK;
 * realce verde/dourado quando é alvo legal de uma ação.
 *
 * Sprint 5 (refinamento Arena 3D) — o slot é RIGOROSAMENTE `aspect-[63/88]`.
 *
 * Ações de campo — cluster no canto SUP. DIREITO (`CardCornerActions`): "Ver"
 * (olho) SEMPRE ancorado no canto; Atacar / Ativar / Blocker / Mirar aparecem à
 * esquerda dele quando a jogada é possível. Sem badge "BLK" na carta — o botão
 * de escudo só aparece quando é hora de bloquear. */
import { Crosshair, Eye, ShieldCheck, Swords, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardInstance } from "@/modules/simulator/engine/types";
import { effectiveAp, effectiveHp, hasKeyword } from "@/modules/simulator/engine/types";
import { isGenericArtCard, type ArtLookup } from "./cardArt";
import { CardCornerActions, type CornerAction } from "./CardCornerActions";
import { CardFace } from "./CardFace";
import { DockedPilot } from "./DockedPilot";

export interface BattleSlotActions {
  onAttack?: (unit: CardInstance) => void;
  onDeclareTarget?: (unit: CardInstance) => void;
  onBlocker?: (unit: CardInstance) => void;
  /** 【Activate·Main】 de carta em campo (ex.: Tallgeese "Set active") — Etapa 3. */
  onActivate?: (unit: CardInstance) => void;
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

  const showAttack = Boolean(actions?.onAttack) && !unit.rested;
  const showTarget = Boolean(actions?.onDeclareTarget);
  const showBlocker = Boolean(actions?.onBlocker) && !unit.rested && hasKeyword(unit, "Blocker");
  const showActivate = Boolean(actions?.onActivate);

  // "Ver" SEMPRE; contexto à esquerda dele (Atacar / Ativar / Blocker / Mirar).
  const cornerActions: CornerAction[] = [];
  if (showAttack) cornerActions.push({ key: "attack", icon: Swords, label: "Atacar", tone: "primary", disabled: busy, onClick: () => actions!.onAttack!(unit) });
  if (showActivate) cornerActions.push({ key: "activate", icon: Zap, label: "Ativar habilidade", tone: "accent", disabled: busy, onClick: () => actions!.onActivate!(unit) });
  if (showBlocker) cornerActions.push({ key: "blocker", icon: ShieldCheck, label: "Ativar Blocker", tone: "sky", disabled: busy, onClick: () => actions!.onBlocker!(unit) });
  if (showTarget) cornerActions.push({ key: "target", icon: Crosshair, label: "Mirar aqui", tone: "emerald", disabled: busy, onClick: () => actions!.onDeclareTarget!(unit) });
  if (onInspect) cornerActions.push({ key: "view", icon: Eye, label: `Ver ${unit.def.nameEn}`, tone: "view", onClick: () => onInspect(unit) });

  const hoverProps = onHoverCard
    ? {
        onMouseEnter: () => onHoverCard(unit),
        onMouseLeave: () => onHoverCard(null),
        onFocus: () => onHoverCard(unit),
        onBlur: () => onHoverCard(null),
      }
    : {};

  return (
    <div
      ref={registerRef}
      {...hoverProps}
      className={cn(
        "group/slot relative aspect-[63/88] w-full border bg-gradient-to-b from-slate-900/80 to-black/80 transition-shadow",
        // no hover/foco o slot sobe no empilhamento pra a tira de ações (canto
        // sup. direito, levemente pra fora) passar por cima do slot vizinho.
        "hover:z-30 focus-within:z-30",
        legalTarget
          ? "border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.55)]"
          : selected || isAttacker
            ? "border-primary shadow-[0_0_10px_rgba(56,189,248,0.5)]"
            : "border-cyan-500/20",
      )}
    >
      {/* corpo da carta: só é clicável quando é ALVO LEGAL de uma seleção
          (pareamento / mira de efeito). Inspecionar é sempre pelo botão "Ver"
          no canto — remove o conflito "clicar em Atacar abre a imagem". */}
      <div
        role={legalTarget ? "button" : undefined}
        tabIndex={legalTarget ? 0 : undefined}
        onClick={legalTarget && onSelect ? () => onSelect(unit) : undefined}
        onKeyDown={
          legalTarget && onSelect
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(unit);
                }
              }
            : undefined
        }
        className={cn("relative block h-full w-full", legalTarget ? "cursor-pointer" : "cursor-default")}
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
        </CardFace>
      </div>

      {pilot ? <DockedPilot pilot={pilot} unit={unit} art={art} onInspect={onInspect} /> : null}

      <CardCornerActions actions={cornerActions} />
    </div>
  );
}
