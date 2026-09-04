// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { CardDef, CardInstance } from "@/modules/simulator/engine/types";
import { CardInspectorPanel } from "./CardInspectorPanel";

afterEach(cleanup);

let seq = 0;
function card(def: Partial<CardDef> & Pick<CardDef, "nameEn" | "cardType">, over: Partial<CardInstance> = {}): CardInstance {
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

describe("CardInspectorPanel", () => {
  it("sem carta: mostra o estado de espera", () => {
    render(<CardInspectorPanel card={null} art={{}} />);
    expect(screen.getByText("Sensor Tático em Espera")).toBeInTheDocument();
  });

  it("com carta: mostra nome, código, tipo e AP/HP base", () => {
    render(<CardInspectorPanel card={card({ nameEn: "Gundam", cardType: "UNIT", cost: 3, level: 4, ap: 5, hp: 4 })} art={{}} />);
    expect(screen.getByText(/GUNDAM · UNIT · blue/)).toBeInTheDocument();
    expect(screen.getByText("AP")).toBeInTheDocument();
    expect(screen.getByText("HP")).toBeInTheDocument();
    expect(screen.getByText("Nível")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("inPlay com statModifier: exibe o bloco 'Ativo agora' com o buff", () => {
    const buffed = card(
      { nameEn: "Zaku", cardType: "UNIT", ap: 2, hp: 2 },
      { statModifiers: [{ stat: "ap", amount: 2, duration: "permanent", appliedOnTurn: 1 }] },
    );
    render(<CardInspectorPanel card={buffed} art={{}} inPlay />);
    expect(screen.getByText("Ativo agora")).toBeInTheDocument();
    expect(screen.getByText("AP +2")).toBeInTheDocument();
  });

  it("blockedReason aparece em âmbar", () => {
    render(
      <CardInspectorPanel
        card={card({ nameEn: "Guncannon", cardType: "UNIT", cost: 5 })}
        art={{}}
        blockedReason="Recursos insuficientes."
      />,
    );
    expect(screen.getByText("Recursos insuficientes.")).toBeInTheDocument();
  });
});
