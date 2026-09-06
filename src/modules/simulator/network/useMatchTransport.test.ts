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
    buildSimulatorStreamUrl: vi.fn(() => "http://test.local/api/simulator/matches/m1/stream?token=x"),
    api: {
      ...actual.api,
      sendSimulatorAction: vi.fn(async () => ({ matchId: "m1", version: 9, serverNow: Date.now() })),
      pingSimulatorMatch: vi.fn(async () => ({})),
      getSimulatorMatch: vi.fn(async () => ({ seated: true, matchId: "m1", version: 7, serverNow: Date.now() })),
    },
  };
});

import { api, buildSimulatorStreamUrl } from "@/lib/api";
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

// EventSource não existe no jsdom — stub mínimo que registra instâncias.
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onerror: (() => void) | null = null;
  listeners = new Map<string, (e: MessageEvent) => void>();
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    this.listeners.set(type, cb);
  }
  close = vi.fn();
}

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
  FakeEventSource.instances = [];
  (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
  (buildSimulatorStreamUrl as ReturnType<typeof vi.fn>).mockClear();
  (api.sendSimulatorAction as ReturnType<typeof vi.fn>).mockClear();
  (api.getSimulatorMatch as ReturnType<typeof vi.fn>).mockClear();
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

  it("recebe match:view_update → aplica a view e marca a conexão como live (transporte socket)", () => {
    const { result, applyIncomingView } = setup();
    const view = fakeView(3);
    act(() => socket._emit("match:view_update", { view, lastActionSeq: 0 }));

    expect(applyIncomingView).toHaveBeenCalledWith(view);
    expect(result.current.connState).toBe("live");
    expect(result.current.transport).toBe("socket");
  });

  it("socket dead → cai pro transporte SSE e abre o EventSource do /stream", () => {
    const { result } = setup();
    act(() => socket._emit("status", "dead"));

    expect(result.current.transport).toBe("sse");
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toContain("/simulator/matches/m1/stream");
  });

  it("sem 1º snapshot do socket dentro do timeout → fallback pro SSE", () => {
    vi.useFakeTimers();
    try {
      const { result } = setup();
      expect(result.current.transport).toBe("socket");
      act(() => {
        vi.advanceTimersByTime(6_000);
      });
      expect(result.current.transport).toBe("sse");
    } finally {
      vi.useRealTimers();
    }
  });

  it("sendAction no modo socket usa simulatorSocket.sendAction e resolve quando o eco chega", async () => {
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

  it("sendAction no modo SSE cai no POST REST e aplica a resposta", async () => {
    const { result, applyIncomingView } = setup();
    act(() => socket._emit("status", "dead"));
    expect(result.current.transport).toBe("sse");

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
