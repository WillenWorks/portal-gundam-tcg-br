/**
 * Teste de integração da camada Socket.io do simulador (Frente 5 / docs/39).
 * Sobe um HTTP server real + `attachSimulatorSocket` + clientes `socket.io-client`
 * de verdade numa porta efêmera. Cobre o contrato de §2.2 e a resiliência de §3.
 */
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import type { Server as IoServer } from "socket.io";

import { buildSt01DeckList } from "../src/modules/simulator/fixtures/st01Deck.ts";
import { buildSt02DeckList } from "../src/modules/simulator/fixtures/st02Deck.ts";
import {
  _resetAllMatchesForTests,
  createMatch,
  getMatch,
  joinMatch,
  seatFor,
} from "../src/modules/simulator/server/matchStore.ts";
import { attachSimulatorSocket } from "./simulatorSocket.ts";

const SECRET = "test-secret";
const SOCKET_PATH = "/api/simulator/socket";

const DECKS: Record<string, () => ReturnType<typeof buildSt01DeckList>> = {
  ST01: buildSt01DeckList,
  ST02: buildSt02DeckList,
};
function resolveDeck(raw: unknown) {
  const key = typeof raw === "string" ? raw.toUpperCase() : "";
  return DECKS[key] ? { key, build: DECKS[key] } : null;
}

let httpServer: HttpServer;
let io: IoServer;
let port: number;
const clients: ClientSocket[] = [];

function token(userId: string, username: string): string {
  return jwt.sign({ userId, username }, SECRET, { expiresIn: "1h" });
}

function connect(auth: Record<string, string>): ClientSocket {
  const socket = ioc(`http://localhost:${port}`, {
    path: SOCKET_PATH,
    transports: ["websocket"],
    reconnection: false,
    auth,
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
  httpServer = createServer();
  io = attachSimulatorSocket(httpServer, { jwtSecret: SECRET, allowedOrigins: [], resolveDeck });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as AddressInfo).port;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  _resetAllMatchesForTests();
});

describe("handshake", () => {
  it("aceita JWT válido em auth.token", async () => {
    const c = connect({ token: token("u1", "Willen") });
    await expect(connected(c)).resolves.toBeUndefined();
  });

  it("convidado sem token recebe um guestId efêmero assinado", async () => {
    const c = connect({});
    const payload = await waitFor<{ guestId: string; guestToken: string }>(c, "session:guest");
    expect(payload.guestId).toMatch(/^guest:/);
    expect(() => jwt.verify(payload.guestToken, SECRET)).not.toThrow();
  });
});

