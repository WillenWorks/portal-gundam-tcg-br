// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MatchPrompt } from "./MatchPrompt";

afterEach(cleanup);

describe("MatchPrompt", () => {
  it("sem mensagem não renderiza nada", () => {
    const { container } = render(<MatchPrompt message={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("painel no topo, NUNCA intercepta clique/hover fora de si (wrapper pointer-events-none)", () => {
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

  it("docs/52 — sem callbacks contextuais, não renderiza nenhum botão", () => {
    render(<MatchPrompt message="Recurso pago! Posicionando Unit no campo…" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("docs/52 — botão Confirmar aparece com onConfirm e respeita canConfirm/busy", () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <MatchPrompt message="Confirme a jogada" onConfirm={onConfirm} canConfirm={false} />
    );
    const confirmBtn = screen.getByRole("button", { name: /confirmar/i });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(onConfirm).not.toHaveBeenCalled();

    rerender(<MatchPrompt message="Confirme a jogada" onConfirm={onConfirm} canConfirm={true} />);
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("docs/52 — botão Cancelar aparece com onCancel e a tecla Esc também aciona", () => {
    const onCancel = vi.fn();
    render(<MatchPrompt message="Escolha o alvo e confirme" onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("docs/52 — botão Não Bloquear aparece com onSkipBlock", () => {
    const onSkipBlock = vi.fn();
    render(<MatchPrompt message="Defenda: ative um <Blocker> ou não bloqueie" tone="warn" onSkipBlock={onSkipBlock} />);
    fireEvent.click(screen.getByRole("button", { name: /não bloquear/i }));
    expect(onSkipBlock).toHaveBeenCalledTimes(1);
  });

  it("docs/52 — botão Passar Ação aparece com onPassAction e Escape também aciona", () => {
    const onPassAction = vi.fn();
    render(<MatchPrompt message="Passo de Ação" tone="warn" onPassAction={onPassAction} />);
    fireEvent.click(screen.getByRole("button", { name: /passar ação/i }));
    expect(onPassAction).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onPassAction).toHaveBeenCalledTimes(2);
  });

  it("docs/52 — busy desabilita os botões contextuais", () => {
    const onCancel = vi.fn();
    const onSkipBlock = vi.fn();
    render(<MatchPrompt message="Aguarde" busy onCancel={onCancel} onSkipBlock={onSkipBlock} />);
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /não bloquear/i })).toBeDisabled();
  });
});
