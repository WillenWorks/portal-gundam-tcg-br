/* Spec simulador-cadencia-de-mesa (P2) — o que muda em cada fase do começo de turno, comparando as visões
 * intermediárias (`buildTurnStagedViews`): quem desvira na Start Phase, que carta entrou na mão na Draw Phase, que
 * recurso entrou na Resource Phase. Puro; a página só anima. */
import type { CardInstance, PlayerId } from "../engine/types";
import { isHiddenCard, type ViewCardInstance, type ViewGameState } from "../engine/viewState";

const FIELD = ["battleArea", "baseSection", "resourceArea"] as const;

function byId(cards: readonly ViewCardInstance[]): Map<string, ViewCardInstance> {
  return new Map(cards.map((c) => [c.instanceId, c]));
}

/** cartas do jogador que estavam descansadas e ficaram ativas (as que giram de volta à vertical) */
export function unrestedIds(before: ViewGameState, after: ViewGameState, player: PlayerId): Set<string> {
  const ids = new Set<string>();
  for (const zone of FIELD) {
    const prev = byId(before.players[player][zone]);
    for (const card of after.players[player][zone]) {
      const was = prev.get(card.instanceId);
      if (!was || isHiddenCard(was) || isHiddenCard(card)) continue;
      if ((was as CardInstance).rested && !(card as CardInstance).rested) ids.add(card.instanceId);
    }
  }
  return ids;
}

/** a carta que entrou na mão (a face só para quem pode ver; o oponente recebe a carta oculta) */
export function drawnCard(before: ViewGameState, after: ViewGameState, player: PlayerId): ViewCardInstance | null {
  const prev = new Set(before.players[player].hand.map((c) => c.instanceId));
  return after.players[player].hand.find((c) => !prev.has(c.instanceId)) ?? null;
}

/** o recurso que entrou na área de recursos (público) */
export function placedResource(before: ViewGameState, after: ViewGameState, player: PlayerId): CardInstance | null {
  const prev = new Set(before.players[player].resourceArea.map((c) => c.instanceId));
  const card = after.players[player].resourceArea.find((c) => !prev.has(c.instanceId));
  return card && !isHiddenCard(card) ? (card as CardInstance) : null;
}
