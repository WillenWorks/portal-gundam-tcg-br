/**
 * Camada Socket.io da Arena Multiplayer 4P (Fase 3 / Terminal 2).
 *
 * Roda AO LADO de `simulatorSocket.ts` (1v1) no MESMO HTTP server, num `path`
 * dedicado — não compartilha rooms nem estado com o socket 1v1. Toda a regra
 * de bracket/lobby mora em `src/modules/simulator/server/arena4pStore.ts`
 * (pura, sem Node); este arquivo só faz handshake JWT/guest (mesmo contrato
 * do 1v1) e liga os eventos de rede às funções exportadas de lá. As "lanes"
 * da Arena são `MatchRecord`s NORMAIS do `matchStore.ts` — o motor de regras
 * em `src/modules/simulator/engine/` nunca é tocado nem sabe que a Arena
 * existe.
 */
import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server, type Socket } from "socket.io";

import type { DeckList } from "../src/modules/simulator/engine/setup.ts";
import type { PlayerAction } from "../src/modules/simulator/engine/actions.ts";
import {
  addArenaChatMessage,
  ARENA_SEAT_IDS,
  activeLaneForSeat,
  createLobby,
  createSquadInvite,
  getArenaMatch,
  getLobby,
  joinArenaQueue,
  joinLobby,
  leaveArenaQueue,
  leaveLobby,
  lobbyAllReady,
  lobbyIsFull,
  matchViewForArenaSeat,
  notifyMatchMaybeArenaLane,
  radarSnapshotFor,
  resolveSquadCode,
  seatForUserInLobby,
  setReady,
  startArenaMatch,
  subscribeArena,
  type ArenaLane,
  type ArenaMatchRecord,
  type ArenaMode,
  type ArenaSeatId,
} from "../src/modules/simulator/server/arena4pStore.ts";
import { applyAction, subscribeAllMatches, touchPresence } from "../src/modules/simulator/server/matchStore.ts";
import { ActionDeduper } from "../src/modules/simulator/server/socketBridge.ts";
import type { SimulatorDeckResolution } from "./simulatorSocket.ts";

const SOCKET_PATH = "/api/simulator/socket4p";
const GUEST_TOKEN_TTL = "12h";

export interface SimulatorArenaSocketDeps {
  jwtSecret: string;
  allowedOrigins: string[];
  resolveDeck: (raw: unknown, userId: string) => Promise<SimulatorDeckResolution>;
}

interface SocketUser {
  userId: string;
  displayName: string;
  guest: boolean;
}

type SocketData = {
  user: SocketUser;
  freshGuestToken?: string;
};

function lobbyRoom(lobbyId: string): string {
  return `arena:lobby:${lobbyId}`;
}
function arenaRoom(arenaMatchId: string): string {
  return `arena:match:${arenaMatchId}`;
}
function arenaSeatRoom(arenaMatchId: string, seat: ArenaSeatId): string {
  return `arena:match:${arenaMatchId}:${seat}`;
}

function seatForUserInArenaMatch(arenaMatch: ArenaMatchRecord, userId: string): ArenaSeatId | undefined {
  return ARENA_SEAT_IDS.find((seat) => arenaMatch.seats[seat]?.userId === userId);
}

