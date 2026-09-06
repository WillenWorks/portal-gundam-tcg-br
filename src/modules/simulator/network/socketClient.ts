/**
 * Cliente Socket.io do simulador (Frente 5 — docs/39 §2.2 e §3).
 *
 * Singleton. Roda AO LADO do transporte SSE atual (`buildSimulatorStreamUrl` /
 * `EventSource` em `SimulatorMatchPage.tsx`) — a página escolhe qual usar; a
 * migração total vem depois. Aqui:
 *
 *  - Reconexão automática com backoff exponencial 500ms → 1s → 2s → 4s → teto 10s.
 *  - Ao (re)conectar, reemite `match:join` da partida ativa e recebe o snapshot.
 *  - Fila de ações com `actionSeq` monotônico (idempotência — o servidor
 *    ignora reenvio, ver `ActionDeduper` em `socketBridge.ts`).
 *  - Telemetria de ping (RTT do `match:ping` com ack).
 *  - Convidado sem login: guarda o `guestToken` assinado que o servidor emite.
 */
import { io, type Socket } from "socket.io-client";

import { API_BASE_URL, getStoredAuth, type SimulatorMatchView } from "@/lib/api";
import type { PlayerAction } from "@/modules/simulator/engine/actions";

const SOCKET_PATH = "/api/simulator/socket";
const GUEST_TOKEN_KEY = "portal-gundam-tcg-br:sim-guest-token";
const RECONNECT_DELAY_MS = 500;
const RECONNECT_DELAY_MAX_MS = 10_000;
const PING_INTERVAL_MS = 10_000;

export type SimulatorSocketStatus = "idle" | "connecting" | "connected" | "reconnecting" | "dead";

export interface MatchViewUpdate {
  view: SimulatorMatchView;
  lastActionSeq: number;
}
export interface MatchSocketError {
  code: string;
  message: string;
}
export interface OpponentStatus {
  online: boolean;
  lastSeenMs: number;
}
export interface QueueStatusEvent {
  inQueue: boolean;
  position: number;
  waitTimeSec: number;
}
export interface ChallengeReady {
  matchId: string;
}

interface SimulatorSocketEventMap {
  status: SimulatorSocketStatus;
  ping: number;
  "match:view_update": MatchViewUpdate;
  "match:error": MatchSocketError;
  "match:opponent_status": OpponentStatus;
  "queue:status": QueueStatusEvent;
  "challenge:ready": ChallengeReady;
  "challenge:created": { challengeCode: string };
}
type EventName = keyof SimulatorSocketEventMap;
type Handler<E extends EventName> = (payload: SimulatorSocketEventMap[E]) => void;

interface QueuedAction {
  matchId: string;
  action: PlayerAction;
  actionSeq: number;
}

/** Origem HTTP do backend (o `API_BASE_URL` termina em `/api`). */
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

class SimulatorSocketClient {
  private socket: Socket | null = null;
  private status: SimulatorSocketStatus = "idle";
  private activeMatchId: string | null = null;
  private actionSeq = 0;
  private readonly pendingActions: QueuedAction[] = [];
  private lastPingMs: number | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Map<EventName, Set<(payload: unknown) => void>>();

