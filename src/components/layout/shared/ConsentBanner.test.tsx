// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ConsentBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.stubEnv("VITE_CONSENT_PREVIEW", "1");
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  async function setup() {
    const consent = await import("@/lib/consent");
    consent.initConsent();
    const { ConsentBanner } = await import("./ConsentBanner");
    render(<ConsentBanner />);
    return consent;
  }

  it("aparece sem escolha salva, com aceitar e recusar lado a lado", async () => {
    await setup();
    expect(screen.getByRole("region", { name: /cookies/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /aceitar/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /recusar/i })).toBeTruthy();
  });

  it("recusar guarda a escolha e some; o rodapé reabre", async () => {
    const consent = await setup();
    fireEvent.click(screen.getByRole("button", { name: /recusar/i }));
    expect(screen.queryByRole("region", { name: /cookies/i })).toBeNull();
    expect(consent.readConsent()).toMatchObject({ analytics: false, ads: false });

    act(() => consent.openConsentPreferences());
    expect(screen.getByText(/escolha atual: recusado/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /fechar/i }));
    expect(screen.queryByRole("region", { name: /cookies/i })).toBeNull();
  });

  it("não aparece de novo para quem já escolheu", async () => {
    localStorage.setItem("anaheimhub:consent", JSON.stringify({ v: 1, analytics: true, ads: true, at: "x" }));
    await setup();
    expect(screen.queryByRole("region", { name: /cookies/i })).toBeNull();
  });
});
