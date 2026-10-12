import { describe, expect, it } from "vitest";
import { createRecaptchaVerifier } from "./recaptchaService.ts";

describe("recaptchaService", () => {
  it("sem configuração não bloqueia e retorna valid=true", async () => {
    const verifier = createRecaptchaVerifier({});
    expect(verifier.isConfigured).toBe(false);
    const result = await verifier.verify("qualquer-token", "LOGIN");
    expect(result.valid).toBe(true);
    expect(result.reason).toBe("recaptcha_not_configured");
  });

  it("configurado mas sem token no request retorna valid=false", async () => {
    const verifier = createRecaptchaVerifier({
      siteKey: "6LfAh-otAAAAAHuvUEuB_rDcNSicxJYNdKT183TZ",
      apiKey: "fake-key",
      projectId: "anaheimhub-portal",
    });
    expect(verifier.isConfigured).toBe(true);
    const result = await verifier.verify(undefined, "LOGIN");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("token_missing");
  });
});
