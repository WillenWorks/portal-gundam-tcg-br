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

describe("createSocketAuthMiddleware", () => {
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
