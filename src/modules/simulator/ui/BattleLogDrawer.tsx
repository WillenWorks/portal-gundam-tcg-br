/* docs/19, Sessão 4 — feed de log de batalha em tempo real. Painel lateral
 * retrátil no desktop, gaveta no mobile. As linhas vêm de
 * `buildBattleLog(view)` (tradução pura em `battleLog.ts`). */
import { useEffect, useRef } from "react";
import { ScrollText, X } from "lucide-react";
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

interface BattleLogDrawerProps {
  entries: BattleLogEntry[];
  open: boolean;
  onToggle: () => void;
}

export function BattleLogDrawer({ entries, open, onToggle }: BattleLogDrawerProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [entries.length, open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="fixed right-0 top-1/3 z-40 flex items-center gap-1 border border-r-0 border-primary/30 bg-slate-950/95 px-2 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary [writing-mode:vertical-rl]"
      >
        <ScrollText className="size-3.5 rotate-90" />
        Log ({entries.length})
      </button>
    );
  }

  return (
    <aside className="fixed right-0 top-0 z-40 flex h-full w-64 max-w-[80vw] flex-col border-l border-primary/30 bg-slate-950/97">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
          <ScrollText className="size-3.5" /> Log de batalha
        </p>
        <button type="button" onClick={onToggle} className="p-1 text-slate-400 hover:text-slate-200">
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-2 text-[11px] leading-snug">
        {entries.length === 0 ? (
          <p className="text-slate-600">Sem eventos ainda.</p>
        ) : (
          entries.map((e, i) => (
            // key por posição: a janela de eventLog desliza no servidor, então `seq` não é estável entre atualizações.
            <p key={i} className={cn(KIND_CLASS[e.kind])}>
              {e.text}
            </p>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </aside>
  );
}
