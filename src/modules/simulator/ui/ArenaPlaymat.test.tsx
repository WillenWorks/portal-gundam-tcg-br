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

  it("trava a proporção 16:9 e define a escala --card no canvas", () => {
    const { container } = renderArena();
    const canvas = container.firstElementChild as HTMLElement;
    expect(canvas.className).toMatch(/aspect-\[16\/9\]/);
    expect(canvas.style.getPropertyValue("--card")).toBe("clamp(2.5rem, 5.2vw, 5.2rem)");
  });

  it("overlay é renderizado sobre o canvas quando informado", () => {
    renderArena({ overlay: <div>mira-lane</div> });
    expect(screen.getByText("mira-lane")).toBeInTheDocument();
  });
});
