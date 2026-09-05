// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CardDef, CardInstance, GameState } from "@/modules/simulator/engine/types";
import { BattleSlot } from "./BattleSlot";

afterEach(cleanup);

let seq = 0;
function inst(
  def: Partial<CardDef> & Pick<CardDef, "nameEn" | "cardType">,
  over: Partial<CardInstance> = {},
): CardInstance {
  return {
    instanceId: `inst-${seq++}`,
    def: { code: def.nameEn.toUpperCase().replace(/\s+/g, "-"), color: "blue", ...def },
    owner: "A",
    zone: "battleArea",
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: 0,
    ...over,
  };
}

const unit = (over: Partial<CardDef> = {}, i: Partial<CardInstance> = {}) =>
  inst({ nameEn: "Gundam", cardType: "UNIT", ap: 3, hp: 4, ...over }, i);

describe("BattleSlot", () => {
  it("slot vazio: moldura de hangar tracejada, sem botões", () => {
    const { container } = render(<BattleSlot unit={null} pilot={null} art={{}} />);
    // V6.3 (docs/34): o outer virou `flex-col` (carta + tira reservada pro
    // Piloto) — a moldura tracejada mora no filho aspect-[63/88] (a carta em si).
    const cardBox = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(cardBox.className).toMatch(/border-dashed/);
    expect(cardBox.className).toMatch(/border-primary\/25/);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("slot ocupado: badges de AP e HP em canto", () => {
    render(<BattleSlot unit={unit({ ap: 5, hp: 6 })} pilot={null} art={{}} />);
    expect(screen.getByLabelText("AP 5")).toBeInTheDocument();
    expect(screen.getByLabelText("HP 6")).toBeInTheDocument();
  });

  it("badge de AP inclui o bônus estático 【During Pair】 quando o `state` é passado", () => {
    const gundam = unit(
      {
        ap: 3,
        hp: 4,
        staticAbilities: [
          { condition: "duringPair", scope: "allFriendlyUnits", stat: "ap", amount: 1, duringYourTurnOnly: true },
        ],
      },
      { pairedPilotId: "p1", owner: "A" },
    );
    const state = {
      activePlayer: "A",
      players: { A: { battleArea: [gundam] }, B: { battleArea: [] } },
    } as unknown as GameState;

    // sem state: só o AP base (3)
    const { rerender } = render(<BattleSlot unit={gundam} pilot={null} art={{}} />);
    expect(screen.getByLabelText("AP 3")).toBeInTheDocument();

    // com state: 3 + 1 (During Pair, seu turno)
    rerender(<BattleSlot unit={gundam} pilot={null} art={{}} state={state} />);
    expect(screen.getByLabelText("AP 4")).toBeInTheDocument();
  });

  it("dano acumulado: HP restante + indicador -N", () => {
    render(<BattleSlot unit={unit({ ap: 3, hp: 5 }, { damage: 2 })} pilot={null} art={{}} />);
    expect(screen.getByLabelText("HP 3")).toBeInTheDocument();
    expect(screen.getByText("-2")).toBeInTheDocument();
  });

  it("Frente 4 (docs/38 §3.1): cluster de canto tem só ações operacionais (Atacar), sem botão de olho", () => {
    const onAttack = vi.fn();
    const onInspect = vi.fn();
    render(<BattleSlot unit={unit()} pilot={null} art={{}} onInspect={onInspect} actions={{ onAttack }} />);
    const strip = screen.getByRole("button", { name: "Atacar" }).closest("div")!;
    expect(strip.className).toMatch(/absolute/);
    expect(strip.className).toMatch(/top-0\.5/);
    expect(strip.className).toMatch(/right-0\.5/);
    const clusterButtons = Array.from(strip.querySelectorAll("button")).map((b) => b.getAttribute("aria-label"));
    expect(clusterButtons).toEqual(["Atacar"]);
  });

  it("Frente 4: sem ação disponível o cluster some — a inspeção fica no corpo da carta", () => {
    render(<BattleSlot unit={unit()} pilot={null} art={{}} onInspect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Atacar" })).toBeNull();
    expect(screen.getByRole("button", { name: /^Ver / })).toBeInTheDocument();
  });

  it("clicar em Atacar dispara SÓ onAttack, nunca a inspeção (fim do conflito)", () => {
    const onAttack = vi.fn();
    const onInspect = vi.fn();
    render(<BattleSlot unit={unit()} pilot={null} art={{}} onInspect={onInspect} actions={{ onAttack }} />);
    screen.getByRole("button", { name: "Atacar" }).click();
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onInspect).not.toHaveBeenCalled();
  });

  it("Frente 4: clicar no corpo da carta (fora de seleção) dispara onInspect", () => {
    const onInspect = vi.fn();
    const u = unit();
    render(<BattleSlot unit={u} pilot={null} art={{}} onInspect={onInspect} />);
    screen.getByRole("button", { name: /^Ver / }).click();
    expect(onInspect).toHaveBeenCalledWith(u);
  });

  it("Frente 4: como ALVO LEGAL o corpo seleciona, não inspeciona", () => {
    const onInspect = vi.fn();
    const onSelect = vi.fn();
    const u = unit();
    render(<BattleSlot unit={u} pilot={null} art={{}} legalTarget onInspect={onInspect} onSelect={onSelect} />);
    const body = document.querySelector('[role="button"][tabindex="0"]') as HTMLElement;
    body.click();
    expect(onSelect).toHaveBeenCalledWith(u);
    expect(onInspect).not.toHaveBeenCalled();
  });

  it("sem badge 'BLK' na arte (blocker se mostra pelo botão de escudo)", () => {
    render(<BattleSlot unit={unit()} pilot={null} art={{}} onInspect={vi.fn()} />);
    expect(screen.queryByText("Blk")).toBeNull();
  });

  it("botões de ação são só ícone (não cobrem os números AP/HP)", () => {
    render(<BattleSlot unit={unit()} pilot={null} art={{}} actions={{ onAttack: vi.fn(), onBlocker: vi.fn() }} />);
    expect(screen.getByRole("button", { name: "Atacar" }).textContent).toBe("");
  });

  it("com ações disponíveis a CARTA não expande: segue aspect-[63/88] (V6.3, docs/34 — a tira do Piloto é reservada à parte, fora da carta)", () => {
    const { container } = render(
      <BattleSlot unit={unit()} pilot={null} art={{}} actions={{ onAttack: vi.fn(), onBlocker: vi.fn() }} />,
    );
    const cardBox = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(cardBox.className).toMatch(/aspect-\[63\/88\]/);
    // o cluster de botões não faz parte do fluxo (é absolute, some da carta)
    expect(cardBox.className).not.toMatch(/flex-col/);
  });

  it("slot ocupado: a carta em si mantém a proporção estrita aspect-[63/88]", () => {
    const { container } = render(<BattleSlot unit={unit()} pilot={null} art={{}} />);
    const cardBox = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(cardBox.className).toMatch(/aspect-\[63\/88\]/);
  });

  it("piloto acoplado ganha tira RESERVADA abaixo da arte, não mais overlay em cima dela (V6.3, docs/34)", () => {
    render(<BattleSlot unit={unit()} pilot={inst({ nameEn: "Amuro Ray", cardType: "PILOT", ap: 1, hp: 1 })} art={{}} />);
    const pilotButton = screen.getByRole("button", { name: /Amuro Ray/ });
    // não é mais um overlay absoluto por cima da arte — é fluxo normal, numa
    // tira própria abaixo dela.
    expect(pilotButton.className).not.toMatch(/absolute/);
    expect(pilotButton.parentElement?.className).toMatch(/h-\[1\.1rem\]/);
  });

  it("Frente 4 (docs/38 §4.3): atacante/bloqueador sobem ~6px com leve inclinação (motion-reduce neutraliza)", () => {
    const { container, rerender } = render(<BattleSlot unit={unit()} pilot={null} art={{}} />);
    const slot = () => container.firstElementChild as HTMLElement;
    expect(slot().className).not.toMatch(/-translate-y-1\.5/);

    rerender(<BattleSlot unit={unit()} pilot={null} art={{}} isAttacker />);
    expect(slot().className).toMatch(/-translate-y-1\.5/);
    expect(slot().className).toMatch(/rotate-\[-2deg\]/);
    expect(slot().className).toMatch(/motion-reduce:transform-none/);

    rerender(<BattleSlot unit={unit()} pilot={null} art={{}} isBlocking />);
    expect(slot().className).toMatch(/-translate-y-1\.5/);
    expect(slot().className).toMatch(/rotate-\[2deg\]/);
  });

  it("onHoverCard dispara com a Unit no hover do slot e null ao sair", () => {
    const onHoverCard = vi.fn();
    const u = unit();
    const { container } = render(
      <BattleSlot unit={u} pilot={null} art={{}} onHoverCard={onHoverCard} onInspect={vi.fn()} />,
    );
    const slot = container.firstElementChild as HTMLElement;
    fireEvent.mouseEnter(slot);
    expect(onHoverCard).toHaveBeenLastCalledWith(u);
    fireEvent.mouseLeave(slot);
    expect(onHoverCard).toHaveBeenLastCalledWith(null);
  });
});
