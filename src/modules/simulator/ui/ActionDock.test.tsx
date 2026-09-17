// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ActionDock, type ActionDockProps } from "./ActionDock";

/* docs/52 — o ActionDock virou um ribbon compacto: fase/turno/timer, o botão
 * de encerrar turno (só na sua vez), um toggle de log e um indicador discreto
 * de ping/auto-pass. As decisões de jogada regular saíram daqui (agora vivem
 * no MatchPrompt/TopTacticalHUD) — por isso RTL + jsdom bastam aqui, sem o
 * caminhador de árvore que o ribbon antigo (com ~8 `kind`s) precisava. */

afterEach(cleanup);

const BASE: ActionDockProps = {
  yourTurn: true,
  phaseLabel: "Fase Principal",
  timerSeconds: 30,
  logOpen: false,
  logCount: 0,
  autoPass: false,
};

describe("ActionDock", () => {
  it("sua vez: mostra fase, timer e o botão Passar turno", () => {
    render(<ActionDock {...BASE} onEndTurn={vi.fn()} />);
    expect(screen.getByText(/sua vez/i)).toBeInTheDocument();
    expect(screen.getByText(/fase principal/i)).toBeInTheDocument();
    expect(screen.getByText(/30s/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /passar turno/i })).toBeInTheDocument();
  });

  it("mostra o número do turno quando informado", () => {
    render(<ActionDock {...BASE} turnNumber={4} />);
    expect(screen.getByText(/turno 4/i)).toBeInTheDocument();
  });

  it("vez do oponente: esconde o botão de passar turno e o timer nulo não aparece", () => {
    render(<ActionDock {...BASE} yourTurn={false} timerSeconds={null} />);
    expect(screen.getByText(/vez do oponente/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /passar turno/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+s/)).not.toBeInTheDocument();
  });

  it("inActionStep: mostra 'Sua vez' e botão Passar ação quando onPassAction informado", () => {
    const onPassAction = vi.fn();
    render(<ActionDock {...BASE} yourTurn={false} inActionStep={true} phaseLabel="Passo de Ação" onPassAction={onPassAction} />);
    expect(screen.getByText(/sua vez · passo de ação/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /passar ação/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onPassAction).toHaveBeenCalledTimes(1);
  });

  it("Passar turno chama onEndTurn e respeita busy", () => {
    const onEndTurn = vi.fn();
    const { rerender } = render(<ActionDock {...BASE} onEndTurn={onEndTurn} busy />);
    const btn = screen.getByRole("button", { name: /passar turno/i });
    expect(btn).toBeDisabled();

    rerender(<ActionDock {...BASE} onEndTurn={onEndTurn} />);
    fireEvent.click(screen.getByRole("button", { name: /passar turno/i }));
    expect(onEndTurn).toHaveBeenCalledTimes(1);
  });

  it("botão de Log chama onToggleLog e mostra a contagem quando > 0", () => {
    const onToggleLog = vi.fn();
    render(<ActionDock {...BASE} logCount={3} onToggleLog={onToggleLog} />);
    const btn = screen.getByRole("button", { name: /log \(3\)/i });
    fireEvent.click(btn);
    expect(onToggleLog).toHaveBeenCalledTimes(1);
  });

  it("sem entradas no log, não mostra a contagem", () => {
    render(<ActionDock {...BASE} logCount={0} />);
    expect(screen.getByRole("button", { name: /^log$/i })).toBeInTheDocument();
  });

  it("indicador de auto-pass alterna com onToggleAutoPass e mostra o ping quando presente", () => {
    const onToggleAutoPass = vi.fn();
    render(<ActionDock {...BASE} autoPass={false} pingMs={42} onToggleAutoPass={onToggleAutoPass} />);
    const btn = screen.getByRole("button", { name: /42ms.*auto-pass off/i });
    fireEvent.click(btn);
    expect(onToggleAutoPass).toHaveBeenCalledWith(true);
  });

  it("sem pingMs, o indicador de auto-pass não mostra latência", () => {
    render(<ActionDock {...BASE} autoPass={true} pingMs={null} />);
    expect(screen.getByRole("button", { name: /^auto-pass on$/i })).toBeInTheDocument();
  });

  it("log aberto: desloca a âncora do desktop pra não tapar o BattleLogDrawer", () => {
    const { container: closed } = render(<ActionDock {...BASE} logOpen={false} />);
    expect(closed.querySelector("aside")?.className).toContain("lg:right-2");

    const { container: open } = render(<ActionDock {...BASE} logOpen={true} />);
    expect(open.querySelector("aside")?.className).toContain("lg:right-[16.5rem]");
  });
});
