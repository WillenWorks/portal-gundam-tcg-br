/* CenterDecisionModal.tsx — Modal central reservado a decisões RARAS, fora do
 * fluxo comum de jogada.
 *
 * docs/52 (redesenho tático): as decisões de jogada regular (alvo/custo,
 * declarar ataque, defender, passo de ação) saíram do centro da tela — vivem
 * no TopTacticalHUD (`MatchPrompt`, topo-centro, botões contextuais inline) e
 * no `ActionDock` (canto, ribbon compacto). O centro só reaparece pra 2 casos
 * que não fazem parte do fluxo comum de clique/seleção: a confirmação
 * explícita de encerrar turno (sob demanda, nunca trava a tela sozinha) e a
 * declaração de vitória por abandono do oponente (rara, não bloqueia jogadas
 * do dia a dia).
 */
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock } from "lucide-react";
import type { ActionDockState } from "./ActionDock";

export interface CenterDecisionModalProps {
  state: ActionDockState;
  busy?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  onEndTurn?: () => void;
  onCancelEndTurn?: () => void;
  onDeclareAttackPlayer?: () => void;
  onCancelAttack?: () => void;
  onSkipBlock?: () => void;
  onPass?: () => void;
  onToggleAutoPass?: (next: boolean) => void;
  onClaimAbandon?: () => void;
  /** Permite recolher temporariamente o modal para ver o campo livre */
  dismissible?: boolean;
  /** Se false, oculta o modal no estado idle a menos que o usuário tenha clicado em passar turno */
  confirmEndTurnOpen?: boolean;
}

export function CenterDecisionModal({
  state,
  busy,
  onEndTurn,
  onCancelEndTurn,
  onClaimAbandon,
  confirmEndTurnOpen,
}: CenterDecisionModalProps) {
  // docs/52 — jogada regular NUNCA abre modal central: essas decisões vivem
  // agora no TopTacticalHUD/ActionDock. `oppDecision`/`gameOver` já não tinham
  // modal central antes (GameOverOverlay assume o fim de jogo).
  if (
    state.kind === "pending" ||
    state.kind === "attacking" ||
    state.kind === "defending" ||
    state.kind === "actionStep" ||
    state.kind === "oppDecision" ||
    state.kind === "gameOver"
  ) {
    return null;
  }

  // No estado idle, só exibe se for o turno do jogador e se confirmEndTurnOpen for explicitamente true
  if (state.kind === "idle" && (!state.yourTurn || !confirmEndTurnOpen)) {
    return null;
  }

  function renderContent() {
    switch (state.kind) {
      case "idle":
        return (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/20 text-primary shadow-[0_0_15px_rgba(56,189,248,0.35)]">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                Sua Vez · {state.phaseLabel}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-portal">
                {state.turnNumber !== undefined ? `Turno ${state.turnNumber} · ` : ""}
                {state.timerSeconds !== null ? `${state.timerSeconds}s restantes` : "Deseja encerrar o turno?"}
              </p>
            </div>
            <div className="mt-1 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="h-11 w-full rounded-arena bg-primary px-6 font-bold uppercase tracking-wider text-primary-foreground shadow-lg hover:bg-primary/90 sm:w-auto"
                disabled={busy}
                onClick={onEndTurn}
              >
                Encerrar Turno
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 w-full rounded-arena border-white/20 bg-slate-900/60 px-5 font-bold uppercase tracking-wider text-slate-200 hover:bg-slate-800 sm:w-auto"
                disabled={busy}
                onClick={onCancelEndTurn}
              >
                Continuar Jogando
              </Button>
            </div>
          </div>
        );

      case "abandonAvailable":
        return (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)] animate-pulse">
              <AlertTriangle className="size-6" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-300">
                Oponente Inativo
              </p>
              <p className="mt-1 text-xs text-soft">
                O oponente está inativo há {state.idleSeconds}s. Você pode declarar vitória por W.O.:
              </p>
            </div>
            <div className="mt-2 flex w-full justify-center">
              <Button
                size="lg"
                className="h-11 rounded-arena bg-amber-400 font-bold uppercase tracking-wider text-black shadow-lg hover:bg-amber-300"
                disabled={busy}
                onClick={onClaimAbandon}
              >
                Declarar Vitória por Abandono
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  const borderTone =
    state.kind === "abandonAvailable"
      ? "border-amber-400/60 shadow-[0_0_30px_rgba(251,191,36,0.25)]"
      : "border-primary/50 shadow-[0_0_30px_rgba(56,189,248,0.25)]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 pointer-events-none animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "pointer-events-auto panel-cut hero-surface w-full max-w-[min(28rem,calc(100vw-2rem))] border bg-slate-950/95 p-4 sm:p-5 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-200",
          borderTone,
        )}
      >
        {renderContent()}
      </div>
    </div>
  );
}
