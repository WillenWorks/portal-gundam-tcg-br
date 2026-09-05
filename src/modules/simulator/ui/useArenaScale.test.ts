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
function makeScalingGroup(container: HTMLDivElement, widthAtRef: number, heightAtRef: number): HTMLDivElement {
  const REF = 80; // DEFAULT_INITIAL_PX do hook (Frente 4, docs/38 — 56 → 64 → 80)
  return makeEl(() => {
    const current = parseFloat(container.style.getPropertyValue("--card-w")) || REF;
    const scale = current / REF;
    return rect(widthAtRef * scale, heightAtRef * scale);
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
  it("aplica o piso inicial (80px) antes da 1ª medição real", () => {
    const container = makeEl(() => rect(0, 0));
    const group = makeEl(() => rect(0, 0));
    renderHook(() => useArenaScale({ current: container }, { current: group }));
    expect(container.style.getPropertyValue("--card-w")).toBe("80px");
  });

  it("calcula --card-w pela largura quando ela é o fator limitante", () => {
    const container = makeEl(() => rect(900, 1400)); // caixa larga e alta — largura limita
    // grupo medido na referência (80px) ocupa 400px de largura, 200px de altura.
    const group = makeScalingGroup(container, 400, 200);
    renderHook(() => useArenaScale({ current: container }, { current: group }));
    triggerResize(); // 2ª medição (resize real) — deve CONVERGIR no mesmo valor, não divergir.

    // largura: 900 / (400/80) = 180px. altura: 1400 / (2*(200/80) + 1.75) = 1400/6.75 ≈ 207px.
    // menor dos dois = largura (180px).
    const applied = parseFloat(container.style.getPropertyValue("--card-w"));
    expect(applied).toBeCloseTo(180, 0);
  });

  it("calcula --card-w pela altura quando ela é o fator limitante", () => {
    const container = makeEl(() => rect(2000, 300)); // caixa bem larga e baixa — altura limita
    const group = makeScalingGroup(container, 400, 200);
    renderHook(() => useArenaScale({ current: container }, { current: group }));
    triggerResize();

    // altura: 300 / (2*(200/80) + 1.75) = 300/6.75 ≈ 44.4px — abaixo do piso (80px), clampa no piso.
    const applied = parseFloat(container.style.getPropertyValue("--card-w"));
    expect(applied).toBe(80);
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

    // 700 / (400/80) = 140px de largura (fator limitante).
    expect(onScale).toHaveBeenCalledWith(expect.closeTo(140, 0));
  });
});
