// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CardDef, CardInstance } from "@/modules/simulator/engine/types";
import { CardInspectorModal } from "./CardInspectorModal";

afterEach(cleanup);

let seq = 0;
function card(def: Partial<CardDef> & Pick<CardDef, "nameEn" | "cardType">, over: Partial<CardInstance> = {}): CardInstance {
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
    ...over,
  };
}

describe("CardInspectorModal", () => {
  it("mostra a arte grande da carta e fecha no backdrop", () => {
    const onClose = vi.fn();
    render(<CardInspectorModal card={card({ nameEn: "Gundam", cardType: "UNIT" })} art={{ GUNDAM: { imageUrl: "g.png" } }} onClose={onClose} />);
    const img = screen.getByRole("img", { name: "Gundam" });
    expect(img).toHaveAttribute("src", "g.png");
    fireEvent.click(img.closest(".fixed")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("o botão da gaveta NÃO fica sob nenhum ancestral com overflow-hidden (Sprint 6 · P4)", () => {
    render(<CardInspectorModal card={card({ nameEn: "Zaku", cardType: "UNIT" })} art={{}} onClose={vi.fn()} />);
    const btn = screen.getByRole("button", { name: "Abrir telemetria" });
    const root = btn.closest(".fixed")!;
    let el: HTMLElement | null = btn.parentElement;
    while (el && el !== root) {
      expect(el.className).not.toMatch(/overflow-hidden/);
      el = el.parentElement;
    }
  });

  it("a gaveta de telemetria abre/fecha pelo botão e lista os atributos", () => {
    render(
      <CardInspectorModal
        card={card({ nameEn: "Zaku", cardType: "UNIT", cost: 2, level: 3, ap: 3, hp: 4, traits: ["Zeon"] })}
        art={{}}
        onClose={vi.fn()}
        effectText="Ao entrar: compre 1 carta."
      />,
    );
    // fechada
    expect(screen.queryByText("Custo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Abrir telemetria" }));
    expect(screen.getByText("Custo")).toBeInTheDocument();
    expect(screen.getByText("Nível")).toBeInTheDocument();
    expect(screen.getByText(/Zeon/)).toBeInTheDocument();
    expect(screen.getByText("Ao entrar: compre 1 carta.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar telemetria" }));
    expect(screen.queryByText("Custo")).toBeNull();
  });

  it("link pilotName: mostra o nome do piloto + badge de disponibilidade", () => {
    render(
      <CardInspectorModal
        card={card({ nameEn: "Aerial", cardType: "UNIT", link: { kind: "pilotName", values: ["Suletta Mercury"] } })}
        art={{}}
        onClose={vi.fn()}
        linkedPilots={[{ name: "Suletta Mercury", art: { imageUrl: "s.png" }, note: "Disponível na sua mão" }]}
      />,
    );
    expect(screen.getByText("Suletta Mercury")).toBeInTheDocument();
    expect(screen.getByText("Disponível na sua mão")).toBeInTheDocument();
    // popover com a imagem do piloto
    expect(screen.getByRole("img", { name: "Suletta Mercury" })).toHaveAttribute("src", "s.png");
  });

  it("não mostra bloco de link quando a carta não tem link pilotName", () => {
    render(<CardInspectorModal card={card({ nameEn: "Command X", cardType: "COMMAND" })} art={{}} onClose={vi.fn()} linkedPilots={[{ name: "Ninguém" }]} />);
    expect(screen.queryByText("Ninguém")).toBeNull();
  });

  it("renderiza o footer de ações", () => {
    render(
      <CardInspectorModal
        card={card({ nameEn: "Gundam", cardType: "UNIT" })}
        art={{}}
        onClose={vi.fn()}
        footer={<button type="button">Jogar</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Jogar" })).toBeInTheDocument();
  });
});
