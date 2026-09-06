// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CardDef, CardInstance } from "@/modules/simulator/engine/types";
import { BaseCardGauge } from "./BaseCardGauge";

afterEach(cleanup);

let seq = 0;
function inst(def: Partial<CardDef> & Pick<CardDef, "nameEn" | "cardType">, over: Partial<CardInstance> = {}): CardInstance {
  return {
    instanceId: `inst-${seq++}`,
    def: { code: def.nameEn.toUpperCase().replace(/\s+/g, "-"), color: "blue", ...def },
    owner: "A",
    zone: "baseSection",
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: 0,
    ...over,
  };
}

const base = (over: Partial<CardInstance> = {}) => inst({ nameEn: "EX Base", cardType: "BASE", hp: 3 }, over);

describe("BaseCardGauge", () => {
  it("sem base: placeholder só com tooltip (sem texto na tela)", () => {
    render(<BaseCardGauge base={null} art={{}} />);
    expect(screen.getByTitle("Base: nenhuma em jogo")).toBeInTheDocument();
    expect(screen.queryByText(/sem base/i)).toBeNull();
  });

  it("com base: HP restante/máximo e dano só no aria-label/title (sem rótulo)", () => {
    render(<BaseCardGauge base={base({ damage: 1 })} art={{}} />);
    expect(screen.getByTitle(/2\/3 HP/)).toBeInTheDocument();
    expect(screen.getByTitle(/1 de dano/)).toBeInTheDocument();
    expect(screen.queryByText("2/3")).toBeNull();
  });

  it("Frente 4 (docs/38 §3.2): dano acumulado fica no canto INFERIOR direito, badge preto translúcido mono", () => {
    render(<BaseCardGauge base={base({ damage: 2 })} art={{}} />);
    const badge = screen.getByText("-2");
    expect(badge.className).toMatch(/bottom-2/);
    expect(badge.className).toMatch(/right-0/);
    expect(badge.className).toMatch(/font-mono/);
    expect(badge).toHaveStyle({ backgroundColor: "rgba(0, 0, 0, 0.85)" });
    expect(badge.className).not.toMatch(/top-0/);
  });

  it("onHoverCard dispara com a Base no hover do container e null ao sair", () => {
    const onHoverCard = vi.fn();
    const b = base();
    const { container } = render(<BaseCardGauge base={b} art={{}} onHoverCard={onHoverCard} onInspect={vi.fn()} />);
    const wrapper = container.firstElementChild as HTMLElement;
    fireEvent.mouseEnter(wrapper);
    expect(onHoverCard).toHaveBeenLastCalledWith(b);
    fireEvent.mouseLeave(wrapper);
    expect(onHoverCard).toHaveBeenLastCalledWith(null);
  });

  it('Frente 4 (docs/38 §3.1): sem botão de "olho" — o corpo da carta vira o alvo de inspeção', () => {
    render(<BaseCardGauge base={base()} art={{}} onInspect={vi.fn()} />);
    // não existe mais um <button> "Ver" no cluster de canto
    expect(screen.queryByRole("button", { name: "Ativar habilidade" })).toBeNull();
    // o corpo da carta é o botão de inspeção
    expect(screen.getByRole("button", { name: /^Ver / })).toBeInTheDocument();
  });

  it("Frente 4: clicar no corpo da carta (fora de seleção de alvo) dispara onInspect", () => {
    const onInspect = vi.fn();
    const b = base();
    render(<BaseCardGauge base={b} art={{}} onInspect={onInspect} />);
    screen.getByRole("button", { name: /^Ver / }).click();
    expect(onInspect).toHaveBeenCalledWith(b);
  });

  it("bug real: `onActivate` mostra o botão \"Ativar habilidade\" (ex.: White Base) e dispara SÓ onActivate, nunca a inspeção", () => {
    const onActivate = vi.fn();
    const onInspect = vi.fn();
    const b = base();
    render(<BaseCardGauge base={b} art={{}} onInspect={onInspect} onActivate={onActivate} />);
    screen.getByRole("button", { name: "Ativar habilidade" }).click();
    expect(onActivate).toHaveBeenCalledWith(b);
    expect(onInspect).not.toHaveBeenCalled();
  });

  it("`busy` desabilita o botão Ativar", () => {
    render(<BaseCardGauge base={base()} art={{}} onActivate={vi.fn()} busy />);
    expect(screen.getByRole("button", { name: "Ativar habilidade" })).toBeDisabled();
  });

  it("Frente 4: como ALVO LEGAL o corpo seleciona (não inspeciona)", () => {
    const onInspect = vi.fn();
    const onSelect = vi.fn();
    const b = base();
    render(<BaseCardGauge base={b} art={{}} legalTarget onInspect={onInspect} onSelect={onSelect} />);
    const body = document.querySelector('[role="button"][tabindex="0"]') as HTMLElement;
    body.click();
    expect(onSelect).toHaveBeenCalledWith(b);
    expect(onInspect).not.toHaveBeenCalled();
  });
});
