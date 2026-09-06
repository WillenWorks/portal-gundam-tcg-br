/**
 * Camada Socket.io do simulador (Frente 5 — docs/39).
 *
 * ADITIVA: roda AO LADO do SSE (`/api/simulator/matches/:id/stream`) e das
 * rotas POST de ação, que continuam intactos. O cliente escolhe o transporte;
 * a migração total vem depois, com validação do Willen. Aqui a gente só
 * pendura o `io` no mesmo HTTP server do Express e liga:
 *
 *  - Handshake com JWT em `auth.token` (mesmo `JWT_SECRET`/`jwt.verify` das
 *    rotas). Sem token → `guestId` efêmero assinado (partida casual sem cadastro).
 *  - Salas: `lobby:global` (todo mundo), `match:{id}` e `match:{id}:{seat}`
 *    (isolamento por partida + por assento pra visão redigida).
 *  - Broadcast de `match:view_update` sempre que o motor autoritativo muda
 *    (via `subscribeAllMatches` do matchStore) — uma visão por jogador.
 *  - Fila de matchmaking, convite direto por link (`challenge:*`) e ping.
 *
 * Contrato de eventos: docs/39 §2.2 (não desviar sem atualizar o doc).
 */
import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server, type Socket } from "socket.io";

import type { DeckList } from "../src/modules/simulator/engine/setup.ts";
import type { PlayerAction } from "../src/modules/simulator/engine/actions.ts";
import type { PlayerId } from "../src/modules/simulator/engine/types.ts";
import {
  applyAction,
  createMatch,
  getMatch,
  joinMatch,
  joinQueue,
  leaveQueue,
  loadMatch,
  matchViewFor,
  MatchError,
  queuePositionFor,
  seatFor,
  subscribeAllMatches,
  touchPresence,
} from "../src/modules/simulator/server/matchStore.ts";
import { ActionDeduper, ChallengeRegistry } from "../src/modules/simulator/server/socketBridge.ts";

const SOCKET_PATH = "/api/simulator/socket";
const LOBBY_ROOM = "lobby:global";
/** Validade do guestId efêmero assinado (convidado sem cadastro). */
const GUEST_TOKEN_TTL = "12h";

type ResolvedDeck = { key: string; build: () => DeckList };

export interface SimulatorSocketDeps {
  jwtSecret: string;
  allowedOrigins: string[];
  /** Mesma função `resolveDeckKey` do `server/index.ts` (ST01/ST02…). */
  resolveDeck: (raw: unknown) => ResolvedDeck | null;
}

interface SocketUser {
  userId: string;
  displayName: string;
  guest: boolean;
}

type SocketData = {
  user: SocketUser;
  freshGuestToken?: string;
  matchId?: string;
  seat?: PlayerId;
  challengeCode?: string;
};

function matchRoom(matchId: string): string {
  return `match:${matchId}`;
}
function seatRoom(matchId: string, seat: PlayerId): string {
  return `match:${matchId}:${seat}`;
}
function otherSeat(seat: PlayerId): PlayerId {
  return seat === "A" ? "B" : "A";
}

