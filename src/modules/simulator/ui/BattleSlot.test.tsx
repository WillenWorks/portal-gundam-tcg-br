// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CardDef, CardInstance } from "@/modules/simulator/engine/types";
import { BattleSlot } from "./BattleSlot";

afterEach(cleanup);

let seq = 0;
function inst(
  def: Partial<CardDef> & Pick<CardDef, "nameEn" | "cardType">,
  over: Partial<CardInstance> = {},
): CardInstance {
  return {
    instanceId: `inst-${seq++}`,
    def: { code: def.nameEn.toUpperCase().replace(/\s+/g, "-"), color: "blue", ...def },
    owner: "A",
    zone: "battleArea",
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: 0,
    ...over,
  };
}

const unit = (over: Partial<CardDef> = {}, i: Partial<CardInstance> = {}) =>
  inst({ nameEn: "Gundam", cardType: "UNIT", ap: 3, hp: 4, ...over }, i);

describe("BattleSlot", () => {
  it("slot vazio: moldura de hangar ciano tracejada, sem botões", () => {
    const { container } = render(<BattleSlot unit={null} pilot={null} art={{}} />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.className).toMatch(/border-dashed/);
    expect(box.className).toMatch(/border-cyan-500\/20/);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("slot ocupado: badges de AP e HP em canto", () => {
    render(<BattleSlot unit={unit({ ap: 5, hp: 6 })} pilot={null} art={{}} />);
    expect(screen.getByLabelText("AP 5")).toBeInTheDocument();
    expect(screen.getByLabelText("HP 6")).toBeInTheDocument();
  });

  it("dano acumulado: HP restante + indicador -N", () => {
    render(<BattleSlot unit={unit({ ap: 3, hp: 5 }, { damage: 2 })} pilot={null} art={{}} />);
    expect(screen.getByLabelText("HP 3")).toBeInTheDocument();
    expect(screen.getByText("-2")).toBeInTheDocument();
  });

  it('cluster de canto: "Ver" SEMPRE presente; Atacar aparece à esquerda dele', () => {
    const onAttack = vi.fn();
    const onInspect = vi.fn();
    render(<BattleSlot unit={unit()} pilot={null} art={{}} onInspect={onInspect} actions={{ onAttack }} />);
    const strip = screen.getByRole("button", { name: "Atacar" }).closest("div")!;
    expect(strip.className).toMatch(/absolute/);
    expect(strip.className).toMatch(/-top-2/);
    expect(strip.className).toMatch(/right-0/);
    // ordem no DOM: [Atacar, Ver] → "Ver" encosta no canto direito
    const kids = Array.from(strip.children);
    expect(kids[0]).toBe(screen.getByRole("button", { name: "Atacar" }));
    expect(kids[1]).toBe(screen.getByRole("button", { name: /^Ver / }));
  });

  it('sem ação disponível, o cluster ainda tem "Ver"', () => {
    render(<BattleSlot unit={unit()} pilot={null} art={{}} onInspect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^Ver / })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Atacar" })).toBeNull();
  });

  it("clicar em Atacar dispara SÓ onAttack, nunca a inspeção (fim do conflito)", () => {
    const onAttack = vi.fn();
    const onInspect = vi.fn();
    render(<BattleSlot unit={unit()} pilot={null} art={{}} onInspect={onInspect} actions={{ onAttack }} />);
    screen.getByRole("button", { name: "Atacar" }).click();
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onInspect).not.toHaveBeenCalled();
  });

  it('"Ver" dispara onInspect', () => {
    const onInspect = vi.fn();
    const u = unit();
    render(<BattleSlot unit={u} pilot={null} art={{}} onInspect={onInspect} />);
    screen.getByRole("button", { name: /^Ver / }).click();
    expect(onInspect).toHaveBeenCalledWith(u);
  });

  it("corpo da carta só é clicável quando é alvo legal (não abre inspeção)", () => {
    const onInspect = vi.fn();
    const onSelect = vi.fn();
    const u = unit();
    const { rerender } = render(
      <BattleSlot unit={u} pilot={null} art={{}} onInspect={onInspect} onSelect={onSelect} />,
    );
    // sem legalTarget: corpo não tem role button
    expect(screen.queryByRole("button", { name: u.def.nameEn })).toBeNull();
    rerender(<BattleSlot unit={u} pilot={null} art={{}} legalTarget onInspect={onInspect} onSelect={onSelect} />);
    // com legalTarget: corpo vira botão de seleção
    const body = document.querySelector('[role="button"][tabindex="0"]') as HTMLElement;
    body.click();
    expect(onSelect).toHaveBeenCalledWith(u);
    expect(onInspect).not.toHaveBeenCalled();
  });

  it("sem badge 'BLK' na arte (blocker se mostra pelo botão de escudo)", () => {
    render(<BattleSlot unit={unit()} pilot={null} art={{}} onInspect={vi.fn()} />);
    expect(screen.queryByText("Blk")).toBeNull();
  });

  it("botões de ação são só ícone (não cobrem os números AP/HP)", () => {
    render(<BattleSlot unit={unit()} pilot={null} art={{}} actions={{ onAttack: vi.fn(), onBlocker: vi.fn() }} />);
    expect(screen.getByRole("button", { name: "Atacar" }).textContent).toBe("");
  });

  it("com ações disponíveis o slot NÃO expande: segue aspect-[63/88]", () => {
    const { container } = render(
      <BattleSlot unit={unit()} pilot={null} art={{}} actions={{ onAttack: vi.fn(), onBlocker: vi.fn() }} />,
    );
    expect((container.firstElementChild as HTMLElement).className).toMatch(/aspect-\[63\/88\]/);
    // o container de botões não faz parte do fluxo (é absolute)
    expect((container.firstElementChild as HTMLElement).className).not.toMatch(/flex-col/);
  });

  it("slot ocupado mantém a proporção estrita aspect-[63/88]", () => {
    const { container } = render(<BattleSlot unit={unit()} pilot={null} art={{}} />);
    expect((container.firstElementChild as HTMLElement).className).toMatch(/aspect-\[63\/88\]/);
  });

  it("piloto acoplado é overlay na base, com o nome no tooltip", () => {
    render(<BattleSlot unit={unit()} pilot={inst({ nameEn: "Amuro Ray", cardType: "PILOT", ap: 1, hp: 1 })} art={{}} />);
    expect(screen.getByRole("button", { name: /Amuro Ray/ }).className).toMatch(/absolute/);
  });

  it("onHoverCard dispara com a Unit no hover do slot e null ao sair", () => {
    const onHoverCard = vi.fn();
    const u = unit();
    const { container } = render(
      <BattleSlot unit={u} pilot={null} art={{}} onHoverCard={onHoverCard} onInspect={vi.fn()} />,
    );
    const slot = container.firstElementChild as HTMLElement;
    fireEvent.mouseEnter(slot);
    expect(onHoverCard).toHaveBeenLastCalledWith(u);
    fireEvent.mouseLeave(slot);
    expect(onHoverCard).toHaveBeenLastCalledWith(null);
  });
});
