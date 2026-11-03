import { describe, expect, it } from "vitest";
import { attachSocketEventLimiter, SOCKET_COSTLY_EVENT_LIMIT, SOCKET_EVENT_LIMIT } from "./socketRateLimit.ts";

type Middleware = (packet: unknown[], next: () => void) => void;

function setup() {
  let time = 1_000;
  let middleware: Middleware = () => undefined;
  attachSocketEventLimiter({ use: (fn: Middleware) => { middleware = fn; } } as never, () => time);
  const send = (event: string, ...args: unknown[]) => {
    let passed = false;
    middleware([event, ...args], () => { passed = true; });
    return passed;
  };
  return { send, advance: (ms: number) => { time += ms; } };
}

describe("attachSocketEventLimiter", () => {
  it("deixa passar até o teto e barra depois", () => {
    const { send } = setup();
    for (let i = 0; i < SOCKET_EVENT_LIMIT.limit; i++) expect(send("match:action")).toBe(true);
    expect(send("match:action")).toBe(false);
  });

  it("libera de novo na janela seguinte", () => {
    const { send, advance } = setup();
    for (let i = 0; i <= SOCKET_EVENT_LIMIT.limit; i++) send("match:action");
    advance(SOCKET_EVENT_LIMIT.windowMs);
    expect(send("match:action")).toBe(true);
  });

  it("evento caro tem teto próprio e responde o ack", () => {
    const { send, advance } = setup();
    for (let i = 0; i < SOCKET_COSTLY_EVENT_LIMIT.limit; i++) {
      expect(send("challenge:create")).toBe(true);
      advance(1_000);
    }
    let reply: unknown;
    expect(send("challenge:create", {}, (r: unknown) => { reply = r; })).toBe(false);
    expect(reply).toMatchObject({ ok: false });
    expect(send("match:action")).toBe(true);
  });
});
