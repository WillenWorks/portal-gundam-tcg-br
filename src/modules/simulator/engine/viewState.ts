import type { CardInstance, GameState, PendingDecision, PlayerId, PlayerState, Zone } from "./types";
import { findCard } from "./events";
import { PLAYER_IDS, otherPlayer } from "./types";

/**
 * Redação de informação por jogador (docs/18, decisão do Willen de testar o
 * passo 4 já com 2 sessões reais logadas em contas diferentes — "ativando a
 * habilidade que me permite ver as cartas e o oponente não... na tela do
 * oponente não terá essa informação, a menos que seja parte do efeito da
 * carta revelar ela"). `GameState` (o estado real, motor) nunca sai do
 * servidor — cada jogador só recebe o resultado de `viewStateFor`, que
 * troca toda carta em zona oculta por um `HiddenCard` (sem `def`, sem
 * nenhum dado que identifique a carta).
 *
 * Zonas ocultas pras regras oficiais (Comprehensive Rules — cartas viradas
 * pra baixo): `deck` e `resourceDeck` (sempre, pros dois jogadores, mesmo o
 * dono — ninguém olha a ordem/identidade do próprio deck sem um efeito que
 * diga isso, e nenhum efeito assim está implementado ainda, ver docs/18
 * "Riscos"), e `shields` (sempre, pros dois — só vira pública quando a
 * carta sai de shields, o que já é modelado como MOVE_CARD pro trash/hand
 * no motor). `hand` é oculta só pro adversário — o dono vê a própria mão
 * inteira. `battleArea`/`baseSection`/`resourceArea`/`trash` são sempre
 * públicas (cartas viradas pra cima em jogo).
 *
 * Isso já cobre honestamente o estado atual do motor: nenhum EffectSpec
 * implementado hoje "revela" uma carta oculta pro oponente (esse gap —
 * "efeitos de informação oculta", docs/18 — segue em aberto), então a regra
 * acima ("hidden zone -> sempre oculta, pros dois") é suficiente por
 * enquanto. Quando um efeito desses existir, ele muda o que o motor sabe
 * (ex.: marca a carta como "revelada" no `GameState`) e esta função passa a
 * ler esse dado — não precisa mudar a forma da redação em si.
 */

/** battleArea/baseSection/resourceArea/trash não entram aqui — são sempre públicas, nunca redigidas. */
const ALWAYS_HIDDEN_ZONES: readonly Zone[] = ["deck", "resourceDeck", "shields"];

/** Carta em zona oculta pra quem está vendo — só o suficiente pra UI desenhar "1 carta virada pra baixo". */
export interface HiddenCard {
  hidden: true;
  instanceId: string;
  owner: PlayerId;
  zone: Zone;
}

export type ViewCardInstance = CardInstance | HiddenCard;

export function isHiddenCard(card: ViewCardInstance): card is HiddenCard {
  return "hidden" in card && card.hidden === true;
}

function isHiddenFrom(card: CardInstance, viewer: PlayerId): boolean {
  if ((ALWAYS_HIDDEN_ZONES as Zone[]).includes(card.zone)) return true;
  if (card.zone === "hand") return card.owner !== viewer;
  return false;
}

function redactCard(card: CardInstance, viewer: PlayerId): ViewCardInstance {
  if (!isHiddenFrom(card, viewer)) return card;
  return { hidden: true, instanceId: card.instanceId, owner: card.owner, zone: card.zone };
}

export interface ViewPlayerState {
  id: PlayerId;
  deck: ViewCardInstance[];
  resourceDeck: ViewCardInstance[];
  shields: ViewCardInstance[];
  resourceArea: ViewCardInstance[];
  battleArea: ViewCardInstance[];
  baseSection: ViewCardInstance[];
  trash: ViewCardInstance[];
  exile: ViewCardInstance[];
  hand: ViewCardInstance[];
  /** contagens redundantes com o tamanho dos arrays acima — conveniência pra UI não ter que contar `HiddenCard[]` */
  counts: Record<Zone, number>;
}

