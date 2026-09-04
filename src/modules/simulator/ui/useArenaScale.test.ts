// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useArenaScale } from "./useArenaScale";

/**
 * jsdom não faz layout de verdade — `getBoundingClientRect()` sempre volta
 * tudo zerado e não existe `ResizeObserver` nativo. Este teste cobre a
 * LÓGICA do hook (a matemática de escala), não o layout real do navegador:
 * mocka os dois com controle manual (`triggerResize()` dispara o callback
 * como se o container tivesse mudado de tamanho de verdade).
 */
let resizeCallback: (() => void) | null = null;

class MockResizeObserver {
  constructor(cb: () => void) {
    resizeCallback = cb;
  }
  observe() {}
  disconnect() {
    resizeCallback = null;
  }
}

function rect(width: number, height: number): DOMRect {
  return { width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
}

function makeEl(getRect: () => DOMRect): HTMLDivElement {
  const el = document.createElement("div");
  el.getBoundingClientRect = getRect;
  return el;
}

/** Grupo "de verdade": sua largura/altura escalam PROPORCIONALMENTE ao
 * `--card-w` atualmente aplicado no `container` — exatamente como o CSS
 * real (`calc(var(--card-w) * constante)`) se comportaria. `widthAt56`/
 * `heightAt56` são as medidas na referência inicial (56px, o piso —
 * `DEFAULT_INITIAL_PX` do hook). Sem isso, um 2º `recompute()` (outro
 * resize real) mediria um grupo com tamanho FIXO — quebra a suposição de
 * linearidade que o hook depende pra convergir, e não é como o navegador
 * de verdade se comporta. */
function makeScalingGroup(container: HTMLDivElement, widthAt56: number, heightAt56: number): HTMLDivElement {
  return makeEl(() => {
    const current = parseFloat(container.style.getPropertyValue("--card-w")) || 56;
    const scale = current / 56;
    return rect(widthAt56 * scale, heightAt56 * scale);
  });
}

function triggerResize() {
  resizeCallback?.();
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  resizeCallback = null;
});

describe("useArenaScale", () => {
  it("aplica o piso inicial (56px) antes da 1ª medição real", () => {
    const container = makeEl(() => rect(0, 0));
    const group = makeEl(() => rect(0, 0));
    renderHook(() => useArenaScale({ current: container }, { current: group }));
    expect(container.style.getPropertyValue("--card-w")).toBe("56px");
  });

  it("calcula --card-w pela largura quando ela é o fator limitante", () => {
    const container = makeEl(() => rect(700, 1000)); // caixa larga e alta — largura limita
    // grupo medido na referência (56px) ocupa 400px de largura, 200px de altura.
    const group = makeScalingGroup(container, 400, 200);
    renderHook(() => useArenaScale({ current: container }, { current: group }));
    triggerResize(); // 2ª medição (resize real) — deve CONVERGIR no mesmo valor, não divergir.

    // largura: 700 / (400/56) = 98px. altura: 1000 / (2*(200/56) + 1.75) ≈ 1000/8.893 ≈ 112.4px.
    // menor dos dois = largura (98px).
    const applied = parseFloat(container.style.getPropertyValue("--card-w"));
    expect(applied).toBeCloseTo(98, 0);
  });

  it("calcula --card-w pela altura quando ela é o fator limitante", () => {
    const container = makeEl(() => rect(2000, 300)); // caixa bem larga e baixa — altura limita
    const group = makeScalingGroup(container, 400, 200);
    renderHook(() => useArenaScale({ current: container }, { current: group }));
    triggerResize();

    // altura: 300 / (2*(200/56) + 1.75) ≈ 300/8.893 ≈ 33.7px — abaixo do piso (44px), então clampa no piso.
    const applied = parseFloat(container.style.getPropertyValue("--card-w"));
    expect(applied).toBe(44);
  });

  it("nunca ultrapassa o teto de sanidade num caso degenerado", () => {
    const container = makeEl(() => rect(20000, 20000));
    const group = makeScalingGroup(container, 10, 10);
    renderHook(() => useArenaScale({ current: container }, { current: group }));
    triggerResize();

    expect(parseFloat(container.style.getPropertyValue("--card-w"))).toBe(320);
  });

  it("dispara `onScale` com o valor aplicado (px) — usado pelo ArenaPlaymat pra decidir o Shield compacto", () => {
    const container = makeEl(() => rect(700, 1000));
    const group = makeScalingGroup(container, 400, 200);
    const onScale = vi.fn();
    renderHook(() => useArenaScale({ current: container }, { current: group }, { onScale }));
    triggerResize();

    expect(onScale).toHaveBeenCalledWith(expect.closeTo(98, 0));
  });
});
