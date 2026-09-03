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

  it("ações de combate: botão 'Atacar' com hit-area de 44px", () => {
    const onAttack = vi.fn();
    render(<BattleSlot unit={unit()} pilot={null} art={{}} actions={{ onAttack }} />);
    const btn = screen.getByRole("button", { name: "Atacar" });
    expect(btn.className).toMatch(/h-11/);
    btn.click();
    expect(onAttack).toHaveBeenCalledTimes(1);
  });

  it("piloto acoplado aparece na base do slot", () => {
    render(<BattleSlot unit={unit()} pilot={inst({ nameEn: "Amuro Ray", cardType: "PILOT", ap: 1, hp: 1 })} art={{}} />);
    expect(screen.getByText("Amuro Ray")).toBeInTheDocument();
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
