import { describe, expect, it } from "vitest";
import {
  BUG_REPORT_RATE_LIMIT,
  buildGithubDispatchRequest,
  canSubmitBugReport,
  createBugReportRateLimiter,
} from "./bugReport";

describe("createBugReportRateLimiter (docs/44 Fase 3 §5.1 — 5/h por reporter)", () => {
  it("libera os primeiros 5 e bloqueia o 6º na mesma janela", () => {
    const limiter = createBugReportRateLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < BUG_REPORT_RATE_LIMIT; i += 1) {
      expect(limiter.isLimited("u1", t0 + i)).toBe(false);
      limiter.record("u1", t0 + i);
    }
    expect(limiter.isLimited("u1", t0 + BUG_REPORT_RATE_LIMIT)).toBe(true);
  });

  it("conta por reporter — u2 não é afetado pelo teto de u1", () => {
    const limiter = createBugReportRateLimiter();
    for (let i = 0; i < BUG_REPORT_RATE_LIMIT; i += 1) limiter.record("u1", 1_000 + i);
    expect(limiter.isLimited("u1", 2_000)).toBe(true);
    expect(limiter.isLimited("u2", 2_000)).toBe(false);
  });

  it("a janela desliza: passada 1h os hits antigos não contam mais", () => {
    const limiter = createBugReportRateLimiter();
    for (let i = 0; i < BUG_REPORT_RATE_LIMIT; i += 1) limiter.record("u1", 1_000 + i);
    expect(limiter.isLimited("u1", 1_000 + 60 * 60 * 1000)).toBe(false);
  });

  it("check não gasta cota — só record", () => {
    const limiter = createBugReportRateLimiter();
    for (let i = 0; i < 20; i += 1) expect(limiter.isLimited("u1", 1_000)).toBe(false);
  });
});

describe("canSubmitBugReport", () => {
  it("jogador logado pode", () => {
    expect(canSubmitBugReport({ userId: "u1" })).toBe(true);
  });
  it("guest (desafio por link) não pode", () => {
    expect(canSubmitBugReport({ userId: "guest:abc", guest: true })).toBe(false);
  });
  it("sem userId não pode", () => {
    expect(canSubmitBugReport(undefined)).toBe(false);
    expect(canSubmitBugReport({})).toBe(false);
    expect(canSubmitBugReport({ userId: null })).toBe(false);
  });
});

describe("buildGithubDispatchRequest (repository_dispatch da triagem)", () => {
  it("sem token → null (o server só loga 'dispatch pulado' e NÃO falha)", () => {
    expect(buildGithubDispatchRequest("BUG-A1B2C3", { token: "", repo: "WillenWorks/portal-gundam-tcg-br" })).toBeNull();
  });

  it("com token → POST .../dispatches com event_type 'bug-report' e o shortCode no payload", () => {
    const req = buildGithubDispatchRequest("BUG-A1B2C3", { token: "ghp_x", repo: "WillenWorks/portal-gundam-tcg-br" });
    expect(req).not.toBeNull();
    expect(req?.url).toBe("https://api.github.com/repos/WillenWorks/portal-gundam-tcg-br/dispatches");
    expect(req?.headers.Authorization).toBe("Bearer ghp_x");
    expect(JSON.parse(req!.body)).toEqual({ event_type: "bug-report", client_payload: { shortCode: "BUG-A1B2C3" } });
  });
});
