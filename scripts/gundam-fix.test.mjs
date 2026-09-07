import { describe, expect, it } from "vitest";
import { FIX_ALLOWED_GLOBS, outOfScope, parseArgs } from "./gundam-fix.mjs";

describe("gundam:fix — scope guard", () => {
  it("aceita mudanças só em content/fixtures/predicates/repro", () => {
    const files = [
      "src/modules/simulator/content/st01.ts",
      "src/modules/simulator/content/predicates.ts",
      "src/modules/simulator/fixtures/st03Deck.ts",
      "src/modules/simulator/repro/BUG-X.test.ts",
    ];
    expect(outOfScope(files)).toEqual([]);
  });

  it("rejeita qualquer toque em engine/server/prisma", () => {
    const files = [
      "src/modules/simulator/content/st01.ts",
      "src/modules/simulator/engine/combat.ts",
      "server/index.ts",
      "prisma/schema.prisma",
    ];
    expect(outOfScope(files)).toEqual([
      "src/modules/simulator/engine/combat.ts",
      "server/index.ts",
      "prisma/schema.prisma",
    ]);
  });

  it("FIX_ALLOWED_GLOBS nunca inclui engine/", () => {
    expect(FIX_ALLOWED_GLOBS.some((g) => g.includes("/engine/"))).toBe(false);
  });

  it("parseArgs lê --open-pr, --base e --triage", () => {
    const a = parseArgs(["BUG-AB12", "--open-pr", "--base", "dev", "--triage", "./t.json"]);
    expect(a.shortCode).toBe("BUG-AB12");
    expect(a.openPr).toBe(true);
    expect(a.baseBranch).toBe("dev");
    expect(a.triagePath).toBe("./t.json");
  });

  it("parseArgs default: sem --open-pr é false, base é dev", () => {
    const a = parseArgs(["BUG-AB12"]);
    expect(a.openPr).toBe(false);
    expect(a.baseBranch).toBe("dev");
  });
});
