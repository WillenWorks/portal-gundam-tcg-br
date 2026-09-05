// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
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

function hand(entries: HandFanCard[], props: Partial<Parameters<typeof HandFan>[0]> = {}) {
  return render(<HandFan cards={entries} art={{}} onPeek={vi.fn()} {...props} />);
}

const containers = () => Array.from(document.querySelectorAll("[data-playable]")) as HTMLElement[];

describe("HandFan", () => {
  it("renderiza um container por entrada", () => {
    hand([
      { card: unit("Gundam"), playable: true },
      { card: unit("Zaku"), playable: true },
      { card: command("Kai's Reckless Fire"), playable: false, blockedReason: "Fora da fase principal." },
    ]);
    expect(containers()).toHaveLength(3);
  });

  it("carta injogável fica em P&B (só a arte) e sem brilho; jogável ganha o brilho ciano", () => {
    hand([
      { card: unit("Gundam"), playable: true },
      { card: unit("Guncannon"), playable: false, blockedReason: "Recursos insuficientes." },
    ]);
    const [playable, blocked] = containers();
    expect(playable.dataset.playable).toBe("true");
    expect(playable.className).toContain("border-primary");
    expect(playable.className).toContain("shadow-[0_0_12px_rgba(6,182,212,0.5)]");
    expect(blocked.dataset.playable).toBe("false");
    expect(blocked.getAttribute("title")).toBe("Recursos insuficientes.");
    expect(blocked.className).not.toContain("border-primary");
    // o filtro P&B mudou pra um wrapper interno (pra não esmaecer os botões do canto)
    expect(blocked.querySelector('[class*="grayscale"]')).not.toBeNull();
  });

  it('Frente 4 (docs/38 §3.1): sem botão de olho — "Jogar" só quando jogável, inspeção no corpo da carta', () => {
    const onPeek = vi.fn();
    const onInspect = vi.fn();
    const zaku = unit("Zaku II");
    render(
      <HandFan
        cards={[
          { card: zaku, playable: true },
          { card: unit("Guncannon"), playable: false, blockedReason: "Sem recurso." },
        ]}
        art={{}}
        onPeek={onPeek}
        onInspect={onInspect}
      />,
    );
    const jogar = screen.getByRole("button", { name: /Jogar Zaku II/ });
    const verZaku = screen.getByRole("button", { name: /^Ver Zaku II/ });
    // o cluster de canto tem só "Jogar" (não "Ver")
    const strip = jogar.closest("div")!;
    expect(Array.from(strip.children)).toEqual([jogar]);
    // injogável: sem "Jogar", mas o corpo ainda é "Ver"
    expect(screen.getByRole("button", { name: /^Ver Guncannon/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Jogar Guncannon/ })).toBeNull();

    jogar.click();
    expect(onPeek).toHaveBeenCalledWith(zaku);
    verZaku.click();
    expect(onInspect).toHaveBeenCalledWith(zaku);
  });

  it("Frente 4: o corpo da carta é o alvo de inspeção (Jogar no canto + Ver no corpo)", () => {
    hand([{ card: unit("Gundam"), playable: true }], { onInspect: vi.fn() });
    const names = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(names.some((n) => n?.startsWith("Jogar Gundam"))).toBe(true);
    expect(names.some((n) => n?.startsWith("Ver Gundam"))).toBe(true);
    expect(names).toHaveLength(2);
  });

  it("mão pequena fica ESPAÇADA (gap real, nunca sobreposta); mão grande aperta (overlap de verdade)", () => {
    // V6.4 (docs/36) — bug real (Willen: "espaçar mais os cards na mão,
    // para não agrupar demais mesmo quando tem apenas 6 cartas"): mão
    // pequena agora usa margem POSITIVA (gap), não só "pouco overlap"
    // negativo — o multiplicador do `calc()` muda de sinal conforme o
    // tamanho da mão, por isso a extração via regex captura o número com
    // sinal (`-?`) em vez de assumir sempre negativo.
    const marginMultiplier = () => {
      const match = containers()[1].style.marginLeft.match(/\*\s*(-?[\d.]+)\)/);
      return match ? Number(match[1]) : NaN;
    };
    const { rerender } = render(
      <HandFan cards={[unit("A"), unit("B"), unit("C")].map((c) => ({ card: c, playable: true }))} art={{}} onPeek={vi.fn()} />,
    );
    const small = marginMultiplier();
    expect(small).toBeGreaterThan(0); // gap real, não sobreposição

    rerender(
      <HandFan
        cards={Array.from({ length: 12 }, (_, i) => ({ card: unit(`C${i}`), playable: true }))}
        art={{}}
        onPeek={vi.fn()}
      />,
    );
    const big = marginMultiplier();
    expect(big).toBeLessThan(0); // mão grande aperta de verdade (overlap negativo)
    expect(big).toBeLessThan(small);
  });

  it("mão vazia mostra o emptyLabel e nenhum botão", () => {
    render(<HandFan cards={[]} art={{}} onPeek={vi.fn()} emptyLabel="Nada na mão." />);
    expect(screen.getByText("Nada na mão.")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("pip de custo aparece pra cartas com custo", () => {
    hand([{ card: unit("Gundam", { cost: 7 }), playable: true }]);
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("carta Unit mostra a faixa AP/HP", () => {
    hand([{ card: unit("Gundam", { ap: 5, hp: 6 }), playable: true }]);
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
  });

  it("modo anchored: lift de -1.5rem no hover/foco", () => {
    hand([{ card: unit("Gundam"), playable: true }], { anchored: true });
    const [c] = containers();
    expect(c.className).toMatch(/hover:-translate-y-6/);
    expect(c.className).toMatch(/focus-within:-translate-y-6/);
  });

  it("onHoverCard dispara com a carta no mouseenter e null no mouseleave", () => {
    const onHoverCard = vi.fn();
    const gundam = unit("Gundam");
    hand([{ card: gundam, playable: true }], { onHoverCard });
    const [c] = containers();
    fireEvent.mouseEnter(c);
    expect(onHoverCard).toHaveBeenLastCalledWith(gundam);
    fireEvent.mouseLeave(c);
    expect(onHoverCard).toHaveBeenLastCalledWith(null);
  });
});
