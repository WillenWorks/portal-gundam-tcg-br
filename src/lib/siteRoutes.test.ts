import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SITE_ROUTES, matchSiteRoute } from "./siteRoutes";

describe("SITE_ROUTES", () => {
  it("cobre todas as rotas do App.tsx (a não ser a /:section, tratada à parte)", () => {
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    const appPaths = [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== "/:section");
    const known = new Set(SITE_ROUTES.map((r) => r.path));
    expect(appPaths.filter((p) => !known.has(p))).toEqual([]);
  });
});

describe("matchSiteRoute", () => {
  it("reconhece páginas fixas, seções da home e barra final", () => {
    expect(matchSiteRoute("/")).toEqual({ known: true });
    expect(matchSiteRoute("/cards/")).toEqual({ known: true });
    expect(matchSiteRoute("/ultimos-eventos")).toEqual({ known: true });
  });

  it("devolve o tipo e a chave das páginas de detalhe", () => {
    expect(matchSiteRoute("/cards/abc123")).toEqual({ known: true, detail: "card", key: "abc123" });
    expect(matchSiteRoute("/deck/xyz")).toEqual({ known: true, detail: "deck", key: "xyz" });
    expect(matchSiteRoute("/sets/GD01")).toEqual({ known: true, detail: "set", key: "GD01" });
    expect(matchSiteRoute("/series/mobile-suit-gundam")).toEqual({ known: true, detail: "series", key: "mobile-suit-gundam" });
    expect(matchSiteRoute("/articles/guia%20inicial")).toEqual({ known: true, detail: "article", key: "guia inicial" });
    expect(matchSiteRoute("/torneios/t1")).toEqual({ known: true, detail: "tournament", key: "t1" });
    expect(matchSiteRoute("/torneios/t1/lista/e1")).toEqual({ known: true });
  });

  it("não reconhece endereços inexistentes", () => {
    expect(matchSiteRoute("/cartas")).toEqual({ known: false });
    expect(matchSiteRoute("/cards/a/b")).toEqual({ known: false });
    expect(matchSiteRoute("/wp-admin")).toEqual({ known: false });
    expect(matchSiteRoute("/cards/%E0%A4%A")).toEqual({ known: false });
  });
});
