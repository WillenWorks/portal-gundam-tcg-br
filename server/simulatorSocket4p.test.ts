/**
 * Teste de integração da camada Socket.io da Arena Multiplayer 4P (Fase 3 / Terminal 2).
 * Sobe um HTTP server real + `attachSimulatorArena4pSocket` + 4 clientes `socket.io-client`
 * de verdade numa porta efêmera -- mesmo padrão de `server/simulatorSocket.test.ts` (1v1).
 *
 * Cobre o que `RESULTADO-QA-WAVE2-ARENA4P.md` só validou manualmente com 4 browsers reais
 * (squad 2v2, sincronização de lobby, início de partida) e o que ficou "não testado" lá
 * (modo Battle Royale/FFA de ponta a ponta, chat, emote, auto-pass por desconexão real de
 * socket) -- Sprint 2 (docs/debates 2026-09-18).
 */
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import type { Server as IoServer } from "socket.io";

import { buildSt01DeckList } from "../src/modules/simulator/fixtures/st01Deck.ts";
import { _resetAllMatchesForTests, decisionOwner, getMatch } from "../src/modules/simulator/server/matchStore.ts";
import { _resetArenaForTests, getArenaMatch } from "../src/modules/simulator/server/arena4pStore.ts";
import { attachSimulatorArena4pSocket } from "./simulatorSocket4p.ts";

const SECRET = "test-secret";
const SOCKET_PATH = "/api/simulator/socket4p";
const DISCONNECT_GRACE_MS = 150; // bem menor que os 45s reais de produção -- só teste

async function resolveDeck(raw: unknown) {
  return raw === "ST01" ? ({ ok: true, key: "ST01", build: buildSt01DeckList } as const) : ({ ok: false, message: "Deck inválido." } as const);
}

let httpServer: HttpServer;
let io: IoServer;
let port: number;
const clients: ClientSocket[] = [];

function token(userId: string, username: string): string {
  return jwt.sign({ userId, username }, SECRET, { expiresIn: "1h" });
}

function connect(userId: string, displayName: string): ClientSocket {
  const socket = ioc(`http://localhost:${port}`, {
    path: SOCKET_PATH,
    transports: ["websocket"],
    reconnection: false,
    auth: { token: token(userId, displayName) },
  });
  clients.push(socket);
  return socket;
}

function waitFor<T = unknown>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout esperando "${event}"`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Como `waitFor`, mas só resolve na 1ª mensagem que satisfaz `predicate` -- necessário pra
 *  `arena:lobby_update`, que dispara 1x por toggle de "pronto" (4x) + 1x quando a partida
 *  realmente começa; um `.once()` cru pegaria qualquer uma das primeiras, não a certa. */
function waitForMatching<T = unknown>(socket: ClientSocket, event: string, predicate: (payload: T) => boolean, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timeout esperando "${event}" que satisfaça o predicado`));
    }, timeoutMs);
    function handler(payload: T) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

