/* docs/19, Sessão 3 — Piloto "acoplado" (docking) visualmente na base da
 * Unit pareada. Badge LINK dourado brilhante quando a Link Condition
 * (Comprehensive Rules 3-2-6) está satisfeita.
 *
 * Sprint 5 (refinamento Arena 3D) — vira um OVERLAY absoluto na base do slot
 * (não cresce mais a altura externa da Unit). Mostra só a faixa do piloto:
 * rosto + modificador impresso de combate (`+AP/+HP`, CR 3-3-5) + selo LINK.
 * O nome fica no `title`/`aria-label` (tooltip), estilo Mobile Suit Arena. */
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
        "absolute inset-x-0 bottom-0 z-0 flex items-center gap-1 border-t px-1 py-px",
        linked ? "border-amber-400/80 bg-amber-500/25" : "border-white/15 bg-black/75",
      )}
    >
      <span className="size-3.5 shrink-0 overflow-hidden rounded-full border border-white/25 bg-black/40">
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : null}
      </span>
      {mod ? (
        <span className="font-mono text-[8px] font-bold tabular-nums text-emerald-300">{mod}</span>
      ) : null}
      {linked ? (
        <span className="ml-auto shrink-0 animate-pulse rounded-none bg-amber-400 px-0.5 text-[7px] font-black uppercase tracking-wide text-black shadow-[0_0_8px_rgba(251,191,36,0.6)] motion-reduce:animate-none">
          Link
        </span>
      ) : null}
    </button>
  );
}
