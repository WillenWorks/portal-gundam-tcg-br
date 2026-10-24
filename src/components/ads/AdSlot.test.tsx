// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdSlot } from "./AdSlot";

describe("AdSlot Component", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    delete window.adsbygoogle;
  });

  // dispara o carregamento na hora, como se o bloco já estivesse na tela
  function stubVisible() {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        private cb: (entries: Array<{ isIntersecting: boolean }>) => void;
        constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
          this.cb = cb;
        }
        observe() {
          this.cb([{ isIntersecting: true }]);
        }
        disconnect() {}
      },
    );
  }

  it("renderiza corretamente com rótulo regulatório de publicidade", () => {
    render(<AdSlot format="responsive" />);
    expect(screen.getByLabelText(/Espaço Publicitário|Advertisement/i)).toBeTruthy();
    expect(screen.getByText(/Publicidade|Advertisement/i)).toBeTruthy();
  });

  it("renderiza o placeholder tático quando não há chaves de anúncio configuradas", () => {
    render(<AdSlot format="leaderboard" />);
    expect(screen.getByText(/Espaço de Patrocínio do Hub|Hub Sponsorship Space/i)).toBeTruthy();
  });

  it("em produção, sem bloco configurado, não ocupa espaço nem mostra o aviso de patrocínio", () => {
    vi.stubEnv("DEV", false);
    const { container } = render(<AdSlot format="leaderboard" />);
    expect(container.firstChild).toBeNull();
  });

  it("com bloco configurado, renderiza a área do AdSense", () => {
    vi.stubEnv("DEV", false);
    const { container } = render(<AdSlot format="leaderboard" slotId="1234567890" />);
    expect(container.querySelector("ins.adsbygoogle")).toBeTruthy();
  });

  it("sem slotId explícito, usa o bloco padrão do VITE_ADSENSE_SLOT_ID", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_ADSENSE_SLOT_ID", "9876543210");
    const { container } = render(<AdSlot format="responsive" />);
    expect(container.querySelector("ins.adsbygoogle")?.getAttribute("data-ad-slot")).toBe("9876543210");
  });

  it("o bloco ocupa a largura toda — no contêiner centralizado ele encolhia a 0 e o AdSense recusava (availableWidth=0)", () => {
    vi.stubEnv("DEV", false);
    const { container } = render(<AdSlot format="responsive" slotId="1234567890" />);
    expect((container.querySelector("ins.adsbygoogle") as HTMLElement).style.width).toBe("100%");
  });

  it("em produção, se o AdSense recusar o bloco, some sem deixar aviso de patrocínio no lugar", () => {
    vi.stubEnv("DEV", false);
    stubVisible();
    window.adsbygoogle = { push: () => { throw new Error("No slot size for availableWidth=0"); } } as unknown as unknown[];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<AdSlot format="responsive" slotId="1234567890" />);
    warn.mockRestore();
    expect(container.firstChild).toBeNull();
  });
});
