// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SimulatorLayoutPreviewPage, { buildLayoutPreviewFixture } from "./SimulatorLayoutPreviewPage";

afterEach(cleanup);

describe("SimulatorLayoutPreviewPage (dev-only)", () => {
  it("monta sem erro e mostra o rótulo de preview + a barra de controle", () => {
    render(<SimulatorLayoutPreviewPage />);
    expect(screen.getByText(/Preview de layout — dados estáticos, sem motor/i)).toBeInTheDocument();
    expect(screen.getByText(/F4 · preview/i)).toBeInTheDocument();
    expect(screen.getByText("Seta de ataque (no jogador)")).toBeInTheDocument();
    expect(screen.getByText("Forçar reduced-motion")).toBeInTheDocument();
    // botão de replay da mão + seletor de animação/cenário
    expect(screen.getByRole("button", { name: /re-animar mão/i })).toBeInTheDocument();
    expect(screen.getByText("Animação / cenário")).toBeInTheDocument();
  });

  it("#2 — clicar no corpo da carta abre o inspetor (CardInspectorModal)", () => {
    render(<SimulatorLayoutPreviewPage />);
    // sem modal aberto
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
    // corpo da carta da Battle Area = botão "Ver <nome>"
    fireEvent.click(screen.getByRole("button", { name: "Ver Gundam" }));
    // o inspetor abriu (tem botão Fechar + a arte da carta)
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    expect(screen.getAllByAltText("Gundam").length).toBeGreaterThan(0);
  });

  it("#5 — fixture usa cartas REAIS de ST01/ST02 (não genéricas)", () => {
    const fx = buildLayoutPreviewFixture();
    const codes = fx.A.slots.map((s) => s.unit.def.code).concat(fx.B.slots.map((s) => s.unit.def.code));
    expect(codes).toContain("ST01-001"); // Gundam
    expect(codes).toContain("ST02-001"); // Wing Gundam
    expect(codes.every((c) => /^ST0[12]-/.test(c))).toBe(true);
    // Link real: Gundam (link "Amuro Ray") pareado com Amuro Ray
    const gundam = fx.A.slots.find((s) => s.unit.def.code === "ST01-001")!;
    expect(gundam.pilot?.def.nameEn).toBe("Amuro Ray");
    expect(gundam.unit.def.link).toEqual({ kind: "pilotName", values: ["Amuro Ray"] });
  });

  it("fixture estático tem Battle Area cheia dos dois lados, Base com dano e recursos pra empilhar", () => {
    const fx = buildLayoutPreviewFixture();
    expect(fx.A.slots).toHaveLength(6);
    expect(fx.B.slots).toHaveLength(6);
    expect(fx.A.base?.damage).toBeGreaterThan(0);
    expect(fx.B.base?.damage).toBeGreaterThan(0);
    expect(fx.A.resources.length).toBeGreaterThanOrEqual(8);
    expect(fx.A.resources.filter((r) => !r.rested && !r.isEx).length).toBeGreaterThanOrEqual(3);
    expect(fx.hand.length).toBeGreaterThanOrEqual(5);
    expect(fx.A.slots.some((s) => s.pilot !== null)).toBe(true);
    expect(fx.A.slots.some((s) => s.unit.damage > 0)).toBe(true);
    expect(fx.A.slots.some((s) => s.unit.rested)).toBe(true);
  });
});
