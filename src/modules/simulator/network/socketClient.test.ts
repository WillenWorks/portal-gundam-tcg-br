import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (...args: unknown[]) => void;

class FakeSocket {
  handlers = new Map<string, Handler>();
  managerHandlers = new Map<string, Handler>();
  connectCalls = 0;
  active = true;
  io = { on: (event: string, h: Handler) => this.managerHandlers.set(event, h) };
  on(event: string, h: Handler) {
    this.handlers.set(event, h);
    return this;
  }
  emit() {}
  connect() {
    this.connectCalls += 1;
  }
  disconnect() {}
  fire(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.(...args);
  }
}

let lastSocket: FakeSocket;
vi.mock("socket.io-client", () => ({
  io: () => {
    lastSocket = new FakeSocket();
    return lastSocket;
  },
}));
vi.mock("@/lib/api", () => ({ API_BASE_URL: "http://localhost", getStoredAuth: () => ({ token: null }) }));

describe("simulatorSocket — queda iniciada pelo servidor", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("'io server disconnect' não re-tenta sozinho no socket.io: o cliente reconecta com backoff", async () => {
    const { simulatorSocket } = await import("./socketClient");
    simulatorSocket.connect();
    const socket = lastSocket;
    socket.fire("disconnect", "io server disconnect");
    expect(simulatorSocket.getStatus()).toBe("reconnecting");
    expect(socket.connectCalls).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(socket.connectCalls).toBe(1);
    simulatorSocket.disconnect();
  });

  it("queda por transporte (o socket.io já re-tenta) não chama connect de novo", async () => {
    const { simulatorSocket } = await import("./socketClient");
    simulatorSocket.connect();
    const socket = lastSocket;
    socket.fire("disconnect", "transport close");
    vi.advanceTimersByTime(1000);
    expect(socket.connectCalls).toBe(0);
    simulatorSocket.disconnect();
  });

  it("desconectar de propósito cancela a reconexão agendada", async () => {
    const { simulatorSocket } = await import("./socketClient");
    simulatorSocket.connect();
    const socket = lastSocket;
    socket.fire("disconnect", "io server disconnect");
    simulatorSocket.disconnect();
    vi.advanceTimersByTime(1000);
    expect(socket.connectCalls).toBe(0);
  });
});
