import type { GameState, PlayerId } from "../engine/types";
import { createGame, type DeckList } from "../engine/setup";
import { advanceToMainPhase } from "../engine/phases";
import { applyPlayerAction, type PlayerAction } from "../engine/actions";
import { viewStatesForBothPlayers, type ViewGameState } from "../engine/viewState";
import { ALL_EFFECT_SPECS, defaultPredicateResolver } from "../content";

/**
 * Match store em memória (docs/18, passo 4 — decisão do Willen: em memória,
 * sem persistência; acesso restrito a admin/hoster; sincronização por SSE).
 * Cada `MatchRecord` guarda o `GameState` REAL — nunca sai daqui inteiro; só
 * `viewStateFor`/`viewStatesForBothPlayers` (engine/viewState.ts) saem pra
 * rede, um por jogador, já redigido. As rotas HTTP (`server/index.ts`) só
 * chamam as funções deste módulo — nenhuma delas toca `GameState` direto.
 *
 * Sem persistência de propósito: reiniciar o servidor derruba toda partida
 * em andamento. Isso é aceitável pro escopo desta wave (sandbox de teste
 * admin/hoster, não uma partida real de usuário final — Fase 3/PvP, se e
 * quando acontecer, decide separadamente se precisa sobreviver a restart).
 */

export interface MatchSeat {
  userId: string;
  displayName: string;
}

export interface MatchRecord {
  id: string;
  state: GameState;
  seats: Partial<Record<PlayerId, MatchSeat>>;
  createdAt: number;
  updatedAt: number;
  /** incrementa a cada `applyAction` — conveniência pra cliente detectar "cheguei atrasado" numa reconexão de SSE */
  version: number;
}

export class MatchError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type Listener = (views: Record<PlayerId, ViewGameState>, match: MatchRecord) => void;

const matches = new Map<string, MatchRecord>();
const listeners = new Map<string, Set<Listener>>();

export interface CreateMatchOptions {
  deckA: DeckList;
  deckB: DeckList;
  /** default: aleatório — só passe um valor fixo em teste, pra determinismo */
  seed?: number;
  firstPlayer?: PlayerId;
}

/** Cria a partida e já avança até a Main Phase do 1º jogador (Start/Draw/Resource não exigem decisão de ninguém). */
export function createMatch(opts: CreateMatchOptions): MatchRecord {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const firstPlayer = opts.firstPlayer ?? "A";
  const state = advanceToMainPhase(createGame(opts.deckA, opts.deckB, { seed, firstPlayer }));

  const now = Date.now();
  const match: MatchRecord = { id: crypto.randomUUID(), state, seats: {}, createdAt: now, updatedAt: now, version: 1 };
  matches.set(match.id, match);
  return match;
}

export function getMatch(matchId: string): MatchRecord | undefined {
  return matches.get(matchId);
}

export function listMatches(): MatchRecord[] {
  return [...matches.values()].sort((a, b) => b.createdAt - a.createdAt);
}

function requireMatch(matchId: string): MatchRecord {
  const match = matches.get(matchId);
  if (!match) throw new MatchError("Partida não encontrada (pode ter sido derrubada por restart — não há persistência).", 404);
  return match;
}

/** Qual assento (A/B) esse usuário ocupa nesta partida, se algum. */
export function seatFor(match: MatchRecord, userId: string): PlayerId | undefined {
  for (const seat of ["A", "B"] as PlayerId[]) {
    if (match.seats[seat]?.userId === userId) return seat;
  }
  return undefined;
}

/**
 * Um usuário entra num assento (A ou B) — nunca troca depois de ocupado.
 * Rejeita se o assento já tem OUTRO usuário, e rejeita o mesmo usuário
 * ocupar os 2 assentos (isso destruiria o próprio propósito do teste: 2
 * contas reais, 2 sessões reais, ver docs/18).
 */
export function joinMatch(matchId: string, seat: PlayerId, player: MatchSeat): MatchRecord {
  const match = requireMatch(matchId);

  const currentOccupant = match.seats[seat];
  if (currentOccupant && currentOccupant.userId !== player.userId) {
    throw new MatchError(`Assento ${seat} já está ocupado por outro jogador.`, 409);
  }

  const otherSeat: PlayerId = seat === "A" ? "B" : "A";
  if (match.seats[otherSeat]?.userId === player.userId) {
    throw new MatchError("Esse usuário já ocupa o assento oposto nesta partida — use 2 contas diferentes.", 409);
  }

  match.seats[seat] = player;
  match.updatedAt = Date.now();
  notify(match);
  return match;
}

/** Aplica a ação do usuário (identificado por `userId`, não por `PlayerId` — o assento é resolvido aqui). */
export function applyAction(matchId: string, userId: string, action: PlayerAction): MatchRecord {
  const match = requireMatch(matchId);
  const seat = seatFor(match, userId);
  if (!seat) throw new MatchError("Esse usuário não é jogador desta partida (precisa entrar num assento primeiro).", 403);
  if (match.state.gameOver) throw new MatchError("A partida já terminou.", 409);

  let nextState: GameState;
  try {
    nextState = applyPlayerAction(match.state, seat, action, ALL_EFFECT_SPECS, defaultPredicateResolver);
  } catch (err) {
    throw new MatchError(err instanceof Error ? err.message : "Ação inválida.", 400);
  }

  match.state = nextState;
  match.updatedAt = Date.now();
  match.version += 1;
  notify(match);
  return match;
}

/** Assina atualizações de uma partida (visão já redigida por jogador). Devolve a função de cancelamento. */
export function subscribe(matchId: string, listener: Listener): () => void {
  let set = listeners.get(matchId);
  if (!set) {
    set = new Set();
    listeners.set(matchId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(matchId);
  };
}

function notify(match: MatchRecord): void {
  const set = listeners.get(match.id);
  if (!set || set.size === 0) return;
  const views = viewStatesForBothPlayers(match.state);
  for (const listener of set) listener(views, match);
}

export function deleteMatch(matchId: string): void {
  matches.delete(matchId);
  listeners.delete(matchId);
}

/** Só pra teste — evita vazar estado de um `it()` pro outro (o store é module-level, não por-request). */
export function _resetAllMatchesForTests(): void {
  matches.clear();
  listeners.clear();
}
