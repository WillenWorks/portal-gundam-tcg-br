// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ResourceMeter } from "./ResourceMeter";

afterEach(cleanup);

const res = (instanceId: string, over: { rested?: boolean; isEx?: boolean } = {}) => ({
  instanceId,
  rested: over.rested ?? false,
  isEx: over.isEx ?? false,
});

describe("ResourceMeter", () => {
  it("leitura só via aria-label/title (sem texto '◆◆◇ N ativos · nível')", () => {
    render(<ResourceMeter resources={[res("a"), res("b", { rested: true }), res("c")]} level={3} />);
    expect(screen.getByLabelText("2 recurso(s) ativo(s) de 3 · nível 3")).toBeInTheDocument();
    expect(screen.queryByText(/ativos/)).toBeNull();
    expect(screen.queryByText(/◆/)).toBeNull();
  });

  it("estado vazio: sem texto, só o rótulo acessível", () => {
    render(<ResourceMeter resources={[]} level={0} />);
    expect(screen.getByLabelText("0 recurso(s) ativo(s) de 0 · nível 0")).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum recurso/)).toBeNull();
  });

  it("recurso gasto aparece girado (forma, não só cor)", () => {
    render(<ResourceMeter resources={[res("a", { rested: true })]} level={1} />);
    expect(screen.getByLabelText("Recurso gasto").className).toMatch(/rotate-90/);
  });

  it("EX Resource tem moldura dourada e o aviso de sair de jogo", () => {
    render(<ResourceMeter resources={[res("ex", { isEx: true })]} level={1} />);
    const ex = screen.getByLabelText("EX Resource — sai de jogo se gasto");
    expect(ex.className).toMatch(/accent/);
  });

  it("selectable: só os ativos são clicáveis e o callback recebe o id", () => {
    const onSelect = vi.fn();
    render(
      <ResourceMeter
        resources={[res("a"), res("b", { rested: true }), res("c")]}
        level={2}
        selectable
        onSelect={onSelect}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    buttons[0].click();
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("selectedIds realça em esmeralda", () => {
    render(
      <ResourceMeter resources={[res("a")]} level={1} selectable selectedIds={["a"]} onSelect={() => {}} />,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn.className).toMatch(/emerald/);
  });

  it("costProgress mostra a barra de custo pago", () => {
    render(<ResourceMeter resources={[res("a"), res("b")]} level={2} costProgress={{ paid: 1, total: 3 }} />);
    expect(screen.getByText("1/3 pago")).toBeInTheDocument();
  });

  it("readOnly não renderiza botões", () => {
    render(<ResourceMeter resources={[res("a")]} level={1} readOnly selectable onSelect={() => {}} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
