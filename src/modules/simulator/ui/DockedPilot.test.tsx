// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { CardDef, CardInstance } from "@/modules/simulator/engine/types";
import { DockedPilot } from "./DockedPilot";

afterEach(cleanup);

let seq = 0;
function inst(def: Partial<CardDef> & Pick<CardDef, "nameEn" | "cardType">, over: Partial<CardInstance> = {}): CardInstance {
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

const gundam = (over: Partial<CardDef> = {}) =>
  inst({ nameEn: "Gundam", cardType: "UNIT", ap: 3, hp: 4, link: { kind: "pilotName", values: ["Amuro"] }, ...over });
const amuro = () => inst({ nameEn: "Amuro Ray", cardType: "PILOT", ap: 2, hp: 1 });

describe("DockedPilot", () => {
  it("Frente 4 (feedback Willen 4ª rodada): NÃO renderiza nenhum número de bônus (+2/+1)", () => {
    render(<DockedPilot pilot={amuro()} unit={gundam()} art={{}} />);
    const chip = screen.getByRole("button", { name: /Amuro Ray/ });
    expect(chip.textContent ?? "").not.toMatch(/\d/);
    expect(chip.textContent ?? "").not.toMatch(/\+/);
  });

  it("Link ativo: tira ganha o realce âmbar; pareado sem link fica neutro", () => {
    const { rerender } = render(<DockedPilot pilot={amuro()} unit={gundam()} art={{}} />);
    expect(screen.getByRole("button", { name: /Link ativo/ }).className).toMatch(/amber/);

    rerender(<DockedPilot pilot={amuro()} unit={gundam({ link: { kind: "pilotName", values: ["Char"] } })} art={{}} />);
    const chip = screen.getByRole("button", { name: /pareado/ });
    expect(chip.className).not.toMatch(/amber/);
  });

  it("clique dispara onInspect com a carta do piloto", () => {
    const onInspect = vi.fn();
    const pilot = amuro();
    render(<DockedPilot pilot={pilot} unit={gundam()} art={{}} onInspect={onInspect} />);
    screen.getByRole("button", { name: /Amuro Ray/ }).click();
    expect(onInspect).toHaveBeenCalledWith(pilot);
  });
});
