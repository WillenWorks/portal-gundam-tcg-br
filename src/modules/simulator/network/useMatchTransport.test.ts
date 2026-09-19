// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

// --- mock do singleton de socket: registro de listeners + emissor manual ------
vi.mock("@/modules/simulator/network/socketClient", () => {
  const listeners = new Map<string, Set<(p: unknown) => void>>();
  const socket = {
    _listeners: listeners,
    _status: "connecting" as string,
    _seq: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
    joinMatch: vi.fn(),
    sendAction: vi.fn(() => (socket._seq += 1)),
    ping: vi.fn(),
    getStatus: vi.fn(() => socket._status),
    getLastPingMs: vi.fn(() => null),
    on: vi.fn((event: string, cb: (p: unknown) => void) => {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(cb);
      return () => set!.delete(cb);
    }),
    _emit(event: string, payload?: unknown) {
      for (const cb of [...(listeners.get(event) ?? [])]) cb(payload);
    },
    _reset() {
      listeners.clear();
      socket._status = "connecting";
      socket._seq = 0;
    },
  };
  return { simulatorSocket: socket };
});

// --- mock do client REST (só os métodos que o hook toca) ---------------------
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      sendSimulatorAction: vi.fn(async () => ({ matchId: "m1", version: 9, serverNow: Date.now() })),
      pingSimulatorMatch: vi.fn(async () => ({})),
    },
  };
});

import { api } from "@/lib/api";
import { simulatorSocket } from "@/modules/simulator/network/socketClient";
import { useMatchTransport } from "@/modules/simulator/network/useMatchTransport";

const socket = simulatorSocket as unknown as {
  _status: string;
  _seq: number;
  connect: ReturnType<typeof vi.fn>;
  joinMatch: ReturnType<typeof vi.fn>;
  sendAction: ReturnType<typeof vi.fn>;
  getStatus: ReturnType<typeof vi.fn>;
  _emit: (event: string, payload?: unknown) => void;
  _reset: () => void;
};

function fakeView(version: number) {
  return { matchId: "m1", version, serverNow: Date.now(), view: {}, seat: "A" } as never;
}

function setup() {
  const applyIncomingView = vi.fn();
  const onExpired = vi.fn();
  const onMatchError = vi.fn();
  const hook = renderHook(() =>
    useMatchTransport({ matchId: "m1", applyIncomingView, onExpired, onMatchError }),
  );
  return { ...hook, applyIncomingView, onExpired, onMatchError };
}

beforeEach(() => {
  socket._reset();
  (api.sendSimulatorAction as ReturnType<typeof vi.fn>).mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useMatchTransport", () => {
  it("no mount conecta o socket e entra na sala da partida", () => {
    setup();
    expect(socket.connect).toHaveBeenCalledTimes(1);
    expect(socket.joinMatch).toHaveBeenCalledWith("m1");
  });

  it("recebe match:view_update → aplica a view e marca a conexão como live", () => {
    const { result, applyIncomingView } = setup();
    const view = fakeView(3);
    act(() => socket._emit("match:view_update", { view, lastActionSeq: 0 }));

    expect(applyIncomingView).toHaveBeenCalledWith(view);
    expect(result.current.connState).toBe("live");
    expect(result.current.transport).toBe("socket");
  });

  it("status reconnecting → connState reconnecting e conta as tentativas", () => {
    const { result } = setup();
    act(() => socket._emit("status", "reconnecting"));
    expect(result.current.connState).toBe("reconnecting");
    expect(result.current.reconnectAttempt).toBe(1);
    act(() => socket._emit("status", "reconnecting"));
    expect(result.current.reconnectAttempt).toBe(2);
  });

  it("socket dead (servidor recusou o handshake) → connState dead e chama onExpired, sem nenhum fallback", () => {
    const { result, onExpired } = setup();
    act(() => socket._emit("status", "dead"));

    expect(result.current.connState).toBe("dead");
    expect(result.current.deadReason).toBeTruthy();
    expect(result.current.transport).toBe("socket");
    expect(onExpired).toHaveBeenCalledWith(expect.objectContaining({ toLobby: false }));
  });

  it("sendAction usa simulatorSocket.sendAction e resolve quando o eco chega", async () => {
    socket._status = "connected";
    const { result } = setup();
    act(() => socket._emit("match:view_update", { view: fakeView(1), lastActionSeq: 0 }));

    let pending: Promise<void>;
    act(() => {
      pending = result.current.sendAction({ kind: "finishTurn" } as never);
    });
    expect(socket.sendAction).toHaveBeenCalledWith("m1", { kind: "finishTurn" });
    expect(api.sendSimulatorAction).not.toHaveBeenCalled();

    act(() => socket._emit("match:view_update", { view: fakeView(2), lastActionSeq: socket._seq }));
    await expect(pending!).resolves.toBeUndefined();
  });

  it("sendAction com o socket desconectado cai no POST REST e aplica a resposta", async () => {
    const { result, applyIncomingView } = setup();
    expect(socket._status).not.toBe("connected");

    await act(async () => {
      await result.current.sendAction({ kind: "finishTurn" } as never);
    });
    expect(api.sendSimulatorAction).toHaveBeenCalledWith("m1", { kind: "finishTurn" });
    expect(applyIncomingView).toHaveBeenCalledWith(expect.objectContaining({ matchId: "m1", version: 9 }));
  });

  it("match:error sem ação em voo é repassado pro callback", () => {
    const { onMatchError } = setup();
    act(() => socket._emit("match:error", { code: "forbidden", message: "Você não é jogador desta partida." }));
    expect(onMatchError).toHaveBeenCalledWith("Você não é jogador desta partida.");
  });
});
