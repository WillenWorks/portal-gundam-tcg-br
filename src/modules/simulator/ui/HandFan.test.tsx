// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CardDef, CardInstance } from "@/modules/simulator/engine/types";
import { HandFan, type HandFanCard } from "./HandFan";

afterEach(cleanup);

let seq = 0;
function card(def: Partial<CardDef> & Pick<CardDef, "nameEn" | "cardType">): CardInstance {
  return {
    instanceId: `inst-${seq++}`,
    def: { code: def.nameEn.toUpperCase().replace(/\s+/g, "-"), color: "blue", ...def },
    owner: "A",
    zone: "hand",
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: 0,
  };
}

const unit = (nameEn: string, over: Partial<CardDef> = {}) =>
  card({ nameEn, cardType: "UNIT", cost: 2, ap: 3, hp: 4, ...over });
const command = (nameEn: string, over: Partial<CardDef> = {}) =>
  card({ nameEn, cardType: "COMMAND", cost: 1, ...over });

function hand(entries: HandFanCard[]) {
  return render(<HandFan cards={entries} art={{}} onPeek={vi.fn()} />);
}

describe("HandFan", () => {
  it("renderiza uma carta (botão) por entrada", () => {
    hand([
      { card: unit("Gundam"), playable: true },
      { card: unit("Zaku"), playable: true },
      { card: command("Kai's Reckless Fire"), playable: false, blockedReason: "Fora da fase principal." },
    ]);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("carta injogável fica dimmed (grayscale) e expõe o motivo", () => {
    const { container } = hand([
      { card: unit("Gundam"), playable: true },
      { card: unit("Guncannon"), playable: false, blockedReason: "Recursos insuficientes." },
    ]);

    const blocked = screen.getByRole("button", { name: /Guncannon/ });
    expect(blocked.getAttribute("data-playable")).toBe("false");
    expect(blocked.getAttribute("title")).toBe("Recursos insuficientes.");
    expect(blocked.getAttribute("aria-label")).toContain("Recursos insuficientes.");
    expect(blocked.className).not.toContain("border-primary");

    const playable = screen.getByRole("button", { name: /Gundam/ });
    expect(playable.getAttribute("data-playable")).toBe("true");
    expect(playable.className).toContain("border-primary");

    // CardFace aplica `grayscale` só na carta marcada como dimmed.
    expect(container.querySelectorAll(".grayscale")).toHaveLength(1);
  });

  it("clique chama onPeek com a carta certa", () => {
    const onPeek = vi.fn();
    const zaku = unit("Zaku II");
    render(
      <HandFan
        cards={[
          { card: unit("Gundam"), playable: true },
          { card: zaku, playable: false, blockedReason: "Sem gatilho." },
        ]}
        art={{}}
        onPeek={onPeek}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Zaku II/ }));
    expect(onPeek).toHaveBeenCalledTimes(1);
    expect(onPeek).toHaveBeenCalledWith(zaku);
  });

  it("mão vazia mostra o emptyLabel", () => {
    render(<HandFan cards={[]} art={{}} onPeek={vi.fn()} emptyLabel="Nada na mão." />);
    expect(screen.getByText("Nada na mão.")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("mão vazia usa o texto padrão quando emptyLabel não é passado", () => {
    render(<HandFan cards={[]} art={{}} onPeek={vi.fn()} />);
    expect(screen.getByText("Mão vazia.")).toBeTruthy();
  });

  it("pip de custo aparece pra cartas com custo", () => {
    hand([
      { card: unit("Gundam", { cost: 7 }), playable: true },
      { card: card({ nameEn: "EX Resource", cardType: "RESOURCE" }), playable: false, blockedReason: "—" },
    ]);
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("carta Unit mostra a faixa AP/HP na base", () => {
    hand([{ card: unit("Gundam", { ap: 5, hp: 6 }), playable: true }]);
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
  });
});
