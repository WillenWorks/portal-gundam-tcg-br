/* docs/19, Sessão 3 — Piloto "acoplado" (docking) visualmente na base da
 * Unit pareada. Badge LINK dourado brilhante quando a Link Condition
 * (Comprehensive Rules 3-2-6) está satisfeita.
 *
 * Sprint 5 (refinamento Arena 3D) — virou um OVERLAY absoluto na base do
 * slot. V6.3 (docs/34) — voltou a ser um elemento de FLUXO normal: o
 * `BattleSlot` agora reserva uma tira própria abaixo da arte da Unit só pro
 * Piloto (antes o overlay cobria a parte de baixo da própria arte — achado
 * do Willen). Mostra só a faixa do piloto: rosto + modificador impresso de
 * combate (`+AP/+HP`, CR 3-3-5) + selo LINK. O nome fica no `title`/
 * `aria-label` (tooltip), estilo Mobile Suit Arena. */
import { cn } from "@/lib/utils";
import type { CardInstance } from "@/modules/simulator/engine/types";
import { effectivePilotDef, satisfiesLinkCondition } from "@/modules/simulator/engine/types";
import { artSrc, type ArtLookup } from "./cardArt";

interface DockedPilotProps {
  pilot: CardInstance;
  unit: CardInstance;
  art: ArtLookup;
  onInspect?: (card: CardInstance) => void;
}

export function DockedPilot({ pilot, unit, art, onInspect }: DockedPilotProps) {
  // card Command/Pilot no modo Piloto responde pelo nome do bloco 【Pilot】
  const pilotDef = effectivePilotDef(pilot);
  const linked = satisfiesLinkCondition(pilotDef, unit.def);
  const src = artSrc(art, pilot.def.code, "xs");
  const modAp = pilotDef.ap ?? 0;
  const modHp = pilotDef.hp ?? 0;
  const mod = modAp || modHp ? `+${modAp}/+${modHp}` : null;
  const title = `Piloto: ${pilotDef.nameEn}${mod ? ` (${mod})` : ""}${linked ? " · Link ativo" : " · pareado"}`;

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onInspect ? () => onInspect(pilot) : undefined}
      className={cn(
        // Frente 4 (feedback Willen 2ª rodada): chip de piloto legível — avatar
        // e textos escalam com `--card-w-std` (eram `size-3.5`/`text-[8px]`/
        // `text-[7px]` fixos).
        "flex h-full w-full items-center gap-[0.2em] overflow-hidden border-t px-1 py-px",
        linked ? "border-amber-400/80 bg-amber-500/25" : "border-white/10 bg-black/75",
      )}
    >
      <span className="size-[clamp(0.9375rem,calc(var(--card-w-std,2.17rem)*0.3),1.75rem)] shrink-0 overflow-hidden rounded-full border border-white/25 bg-black/40">
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : null}
      </span>
      {mod ? (
        <span className="shrink-0 font-mono text-[clamp(0.5625rem,calc(var(--card-w-std,2.17rem)*0.15),0.875rem)] font-bold leading-none tabular-nums text-emerald-300">
          {mod}
        </span>
      ) : null}
      {linked ? (
        <span className="ml-auto shrink-0 animate-pulse rounded-arena bg-amber-400 px-1 text-[clamp(0.5rem,calc(var(--card-w-std,2.17rem)*0.14),0.8125rem)] font-black uppercase leading-none tracking-wide text-black shadow-[0_0_8px_rgba(251,191,36,0.6)] motion-reduce:animate-none">
          Link
        </span>
      ) : null}
    </button>
  );
}
