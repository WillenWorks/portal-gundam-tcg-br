/* docs/19, Sessão 3 — bandeja de Recursos: cada recurso é um card individual.
 * Ativos brilhantes, rested opacos/rotacionados, EX Resource destacado
 * (dourado). HUD: "Ativos: X / Nível: Y (total em campo)".
 *
 * 2026-09-01: seleção manual de quais recursos restar pra pagar um custo
 * (`selectable`/`selectedIds`/`onSelect`). Só recursos ATIVOS são clicáveis;
 * o EX Resource ganha aviso reforçado (ele SAI DO JOGO ao pagar, não volta). */
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
  /** liga a seleção manual de recursos pra pagar custo (só faz sentido na bandeja do próprio jogador). */
  selectable?: boolean;
  selectedIds?: string[];
  onSelect?: (instanceId: string) => void;
}

export function ResourceTray({ player, compact, selectable, selectedIds, onSelect }: ResourceTrayProps) {
  const resources = player.resourceArea.filter((c) => !isHidden(c)) as CardInstance[];
  const active = resources.filter((r) => !r.rested).length;
  const total = player.counts.resourceArea;
  const level = total;
  const selected = selectedIds ?? [];

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
            const isSelected = selected.includes(r.instanceId);
            const pickable = Boolean(selectable && onSelect && !r.rested);
            const cls = cn(
              "block border transition-all",
              compact ? "h-4 w-3" : "h-6 w-4",
              isSelected
                ? "scale-110 border-emerald-400 bg-emerald-500/40 shadow-[0_0_7px_rgba(52,211,153,0.7)]"
                : ex
                  ? "border-amber-400/80 bg-amber-500/25 shadow-[0_0_5px_rgba(251,191,36,0.5)]"
                  : r.rested
                    ? "rotate-[18deg] border-white/10 bg-slate-700/40"
                    : "border-cyan-400/50 bg-cyan-500/25",
              pickable && "cursor-pointer hover:border-emerald-300",
            );
            const title = ex
              ? "EX Resource — SAI DO JOGO se usado pra pagar custo (não volta)"
              : r.rested
                ? "Recurso (rested)"
                : "Recurso ativo";
            return pickable ? (
              <button key={r.instanceId} type="button" title={title} onClick={() => onSelect!(r.instanceId)} className={cls} />
            ) : (
              <span key={r.instanceId} title={title} className={cls} />
            );
          })}
        </div>
      )}
    </div>
  );
}
