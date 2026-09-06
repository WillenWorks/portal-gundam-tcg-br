// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CardInstance } from "@/modules/simulator/engine/types";
import { PileTray } from "./PileTray";

afterEach(cleanup);

function card(id: string, nameEn = `Carta ${id}`): CardInstance {
  return {
    instanceId: id,
    def: { code: `COD-${id}`, nameEn, cardType: "UNIT", color: "blue" },
    owner: "A",
    zone: "trash",
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: 0,
  };
}

describe("PileTray", () => {
  it("em repouso mostra só o chip com a contagem", () => {
    render(<PileTray label="Trash" count={3} cards={[card("1"), card("2"), card("3")]} art={{}} />);
    expect(screen.getByRole("button", { name: "Trash: 3" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("abre a bandeja ao clicar e fecha no botão Fechar", () => {
    render(<PileTray label="Trash" count={2} cards={[card("1"), card("2")]} art={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "Trash: 2" }));
    expect(screen.getByRole("dialog", { name: "Pilha: Trash" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Fechar/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lista uma miniatura por carta e chama onInspect no clique", () => {
    const onInspect = vi.fn();
    render(
      <PileTray
        label="Exílio"
        count={2}
        cards={[card("1", "Gundam"), card("2", "Zaku")]}
        art={{}}
        onInspect={onInspect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Exílio: 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Zaku" }));
    expect(onInspect).toHaveBeenCalledWith(expect.objectContaining({ instanceId: "2" }));
  });

  it("bandeja vazia mostra o texto de pilha vazia", () => {
    render(<PileTray label="Deck" count={0} cards={[]} art={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "Deck: 0" }));
    expect(screen.getByText("Pilha vazia.")).toBeInTheDocument();
  });

  it("Frente 4 (feedback Willen 2ª rodada): bandeja tem largura limitada (não `inset-x-0`)", () => {
    render(<PileTray label="Trash" count={1} cards={[card("1")]} art={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "Trash: 1" }));
    const dialog = screen.getByRole("dialog", { name: "Pilha: Trash" });
    expect(dialog.className).toMatch(/w-\[min\(92vw,30rem\)\]/);
    expect(dialog.className).not.toMatch(/inset-x-0/);
  });

  it("Frente 4: fecha clicando no backdrop e com Esc", () => {
    render(<PileTray label="Trash" count={1} cards={[card("1")]} art={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "Trash: 1" }));
    // backdrop = o irmão aria-hidden com bg-black/50
    const backdrop = document.querySelector('[aria-hidden="true"].fixed.inset-0') as HTMLElement;
    fireEvent.click(backdrop);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Trash: 1" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Frente 4: abrir uma pilha fecha qualquer outra (só 1 bandeja por vez)", () => {
    render(
      <>
        <PileTray label="Trash" count={1} cards={[card("1")]} art={{}} />
        <PileTray label="Exílio" count={1} cards={[card("2")]} art={{}} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Trash: 1" }));
    expect(screen.getByRole("dialog", { name: "Pilha: Trash" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exílio: 1" }));
    expect(screen.queryByRole("dialog", { name: "Pilha: Trash" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Pilha: Exílio" })).toBeInTheDocument();
  });
});
