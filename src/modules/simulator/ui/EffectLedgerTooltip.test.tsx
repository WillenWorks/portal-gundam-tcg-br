// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { LedgerEntry } from "../scene/effectLedger";
import { EffectLedgerTooltip } from "./EffectLedgerTooltip";

afterEach(cleanup);

const rect = { left: 100, right: 180, top: 200, bottom: 310, width: 80, height: 110, x: 100, y: 200, toJSON: () => ({}) } as DOMRect;
const names: Record<string, string> = { "B-kayra": "Kayra's Jegan", "B-murasame": "Murasame" };
const nameOf = (id: string) => names[id];
const entries: LedgerEntry[] = [
  {
    id: "fx-1",
    source: { instanceId: "B-kayra", player: "B", trigger: "Deploy" },
    targetId: "B-murasame",
    effect: { kind: "attackTargetRelax", maxAp: 4 },
    scope: "turn",
  },
];

describe("EffectLedgerTooltip — quem causou, o que faz, até quando (BUG-GERVVQ)", () => {
  it("no alvo: a fonte com o gatilho, o efeito e a duração", () => {
    render(<EffectLedgerTooltip cardId="B-murasame" entries={entries} anchor={rect} nameOf={nameOf} />);
    const tip = screen.getByTestId("effect-ledger-tooltip");
    expect(tip).toHaveTextContent("Kayra's Jegan 【Deploy】");
    expect(tip).toHaveTextContent("pode atacar Unit inimiga ativa com AP 4 ou menos");
    expect(tip).toHaveTextContent("neste turno");
  });

  it("na fonte: em quem ela aplicou", () => {
    render(<EffectLedgerTooltip cardId="B-kayra" entries={entries} anchor={rect} nameOf={nameOf} />);
    expect(screen.getByTestId("effect-ledger-tooltip")).toHaveTextContent("Causou em Murasame");
  });

  it("carta sem efeito: nada", () => {
    render(<EffectLedgerTooltip cardId="A-outra" entries={entries} anchor={rect} nameOf={nameOf} />);
    expect(screen.queryByTestId("effect-ledger-tooltip")).toBeNull();
  });
});
