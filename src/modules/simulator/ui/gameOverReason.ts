/* Rótulo de motivo de fim de jogo, do ponto de vista do viewer ("Oponente ..."
 * quando ele venceu). Arquivo separado do `GameOverOverlay` só pra não misturar
 * função utilitária com componente (react-refresh). */
import type { GameOverInfo } from "@/modules/simulator/engine/types";

const REASON: Record<GameOverInfo["reason"], { won: string; lost: string }> = {
  noShieldsBattleDamage: { won: "Oponente sofreu dano sem shields", lost: "Você sofreu dano sem shields" },
  deckOut: { won: "Oponente ficou sem cartas no deck", lost: "Você ficou sem cartas no deck" },
  resignation: { won: "Oponente se rendeu", lost: "Você se rendeu" },
  abandonment: { won: "Oponente abandonou a partida", lost: "Você abandonou a partida" },
};

export function gameOverReasonLabel(reason: GameOverInfo["reason"], won: boolean): string {
  return (won ? REASON[reason]?.won : REASON[reason]?.lost) ?? reason;
}
