import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

describe("Política de Privacidade", () => {
  const fragment = readFileSync("src/legal/privacy-policy.html", "utf8");
  const page = readFileSync("public/privacidade/index.html", "utf8");

  it("a página estática tem o mesmo texto da fonte (rode scripts/sync-privacy-policy.mjs)", () => {
    const start = page.indexOf("-->", page.indexOf("<!-- POLICY:START")) + 3;
    const end = page.indexOf("<!-- POLICY:END -->");
    expect(squash(page.slice(start, end))).toBe(squash(fragment));
  });

  it("identifica o controlador, o canal do titular e onde os dados ficam", () => {
    expect(fragment).toContain("Willen Leolatto");
    expect(fragment).toContain("admin@anaheimhub.com");
    expect(fragment).toContain("São Paulo, Brasil");
    expect(fragment).toContain("Cloudflare");
  });
});
