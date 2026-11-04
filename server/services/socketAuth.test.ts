import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import type { Socket } from "socket.io";
import { createSocketAuthMiddleware, type SocketAuthData } from "./socketAuth.ts";

const SECRET = "segredo-de-teste";

function connect(auth: { token?: string; guestToken?: string }) {
  const socket = { handshake: { auth }, data: {} } as unknown as Socket;
  createSocketAuthMiddleware({ jwtSecret: SECRET })(socket, () => undefined);
  return socket.data as SocketAuthData;
}

async function connectWithSession(token: string, resolveSession: (p: { userId: string }) => Promise<unknown>) {
  const socket = { handshake: { auth: { token } }, data: {} } as unknown as Socket;
  await new Promise<void>((done) => createSocketAuthMiddleware({ jwtSecret: SECRET, resolveSession })(socket, () => done()));
  return socket.data as SocketAuthData;
}

describe("createSocketAuthMiddleware", () => {
  it("conta ativa segue como a conta", async () => {
    const data = await connectWithSession(jwt.sign({ userId: "u1", username: "piloto" }, SECRET), async (p) => p);
    expect(data.user).toEqual({ userId: "u1", displayName: "piloto", guest: false });
  });

  it.each(["inactive", "revoked"])("sessão %s entra como convidado", async (verdict) => {
    const data = await connectWithSession(jwt.sign({ userId: "u1" }, SECRET), async () => verdict);
    expect(data.user.guest).toBe(true);
    expect(data.user.userId).toMatch(/^guest:/);
    expect(data.freshGuestToken).toBeTruthy();
  });

  it("erro ao conferir a sessão não libera a conta", async () => {
    const data = await connectWithSession(jwt.sign({ userId: "u1" }, SECRET), async () => { throw new Error("falha"); });
    expect(data.user.guest).toBe(true);
  });

  it("token de conta entra como a conta", () => {
    const data = connect({ token: jwt.sign({ userId: "u1", username: "piloto" }, SECRET) });
    expect(data.user).toEqual({ userId: "u1", displayName: "piloto", guest: false });
  });

  it("token de convidado no campo `token` não vira conta sem id", () => {
    const data = connect({ token: jwt.sign({ guestId: "guest:abc", guest: true }, SECRET) });
    expect(data.user.guest).toBe(true);
    expect(data.user.userId).toMatch(/^guest:/);
  });

  it("guestToken válido mantém o convidado", () => {
    const data = connect({ guestToken: jwt.sign({ guestId: "guest:abc", guest: true }, SECRET) });
    expect(data.user).toEqual({ userId: "guest:abc", displayName: "Convidado", guest: true });
  });
});
