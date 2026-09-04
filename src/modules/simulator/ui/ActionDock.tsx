/* Fase B (plano visual §03 "Action Dock", §06) — zona FIXA que é sempre a
 * resposta pra "o que faço agora?". Substitui a pilha de ~6 cards de decisão
 * centralizados de SimulatorMatchPage.tsx (gameOver, abandono, decisão do
 * oponente, Action Step, ataque, custo/pending, defesa, Main Phase) + o texto
 * de fase/turno/timer do HUD. Apresentacional puro, prop-driven: nenhum estado
 * de rede, nenhuma chamada de API — a página monta o `state` e passa callbacks.
 * Referências de HUD: canto de ação do Master Duel, corda de fim de turno do
 * Hearthstone, barra de comando do Mobile Suit Arena. */
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Shield, Sparkles, Swords, Zap } from "lucide-react";

export type ActionDockState =
  | { kind: "idle"; yourTurn: boolean; phaseLabel: string; timerSeconds: number | null; turnNumber?: number }
  | {
      kind: "pending";
      verb: string;
      cardName?: string;
      selectedCount: number;
      hint?: string;
      cost: { paid: number; total: number } | null;
      canConfirm: boolean;
    }
  | { kind: "attacking"; attackerName: string }
  | { kind: "defending" }
  | { kind: "actionStep"; scope: "combat" | "endPhase"; autoPass: boolean; hasPlay?: boolean }
  | { kind: "oppDecision"; label: string }
  | { kind: "abandonAvailable"; idleSeconds: number }
  | { kind: "gameOver"; won: boolean; reasonLabel: string; redirectSeconds: number | null };

export interface ActionDockProps {
  state: ActionDockState;
  /** trava todos os botões de ação enquanto uma ação de rede está em voo. */
  busy?: boolean;
  /** última linha do log, ecoada numa tira fina embaixo do dock. */
  logTail?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onEndTurn?: () => void;
  onDeclareAttackPlayer?: () => void;
  onCancelAttack?: () => void;
  onSkipBlock?: () => void;
  onPass?: () => void;
  onToggleAutoPass?: (next: boolean) => void;
  onClaimAbandon?: () => void;
  onLeaveAfterGameOver?: () => void;
}

const SCOPE_LABEL: Record<"combat" | "endPhase", string> = {
  combat: "combate",
  endPhase: "fim de turno",
};

/** cor de borda do dock por situação — semântica, não decoração. */
function accentClass(state: ActionDockState): string {
  switch (state.kind) {
    case "attacking":
      return "border-red-500/60";
    case "actionStep":
    case "abandonAvailable":
      return "border-amber-500/60";
    case "gameOver":
      return state.won ? "border-emerald-500/60" : "border-red-500/60";
    case "pending":
    case "defending":
      return "border-primary/50";
    case "oppDecision":
      return "border-white/10";
    case "idle":
      return "border-primary/25";
    default:
      return "border-primary/25";
  }
}

