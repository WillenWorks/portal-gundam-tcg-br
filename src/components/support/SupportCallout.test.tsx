// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";

const getSupporters = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: { getSupporters } }));
vi.mock("@/lib/supportLinks", () => ({ SUPPORT_URL: "", INSTAGRAM_URL: "https://www.instagram.com/anaheimhub/", DISCORD_URL: "https://discord.gg/Q83CCuphjU" }));

import { ArticleSupportLine, HomeSupportStrip } from "./SupportCallout";

afterEach(() => {
  cleanup();
  getSupporters.mockReset();
});

describe("chamadas de apoio", () => {
  it("home: mostra os primeiros nomes do mural e leva a /apoie, /apoiadores e Instagram", async () => {
    getSupporters.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({ name: `Piloto ${i + 1}`, username: i === 0 ? "char" : undefined, tier: i === 0 ? "COMANDANTE" : null })),
    );
    render(<HomeSupportStrip />);
    expect(await screen.findByRole("link", { name: "Piloto 1" })).toHaveAttribute("href", "/u/char");
    expect(screen.getByText("Piloto 6")).toBeInTheDocument();
    expect(screen.queryByText("Piloto 7")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Apoiar/ })).toHaveAttribute("href", "/apoie");
    expect(screen.getByRole("link", { name: /Mural de apoiadores/ })).toHaveAttribute("href", "/apoiadores");
    expect(screen.getByRole("link", { name: /Instagram/ })).toHaveAttribute("href", "https://www.instagram.com/anaheimhub/");
  });

  it("home sem apoiadores (ou API fora) continua com os links, sem lista vazia", async () => {
    getSupporters.mockRejectedValue(new Error("fora do ar"));
    render(<HomeSupportStrip />);
    expect(await screen.findByRole("heading", { name: "Mantido por quem joga" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Apoiadores" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Apoiar/ })).toHaveAttribute("href", "/apoie");
  });

  it("fim do artigo: uma linha com os links de apoio, mural, Instagram e Discord", () => {
    render(<ArticleSupportLine />);
    expect(screen.getByText(/mantido por apoiadores/)).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/apoie", "/apoiadores", "https://www.instagram.com/anaheimhub/", "https://discord.gg/Q83CCuphjU"]);
  });
});
