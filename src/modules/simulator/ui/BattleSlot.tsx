/* docs/19, Sessão 3 — um dos 6 slots fixos da Battle Area. Moldura tática
 * escura com acento ciano/dourado; Unit com badges de AP efetivo / HP
 * restante; overlay "RESTED"; Piloto acoplado (DockedPilot) com badge LINK;
 * realce verde/dourado quando é alvo legal de uma ação.
 *
 * Sprint 5 (refinamento Arena 3D) — o slot é RIGOROSAMENTE `aspect-[63/88]`.
 *
 * Ações de campo (Atacar / Ativar / Blocker / Mirar) — tira de ícones no canto
 * SUP. DIREITO da carta (igual ao "Jogar" da mão), escondida até o hover/foco,
 * `flex-row-reverse` (Atacar no canto, ativações à esquerda). Só aparecem quando
 * a jogada é possível. */
import type { LucideIcon } from "lucide-react";
import { Crosshair, ShieldCheck, Swords, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardInstance } from "@/modules/simulator/engine/types";
import { effectiveAp, effectiveHp, hasKeyword } from "@/modules/simulator/engine/types";
import { isGenericArtCard, type ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";
import { DockedPilot } from "./DockedPilot";

export interface BattleSlotActions {
  onAttack?: (unit: CardInstance) => void;
  onDeclareTarget?: (unit: CardInstance) => void;
  onBlocker?: (unit: CardInstance) => void;
  /** 【Activate·Main】 de carta em campo (ex.: Tallgeese "Set active") — Etapa 3. */
  onActivate?: (unit: CardInstance) => void;
}

type BtnTone = "primary" | "emerald" | "accent" | "sky";
const TONE_CLASS: Record<BtnTone, string> = {
  primary: "bg-primary/95 text-black hover:bg-primary",
  emerald: "bg-emerald-500 text-white hover:bg-emerald-400",
  accent: "bg-accent text-black hover:bg-accent/90",
  sky: "bg-sky-500 text-white hover:bg-sky-400",
};

function IconBtn({
  icon: Icon,
  label,
  tone,
  busy,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  tone: BtnTone;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={busy}
      // stopPropagation: sem isso o clique sobe pro <button> da arte (inspeção)
      // e a ação nunca dispara — era o bug "aparece mas não clica".
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex size-6 items-center justify-center rounded-none border border-black/30 shadow-lg transition-colors disabled:opacity-50 motion-reduce:transition-none",
        TONE_CLASS[tone],
      )}
    >
      <Icon className="size-3.5" aria-hidden />
    </button>
  );
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

  const showAttack = actions?.onAttack && !unit.rested;
  const showTarget = Boolean(actions?.onDeclareTarget);
  const showBlocker = actions?.onBlocker && !unit.rested && hasKeyword(unit, "Blocker");
  const showActivate = Boolean(actions?.onActivate);
  const showActions = showAttack || showTarget || showBlocker || showActivate;

  return (
    <div
      ref={registerRef}
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
        // Igual ao "Jogar" da mão: escondida em repouso, aparece no hover/foco
        // NO canto sup. direito DA CARTA (sem vão de hover pra atravessar).
        // `flex-row-reverse` = Atacar no canto, ativações à esquerda dele
        // (float-right). `translateZ` mantém o hit-test acima do plano 3D da mesa.
        <div
          style={{ transform: "translateZ(30px)" }}
          className={cn(
            "absolute -top-2 right-0 z-30 flex flex-row-reverse items-start gap-1 transition-opacity duration-100 motion-reduce:transition-none",
            "opacity-0 pointer-events-none",
            "group-hover/slot:opacity-100 group-hover/slot:pointer-events-auto",
            "group-focus-within/slot:opacity-100 group-focus-within/slot:pointer-events-auto",
          )}
        >
          {showAttack ? <IconBtn icon={Swords} label="Atacar" tone="primary" busy={busy} onClick={() => actions!.onAttack!(unit)} /> : null}
          {showActivate ? <IconBtn icon={Zap} label="Ativar habilidade" tone="accent" busy={busy} onClick={() => actions!.onActivate!(unit)} /> : null}
          {showBlocker ? <IconBtn icon={ShieldCheck} label="Ativar Blocker" tone="sky" busy={busy} onClick={() => actions!.onBlocker!(unit)} /> : null}
          {showTarget ? <IconBtn icon={Crosshair} label="Mirar aqui" tone="emerald" busy={busy} onClick={() => actions!.onDeclareTarget!(unit)} /> : null}
        </div>
      ) : null}
    </div>
  );
}
