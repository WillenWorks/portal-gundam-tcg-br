/* Camada 2 da fase de assertividade: o que cada jogador recebe na rede.
 * - `findViewLeaks`: nenhuma carta oculta para o viewer chega com identidade (`def`/`cardDef`) em lugar nenhum
 *   do payload (zonas, decisão, `eventLog`, `combat`, `legalMenu`…). A exceção é a própria decisão do viewer
 *   mostrar as cartas que o texto manda ele olhar (`topCards`, `handDiscard.cards`), e só cartas dele.
 * - `decisionVisibilityGaps`: a decisão do viewer traz o que ele precisa ver para decidir — todo id oferecido
 *   é de carta que ele enxerga, e "look at the top" vem com as cartas do topo.
 * Puro; usado nos testes de visão e no `gundam-fuzz --leaks`. */
import type { CardInstance, GameState, PlayerId } from "./types";
import { otherPlayer } from "./types";
import { isHiddenCard, type ViewGameState } from "./viewState";

export interface ViewLeak {
  path: string;
  instanceId: string;
}

/** instanceIds que `viewer` não pode identificar agora */
export function hiddenIdsFor(state: GameState, viewer: PlayerId): Set<string> {
  const ids = new Set<string>();
  for (const p of [viewer, otherPlayer(viewer)]) {
    const player = state.players[p];
    for (const c of [...player.deck, ...player.resourceDeck, ...player.shields]) ids.add(c.instanceId);
    if (p !== viewer) for (const c of player.hand) ids.add(c.instanceId);
  }
  return ids;
}

/** caminhos de uma decisão do viewer onde ele pode ver carta oculta DELE (o texto manda olhar) */
const SHOWN_TO_DECIDER = /\.(topCards|handDiscard\.cards)\[\d+\]$/;

function ownerOf(state: GameState, id: string): PlayerId | undefined {
  for (const p of ["A", "B"] as PlayerId[]) {
    const player = state.players[p];
    for (const zone of [player.deck, player.resourceDeck, player.shields, player.hand]) {
      if (zone.some((c) => c.instanceId === id)) return p;
    }
  }
  return undefined;
}

export function findViewLeaks(state: GameState, viewer: PlayerId, payload: unknown): ViewLeak[] {
  const hidden = hiddenIdsFor(state, viewer);
  const leaks: ViewLeak[] = [];

  const walk = (node: unknown, path: string, inOwnDecision: boolean) => {
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${path}[${i}]`, inOwnDecision));
      return;
    }
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;

    const id = typeof obj.instanceId === "string" ? obj.instanceId : typeof obj.cardInstanceId === "string" ? obj.cardInstanceId : undefined;
    // o 【Burst】 é revelado aos dois jogadores quando a shield quebra — a carta pode depois ir para a mão
    const identified = "def" in obj || ("cardDef" in obj && obj.kind !== "burst");
    if (id && identified && hidden.has(id)) {
      const allowed = inOwnDecision && SHOWN_TO_DECIDER.test(path) && ownerOf(state, id) === viewer;
      if (!allowed) leaks.push({ path, instanceId: id });
    }

    // decisão gravada no log: a do próprio viewer conta como "dele"
    const ownLoggedDecision = obj.type === "SET_PENDING_DECISION" && obj.player === viewer;
    for (const [key, child] of Object.entries(obj)) {
      const childPath = `${path}.${key}`;
      const own = inOwnDecision || (ownLoggedDecision && key === "decision") || childPath.endsWith(`.pendingDecision.${viewer}`);
      walk(child, childPath, own);
    }
  };

  walk(payload, "$", false);
  return leaks;
}

/** ids que o viewer enxerga na visão (zonas públicas + a própria mão) */
function visibleIds(view: ViewGameState): Set<string> {
  const ids = new Set<string>();
  for (const p of Object.values(view.players)) {
    for (const zone of [p.hand, p.battleArea, p.baseSection, p.resourceArea, p.trash, p.exile, p.deck, p.resourceDeck, p.shields]) {
      for (const c of zone) if (!isHiddenCard(c)) ids.add(c.instanceId);
    }
  }
  return ids;
}

const LOOK_AT_TOP = /look at the top/i;

/** o que falta à decisão do viewer para ele decidir sabendo o que o texto manda ver */
export function decisionVisibilityGaps(state: GameState, view: ViewGameState): string[] {
  const viewer = view.viewer;
  const decision = view.pendingDecision[viewer];
  if (!decision) return [];
  const gaps: string[] = [];
  const visible = visibleIds(view);

  if (decision.kind === "burst") {
    if (!decision.cardDef) gaps.push(`burst ${decision.cardInstanceId}: sem a carta`);
    return gaps;
  }
  if (decision.kind === "triggerOrder") {
    for (const t of decision.triggers) if (!visible.has(t.instanceId)) gaps.push(`triggerOrder: origem ${t.instanceId} invisível`);
    return gaps;
  }
  if (decision.kind !== "abilityResolution") return gaps;

  for (const q of decision.queue) {
    const shown = new Set<string>([
      ...(q.deckTopReveal?.topCards ?? []).map((c: CardInstance) => c.instanceId),
      ...(q.deckReorder?.topCards ?? []).map((c: CardInstance) => c.instanceId),
      ...(q.enumChoice?.topCards ?? []).map((c: CardInstance) => c.instanceId),
      ...(q.handDiscard?.cards ?? []).map((c: CardInstance) => c.instanceId),
    ]);
    const offered: Array<[string, string[]]> = [
      ["legalTargets", q.legalTargets],
      ["secondaryTarget", q.secondaryTarget?.legalTargets ?? []],
      ["handChoice", q.handChoice?.legalHandIds ?? []],
      ["deckTopReveal", q.deckTopReveal?.revealableIds ?? []],
      ["handDiscard", q.handDiscard?.legalHandIds ?? []],
      ["trashSearch", q.trashSearch?.legalTrashIds ?? []],
      ["trashExile", q.trashExile?.legalTrashIds ?? []],
    ];
    for (const [field, ids] of offered) {
      for (const id of ids) {
        if (!visible.has(id) && !shown.has(id)) gaps.push(`${q.specId} ${field}: ${id} oferecido sem a carta à vista`);
      }
    }
    const deckSize = state.players[viewer].deck.length;
    if (LOOK_AT_TOP.test(q.label) && deckSize > 0 && shown.size === 0 && !q.combatTrigger) {
      gaps.push(`${q.specId}: o texto manda olhar o topo do deck e a decisão não traz as cartas`);
    }
  }
  return gaps;
}
