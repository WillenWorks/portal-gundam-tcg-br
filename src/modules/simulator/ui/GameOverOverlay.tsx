/* Fim de jogo (pedido do Willen, rodada de espelhamento/HUD): overlay no CENTRO
 * da tela — "VOCÊ VENCEU" / "VOCÊ PERDEU" grande, o motivo pequeno abaixo, e um
 * botão pra voltar ao lobby (com contagem do redirect automático). Substitui o
 * cartão de fim de jogo no canto (`ActionDock` estado `gameOver`) como
 * superfície principal: o resultado da partida merece o meio da tela. */
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { GameOverInfo } from "@/modules/simulator/engine/types";
import type { ReactNode } from "react";
import { gameOverReasonLabel } from "./gameOverReason";
import { useSiteLanguage } from "@/i18n/siteLanguage";
import { useSceneSound } from "../audio/useSceneSound";

interface GameOverOverlayProps {
  won: boolean;
  reason: GameOverInfo["reason"];
  /** segundos até o redirect automático pro lobby (`null` = sem contagem). */
  redirectSeconds: number | null;
  onLeave: () => void;
  /** conteúdo extra abaixo do resultado (ex.: deck do Zero System) */
  children?: ReactNode;
}

export function GameOverOverlay({ won, reason, redirectSeconds, onLeave, children }: GameOverOverlayProps) {
  const { tr } = useSiteLanguage();
  useSceneSound(won ? "game.win" : "game.lose");
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm"
      role="alertdialog"
      aria-label={won ? tr("Você venceu", "You won") : tr("Você perdeu", "You lost")}
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <p
          className={cn(
            "text-4xl font-black uppercase tracking-[0.12em] drop-shadow-[0_0_18px_currentColor] sm:text-6xl",
            won ? "text-emerald-400" : "text-red-400",
          )}
        >
          {won ? tr("Você venceu", "You won") : tr("Você perdeu", "You lost")}
        </p>
        <p className="text-sm text-muted-portal sm:text-base">{gameOverReasonLabel(reason, won)}</p>
        {children}
        <Button
          className="mt-3 rounded-arena bg-primary px-6 text-primary-foreground hover:bg-primary/90"
          onClick={onLeave}
        >
          {tr("Voltar ao lobby", "Back to lobby")}{redirectSeconds !== null ? ` (${redirectSeconds}s)` : ""}
        </Button>
      </div>
    </div>
  );
}
