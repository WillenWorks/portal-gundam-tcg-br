// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render } from "@testing-library/react";
import { CardDepartureAnimation, type DepartingCard } from "./CardDepartureAnimation";
import { sfx } from "../audio/soundEffects";

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function mockMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((q: string) => ({
      matches: reduced,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

const CARD: DepartingCard = {
  id: "unit-1-v5",
  origin: { x: 100, y: 200 },
  dest: { x: 400, y: 500 },
  cardW: 60,
  kind: "destroyed",
  code: "ST01-001",
  nameEn: "Gundam",
  cardType: "UNIT",
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("CardDepartureAnimation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("sem cartas, não renderiza nada", () => {
    const { container } = render(<CardDepartureAnimation cards={[]} onDone={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("Unit destruída: toca playExplosion e chama onDone(id) após a animação", () => {
    mockMatchMedia(false);
    const onDone = vi.fn();
    const explosionSpy = vi.spyOn(sfx, "playExplosion");
    const { container } = render(<CardDepartureAnimation cards={[CARD]} onDone={onDone} />);

    expect(container.querySelector(".sim-anim-depart-destroy")).not.toBeNull();
    expect(explosionSpy).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();

    advance(420);
    expect(onDone).toHaveBeenCalledWith(CARD.id);
  });

  it("descarte comum usa a classe de deslize liso (não a de destruição)", () => {
    mockMatchMedia(false);
    const discarded: DepartingCard = { ...CARD, id: "hand-1-v6", kind: "discarded" };
    const { container } = render(<CardDepartureAnimation cards={[discarded]} onDone={vi.fn()} />);
    expect(container.querySelector(".sim-anim-depart")).not.toBeNull();
    expect(container.querySelector(".sim-anim-depart-destroy")).toBeNull();
  });

  it("posiciona o clone na origem e calcula --dx/--dy até o destino", () => {
    mockMatchMedia(false);
    const { container } = render(<CardDepartureAnimation cards={[CARD]} onDone={vi.fn()} />);
    const ghost = container.firstElementChild?.firstElementChild as HTMLElement;
    expect(ghost.style.left).toBe("100px");
    expect(ghost.style.top).toBe("200px");
    expect(ghost.style.getPropertyValue("--dx")).toBe("300px");
    expect(ghost.style.getPropertyValue("--dy")).toBe("300px");
  });

  it("sem destino medido ainda, desliza pra baixo (nunca fica parado)", () => {
    mockMatchMedia(false);
    const noDest: DepartingCard = { ...CARD, id: "x-v1", dest: null };
    const { container } = render(<CardDepartureAnimation cards={[noDest]} onDone={vi.fn()} />);
    const ghost = container.querySelector(".sim-anim-depart-destroy") as HTMLElement;
    expect(ghost.style.getPropertyValue("--dx")).toBe("0px");
    expect(Number(ghost.style.getPropertyValue("--dy").replace("px", ""))).toBeGreaterThan(0);
  });

  it("várias cartas saem ao mesmo tempo, cada uma com seu próprio onDone", () => {
    mockMatchMedia(false);
    const onDone = vi.fn();
    const second: DepartingCard = { ...CARD, id: "unit-2-v5", kind: "discarded" };
    render(<CardDepartureAnimation cards={[CARD, second]} onDone={onDone} />);
    advance(420);
    expect(onDone).toHaveBeenCalledWith(CARD.id);
    expect(onDone).toHaveBeenCalledWith(second.id);
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  it("prefers-reduced-motion: sem animação, onDone quase imediato", () => {
    mockMatchMedia(true);
    const onDone = vi.fn();
    const { container } = render(<CardDepartureAnimation cards={[CARD]} onDone={onDone} />);
    expect(container.querySelector(".sim-anim-depart-destroy")).toBeNull();
    expect(onDone).toHaveBeenCalledWith(CARD.id);
  });
});
