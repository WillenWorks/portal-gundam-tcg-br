import { describe, expect, it } from "vitest";
import { resolvePublicAppUrl } from "./publicAppUrl";

const req = (headers: Record<string, string>, protocol = "http") => ({
  protocol,
  get: (name: string) => headers[name.toLowerCase()],
});

describe("resolvePublicAppUrl", () => {
  const prod = { allowedOrigins: ["https://anaheimhub.com", "https://www.anaheimhub.com"], isRemote: true };

  it("ignora X-Forwarded-Host forjado e usa o endereço de produção", () => {
    expect(resolvePublicAppUrl(req({ "x-forwarded-host": "site-falso.com", "x-forwarded-proto": "https" }), prod)).toBe("https://anaheimhub.com");
    expect(resolvePublicAppUrl(req({ host: "site-falso.com" }, "https"), prod)).toBe("https://anaheimhub.com");
  });

  it("aceita o cabeçalho quando a origem está na lista permitida", () => {
    expect(resolvePublicAppUrl(req({ "x-forwarded-host": "www.anaheimhub.com", "x-forwarded-proto": "https" }), prod)).toBe("https://www.anaheimhub.com");
  });

  it("PUBLIC_APP_URL vale antes do padrão de produção", () => {
    expect(resolvePublicAppUrl(req({ host: "evil.test" }), { ...prod, envUrl: "https://beta.anaheimhub.com/" })).toBe("https://beta.anaheimhub.com");
  });

  it("em desenvolvimento local, usa PUBLIC_APP_URL ou o endereço local padrão", () => {
    expect(resolvePublicAppUrl(req({ host: "evil.test" }), { allowedOrigins: [], isRemote: false })).toBe("http://localhost:8787");
    expect(resolvePublicAppUrl(req({ host: "evil.test" }), { allowedOrigins: [], isRemote: false, envUrl: "http://localhost:5173" })).toBe("http://localhost:5173");
  });

  it("sem requisição, cai no endereço do ambiente", () => {
    expect(resolvePublicAppUrl(undefined, prod)).toBe("https://anaheimhub.com");
  });
});
