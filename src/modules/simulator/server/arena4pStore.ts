/**
 * Arena Multiplayer 4P — lógica PURA de lobby/orquestração (Fase 3 / Terminal 2).
 *
 * Mora ao lado de `matchStore.ts` (mesma pasta `src/modules/simulator/server/`) e
 * NUNCA toca `src/modules/simulator/engine/` — o motor de regras segue sendo
 * exclusividade do Terminal 1. Este arquivo só CONSOME a API já exportada de
 * `matchStore.ts` (`createMatch`, `joinMatch`, `matchViewFor`, `getMatch`,
 * `subscribeAllMatches`) — cada assento da Arena 4P (`seatA`..`seatD`) vira um
 * jogador REAL num `MatchRecord` normal de 2 assentos ("A"/"B"), então timer de
 * turno, W.O. por abandono e reconexão da partida já funcionam de graça.
 *
 * Por que decompor 4P em "lanes" de 1v1 em vez de um motor de 4 jogadores:
 * o motor (`engine/types.ts`) tem `PlayerId = "A" | "B"` fixo — mudar isso é
 * mudar regra de combate, exatamente o que este terminal está proibido de
 * fazer. A solução: cada modalidade roda 2 duelos reais e simultâneos
 * (`lanes`), e a Arena decide o resultado agregado por cima:
 *
 *  - 2v2 Tag Team: Time 1 = seatA+seatC, Time 2 = seatB+seatD. `laneAB` (A vs B)
 *    e `laneCD` (C vs D) rodam ao mesmo tempo — cada piloto já enfrenta um
 *    piloto do time adversário. Se os 2 vencedores forem do mesmo time, esse
 *    time vence a Arena (2-0). Se ficar 1-1, os 2 vencedores de lane se
 *    enfrentam numa 3ª lane de desempate — quem vencer decide a Arena.
 *  - 4P Battle Royale (FFA): mesmas 2 lanes simultâneas na 1ª rodada
 *    (`ffa_r1`); os 2 vencedores se enfrentam na lane final (`ffa_final`) —
 *    quem vencer é o campeão; os 2 perdedores da 1ª rodada ficam empatados em
 *    3º/4º lugar.
 *
 * Radar tático: cada assento tem sua "vida" lida direto do `shields.length`
 * (6 shields iniciais é regra fixa do jogo — ver `engine/setup.ts`) do lado
 * correspondente na lane em que está.
 *
 * Resiliência de estado (pedido do Willen, branch
 * `feature/arena4p-state-resilience`): além do timer de turno normal de cada
 * lane (herdado de `matchStore.ts`), a Arena tem seu PRÓPRIO relógio de
 * presença por assento — `ARENA_RECONNECT_GRACE_MS` — que a camada de socket
 * arma quando o socket de um assento cai de vez. Ver `applyDisconnectAutoPass`.
 */
import type { DeckList } from "../engine/setup";
import type { PlayerId } from "../engine/types";
import {
  applyAction,
  createMatch,
  decisionOwner,
  defaultActionFor,
  getMatch,
  joinMatch,
  matchViewFor,
  type MatchRecord,
  type MatchView,
} from "./matchStore";

export type ArenaMode = "2v2" | "ffa";
export type ArenaSeatId = "seatA" | "seatB" | "seatC" | "seatD";
export const ARENA_SEAT_IDS: ArenaSeatId[] = ["seatA", "seatB", "seatC", "seatD"];

