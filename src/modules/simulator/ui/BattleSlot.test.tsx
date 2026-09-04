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

  it("ações de campo: tira escondida no canto sup. direito (float-right), aparece no hover", () => {
    const onAttack = vi.fn();
    render(<BattleSlot unit={unit()} pilot={null} art={{}} actions={{ onAttack }} />);
    const btn = screen.getByRole("button", { name: "Atacar" });
    const strip = btn.closest("div")!.className;
    expect(strip).toMatch(/absolute/);
    expect(strip).toMatch(/-top-2/);
    expect(strip).toMatch(/right-0/);
    expect(strip).toMatch(/flex-row-reverse/); // Atacar no canto, ativações à esquerda
    expect(strip).toMatch(/z-30/);
    expect(strip).toMatch(/opacity-0/); // escondida em repouso
    expect(strip).toMatch(/group-hover\/slot:opacity-100/); // aparece no hover
    expect(btn.className).toMatch(/size-6/);
    btn.click();
    expect(onAttack).toHaveBeenCalledTimes(1);
  });

  it("Atacar fica no canto (1º filho da tira row-reverse); ativação vem à esquerda", () => {
    render(<BattleSlot unit={unit()} pilot={null} art={{}} actions={{ onAttack: vi.fn(), onActivate: vi.fn() }} />);
    const strip = screen.getByRole("button", { name: "Atacar" }).closest("div")!;
    expect(strip.firstElementChild).toBe(screen.getByRole("button", { name: "Atacar" }));
  });

  it("clique numa ação NÃO borbulha pro handler de inspeção da carta", () => {
    const onAttack = vi.fn();
    const onInspect = vi.fn();
    render(<BattleSlot unit={unit()} pilot={null} art={{}} onInspect={onInspect} actions={{ onAttack }} />);
    screen.getByRole("button", { name: "Atacar" }).click();
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onInspect).not.toHaveBeenCalled();
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

  it("onHoverCard dispara com a Unit no hover e null ao sair", () => {
    const onHoverCard = vi.fn();
    const u = unit();
    render(<BattleSlot unit={u} pilot={null} art={{}} onHoverCard={onHoverCard} onInspect={vi.fn()} />);
    const face = screen.getAllByRole("button")[0];
    fireEvent.mouseEnter(face);
    expect(onHoverCard).toHaveBeenLastCalledWith(u);
    fireEvent.mouseLeave(face);
    expect(onHoverCard).toHaveBeenLastCalledWith(null);
  });
});
