// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ShieldRail } from "./ShieldRail";

afterEach(cleanup);

describe("ShieldRail", () => {
  it("mostra a contagem e reserva `max` pips por padrão", () => {
    render(<ShieldRail count={4} />);
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "4 de 6 shields" })).toBeInTheDocument();
  });

  it("count <= 2 pinta o número de vermelho", () => {
    render(<ShieldRail count={2} />);
    expect(screen.getByText("2").className).toMatch(/text-red/);
  });

  it("count === 1 mostra o aviso de lethal", () => {
    render(<ShieldRail count={1} />);
    expect(screen.getByText("1 golpe do lethal")).toBeInTheDocument();
  });

  it("count === 0 mostra o aviso de dano direto", () => {
    render(<ShieldRail count={0} />);
    expect(screen.getByText("sem shields — dano direto")).toBeInTheDocument();
  });

  it("selectable: cada pip cheio é um botão de alvo >= 44px e dispara com o índice", () => {
    const onSelectIndex = vi.fn();
    render(<ShieldRail count={3} selectable onSelectIndex={onSelectIndex} />);
    const pips = screen.getAllByRole("button", { name: /^Shield \d$/ });
    expect(pips).toHaveLength(3);
    expect(pips[0].className).toMatch(/size-11/);
    pips[1].click();
    expect(onSelectIndex).toHaveBeenCalledWith(1);
  });

  it("selectedIndexes realça o pip escolhido", () => {
    render(<ShieldRail count={3} selectable selectedIndexes={[2]} onSelectIndex={() => {}} />);
    expect(screen.getByRole("button", { name: "Shield 3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Shield 1" })).toHaveAttribute("aria-pressed", "false");
  });

  it("não é selecionável sem a flag", () => {
    render(<ShieldRail count={3} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("orientation vertical empilha os pips em coluna e mantém contagem + avisos", () => {
    render(<ShieldRail count={1} orientation="vertical" />);
    const list = screen.getByRole("list", { name: "1 de 6 shields" });
    expect(list.className).toMatch(/flex-col/);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("1 golpe do lethal")).toBeInTheDocument();
  });

  it("vertical + selectable preserva o hit-area de 44px por pip cheio", () => {
    render(<ShieldRail count={2} orientation="vertical" selectable onSelectIndex={() => {}} />);
    const pips = screen.getAllByRole("button", { name: /^Shield \d$/ });
    expect(pips).toHaveLength(2);
    expect(pips[0].className).toMatch(/size-11/);
  });

  it("horizontal (padrão) não empilha os pips", () => {
    render(<ShieldRail count={3} />);
    expect(screen.getByRole("list", { name: "3 de 6 shields" }).className).not.toMatch(/flex-col/);
  });
});
