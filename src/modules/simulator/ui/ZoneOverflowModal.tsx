/* V2, docs/27 — Comprehensive Rules: Battle Area comporta no máx. 6 Units.
 * Se uma jogada (deploy da mão OU um token spawnado por efeito, ex. White
 * Base/Corsica Base) resultar em 7+, a jogada NUNCA é bloqueada — ela sempre
 * entra em campo, e o excesso é resolvido depois via rules management: o
 * próprio jogador escolhe qual das suas Units vai pro trash (não é
 * "destruída"). Mesmo padrão visual de `TriggerOrderModal`. */
import type { CardInstance } from "@/modules/simulator/engine/types";
import { Layers } from "lucide-react";

interface ZoneOverflowModalProps {
  /** As próprias Units elegíveis (já resolvidas contra `decision.legalTargets`) — nunca menos de 7. */
  units: CardInstance[];
  busy?: boolean;
  onResolve: (instanceId: string) => void;
}

export function ZoneOverflowModal({ units, busy, onResolve }: ZoneOverflowModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
      <div className="panel-cut hero-surface w-full max-w-sm border border-primary/40 p-4">
        <p className="flex items-center justify-center gap-1.5 text-center text-sm font-black uppercase tracking-[0.2em] text-primary">
          <Layers className="size-4" /> Battle Area cheia
        </p>
        <p className="mt-1 text-center text-[10px] text-muted-portal">
          Você tem mais de 6 Units em campo — escolha 1 pra mandar pro descarte (rules management, não conta como destruída).
        </p>
        <ul className="mt-3 space-y-1">
          {units.map((u) => (
            <li key={u.instanceId}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onResolve(u.instanceId)}
                className="flex w-full items-center justify-between gap-2 border border-white/10 bg-black/40 px-2 py-1.5 text-left text-xs text-soft transition hover:border-primary/60 hover:bg-primary/10 disabled:opacity-40"
              >
                <span className="min-w-0 flex-1 truncate">{u.def.nameEn}</span>
                <span className="shrink-0 text-[10px] text-muted-portal">
                  AP{u.def.ap ?? 0}/HP{u.def.hp ?? 0}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
