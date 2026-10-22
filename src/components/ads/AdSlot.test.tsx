// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdSlot } from "./AdSlot";

describe("AdSlot Component", () => {
  afterEach(() => {
    cleanup();
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
});