export function attachSimulatorSocket(httpServer: HttpServer, deps: SimulatorSocketDeps): Server {
  const io = new Server(httpServer, {
    path: SOCKET_PATH,
    serveClient: false,
    cors: deps.allowedOrigins.length ? { origin: deps.allowedOrigins } : { origin: true },
  });

  const challenges = new ChallengeRegistry();
  const deduper = new ActionDeduper();
  /** userId → sockets vivos daquele usuário (pra empurrar `challenge:ready` pro outro lado). */
  const socketsByUser = new Map<string, Set<Socket>>();

  function emitToUser(userId: string, event: string, payload: unknown): void {
    for (const socket of socketsByUser.get(userId) ?? []) socket.emit(event, payload);
  }

  function pushViewUpdate(matchId: string, seat: PlayerId): void {
    const match = getMatch(matchId);
    if (!match) return;
    io.to(seatRoom(matchId, seat)).emit("match:view_update", {
      view: matchViewFor(match, seat),
      lastActionSeq: deduper.lastApplied(matchId, seat),
    });
  }

  function emitOpponentStatus(matchId: string): void {
    const match = getMatch(matchId);
    if (!match) return;
    for (const seat of ["A", "B"] as PlayerId[]) {
      const oppSeat = otherSeat(seat);
      const oppUserId = match.seats[oppSeat]?.userId;
      const online = oppUserId ? (socketsByUser.get(oppUserId)?.size ?? 0) > 0 : false;
      const lastSeenMs = match.lastSeenAt[oppSeat] ?? 0;
      io.to(seatRoom(matchId, seat)).emit("match:opponent_status", { online, lastSeenMs });
    }
  }

  // --- Broadcast do estado autoritativo: 1 assinatura global pra todas as partidas. ---
  subscribeAllMatches((matchId, views) => {
    io.to(seatRoom(matchId, "A")).emit("match:view_update", { view: views.A, lastActionSeq: deduper.lastApplied(matchId, "A") });
    io.to(seatRoom(matchId, "B")).emit("match:view_update", { view: views.B, lastActionSeq: deduper.lastApplied(matchId, "B") });
    emitOpponentStatus(matchId);
  });

  // --- Handshake: valida o JWT ou emite um guestId efêmero assinado. ---
  io.use((socket, next) => {
    const auth = (socket.handshake.auth ?? {}) as { token?: string; guestToken?: string };
    const data = socket.data as SocketData;

    if (auth.token) {
      try {
        const payload = jwt.verify(auth.token, deps.jwtSecret) as { userId: string; username?: string; email?: string };
        data.user = { userId: payload.userId, displayName: payload.username || payload.email || "Jogador", guest: false };
        return next();
      } catch {
        // token expirado/inválido → cai pro fluxo de convidado abaixo em vez de derrubar a conexão
      }
    }
    if (auth.guestToken) {
      try {
        const payload = jwt.verify(auth.guestToken, deps.jwtSecret) as { guestId: string };
        data.user = { userId: payload.guestId, displayName: "Convidado", guest: true };
        return next();
      } catch {
        // guestToken velho → gera um novo abaixo
      }
    }
    const guestId = `guest:${randomUUID()}`;
    data.user = { userId: guestId, displayName: "Convidado", guest: true };
    data.freshGuestToken = jwt.sign({ guestId, guest: true }, deps.jwtSecret, { expiresIn: GUEST_TOKEN_TTL });
    next();
  });

  io.on("connection", (socket) => {
    const data = socket.data as SocketData;
    const user = data.user;

    let userSet = socketsByUser.get(user.userId);
    if (!userSet) {
      userSet = new Set();
      socketsByUser.set(user.userId, userSet);
    }
    userSet.add(socket);

    void socket.join(LOBBY_ROOM);
    if (data.freshGuestToken) {
      socket.emit("session:guest", { guestId: user.userId, guestToken: data.freshGuestToken });
    }

    // ---- match:join { matchId } ----
    socket.on("match:join", async (payload: { matchId?: string } = {}) => {
      const matchId = String(payload?.matchId ?? "");
      if (!matchId) return socket.emit("match:error", { code: "bad_request", message: "matchId ausente." });
      const match = await loadMatch(matchId);
      if (!match) return socket.emit("match:error", { code: "not_found", message: "Partida não encontrada." });
      const seat = seatFor(match, user.userId);
      if (!seat) return socket.emit("match:error", { code: "forbidden", message: "Você não é jogador desta partida." });

      // sai da sala anterior (troca de partida na mesma aba)
      if (data.matchId && data.matchId !== matchId && data.seat) {
        void socket.leave(matchRoom(data.matchId));
        void socket.leave(seatRoom(data.matchId, data.seat));
      }
      data.matchId = matchId;
      data.seat = seat;
      void socket.join(matchRoom(matchId));
      void socket.join(seatRoom(matchId, seat));

      try {
        touchPresence(matchId, user.userId);
      } catch {
        // partida sumiu entre o load e o touch — ignora, o snapshot abaixo ainda serve
      }
      // Snapshot imediato — é isto que o cliente recebe ao (re)conectar (docs/39 §3.1).
      socket.emit("match:view_update", {
        view: matchViewFor(match, seat),
        lastActionSeq: deduper.lastApplied(matchId, seat),
      });
      emitOpponentStatus(matchId);
    });

    // ---- match:action { matchId, action, actionSeq } ----
    socket.on("match:action", async (payload: { matchId?: string; action?: PlayerAction; actionSeq?: number } = {}) => {
      const matchId = String(payload?.matchId ?? data.matchId ?? "");
      const action = payload?.action;
      const actionSeq = Number(payload?.actionSeq);
      if (!matchId || !action || typeof action !== "object" || typeof action.kind !== "string") {
        return socket.emit("match:error", { code: "bad_request", message: "Ação inválida." });
      }
      const seat = data.seat ?? (getMatch(matchId) && seatFor(getMatch(matchId)!, user.userId)) ?? undefined;
      if (!seat) return socket.emit("match:error", { code: "forbidden", message: "Entre na partida antes de agir." });

      // Reenvio de rede (mesma ação, mesmo seq): não reexecuta — só devolve o estado atual.
      if (!deduper.shouldApply(matchId, seat, actionSeq)) {
        pushViewUpdate(matchId, seat);
        return;
      }
      try {
        await loadMatch(matchId);
        // marca ANTES: se o motor rejeitar, o cliente mostra o erro e tenta uma AÇÃO nova (novo seq).
        deduper.markApplied(matchId, seat, actionSeq);
        applyAction(matchId, user.userId, action);
        // o broadcast global (`subscribeAllMatches`) já mandou o `match:view_update` pros dois lados.
      } catch (err) {
        socket.emit("match:error", {
          code: err instanceof MatchError ? "illegal_action" : "server_error",
          message: err instanceof Error ? err.message : "Ação inválida.",
        });
      }
    });

    // ---- match:ping { matchId } ---- (heartbeat de presença + RTT via ack)
    socket.on("match:ping", async (payload: { matchId?: string } = {}, ack?: (r: unknown) => void) => {
      const matchId = String(payload?.matchId ?? data.matchId ?? "");
      if (matchId) {
        try {
          await loadMatch(matchId);
          touchPresence(matchId, user.userId);
          emitOpponentStatus(matchId);
        } catch {
          // partida encerrada/sumida — ping vira no-op
        }
      }
      if (typeof ack === "function") ack({ serverNow: Date.now() });
    });

    // ---- queue:join { deckId, mode } ----
    socket.on("queue:join", (payload: { deckId?: string; mode?: "casual" | "ranked" } = {}) => {
      const resolved = deps.resolveDeck(payload?.deckId);
      if (!resolved) return socket.emit("match:error", { code: "bad_deck", message: "Deck inválido para o simulador." });
      const status = joinQueue({
        userId: user.userId,
        displayName: user.displayName,
        deckKey: resolved.key,
        deckList: resolved.build(),
      });
      if (status.matched && status.matchId) {
        // pareou nesta chamada — avisa os dois lados (o outro pode estar noutro socket).
        const match = getMatch(status.matchId);
        for (const seat of ["A", "B"] as PlayerId[]) {
          const uid = match?.seats[seat]?.userId;
          if (uid) emitToUser(uid, "challenge:ready", { matchId: status.matchId });
        }
        return;
      }
      const pos = queuePositionFor(user.userId);
      socket.emit("queue:status", { inQueue: true, position: pos.position, waitTimeSec: pos.waitTimeSec });
    });

    // ---- queue:leave ----
    socket.on("queue:leave", () => {
      leaveQueue(user.userId);
      socket.emit("queue:status", { inQueue: false, position: 0, waitTimeSec: 0 });
    });

    // ---- challenge:create { deckId } -> ack { challengeCode } ----
    socket.on("challenge:create", (payload: { deckId?: string } = {}, ack?: (r: unknown) => void) => {
      const resolved = deps.resolveDeck(payload?.deckId);
      if (!resolved) {
        if (typeof ack === "function") ack({ error: "Deck inválido para o simulador." });
        return;
      }
      const entry = challenges.create({
        hostUserId: user.userId,
        hostDisplayName: user.displayName,
        hostDeckKey: resolved.key,
      });
      data.challengeCode = entry.code;
      if (typeof ack === "function") ack({ challengeCode: entry.code });
      socket.emit("challenge:created", { challengeCode: entry.code });
    });

    // ---- challenge:accept { challengeCode, deckId } -> ack { matchId } ----
    socket.on("challenge:accept", (payload: { challengeCode?: string; deckId?: string } = {}, ack?: (r: unknown) => void) => {
      const guestDeck = deps.resolveDeck(payload?.deckId);
      if (!guestDeck) {
        if (typeof ack === "function") ack({ error: "Deck inválido para o simulador." });
        return;
      }
      let pairing;
      try {
        pairing = challenges.accept({
          code: String(payload?.challengeCode ?? ""),
          guestUserId: user.userId,
          guestDisplayName: user.displayName,
          guestDeckKey: guestDeck.key,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Convite inválido.";
        if (typeof ack === "function") ack({ error: message });
        socket.emit("match:error", { code: "challenge", message });
        return;
      }
      const hostDeck = deps.resolveDeck(pairing.hostDeckKey);
      if (!hostDeck) {
        if (typeof ack === "function") ack({ error: "O deck do anfitrião não é mais válido." });
        return;
      }
      const match = createMatch({
        deckA: hostDeck.build(),
        deckB: guestDeck.build(),
        firstPlayer: Math.random() < 0.5 ? "A" : "B",
      });
      match.deckKeys = { A: pairing.hostDeckKey, B: pairing.guestDeckKey };
      joinMatch(match.id, "A", { userId: pairing.hostUserId, displayName: pairing.hostDisplayName });
      joinMatch(match.id, "B", { userId: pairing.guestUserId, displayName: pairing.guestDisplayName });

      if (typeof ack === "function") ack({ matchId: match.id });
      emitToUser(pairing.hostUserId, "challenge:ready", { matchId: match.id });
      emitToUser(pairing.guestUserId, "challenge:ready", { matchId: match.id });
    });

    socket.on("disconnect", () => {
      const set = socketsByUser.get(user.userId);
      set?.delete(socket);
      const stillOnline = (set?.size ?? 0) > 0;
      if (!stillOnline) {
        socketsByUser.delete(user.userId);
        leaveQueue(user.userId);
        challenges.cancelByHost(user.userId);
      }
      if (data.matchId) emitOpponentStatus(data.matchId);
    });
  });

  return io;
}
