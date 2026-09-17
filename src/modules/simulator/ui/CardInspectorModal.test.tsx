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
    const btn = screen.getByRole("button", { name: "Abrir detalhes" });
    const root = btn.closest(".fixed")!;
    let el: HTMLElement | null = btn.parentElement;
    while (el && el !== root) {
      expect(el.className).not.toMatch(/overflow-hidden/);
      el = el.parentElement;
    }
  });

  it("mostra keyword de StaticAbility como badge (Sinanju/GD01-001, deferred.ts fechado — inspetor só lia keywordTags/effectKeywords)", () => {
    render(
      <CardInspectorModal
        card={card({
          nameEn: "Sinanju",
          cardType: "UNIT",
          staticAbilities: [{ condition: "duringPair", scope: "self", keyword: "High-Maneuver" }],
        })}
        art={{}}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Abrir detalhes" }));
    expect(screen.getByText("High-Maneuver (During Pair)")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Abrir detalhes" }));
    expect(screen.getByText("Custo")).toBeInTheDocument();
    expect(screen.getByText("Nível")).toBeInTheDocument();
    expect(screen.getByText(/Zeon/)).toBeInTheDocument();
    expect(screen.getByText("Ao entrar: compre 1 carta.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes" }));
    expect(screen.queryByText("Custo")).toBeNull();
  });

  it("efeito: mostra effectPt por padrão e alterna pro EN pelo toggle", () => {
    render(
      <CardInspectorModal
        card={card({ nameEn: "Zaku", cardType: "UNIT" })}
        art={{}}
        onClose={vi.fn()}
        effectPt="【Deploy】Compre 1 carta."
        effectEn="【Deploy】Draw 1."
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Abrir detalhes" }));
    expect(screen.getByText("【Deploy】Compre 1 carta.")).toBeInTheDocument();
    expect(screen.queryByText("【Deploy】Draw 1.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "en" }));
    expect(screen.getByText("【Deploy】Draw 1.")).toBeInTheDocument();
    expect(screen.queryByText("【Deploy】Compre 1 carta.")).toBeNull();
  });

  it("efeito: sem effectPt, cai no effectText (compat) e não mostra toggle", () => {
    render(
      <CardInspectorModal
        card={card({ nameEn: "Zaku", cardType: "UNIT" })}
        art={{}}
        onClose={vi.fn()}
        effectText="【Deploy】Draw 1."
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Abrir detalhes" }));
    expect(screen.getByText("【Deploy】Draw 1.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "en" })).toBeNull();
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

  it("Frente 4 (feedback Willen 3ª rodada): Command NÃO mostra AP/HP (nem 0)", () => {
    render(
      <CardInspectorModal card={card({ nameEn: "Kai's Resolve", cardType: "COMMAND", cost: 1 })} art={{}} onClose={vi.fn()} inPlay />,
    );
    expect(screen.queryByText(/^AP/)).toBeNull();
    expect(screen.queryByText(/^HP/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Abrir detalhes" }));
    expect(screen.queryByText(/^AP/)).toBeNull();
    expect(screen.queryByText(/^HP/)).toBeNull();
    expect(screen.getByText("Custo")).toBeInTheDocument();
  });

  it("Frente 4: Base mostra só HP (sem AP)", () => {
    render(
      <CardInspectorModal card={card({ nameEn: "White Base", cardType: "BASE", hp: 5 }, { zone: "baseSection" })} art={{}} onClose={vi.fn()} inPlay />,
    );
    expect(screen.getByText("HP 5")).toBeInTheDocument();
    expect(screen.queryByText(/^AP /)).toBeNull();
  });

  it("Frente 4: Pilot mostra o modificador impresso como (mod) +X", () => {
    render(
      <CardInspectorModal card={card({ nameEn: "Amuro Ray", cardType: "PILOT", ap: 2, hp: 1 })} art={{}} onClose={vi.fn()} inPlay />,
    );
    expect(screen.getByText(/AP \(mod\)/)).toBeInTheDocument();
    expect(screen.getByText(/\+2/)).toBeInTheDocument();
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

  it("ST05 Barbatos: renderiza arte, efeito pt-BR por padrão e popover com retrato de Mikazuki Augus", () => {
    render(
      <CardInspectorModal
        card={card({
          code: "ST05-001",
          nameEn: "Gundam Barbatos 4th Form",
          cardType: "UNIT",
          link: { kind: "pilotName", values: ["Mikazuki Augus"] },
        })}
        art={{
          "ST05-001": { imageUrl: "https://tcgplayer-cdn.com/barbatos.jpg" },
        }}
        onClose={vi.fn()}
        effectPt="【Deploy】Você pode colocar 1 carta da sua mão no topo do seu deck."
        effectEn="【Deploy】You may place 1 card from your hand on top of your deck."
        linkedPilots={[
          {
            name: "Mikazuki Augus",
            art: { imageUrl: "https://tcgplayer-cdn.com/mikazuki.jpg" },
            note: "Disponível na sua mão",
          },
        ]}
      />,
    );

    // Arte grande carregada
    const barbatosImg = screen.getByRole("img", { name: "Gundam Barbatos 4th Form" });
    expect(barbatosImg).toHaveAttribute("src", "https://tcgplayer-cdn.com/barbatos.jpg");

    // Popover de link com retrato de Mikazuki
    expect(screen.getByText("Mikazuki Augus")).toBeInTheDocument();
    expect(screen.getByText("Disponível na sua mão")).toBeInTheDocument();
    const mikazukiImg = screen.getByRole("img", { name: "Mikazuki Augus" });
    expect(mikazukiImg).toHaveAttribute("src", "https://tcgplayer-cdn.com/mikazuki.jpg");

    // Telemetria com efeito pt-BR por padrão
    fireEvent.click(screen.getByRole("button", { name: "Abrir detalhes" }));
    expect(screen.getByText(/Você pode colocar 1 carta/)).toBeInTheDocument();

    // Toggle pt/en funcional
    fireEvent.click(screen.getByRole("button", { name: "en" }));
    expect(screen.getByText(/You may place 1 card/)).toBeInTheDocument();
  });

  it("GD01 Loto (vanilla): não exibe bloco de efeito nem toggle, mantendo o painel de telemetria limpo", () => {
    render(
      <CardInspectorModal
        card={card({
          code: "GD01-011",
          nameEn: "Loto",
          cardType: "UNIT",
          cost: 1,
          level: 1,
          ap: 1,
          hp: 2,
          traits: ["Earth Federation"],
        })}
        art={{
          "GD01-011": { imageUrl: "https://tcgplayer-cdn.com/loto.jpg" },
        }}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir detalhes" }));
    expect(screen.getByText("Custo")).toBeInTheDocument();
    expect(screen.getByText("Nível")).toBeInTheDocument();
    expect(screen.getByText(/Earth Federation/)).toBeInTheDocument();
    // Nenhum bloco de efeito ou toggle de idioma
    expect(screen.queryByText("Efeito")).toBeNull();
    expect(screen.queryByRole("button", { name: "en" })).toBeNull();
    expect(screen.queryByRole("button", { name: "pt" })).toBeNull();
  });

  it("inPlay: computa AP/HP dinâmicos com dano acumulado e bônus ativos", () => {
    render(
      <CardInspectorModal
        card={card(
          { code: "GD01-065", nameEn: "Freedom Gundam", cardType: "UNIT", ap: 5, hp: 5 },
          { damage: 2, statModifiers: [{ stat: "ap", amount: 2, duration: "permanent", appliedOnTurn: 1 }] },
        )}
        art={{}}
        onClose={vi.fn()}
        inPlay
      />,
    );

    // Barra inferior inPlay: AP 7 (5 base + 2 buff) e HP 3 (5 base - 2 dano)
    expect(screen.getByText("AP 7")).toBeInTheDocument();
    expect(screen.getByText("HP 3")).toBeInTheDocument();

    // Na gaveta de telemetria, lista o bônus "Ativo agora"
    fireEvent.click(screen.getByRole("button", { name: "Abrir detalhes" }));
    expect(screen.getByText("Ativo agora")).toBeInTheDocument();
    expect(screen.getByText("AP +2")).toBeInTheDocument();
  });
});
