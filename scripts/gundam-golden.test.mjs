import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(new URL("./gundam-golden.mjs", import.meta.url));
const hashesPath = fileURLToPath(new URL("../src/modules/simulator/engine/__golden__/hashes.json", import.meta.url));

function run(args) {
  try {
    return { code: 0, out: execFileSync(process.execPath, [scriptPath, ...args], { encoding: "utf8" }) };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

/**
 * Número de pares esperado, lido de `hashes.json` — NUNCA hardcoded (docs/
 * debates 2026-09-13: esta asserção já ficou desatualizada 1x, "10 pares"
 * depois que a wave GD01 levou o total a 15, quebrando o teste até alguém
 * lembrar de trocar o número à mão). `gundam-golden.mjs` roda contra
 * `GOLDEN_PAIRS` (harness.ts) e cai no mesmo total quando o motor está
 * saudável — ler `hashes.json` direto aqui é a mesma fonte de verdade que o
 * script usa (`readHashes()`), só sem precisar exportar a função de um
 * script que roda como CLI standalone.
 */
function currentGoldenPairCount() {
  return Object.keys(JSON.parse(readFileSync(hashesPath, "utf8"))).length;
}

describe("gundam-golden", () => {
  it("check passa no estado atual (todos os pares de hashes.json conferem)", () => {
    const expectedPairs = currentGoldenPairCount();
    const { code, out } = run([]);
    expect(out, out).toContain(`${expectedPairs} pares conferem com hashes.json`);
    expect(out).not.toContain("DIVERGÊNCIA");
    expect(code).toBe(0);
  }, 60000);

  it("é determinístico: duas execuções seguidas dão o mesmo relatório de hashes", () => {
    const shaLines = (out) =>
      out
        .split("\n")
        .filter((l) => l.includes(" sha="))
        .join("\n");
    const first = run([]);
    const second = run([]);
    expect(shaLines(second.out)).toBe(shaLines(first.out));
  }, 60000);
});
