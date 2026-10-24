// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/shared/AppTopNav", () => ({ AppTopNav: () => null }));
vi.mock("@/components/layout/shared/AppFooter", () => ({ AppFooter: () => null }));
vi.mock("@/components/layout/shared/SiteAnnouncementBanner", () => ({ SiteAnnouncementBanner: () => null }));

import { PublicShell } from "./PublicShell";

describe("PublicShell — bloco de anúncio", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("com `ad`, coloca o bloco do AdSense depois do conteúdo", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_ADSENSE_SLOT_ID", "1234567890");
    const { container } = render(<PublicShell ad title="Cartas"><p>conteúdo</p></PublicShell>);
    const ins = container.querySelector("ins.adsbygoogle");
    expect(ins?.getAttribute("data-ad-slot")).toBe("1234567890");
  });

  it("sem `ad` (simulador, login, deckbuilder…), não há bloco de anúncio", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_ADSENSE_SLOT_ID", "1234567890");
    const { container } = render(<PublicShell title="Simulador"><p>mesa</p></PublicShell>);
    expect(container.querySelector("ins.adsbygoogle")).toBeNull();
    expect(container.querySelector('[aria-label="Espaço Publicitário"], [aria-label="Advertisement"]')).toBeNull();
  });
});
