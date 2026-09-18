/**
 * Cliente Socket.io da Arena Multiplayer 4P (Fase 3 / Terminal 2).
 *
 * Singleton independente do `socketClient.ts` (1v1) — conecta num `path`
 * dedicado (`server/simulatorSocket4p.ts`). Cobre o ciclo de vida completo:
 * fila FIFO / convite de esquadrão → lobby de 4 assentos com ready-check →
 * partida (lanes reais, uma por duelo) → radar tático, chat e emotes.
 */
import { io, type Socket } from "socket.io-client";

import { API_BASE_URL, getStoredAuth } from "@/lib/api";
import type { PlayerAction } from "@/modules/simulator/engine/actions";
import type { SimulatorMatchView } from "@/lib/api";

const SOCKET_PATH = "/api/simulator/socket4p";
const GUEST_TOKEN_KEY = "portal-gundam-tcg-br:sim-guest-token";

export type ArenaMode = "2v2" | "ffa";
export type ArenaSeatId = "seatA" | "seatB" | "seatC" | "seatD";
export const ARENA_SEAT_IDS: ArenaSeatId[] = ["seatA", "seatB", "seatC", "seatD"];

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
}
export interface ArenaLane {
  id: string;
  kind: "team1v1" | "ffa_r1" | "team_tiebreak" | "ffa_final";
  matchId: string;
  engineSeatOf: { A: ArenaSeatId; B: ArenaSeatId };
  status: "active" | "finished";
  winnerSeat?: ArenaSeatId;
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
export interface ArenaViewUpdate {
  arenaMatchId: string;
  seat: ArenaSeatId;
  lane: ArenaLane;
  view: SimulatorMatchView;
}
export interface ArenaError {
  code: string;
  message: string;
}
export interface ArenaQueueStatus {
  inQueue: boolean;
  position: number;
}
export interface ArenaEmoteEvent {
  arenaMatchId: string;
  seat: ArenaSeatId;
  emoteId: string;
  at: number;
}

interface EventMap {
  status: "idle" | "connecting" | "connected" | "reconnecting" | "dead";
  "arena:lobby_update": ArenaLobby;
  "arena:lobby_closed": { lobbyId: string };
  "arena:queue_status": ArenaQueueStatus;
  "arena:view_update": ArenaViewUpdate;
  "arena:radar_update": { arenaMatchId: string; radar: Record<ArenaSeatId, ArenaRadarEntry> };
  "arena:lane_result": { arenaMatchId: string; lane: ArenaLane };
  "arena:arena_over": { arenaMatchId: string; winner: ArenaWinner };
  "arena:chat": { arenaMatchId: string; entry: ArenaChatEntry };
  "arena:chat_backlog": { arenaMatchId: string; entries: ArenaChatEntry[] };
  "arena:emote": ArenaEmoteEvent;
  "arena:error": ArenaError;
}
type EventName = keyof EventMap;
type Handler<E extends EventName> = (payload: EventMap[E]) => void;

function socketOrigin(): string {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return typeof window !== "undefined" ? window.location.origin : "http://localhost:8787";
  }
}
function readGuestToken(): string | undefined {
  try {
    return window.localStorage.getItem(GUEST_TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
function writeGuestToken(token: string): void {
  try {
    window.localStorage.setItem(GUEST_TOKEN_KEY, token);
  } catch {
    // localStorage indisponível (modo privado / SSR) — segue sem persistir
  }
}

class Arena4pSocketClient {
  private socket: Socket | null = null;
  private status: EventMap["status"] = "idle";
  private actionSeq = 0;
  private readonly listeners = new Map<EventName, Set<(payload: unknown) => void>>();

  getStatus(): EventMap["status"] {
    return this.status;
  }

  on<E extends EventName>(event: E, handler: Handler<E>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as (payload: unknown) => void);
    return () => set!.delete(handler as (payload: unknown) => void);
  }
  private emitLocal<E extends EventName>(event: E, payload: EventMap[E]): void {
    for (const handler of this.listeners.get(event) ?? []) handler(payload);
  }
  private setStatus(status: EventMap["status"]): void {
    if (this.status === status) return;
    this.status = status;
    this.emitLocal("status", status);
  }

  connect(): void {
    if (this.socket) return;
    this.setStatus("connecting");
    const socket = io(socketOrigin(), {
      path: SOCKET_PATH,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 10_000,
      randomizationFactor: 0,
      auth: (cb) => cb({ token: getStoredAuth().token ?? undefined, guestToken: readGuestToken() }),
    });
    this.socket = socket;
    this.wire(socket);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.setStatus("idle");
  }

  private wire(socket: Socket): void {
    socket.on("connect", () => this.setStatus("connected"));
    socket.io.on("reconnect_attempt", () => this.setStatus("reconnecting"));
    socket.on("disconnect", (reason) => this.setStatus(reason === "io client disconnect" ? "idle" : "reconnecting"));
    socket.on("connect_error", () => this.setStatus(socket.active ? "reconnecting" : "dead"));
    socket.on("session:guest", (payload: { guestToken?: string }) => {
      if (payload?.guestToken) writeGuestToken(payload.guestToken);
    });

    const forward: EventName[] = [
      "arena:lobby_update",
      "arena:lobby_closed",
      "arena:queue_status",
      "arena:view_update",
      "arena:radar_update",
      "arena:lane_result",
      "arena:arena_over",
      "arena:chat",
      "arena:chat_backlog",
      "arena:emote",
      "arena:error",
    ];
    for (const event of forward) {
      socket.on(event, (payload: unknown) => this.emitLocal(event, payload as never));
    }
  }

  private ensureConnected(run: () => void): void {
    if (this.socket?.connected) {
      run();
      return;
    }
    this.connect();
    this.socket!.once("connect", run);
  }

  joinArenaQueue(mode: ArenaMode, deckId: string): void {
    this.ensureConnected(() => this.socket!.emit("arena:queue_join", { mode, deckId }));
  }
  leaveArenaQueue(mode: ArenaMode): void {
    if (this.socket?.connected) this.socket.emit("arena:queue_leave", { mode });
  }

  createSquad(mode: ArenaMode, deckId: string): Promise<{ lobbyId: string; squadCode: string }> {
    return this.request<{ lobbyId?: string; squadCode?: string; error?: string }>("arena:squad_create", { mode, deckId }).then((res) => {
      if (res.error || !res.lobbyId || !res.squadCode) throw new Error(res.error || "Não deu pra criar o esquadrão.");
      return { lobbyId: res.lobbyId, squadCode: res.squadCode };
    });
  }
  joinSquad(squadCode: string, deckId: string): Promise<{ lobbyId: string }> {
    return this.request<{ lobbyId?: string; error?: string }>("arena:squad_join", { squadCode, deckId }).then((res) => {
      if (res.error || !res.lobbyId) throw new Error(res.error || "Não deu pra entrar no esquadrão.");
      return { lobbyId: res.lobbyId };
    });
  }
  joinLobbyRoom(lobbyId: string): void {
    this.ensureConnected(() => this.socket!.emit("arena:lobby_join", { lobbyId }));
  }
  setReady(lobbyId: string, ready: boolean): void {
    if (this.socket?.connected) this.socket.emit("arena:ready", { lobbyId, ready });
  }
  leaveLobby(lobbyId: string): void {
    if (this.socket?.connected) this.socket.emit("arena:leave_lobby", { lobbyId });
  }

  joinArenaMatch(arenaMatchId: string): void {
    this.ensureConnected(() => this.socket!.emit("arena:join_match", { arenaMatchId }));
  }
  sendAction(arenaMatchId: string, action: PlayerAction): number {
    const actionSeq = ++this.actionSeq;
    if (this.socket?.connected) this.socket.emit("arena:action", { arenaMatchId, action, actionSeq });
    return actionSeq;
  }
  sendChat(arenaMatchId: string, text: string): void {
    if (this.socket?.connected) this.socket.emit("arena:chat", { arenaMatchId, text });
  }
  sendEmote(arenaMatchId: string, emoteId: string): void {
    if (this.socket?.connected) this.socket.emit("arena:emote", { arenaMatchId, emoteId });
  }
  ping(arenaMatchId: string): void {
    if (this.socket?.connected) this.socket.emit("arena:ping", { arenaMatchId });
  }

  private request<T>(event: string, payload: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      this.ensureConnected(() => {
        this.socket!.timeout(8_000).emit(event, payload, (err: unknown, res: T) => {
          if (err) reject(new Error("O servidor não respondeu a tempo."));
          else resolve(res);
        });
      });
    });
  }
}

export const arena4pSocket = new Arena4pSocketClient();
