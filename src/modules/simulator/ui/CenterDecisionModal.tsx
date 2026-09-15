/* CenterDecisionModal.tsx — Modais de decisão e mensagens centralizadas na tela
 * Centraliza as decisões cruciais de jogo (encerrar turno, passar turno, definir blocker,
 * declarar ataque, confirmar alvos) em qualquer tipo de display (desktop, tablet, mobile landscape).
 */
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Clock, Shield, ShieldAlert, Swords, X, Zap } from "lucide-react";
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

const SCOPE_LABEL: Record<"combat" | "endPhase", string> = {
  combat: "Combate",
  endPhase: "Fim de Turno",
};

export function CenterDecisionModal({
  state,
  busy,
  onConfirm,
  onCancel,
  onEndTurn,
  onCancelEndTurn,
  onDeclareAttackPlayer,
  onCancelAttack,
  onSkipBlock,
  onPass,
  onToggleAutoPass,
  onClaimAbandon,
  confirmEndTurnOpen,
}: CenterDecisionModalProps) {
  // Estados que não demandam modal central imediato (idle de oponente ou gameOver que já tem GameOverOverlay)
  if (state.kind === "oppDecision" || state.kind === "gameOver") {
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
                onClick={onCancelEndTurn ?? onCancel}
              >
                Continuar Jogando
              </Button>
            </div>
          </div>
        );

      case "defending":
        return (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-sky-500/20 text-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.4)] animate-pulse">
              <ShieldAlert className="size-6" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-sky-300">
                Ataque Recebido!
              </p>
              <p className="mt-1 text-xs text-soft">
                Ative um &lt;Blocker&gt; em uma Unit no campo ou passe a defesa:
              </p>
            </div>
            <div className="mt-2 flex w-full justify-center">
              <Button
                size="lg"
                variant="outline"
                className="h-11 w-full rounded-arena border-sky-400/60 bg-sky-950/40 font-bold uppercase tracking-wider text-sky-200 shadow-md hover:bg-sky-900/50 sm:w-auto"
                disabled={busy}
                onClick={onSkipBlock}
              >
                Não Bloquear
              </Button>
            </div>
          </div>
        );

      case "actionStep": {
        const nothingToDo = state.hasPlay === false;
        return (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)] animate-pulse">
              <Zap className="size-6" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-300">
                Passo de Ação ({SCOPE_LABEL[state.scope]})
              </p>
              <p className="mt-1 text-xs text-muted-portal">
                {nothingToDo ? "Nenhum comando 【Action】 para jogar agora." : "Jogue um comando 【Action】 ou passe:"}
              </p>
            </div>
            <div className="mt-2 flex w-full flex-col items-center gap-2">
              <Button
                size="lg"
                className={cn(
                  "h-11 w-full rounded-arena font-bold uppercase tracking-wider shadow-lg sm:w-auto",
                  nothingToDo
                    ? "bg-amber-400 text-black hover:bg-amber-300"
                    : "border border-amber-400/60 bg-amber-950/40 text-amber-200 hover:bg-amber-900/50",
                )}
                disabled={busy}
                onClick={onPass}
              >
                {nothingToDo ? "Passar Turno (Nada a Fazer)" : "Passar Turno"}
              </Button>
              {onToggleAutoPass ? (
                <button
                  type="button"
                  className="mt-1 text-[11px] text-amber-300/80 underline decoration-dotted underline-offset-4 hover:text-amber-200"
                  onClick={() => onToggleAutoPass(!state.autoPass)}
                >
                  Auto-pass: {state.autoPass ? "LIGADO (pular automático quando sem jogada)" : "desligado"}
                </button>
              ) : null}
            </div>
          </div>
        );
      }

      case "attacking":
        return (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
              <Swords className="size-6" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-red-300">
                Ataque Declarado
              </p>
              <p className="mt-1 text-xs font-semibold text-soft">
                Atacando com <span className="text-white font-bold">{state.attackerName}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-portal">
                Escolha uma Unit descansada no campo ou declare ataque direto ao jogador:
              </p>
            </div>
            <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="h-11 rounded-arena bg-red-600 font-bold uppercase tracking-wider text-white shadow-lg hover:bg-red-500"
                disabled={busy}
                onClick={onDeclareAttackPlayer}
              >
                Atacar o Jogador
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 rounded-arena border-white/20 font-bold uppercase tracking-wider text-soft hover:bg-white/10"
                onClick={onCancelAttack}
              >
                Cancelar
              </Button>
            </div>
          </div>
        );

      case "pending": {
        const step = `${state.verb}${state.cardName ? ` ${state.cardName}` : ""} · ${state.selectedCount} selecionada(s)`;
        return (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/20 text-primary shadow-[0_0_20px_rgba(56,189,248,0.4)]">
              <Shield className="size-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                Definir Alvo / Recursos
              </p>
              <p className="mt-1 text-sm font-bold text-soft">{step}</p>
              {state.hint ? <p className="mt-0.5 text-[11px] text-muted-portal">{state.hint}</p> : null}
              {state.cost ? (
                <p
                  className={cn(
                    "mt-1 text-xs font-black tabular-nums",
                    state.cost.paid >= state.cost.total ? "text-emerald-300" : "text-amber-300",
                  )}
                >
                  Recursos pagos: {state.cost.paid} / {state.cost.total}
                </p>
              ) : null}
            </div>
            <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="h-11 rounded-arena bg-primary font-bold uppercase tracking-wider text-primary-foreground shadow-lg hover:bg-primary/90"
                disabled={busy || !state.canConfirm}
                onClick={onConfirm}
              >
                Confirmar
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 rounded-arena border-white/20 font-bold uppercase tracking-wider text-soft hover:bg-white/10"
                onClick={onCancel}
              >
                Cancelar
              </Button>
            </div>
          </div>
        );
      }

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
    state.kind === "attacking"
      ? "border-red-500/60 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
      : state.kind === "actionStep" || state.kind === "abandonAvailable"
        ? "border-amber-400/60 shadow-[0_0_30px_rgba(251,191,36,0.25)]"
        : state.kind === "defending"
          ? "border-sky-400/60 shadow-[0_0_30px_rgba(56,189,248,0.25)]"
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