function redactPlayerState(player: PlayerState, viewer: PlayerId): ViewPlayerState {
  const zones: Zone[] = ["deck", "resourceDeck", "shields", "resourceArea", "battleArea", "baseSection", "trash", "exile", "hand"];
  const counts = Object.fromEntries(zones.map((zone) => [zone, player[zone].length])) as Record<Zone, number>;
  return {
    id: player.id,
    deck: player.deck.map((c) => redactCard(c, viewer)),
    resourceDeck: player.resourceDeck.map((c) => redactCard(c, viewer)),
    shields: player.shields.map((c) => redactCard(c, viewer)),
    resourceArea: player.resourceArea.map((c) => redactCard(c, viewer)), // sempre pública — nunca redigida de fato, mapeado por uniformidade
    battleArea: player.battleArea.map((c) => redactCard(c, viewer)),
    baseSection: player.baseSection.map((c) => redactCard(c, viewer)),
    trash: player.trash.map((c) => redactCard(c, viewer)),
    exile: player.exile.map((c) => redactCard(c, viewer)), // sempre pública, igual trash
    hand: player.hand.map((c) => redactCard(c, viewer)),
    counts,
    // W5 — gatilho atrasado declarado por efeito resolvido: informação pública
    ...(player.delayedReactions ? { delayedReactions: player.delayedReactions } : {}),
    ...(player.indestructibleByEnemyEffectsTurn !== undefined ? { indestructibleByEnemyEffectsTurn: player.indestructibleByEnemyEffectsTurn } : {}),
    // W7 (C10) — descarte é público (vai pro trash à vista)
    ...(player.discardedByEnemyEffectOnTurn !== undefined ? { discardedByEnemyEffectOnTurn: player.discardedByEnemyEffectOnTurn } : {}),
    // W7 — Command ativada é pública
    ...(player.commandTraitsActivatedOnTurn ? { commandTraitsActivatedOnTurn: player.commandTraitsActivatedOnTurn } : {}),
    ...(player.ownUnitDestroyedByOwnEffectOnTurn ? { ownUnitDestroyedByOwnEffectOnTurn: player.ownUnitDestroyedByOwnEffectOnTurn } : {}),
  };
}

/**
 * Redação da `PendingDecision` de outro jogador (docs/19, Sessão 2). O único
 * campo sensível é `abilityResolution.queue[].deckTopReveal.topCards` — as N
 * cartas do topo do deck de quem decide, que o oponente NÃO pode ver (topo do
 * deck é zona oculta pros dois — `ALWAYS_HIDDEN_ZONES`). Pro dono da decisão,
 * passa como está (ele precisa ver as cartas pra escolher qual revelar).
 * `handChoice.legalHandIds` e os `instanceId` do `deckTopReveal` não são
 * redigidos: id sozinho não revela `def` a quem não a tem (mesma postura do
 * resto de `viewState`).
 *
 * Para `handDiscard`, o dono recebe `cards: CardInstance[]` (permitindo renderizar
 * o nome da carta mesmo para cartas compradas que ainda aguardam resolução do draw),
 * enquanto pro oponente `cards` é redigido para `[]`.
 */
function redactPendingDecisionFor(
  state: GameState,
  decision: PendingDecision | null,
  isOwner: boolean,
): PendingDecision | null {
  if (!decision || decision.kind !== "abilityResolution") return decision;
  if (!isOwner) {
    return {
      ...decision,
      queue: decision.queue.map((q) => {
        let nextQ = q;
        if (nextQ.deckTopReveal) {
          nextQ = { ...nextQ, deckTopReveal: { ...nextQ.deckTopReveal, topCards: [] } };
        }
        if (nextQ.handDiscard) {
          nextQ = { ...nextQ, handDiscard: { ...nextQ.handDiscard, cards: [] } };
        }
        // topo do deck de quem decide: ST02-015 (reordenar) e GD01-039 Dopp (olhar o topo). O deckReorder
        // passava inteiro e mostrava ao oponente as cartas do topo.
        if (nextQ.deckReorder) {
          nextQ = { ...nextQ, deckReorder: { ...nextQ.deckReorder, topCards: [] } };
        }
        if (nextQ.enumChoice?.topCards) {
          nextQ = { ...nextQ, enumChoice: { ...nextQ.enumChoice, topCards: [] } };
        }
        return nextQ;
      }),
    };
  }

  return {
    ...decision,
    queue: decision.queue.map((q) => {
      if (!q.handDiscard) return q;
      const cards = q.handDiscard.legalHandIds
        .map((id) => {
          try {
            return findCard(state, id);
          } catch {
            return undefined;
          }
        })
        .filter((c): c is CardInstance => Boolean(c));
      return {
        ...q,
        handDiscard: {
          ...q.handDiscard,
          cards,
        },
      };
    }),
  };
}

function redactPendingDecision(
  state: GameState,
  map: GameState["pendingDecision"],
  viewer: PlayerId,
): GameState["pendingDecision"] {
  return {
    A: redactPendingDecisionFor(state, map.A, viewer === "A"),
    B: redactPendingDecisionFor(state, map.B, viewer === "B"),
  };
}

/**
 * Quantos eventos do `eventLog` vão pra rede por visão (docs/19, Sessão 4 —
 * "sem memory leak / performance"). O `eventLog` real cresce o jogo inteiro
 * e é reenviado a cada ação via SSE; um jogo longo passa de centenas de
 * eventos. 150 cobre o feed de batalha (que é um histórico recente, não um
 * replay) com folga. O histórico COMPLETO ainda vai no relatório de bug
 * (`reportSituation` no servidor, que loga `match.state` inteiro).
 */
