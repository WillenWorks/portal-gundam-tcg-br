import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/react";
import { DEFAULT_SENTRY_DSN, scrubEvent, scrubText, shouldMonitorErrors } from "./errorMonitoring";

describe("shouldMonitorErrors", () => {
  it("liga só no domínio de produção", () => {
    expect(shouldMonitorErrors(DEFAULT_SENTRY_DSN, "anaheimhub.com")).toBe(true);
    expect(shouldMonitorErrors(DEFAULT_SENTRY_DSN, "www.anaheimhub.com")).toBe(true);
    expect(shouldMonitorErrors(DEFAULT_SENTRY_DSN, "localhost")).toBe(false);
    expect(shouldMonitorErrors(DEFAULT_SENTRY_DSN, "portal-preview.vercel.app")).toBe(false);
  });

  it("não liga sem DSN", () => {
    expect(shouldMonitorErrors("", "anaheimhub.com")).toBe(false);
    expect(shouldMonitorErrors("   ", "anaheimhub.com")).toBe(false);
    expect(shouldMonitorErrors(undefined, "anaheimhub.com")).toBe(false);
  });
});

describe("scrubText", () => {
  it("remove e-mails, tokens de URL e Bearer", () => {
    expect(scrubText("falhou para fulano@exemplo.com.br")).toBe("falhou para [removido]");
    expect(scrubText("/redefinir-senha?token=abc123&x=1")).toBe("/redefinir-senha?token=[removido]&x=1");
    expect(scrubText("/confirmar-email#code=zzz")).toBe("/confirmar-email#code=[removido]");
    expect(scrubText("Authorization: Bearer eyJhbGciOi.abc.def")).toBe("Authorization: Bearer [removido]");
  });

  it("não mexe em texto comum", () => {
    expect(scrubText("TypeError: x is undefined em /cards/GD01-001")).toBe("TypeError: x is undefined em /cards/GD01-001");
  });
});

describe("scrubEvent", () => {
  it("tira usuário, cabeçalhos, cookies e corpo, e limpa mensagens e URLs", () => {
    const event = {
      type: undefined,
      user: { email: "a@b.com", ip_address: "1.2.3.4" },
      request: {
        url: "https://anaheimhub.com/redefinir-senha?token=segredo",
        headers: { Authorization: "Bearer x" },
        cookies: { s: "1" },
        data: { senha: "123" },
      },
      message: "erro de fulano@exemplo.com",
      exception: { values: [{ type: "Error", value: "falhou para b@c.com" }] },
      breadcrumbs: [{ message: "fetch /api?token=abc", data: { url: "/api/me?token=abc" } }],
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);
    expect(out.user).toBeUndefined();
    expect(out.request?.headers).toBeUndefined();
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.data).toBeUndefined();
    expect(out.request?.url).toBe("https://anaheimhub.com/redefinir-senha?token=[removido]");
    expect(out.message).toBe("erro de [removido]");
    expect(out.exception?.values?.[0].value).toBe("falhou para [removido]");
    expect(out.breadcrumbs?.[0].message).toBe("fetch /api?token=[removido]");
    expect(out.breadcrumbs?.[0].data?.url).toBe("/api/me?token=[removido]");
  });
});
