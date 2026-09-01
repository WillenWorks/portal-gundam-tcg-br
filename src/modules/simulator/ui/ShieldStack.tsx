/* docs/19, Sessão 3 — pilha de Shields (1 a 6) com contador claro e feedback
 * de dano. Shields são sempre face-down (redação de informação, viewState.ts),
 * então a pilha mostra versos empilhados com leve deslocamento + o número. */
import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";
import type { ViewCardInstance } from "@/modules/simulator/engine/viewState";

interface ShieldStackProps {
  shields: ViewCardInstance[];
  /** quando true, cada shield é clicável como alvo (ex.: efeito que mira shield). */
  selectable?: boolean;
  selectedIds?: string[];
  onSelect?: (instanceId: string) => void;
  /** shields que acabaram de cair (feedback de dano) — instanceIds. */
  justBrokenIds?: string[];
}

export function ShieldStack({ shields, selectable, selectedIds = [], onSelect, justBrokenIds = [] }: ShieldStackProps) {
  return (
    <div>
      <p className="mb-0.5 flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        <Shield className="size-2.5" /> Shields
        <span className={cn("ml-auto rounded-none px-1 font-black", shields.length <= 1 ? "bg-red-600 text-white" : "bg-white/10 text-slate-200")}>
          {shields.length}/6
        </span>
      </p>
      {shields.length === 0 ? (
        <div className="flex aspect-[63/88] w-11 items-center justify-center border border-dashed border-red-500/40 text-[8px] uppercase text-red-400/70">
          vazio
        </div>
      ) : (
        <div className="relative h-[3.6rem] w-11">
          {shields.slice(0, 6).map((shield, i) => {
            const selected = selectedIds.includes(shield.instanceId);
            const broken = justBrokenIds.includes(shield.instanceId);
            return (
              <button
                key={shield.instanceId}
                type="button"
                disabled={!selectable}
                onClick={() => onSelect?.(shield.instanceId)}
                style={{ top: `${i * 6}px`, left: `${i * 2}px`, zIndex: i }}
                className={cn(
                  "absolute aspect-[63/88] w-11 overflow-hidden border transition-transform",
                  selected ? "border-primary ring-2 ring-primary/60" : "border-cyan-500/25",
                  selectable ? "cursor-pointer hover:-translate-y-0.5" : "cursor-default",
                  broken && "animate-ping border-red-500",
                )}
              >
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black">
                  <Shield className="size-1/3 text-primary/25" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
