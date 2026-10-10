import type { GameState, PlayerId } from "./types";

/**
 * W12 — ST11-006: quanto o dano de EFEITO inimigo nas cartas da área de escudo de `player` é reduzido neste turno
 * (`PlayerState.shieldAreaEffectReduction`, armado no início do turno do oponente). Vale também pro <Breach> (Q431).
 */
export function shieldAreaEffectReduction(state: GameState, player: PlayerId): number {
  const r = state.players[player].shieldAreaEffectReduction;
  return r && r.turn === state.turnNumber ? r.amount : 0;
}
