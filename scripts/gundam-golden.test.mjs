import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(new URL("./gundam-golden.mjs", import.meta.url));

function run(args) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [scriptPath, ...args], { encoding: "utf8" }) };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("gundam-golden", () => {
  it("check passa no estado atual (10 pares conferem com hashes.json)", () => {
    const { code, out } = run([]);
    expect(out, out).toContain("10 pares conferem com hashes.json");
    expect(out).not.toContain("DIVERGÊNCIA");
    expect(code).toBe(0);
  });

  it("é determinístico: duas execuções seguidas dão o mesmo relatório de hashes", () => {
    const shaLines = (out) =>
      out
        .split("\n")
        .filter((l) => l.includes(" sha="))
        .join("\n");
    const first = run([]);
    const second = run([]);
    expect(shaLines(second.out)).toBe(shaLines(first.out));
  });
});
