/* docs/19, Sessão 3 — Piloto "acoplado" (docking) visualmente na base da Unit pareada.
 * Atualização: imagem retangular completa sem recorte circular e sem filtro de cor,
 * ocupando todo o espaço reservado para a faixa do piloto abaixo da carta da unidade.
 */
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
  const src = artSrc(art, pilot.def.code, "sm") || artSrc(art, pilot.def.code, "xs");
  const title = `Piloto: ${pilotDef.nameEn}${linked ? " · Link ativo" : " · pareado"}`;

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onInspect ? () => onInspect(pilot) : undefined}
      className={cn(
        "group/pilot relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden border-t bg-slate-950/90 transition-colors",
        linked ? "border-amber-400" : "border-white/15",
      )}
    >
      {src ? (
        <img
          src={src}
          alt={pilotDef.nameEn}
          className="h-full w-full object-cover object-[center_25%] transition-transform duration-200 group-hover/pilot:scale-105"
        />
      ) : (
        <span className="truncate px-1 text-[clamp(0.55rem,calc(var(--card-w-std,2.17rem)*0.16),0.8rem)] font-bold uppercase tracking-wide text-slate-300">
          {pilotDef.nameEn}
        </span>
      )}
      {linked ? (
        <span
          className="pointer-events-none absolute right-0.5 top-0.5 z-10 rounded-xs bg-amber-400 px-1 py-0.2 text-[clamp(0.45rem,calc(var(--card-w-std,2.17rem)*0.12),0.65rem)] font-black uppercase leading-none text-black shadow-[0_0_6px_rgba(251,191,36,0.6)]"
          aria-hidden
        >
          Link
        </span>
      ) : null}
    </button>
  );
}