/** Regra fixa do Gundam Card Game: 6 shields iniciais (`engine/setup.ts`) — base de normalização do radar. */
export const ARENA_MAX_SHIELDS = 6;
/** Convite de esquadrão expira em 10min sem preencher os 4 assentos — mesma janela do convite 1v1 (`socketBridge.ts`). */
const SQUAD_TTL_MS = 10 * 60_000;
/** Quantas linhas de chat/log a Arena guarda por partida (janela recente, não histórico completo). */
const ARENA_CHAT_WINDOW = 200;
/**
 * Janela de tolerância de reconexão por assento (resiliência de estado da Arena
 * 4P) antes do servidor resolver sozinho a decisão pendente da lane ativa
 * daquele assento — ver `applyDisconnectAutoPass`. Deliberadamente mais
 * apertada que os timers normais de turno da lane (`TURN_DECISION_MS` = 300s /
 * `ACTION_STEP_DECISION_MS` = 30s em `matchStore.ts`): aqueles toleram um
 * jogador CONECTADO pensando; este cobre o caso de um jogador cujo socket caiu
 * de vez — inclusive de propósito, no meio de uma decisão (passar bloqueio,
 * escolher alvo), pra ganhar uma janela de conluio com o parceiro em 2v2
 * combinando a jogada por fora do jogo. 45s é curto o bastante pra fechar essa
 * janela sem punir uma queda de rede comum (o socket.io-client já reconecta
 * sozinho bem mais rápido que isso na maioria dos casos).
 */
export const ARENA_RECONNECT_GRACE_MS = 45_000;

export class ArenaError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface ArenaSeatOccupant {
  userId: string;
  displayName: string;
  deckKey: string;
  ready: boolean;
}

