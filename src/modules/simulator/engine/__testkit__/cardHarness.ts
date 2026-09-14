import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "../types";

/**
 * Helper de posicionamento determinístico de cartas em cenários ISOLADOS de
 * teste (docs/debates 2026-09-13 — Testes de carta, ambiente favorável).
 *
 * Antes desta extração, cada `content/<wave>.test.ts` (st01/st02/st03/st04,
 * gd01…) reimplementava a mesma função local (`place`) pra montar um
 * `GameState` mínimo por cima de `createGame` — cópia arquivo a arquivo, não
 * módulo compartilhado. Um único helper aqui evita a divergência (ex.: um
 * arquivo esquecer de setar `enteredZoneOnTurn`) e é o ponto natural pra
 * crescer futuras convenções de teste de carta sem duplicar de novo em GD02+.
 *
 * MUTA `state.players[player][zone]` diretamente (push) — mesmo contrato do
 * `place` original: quem chama já está montando um cenário local antes de
 * exercitar 1 efeito, não simulando uma partida real via eventos.
 */
let seq = 0;

export function placeCard(
  state: GameState,
  player: PlayerId,
  def: CardDef,
  zone: Zone,
  opts: Partial<CardInstance> = {},
): string {
  const instanceId = `${player}-testkit-${seq++}`;
  const card: CardInstance = {
    instanceId,
    def,
    owner: player,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber - 1,
    ...opts,
  };
  state.players[player][zone].push(card);
  return instanceId;
}
