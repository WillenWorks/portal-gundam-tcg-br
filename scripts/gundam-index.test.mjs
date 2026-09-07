import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { buildSignatures, serializeSignatures, INDEX_PATH } from "./gundam-index.mjs";
import { ALL_EFFECT_SPECS } from "../src/modules/simulator/content/index.ts";

const scriptPath = fileURLToPath(new URL("./gundam-index.mjs", import.meta.url));

function generate() {
  return execFileSync(process.execPath, [scriptPath, "--stdout"], { encoding: "utf8" });
}

describe("gundam-index", () => {
  it("é idempotente — rodar 2x produz exatamente o mesmo JSON", () => {
    const first = generate();
    const second = generate();
    expect(second).toBe(first);
  });

  it("o arquivo versionado bate com a geração atual (sem diff espúrio)", () => {
    expect(generate()).toBe(readFileSync(INDEX_PATH, "utf8"));
  });

  it("toda spec de ALL_EFFECT_SPECS aparece no índice, ordenado por id", () => {
    const signatures = buildSignatures(ALL_EFFECT_SPECS);
    expect(signatures).toHaveLength(ALL_EFFECT_SPECS.length);

    const indexed = new Set(signatures.map((s) => s.id));
    for (const spec of ALL_EFFECT_SPECS) {
      expect(indexed.has(spec.id)).toBe(true);
    }

    const ids = signatures.map((s) => s.id);
    expect(ids).toEqual([...ids].sort());
  });

  it("serializeSignatures é determinístico e termina com newline", () => {
    const a = serializeSignatures(buildSignatures(ALL_EFFECT_SPECS));
    const b = serializeSignatures(buildSignatures(ALL_EFFECT_SPECS));
    expect(a).toBe(b);
    expect(a.endsWith("\n")).toBe(true);
  });

  it("a assinatura captura ops (cost + condition + actions) e predicate", () => {
    const bySpec = new Map(buildSignatures(ALL_EFFECT_SPECS).map((s) => [s.id, s]));

    // ST01-015 White Base 【Activate･Main】: cost payResourceCost + action spawnTokenByOwnUnitCount
    expect(bySpec.get("ST01-015-ActivateMain").ops).toEqual(["payResourceCost", "spawnTokenByOwnUnitCount"]);

    // ST01-002 Gundam (MA Form): condition.then draw, com predicate
    const maForm = bySpec.get("ST01-002-WhenPaired");
    expect(maForm.ops).toEqual(["draw"]);
    expect(maForm.predicate).toBe("pairedPilotHasTrait:White Base Team");

    // ST03-015 Rewloola 【Deploy】: targetFilter preservado
    expect(bySpec.get("ST03-015-Deploy").targetFilter).toBe("ap<=5");
  });
});
