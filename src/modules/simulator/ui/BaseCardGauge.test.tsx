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
    expect(screen.getByRole("button", { name: /2\/3 HP/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1 de dano/ })).toBeInTheDocument();
    expect(screen.queryByText("2/3")).toBeNull();
  });

  it("dano > 0 mostra o badge -N sobreposto", () => {
    render(<BaseCardGauge base={base({ damage: 2 })} art={{}} />);
    expect(screen.getByText("-2")).toBeInTheDocument();
  });

  it("onHoverCard dispara com a Base no hover e null ao sair", () => {
    const onHoverCard = vi.fn();
    const b = base();
    render(<BaseCardGauge base={b} art={{}} onHoverCard={onHoverCard} onInspect={vi.fn()} />);
    const btn = screen.getByRole("button");
    fireEvent.mouseEnter(btn);
    expect(onHoverCard).toHaveBeenLastCalledWith(b);
    fireEvent.mouseLeave(btn);
    expect(onHoverCard).toHaveBeenLastCalledWith(null);
  });
});