export function attachSimulatorArena4pSocket(httpServer: HttpServer, deps: SimulatorArenaSocketDeps): Server {
  const io = new Server(httpServer, {
    path: SOCKET_PATH,
    serveClient: false,
    cors: deps.allowedOrigins.length ? { origin: deps.allowedOrigins } : { origin: true },
  });

  const deduper = new ActionDeduper();
  /** userId → sockets vivos daquele usuário — usado pra juntar os 4 assentos nas rooms da Arena quando ela começa. */
  const socketsByUser = new Map<string, Set<Socket>>();

  function joinArenaRooms(arenaMatch: ArenaMatchRecord): void {
    for (const seat of ARENA_SEAT_IDS) {
      const occupant = arenaMatch.seats[seat];
      if (!occupant) continue;
      for (const socket of socketsByUser.get(occupant.userId) ?? []) {
        void socket.join(arenaRoom(arenaMatch.id));
        void socket.join(arenaSeatRoom(arenaMatch.id, seat));
      }
    }
  }

  function pushLaneViews(arenaMatch: ArenaMatchRecord, lane: ArenaLane): void {
    for (const seat of [lane.engineSeatOf.A, lane.engineSeatOf.B]) {
      const resolved = matchViewForArenaSeat(arenaMatch, seat);
      if (!resolved) continue;
      io.to(arenaSeatRoom(arenaMatch.id, seat)).emit("arena:view_update", { arenaMatchId: arenaMatch.id, seat, ...resolved });
    }
  }

  function pushRadar(arenaMatchId: string): void {
    const arenaMatch = getArenaMatch(arenaMatchId);
    if (!arenaMatch) return;
    io.to(arenaRoom(arenaMatchId)).emit("arena:radar_update", { arenaMatchId, radar: radarSnapshotFor(arenaMatch) });
  }

  // --- Bracket global: qualquer partida do motor que terminar passa por aqui; vira lane só se pertencer a uma Arena. ---
  subscribeAllMatches((matchId) => {
    notifyMatchMaybeArenaLane(matchId);
  });

  // --- Fan-out dos eventos da Arena (arena4pStore) pras rooms Socket.io. ---
  subscribeArena((event) => {
    switch (event.type) {
      case "lobby_update":
        io.to(lobbyRoom(event.lobby.id)).emit("arena:lobby_update", event.lobby);
        break;
      case "lobby_closed":
        io.to(lobbyRoom(event.lobbyId)).emit("arena:lobby_closed", { lobbyId: event.lobbyId });
        break;
      case "match_start": {
        for (const lane of event.arenaMatch.lanes.values()) {
          if (lane.status === "active") pushLaneViews(event.arenaMatch, lane);
        }
        pushRadar(event.arenaMatch.id);
        break;
      }
      case "radar_update":
        io.to(arenaRoom(event.arenaMatchId)).emit("arena:radar_update", { arenaMatchId: event.arenaMatchId, radar: event.radar });
        break;
      case "lane_result":
        io.to(arenaRoom(event.arenaMatchId)).emit("arena:lane_result", { arenaMatchId: event.arenaMatchId, lane: event.lane });
        pushRadar(event.arenaMatchId);
        break;
      case "arena_over":
        io.to(arenaRoom(event.arenaMatchId)).emit("arena:arena_over", { arenaMatchId: event.arenaMatchId, winner: event.winner });
        break;
      case "chat":
        io.to(arenaRoom(event.arenaMatchId)).emit("arena:chat", { arenaMatchId: event.arenaMatchId, entry: event.entry });
        break;
    }
  });

  // --- Handshake: mesmo contrato JWT/guest do socket 1v1 (`simulatorSocket.ts`). ---
  io.use((socket, next) => {
    const auth = (socket.handshake.auth ?? {}) as { token?: string; guestToken?: string };
    const data = socket.data as SocketData;

    if (auth.token) {
      try {
        const payload = jwt.verify(auth.token, deps.jwtSecret) as { userId: string; username?: string; email?: string };
        data.user = { userId: payload.userId, displayName: payload.username || payload.email || "Jogador", guest: false };
        return next();
      } catch {
        // token expirado/inválido → cai pro fluxo de convidado abaixo
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

    if (data.freshGuestToken) {
      socket.emit("session:guest", { guestId: user.userId, guestToken: data.freshGuestToken });
    }

    async function tryStartIfReady(lobbyId: string): Promise<void> {
      const lobby = getLobby(lobbyId);
      if (!lobby || !lobbyIsFull(lobby) || !lobbyAllReady(lobby)) return;
      const deckEntries = await Promise.all(
        ARENA_SEAT_IDS.map(async (seat) => {
          const occupant = lobby.seats[seat]!;
          const resolved = await deps.resolveDeck(occupant.deckKey, occupant.userId);
          return [seat, resolved] as const;
        }),
      );
      const failed = deckEntries.find(([, resolved]) => !resolved.ok);
      if (failed) {
        const [seat, resolved] = failed;
        for (const s of socketsByUser.get(lobby.seats[seat]!.userId) ?? []) {
          s.emit("arena:error", { code: "bad_deck", message: (resolved as { ok: false; message: string }).message });
        }
        return;
      }
      const decks = Object.fromEntries(
        deckEntries.map(([seat, resolved]) => [seat, (resolved as { ok: true; build: () => DeckList }).build()]),
      ) as Record<ArenaSeatId, DeckList>;
      const arenaMatch = startArenaMatch(lobby, decks);
      joinArenaRooms(arenaMatch);
    }

    // ---- arena:lobby_join { lobbyId } ---- (entra na room pra receber lobby_update)
    socket.on("arena:lobby_join", (payload: { lobbyId?: string } = {}) => {
      const lobbyId = String(payload?.lobbyId ?? "");
      const lobby = getLobby(lobbyId);
      if (!lobby) return socket.emit("arena:error", { code: "not_found", message: "Sala não encontrada." });
      void socket.join(lobbyRoom(lobbyId));
      socket.emit("arena:lobby_update", lobby);
    });

    // ---- arena:squad_create { mode, deckId } -> ack { lobbyId, squadCode } ----
    socket.on("arena:squad_create", async (payload: { mode?: ArenaMode; deckId?: string } = {}, ack?: (r: unknown) => void) => {
      const mode: ArenaMode = payload?.mode === "ffa" ? "ffa" : "2v2";
      const resolved = await deps.resolveDeck(payload?.deckId, user.userId);
      if (!resolved.ok) {
        if (typeof ack === "function") ack({ error: resolved.message });
        return;
      }
      const lobby = createLobby(mode, { userId: user.userId, displayName: user.displayName, deckKey: resolved.key });
      const squadCode = createSquadInvite(lobby.id);
      void socket.join(lobbyRoom(lobby.id));
      if (typeof ack === "function") ack({ lobbyId: lobby.id, squadCode });
    });

    // ---- arena:squad_join { squadCode, deckId } -> ack { lobbyId } ----
    socket.on("arena:squad_join", async (payload: { squadCode?: string; deckId?: string } = {}, ack?: (r: unknown) => void) => {
      const resolved = await deps.resolveDeck(payload?.deckId, user.userId);
      if (!resolved.ok) {
        if (typeof ack === "function") ack({ error: resolved.message });
        return;
      }
      let lobby;
      try {
        lobby = resolveSquadCode(String(payload?.squadCode ?? ""));
        lobby = joinLobby(lobby.id, { userId: user.userId, displayName: user.displayName, deckKey: resolved.key });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Convite inválido.";
        if (typeof ack === "function") ack({ error: message });
        return;
      }
      void socket.join(lobbyRoom(lobby.id));
      if (typeof ack === "function") ack({ lobbyId: lobby.id });
    });

    // ---- queue:arena_join { mode, deckId } ----
    socket.on("arena:queue_join", async (payload: { mode?: ArenaMode; deckId?: string } = {}) => {
      const mode: ArenaMode = payload?.mode === "ffa" ? "ffa" : "2v2";
      const resolved = await deps.resolveDeck(payload?.deckId, user.userId);
      if (!resolved.ok) return socket.emit("arena:error", { code: "bad_deck", message: resolved.message });
      const result = joinArenaQueue({ userId: user.userId, displayName: user.displayName, deckKey: resolved.key, mode });
      if (result.matched && result.lobby) {
        for (const seat of ARENA_SEAT_IDS) {
          const occupant = result.lobby.seats[seat];
          if (!occupant) continue;
          for (const s of socketsByUser.get(occupant.userId) ?? []) void s.join(lobbyRoom(result.lobby.id));
        }
        socket.emit("arena:queue_status", { inQueue: false, position: 0 });
        await tryStartIfReady(result.lobby.id);
        return;
      }
      socket.emit("arena:queue_status", { inQueue: true, position: result.position ?? 0 });
    });

    socket.on("arena:queue_leave", (payload: { mode?: ArenaMode } = {}) => {
      leaveArenaQueue(user.userId);
      socket.emit("arena:queue_status", { inQueue: false, position: 0 });
      void payload;
    });

    // ---- arena:ready { lobbyId, ready } ----
    socket.on("arena:ready", async (payload: { lobbyId?: string; ready?: boolean } = {}) => {
      const lobbyId = String(payload?.lobbyId ?? "");
      try {
        setReady(lobbyId, user.userId, Boolean(payload?.ready));
      } catch (err) {
        return socket.emit("arena:error", { code: "lobby", message: err instanceof Error ? err.message : "Sala inválida." });
      }
      await tryStartIfReady(lobbyId);
    });

    // ---- arena:leave_lobby { lobbyId } ----
    socket.on("arena:leave_lobby", (payload: { lobbyId?: string } = {}) => {
      const lobbyId = String(payload?.lobbyId ?? "");
      leaveLobby(lobbyId, user.userId);
      void socket.leave(lobbyRoom(lobbyId));
    });

    // ---- arena:join_match { arenaMatchId } ---- (snapshot ao entrar/reconectar)
    socket.on("arena:join_match", (payload: { arenaMatchId?: string } = {}) => {
      const arenaMatchId = String(payload?.arenaMatchId ?? "");
      const arenaMatch = getArenaMatch(arenaMatchId);
      if (!arenaMatch) return socket.emit("arena:error", { code: "not_found", message: "Partida da Arena não encontrada." });
      const seat = seatForUserInArenaMatch(arenaMatch, user.userId);
      if (!seat) return socket.emit("arena:error", { code: "forbidden", message: "Você não é piloto desta Arena." });

      void socket.join(arenaRoom(arenaMatchId));
      void socket.join(arenaSeatRoom(arenaMatchId, seat));

      const resolved = matchViewForArenaSeat(arenaMatch, seat);
      if (resolved) socket.emit("arena:view_update", { arenaMatchId, seat, ...resolved });
      socket.emit("arena:radar_update", { arenaMatchId, radar: radarSnapshotFor(arenaMatch) });
      socket.emit("arena:chat_backlog", { arenaMatchId, entries: arenaMatch.chat });
      if (arenaMatch.status === "FINISHED" && arenaMatch.winner) {
        socket.emit("arena:arena_over", { arenaMatchId, winner: arenaMatch.winner });
      }
    });

    // ---- arena:action { arenaMatchId, action, actionSeq } ----
    socket.on("arena:action", (payload: { arenaMatchId?: string; action?: PlayerAction; actionSeq?: number } = {}) => {
      const arenaMatchId = String(payload?.arenaMatchId ?? "");
      const action = payload?.action;
      const actionSeq = Number(payload?.actionSeq);
      if (!arenaMatchId || !action || typeof action !== "object" || typeof action.kind !== "string") {
        return socket.emit("arena:error", { code: "bad_request", message: "Ação inválida." });
      }
      const arenaMatch = getArenaMatch(arenaMatchId);
      if (!arenaMatch) return socket.emit("arena:error", { code: "not_found", message: "Partida da Arena não encontrada." });
      const seat = seatForUserInArenaMatch(arenaMatch, user.userId);
      if (!seat) return socket.emit("arena:error", { code: "forbidden", message: "Você não é piloto desta Arena." });
      const lane = activeLaneForSeat(arenaMatch, seat);
      if (!lane) return socket.emit("arena:error", { code: "spectating", message: "Seu duelo ainda não começou ou já terminou — aguarde a próxima lane." });

      if (!deduper.shouldApply(lane.matchId, seat, actionSeq)) {
        const resolved = matchViewForArenaSeat(arenaMatch, seat);
        if (resolved) socket.emit("arena:view_update", { arenaMatchId, seat, ...resolved });
        return;
      }
      try {
        deduper.markApplied(lane.matchId, seat, actionSeq);
        applyAction(lane.matchId, user.userId, action);
        // Broadcast pra sala/adversário vem do listener global `subscribeAllMatches` (que aciona
        // `notifyMatchMaybeArenaLane`) — mas o VIEW do próprio autor sai daqui, imediato, sem
        // depender de round-trip pelo bracket.
        pushLaneViews(arenaMatch, lane);
      } catch (err) {
        socket.emit("arena:error", { code: "illegal_action", message: err instanceof Error ? err.message : "Ação inválida." });
      }
    });

    // ---- arena:ping { arenaMatchId } ----
    socket.on("arena:ping", (payload: { arenaMatchId?: string } = {}, ack?: (r: unknown) => void) => {
      const arenaMatchId = String(payload?.arenaMatchId ?? "");
      const arenaMatch = getArenaMatch(arenaMatchId);
      const seat = arenaMatch ? seatForUserInArenaMatch(arenaMatch, user.userId) : undefined;
      const lane = arenaMatch && seat ? activeLaneForSeat(arenaMatch, seat) : undefined;
      if (lane) {
        try {
          touchPresence(lane.matchId, user.userId);
        } catch {
          // lane sumiu entre o snapshot e o touch — ping vira no-op
        }
      }
      if (typeof ack === "function") ack({ serverNow: Date.now() });
    });

    // ---- arena:chat { arenaMatchId, text } ----
    socket.on("arena:chat", (payload: { arenaMatchId?: string; text?: string } = {}) => {
      const arenaMatch = getArenaMatch(String(payload?.arenaMatchId ?? ""));
      if (!arenaMatch) return;
      const seat = seatForUserInArenaMatch(arenaMatch, user.userId);
      if (!seat || typeof payload?.text !== "string") return;
      addArenaChatMessage(arenaMatch, seat, payload.text);
    });

    // ---- arena:emote { arenaMatchId, emoteId } ---- (puro broadcast, sem estado)
    socket.on("arena:emote", (payload: { arenaMatchId?: string; emoteId?: string } = {}) => {
      const arenaMatch = getArenaMatch(String(payload?.arenaMatchId ?? ""));
      if (!arenaMatch) return;
      const seat = seatForUserInArenaMatch(arenaMatch, user.userId);
      if (!seat || typeof payload?.emoteId !== "string") return;
      io.to(arenaRoom(arenaMatch.id)).emit("arena:emote", { arenaMatchId: arenaMatch.id, seat, emoteId: payload.emoteId, at: Date.now() });
    });

    socket.on("disconnect", () => {
      const set = socketsByUser.get(user.userId);
      set?.delete(socket);
      if ((set?.size ?? 0) > 0) return;
      socketsByUser.delete(user.userId);
      leaveArenaQueue(user.userId);
      // Assento em sala AINDA NÃO iniciada fica travado sem outra forma de liberar — libera aqui.
      // Partidas ATIVAS não são afetadas (cada lane é uma `MatchRecord` normal com seu próprio W.O./timer).
      for (const lobbyId of activeLobbyIdsFor(user.userId)) leaveLobby(lobbyId, user.userId);
    });

    function activeLobbyIdsFor(userId: string): string[] {
      // Sem índice userId→lobby dedicado (escala baixa, v1) — varre só as rooms que este socket ocupava.
      const ids: string[] = [];
      for (const room of socket.rooms) {
        const match = /^arena:lobby:(.+)$/.exec(room);
        if (match) {
          const lobby = getLobby(match[1]);
          if (lobby && lobby.status === "LOBBY" && seatForUserInLobby(lobby, userId)) ids.push(lobby.id);
        }
      }
      return ids;
    }
  });

  return io;
}
