// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useHashLocationWithQuery } from "./hashLocationWithQuery";

function setHash(hash: string) {
  window.history.replaceState({}, "", `/${hash ? hash : ""}`);
}

afterEach(() => {
  setHash("");
});

describe("useHashLocationWithQuery — location string", () => {
  it("retorna o caminho do hash sem o '#'", () => {
    setHash("#/simulador/preview-layout");
    const { result } = renderHook(() => useHashLocationWithQuery());
    expect(result.current[0]).toBe("/simulador/preview-layout");
  });

  it("corta a query embutida no hash (link colado à mão) pro casamento de rota", () => {
    setHash("#/simulador/preview-layout?preview=1");
    const { result } = renderHook(() => useHashLocationWithQuery());
    expect(result.current[0]).toBe("/simulador/preview-layout");
  });

  it("raiz vira '/'", () => {
    setHash("");
    const { result } = renderHook(() => useHashLocationWithQuery());
    expect(result.current[0]).toBe("/");
  });
});
