// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MetricTooltip } from "./MetricTooltip";

afterEach(cleanup);

describe("MetricTooltip", () => {
  it("marca o bloco com data-metric e começa fechado", () => {
    const { container } = render(
      <MetricTooltip metric="curva-custo" what="O que é" howToRead="Como ler" />,
    );
    expect(container.querySelector('[data-metric="curva-custo"]')).toBeInTheDocument();
    expect(screen.getByRole("tooltip", { hidden: true })).not.toBeVisible();
  });

  it("o botão referencia a dica por aria-describedby (acessível)", () => {
    render(<MetricTooltip metric="top-cores" what="Contagem de cores" howToRead="Maior fatia é a cor-base" />);
    const button = screen.getByRole("button");
    const tooltip = screen.getByRole("tooltip", { hidden: true });
    expect(button).toHaveAttribute("aria-describedby", tooltip.id);
    expect(tooltip.id).toBeTruthy();
  });

  it("abre no clique mostrando o que é + como ler, e fecha no Escape", () => {
    render(<MetricTooltip metric="mao-inicial" what="Probabilidade da mão de abertura" howToRead="Quanto maior a %, melhor" />);
    const button = screen.getByRole("button");

    fireEvent.click(button);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeVisible();
    expect(tooltip).toHaveTextContent("Probabilidade da mão de abertura");
    expect(tooltip).toHaveTextContent("Quanto maior a %, melhor");
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("tooltip", { hidden: true })).not.toBeVisible();
  });
});
