import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { computeEngineSha } from "./engineHash.mjs";

function fakeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "engine-sha-"));
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  write("src/modules/simulator/engine/actions.ts", "export const a = 1;\n");
  write("src/modules/simulator/content/st01.ts", "export const c = 1;\n");
  write("src/modules/simulator/engine/bot/policy.ts", "export const p = 1;\n");
  write("src/pages/Home.tsx", "export const h = 1;\n");
  return { root, write };
}

describe("computeEngineSha (versão das regras para o treino)", () => {
  it("muda quando muda regra ou carta", () => {
    const { root, write } = fakeRepo();
    const before = computeEngineSha(root, {});
    write("src/modules/simulator/content/st01.ts", "export const c = 2;\n");
    expect(computeEngineSha(root, {})).not.toBe(before);
  });

  it("não muda com UI, bot ou fim de linha CRLF", () => {
    const { root, write } = fakeRepo();
    const before = computeEngineSha(root, {});
    write("src/pages/Home.tsx", "export const h = 2;\n");
    write("src/modules/simulator/engine/bot/policy.ts", "export const p = 2;\n");
    write("src/modules/simulator/engine/actions.ts", "export const a = 1;\r\n");
    expect(computeEngineSha(root, {})).toBe(before);
  });

  it("TRAIN_ENGINE_SHA força o valor", () => {
    const { root } = fakeRepo();
    expect(computeEngineSha(root, { TRAIN_ENGINE_SHA: "rules-fixo" })).toBe("rules-fixo");
  });
});
