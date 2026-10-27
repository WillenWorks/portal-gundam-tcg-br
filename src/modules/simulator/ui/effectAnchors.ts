/* Spec simulador-efeitos-na-mesa — onde a linha neon de um efeito encosta na mesa: a própria Unit no campo, a Unit em
 * que o Piloto está pareado, a Base (`base:<jogador>`), ou a lixeira/exílio de quem jogou (a Command já usada, a
 * carta destruída cujo 【Destroyed】 resolveu). Chaves do `useBoardElements`. */
import type { PlayerId } from "../engine/types";
import type { ViewGameState } from "../engine/viewState";

const SEATS: PlayerId[] = ["A", "B"];

export function effectAnchorKey(view: ViewGameState, instanceId: string, fallbackOwner?: PlayerId): string | null {
  for (const pid of SEATS) {
    const p = view.players[pid];
    for (const card of p.battleArea) {
      if (card.instanceId === instanceId) return instanceId;
      if ("pairedPilotId" in card && card.pairedPilotId === instanceId) return card.instanceId;
    }
    if (p.baseSection.some((c) => c.instanceId === instanceId)) return `base:${pid}`;
    if (p.trash.some((c) => c.instanceId === instanceId)) return `trashStation:${pid}`;
    if (p.exile.some((c) => c.instanceId === instanceId)) return `exileStation:${pid}`;
  }
  return fallbackOwner ? `trashStation:${fallbackOwner}` : null;
}

/** cartas no campo (Units, Pilotos pareados e Bases) — o livro de efeitos só vale para elas */
export function onFieldIds(view: ViewGameState): Set<string> {
  const ids = new Set<string>();
  for (const pid of SEATS) {
    const p = view.players[pid];
    for (const card of [...p.battleArea, ...p.baseSection]) {
      ids.add(card.instanceId);
      if ("pairedPilotId" in card && card.pairedPilotId) ids.add(card.pairedPilotId);
    }
  }
  return ids;
}