export function ActionDock({
  state,
  busy,
  logTail,
  onConfirm,
  onCancel,
  onEndTurn,
  onDeclareAttackPlayer,
  onCancelAttack,
  onSkipBlock,
  onPass,
  onToggleAutoPass,
  onClaimAbandon,
  onLeaveAfterGameOver,
}: ActionDockProps) {
  function renderBody() {
    switch (state.kind) {
      case "idle":
        return (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {/* V6.2 (docs/33): `clamp()` contínuo em vez de `sm:`/`md:` — as
                  rodadas anteriores bateram em limiares DIFERENTES por
                  arquivo pro MESMO dispositivo (docs/32, "achado de raiz");
                  um `clamp()` só não tem essa classe de bug (não tem 2
                  números pra desalinhar entre arquivos, é 1 fórmula). */}
              <p
                className={cn(
                  "truncate text-[clamp(0.6875rem,1.5vw,0.875rem)] font-black uppercase tracking-wide",
                  state.yourTurn ? "text-primary" : "text-muted-portal",
                )}
              >
                {state.yourTurn ? `Sua vez · ${state.phaseLabel}` : "Vez do oponente"}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-portal">
                {state.turnNumber !== undefined ? <span>Turno {state.turnNumber}</span> : null}
                {state.timerSeconds !== null ? (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" /> {state.timerSeconds}s
                  </span>
                ) : null}
              </p>
            </div>
            {state.yourTurn ? (
              <Button
                size="sm"
                className="rounded-arena bg-primary px-3 text-primary-foreground hover:bg-primary/90"
                disabled={busy}
                onClick={onEndTurn}
              >
                Encerrar turno
              </Button>
            ) : null}
          </div>
        );

      case "pending": {
        const step = `${state.verb}${state.cardName ? ` ${state.cardName}` : ""} · ${state.selectedCount} selecionada(s)`;
        return (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Shield className="size-3.5 shrink-0" />
              <span className="min-w-0">{step}</span>
            </p>
            {state.hint ? <p className="text-[11px] text-muted-portal">{state.hint}</p> : null}
            {state.cost ? (
              <p
                className={cn(
                  "text-[11px] font-semibold",
                  state.cost.paid >= state.cost.total ? "text-emerald-300" : "text-amber-300",
                )}
              >
                Recursos {state.cost.paid}/{state.cost.total}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="rounded-arena bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={busy || !state.canConfirm}
                onClick={onConfirm}
              >
                Confirmar
              </Button>
              <Button size="sm" variant="outline" className="rounded-arena" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          </div>
        );
      }

      case "attacking":
        return (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-red-300">
              <Swords className="size-3.5 shrink-0" /> Atacando com {state.attackerName}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="rounded-arena bg-red-600 text-white hover:bg-red-500"
                disabled={busy}
                onClick={onDeclareAttackPlayer}
              >
                Atacar o jogador
              </Button>
              <Button size="sm" variant="outline" className="rounded-arena" onClick={onCancelAttack}>
                Cancelar
              </Button>
            </div>
          </div>
        );

      case "defending":
        return (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-soft">Defendendo — ative um &lt;Blocker&gt; na Unit, ou:</p>
            <Button size="sm" variant="outline" className="rounded-arena" disabled={busy} onClick={onSkipBlock}>
              Não bloquear
            </Button>
          </div>
        );

      case "actionStep": {
        const nothingToDo = state.hasPlay === false;
        return (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
              <Zap className="size-3.5 shrink-0" /> Passo de Ação ({SCOPE_LABEL[state.scope]}) —{" "}
              {nothingToDo ? "nada a jogar agora" : "só Comando 【Action】"}
            </p>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant={nothingToDo ? "default" : "outline"}
                className={cn(
                  "rounded-arena",
                  nothingToDo
                    ? "bg-amber-500 text-black hover:bg-amber-400"
                    : "border-amber-500/60 text-amber-300 hover:bg-amber-500/15",
                )}
                disabled={busy}
                onClick={onPass}
              >
                {nothingToDo ? "Passar (nada a fazer)" : "Passar"}
              </Button>
              <button
                type="button"
                className="text-[10px] text-amber-300/80 underline decoration-dotted underline-offset-2 hover:text-amber-200"
                onClick={() => onToggleAutoPass?.(!state.autoPass)}
              >
                auto-pass: {state.autoPass ? "LIGADO" : "desligado"}
              </button>
            </div>
          </div>
        );
      }

      case "oppDecision":
        return (
          <p className="flex items-center gap-1.5 text-xs text-muted-portal">
            <Sparkles className="size-3.5 shrink-0 text-primary" /> {state.label}
          </p>
        );

      case "abandonAvailable":
        return (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
              <AlertTriangle className="size-3.5 shrink-0" /> Oponente inativo há {state.idleSeconds}s
            </p>
            <Button
              size="sm"
              variant="outline"
              className="rounded-arena border-amber-500/60 text-amber-300 hover:bg-amber-500/15"
              disabled={busy}
              onClick={onClaimAbandon}
            >
              Declarar vitória por abandono
            </Button>
          </div>
        );

      case "gameOver":
        return (
          <div className={cn("flex flex-col gap-1.5", state.won ? "text-emerald-300" : "text-red-300")}>
            <p className="text-base font-black">{state.won ? "Você venceu" : "Você perdeu"}</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-portal">Fim de jogo · {state.reasonLabel}</p>
            <Button
              size="sm"
              className="mt-1 rounded-arena bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={onLeaveAfterGameOver}
            >
              Voltar ao site{state.redirectSeconds !== null ? ` (${state.redirectSeconds}s)` : ""}
            </Button>
          </div>
        );
    }
  }

  return (
    // `bottom-11` (44px) no mobile — a `HandDrawer` que isso mirava foi
    // removida (a mão hoje é o `HandFan anchored` dentro do próprio rodapé
    // do `ArenaPlaymat`, não mais um `fixed bottom-0` à parte), mas o offset
    // continua útil pra não colar o dock na borda da tela. `sm:bottom-20`
    // (V6.1, docs/32) dá folga extra acima da fileira de ícones "Jogar/Ver"
    // da mão — reaplicado numa faixa só (`sm:`+, sem outro salto depois)
    // porque não há razão real pra essa folga precisar MUDAR de novo em
    // telas maiores.
    <aside
      aria-label="Ação atual"
      // V6.2 (docs/33): largura vira `clamp()` contínuo em vez de `sm:`/
      // `md:`/`lg:` — mesmo motivo do texto acima (achado de raiz do
      // docs/32: limiares diferentes em arquivos diferentes pro MESMO
      // dispositivo). A troca de LAYOUT (barra full-width → caixa ancorada
      // no canto) continua em `sm:` — isso É uma mudança estrutural real,
      // faz sentido ser um salto; só o TAMANHO dentro do modo "caixa" deixou
      // de saltar.
      className="fixed inset-x-0 bottom-11 z-40 sm:inset-x-auto sm:bottom-20 sm:right-2 sm:w-[clamp(13rem,38vw,23rem)]"
    >
      <div
        className={cn(
          "panel-cut border bg-slate-950/95 text-soft shadow-2xl transition-colors duration-100 motion-reduce:transition-none",
          accentClass(state),
        )}
      >
        <div className="p-[clamp(0.5rem,1.8vw,0.75rem)]" aria-live="polite">
          {renderBody()}
        </div>
        {logTail ? (
          <p className="truncate border-t border-white/10 px-3 py-1 text-[10px] text-muted-portal" title={logTail}>
            {logTail}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