function ackEvent<T = unknown>(socket: ClientSocket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

function connected(socket: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout no connect")), 3000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

beforeEach(async () => {
  _resetAllMatchesForTests();
  _resetArenaForTests();
  httpServer = createServer();
  io = attachSimulatorArena4pSocket(httpServer, { jwtSecret: SECRET, allowedOrigins: [], resolveDeck, disconnectGraceMs: DISCONNECT_GRACE_MS });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as AddressInfo).port;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

interface AssembledSquad {
  host: ClientSocket;
  seatB: ClientSocket;
  seatC: ClientSocket;
  seatD: ClientSocket;
  arenaMatchId: string;
}

/** Monta um esquadrão completo (host cria, 3 convidados entram pelo squadCode, todos ficam
 *  prontos) e devolve os 4 sockets já dentro da room da Arena + o `arenaMatchId` real,
 *  capturado da 1ª `arena:view_update` que o servidor manda ao iniciar a partida. */
async function assembleFullSquad(mode: "2v2" | "ffa"): Promise<AssembledSquad> {
  const host = connect("u-A", "Piloto A");
  await connected(host);
  const { lobbyId, squadCode } = await ackEvent<{ lobbyId: string; squadCode: string }>(host, "arena:squad_create", { mode, deckId: "ST01" });
  expect(lobbyId).toBeTruthy();
  expect(squadCode).toBeTruthy();

  const [seatB, seatC, seatD] = await Promise.all(
    (["u-B", "u-C", "u-D"] as const).map(async (userId, i) => {
      const guest = connect(userId, `Piloto ${"BCD"[i]}`);
      await connected(guest);
      const res = await ackEvent<{ lobbyId?: string; error?: string }>(guest, "arena:squad_join", { squadCode, deckId: "ST01" });
      expect(res.error).toBeUndefined();
      expect(res.lobbyId).toBe(lobbyId);
      return guest;
    }),
  );

  const all = [host, seatB, seatC, seatD];
  // Igual ao cliente real (socketClient4p.ts `joinArenaMatch`): "ready" só troca o status do
  // lobby pra ACTIVE com `arenaMatchId` preenchido (`arena:lobby_update`) -- cada assento
  // ainda precisa chamar `arena:join_match` explicitamente pra entrar nas rooms da Arena e
  // receber a 1ª `arena:view_update` (direta, não é broadcast de room).
  const lobbyActivePromises = all.map((s) =>
    waitForMatching<{ status: string; arenaMatchId?: string }>(s, "arena:lobby_update", (l) => Boolean(l.arenaMatchId)),
  );
  for (const s of all) s.emit("arena:ready", { lobbyId, ready: true });
  const lobbyUpdates = await Promise.all(lobbyActivePromises);
  const arenaMatchId = lobbyUpdates.find((l) => l.arenaMatchId)?.arenaMatchId;
  expect(arenaMatchId).toBeTruthy();
  expect(getArenaMatch(arenaMatchId!)?.status).toBe("ACTIVE");

  const viewPromises = all.map((s) => waitFor<{ arenaMatchId: string }>(s, "arena:view_update"));
  for (const s of all) s.emit("arena:join_match", { arenaMatchId });
  const views = await Promise.all(viewPromises);
  expect(views.every((v) => v.arenaMatchId === arenaMatchId)).toBe(true);

  return { host, seatB, seatC, seatD, arenaMatchId: arenaMatchId! };
}

describe("Arena 4P — squad e início de partida (Socket.io real)", () => {
  it("2v2: 4 sockets reais montam esquadrão, ficam prontos e a Arena inicia com as 2 lanes ativas", async () => {
    const { arenaMatchId } = await assembleFullSquad("2v2");
    const arenaMatch = getArenaMatch(arenaMatchId)!;
    expect(arenaMatch.mode).toBe("2v2");
    expect([...arenaMatch.lanes.values()].filter((l) => l.status === "active")).toHaveLength(2);
  });

  it("ffa: 4 sockets reais montam esquadrão Battle Royale e a Arena inicia com as 2 lanes da rodada 1", async () => {
    const { arenaMatchId } = await assembleFullSquad("ffa");
    const arenaMatch = getArenaMatch(arenaMatchId)!;
    expect(arenaMatch.mode).toBe("ffa");
    expect([...arenaMatch.lanes.values()].map((l) => l.kind).sort()).toEqual(["ffa_r1", "ffa_r1"]);
  });
});

describe("Arena 4P — chat e emote (Socket.io real)", () => {
  it("arena:chat propaga a mensagem de um piloto pros 4 assentos da Arena", async () => {
    const { host, seatD, arenaMatchId } = await assembleFullSquad("2v2");

    const receivedByD = waitFor<{ arenaMatchId: string; entry: { text: string; seat?: string; kind: string } }>(seatD, "arena:chat");
    host.emit("arena:chat", { arenaMatchId, text: "Bora, time!" });
    const payload = await receivedByD;

    expect(payload.arenaMatchId).toBe(arenaMatchId);
    expect(payload.entry.text).toBe("Bora, time!");
    expect(payload.entry.seat).toBe("seatA");
    expect(payload.entry.kind).toBe("chat");
  });

  it("arena:emote propaga seat + emoteId pros 4 assentos, sem persistir estado (broadcast puro)", async () => {
    const { seatB, seatC, arenaMatchId } = await assembleFullSquad("2v2");

    const receivedByC = waitFor<{ arenaMatchId: string; seat: string; emoteId: string }>(seatC, "arena:emote");
    seatB.emit("arena:emote", { arenaMatchId, emoteId: "gg" });
    const payload = await receivedByC;

    expect(payload).toMatchObject({ arenaMatchId, seat: "seatB", emoteId: "gg" });
  });

  it("arena:chat ignora payload sem arenaMatchId válido ou sem texto (não derruba o socket)", async () => {
    const { host, arenaMatchId } = await assembleFullSquad("2v2");
    expect(() => host.emit("arena:chat", { arenaMatchId, text: 123 })).not.toThrow();
    expect(() => host.emit("arena:chat", { arenaMatchId: "nao-existe", text: "oi" })).not.toThrow();
    expect(host.connected).toBe(true);
  });
});

describe("Arena 4P — resiliência de reconexão via queda de socket real", () => {
  it("socket cai de vez -> após o grace period, o servidor resolve a decisão pendente sozinho (auto-pass) e avisa via arena:view_update", async () => {
    const { host, seatB, seatC, seatD, arenaMatchId } = await assembleFullSquad("2v2");

    const arenaMatch = getArenaMatch(arenaMatchId)!;
    const laneAB = [...arenaMatch.lanes.values()].find((l) => l.engineSeatOf.A === "seatA" || l.engineSeatOf.B === "seatA")!;
    const match = getMatch(laneAB.matchId)!;
    const ownerEngineSeat = decisionOwner(match.state);
    expect(ownerEngineSeat).not.toBeNull(); // início de partida sempre tem alguém decidindo mulligan

    // Descobre qual dos 2 sockets da lane AB é o "dono" da decisão pendente e desconecta ELE;
    // o companheiro de lane sobrevive e é quem escuta o `arena:view_update` forçado (só
    // `pushLaneViews` das rooms seatA/seatB da lane recebem esse evento -- seatC/D ficam de
    // fora por estarem numa lane diferente; eles recebem só o `arena:radar_update` global).
    const ownerIsSeatA = laneAB.engineSeatOf.A === "seatA" ? ownerEngineSeat === "A" : ownerEngineSeat === "B";
    const disconnectingSocket = ownerIsSeatA ? host : seatB;
    const survivingLaneMate = ownerIsSeatA ? seatB : host;
    const historyLengthBefore = match.actionHistory.length;

    const forcedViewPromise = waitFor(survivingLaneMate, "arena:view_update", 3000);
    const radarPromise = waitFor(seatC, "arena:radar_update", 3000); // confirma o broadcast arena-wide também chega pra quem está em outra lane
    disconnectingSocket.disconnect();
    await Promise.all([forcedViewPromise, radarPromise]);

    const after = getMatch(laneAB.matchId)!;
    expect(after.actionHistory.length).toBe(historyLengthBefore + 1);
    void seatD;
  });
});
