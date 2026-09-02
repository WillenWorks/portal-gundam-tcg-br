// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Trash2 } from "lucide-react";
import { CounterChip } from "./CounterChip";

afterEach(cleanup);

describe("CounterChip", () => {
  it("renderiza rótulo e contagem", () => {
    render(<CounterChip label="Trash" count={7} />);
    expect(screen.getByText("Trash")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("sem onClick não é botão", () => {
    render(<CounterChip label="Deck" count={30} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("com onClick vira botão com alvo de toque >= 44px e dispara o callback", () => {
    const onClick = vi.fn();
    render(<CounterChip label="Exílio" count={2} onClick={onClick} />);
    const btn = screen.getByRole("button", { name: "Exílio: 2" });
    expect(btn.className).toMatch(/min-h-11/);
    expect(btn.className).toMatch(/min-w-11/);
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("tone crit pinta de vermelho, tone warn de âmbar", () => {
    const { rerender } = render(<CounterChip label="Deck" count={1} tone="crit" />);
    expect(screen.getByText("Deck").closest("div")?.className).toMatch(/red/);
    rerender(<CounterChip label="Deck" count={3} tone="warn" />);
    expect(screen.getByText("Deck").closest("div")?.className).toMatch(/amber/);
  });

  it("renderiza o ícone quando fornecido", () => {
    const { container } = render(<CounterChip label="Trash" count={4} icon={Trash2} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
