import { useEffect, useRef } from "react";
import { ScrollText, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BattleLogEntry, BattleLogKind } from "./battleLog";

const KIND_CLASS: Record<BattleLogKind, string> = {
  turn: "text-primary font-bold border-t border-primary/20 pt-1 mt-1",
  phase: "text-slate-500 uppercase text-[9px] tracking-wide",
  play: "text-slate-300",
  combat: "text-red-300",
  damage: "text-amber-300",
  effect: "text-emerald-300",
  system: "text-primary font-black",
};

interface BattleLogPanelProps {
  entries: BattleLogEntry[];
  onCollapse?: () => void;
  className?: string;
}

export function BattleLogPanel({ entries, onCollapse, className }: BattleLogPanelProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [entries.length]);

  return (
    <aside
      aria-label="Histórico de batalha"
      className={cn(
        "panel-cut surface-panel flex w-full flex-col border border-primary/20 p-3",
        className,
      )}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between border-b border-white/10 pb-1.5">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
          <ScrollText className="size-3.5" /> Log de combate ({entries.length})
        </p>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            title="Recolher painel de log"
            className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            <Minimize2 className="size-3" />
          </button>
        ) : null}
      </div>

      <div className="scrollbar-ghost min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-[11px] leading-snug">
        {entries.length === 0 ? (
          <div className="flex h-full items-center justify-center py-8 text-center text-slate-600">
            <p>Nenhum evento registrado ainda.</p>
          </div>
        ) : (
          entries.map((e, i) => (
            <p key={i} className={cn("break-words", KIND_CLASS[e.kind])}>
              {e.text}
            </p>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </aside>
  );
}
