import { describe, expect, it } from "vitest";
import { mulliganRedraws } from "./openingScene";
import { coinTossMs, dealHandMs, dealShieldsMs, mulliganRedrawMs, openingIntroMs, SCENE_MS, setupFinishMs, turnStartMs } from "./sceneTiming";

describe("abertura — quem trocou a mão e quanto cada parte dura", () => {
  it("só conta quem trocou de verdade", () => {
    expect(
      mulliganRedraws([
        { type: "MULLIGAN_RESOLVED", player: "A", redraw: false },
        { type: "CLEAR_PENDING_DECISION", player: "B" },
        { type: "MULLIGAN_RESOLVED", player: "B", redraw: true },
      ]),
    ).toEqual(["B"]);
    expect(mulliganRedraws([])).toEqual([]);
  });

  it("as durações somam as etapas da tela (a mesma tabela que o servidor espera)", () => {
    const o = SCENE_MS.opening;
    expect(dealHandMs()).toBe(4 * o.dealStagger + o.flight + o.handRevealHold);
    expect(openingIntroMs()).toBe(o.fieldReady + coinTossMs() + o.fieldHighlight + o.deckAppear + o.shuffle + dealHandMs() + o.handRevealed);
    expect(mulliganRedrawMs()).toBe(o.mulliganReturn + o.shuffle + dealHandMs());
    expect(setupFinishMs()).toBe(dealShieldsMs() + o.exReveal + turnStartMs());
  });
});
