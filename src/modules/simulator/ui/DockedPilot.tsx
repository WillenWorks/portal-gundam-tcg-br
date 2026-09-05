/* docs/19, Sessão 3 — Piloto "acoplado" (docking) visualmente na base da
 * Unit pareada.
 *
 * Sprint 5 (refinamento Arena 3D) — virou um OVERLAY absoluto na base do
 * slot. V6.3 (docs/34) — voltou a ser um elemento de FLUXO normal: o
 * `BattleSlot` reserva uma tira própria abaixo da arte da Unit só pro Piloto.
 * Mostra a faixa: rosto + modificador impresso de combate (`+AP/+HP`, CR
 * 3-3-5). O nome fica no `title`/`aria-label`.
 *
 * Frente 4 (feedback Willen 3ª rodada): o selo "LINK" SAIU daqui — o texto
 * "+2/+1 LINK" era largo demais e truncava ("+2/+1 LI..."). O modificador do
 * piloto já se reflete no AP/HP FINAL exibido da Unit; o selo curto "LINK"
 * agora fica na própria arte da Unit (`BattleSlot`). Aqui o vínculo aparece
 * só pelo realce âmbar da tira. */
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
        // Frente 4 (feedback Willen 2ª rodada): avatar/texto escalam com `--card-w-std`.
        "flex h-full w-full cursor-pointer items-center gap-[0.25em] overflow-hidden border-t px-1 py-px",
        linked ? "border-amber-400/80 bg-amber-500/25" : "border-white/10 bg-black/75",
      )}
    >
      <span className="size-[clamp(0.9375rem,calc(var(--card-w-std,2.17rem)*0.3),1.75rem)] shrink-0 overflow-hidden rounded-full border border-white/25 bg-black/40">
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : null}
      </span>
      {mod ? (
        <span className="shrink-0 font-mono text-[clamp(0.5625rem,calc(var(--card-w-std,2.17rem)*0.16),0.9375rem)] font-bold leading-none tabular-nums text-emerald-300">
          {mod}
        </span>
      ) : null}
    </button>
  );
}
