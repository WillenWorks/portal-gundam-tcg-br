// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCountingNumber } from "./useCountingNumber";

describe("useCountingNumber — AP/HP contam até o valor novo", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("conta um a um até o novo valor e volta contando", () => {
    const { result, rerender } = renderHook(({ v }) => useCountingNumber(v), { initialProps: { v: 2 } });
    expect(result.current).toEqual({ shown: 2, counting: null });

    rerender({ v: 5 });
    expect(result.current).toEqual({ shown: 2, counting: "up" });
    act(() => vi.advanceTimersByTime(110));
    expect(result.current.shown).toBe(3);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toEqual({ shown: 5, counting: null });

    rerender({ v: 2 });
    expect(result.current.counting).toBe("down");
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toEqual({ shown: 2, counting: null });
  });

  it("mudança grande conta mais rápido (o total tem teto)", () => {
    const { result, rerender } = renderHook(({ v }) => useCountingNumber(v), { initialProps: { v: 0 } });
    rerender({ v: 10 });
    act(() => vi.advanceTimersByTime(700));
    expect(result.current.shown).toBe(10);
  });
});

describe("useCountingNumber — outra carta no mesmo lugar", () => {
  it("mostra o valor direto, sem contar", () => {
    const { result, rerender } = renderHook(({ v, k }) => useCountingNumber(v, k), { initialProps: { v: 2, k: "u1" } });
    rerender({ v: 6, k: "u2" });
    expect(result.current).toEqual({ shown: 6, counting: null });
  });
});
