// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ShieldRail } from "./ShieldRail";

afterEach(cleanup);

describe("ShieldRail", () => {
  it("horizontal expõe a contagem só via aria-label/title (sem texto redundante)", () => {
    render(<ShieldRail count={4} />);
    expect(screen.getByRole("list", { name: "4 de 6 shields" })).toBeInTheDocument();
    expect(screen.queryByText("4")).toBeNull();
    expect(screen.queryByText(/SHIELDS/i)).toBeNull();
  });

  it("vertical mostra o número de shields num badge (V6, docs/31 — pedido do Willen)", () => {
    render(<ShieldRail count={4} orientation="vertical" />);
    expect(screen.getByRole("list", { name: "4 de 6 shields" })).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("vertical: o badge acompanha a contagem conforme shields saem", () => {
    const { rerender } = render(<ShieldRail count={4} orientation="vertical" />);
    expect(screen.getByText("4")).toBeInTheDocument();
    rerender(<ShieldRail count={2} orientation="vertical" />);
    expect(screen.queryByText("4")).toBeNull();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("V6.2/V6.3 (docs/33, docs/34): `compact` (prop, não breakpoint) achata a cascata (~altura inteira)", () => {
    render(<ShieldRail count={3} orientation="vertical" compact />);
    const pieces = document.querySelectorAll("[role='list'] > span[role='listitem']");
    expect(pieces[1]?.className).toContain("-mt-[calc(var(--card-w-std,2.17rem)*88/63)]");
  });

  it("sem `compact`, mantém a cascata normal (subtrai só a largura)", () => {
    render(<ShieldRail count={3} orientation="vertical" />);
    const pieces = document.querySelectorAll("[role='list'] > span[role='listitem']");
    expect(pieces[1]?.className).toContain("-mt-[var(--card-w-std,2.17rem)]");
  });

  it("reserva `max` peças por padrão (vivas + quebradas)", () => {
    const { container } = render(<ShieldRail count={3} max={6} />);
    // 6 peças no total (3 vivas + 3 quebradas tracejadas)
    expect(container.querySelectorAll("[role='list'] > *")).toHaveLength(6);
  });

  it("count <= 1 embute o aviso de lethal no rótulo acessível", () => {
    render(<ShieldRail count={1} />);
    expect(screen.getByRole("list", { name: /lethal a 1 golpe/ })).toBeInTheDocument();
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

  it("orientation vertical empilha as peças em coluna (cascata)", () => {
    render(<ShieldRail count={2} orientation="vertical" />);
    expect(screen.getByRole("list").className).toMatch(/flex-col/);
  });

  it("vertical + selectable preserva o hit-area de 44px por peça viva", () => {
    render(<ShieldRail count={2} orientation="vertical" selectable onSelectIndex={() => {}} />);
    const pips = screen.getAllByRole("button", { name: /^Shield \d$/ });
    expect(pips).toHaveLength(2);
    expect(pips[0].className).toMatch(/min-h-11/);
  });

  it("horizontal (padrão) não empilha em coluna", () => {
    render(<ShieldRail count={3} />);
    expect(screen.getByRole("list").className).not.toMatch(/flex-col/);
  });
});
