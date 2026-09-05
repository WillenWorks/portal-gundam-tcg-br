// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MatchPrompt } from "./MatchPrompt";

afterEach(cleanup);

describe("MatchPrompt", () => {
  it("sem mensagem não renderiza nada", () => {
    const { container } = render(<MatchPrompt message={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("painel no topo, NUNCA intercepta clique/hover (pointer-events-none)", () => {
    const { container } = render(<MatchPrompt message="Escolha o alvo" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toMatch(/pointer-events-none/);
    expect(wrapper.className).toMatch(/top-3/);
    expect(screen.getByText("Escolha o alvo")).toBeInTheDocument();
  });

  it("tom warn muda a moldura", () => {
    render(<MatchPrompt message="Defenda ou passe" tone="warn" />);
    expect(screen.getByRole("status").className).toMatch(/border-amber-400/);
  });

  it("Frente 4 (feedback Willen 3ª rodada): sem chanfro `panel-cut` (cortava o fim do texto), usa rounded-arena", () => {
    render(<MatchPrompt message="Escolha o alvo do ataque (Unit ou jogador)" />);
    const panel = screen.getByRole("status");
    expect(panel.className).not.toMatch(/panel-cut/);
    expect(panel.className).toMatch(/rounded-arena/);
    expect(panel.className).toMatch(/w-fit/);
  });
});
