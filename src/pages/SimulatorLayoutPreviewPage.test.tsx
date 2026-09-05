// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SimulatorLayoutPreviewPage, { buildLayoutPreviewFixture } from "./SimulatorLayoutPreviewPage";

afterEach(cleanup);

describe("SimulatorLayoutPreviewPage (dev-only)", () => {
  it("monta sem erro e mostra o rótulo de preview + a barra de controle", () => {
    render(<SimulatorLayoutPreviewPage />);
    expect(screen.getByText(/Preview de layout — dados estáticos, sem motor/i)).toBeInTheDocument();
    expect(screen.getByText(/F4 · preview/i)).toBeInTheDocument();
    // controles principais presentes
    expect(screen.getByText("Seta de ataque (no jogador)")).toBeInTheDocument();
    expect(screen.getByText("Forçar reduced-motion")).toBeInTheDocument();
  });

  it("fixture estático tem Battle Area cheia dos dois lados, Base com dano e recursos pra empilhar", () => {
    const fx = buildLayoutPreviewFixture();
    expect(fx.A.slots).toHaveLength(6);
    expect(fx.B.slots).toHaveLength(6);
    expect(fx.A.base?.damage).toBeGreaterThan(0);
    expect(fx.B.base?.damage).toBeGreaterThan(0);
    // 8+ recursos, com repetição (pra ver os badges xN)
    expect(fx.A.resources.length).toBeGreaterThanOrEqual(8);
    expect(fx.A.resources.filter((r) => !r.rested && !r.isEx).length).toBeGreaterThanOrEqual(3);
    // mão com ~6 cartas
    expect(fx.hand.length).toBeGreaterThanOrEqual(5);
    // pelo menos um slot com Pilot pareado e um com dano
    expect(fx.A.slots.some((s) => s.pilot !== null)).toBe(true);
    expect(fx.A.slots.some((s) => s.unit.damage > 0)).toBe(true);
    expect(fx.A.slots.some((s) => s.unit.rested)).toBe(true);
  });
});
