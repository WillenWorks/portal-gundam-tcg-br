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

  it("recurso gasto aparece deitado (forma, não só cor) — V6.3 (docs/34): caixa externa já nasce em paisagem, só a imagem por dentro gira", () => {
    render(<ResourceMeter resources={[res("a", { rested: true })]} level={1} />);
    const outer = screen.getByLabelText("Recurso gasto");
    expect(outer.className).toMatch(/aspect-\[88\/63\]/);
    expect(outer.querySelector(".rotate-90")).not.toBeNull();
  });

  it("EX Resource tem moldura dourada e o aviso de sair de jogo", () => {
    render(<ResourceMeter resources={[res("ex", { isEx: true })]} level={1} />);
    const ex = screen.getByLabelText("EX Resource — sai de jogo se gasto");
    expect(ex.className).toMatch(/accent/);
  });

  it("recurso face-up mostra a ilustração real quando há arte (não o verso)", () => {
    render(
      <ResourceMeter
        resources={[{ instanceId: "a", rested: false, isEx: false, code: "ST01-RESOURCE" }]}
        level={1}
        art={{ "ST01-RESOURCE": { imageUrl: "resource.png" } }}
      />,
    );
    const img = screen.getByLabelText("Recurso ativo").querySelector("img")!;
    expect(img).toHaveAttribute("src", "resource.png");
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

  it("Frente 4 (docs/38 §3.3): recursos idênticos viram 1 pilha com badge xN", () => {
    render(
      <ResourceMeter
        resources={[res("a"), res("b"), res("c"), res("d", { isEx: true }), res("e", { isEx: true })]}
        level={5}
      />,
    );
    // 3 normais ativos → 1 pilha "Recurso ativo" com badge x3
    expect(screen.getAllByLabelText("Recurso ativo")).toHaveLength(1);
    expect(screen.getByText("x3")).toBeInTheDocument();
    // 2 EX → 1 pilha com badge x2
    expect(screen.getAllByLabelText("EX Resource — sai de jogo se gasto")).toHaveLength(1);
    expect(screen.getByText("x2")).toBeInTheDocument();
  });

  it("Frente 4 (docs/38 §3.3): sem badge quando a pilha tem 1 só; nunca há scroll horizontal", () => {
    const { container } = render(
      <ResourceMeter resources={[res("a"), res("b", { rested: true })]} level={2} />,
    );
    expect(screen.queryByText(/^x\d/)).toBeNull();
    expect(container.querySelector(".overflow-x-auto")).toBeNull();
  });
});
