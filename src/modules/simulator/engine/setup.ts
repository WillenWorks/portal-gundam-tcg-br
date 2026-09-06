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
  /**
   * true = esse jogador decide fazer mulligan já no `createGame` (redraw único,
   * Comprehensive Rules 6-2-1-6-1). Só tem efeito no modo NÃO-interativo
   * (`interactiveMulligan` falso/omitido) — usado por testes de motor.
   */
  mulligan?: Partial<Record<PlayerId, boolean>>;
  /**
   * true = Mulligan INTERATIVO: `createGame` só compra as mãos e deixa
   * `pendingDecision[firstPlayer] = { kind: "mulligan" }`. Os 6 shields, a EX
   * Base e o EX Resource do 2º jogador só entram quando os dois resolvem o
   * mulligan (ver `finishGameSetup`, chamado por `applyPlayerAction`
   * `resolveMulligan`). Default `false` = comportamento antigo (setup completo
   * de uma vez), mantido pros testes de motor e pro `advanceToMainPhase` direto.
   */
  interactiveMulligan?: boolean;
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

/** Exportado pra costs.ts poder reconhecer o token na hora de pagar custo — ver payResourceCostEvents(). */
export const TOKEN_EX_RESOURCE_CODE = "TOKEN-EX-RESOURCE";

/** Exportado pra content/st02.ts poder instanciar 1 via `spawnToken` (ST02-002 Wing Gundam Bird Mode — "Place 1 EX Resource"). */
export const EX_RESOURCE_TOKEN: CardDef = {
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

function drawN(player: PlayerState, n: number) {
  for (let i = 0; i < n && player.deck.length > 0; i++) {
    const card = player.deck.shift()!;
    card.zone = "hand";
    player.hand.push(card);
  }
}

/** Devolve a mão inteira pro FUNDO do deck, re-embaralha e compra 5 novas
 *  (Comprehensive Rules 6-2-1-6-1 / ruling oficial). Determinístico: o rng
 *  vem de `createRng(seed ^ nonce)` — ver `mulliganNonce`. */
export function redrawMulliganHand(player: PlayerState, rng: Rng) {
  while (player.hand.length > 0) {
    const card = player.hand.pop()!;
    card.zone = "deck";
    player.deck.push(card);
  }
  shuffleInPlace(player.deck, rng);
  drawN(player, 5);
}

/** nonce determinístico por jogador pro re-shuffle do mulligan (o rng do
 *  `createGame` já não existe mais nesse ponto). */
export function mulliganNonce(player: PlayerId): number {
  return player === "A" ? 0x9e37_79b9 : 0x85eb_ca6b;
}

/** Fase 1 do setup de um jogador: embaralha os dois decks e compra a mão de 5.
 *  Ainda SEM shields / EX Base (isso vem depois do mulligan). */
function dealOpeningHand(id: PlayerId, deck: DeckList, rng: Rng, seqRef: { n: number }): PlayerState {
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

  return player;
}

/** Fase 2 do setup de um jogador: 6 shields do topo (viradas pra baixo,
 *  Comprehensive Rules 6-2-2) + EX Base ativa (6-2-3). Idempotente-ish: só
 *  chamar quando `shields`/`baseSection` estão vazios. */
function placeShieldsAndBase(player: PlayerState, seqRef: { n: number }) {
  for (let i = 0; i < 6 && player.deck.length > 0; i++) {
    const card = player.deck.shift()!;
    card.zone = "shields";
    player.shields.push(card);
  }
  const exBase = instantiate(EX_BASE_TOKEN, player.id, seqRef.n++, "baseSection", 1);
  player.baseSection.push(exBase);
}

/**
 * Fecha o setup DEPOIS do mulligan (modo interativo): 6 shields + EX Base pros
 * dois, EX Resource ativo só pro 2º jogador (Comprehensive Rules 6-2-4).
 * `advanceToMainPhase` fica a cargo do chamador (`applyPlayerAction`).
 */
export function finishGameSetup(state: GameState): GameState {
  const seqRef = { n: state.nextInstanceSeq };
  const firstPlayer = state.activePlayer;
  const secondPlayer: PlayerId = firstPlayer === "A" ? "B" : "A";

  for (const id of ["A", "B"] as PlayerId[]) {
    const player = state.players[id];
    if (player.shields.length === 0 && player.baseSection.length === 0) {
      placeShieldsAndBase(player, seqRef);
    }
  }

  const hasExResource = state.players[secondPlayer].resourceArea.some((c) => c.def.code === TOKEN_EX_RESOURCE_CODE);
  if (!hasExResource) {
    const exResource = instantiate(EX_RESOURCE_TOKEN, secondPlayer, seqRef.n++, "resourceArea", 1);
    state.players[secondPlayer].resourceArea.push(exResource);
  }

  state.nextInstanceSeq = seqRef.n;
  return state;
}

/**
 * Monta o estado inicial de uma partida (setup completo — Comprehensive
 * Rules 6-2). Determinístico dado o mesmo `seed`. `firstPlayer` é decidido
 * fora do motor (sorteio de mesa — Comprehensive Rules 6-2-1-4, "antes de
 * olhar a mão").
 *
 * `interactiveMulligan: true` (usado pelo servidor): compra só as mãos e deixa
 * `pendingDecision[firstPlayer] = { kind: "mulligan" }` — o resto do setup vem
 * de `finishGameSetup` quando os dois jogadores resolverem o mulligan.
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

  const seqRef = { n: 0 };
  const firstPlayer = options.firstPlayer;
  const secondPlayer: PlayerId = firstPlayer === "A" ? "B" : "A";
  const decks: Record<PlayerId, DeckList> = { A: deckA, B: deckB };

  let players: Record<PlayerId, PlayerState>;
  let pendingDecision: GameState["pendingDecision"] = { A: null, B: null };

  if (options.interactiveMulligan) {
    // O rng é consumido por A depois por B (mesma ordem do modo antigo).
    const rng = createRng(options.seed);
    players = {
      A: dealOpeningHand("A", decks.A, rng, seqRef),
      B: dealOpeningHand("B", decks.B, rng, seqRef),
    };
    pendingDecision = { ...pendingDecision, [firstPlayer]: { kind: "mulligan" } };
  } else {
    // Modo antigo: setup completo de uma vez (mão → mulligan boolean → shields →
    // EX Base). Um rng compartilhado, consumido por A e depois por B — mesma
    // ordem do histórico, pra não quebrar as seeds fixas dos testes de motor.
    const rng = createRng(options.seed);
    const buildOldStyle = (id: PlayerId, deck: DeckList, mull: boolean): PlayerState => {
      const player = dealOpeningHand(id, deck, rng, seqRef);
      if (mull) redrawMulliganHand(player, createRng(options.seed ^ mulliganNonce(id)));
      placeShieldsAndBase(player, seqRef);
      return player;
    };
    players = {
      A: buildOldStyle("A", decks.A, options.mulligan?.A ?? false),
      B: buildOldStyle("B", decks.B, options.mulligan?.B ?? false),
    };
    // segundo jogador começa com 1 EX Resource já na Resource Area (CR 6-2-4)
    const exResource = instantiate(EX_RESOURCE_TOKEN, secondPlayer, seqRef.n++, "resourceArea", 1);
    players[secondPlayer].resourceArea.push(exResource);
  }

  return {
    turnNumber: 1,
    activePlayer: firstPlayer,
    phase: "start",
    combat: null,
    endPhaseAction: null,
    pendingDecision,
    players,
    eventLog: [],
    gameOver: null,
    nextInstanceSeq: seqRef.n,
    seed: options.seed,
  };
}
