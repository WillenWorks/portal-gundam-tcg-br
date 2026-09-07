import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(new URL("./gundam-coverage.mjs", import.meta.url));

function run(args) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [scriptPath, ...args], { encoding: "utf8" }) };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("gundam-coverage", () => {
  it("gate passa: ST01–ST04 sem 'faltando' e toda cláusula deferida é trecho literal do texto EN oficial", () => {
    const { code, out } = run(["--gate"]);
    expect(out, out).not.toContain("NÃO são trecho literal");
    for (const set of ["ST01", "ST02", "ST03", "ST04"]) {
      expect(out).toContain(`[coverage] ${set}:`);
      expect(out).not.toMatch(new RegExp(`\\[coverage\\] ${set}:.*faltando ❌`));
    }
    expect(code).toBe(0);
  });
});
