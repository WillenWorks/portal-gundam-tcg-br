import type { CardDef, CardInstance, GameState, PlayerId, PlayerState } from "./types";
import { createRng, shuffleInPlace, type Rng } from "./rng";

export interface DeckList {
  /** 50 cartas do deck principal (Unit/Pilot/Command/Base) — Comprehensive Rules 6-1-1 */
  main: CardDef[];
  /** 10 cartas do resource deck — Comprehensive Rules 6-1-2 */
  resources: CardDef[];
}

export interface CreateGameOptions {
  seed: number;
  firstPlayer: PlayerId;
  /** true = esse jogador decide fazer mulligan (redraw único, Comprehensive Rules 6-2-1-6-1) */
  mulligan?: Partial<Record<PlayerId, boolean>>;
  /** default true — valida 50 cartas no deck principal e 10 no resource deck antes de montar a partida */
  validateDeckSize?: boolean;
}

const EX_BASE_TOKEN: CardDef = {
  code: "TOKEN-EX-BASE",
  nameEn: "EX Base",
  cardType: "BASE",
  color: "colorless",
  ap: 0,
  hp: 3,
  isToken: true,
};

/** Exportado pra deploy.ts poder reconhecer o token na hora de pagar custo — ver payCostEvents(). */
export const TOKEN_EX_RESOURCE_CODE = "TOKEN-EX-RESOURCE";

const EX_RESOURCE_TOKEN: CardDef = {
  code: TOKEN_EX_RESOURCE_CODE,
  nameEn: "EX Resource",
  cardType: "RESOURCE",
  color: "colorless",
  isToken: true,
};

function instantiate(def: CardDef, owner: PlayerId, seq: number, zone: CardInstance["zone"], turnNumber: number): CardInstance {
  return {
    instanceId: `${owner}-${seq}`,
    def,
    owner,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: turnNumber,
  };
}

function buildPlayer(id: PlayerId, deck: DeckList, rng: Rng, seqRef: { n: number }, mulligan: boolean): PlayerState {
  const player: PlayerState = {
    id,
    deck: deck.main.map((def) => instantiate(def, id, seqRef.n++, "deck", 1)),
    resourceDeck: deck.resources.map((def) => instantiate(def, id, seqRef.n++, "resourceDeck", 1)),
    shields: [],
    resourceArea: [],
    battleArea: [],
    baseSection: [],
    trash: [],
    exile: [],
    hand: [],
  };

  shuffleInPlace(player.deck, rng);
  shuffleInPlace(player.resourceDeck, rng);

  drawN(player, 5);

  if (mulligan) {
    // devolve a mão pro fundo do deck, compra 5 novas, depois embaralha (Comprehensive Rules 6-2-1-6-1)
    while (player.hand.length > 0) {
      const card = player.hand.pop()!;
      card.zone = "deck";
      player.deck.push(card);
    }
    drawN(player, 5);
    shuffleInPlace(player.deck, rng);
  }

  // 6 shields do topo do deck, viradas pra baixo (Comprehensive Rules 6-2-2)
  for (let i = 0; i < 6 && player.deck.length > 0; i++) {
    const card = player.deck.shift()!;
    card.zone = "shields";
    player.shields.push(card);
  }

  // EX Base ativa pra ambos os jogadores (Comprehensive Rules 6-2-3)
  const exBase = instantiate(EX_BASE_TOKEN, id, seqRef.n++, "baseSection", 1);
  player.baseSection.push(exBase);

  return player;
}

function drawN(player: PlayerState, n: number) {
  for (let i = 0; i < n && player.deck.length > 0; i++) {
    const card = player.deck.shift()!;
    card.zone = "hand";
    player.hand.push(card);
  }
}

/**
 * Monta o estado inicial de uma partida (setup completo — Comprehensive
 * Rules 6-2). Determinístico dado o mesmo `seed`: sempre a mesma
 * embaralhada, sempre o mesmo resultado. `firstPlayer` é decidido fora do
 * motor (par ou ímpar, escolha manual etc. — Comprehensive Rules 6-2-1-4
 * não é regra de motor, é decisão de mesa).
 */
export function createGame(deckA: DeckList, deckB: DeckList, options: CreateGameOptions): GameState {
  const validate = options.validateDeckSize ?? true;
  if (validate) {
    for (const [label, deck] of [["A", deckA], ["B", deckB]] as const) {
      if (deck.main.length !== 50) {
        throw new Error(`Deck do jogador ${label} precisa ter 50 cartas no deck principal, tem ${deck.main.length}`);
      }
      if (deck.resources.length !== 10) {
        throw new Error(`Deck do jogador ${label} precisa ter 10 cartas no resource deck, tem ${deck.resources.length}`);
      }
    }
  }

  const rng = createRng(options.seed);
  const seqRef = { n: 0 };

  const players: Record<PlayerId, PlayerState> = {
    A: buildPlayer("A", deckA, rng, seqRef, options.mulligan?.A ?? false),
    B: buildPlayer("B", deckB, rng, seqRef, options.mulligan?.B ?? false),
  };

  // segundo jogador começa com 1 EX Resource já na Resource Area (Comprehensive Rules 6-2-4)
  const secondPlayer: PlayerId = options.firstPlayer === "A" ? "B" : "A";
  const exResource = instantiate(EX_RESOURCE_TOKEN, secondPlayer, seqRef.n++, "resourceArea", 1);
  players[secondPlayer].resourceArea.push(exResource);

  return {
    turnNumber: 1,
    activePlayer: options.firstPlayer,
    phase: "start",
    combat: null,
    endPhaseAction: null,
    players,
    eventLog: [],
    gameOver: null,
    nextInstanceSeq: seqRef.n,
  };
}
