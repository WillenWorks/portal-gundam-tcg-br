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

  it("não injeta nada fora de produção", () => {
    initAnalytics("abc");
    expect(document.head.querySelector("script")).toBeNull();
  });
});
