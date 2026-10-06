// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ZoneOverflowModal } from "./ZoneOverflowModal";
import type { CardInstance } from "@/modules/simulator/engine/types";

afterEach(cleanup);

function makeUnit(instanceId: string, nameEn: string, ap = 2, hp = 3): CardInstance {
  return {
    instanceId,
    owner: "A",
    zone: "battleArea",
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: 1,
    def: {
      code: `CODE-${instanceId}`,
      nameEn,
      cardType: "UNIT",
      color: "blue",
      ap,
      hp,
    },
  };
}

const mockUnits: CardInstance[] = [
  makeUnit("u1", "Unit 1", 2, 2),
  makeUnit("u2", "Unit 2", 3, 3),
  makeUnit("u3", "Unit 3", 4, 4),
  makeUnit("u4", "Unit 4", 5, 5),
  makeUnit("u5", "Unit 5", 1, 1),
  makeUnit("u6", "Unit 6", 2, 3),
  makeUnit("u7", "Unit 7", 3, 4),
];

describe("ZoneOverflowModal", () => {
  it("renderiza unidades elegíveis com AP/HP e permite selecionar qual vai pro trash", () => {
    const onResolve = vi.fn();
    render(<ZoneOverflowModal units={mockUnits} onResolve={onResolve} />);

    expect(screen.getByText(/Battle Area cheia/i)).toBeInTheDocument();
    expect(screen.getByText("Unit 1")).toBeInTheDocument();
    expect(screen.getByText("AP 2 / HP 2")).toBeInTheDocument();

    const unit3Btn = screen.getByRole("button", { name: /Unit 3/i });
    fireEvent.click(unit3Btn);

    expect(onResolve).toHaveBeenCalledWith("u3");
  });

  it("utiliza getEffectiveStats quando fornecido", () => {
    const onResolve = vi.fn();
    const getEffectiveStats = vi.fn((u: CardInstance) => ({ ap: (u.def.ap ?? 0) + 1, hp: (u.def.hp ?? 0) + 2 }));

    render(<ZoneOverflowModal units={mockUnits} onResolve={onResolve} getEffectiveStats={getEffectiveStats} />);

    expect(getEffectiveStats).toHaveBeenCalled();
    // Unit 1 original ap 2, hp 2 -> com getEffectiveStats vira AP 3 / HP 4
    expect(screen.getByText("AP 3 / HP 4")).toBeInTheDocument();
  });

  it("desabilita botões quando busy é true", () => {
    render(<ZoneOverflowModal units={mockUnits} busy onResolve={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
  });
});
