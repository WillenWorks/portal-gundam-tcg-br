// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { GameOverOverlay } from "./GameOverOverlay";
import { gameOverReasonLabel } from "./gameOverReason";

afterEach(cleanup);

describe("gameOverReasonLabel — ponto de vista do viewer", () => {
  it("resignation", () => {
    expect(gameOverReasonLabel("resignation", true)).toBe("Oponente se rendeu");
    expect(gameOverReasonLabel("resignation", false)).toBe("Você se rendeu");
  });
  it("abandonment", () => {
    expect(gameOverReasonLabel("abandonment", true)).toBe("Oponente abandonou a partida");
    expect(gameOverReasonLabel("abandonment", false)).toBe("Você abandonou a partida");
  });
  it("deckOut / noShieldsBattleDamage", () => {
    expect(gameOverReasonLabel("deckOut", true)).toBe("Oponente ficou sem cartas no deck");
    expect(gameOverReasonLabel("noShieldsBattleDamage", false)).toBe("Você sofreu dano sem shields");
  });
});

describe("GameOverOverlay", () => {
  it("vitória: 'Você Venceu' grande + motivo + botão com contagem", () => {
    const onLeave = vi.fn();
    render(<GameOverOverlay won reason="resignation" redirectSeconds={7} onLeave={onLeave} />);
    expect(screen.getByText("Você Venceu")).toBeInTheDocument();
    expect(screen.getByText("Oponente se rendeu")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /Voltar ao lobby \(7s\)/ });
    btn.click();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("derrota: 'Você Perdeu', sem contagem quando redirectSeconds null", () => {
    render(<GameOverOverlay won={false} reason="deckOut" redirectSeconds={null} onLeave={vi.fn()} />);
    expect(screen.getByText("Você Perdeu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar ao lobby" })).toBeInTheDocument();
  });
});
