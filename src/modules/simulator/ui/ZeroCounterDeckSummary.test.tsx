// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ZeroCounterDeckSummary } from "./ZeroCounterDeckSummary";
import { zeroCounterNotice } from "./zeroCounterText";

afterEach(cleanup);

describe("zeroCounterNotice", () => {
  it("counter: persona e arquétipo, sem citar o deck", () => {
    const text = zeroCounterNotice({ persona: "amuro", archetype: "aggro", fallback: false });
    expect(text).toContain("Amuro");
    expect(text).toContain("agressivo");
  });
  it("fallback: avisa que usa um deck meta", () => {
    expect(zeroCounterNotice({ persona: "heero", archetype: "tempo", fallback: true })).toMatch(/deck meta/);
  });
});

describe("ZeroCounterDeckSummary", () => {
  const entries = [
    { code: "U1", name: "Gundam", cardType: "UNIT", count: 4 },
    { code: "U2", name: "Zaku", cardType: "UNIT", count: 2 },
    { code: "P1", name: "Amuro Ray", cardType: "PILOT", count: 3 },
    { code: "C1", name: "Beam Rifle", cardType: "COMMAND", count: 1 },
  ];

  it("agrupa por tipo com contagem", () => {
    render(<ZeroCounterDeckSummary counter={{ counterDeckId: "ST01", fallback: false }} entries={entries} />);
    expect(screen.getByRole("region", { name: "Deck do Zero System" })).toBeInTheDocument();
    expect(screen.getByText("Units (6)")).toBeInTheDocument();
    expect(screen.getByText("Pilots (3)")).toBeInTheDocument();
    expect(screen.getByText("Comandos (1)")).toBeInTheDocument();
    expect(screen.getByText(/counter do seu deck/)).toBeInTheDocument();
  });

  it("fallback indica deck meta", () => {
    render(<ZeroCounterDeckSummary counter={{ counterDeckId: "META-X", fallback: true }} entries={entries} />);
    expect(screen.getByText(/deck meta/)).toBeInTheDocument();
  });
});
