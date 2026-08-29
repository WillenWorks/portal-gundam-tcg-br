import type { CardInstance, GameState, PlayerId, PlayerState, Zone } from "./types";
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
  hand: ViewCardInstance[];
  /** contagens redundantes com o tamanho dos arrays acima — conveniência pra UI não ter que contar `HiddenCard[]` */
  counts: Record<Zone, number>;
}

function redactPlayerState(player: PlayerState, viewer: PlayerId): ViewPlayerState {
  const zones: Zone[] = ["deck", "resourceDeck", "shields", "resourceArea", "battleArea", "baseSection", "trash", "hand"];
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
    hand: player.hand.map((c) => redactCard(c, viewer)),
    counts,
  };
}

export interface ViewGameState {
  turnNumber: number;
  activePlayer: PlayerId;
  phase: GameState["phase"];
  combat: GameState["combat"];
  gameOver: GameState["gameOver"];
  eventLog: GameState["eventLog"];
  /** de quem é este ponto de vista — a UI usa isso pra saber "sou eu" sem precisar de mais contexto */
  viewer: PlayerId;
  players: Record<PlayerId, ViewPlayerState>;
}

/**
 * Ponto de vista de `viewer` sobre `state`. Nunca devolve `CardInstance`
 * (com `def`) pra uma carta em zona oculta que não seja da própria mão do
 * viewer — devolve `HiddenCard` no lugar. `combat`/`eventLog` são
 * repassados como estão: nenhum dos dois embute `CardDef`/identidade de
 * carta oculta (só `instanceId`, que sozinho não revela nada pra quem não
 * tem acesso à `def` correspondente).
 */
export function viewStateFor(state: GameState, viewer: PlayerId): ViewGameState {
  return {
    turnNumber: state.turnNumber,
    activePlayer: state.activePlayer,
    phase: state.phase,
    combat: state.combat,
    gameOver: state.gameOver,
    eventLog: state.eventLog,
    viewer,
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
