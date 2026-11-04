import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("gundam-faq-trace", () => {
  it("todo Q&A do GD06 é citado em teste", () => {
    const output = execFileSync(process.execPath, ["scripts/gundam-faq-trace.mjs", "GD06", "--gate"], { encoding: "utf8" });
    expect(output).toContain("60/60");
  });
});
