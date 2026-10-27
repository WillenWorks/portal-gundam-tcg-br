// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CardTravel, centerCardWidth } from "./CardTravel";
import { SCENE_MS, drawMs } from "../scene/sceneTiming";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const card = { def: { code: "ST01-001", nameEn: "Gundam", cardType: "UNIT" } };

describe("CardTravel", () => {
  it("a minha compra passa pelo centro, vira à mostra e pousa; termina no tempo da cena", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(
      <CardTravel from={{ x: 100, y: 500 }} to={{ x: 600, y: 700 }} fromW={80} toW={60} card={card} art={{}} viaCenter timings={SCENE_MS.draw} totalMs={drawMs()} onDone={onDone} />,
    );
    act(() => vi.advanceTimersByTime(40));
    expect(screen.getByTestId("card-travel")).toHaveAttribute("data-phase", "center");
    act(() => vi.advanceTimersByTime(SCENE_MS.draw.rise));
    expect(screen.getByTestId("card-travel")).toHaveAttribute("data-phase", "flip");
    act(() => vi.advanceTimersByTime(SCENE_MS.draw.flip + SCENE_MS.draw.hold));
    expect(screen.getByTestId("card-travel")).toHaveAttribute("data-phase", "land");
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(drawMs()));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("a compra do oponente vai direto e espera o resto da cena (as duas telas liberam juntas)", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<CardTravel from={{ x: 100, y: 100 }} to={{ x: 300, y: 50 }} fromW={80} toW={30} timings={SCENE_MS.draw} totalMs={drawMs()} onDone={onDone} />);
    act(() => vi.advanceTimersByTime(40));
    expect(screen.getByTestId("card-travel")).toHaveAttribute("data-phase", "travel");
    act(() => vi.advanceTimersByTime(SCENE_MS.draw.rise + SCENE_MS.draw.land));
    expect(screen.queryByTestId("card-travel")).not.toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(drawMs()));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("a carta no centro nunca passa da tela", () => {
    expect(centerCardWidth(1920, 1080)).toBe(220);
    expect(centerCardWidth(844, 390) * (88 / 63)).toBeLessThanOrEqual(390 * 0.42 + 1);
    expect(centerCardWidth(400, 900)).toBeLessThanOrEqual(120);
  });
});

describe("CardTravel — o pai re-renderiza a cada segundo (relógio)", () => {
  it("medidas novas a cada render não reiniciam a viagem", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const next = () => (
      <CardTravel from={{ x: 100, y: 500 }} to={{ x: 600, y: 700 }} fromW={80} toW={60} card={card} art={{}} viaCenter timings={SCENE_MS.draw} totalMs={drawMs()} onDone={() => onDone()} />
    );
    const { rerender } = render(next());
    for (let t = 0; t < drawMs() + 300; t += 250) {
      act(() => vi.advanceTimersByTime(250));
      rerender(next());
    }
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
