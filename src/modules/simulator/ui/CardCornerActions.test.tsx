// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Crosshair, Play, Swords } from "lucide-react";
import { CardCornerActions, type CornerAction } from "./CardCornerActions";

afterEach(cleanup);

// Frente 4 (docs/38 §3.1): sem o tom "view"/olho — o cluster só tem ações
// operacionais. Aqui um genérico "Mirar" faz o papel de 2ª ação nos testes.
const view = (onClick = vi.fn()): CornerAction => ({ key: "aim", icon: Crosshair, label: "Ver X", tone: "sky", onClick });

describe("CardCornerActions", () => {
  it("lista vazia não renderiza nada", () => {
    const { container } = render(<CardCornerActions actions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ancora no canto sup. direito, ordem do DOM = ordem passada", () => {
    render(
      <CardCornerActions
        actions={[
          { key: "play", icon: Play, label: "Jogar X", tone: "primary", onClick: vi.fn() },
          view(),
        ]}
      />,
    );
    const strip = screen.getByRole("button", { name: "Ver X" }).parentElement!;
    expect(strip.className).toMatch(/absolute/);
    // V6.3 (docs/34): posição unificada — DENTRO do canto (`top-0.5
    // right-0.5`), não mais `-top-2` (salta pra fora, só a mão usava isso
    // antes, inconsistente com o campo).
    expect(strip.className).toMatch(/top-0\.5/);
    expect(strip.className).toMatch(/right-0\.5/);
    expect(Array.from(strip.children).map((c) => c.getAttribute("aria-label"))).toEqual(["Jogar X", "Ver X"]);
  });

  it("cada botão chama seu onClick e faz stopPropagation", () => {
    const onParent = vi.fn();
    const onAttack = vi.fn();
    render(
      <div onClick={onParent}>
        <CardCornerActions actions={[{ key: "a", icon: Swords, label: "Atacar", tone: "primary", onClick: onAttack }, view()]} />
      </div>,
    );
    screen.getByRole("button", { name: "Atacar" }).click();
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onParent).not.toHaveBeenCalled();
  });

  it("V6.4 (docs/35): tamanho responde a --card-w-std (clamp) — não mais um `size-7` fixo que estourava cartas pequenas no mobile", () => {
    render(<CardCornerActions actions={[view()]} />);
    const btn = screen.getByRole("button", { name: "Ver X" });
    expect(btn.className).toMatch(/clamp\(1\.125rem,calc\(var\(--card-w-std,2\.17rem\)\*0\.45\),1\.75rem\)/);
    expect(btn.querySelector("svg")?.getAttribute("class")).toMatch(/clamp\(0\.625rem,calc\(var\(--card-w-std,2\.17rem\)\*0\.26\),1rem\)/);
  });

  it("disabled bloqueia o clique", () => {
    const onClick = vi.fn();
    render(<CardCornerActions actions={[{ key: "a", icon: Swords, label: "Atacar", tone: "primary", disabled: true, onClick }]} />);
    screen.getByRole("button", { name: "Atacar" }).click();
    expect(onClick).not.toHaveBeenCalled();
  });
});
