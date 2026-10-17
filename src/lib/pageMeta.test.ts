// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { applyPageMeta, isPrivatePath, routeMetaFor } from "./pageMeta";

describe("routeMetaFor", () => {
  it("marca rotas de conta e ferramentas como noindex", () => {
    for (const p of ["/admin", "/admin/cards", "/portal", "/profile", "/deckbuilder/abc", "/simulador/treino", "/u/willen", "/binder/x", "/login", "/redefinir-senha", "/eventos/1/tv", "/eventos/1/checkin"]) {
      expect(isPrivatePath(p), p).toBe(true);
    }
  });
  it("deixa as páginas públicas indexáveis", () => {
    for (const p of ["/", "/cards", "/cards/abc", "/deck/xyz", "/torneios", "/torneios/1", "/rules", "/sets/GD01", "/arquetipos/foo", "/administracao-nao"]) {
      expect(isPrivatePath(p), p).toBe(false);
    }
  });
  it("dá título por rota e canonical sem barra final", () => {
    expect(routeMetaFor("/cards").title).toBe("Catálogo de cartas");
    expect(routeMetaFor("/cards/abc/").path).toBe("/cards/abc");
    expect(routeMetaFor("/").title).toBeUndefined();
    expect(routeMetaFor("/ultimos-eventos").path).toBe("/");
  });
});

describe("applyPageMeta", () => {
  it("escreve title, description, canonical, og e robots no head", () => {
    applyPageMeta({ title: "GD01-001 Gundam", description: "  Unidade   azul ", path: "/cards/abc", image: "/uploads/x.png" });
    expect(document.title).toBe("GD01-001 Gundam · Anaheim Hub");
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("Unidade azul");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://anaheimhub.com/cards/abc");
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe("https://anaheimhub.com/uploads/x.png");
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("index, follow");
    applyPageMeta({ noindex: true, path: "/login" });
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
    expect(document.querySelectorAll('link[rel="canonical"]').length).toBe(1);
  });
});