const EVENT_LOG_WINDOW = 150;

/**
 * O log grava cada `SET_PENDING_DECISION` com a decisão inteira — inclusive as cartas do topo do deck que o
 * texto mandou o DONO olhar (ST02-015, GD01-039 Dopp, ST03-006…). Sem isto o oponente lia essas cartas no
 * `eventLog` mesmo com a `pendingDecision` redigida. Mesma redação de `redactPendingDecisionFor`.
 */
function redactEventLog(state: GameState, log: GameState["eventLog"], viewer: PlayerId): GameState["eventLog"] {
  return log.map((event) =>
    event.type === "SET_PENDING_DECISION" && event.player !== viewer
      ? { ...event, decision: redactPendingDecisionFor(state, event.decision, false) as PendingDecision }
      : event,
  );
}

/**
 * Mais que isto numa transmissão só (lote patológico) não vale animar: a tela aplica a visão final direto.
 * Um turno inteiro do bot fica bem abaixo (o golden passa de ~30 eventos por turno).
 */
export const MAX_EVENTS_SINCE = 400;

/**
 * Eventos de `from` em diante, redigidos para `viewer` (spec simulador-animacao-pelo-log): a tela anima a partir
 * deles em vez de comparar visões. `undefined` quando não há sequência a continuar — `from` desconhecido, de outro
 * jogo (Bo3 recomeça o log) ou lote grande demais.
 */
export function eventsSinceFor(state: GameState, from: number | undefined, viewer: PlayerId): GameState["eventLog"] | undefined {
  if (from === undefined || from > state.eventLog.length) return undefined;
  if (state.eventLog.length - from > MAX_EVENTS_SINCE) return undefined;
  return redactEventLog(state, state.eventLog.slice(from), viewer);
}

export interface ViewGameState {
  turnNumber: number;
  activePlayer: PlayerId;
  phase: GameState["phase"];
  combat: GameState["combat"];
  endPhaseAction: GameState["endPhaseAction"];
  /**
   * Decisão interativa pendente por jogador (docs/19, Sessão 2). Quase tudo
   * passa como está — o `cardDef` de um 【Burst】 é de shield já trashada (zona
   * pública), as outras variantes só carregam `instanceId`/`specId`. O que é
   * redigido pro oponente: as cartas do topo do deck de quem decide
   * (`deckTopReveal`, `deckReorder` e `enumChoice.topCards`) e as cartas do
   * `handDiscard` — ver `redactPendingDecisionFor`.
   */
  pendingDecision: GameState["pendingDecision"];
  gameOver: GameState["gameOver"];
  eventLog: GameState["eventLog"];
  /** de quem é este ponto de vista — a UI usa isso pra saber "sou eu" sem precisar de mais contexto */
  viewer: PlayerId;
  players: Record<PlayerId, ViewPlayerState>;
  /** versão do motor no momento da criação da partida (docs/44 §8.4) — `"dev"` fora do build. */
  engineVersion?: string;
}

/**
 * Ponto de vista de `viewer` sobre `state`. Nunca devolve `CardInstance`
 * (com `def`) pra uma carta em zona oculta que não seja da própria mão do
 * viewer — devolve `HiddenCard` no lugar. `combat`/`endPhaseAction` são
 * repassados como estão (só `instanceId`, que não revela a carta: ver
 * `renumberByPosition` em setup.ts); o `eventLog` passa pela redação das
 * decisões do oponente (`redactEventLog`). `findViewLeaks` (viewLeaks.ts)
 * cobra isso sobre o payload inteiro.
 */
export function viewStateFor(state: GameState, viewer: PlayerId): ViewGameState {
  return {
    turnNumber: state.turnNumber,
    activePlayer: state.activePlayer,
    phase: state.phase,
    combat: state.combat,
    endPhaseAction: state.endPhaseAction,
    pendingDecision: redactPendingDecision(state, state.pendingDecision, viewer),
    gameOver: state.gameOver,
    eventLog: redactEventLog(state, state.eventLog.slice(-EVENT_LOG_WINDOW), viewer),
    viewer,
    engineVersion: state.engineVersion,
    players: {
      [viewer]: redactPlayerState(state.players[viewer], viewer),
      [otherPlayer(viewer)]: redactPlayerState(state.players[otherPlayer(viewer)], viewer),
    } as Record<PlayerId, ViewPlayerState>,
  };
}

/** As duas visões de uma vez — conveniência pro match store, que precisa notificar os 2 lados a cada mudança. */
export function viewStatesForBothPlayers(state: GameState): Record<PlayerId, ViewGameState> {
  return Object.fromEntries(PLAYER_IDS.map((p) => [p, viewStateFor(state, p)])) as Record<PlayerId, ViewGameState>;
}
