/* Slim Floating Action Ribbon (docs/52) — zona FIXA e compacta que responde
 * só "encerrar turno?", "ver o log?", "auto-pass?". As decisões de jogada
 * regular (alvo/custo, ataque, defesa, passo de ação) saíram daqui: vivem no
 * `MatchPrompt` (TopTacticalHUD, topo-centro) como botões contextuais inline,
 * perto da mensagem que já descreve a situação — evita duplicar texto/painel
 * no canto por cima do que o topo já mostra. Apresentacional puro, prop-driven:
 * nenhum estado de rede, nenhuma chamada de API — a página monta as props e
 * passa callbacks.
 *
 * `ActionDockState` continua exportado daqui: é o tipo que `CenterDecisionModal`
 * ainda usa pra cobrir as 2 decisões raras que seguem centralizadas (confirmar
 * fim de turno sob demanda, W.O. por abandono). */
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Clock, ScrollText, Wifi } from "lucide-react";

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
  yourTurn: boolean;
  /** Verdadeiro quando o jogador atual tem a prioridade do Passo de Ação (combate ou fim de turno). */
  inActionStep?: boolean;
  phaseLabel: string;
  timerSeconds: number | null;
  turnNumber?: number;
  /** trava o botão de encerrar turno enquanto uma ação de rede está em voo. */
  busy?: boolean;
  autoPass: boolean;
  /** RTT do transporte atual (ms) — indicador discreto; `null`/`undefined` esconde o número. */
  pingMs?: number | null;
  logOpen: boolean;
  logCount: number;
  onEndTurn?: () => void;
  /** passa o Passo de Ação quando em prioridade de ação. */
  onPassAction?: () => void;
  onToggleLog?: () => void;
  onToggleAutoPass?: (next: boolean) => void;
}

export function ActionDock({
  yourTurn,
  inActionStep,
  phaseLabel,
  timerSeconds,
  turnNumber,
  busy,
  autoPass,
  pingMs,
  logOpen,
  logCount,
  onEndTurn,
  onPassAction,
  onToggleLog,
  onToggleAutoPass,
}: ActionDockProps) {
  return (
    // Mesma posição responsiva que o dock antigo já validou (mobile: coluna
    // fixa na esquerda, abaixo do cluster ⚙/🐞/expandir; lg:+ ancora no canto
    // inferior direito, deslocando quando o log está aberto) — ver memória
    // "z-stack do rodapé": não mexer nesses offsets sem checar colisão com
    // HandFan/BattleLogDrawer.
    <aside
      aria-label="Painel de turno"
      className={cn(
        "fixed left-2 top-12 z-40 w-40 lg:left-auto lg:top-auto lg:bottom-14 lg:w-fit lg:min-w-[12rem] lg:max-w-[20rem]",
        logOpen ? "lg:right-[16.5rem]" : "lg:right-2",
      )}
    >
      <div className="panel-cut flex flex-col gap-1.5 border border-primary/25 bg-slate-950/95 p-[clamp(0.5rem,1.8vw,0.75rem)] text-soft shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "text-[clamp(0.6875rem,1.5vw,0.8125rem)] font-black uppercase tracking-wide",
              yourTurn || inActionStep ? "text-primary" : "text-muted-portal",
            )}
          >
            {inActionStep
              ? `Sua vez · ${phaseLabel}`
              : yourTurn
                ? `Sua vez · ${phaseLabel}`
                : "Vez do oponente"}
          </p>
          {timerSeconds !== null ? (
            <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-portal">
              <Clock className="size-3" aria-hidden /> {timerSeconds}s
            </span>
          ) : null}
        </div>
        {turnNumber !== undefined ? <p className="text-[10px] text-muted-portal">Turno {turnNumber}</p> : null}
        {inActionStep && onPassAction ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full rounded-arena border-amber-400/60 bg-amber-500/15 font-bold uppercase tracking-wide text-amber-200 hover:bg-amber-500/25 hover:text-amber-100"
            disabled={busy}
            onClick={onPassAction}
          >
            Passar ação
          </Button>
        ) : yourTurn ? (
          <Button
            size="sm"
            className="w-full rounded-arena bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={busy}
            onClick={onEndTurn}
          >
            Passar turno
          </Button>
        ) : null}
        <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-1.5 text-[10px] text-muted-portal">
          <button type="button" className="flex items-center gap-1 hover:text-slate-200" onClick={onToggleLog}>
            <ScrollText className="size-3" aria-hidden />
            Log{logCount > 0 ? ` (${logCount})` : ""}
          </button>
          <button
            type="button"
            className="flex items-center gap-1 hover:text-slate-200"
            onClick={() => onToggleAutoPass?.(!autoPass)}
            title="Alternar auto-pass no Passo de Ação"
          >
            <Wifi className="size-3" aria-hidden />
            {pingMs !== null && pingMs !== undefined ? `${pingMs}ms · ` : ""}
            auto-pass {autoPass ? "on" : "off"}
          </button>
        </div>
      </div>
    </aside>
  );
}
