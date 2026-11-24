/* Pedaços da tela de partida que mostram tempo (prazo do turno, oponente inativo, volta ao lobby). Cada um lê o
 * relógio por conta própria (`useClockNow`), então a virada do segundo re-renderiza só eles, não a
 * `SimulatorMatchPage` inteira. Todos os instantes chegam já no relógio LOCAL (epoch do servidor − offset). */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSiteLanguage } from "@/i18n/siteLanguage";
import { ActionDock, type ActionDockProps, type ActionDockState } from "./ActionDock";
import { CenterDecisionModal, type CenterDecisionModalProps } from "./CenterDecisionModal";
import { GameOverOverlay } from "./GameOverOverlay";
import { secondsSince, secondsUntil, useClockNow } from "./matchClock";

export function ClockedActionDock({ deadlineAt, ...props }: Omit<ActionDockProps, "timerSeconds"> & { deadlineAt: number | null }) {
  const now = useClockNow();
  return <ActionDock {...props} timerSeconds={secondsUntil(deadlineAt, now)} />;
}

/**
 * O estado vem da página sem os números do relógio; aqui entram o tempo do turno (`idle`) e há quanto tempo o
 * oponente está inativo (`abandonAvailable`).
 */
export function ClockedCenterDecisionModal({
  state,
  deadlineAt,
  opponentSeenAt,
  ...props
}: CenterDecisionModalProps & { deadlineAt: number | null; opponentSeenAt: number | null }) {
  const now = useClockNow();
  let clocked: ActionDockState = state;
  if (state.kind === "idle") clocked = { ...state, timerSeconds: secondsUntil(deadlineAt, now) };
  else if (state.kind === "abandonAvailable") clocked = { ...state, idleSeconds: secondsSince(opponentSeenAt, now) ?? 0 };
  return <CenterDecisionModal {...props} state={clocked} />;
}

export function ClockedGameOverOverlay({ redirectAt, ...props }: Omit<Parameters<typeof GameOverOverlay>[0], "redirectSeconds"> & { redirectAt: number | null }) {
  const now = useClockNow();
  return <GameOverOverlay {...props} redirectSeconds={secondsUntil(redirectAt, now)} />;
}

/**
 * Avisos do relógio de turno (pedido do Willen, 2026-09-04): sem eles o turno (300 s) podia acabar "sem aviso".
 * Só na própria Main Phase; cada limiar dispara uma vez por prazo (prazo novo = turno novo ou timer rearmado).
 * Não desenha nada.
 */
export function TurnTimeWarnings({ deadlineAt, active }: { deadlineAt: number | null; active: boolean }) {
  const { tr } = useSiteLanguage();
  const now = useClockNow();
  const track = useRef<{ deadline: number | null; fired: Set<number> }>({ deadline: null, fired: new Set() });
  const secondsLeft = active ? secondsUntil(deadlineAt, now) : null;
  useEffect(() => {
    if (secondsLeft === null) return;
    if (track.current.deadline !== deadlineAt) track.current = { deadline: deadlineAt, fired: new Set() };
    const thresholds: Array<{ at: number; fire: () => void }> = [
      { at: 150, fire: () => toast.warning(tr("Metade do tempo do seu turno já passou.", "Half of your turn time has passed.")) },
      { at: 50, fire: () => toast.warning(tr("Faltam 50s pro seu turno acabar.", "50s left in your turn.")) },
      { at: 10, fire: () => toast.error(tr("10s! O turno vai encerrar sozinho e entrar no Action Step.", "10s! Your turn will end on its own and move to the Action Step.")) },
    ];
    for (const t of thresholds) {
      if (secondsLeft <= t.at && !track.current.fired.has(t.at)) {
        track.current.fired.add(t.at);
        t.fire();
      }
    }
  }, [secondsLeft, deadlineAt, tr]);
  return null;
}
