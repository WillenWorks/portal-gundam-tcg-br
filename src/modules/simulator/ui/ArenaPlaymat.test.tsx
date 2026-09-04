// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ArenaPlaymat, type ArenaSide } from "./ArenaPlaymat";

afterEach(cleanup);

function side(tag: string): ArenaSide {
  return {
    shields: <div>{tag}-shields</div>,
    base: <div>{tag}-base</div>,
    resources: <div>{tag}-resources</div>,
    deck: <div>{tag}-deck</div>,
    trash: <div>{tag}-trash</div>,
    exile: <div>{tag}-exile</div>,
    battleRow: Array.from({ length: 6 }, (_, i) => <div key={i} data-testid={`${tag}-slot`} />),
    handSummary: tag === "opp" ? <div>{tag}-hand</div> : undefined,
  };
}

function renderArena(extra?: Partial<Parameters<typeof ArenaPlaymat>[0]>) {
  return render(
    <ArenaPlaymat
      opponent={side("opp")}
      self={side("me")}
      hand={<div>hand-fan</div>}
      {...extra}
    />,
  );
}

describe("ArenaPlaymat", () => {
  it("renderiza todas as zonas dos dois lados + o rodapé da mão", () => {
    renderArena();
    for (const tag of ["opp", "me"]) {
      for (const zone of ["shields", "base", "resources", "deck", "trash", "exile"]) {
        expect(screen.getByText(`${tag}-${zone}`)).toBeInTheDocument();
      }
    }
    expect(screen.getByText("opp-hand")).toBeInTheDocument();
    expect(screen.getByText("hand-fan")).toBeInTheDocument();
  });

  it("cada Battle Area tem 6 slots", () => {
    renderArena();
    expect(screen.getAllByTestId("opp-slot")).toHaveLength(6);
    expect(screen.getAllByTestId("me-slot")).toHaveLength(6);
  });

  it("trava a proporção 16:9 e define a escala --card-w no canvas", () => {
    const { container } = renderArena();
    const canvas = container.firstElementChild as HTMLElement;
    expect(canvas.className).toMatch(/aspect-\[16\/9\]/);
    expect(canvas.style.getPropertyValue("--card-w")).toBe("clamp(3.5rem, 6.5vw, 6.2rem)");
  });

  it("overlay é renderizado sobre o canvas quando informado", () => {
    renderArena({ overlay: <div>mira-lane</div> });
    expect(screen.getByText("mira-lane")).toBeInTheDocument();
  });

  const before = (a: string, b: string) =>
    Boolean(screen.getByText(a).compareDocumentPosition(screen.getByText(b)) & Node.DOCUMENT_POSITION_FOLLOWING);

  it("espelha o oponente: coluna Deck à esquerda / Base+Shields à direita; jogador o inverso", () => {
    renderArena();
    // oponente (topo): [Deck/Trash/Exílio] ... [Base/Shields]
    expect(before("opp-deck", "opp-resources")).toBe(true);
    expect(before("opp-resources", "opp-shields")).toBe(true);
    // jogador (base): [Base/Shields] ... [Deck/Trash/Exílio]
    expect(before("me-shields", "me-resources")).toBe(true);
    expect(before("me-resources", "me-deck")).toBe(true);
  });

  it("DeckStation do jogador empilha Exílio → Trash → Deck", () => {
    renderArena();
    expect(before("me-exile", "me-trash")).toBe(true);
    expect(before("me-trash", "me-deck")).toBe(true);
  });

  it("ShieldStation do jogador: Base no topo, Shields logo abaixo", () => {
    renderArena();
    expect(before("me-base", "me-shields")).toBe(true);
  });

  it("oponente é o playmat girado 180°: DeckStation empilha Deck → Trash → Exílio", () => {
    renderArena();
    expect(before("opp-deck", "opp-trash")).toBe(true);
    expect(before("opp-trash", "opp-exile")).toBe(true);
  });

  it("oponente girado 180°: ShieldStation empilha Shields → Base (base encostada na seam)", () => {
    renderArena();
    expect(before("opp-shields", "opp-base")).toBe(true);
  });

  it("recursos do oponente vão pro TOPO (antes da Battle Area dele)", () => {
    renderArena();
    expect(before("opp-resources", "opp-base")).toBe(true);
  });

  it("recursos ficam COLADOS à Battle Area (oponente acima, jogador abaixo)", () => {
    renderArena();
    const slot = (tag: string) => screen.getAllByTestId(`${tag}-slot`)[0];
    // oponente: recursos ANTES dos slots
    expect(
      Boolean(screen.getByText("opp-resources").compareDocumentPosition(slot("opp")) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    // jogador: slots ANTES dos recursos
    expect(
      Boolean(slot("me").compareDocumentPosition(screen.getByText("me-resources")) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });

  it("recursos e Battle Area são irmãos ADJACENTES no teatro (sem nó de padding no meio)", () => {
    renderArena();
    for (const tag of ["opp", "me"] as const) {
      // wrapper do slot dos recursos e o grid da Battle Area
      const resWrapper = screen.getByText(`${tag}-resources`).parentElement!;
      const grid = screen.getAllByTestId(`${tag}-slot`)[0].parentElement!;
      expect(resWrapper.parentElement).toBe(grid.parentElement); // mesmo container (o teatro)
      const kids = Array.from(resWrapper.parentElement!.children);
      expect(Math.abs(kids.indexOf(resWrapper) - kids.indexOf(grid))).toBe(1); // adjacentes
    }
  });

  it("colunas laterais têm largura explícita comum (Base/Shields e pilhas alinham)", () => {
    renderArena();
    const shieldStation = screen.getByText("me-base").parentElement!;
    const deckStation = screen.getByText("me-deck").parentElement!;
    expect(shieldStation.className).toMatch(/w-\[calc\(var\(--card/);
    expect(deckStation.className).toMatch(/w-\[calc\(var\(--card/);
  });

  it("aplica a perspectiva 3D no canvas", () => {
    const { container } = renderArena();
    expect((container.firstElementChild as HTMLElement).style.perspective).toBe("1200px");
  });

  it("battleAreaRef recebe o elemento do grid de slots", () => {
    const refs: (HTMLElement | null)[] = [];
    const withRef: ArenaSide = { ...side("me"), battleAreaRef: (el) => refs.push(el) };
    render(<ArenaPlaymat opponent={side("opp")} self={withRef} hand={<div>h</div>} />);
    expect(refs.some((el) => el instanceof HTMLElement)).toBe(true);
  });
});
