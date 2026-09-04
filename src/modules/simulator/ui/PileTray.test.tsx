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
});
