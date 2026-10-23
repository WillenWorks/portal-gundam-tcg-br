// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdSlot } from "./AdSlot";

describe("AdSlot Component", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

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
});
