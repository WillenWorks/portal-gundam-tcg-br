// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { DeckDealAnimation } from "./DeckDealAnimation";
import { sfx } from "../audio/soundEffects";

/** avança timers dentro de `act` pra o React flushar os setState. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function mockMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((q: string) => ({
      matches: reduced,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe("DeckDealAnimation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("shuffle: aplica a classe de embaralhamento e chama onDone ao fim", () => {
    mockMatchMedia(false);
    const onDone = vi.fn();
    const { container } = render(<DeckDealAnimation mode="shuffle" onDone={onDone} label="Embaralhando…" />);
    expect(container.querySelector(".sim-anim-shuffle")).not.toBeNull();
    expect(screen.getByText("Embaralhando…")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    advance(1400);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("deal-hand: 5 cartas viajando com a classe de deal", () => {
    mockMatchMedia(false);
    const onDone = vi.fn();
    const { container } = render(<DeckDealAnimation mode="deal-hand" onDone={onDone} />);
    expect(container.querySelectorAll(".sim-anim-deal")).toHaveLength(5);
    advance(1200);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("deal-shields: 6 cartas", () => {
    mockMatchMedia(false);
    const { container } = render(<DeckDealAnimation mode="deal-shields" onDone={vi.fn()} />);
    expect(container.querySelectorAll(".sim-anim-deal")).toHaveLength(6);
  });

  it("mulligan: passa por return → shuffle → deal e termina", () => {
    mockMatchMedia(false);
    const onDone = vi.fn();
    const { container } = render(<DeckDealAnimation mode="mulligan" onDone={onDone} />);
    expect(container.querySelectorAll(".sim-anim-return")).toHaveLength(5);
    advance(360);
    expect(container.querySelector(".sim-anim-shuffle")).not.toBeNull();
    advance(1300);
    expect(container.querySelectorAll(".sim-anim-deal")).toHaveLength(5);
    advance(1500);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("Frente 4 (feedback Willen 4ª rodada): modo ancorado posiciona o palco no `origin` e ainda dá as 5 cartas", () => {
    mockMatchMedia(false);
    const { container } = render(
      <DeckDealAnimation
        mode="deal-hand"
        onDone={vi.fn()}
        origin={{ x: 800, y: 120 }}
        dest={{ x: 500, y: 640 }}
      />,
    );
    // palco ancorado: caixa 0x0 posicionada em coords de viewport
    const stage = container.querySelector('[aria-hidden] > div') as HTMLElement;
    expect(stage.style.left).toBe("800px");
    expect(stage.style.top).toBe("120px");
    expect(container.querySelectorAll(".sim-anim-deal")).toHaveLength(5);
  });

  it("cardW dimensiona as card-backs no tamanho das cartas do board", () => {
    mockMatchMedia(false);
    const { container } = render(<DeckDealAnimation mode="deal-hand" onDone={vi.fn()} cardW={90} />);
    const travelling = container.querySelector(".sim-anim-deal") as HTMLElement;
    expect(travelling.style.width).toBe("90px");
    expect(travelling.style.marginLeft).toBe("-45px");
  });

  it("deal-hand com cards: renderiza container com sim-anim-card-flip e revela os nomes das cartas", () => {
    mockMatchMedia(false);
    const mockCards = [
      { def: { code: "ST01-001", nameEn: "Gundam" } },
      { def: { code: "ST01-002", nameEn: "Guncannon" } },
    ];
    const { container } = render(
      <DeckDealAnimation mode="deal-hand" onDone={vi.fn()} cards={mockCards} />,
    );
    expect(container.querySelectorAll(".sim-anim-card-flip")).toHaveLength(5);
    expect(screen.getByText("Gundam")).toBeInTheDocument();
    expect(screen.getByText("Guncannon")).toBeInTheDocument();
  });

  it("prefers-reduced-motion: sem animação, onDone quase imediato", () => {
    mockMatchMedia(true);
    const onDone = vi.fn();
    const { container } = render(<DeckDealAnimation mode="deal-hand" onDone={onDone} />);
    expect(container.querySelector(".sim-anim-deal")).toBeNull();
    advance(100);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  // docs/53 — bug real: a página reusa a MESMA instância de `DeckDealAnimation`
  // conforme `setupAnim` avança (shuffle → deal-hand → deal-shields) sem
  // desmontar. `phase` só reinicializava no `useState` (roda 1x, no mount), então
  // trocar `mode` sozinho nunca tirava a fase de "shuffle" — as 5 cartas da mão
  // nunca saíam da pilha. Este teste re-renderiza com um novo `mode` SEM trocar
  // `key` (o cenário exato do bug) pra provar que o efeito de resincronização
  // resolve sozinho, independente do `key={setupAnim}` que a página também ganhou.
  it("docs/53 — troca de `mode` via re-render (mesma instância, sem remontar) resincroniza `phase`", () => {
    mockMatchMedia(false);
    const onDone = vi.fn();
    const { container, rerender } = render(<DeckDealAnimation mode="shuffle" onDone={onDone} />);
    expect(container.querySelector(".sim-anim-shuffle")).not.toBeNull();
    expect(container.querySelectorAll(".sim-anim-deal")).toHaveLength(0);

    rerender(<DeckDealAnimation mode="deal-hand" onDone={onDone} />);
    expect(container.querySelector(".sim-anim-shuffle")).toBeNull();
    expect(container.querySelectorAll(".sim-anim-deal")).toHaveLength(5);

    advance(1200);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  // docs/53 — cadência dos escudos: 160ms de stagger (não 90ms da mão), som de
  // trava no pouso do 6º escudo, e onDone só depois do hold total
  // (6 * SHIELD_STAGGER + FLIGHT_MS + SHIELD_STACK_HOLD = 6*160 + 450 + 250 = 1660ms).
  it("docs/53 — deal-shields: stagger de 160ms, som de trava no 6º escudo e onDone após o hold de 1660ms", () => {
    mockMatchMedia(false);
    const onDone = vi.fn();
    const playCardDrawSpy = vi.spyOn(sfx, "playCardDraw");
    const playShieldBlockSpy = vi.spyOn(sfx, "playShieldBlock");
    const { container } = render(<DeckDealAnimation mode="deal-shields" onDone={onDone} />);

    expect(container.querySelectorAll(".sim-anim-deal")).toHaveLength(6);
    const travelling = container.querySelectorAll<HTMLElement>(".sim-anim-deal");
    expect(travelling[1].style.animationDelay).toBe("160ms");
    expect(travelling[5].style.animationDelay).toBe("800ms");

    // 6 sons de saque, um a cada 160ms (t=0,160,320,480,640,800)
    advance(800);
    expect(playCardDrawSpy).toHaveBeenCalledTimes(6);
    expect(playShieldBlockSpy).not.toHaveBeenCalled();

    // 6º escudo pousa e trava aos 5*160 + 450 = 1250ms
    advance(450);
    expect(playShieldBlockSpy).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();

    // hold total: 6*160 + 450 + 250 = 1660ms — não antes
    advance(409);
    expect(onDone).not.toHaveBeenCalled();
    advance(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  // docs/56 tarefa 2 (revisão do plano de polimento) — saque de 1 carta por
  // turno: 1 carta só, som de saque, onDone em ~750ms (tempo pra ler a carta
  // real comprada, sem segurar o jogo). Escalável por `getScaledDuration` —
  // este teste roda sem `localStorage` configurado, então usa o default (1x).
  it("docs/56 — single-draw: 1 carta viajando, toca playCardDraw e chama onDone em 750ms", () => {
    mockMatchMedia(false);
    const onDone = vi.fn();
    const playCardDrawSpy = vi.spyOn(sfx, "playCardDraw");
    const { container } = render(<DeckDealAnimation mode="single-draw" onDone={onDone} />);

    expect(container.querySelectorAll(".sim-anim-deal")).toHaveLength(1);
    expect(playCardDrawSpy).toHaveBeenCalledTimes(1);

    advance(749);
    expect(onDone).not.toHaveBeenCalled();
    advance(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("docs/56 — single-draw ancorado vai reto da origem ao destino (1 ponto, sem leque)", () => {
    mockMatchMedia(false);
    const { container } = render(
      <DeckDealAnimation
        mode="single-draw"
        onDone={vi.fn()}
        origin={{ x: 800, y: 120 }}
        dest={{ x: 500, y: 640 }}
      />,
    );
    const travelling = container.querySelector(".sim-anim-deal") as HTMLElement;
    expect(travelling.style.getPropertyValue("--dx")).toBe("-300px");
    expect(travelling.style.getPropertyValue("--dy")).toBe("520px");
  });

  it("shuffle ancorado: posiciona o palco no origin do deck e usa cardW", () => {
    mockMatchMedia(false);
    const { container } = render(
      <DeckDealAnimation
        mode="shuffle"
        onDone={vi.fn()}
        label="Embaralhando…"
        origin={{ x: 880, y: 640 }}
        cardW={86}
      />,
    );
    const stage = container.querySelector("[aria-hidden] > div") as HTMLElement;
    expect(stage.style.left).toBe("880px");
    expect(stage.style.top).toBe("640px");

    // Cartas do shuffle dimensionadas com a largura fornecida
    const shuffleCard = container.querySelector(".sim-anim-shuffle") as HTMLElement;
    expect(shuffleCard).not.toBeNull();
    expect(shuffleCard.style.width).toBe("86px");

    // Não deve exibir a moldura tática HUD centralizada
    expect(screen.queryByText("TACTICAL_DECK_SYNC")).toBeNull();
  });

  it("shuffle defensivo (abertura da partida): fallback robusto para o centro se origin for nulo ou (0, 0)", () => {
    mockMatchMedia(false);
    // Cenário 1: origin indefinido / nulo (board ainda não montou)
    const { container, rerender } = render(
      <DeckDealAnimation mode="shuffle" onDone={vi.fn()} origin={undefined} />,
    );
    const stage1 = container.querySelector("[aria-hidden] > div") as HTMLElement;
    const expectedCenterX = `${Math.round(window.innerWidth / 2)}px`;
    const expectedCenterY = `${Math.round(window.innerHeight / 2)}px`;
    expect(stage1.style.left).toBe(expectedCenterX);
    expect(stage1.style.top).toBe(expectedCenterY);
    expect(stage1.style.left).not.toBe("0px");
    expect(stage1.style.top).not.toBe("0px");

    // Cenário 2: origin com coords (0, 0) de elemento não pintado
    rerender(<DeckDealAnimation mode="shuffle" onDone={vi.fn()} origin={{ x: 0, y: 0 }} />);
    const stage2 = container.querySelector("[aria-hidden] > div") as HTMLElement;
    expect(stage2.style.left).toBe(expectedCenterX);
    expect(stage2.style.top).toBe(expectedCenterY);

    // Cenário 3: quando o layout faz o primeiro paint e mede a área do deck, re-ancora no ponto real
    rerender(<DeckDealAnimation mode="shuffle" onDone={vi.fn()} origin={{ x: 920, y: 580 }} />);
    const stage3 = container.querySelector("[aria-hidden] > div") as HTMLElement;
    expect(stage3.style.left).toBe("920px");
    expect(stage3.style.top).toBe("580px");
  });
});