export interface ArenaLobby {
  id: string;
  mode: ArenaMode;
  hostUserId: string;
  seats: Partial<Record<ArenaSeatId, ArenaSeatOccupant>>;
  squadCode?: string;
  status: "LOBBY" | "STARTING" | "ACTIVE" | "FINISHED";
  arenaMatchId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ArenaLane {
  id: string;
  kind: "team1v1" | "ffa_r1" | "team_tiebreak" | "ffa_final";
  matchId: string;
  /** Qual assento da Arena controla o assento "A"/"B" do motor NESTA lane. */
  engineSeatOf: { A: ArenaSeatId; B: ArenaSeatId };
  status: "active" | "finished";
  winnerSeat?: ArenaSeatId;
}

export interface ArenaChatEntry {
  id: string;
  kind: "chat" | "system" | "combat";
  seat?: ArenaSeatId;
  displayName?: string;
  text: string;
  at: number;
}

export interface ArenaWinner {
  kind: "team" | "seat";
  team?: 1 | 2;
  seat?: ArenaSeatId;
}

export interface ArenaMatchRecord {
  id: string;
  lobbyId: string;
  mode: ArenaMode;
  seats: Record<ArenaSeatId, ArenaSeatOccupant>;
  teams?: { team1: ArenaSeatId[]; team2: ArenaSeatId[] };
  lanes: Map<string, ArenaLane>;
  eliminated: Set<ArenaSeatId>;
  status: "ACTIVE" | "FINISHED";
  winner?: ArenaWinner;
  chat: ArenaChatEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface ArenaRadarEntry {
  seat: ArenaSeatId;
  displayName: string;
  shieldsRemaining: number;
  maxShields: number;
  eliminated: boolean;
  laneId: string | null;
  laneStatus: "waiting" | "active" | "finished";
}

const lobbies = new Map<string, ArenaLobby>();
const arenaMatches = new Map<string, ArenaMatchRecord>();
/** Código de convite de esquadrão (curto, tipo `AR-4821`) → lobbyId. */
const squadCodes = new Map<string, { lobbyId: string; createdAt: number }>();

interface ArenaQueueEntry {
  userId: string;
  displayName: string;
  deckKey: string;
  mode: ArenaMode;
  joinedAt: number;
}
const queue: ArenaQueueEntry[] = [];

type ArenaListener = (event: ArenaEvent) => void;
export type ArenaEvent =
  | { type: "lobby_update"; lobby: ArenaLobby }
  | { type: "lobby_closed"; lobbyId: string }
  | { type: "match_start"; arenaMatch: ArenaMatchRecord }
  | { type: "radar_update"; arenaMatchId: string; radar: Record<ArenaSeatId, ArenaRadarEntry> }
  | { type: "lane_result"; arenaMatchId: string; lane: ArenaLane }
  | { type: "arena_over"; arenaMatchId: string; winner: ArenaWinner }
  | { type: "chat"; arenaMatchId: string; entry: ArenaChatEntry }
  | { type: "lane_action_forced"; arenaMatchId: string; lane: ArenaLane; seat: ArenaSeatId };

const listeners = new Set<ArenaListener>();
export function subscribeArena(listener: ArenaListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function emit(event: ArenaEvent): void {
  for (const l of listeners) l(event);
}

// ---------------------------------------------------------------------------
// Lobby: criação, entrada/saída, ready-check
// ---------------------------------------------------------------------------

function newLobbyId(): string {
  return crypto.randomUUID();
}

export function createLobby(mode: ArenaMode, host: { userId: string; displayName: string; deckKey: string }): ArenaLobby {
  const now = Date.now();
  const lobby: ArenaLobby = {
    id: newLobbyId(),
    mode,
    hostUserId: host.userId,
    seats: { seatA: { userId: host.userId, displayName: host.displayName, deckKey: host.deckKey, ready: false } },
    status: "LOBBY",
    createdAt: now,
    updatedAt: now,
  };
  lobbies.set(lobby.id, lobby);
  return lobby;
}

export function getLobby(lobbyId: string): ArenaLobby | undefined {
  return lobbies.get(lobbyId);
}

export function seatForUserInLobby(lobby: ArenaLobby, userId: string): ArenaSeatId | undefined {
  for (const seatId of ARENA_SEAT_IDS) {
    if (lobby.seats[seatId]?.userId === userId) return seatId;
  }
  return undefined;
}

function firstOpenSeat(lobby: ArenaLobby): ArenaSeatId | undefined {
  return ARENA_SEAT_IDS.find((s) => !lobby.seats[s]);
}

export function joinLobby(lobbyId: string, occupant: { userId: string; displayName: string; deckKey: string }): ArenaLobby {
  const lobby = requireLobby(lobbyId);
  if (lobby.status !== "LOBBY") throw new ArenaError("Esta sala já começou ou foi encerrada.", 409);
  const existing = seatForUserInLobby(lobby, occupant.userId);
  if (existing) {
    lobby.seats[existing] = { ...lobby.seats[existing]!, deckKey: occupant.deckKey };
    lobby.updatedAt = Date.now();
    emit({ type: "lobby_update", lobby });
    return lobby;
  }
  const seat = firstOpenSeat(lobby);
  if (!seat) throw new ArenaError("Sala cheia (4/4 pilotos).", 409);
  lobby.seats[seat] = { userId: occupant.userId, displayName: occupant.displayName, deckKey: occupant.deckKey, ready: false };
  lobby.updatedAt = Date.now();
  emit({ type: "lobby_update", lobby });
  return lobby;
}

export function leaveLobby(lobbyId: string, userId: string): ArenaLobby | undefined {
  const lobby = lobbies.get(lobbyId);
  if (!lobby || lobby.status !== "LOBBY") return lobby;
  const seat = seatForUserInLobby(lobby, userId);
  if (!seat) return lobby;
  delete lobby.seats[seat];
  lobby.updatedAt = Date.now();
  if (Object.keys(lobby.seats).length === 0) {
    lobbies.delete(lobbyId);
    for (const [code, entry] of squadCodes) if (entry.lobbyId === lobbyId) squadCodes.delete(code);
    emit({ type: "lobby_closed", lobbyId });
    return undefined;
  }
  // Anfitrião saiu: promove o próximo assento ocupado.
  if (lobby.hostUserId === userId) {
    const next = ARENA_SEAT_IDS.find((s) => lobby.seats[s]);
    if (next) lobby.hostUserId = lobby.seats[next]!.userId;
  }
  emit({ type: "lobby_update", lobby });
  return lobby;
}

export function setReady(lobbyId: string, userId: string, ready: boolean): ArenaLobby {
  const lobby = requireLobby(lobbyId);
  const seat = seatForUserInLobby(lobby, userId);
  if (!seat) throw new ArenaError("Você não está nesta sala.", 403);
  lobby.seats[seat] = { ...lobby.seats[seat]!, ready };
  lobby.updatedAt = Date.now();
  emit({ type: "lobby_update", lobby });
  return lobby;
}

export function lobbyIsFull(lobby: ArenaLobby): boolean {
  return ARENA_SEAT_IDS.every((s) => lobby.seats[s]);
}
export function lobbyAllReady(lobby: ArenaLobby): boolean {
  return ARENA_SEAT_IDS.every((s) => lobby.seats[s]?.ready);
}

function requireLobby(lobbyId: string): ArenaLobby {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) throw new ArenaError("Sala não encontrada — pode já ter sido encerrada.", 404);
  return lobby;
}

// ---------------------------------------------------------------------------
// Convite de esquadrão (código curto → lobby) — mesmo espírito do ChallengeRegistry 1v1.
// ---------------------------------------------------------------------------

function sweepSquadCodes(): void {
  const cutoff = Date.now() - SQUAD_TTL_MS;
  for (const [code, entry] of squadCodes) {
    if (entry.createdAt < cutoff && !lobbies.get(entry.lobbyId)) squadCodes.delete(code);
  }
}

export function createSquadInvite(lobbyId: string): string {
  sweepSquadCodes();
  let code = "";
  do {
    code = `AR-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (squadCodes.has(code));
  squadCodes.set(code, { lobbyId, createdAt: Date.now() });
  const lobby = requireLobby(lobbyId);
  lobby.squadCode = code;
  emit({ type: "lobby_update", lobby });
  return code;
}

export function resolveSquadCode(code: string): ArenaLobby {
  sweepSquadCodes();
  const entry = squadCodes.get(code.trim().toUpperCase());
  if (!entry) throw new ArenaError("Convite de esquadrão inválido ou expirado.", 404);
  return requireLobby(entry.lobbyId);
}

// ---------------------------------------------------------------------------
// Fila pública FIFO ("Fila Oficial 4P") — preenche os 4 assentos automaticamente.
// ---------------------------------------------------------------------------

export interface ArenaQueueJoinResult {
  matched: boolean;
  lobby?: ArenaLobby;
  position?: number;
}

export function joinArenaQueue(input: { userId: string; displayName: string; deckKey: string; mode: ArenaMode }): ArenaQueueJoinResult {
  leaveArenaQueue(input.userId);
  queue.push({ ...input, joinedAt: Date.now() });

  const pool = queue.filter((e) => e.mode === input.mode);
  if (pool.length >= 4) {
    const picked = pool.slice(0, 4);
    for (const entry of picked) {
      const idx = queue.indexOf(entry);
      if (idx >= 0) queue.splice(idx, 1);
    }
    const [host, ...rest] = picked;
    const lobby = createLobby(input.mode, host);
    for (const entry of rest) joinLobby(lobby.id, entry);
    for (const seat of ARENA_SEAT_IDS) if (lobby.seats[seat]) lobby.seats[seat]!.ready = true;
    lobby.updatedAt = Date.now();
    emit({ type: "lobby_update", lobby });
    return { matched: true, lobby };
  }
  return { matched: false, position: pool.length };
}

export function leaveArenaQueue(userId: string): void {
  const idx = queue.findIndex((e) => e.userId === userId);
  if (idx >= 0) queue.splice(idx, 1);
}

export function arenaQueuePositionFor(userId: string, mode: ArenaMode): number {
  const pool = queue.filter((e) => e.mode === mode);
  const idx = pool.findIndex((e) => e.userId === userId);
  return idx < 0 ? 0 : idx + 1;
}

// ---------------------------------------------------------------------------
// Início da partida: cria as lanes reais via matchStore (motor intocado).
// ---------------------------------------------------------------------------

function createLane(kind: ArenaLane["kind"], engineA: ArenaSeatId, engineB: ArenaSeatId, occupants: Record<ArenaSeatId, ArenaSeatOccupant>, decks: Record<ArenaSeatId, DeckList>): ArenaLane {
  const match: MatchRecord = createMatch({
    deckA: decks[engineA],
    deckB: decks[engineB],
    firstPlayer: Math.random() < 0.5 ? "A" : "B",
    mode: "casual",
  });
  joinMatch(match.id, "A", { userId: occupants[engineA].userId, displayName: occupants[engineA].displayName });
  joinMatch(match.id, "B", { userId: occupants[engineB].userId, displayName: occupants[engineB].displayName });
  return {
    id: `${kind}:${match.id}`,
    kind,
    matchId: match.id,
    engineSeatOf: { A: engineA, B: engineB },
    status: "active",
  };
}

export function startArenaMatch(lobby: ArenaLobby, decks: Record<ArenaSeatId, DeckList>): ArenaMatchRecord {
  if (!lobbyIsFull(lobby)) throw new ArenaError("A sala precisa dos 4 assentos preenchidos.", 409);
  const occupants = lobby.seats as Record<ArenaSeatId, ArenaSeatOccupant>;
  const now = Date.now();

  const laneAB = createLane(lobby.mode === "2v2" ? "team1v1" : "ffa_r1", "seatA", "seatB", occupants, decks);
  const laneCD = createLane(lobby.mode === "2v2" ? "team1v1" : "ffa_r1", "seatC", "seatD", occupants, decks);

  const arenaMatch: ArenaMatchRecord = {
    id: newLobbyId(),
    lobbyId: lobby.id,
    mode: lobby.mode,
    seats: occupants,
    teams: lobby.mode === "2v2" ? { team1: ["seatA", "seatC"], team2: ["seatB", "seatD"] } : undefined,
    lanes: new Map([
      [laneAB.id, laneAB],
      [laneCD.id, laneCD],
    ]),
    eliminated: new Set(),
    status: "ACTIVE",
    chat: [
      {
        id: crypto.randomUUID(),
        kind: "system",
        text: lobby.mode === "2v2" ? "Batalha 2v2 iniciada — Time 1 (A+C) vs Time 2 (B+D)." : "Battle Royale iniciada — rodada 1: A vs B e C vs D.",
        at: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  arenaMatches.set(arenaMatch.id, arenaMatch);

  lobby.status = "ACTIVE";
  lobby.arenaMatchId = arenaMatch.id;
  lobby.updatedAt = now;

  // O cliente descobre o `arenaMatchId` via `lobby_update` (é isso que faz a tela trocar de
  // "sala de espera" pra "Arena") — sem isso os 4 sockets nunca saberiam que a partida começou.
  emit({ type: "lobby_update", lobby });
  emit({ type: "match_start", arenaMatch });
  return arenaMatch;
}

export function getArenaMatch(id: string): ArenaMatchRecord | undefined {
  return arenaMatches.get(id);
}

/** Lane ativa que hospeda a partida real de um assento agora (ou `undefined` se ele está aguardando a próxima lane). */
export function activeLaneForSeat(arenaMatch: ArenaMatchRecord, seat: ArenaSeatId): ArenaLane | undefined {
  for (const lane of arenaMatch.lanes.values()) {
    if (lane.status !== "active") continue;
    if (lane.engineSeatOf.A === seat || lane.engineSeatOf.B === seat) return lane;
  }
  return undefined;
}

/** Exportado pra a camada de socket poder montar o `PlayerId` do assento sem duplicar a regra. */
export function engineSeatFor(lane: ArenaLane, arenaSeat: ArenaSeatId): PlayerId {
  return lane.engineSeatOf.A === arenaSeat ? "A" : "B";
}

export function matchViewForArenaSeat(arenaMatch: ArenaMatchRecord, seat: ArenaSeatId): { lane: ArenaLane; view: MatchView } | undefined {
  const lane = activeLaneForSeat(arenaMatch, seat);
  if (!lane) return undefined;
  const match = getMatch(lane.matchId);
  if (!match) return undefined;
  return { lane, view: matchViewFor(match, engineSeatFor(lane, seat)) };
}

// ---------------------------------------------------------------------------
// Reage ao fim de uma lane (chamado pelo listener global de `matchStore` na
// camada de socket) — evolui o bracket e decide o vencedor da Arena.
// ---------------------------------------------------------------------------

/** Chame para TODO matchId que terminar — no-op se não pertence a uma Arena. */
export function notifyMatchMaybeArenaLane(matchId: string): void {
  for (const arenaMatch of arenaMatches.values()) {
    if (arenaMatch.status === "FINISHED") continue;
    const lane = [...arenaMatch.lanes.values()].find((l) => l.matchId === matchId && l.status === "active");
    if (!lane) continue;
    const match = getMatch(matchId);
    const winnerEngineSeat = match?.state.gameOver?.winner;
    if (!winnerEngineSeat) continue;

    const winnerSeat = winnerEngineSeat === "A" ? lane.engineSeatOf.A : lane.engineSeatOf.B;
    const loserSeat = winnerEngineSeat === "A" ? lane.engineSeatOf.B : lane.engineSeatOf.A;
    lane.status = "finished";
    lane.winnerSeat = winnerSeat;
    arenaMatch.eliminated.add(loserSeat);
    arenaMatch.updatedAt = Date.now();
    pushChat(arenaMatch, {
      id: crypto.randomUUID(),
      kind: "combat",
      seat: winnerSeat,
      text: `${arenaMatch.seats[winnerSeat].displayName} venceu o duelo contra ${arenaMatch.seats[loserSeat].displayName}.`,
      at: Date.now(),
    });
    emit({ type: "lane_result", arenaMatchId: arenaMatch.id, lane });

    advanceArena(arenaMatch, lane);
  }
}

function advanceArena(arenaMatch: ArenaMatchRecord, finishedLane: ArenaLane): void {
  if (finishedLane.kind === "ffa_r1" || finishedLane.kind === "team1v1") {
    const round1 = [...arenaMatch.lanes.values()].filter((l) => l.kind === finishedLane.kind);
    if (round1.some((l) => l.status === "active")) return; // ainda falta a lane irmã terminar

    const [laneA, laneB] = round1;
    const winnerA = laneA.winnerSeat!;
    const winnerB = laneB.winnerSeat!;
    // Perdedores da rodada 1 já foram marcados como eliminados em `notifyMatchMaybeArenaLane`.

    if (arenaMatch.mode === "2v2" && arenaMatch.teams) {
      const winnerTeam = (s: ArenaSeatId) => (arenaMatch.teams!.team1.includes(s) ? 1 : 2);
      if (winnerTeam(winnerA) === winnerTeam(winnerB)) {
        finishArena(arenaMatch, { kind: "team", team: winnerTeam(winnerA) });
        return;
      }
      // 1-1: os 2 vencedores de lane se enfrentam pra decidir o time campeão.
      spawnTiebreakLane(arenaMatch, winnerA, winnerB);
      return;
    }

    // FFA: os 2 vencedores da rodada 1 se enfrentam na lane final.
    spawnFinalLane(arenaMatch, winnerA, winnerB);
    return;
  }

  // Lane de desempate (2v2) ou final (FFA) — decide a Arena inteira.
  const winnerSeat = finishedLane.winnerSeat!;
  if (arenaMatch.mode === "2v2" && arenaMatch.teams) {
    const team = arenaMatch.teams.team1.includes(winnerSeat) ? 1 : 2;
    finishArena(arenaMatch, { kind: "team", team });
  } else {
    finishArena(arenaMatch, { kind: "seat", seat: winnerSeat });
  }
}

function spawnPostRoundLane(arenaMatch: ArenaMatchRecord, kind: "team_tiebreak" | "ffa_final", seatX: ArenaSeatId, seatY: ArenaSeatId, chatText: string): void {
  const rebuiltDecks: Partial<Record<ArenaSeatId, DeckList>> = {};
  for (const seat of [seatX, seatY]) {
    const originalLane = [...arenaMatch.lanes.values()].find((l) => l.engineSeatOf.A === seat || l.engineSeatOf.B === seat);
    const match = originalLane && getMatch(originalLane.matchId);
    if (match) rebuiltDecks[seat] = match.deckLists?.[engineSeatFor(originalLane!, seat)];
  }
  if (!rebuiltDecks[seatX] || !rebuiltDecks[seatY]) return; // decks somem só se a lane original já foi liberada — não deveria acontecer em memória quente

  const lane = createLane(kind, seatX, seatY, arenaMatch.seats, rebuiltDecks as Record<ArenaSeatId, DeckList>);
  arenaMatch.lanes.set(lane.id, lane);
  arenaMatch.updatedAt = Date.now();
  pushChat(arenaMatch, { id: crypto.randomUUID(), kind: "system", text: chatText, at: Date.now() });
  emit({ type: "match_start", arenaMatch });
}

function spawnTiebreakLane(arenaMatch: ArenaMatchRecord, seatX: ArenaSeatId, seatY: ArenaSeatId): void {
  spawnPostRoundLane(
    arenaMatch,
    "team_tiebreak",
    seatX,
    seatY,
    `1-1 entre os times! ${arenaMatch.seats[seatX].displayName} e ${arenaMatch.seats[seatY].displayName} decidem o time campeão no desempate.`,
  );
}

function spawnFinalLane(arenaMatch: ArenaMatchRecord, seatX: ArenaSeatId, seatY: ArenaSeatId): void {
  spawnPostRoundLane(
    arenaMatch,
    "ffa_final",
    seatX,
    seatY,
    `Final da Battle Royale: ${arenaMatch.seats[seatX].displayName} vs ${arenaMatch.seats[seatY].displayName}.`,
  );
}

function finishArena(arenaMatch: ArenaMatchRecord, winner: ArenaWinner): void {
  arenaMatch.status = "FINISHED";
  arenaMatch.winner = winner;
  arenaMatch.updatedAt = Date.now();
  const text =
    winner.kind === "team"
      ? `Time ${winner.team} venceu a Arena!`
      : `${arenaMatch.seats[winner.seat!].displayName} é o campeão da Battle Royale!`;
  pushChat(arenaMatch, { id: crypto.randomUUID(), kind: "system", text, at: Date.now() });
  emit({ type: "arena_over", arenaMatchId: arenaMatch.id, winner });
}

// ---------------------------------------------------------------------------
// Resiliência de reconexão: auto-pass determinístico por queda de socket (ver
// `ARENA_RECONNECT_GRACE_MS`). Chamado pela camada de socket
// (`server/simulatorSocket4p.ts`) quando um assento fica 45s sem nenhum
// socket vivo.
// ---------------------------------------------------------------------------

/**
 * Resolve a decisão pendente da lane ATIVA de `seat` pela opção "não fazer
 * nada de especial" — a MESMA `defaultActionFor` que o timer normal de turno
 * usaria (skip block, recusar Burst, resolver habilidade sem alvo, manter a
 * mão no mulligan, ...), só que sem esperar `TURN_DECISION_MS`/
 * `ACTION_STEP_DECISION_MS`. No-op (silencioso, seguro de chamar a qualquer
 * momento) se: a Arena já terminou; o assento não tem lane ativa (partida
 * ainda não começou ou já foi eliminado); a lane já terminou; ou a decisão
 * pendente NA HORA já não é mais deste assento (o jogo andou sozinho nesse
 * meio-tempo — reconectar ou não, tanto faz).
 */
export function applyDisconnectAutoPass(arenaMatchId: string, seat: ArenaSeatId): void {
  const arenaMatch = arenaMatches.get(arenaMatchId);
  if (!arenaMatch || arenaMatch.status === "FINISHED") return;
  const lane = activeLaneForSeat(arenaMatch, seat);
  if (!lane) return;
  const match = getMatch(lane.matchId);
  if (!match || match.state.gameOver) return;

  const engineSeat = engineSeatFor(lane, seat);
  if (decisionOwner(match.state) !== engineSeat) return;

  const occupant = arenaMatch.seats[seat];
  const action = defaultActionFor(match.state);
  try {
    applyAction(lane.matchId, occupant.userId, action);
  } catch {
    return; // ação-padrão virou ilegal por algum motivo inesperado — desiste desta tentativa, não trava nada
  }

  pushChat(arenaMatch, {
    id: crypto.randomUUID(),
    kind: "system",
    seat,
    text: `${occupant.displayName} ficou ${Math.round(ARENA_RECONNECT_GRACE_MS / 1000)}s sem conexão — o servidor resolveu a decisão pendente automaticamente.`,
    at: Date.now(),
  });
  emit({ type: "lane_action_forced", arenaMatchId: arenaMatch.id, lane, seat });
}

// ---------------------------------------------------------------------------
// Radar tático + chat
// ---------------------------------------------------------------------------

export function radarSnapshotFor(arenaMatch: ArenaMatchRecord): Record<ArenaSeatId, ArenaRadarEntry> {
  const result = {} as Record<ArenaSeatId, ArenaRadarEntry>;
  for (const seat of ARENA_SEAT_IDS) {
    const occupant = arenaMatch.seats[seat];
    const lane = activeLaneForSeat(arenaMatch, seat);
    const eliminated = arenaMatch.eliminated.has(seat);
    let shieldsRemaining = 0;
    let laneStatus: ArenaRadarEntry["laneStatus"] = "waiting";
    if (lane) {
      const match = getMatch(lane.matchId);
      if (match) {
        const view = matchViewFor(match, engineSeatFor(lane, seat));
        shieldsRemaining = view.view.players[engineSeatFor(lane, seat)]?.counts.shields ?? 0;
        laneStatus = "active";
      }
    } else if (eliminated) {
      laneStatus = "finished";
    }
    result[seat] = {
      seat,
      displayName: occupant?.displayName ?? seat,
      shieldsRemaining,
      maxShields: ARENA_MAX_SHIELDS,
      eliminated,
      laneId: lane?.id ?? null,
      laneStatus,
    };
  }
  return result;
}

export function broadcastRadar(arenaMatch: ArenaMatchRecord): void {
  emit({ type: "radar_update", arenaMatchId: arenaMatch.id, radar: radarSnapshotFor(arenaMatch) });
}

function pushChat(arenaMatch: ArenaMatchRecord, entry: ArenaChatEntry): void {
  arenaMatch.chat.push(entry);
  if (arenaMatch.chat.length > ARENA_CHAT_WINDOW) arenaMatch.chat.splice(0, arenaMatch.chat.length - ARENA_CHAT_WINDOW);
  emit({ type: "chat", arenaMatchId: arenaMatch.id, entry });
}

export function addArenaChatMessage(arenaMatch: ArenaMatchRecord, seat: ArenaSeatId, text: string): void {
  const trimmed = text.trim().slice(0, 280);
  if (!trimmed) return;
  pushChat(arenaMatch, { id: crypto.randomUUID(), kind: "chat", seat, displayName: arenaMatch.seats[seat]?.displayName, text: trimmed, at: Date.now() });
}

/** Só para testes: limpa todo o estado em memória. */
export function _resetArenaForTests(): void {
  lobbies.clear();
  arenaMatches.clear();
  squadCodes.clear();
  queue.length = 0;
  // `listeners` (subscribeArena) NÃO era limpo aqui -- achado ao rodar a suíte completa
  // (2026-09-18, Sprint 2): cada `it()` em simulatorSocket4p.test.ts chama
  // `attachSimulatorArena4pSocket` no `beforeEach`, que assina um novo listener sem nunca
  // cancelar o anterior -- acumula 1 listener órfão (com `io` de servidor já fechado) por
  // teste anterior do arquivo. `matchStore.ts` já limpava o equivalente
  // (`globalMatchListeners.clear()`) -- só faltava aqui. Real leak de recursos entre testes,
  // independente de explicar sozinho toda flakiness observada sob suíte completa.
  listeners.clear();
}
