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
import type { Server as HttpServer } from "node:http";
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
import { createSocketAuthMiddleware, UserSocketRegistry, type SocketAuthUser } from "./services/socketAuth.ts";

const SOCKET_PATH = "/api/simulator/socket";
const LOBBY_ROOM = "lobby:global";

export type SimulatorDeckResolution = { ok: true; key: string; build: () => DeckList } | { ok: false; message: string };

export interface SimulatorSocketDeps {
  jwtSecret: string;
  allowedOrigins: string[];
  /**
   * Mesma função `resolveOnlineSimulatorDeck` do `server/index.ts` — aceita
   * tanto um preset (ST01/GD01-FED/…) quanto o id de um deck salvo do
   * PRÓPRIO `userId` chamador (docs/debates 2026-09-14 — "permita que o
   * usuário use o seu próprio deck" em todas as modalidades, inclusive Fila
   * Online e Convite Direto). Sempre async porque o caminho de deck próprio
   * precisa consultar o banco; sempre valida cobertura antes de aprovar.
   */
  resolveDeck: (raw: unknown, userId: string) => Promise<SimulatorDeckResolution>;
}

type SocketData = {
  user: SocketAuthUser;
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
  const socketsByUser = new UserSocketRegistry<Socket>();

  function emitToUser(userId: string, event: string, payload: unknown): void {
    for (const socket of socketsByUser.getSockets(userId)) socket.emit(event, payload);
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
      const online = oppUserId ? socketsByUser.countFor(oppUserId) > 0 : false;
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

  // --- Handshake: valida o JWT ou emite um guestId efêmero assinado (lógica compartilhada com a Arena 4P — `services/socketAuth.ts`). ---
  io.use(createSocketAuthMiddleware({ jwtSecret: deps.jwtSecret }));

  io.on("connection", (socket) => {
    const data = socket.data as SocketData;
    const user = data.user;

    socketsByUser.addSocket(user.userId, socket);

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
    socket.on("queue:join", async (payload: { deckId?: string; mode?: "casual" | "ranked" } = {}) => {
      const resolved = await deps.resolveDeck(payload?.deckId, user.userId);
      if (!resolved.ok) return socket.emit("match:error", { code: "bad_deck", message: resolved.message });
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
    socket.on("challenge:create", async (payload: { deckId?: string } = {}, ack?: (r: unknown) => void) => {
      const resolved = await deps.resolveDeck(payload?.deckId, user.userId);
      if (!resolved.ok) {
        if (typeof ack === "function") ack({ error: resolved.message });
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
    socket.on("challenge:accept", async (payload: { challengeCode?: string; deckId?: string } = {}, ack?: (r: unknown) => void) => {
      const guestDeck = await deps.resolveDeck(payload?.deckId, user.userId);
      if (!guestDeck.ok) {
        if (typeof ack === "function") ack({ error: guestDeck.message });
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
      // Resolve o deck do anfitrião de novo (com o `userId` DELE, não do convidado) —
      // `hostDeckKey` pode ser o id de um deck próprio, cuja posse é checada por userId.
      const hostDeck = await deps.resolveDeck(pairing.hostDeckKey, pairing.hostUserId);
      if (!hostDeck.ok) {
        if (typeof ack === "function") ack({ error: `O deck do anfitrião não é mais válido: ${hostDeck.message}` });
        return;
      }
      const match = createMatch({
        deckA: hostDeck.build(),
        deckB: guestDeck.build(),
        firstPlayer: Math.random() < 0.5 ? "A" : "B",
      });
      match.deckKeys = { A: hostDeck.key, B: guestDeck.key };
      joinMatch(match.id, "A", { userId: pairing.hostUserId, displayName: pairing.hostDisplayName });
      joinMatch(match.id, "B", { userId: pairing.guestUserId, displayName: pairing.guestDisplayName });

      if (typeof ack === "function") ack({ matchId: match.id });
      emitToUser(pairing.hostUserId, "challenge:ready", { matchId: match.id });
      emitToUser(pairing.guestUserId, "challenge:ready", { matchId: match.id });
    });

    socket.on("disconnect", () => {
      const wentOffline = socketsByUser.removeSocket(user.userId, socket);
      if (wentOffline) {
        leaveQueue(user.userId);
        challenges.cancelByHost(user.userId);
      }
      if (data.matchId) emitOpponentStatus(data.matchId);
    });
  });

  return io;
}