describe("match:join / match:view_update", () => {
  it("os 2 jogadores na mesma sala recebem visões redigidas DIFERENTES", async () => {
    const match = createMatch({ deckA: buildSt01DeckList(), deckB: buildSt02DeckList(), seed: 1, firstPlayer: "A", skipMulligan: true });
    joinMatch(match.id, "A", { userId: "u1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "u2", displayName: "Amiga" });

    const a = connect({ token: token("u1", "Willen") });
    const b = connect({ token: token("u2", "Amiga") });
    await Promise.all([connected(a), connected(b)]);

    a.emit("match:join", { matchId: match.id });
    b.emit("match:join", { matchId: match.id });
    const [viewA, viewB] = await Promise.all([
      waitFor<{ view: { seat: string; view: { viewer: string; players: Record<string, { hand: unknown[] }> } } }>(a, "match:view_update"),
      waitFor<{ view: { seat: string; view: { viewer: string; players: Record<string, { hand: unknown[] }> } } }>(b, "match:view_update"),
    ]);

    expect(viewA.view.seat).toBe("A");
    expect(viewB.view.seat).toBe("B");
    expect(viewA.view.view.viewer).toBe("A");
    expect(viewB.view.view.viewer).toBe("B");
    // cada lado vê a própria mão aberta e a do oponente oculta
    expect(viewA.view.view.players.B.hand.every((c) => (c as { hidden?: boolean }).hidden === true)).toBe(true);
    expect(viewB.view.view.players.A.hand.every((c) => (c as { hidden?: boolean }).hidden === true)).toBe(true);
  });

  it("recusa quem não é jogador da partida", async () => {
    const match = createMatch({ deckA: buildSt01DeckList(), deckB: buildSt02DeckList(), seed: 1, firstPlayer: "A", skipMulligan: true });
    joinMatch(match.id, "A", { userId: "u1", displayName: "Willen" });

    const c = connect({ token: token("intruso", "Intruso") });
    await connected(c);
    c.emit("match:join", { matchId: match.id });
    const err = await waitFor<{ code: string }>(c, "match:error");
    expect(err.code).toBe("forbidden");
  });

  it("ao reconectar e reemitir match:join, recebe o snapshot atualizado na hora (docs/39 §3.1)", async () => {
    const match = createMatch({ deckA: buildSt01DeckList(), deckB: buildSt02DeckList(), seed: 1, firstPlayer: "A", skipMulligan: true });
    joinMatch(match.id, "A", { userId: "u1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "u2", displayName: "Amiga" });

    let a = connect({ token: token("u1", "Willen") });
    await connected(a);
    a.emit("match:join", { matchId: match.id });
    await waitFor(a, "match:view_update");

    a.disconnect();
    a = connect({ token: token("u1", "Willen") });
    await connected(a);
    a.emit("match:join", { matchId: match.id });
    const snap = await waitFor<{ view: { seat: string } }>(a, "match:view_update");
    expect(snap.view.seat).toBe("A");
  });
});

describe("match:action — idempotência por actionSeq (docs/39 §3.2)", () => {
  it("actionSeq duplicado NÃO reexecuta a ação no motor", async () => {
    const match = createMatch({ deckA: buildSt01DeckList(), deckB: buildSt02DeckList(), seed: 1, firstPlayer: "A", skipMulligan: true });
    joinMatch(match.id, "A", { userId: "u1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "u2", displayName: "Amiga" });

    const a = connect({ token: token("u1", "Willen") });
    await connected(a);
    a.emit("match:join", { matchId: match.id });
    const first = await waitFor<{ view: { version: number } }>(a, "match:view_update");
    const baseVersion = first.view.version;

    a.emit("match:action", { matchId: match.id, action: { kind: "finishTurn" }, actionSeq: 1 });
    const afterAction = await waitFor<{ view: { version: number; view: { phase: string } } }>(a, "match:view_update");
    expect(afterAction.view.version).toBe(baseVersion + 1);
    expect(afterAction.view.view.phase).toBe("end");

    // reenvio de rede: mesma ação, mesmo seq
    a.emit("match:action", { matchId: match.id, action: { kind: "finishTurn" }, actionSeq: 1 });
    const afterDup = await waitFor<{ view: { version: number } }>(a, "match:view_update");
    expect(afterDup.view.version).toBe(baseVersion + 1); // não bumpou de novo
    expect(getMatch(match.id)?.version).toBe(baseVersion + 1);
  });

  it("ação ilegal volta como match:error sem derrubar a conexão", async () => {
    const match = createMatch({ deckA: buildSt01DeckList(), deckB: buildSt02DeckList(), seed: 1, firstPlayer: "A", skipMulligan: true });
    joinMatch(match.id, "A", { userId: "u1", displayName: "Willen" });
    joinMatch(match.id, "B", { userId: "u2", displayName: "Amiga" });

    const b = connect({ token: token("u2", "Amiga") });
    await connected(b);
    b.emit("match:join", { matchId: match.id });
    await waitFor(b, "match:view_update");

    b.emit("match:action", { matchId: match.id, action: { kind: "finishTurn" }, actionSeq: 1 }); // não é a vez de B
    const err = await waitFor<{ code: string; message: string }>(b, "match:error");
    expect(err.code).toBe("illegal_action");
    expect(b.connected).toBe(true);
  });
});

describe("challenge:* — convite direto por link (docs/39 §4)", () => {
  it("o código emparelha os dois e dispara challenge:ready pros dois lados", async () => {
    const host = connect({ token: token("host", "Anfitriao") });
    const guest = connect({ token: token("guest", "Convidada") });
    await Promise.all([connected(host), connected(guest)]);

    const created = await host.emitWithAck("challenge:create", { deckId: "ST01" });
    expect(created).toMatchObject({ challengeCode: expect.stringMatching(/^GC-\d{4}$/) });
    const code = (created as { challengeCode: string }).challengeCode;

    const readyHost = waitFor<{ matchId: string }>(host, "challenge:ready");
    const readyGuest = waitFor<{ matchId: string }>(guest, "challenge:ready");

    const accepted = await guest.emitWithAck("challenge:accept", { challengeCode: code, deckId: "ST02" });
    const matchId = (accepted as { matchId: string }).matchId;
    expect(matchId).toBeTruthy();

    const [rh, rg] = await Promise.all([readyHost, readyGuest]);
    expect(rh.matchId).toBe(matchId);
    expect(rg.matchId).toBe(matchId);

    const match = getMatch(matchId)!;
    expect(seatFor(match, "host")).toBe("A");
    expect(seatFor(match, "guest")).toBe("B");
    expect(match.deckKeys).toEqual({ A: "ST01", B: "ST02" });
  });

  it("código inválido volta erro no ack", async () => {
    const guest = connect({ token: token("guest", "Convidada") });
    await connected(guest);
    const res = await guest.emitWithAck("challenge:accept", { challengeCode: "GC-0000", deckId: "ST01" });
    expect((res as { error?: string }).error).toMatch(/inválido|expirado/i);
  });
});

describe("queue:join via socket", () => {
  it("dois jogadores entram na fila e ambos recebem challenge:ready com o mesmo matchId", async () => {
    const p1 = connect({ token: token("p1", "Um") });
    const p2 = connect({ token: token("p2", "Dois") });
    await Promise.all([connected(p1), connected(p2)]);

    const ready1 = waitFor<{ matchId: string }>(p1, "challenge:ready");
    const ready2 = waitFor<{ matchId: string }>(p2, "challenge:ready");

    p1.emit("queue:join", { deckId: "ST01", mode: "casual" });
    await waitFor(p1, "queue:status");
    p2.emit("queue:join", { deckId: "ST02", mode: "casual" });

    const [r1, r2] = await Promise.all([ready1, ready2]);
    expect(r1.matchId).toBe(r2.matchId);
    expect(getMatch(r1.matchId)).toBeTruthy();
  });
});
