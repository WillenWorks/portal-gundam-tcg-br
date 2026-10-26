// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ActivationAnnouncement } from "./ActivationAnnouncement";
import type { CardDef } from "../engine/types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const def = { code: "ST04-002", nameEn: "Strike Gundam", cardType: "UNIT", color: "blue" } as CardDef;

describe("ActivationAnnouncement", () => {
  it("mostra a carta com o selo do gatilho e de quem ativa, e termina sozinho", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<ActivationAnnouncement cardDef={def} art={{}} trigger="Deploy" mine={false} origin={{ x: 10, y: 10 }} cardW={60} onDone={onDone} />);
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(screen.getByText("【Deploy】")).toBeInTheDocument();
    expect(screen.getByText(/Strike Gundam/)).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("lote longo (tempo menor) termina antes; re-render com outro onDone não reinicia o relógio", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { rerender } = render(
      <ActivationAnnouncement cardDef={def} art={{}} trigger="Attack" mine origin={null} cardW={60} tempo={0.5} onDone={() => onDone()} />,
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender(<ActivationAnnouncement cardDef={def} art={{}} trigger="Attack" mine origin={null} cardW={60} tempo={0.5} onDone={() => onDone()} />);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
