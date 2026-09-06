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
  /** V6.4 (docs/36) — teto de altura (px) do dock no mobile, MEDIDO de
   *  verdade pelo pai (`visualViewport`/`innerHeight`, nunca `vh`/`dvh` — ver
   *  `SimulatorMatchPage.tsx`, `useVisualViewportHeight`) em vez de calculado
   *  aqui: este componente é apresentacional puro/sem hooks de propósito (os
   *  testes chamam `ActionDock(...)` como função simples, fora de uma árvore
   *  React de verdade — um hook aqui quebraria TODOS eles, "Invalid hook
   *  call"). Quando presente, vence a classe `max-h-[...]` (que fica só como
   *  fallback CSS-only pra quem não passa a prop). `undefined` no desktop. */
  mobileMaxHeightPx?: number;
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
  mobileMaxHeightPx,
}: ActionDockProps) {
  function renderBody() {
    switch (state.kind) {
      case "idle":
        return (
          // V6.3 (docs/34): coluna vertical estreita no mobile (< lg:) — o
          // texto+botão lado a lado não cabia direito na coluna à esquerda;
          // empilha (`flex-col`) até `lg:`, onde volta a ser a caixa
          // horizontal de sempre.
          <div className="flex flex-col items-start gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
            <div className="min-w-0">
              {/* V6.2 (docs/33): `clamp()` contínuo em vez de `sm:`/`md:` — as
                  rodadas anteriores bateram em limiares DIFERENTES por
                  arquivo pro MESMO dispositivo (docs/32, "achado de raiz");
                  um `clamp()` só não tem essa classe de bug (não tem 2
                  números pra desalinhar entre arquivos, é 1 fórmula).
                  V6.3: sem `truncate` — a coluna estreita do mobile precisa
                  poder quebrar linha em vez de cortar informação. */}
              {/* Frente 4 (docs/38 §3.5) — no desktop (lg:) o texto de
                  fase/ação NUNCA quebra nem trunca ("Fase Principal · Ação"
                  aparecia cortada no canto direito, Feedback.pdf §5). No mobile
                  a coluna é estreita: aí deixa quebrar linha (nunca truncar). */}
              <p
                className={cn(
                  "text-[clamp(0.6875rem,1.5vw,0.875rem)] font-black uppercase tracking-wide lg:whitespace-nowrap",
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
                className="w-full rounded-arena bg-primary px-3 text-primary-foreground hover:bg-primary/90 lg:w-auto"
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
    // V6.3 (docs/34) — pedido do Willen: no mobile (< lg:), o dock deixa de
    // ser barra/caixa perto do rodapé (colidia com os ícones de ação da mão
    // E ficava enorme sobre o campo) e vira uma coluna VERTICAL fixa na
    // ESQUERDA, logo abaixo do cluster ⚙/🐞/expandir (`left-2 top-2` na
    // página) — longe dos botões de ação do próprio celular e da mão.
    // `lg:` (≥1024px, genuíno desktop/tablet) restaura a caixa ancorada no
    // canto inferior direito de sempre. Um limiar só (`lg:`), reaproveitado
    // do mesmo jeito no texto/padding acima — nada de limiares diferentes
    // por propriedade (era exatamente isso que causava o "não mudou nada"
    // da rodada 3, docs/32).
    <aside
      aria-label="Ação atual"
      // V6.4 (docs/35) — bug real (Willen: "fica cortada, mesmo com scroll"):
      // `max-h-[60vh]` usa o viewport GRANDE do mobile (antes da barra de
      // endereço recolher) — em paisagem, com a barra visível, 60vh já passa
      // do espaço realmente visível, e como o painel é `fixed` (não rola com
      // a página) o excedente ficava inalcançável mesmo tentando rolar.
      // `100dvh` (fallback CSS-only, classe abaixo) já ajuda, mas depende do
      // browser suportar a unidade — V6.4 (docs/36), Willen relatou que
      // "ainda está sendo escondido no scroll" mesmo depois desse fix.
      // `mobileMaxHeightPx` é a fonte de verdade agora: MEDIDO pelo pai via
      // `visualViewport`/`innerHeight` reais (não `vh`/`dvh`), igual ao
      // `useArenaScale` já faz pro tabuleiro — nunca deixa o painel passar do
      // rodapé realmente visível, com ou sem suporte a `dvh`.
      style={mobileMaxHeightPx !== undefined ? { maxHeight: `${mobileMaxHeightPx}px` } : undefined}
      // Frente 4 (docs/38 §3.5) — desktop: a caixa acompanha o conteúdo
      // (`lg:w-fit`) entre um piso e um teto, com `min-w-fit`, pra "Fase
      // Principal · Ação" nunca ser truncada no canto direito (Feedback.pdf §5).
      className="fixed left-2 top-12 z-40 max-h-[min(60vh,calc(100dvh-4rem))] w-40 overflow-y-auto lg:left-auto lg:top-auto lg:bottom-14 lg:right-2 lg:max-h-none lg:w-fit lg:min-w-[13rem] lg:max-w-[26rem] lg:overflow-visible"
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
