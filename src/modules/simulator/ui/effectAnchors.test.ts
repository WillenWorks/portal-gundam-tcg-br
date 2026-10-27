import { describe, expect, it } from "vitest";
import type { ViewGameState } from "../engine/viewState";
import { effectAnchorKey, onFieldIds } from "./effectAnchors";

const empty = { battleArea: [], baseSection: [], trash: [], exile: [] };
const view = {
  players: {
    A: { ...empty, battleArea: [{ instanceId: "A-u1", pairedPilotId: "A-p1" }], baseSection: [{ instanceId: "A-base" }], trash: [{ instanceId: "A-cmd" }] },
    B: { ...empty, battleArea: [{ instanceId: "B-e1" }], exile: [{ instanceId: "B-x" }] },
  },
} as unknown as ViewGameState;

describe("effectAnchorKey — onde a linha do efeito encosta", () => {
  it("Unit, Piloto (na Unit dele), Base, lixeira e exílio", () => {
    expect(effectAnchorKey(view, "A-u1")).toBe("A-u1");
    expect(effectAnchorKey(view, "A-p1")).toBe("A-u1");
    expect(effectAnchorKey(view, "A-base")).toBe("base:A");
    expect(effectAnchorKey(view, "A-cmd")).toBe("trashStation:A");
    expect(effectAnchorKey(view, "B-x")).toBe("exileStation:B");
    expect(effectAnchorKey(view, "B-sumiu")).toBeNull();
    expect(effectAnchorKey(view, "B-sumiu", "B")).toBe("trashStation:B");
  });

  it("cartas no campo", () => {
    expect([...onFieldIds(view)].sort()).toEqual(["A-base", "A-p1", "A-u1", "B-e1"]);
  });
});
