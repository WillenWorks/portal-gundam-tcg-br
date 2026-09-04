/* Fim de jogo (pedido do Willen, rodada de espelhamento/HUD): overlay no CENTRO
 * da tela — "VOCÊ VENCEU" / "VOCÊ PERDEU" grande, o motivo pequeno abaixo, e um
 * botão pra voltar ao lobby (com contagem do redirect automático). Substitui o
 * cartão de fim de jogo no canto (`ActionDock` estado `gameOver`) como
 * superfície principal: o resultado da partida merece o meio da tela. */
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { GameOverInfo } from "@/modules/simulator/engine/types";
import { gameOverReasonLabel } from "./gameOverReason";

interface GameOverOverlayProps {
  won: boolean;
  reason: GameOverInfo["reason"];
  /** segundos até o redirect automático pro lobby (`null` = sem contagem). */
  redirectSeconds: number | null;
  onLeave: () => void;
}

export function GameOverOverlay({ won, reason, redirectSeconds, onLeave }: GameOverOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm"
      role="alertdialog"
      aria-label={won ? "Você venceu" : "Você perdeu"}
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <p
          className={cn(
            "text-4xl font-black uppercase tracking-[0.12em] drop-shadow-[0_0_18px_currentColor] sm:text-6xl",
            won ? "text-emerald-400" : "text-red-400",
          )}
        >
          {won ? "Você venceu" : "Você perdeu"}
        </p>
        <p className="text-sm text-muted-portal sm:text-base">{gameOverReasonLabel(reason, won)}</p>
        <Button
          className="mt-3 rounded-none bg-primary px-6 text-primary-foreground hover:bg-primary/90"
          onClick={onLeave}
        >
          Voltar ao lobby{redirectSeconds !== null ? ` (${redirectSeconds}s)` : ""}
        </Button>
      </div>
    </div>
  );
}
