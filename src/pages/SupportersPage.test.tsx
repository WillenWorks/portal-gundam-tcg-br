// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";

const getSupporters = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: { getSupporters } }));

import SupportersPage from "./SupportersPage";

afterEach(() => {
  cleanup();
  getSupporters.mockReset();
});

describe("/apoiadores", () => {
  it("mostra os apoiadores agrupados por patente, com recado e link para o perfil", async () => {
    getSupporters.mockResolvedValue([
      { name: "Char", username: "char", tier: "COMANDANTE", message: "Sieg Zeon!", sinceMonth: "nov. de 2026" },
      { name: "Fã do Apoia.se", tier: "RECRUTA" },
    ]);
    render(<SupportersPage />);
    expect(await screen.findByRole("heading", { name: /Comandantes/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Recrutas/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Pilotos/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Char" })).toHaveAttribute("href", "/u/char");
    expect(screen.getByText("“Sieg Zeon!”")).toBeInTheDocument();
    expect(screen.getByText("2 pilotos mantendo o hangar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver patentes e formas de apoio" })).toHaveAttribute("href", "/apoie");
  });

  it("mural vazio convida a ser o primeiro; erro na API cai no mesmo estado", async () => {
    getSupporters.mockRejectedValue(new Error("fora do ar"));
    render(<SupportersPage />);
    expect(await screen.findByText("O mural ainda está vazio")).toBeInTheDocument();
  });
});
