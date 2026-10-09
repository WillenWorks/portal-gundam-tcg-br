// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { EffectResolutionOverlay, newEventsSince } from "./EffectResolutionOverlay";
import type { GameEvent } from "@/modules/simulator/engine/types";

afterEach(cleanup);

const mockRect = (x = 100, y = 200, width = 80, height = 110): DOMRect => ({
  x,
  y,
  left: x,
  top: y,
  right: x + width,
  bottom: y + height,
  width,
  height,
  toJSON: () => ({}),
});

describe("EffectResolutionOverlay (Fase 3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renderiza cue de dano em Unit e dano em Base", () => {
    const rectOf = (key: string) => (key === "u1" ? mockRect(150, 250) : null);
    const events: GameEvent[] = [
      { type: "DAMAGE_UNIT", instanceId: "u1", amount: 3 },
    ];

    const { rerender } = render(
      <EffectResolutionOverlay eventLog={[]} rectOf={rectOf} viewerSeat="A" />,
    );

    rerender(<EffectResolutionOverlay eventLog={events} rectOf={rectOf} viewerSeat="A" />);

    expect(screen.getByText("-3")).toBeInTheDocument();
    expect(screen.getByText("DANO")).toBeInTheDocument();
  });

  it("renderiza cue de destruição e de exílio de carta", () => {
    const rectOf = (_key: string) => mockRect(100, 100);
    const events: GameEvent[] = [
      { type: "DESTROY_CARD", instanceId: "u-dead" },
      { type: "REMOVE_CARD_FROM_GAME", instanceId: "u-exiled" },
    ];

    const { rerender } = render(
      <EffectResolutionOverlay eventLog={[]} rectOf={rectOf} viewerSeat="A" />,
    );

    rerender(<EffectResolutionOverlay eventLog={events} rectOf={rectOf} viewerSeat="A" />);

    expect(screen.getByText("Destruída")).toBeInTheDocument();
    expect(screen.getByText("K.O.")).toBeInTheDocument();
    expect(screen.getByText("Exilada")).toBeInTheDocument();
    expect(screen.getByText("EXÍLIO")).toBeInTheDocument();
  });

  it("renderiza cue de buff e debuff de stat", () => {
    const rectOf = (_key: string) => mockRect(200, 200);
    const events: GameEvent[] = [
      {
        type: "MODIFY_STAT",
        instanceId: "u1",
        modifier: { stat: "ap", amount: 2, duration: "endOfTurn", appliedOnTurn: 1 },
      },
      {
        type: "MODIFY_STAT",
        instanceId: "u2",
        modifier: { stat: "hp", amount: -1, duration: "thisBattle", appliedOnTurn: 1 },
      },
    ];

    const { rerender } = render(
      <EffectResolutionOverlay eventLog={[]} rectOf={rectOf} viewerSeat="A" />,
    );

    rerender(<EffectResolutionOverlay eventLog={events} rectOf={rectOf} viewerSeat="A" />);

    expect(screen.getByText("+2 AP")).toBeInTheDocument();
    expect(screen.getByText("-1 HP")).toBeInTheDocument();
  });

  it("renderiza cue de pareamento, descanso, ativação e bloqueio", () => {
    const rectOf = (_key: string) => mockRect(100, 150);
    const events: GameEvent[] = [
      { type: "PAIR_CARDS", pilotId: "p1", unitId: "u1" },
      { type: "REST_CARD", instanceId: "u1" },
      { type: "SET_ACTIVE", instanceId: "u2" },
      { type: "BLOCK_DECLARED", blockerId: "u3", newTarget: "player" },
    ];

    const { rerender } = render(
      <EffectResolutionOverlay eventLog={[]} rectOf={rectOf} viewerSeat="A" />,
    );

    rerender(<EffectResolutionOverlay eventLog={events} rectOf={rectOf} viewerSeat="A" />);

    expect(screen.getByText("Piloto Pareado")).toBeInTheDocument();
    expect(screen.getByText("Descansada")).toBeInTheDocument();
    expect(screen.getByText("Ativa")).toBeInTheDocument();
    expect(screen.getByText("Bloqueio!")).toBeInTheDocument();
  });

  it("renderiza restrições de ação (lock e freeze)", () => {
    const rectOf = (_key: string) => mockRect(120, 120);
    const events: GameEvent[] = [
      { type: "SET_CANNOT_ATTACK", instanceId: "u1", turn: 3 },
      { type: "SET_CANNOT_ACTIVATE", instanceId: "u2", turn: 3 },
    ];

    const { rerender } = render(
      <EffectResolutionOverlay eventLog={[]} rectOf={rectOf} viewerSeat="A" />,
    );

    rerender(<EffectResolutionOverlay eventLog={events} rectOf={rectOf} viewerSeat="A" />);

    expect(screen.getByText("Não Pode Atacar")).toBeInTheDocument();
    expect(screen.getByText("NESTE TURNO")).toBeInTheDocument();
    expect(screen.getByText("Fica em Rest")).toBeInTheDocument();
    expect(screen.getByText("PRÓX. START")).toBeInTheDocument();
  });

  it("renderiza pagamento com EX e compra de carta", () => {
    const rectOf = (_key: string) => mockRect(300, 300);
    const events: GameEvent[] = [
      { type: "MARK_COMMAND_PAYMENT", instanceId: "cmd-1", withEx: true, turn: 2 },
      { type: "DRAW_CARD", player: "A", from: "deck", instanceId: "c-draw" },
      { type: "DRAW_CARD", player: "A", from: "resourceDeck", instanceId: "r-draw" },
    ];

    const { rerender } = render(
      <EffectResolutionOverlay eventLog={[]} rectOf={rectOf} viewerSeat="A" />,
    );

    rerender(<EffectResolutionOverlay eventLog={events} rectOf={rectOf} viewerSeat="A" />);

    expect(screen.getByText("Pago c/ EX")).toBeInTheDocument();
    expect(screen.getByText("+1 Carta")).toBeInTheDocument();
    // recurso da Fase de Recurso não é EX Resource
    expect(screen.getByText("+1 Recurso")).toBeInTheDocument();
    expect(screen.queryByText("EX REC")).toBeNull();
  });

  it("auto-limpa os cues após o tempo da animação", () => {
    const rectOf = (_key: string) => mockRect(100, 100);
    const events: GameEvent[] = [
      { type: "DAMAGE_UNIT", instanceId: "u1", amount: 2 },
    ];

    const { rerender } = render(
      <EffectResolutionOverlay eventLog={[]} rectOf={rectOf} viewerSeat="A" />,
    );

    rerender(<EffectResolutionOverlay eventLog={events} rectOf={rectOf} viewerSeat="A" />);
    expect(screen.getByText("-2")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.queryByText("-2")).not.toBeInTheDocument();
  });
});

describe("newEventsSince (janela de 150 eventos do servidor)", () => {
  const ev = (n: number) => ({ type: "DRAW_CARD", player: "A", from: "deck", instanceId: `A-${n}` }) as GameEvent;
  const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => ev(a + i));

  it("acha os eventos novos mesmo com o log do mesmo tamanho (janela cheia)", () => {
    const prev = range(0, 150);
    const next = range(3, 153);
    expect(newEventsSince(prev, next)).toEqual(range(150, 153));
  });

  it("nada novo quando a view repete o mesmo log", () => {
    const log = range(0, 150);
    expect(newEventsSince(log, [...log])).toEqual([]);
  });

  it("salto maior que a janela devolve só os últimos eventos", () => {
    expect(newEventsSince(range(0, 150), range(400, 550))).toHaveLength(10);
  });
});