  getStatus(): SimulatorSocketStatus {
    return this.status;
  }
  getLastPingMs(): number | null {
    return this.lastPingMs;
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

  private emitLocal<E extends EventName>(event: E, payload: SimulatorSocketEventMap[E]): void {
    for (const handler of this.listeners.get(event) ?? []) handler(payload);
  }

  private setStatus(status: SimulatorSocketStatus): void {
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
      reconnectionDelay: RECONNECT_DELAY_MS,
      reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
      randomizationFactor: 0,
      auth: (cb) => cb({ token: getStoredAuth().token ?? undefined, guestToken: readGuestToken() }),
    });
    this.socket = socket;
    this.wire(socket);
  }

  disconnect(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.socket?.disconnect();
    this.socket = null;
    this.activeMatchId = null;
    this.pendingActions.length = 0;
    this.setStatus("idle");
  }

  private wire(socket: Socket): void {
    socket.on("connect", () => {
      this.setStatus("connected");
      if (this.activeMatchId) socket.emit("match:join", { matchId: this.activeMatchId });
      this.flushPending();
      this.startPingLoop();
    });
    socket.io.on("reconnect_attempt", () => this.setStatus("reconnecting"));
    socket.on("disconnect", (reason) => {
      // "io server disconnect" / "io client disconnect" não re-tentam sozinhos
      this.setStatus(reason === "io client disconnect" ? "idle" : "reconnecting");
    });
    socket.on("connect_error", () => {
      this.setStatus(socket.active ? "reconnecting" : "dead");
    });

    socket.on("session:guest", (payload: { guestToken?: string }) => {
      if (payload?.guestToken) writeGuestToken(payload.guestToken);
    });

    const forward: EventName[] = [
      "match:view_update",
      "match:error",
      "match:opponent_status",
      "queue:status",
      "challenge:ready",
      "challenge:created",
    ];
    for (const event of forward) {
      socket.on(event, (payload: unknown) => this.emitLocal(event, payload as never));
    }
  }

  private startPingLoop(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => this.ping(), PING_INTERVAL_MS);
  }

  private flushPending(): void {
    if (!this.socket?.connected) return;
    const queued = this.pendingActions.splice(0, this.pendingActions.length);
    for (const item of queued) {
      this.socket.emit("match:action", { matchId: item.matchId, action: item.action, actionSeq: item.actionSeq });
    }
  }

  joinMatch(matchId: string): void {
    this.activeMatchId = matchId;
    if (this.socket?.connected) this.socket.emit("match:join", { matchId });
    else this.connect();
  }

  /** Envia a ação já numerada. Se estiver offline, enfileira e reenvia ao reconectar (o servidor dedupe). */
  sendAction(matchId: string, action: PlayerAction): number {
    const actionSeq = ++this.actionSeq;
    if (this.socket?.connected) {
      this.socket.emit("match:action", { matchId, action, actionSeq });
    } else {
      this.pendingActions.push({ matchId, action, actionSeq });
      this.connect();
    }
    return actionSeq;
  }

  ping(matchId?: string): void {
    const target = matchId ?? this.activeMatchId;
    if (!this.socket?.connected || !target) return;
    const sentAt = Date.now();
    this.socket.timeout(5_000).emit("match:ping", { matchId: target }, (err: unknown) => {
      if (err) return;
      this.lastPingMs = Date.now() - sentAt;
      this.emitLocal("ping", this.lastPingMs);
    });
  }

  joinQueue(deckId: string, mode: "casual" | "ranked" = "casual"): void {
    this.ensureConnected(() => this.socket!.emit("queue:join", { deckId, mode }));
  }
  leaveQueue(): void {
    if (this.socket?.connected) this.socket.emit("queue:leave");
  }

  createChallenge(deckId: string): Promise<string> {
    return this.request<{ challengeCode?: string; error?: string }>("challenge:create", { deckId }).then((res) => {
      if (res.error || !res.challengeCode) throw new Error(res.error || "Não deu pra criar o convite.");
      return res.challengeCode;
    });
  }
  acceptChallenge(challengeCode: string, deckId: string): Promise<string> {
    return this.request<{ matchId?: string; error?: string }>("challenge:accept", { challengeCode, deckId }).then((res) => {
      if (res.error || !res.matchId) throw new Error(res.error || "Não deu pra aceitar o convite.");
      return res.matchId;
    });
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

  private ensureConnected(run: () => void): void {
    if (this.socket?.connected) {
      run();
      return;
    }
    this.connect();
    this.socket!.once("connect", run);
  }
}

export const simulatorSocket = new SimulatorSocketClient();
