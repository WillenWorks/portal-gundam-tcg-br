/* docs/19, Sessão 3 — bandeja de Recursos: cada recurso é um card individual.
 * Ativos brilhantes, rested opacos/rotacionados, EX Resource destacado
 * (dourado). HUD: "Ativos: X / Nível: Y (total em campo)". */
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";
import type { ViewPlayerState, ViewCardInstance } from "@/modules/simulator/engine/viewState";
import type { CardInstance } from "@/modules/simulator/engine/types";

function isHidden(card: ViewCardInstance): boolean {
  return "hidden" in card && (card as { hidden?: boolean }).hidden === true;
}

interface ResourceTrayProps {
  player: ViewPlayerState;
  compact?: boolean;
}

export function ResourceTray({ player, compact }: ResourceTrayProps) {
  const resources = player.resourceArea.filter((c) => !isHidden(c)) as CardInstance[];
  const active = resources.filter((r) => !r.rested).length;
  const total = player.counts.resourceArea;
  const level = total;

  return (
    <div className="space-y-0.5">
      <p className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        <Zap className="size-2.5 text-cyan-400" />
        Ativos <span className="font-black text-cyan-300">{active}</span>
        <span className="text-slate-600">·</span>
        Nível <span className="font-black text-amber-300">{level}</span>
        <span className="text-slate-600">({total} em campo)</span>
      </p>
      {resources.length === 0 ? (
        <p className="text-[9px] text-muted-portal">Nenhum recurso.</p>
      ) : (
        <div className="flex flex-wrap gap-0.5">
          {resources.map((r) => {
            const ex = r.def.isToken;
            return (
              <span
                key={r.instanceId}
                title={ex ? "EX Resource" : "Recurso"}
                className={cn(
                  "block border",
                  compact ? "h-4 w-3" : "h-6 w-4",
                  ex
                    ? "border-amber-400/80 bg-amber-500/25 shadow-[0_0_5px_rgba(251,191,36,0.5)]"
                    : r.rested
                      ? "rotate-[18deg] border-white/10 bg-slate-700/40"
                      : "border-cyan-400/50 bg-cyan-500/25",
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
