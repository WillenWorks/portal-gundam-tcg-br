/* V2, docs/27 — Comprehensive Rules: Battle Area comporta no máx. 6 Units.
 * Se uma jogada (deploy da mão OU um token spawnado por efeito, ex. White
 * Base/Corsica Base) resultar em 7+, a jogada NUNCA é bloqueada — ela sempre
 * entra em campo, e o excesso é resolvido depois via rules management: o
 * próprio jogador escolhe qual das suas Units vai pro trash (não é
 * "destruída"). Mesmo padrão visual de `TriggerOrderModal`.
 *
 * docs/56 tarefa 3 — virou uma BARRA TÁTICA no topo (era lista vertical
 * centralizada com `bg-black/85` cobrindo a tela): chips horizontais com
 * scroll, sem fundo escuro por trás — a Battle Area, Recursos e mão do
 * jogador continuam visíveis enquanto ele escolhe. */
import type { CardInstance } from "@/modules/simulator/engine/types";
import { Layers } from "lucide-react";
import { useCardLanguage } from "@/i18n/useCardLanguage";

interface ZoneOverflowModalProps {
  /** As próprias Units elegíveis (já resolvidas contra `decision.legalTargets`) — nunca menos de 7. */
  units: CardInstance[];
  busy?: boolean;
  onResolve: (instanceId: string) => void;
  /** Helper para stats efetivos (AP/HP) em jogo conforme CONTRATO-MOTOR §3 */
  getEffectiveStats?: (u: CardInstance) => { ap: number; hp: number };
}

export function ZoneOverflowModal({ units, busy, onResolve, getEffectiveStats }: ZoneOverflowModalProps) {
  const { language } = useCardLanguage();
  const isEn = language === "EN";

  return (
    <div className="fixed inset-0 z-[60] flex justify-center px-3 pt-3 sm:pt-5 animate-in fade-in duration-200 motion-reduce:animate-none">
      <div className="pointer-events-auto panel-cut hero-surface mx-auto w-[min(94vw,40rem)] border border-primary/40 p-3 shadow-2xl backdrop-blur-md sm:p-4">
        <p className="flex items-center justify-center gap-1.5 text-center text-sm font-black uppercase tracking-[0.2em] text-primary">
          <Layers className="size-4" /> {isEn ? "Battle Area Full" : "Battle Area cheia"}
        </p>
        <p className="mt-1 text-center text-[10px] text-muted-portal">
          {isEn
            ? "You have more than 6 Units in play — choose 1 to send to trash (rules management, does not count as destroyed)."
            : "Você tem mais de 6 Units em campo — escolha 1 pra mandar pro descarte (rules management, não conta como destruída)."}
        </p>
        <ul className="scrollbar-ghost mt-3 flex gap-2 overflow-x-auto pb-1">
          {units.map((u) => {
            const stats = getEffectiveStats ? getEffectiveStats(u) : { ap: u.def.ap ?? 0, hp: u.def.hp ?? 0 };
            return (
              <li key={u.instanceId} className="shrink-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onResolve(u.instanceId)}
                  className="flex min-h-11 w-36 flex-col items-start gap-0.5 border border-white/10 bg-black/40 px-2.5 py-1.5 text-left text-xs text-soft transition hover:border-primary/60 hover:bg-primary/10 disabled:opacity-40"
                >
                  <span className="w-full truncate font-bold text-white">{u.def.nameEn}</span>
                  <span className="text-[10px] font-semibold text-primary">
                    AP {stats.ap} / HP {stats.hp}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
