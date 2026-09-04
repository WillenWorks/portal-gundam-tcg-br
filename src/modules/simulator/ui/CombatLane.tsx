/* docs/19, Sessão 3 — faixa de combate. Duas partes:
 *  1. a LINHA DE MIRA ponto-a-ponto: um SVG que ocupa o viewport inteiro
 *     (`fixed`, `pointer-events-none`) e liga o centro do card atacante ao
 *     centro do alvo (Unit ou Battle Area do jogador). Re-mede no scroll do
 *     tabuleiro e no resize da janela.
 *  2. o BADGE central: nomes + AP de cada lado + step atual — continua útil
 *     como leitura rápida do combate. */
import { useEffect, useReducer } from "react";
import { Swords, ArrowRight } from "lucide-react";
import type { CombatState, CardInstance, GameState, PlayerId } from "@/modules/simulator/engine/types";
import { effectiveAp } from "@/modules/simulator/engine/types";
import { playerAreaKey } from "./useBoardElements";

interface CombatLaneProps {
  combat: CombatState;
  attacker: CardInstance | null;
  /** Unit alvo, quando o ataque não é no jogador. */
  targetUnit: CardInstance | null;
  viewerSeat: PlayerId;
  /** estado do jogo — pros AP do badge incluírem bônus estáticos. */
  state?: GameState;
  /** medidor de posição real de DOM (ver `useBoardElements`). */
  rectOf: (key: string) => DOMRect | null;
}

const STEP_LABEL: Record<CombatState["step"], string> = {
  attack: "Declaração",
  block: "Bloqueio",
  action: "Action Step",
  damage: "Dano",
  battleEnd: "Fim da batalha",
};

function center(r: DOMRect): { x: number; y: number } {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function CombatLane({ combat, attacker, targetUnit, viewerSeat, state, rectOf }: CombatLaneProps) {
  const [, remeasure] = useReducer((n: number) => n + 1, 0);

  const iAttack = combat.attackingPlayer === viewerSeat;
  const defender = combat.defendingPlayer;
  const targetKey = combat.currentTarget === "player" ? playerAreaKey(defender) : combat.currentTarget.unitId;

  // re-mede quando o layout pode ter mudado: scroll (inclusive de containers
  // internos, daí `capture`), resize, e um rAF logo após montar/trocar de alvo.
  // O handler é throttled por rAF pra não re-renderizar a cada evento de scroll.
  useEffect(() => {
    let scheduled = false;
    const on = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        remeasure();
      });
    };
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    on();
    const t = setTimeout(on, 140); // depois da transição de layout dos avisos
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("scroll", on, true);
      clearTimeout(t);
    };
  }, [combat.step, combat.attackerId, targetKey]);

  const attackerRect = rectOf(combat.attackerId);
  const targetRect = rectOf(targetKey);

  const targetLabel =
    combat.currentTarget === "player"
      ? iAttack
        ? "Jogador oponente"
        : "Você (jogador)"
      : (targetUnit?.def.nameEn ?? "Unit");

  return (
    <>
      {attackerRect && targetRect ? (
        <svg className="pointer-events-none fixed inset-0 z-[45] h-full w-full" aria-hidden>
          <defs>
            <marker id="combat-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(248 113 113)" />
            </marker>
          </defs>
          {(() => {
            const a = center(attackerRect);
            const b = center(targetRect);
            return (
              <>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="rgba(239,68,68,0.35)"
                  strokeWidth={6}
                  strokeLinecap="round"
                />
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="rgb(248 113 113)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray="7 6"
                  markerEnd="url(#combat-arrow)"
                >
                  <animate attributeName="stroke-dashoffset" from="26" to="0" dur="0.6s" repeatCount="indefinite" />
                </line>
                <circle cx={a.x} cy={a.y} r={4} fill="rgb(56 189 248)" />
                <circle cx={b.x} cy={b.y} r={7} fill="none" stroke="rgb(248 113 113)" strokeWidth={2}>
                  <animate attributeName="r" from="7" to="13" dur="0.9s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.9" to="0" dur="0.9s" repeatCount="indefinite" />
                </circle>
              </>
            );
          })()}
        </svg>
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 top-16 z-[46] flex justify-center px-2">
        <div className="panel-cut flex items-center gap-2 border border-red-500/50 bg-slate-950/92 px-3 py-1.5 text-xs shadow-[0_0_18px_rgba(239,68,68,0.35)]">
          <Swords className="size-4 shrink-0 text-red-400" />
          <span className="font-semibold text-soft">{attacker?.def.nameEn ?? "Atacante"}</span>
          {attacker ? <span className="font-black text-cyan-300">AP{effectiveAp(attacker, state)}</span> : null}
          <ArrowRight className="size-4 shrink-0 animate-pulse text-red-400" />
          <span className="font-semibold text-soft">{targetLabel}</span>
          {targetUnit ? <span className="font-black text-cyan-300">AP{effectiveAp(targetUnit, state)}</span> : null}
          <span className="ml-1 border-l border-white/15 pl-2 text-[9px] uppercase tracking-wide text-red-300/80">
            {STEP_LABEL[combat.step]}
          </span>
        </div>
      </div>
    </>
  );
}
