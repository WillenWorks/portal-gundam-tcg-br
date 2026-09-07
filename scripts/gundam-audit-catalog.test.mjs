import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(new URL("./gundam-audit-catalog.mjs", import.meta.url));

describe("gundam-audit-catalog", () => {
  it("roda limpo para ST01-04 (0 divergências nos arquivos locais) e sai com código 0", () => {
    // Sem DATABASE_URL de propósito — o audit não deve depender do Postgres.
    const env = { ...process.env };
    delete env.DATABASE_URL;
    const out = execFileSync(process.execPath, [scriptPath], { encoding: "utf8", env });
    expect(out).toContain("ST01-04 (arquivos locais): 0");
  });
});
