import { describe, expect, it } from "vitest";
import { tournamentListLimit } from "./tournamentsList.ts";

describe("tournamentListLimit", () => {
  it("só devolve valores da lista permitida", () => {
    const values = new Set<number | null>();
    for (let n = 1; n <= 1000; n++) values.add(tournamentListLimit(String(n), false));
    expect([...values].sort()).toEqual([100, 200, 50]);
  });

  it("arredonda para cima", () => {
    expect(tournamentListLimit("51", false)).toBe(100);
    expect(tournamentListLimit("50", false)).toBe(50);
  });

  it("lista completa só para quem administra", () => {
    expect(tournamentListLimit(undefined, true)).toBeNull();
    expect(tournamentListLimit(undefined, false)).toBe(50);
    expect(tournamentListLimit("abc", false)).toBe(50);
    expect(tournamentListLimit("-5", false)).toBe(50);
  });
});
