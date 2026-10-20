import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/node";
import { scrubServerEvent, scrubServerText, shouldMonitorServer } from "./errorMonitoring.ts";

describe("shouldMonitorServer", () => {
  it("liga só em produção e permite desligar por env", () => {
    expect(shouldMonitorServer({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(true);
    expect(shouldMonitorServer({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(false);
    expect(shouldMonitorServer({ NODE_ENV: "test" } as NodeJS.ProcessEnv)).toBe(false);
    expect(shouldMonitorServer({ NODE_ENV: "production", SENTRY_DISABLED: "true" } as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("scrubServerEvent", () => {
  it("não envia dados da requisição nem do usuário", () => {
    const event = {
      type: undefined,
      user: { id: "u1", email: "a@b.com" },
      request: {
        url: "https://anaheimhub.com/api/auth/reset?token=abc",
        headers: { authorization: "Bearer x", cookie: "s=1" },
        cookies: { s: "1" },
        data: '{"password":"123"}',
        env: { REMOTE_ADDR: "1.2.3.4" },
        query_string: "token=abc",
      },
      message: "falhou para c@d.com",
      exception: { values: [{ type: "Error", value: "Bearer abc.def" }] },
    } as unknown as ErrorEvent;

    const out = scrubServerEvent(event);
    expect(out.user).toBeUndefined();
    expect(out.request?.headers).toBeUndefined();
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.data).toBeUndefined();
    expect(out.request?.env).toBeUndefined();
    expect(out.request?.url).toBe("https://anaheimhub.com/api/auth/reset?token=[removido]");
    expect(out.message).toBe("falhou para [removido]");
    expect(out.exception?.values?.[0].value).toBe("Bearer [removido]");
    expect(scrubServerText("ok /api/cards")).toBe("ok /api/cards");
  });
});
