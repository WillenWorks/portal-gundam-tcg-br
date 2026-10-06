// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { BattleLogPanel } from "./BattleLogPanel";
import type { BattleLogEntry } from "./battleLog";

afterEach(cleanup);

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("BattleLogPanel", () => {
  it("renderiza estado vazio quando não há eventos", () => {
    render(<BattleLogPanel entries={[]} />);
    expect(screen.getByText("Nenhum evento registrado ainda.")).toBeInTheDocument();
    expect(screen.getByText(/Log de combate/i)).toBeInTheDocument();
  });

  it("renderiza entradas com estilos e classes de cada tipo", () => {
    const entries: BattleLogEntry[] = [
      { seq: 1, text: "Turno 1 do Jogador A", kind: "turn" },
      { seq: 2, text: "Jogador A baixou Gundam", kind: "play" },
      { seq: 3, text: "Gundam atacou a Base inimiga", kind: "combat" },
      { seq: 4, text: "Base sofreu 1 de dano", kind: "damage" },
      { seq: 5, text: "Habilidade ativada", kind: "effect" },
    ];
    render(<BattleLogPanel entries={entries} />);
    expect(screen.getByText(/Log de combate \(5\)/i)).toBeInTheDocument();
    expect(screen.getByText("Turno 1 do Jogador A")).toBeInTheDocument();
    expect(screen.getByText("Gundam atacou a Base inimiga")).toBeInTheDocument();
  });

  it("dispara callback onCollapse ao clicar no botão de recolher", () => {
    const onCollapse = vi.fn();
    render(<BattleLogPanel entries={[]} onCollapse={onCollapse} />);
    const btn = screen.getByTitle("Recolher painel de log");
    fireEvent.click(btn);
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });
});
