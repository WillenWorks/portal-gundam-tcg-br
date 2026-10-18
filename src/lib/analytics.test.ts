// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { initAnalytics, shouldLoadAnalytics } from "./analytics";

describe("analytics", () => {
  afterEach(() => document.head.querySelectorAll("script").forEach((s) => s.remove()));

  it("só liga em produção e com token", () => {
    expect(shouldLoadAnalytics("abc", "anaheimhub.com")).toBe(true);
    expect(shouldLoadAnalytics("abc", "localhost")).toBe(false);
    expect(shouldLoadAnalytics("abc", "portal-gundam-tcg-br.vercel.app")).toBe(false);
    expect(shouldLoadAnalytics("", "anaheimhub.com")).toBe(false);
    expect(shouldLoadAnalytics(undefined, "anaheimhub.com")).toBe(false);
  });

  it("em produção injeta o beacon com o token e modo SPA, uma vez só", () => {
    initAnalytics("tok123", "anaheimhub.com");
    initAnalytics("tok123", "anaheimhub.com");
    const scripts = document.head.querySelectorAll('script[src="https://static.cloudflareinsights.com/beacon.min.js"]');
    expect(scripts).toHaveLength(1);
    expect(JSON.parse(scripts[0].getAttribute("data-cf-beacon")!)).toEqual({ token: "tok123", spa: true });
  });

  it("usa o token do anaheimhub.com por padrão", () => {
    initAnalytics(undefined, "anaheimhub.com");
    const beacon = document.head.querySelector("script[data-cf-beacon]");
    expect(JSON.parse(beacon!.getAttribute("data-cf-beacon")!).token).toBe("bc2aeaeb83ef4bfb98b0977292b6d603");
  });

  it("não injeta nada fora de produção", () => {
    initAnalytics("abc");
    expect(document.head.querySelector("script")).toBeNull();
  });
});
