import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseArticle } from "./article-draft.mjs";

describe("article-draft: front matter", () => {
  it("lê título, slug, tipo, resumo, capa e o corpo", () => {
    const a = parseArticle('---\ntitle: "Título: com dois-pontos"\nslug: meu-artigo\npostType: GUIDE\nexcerpt: Resumo\ncover: capa.jpg\n---\n\n## Corpo\n');
    expect(a).toEqual({ title: "Título: com dois-pontos", slug: "meu-artigo", postType: "GUIDE", excerpt: "Resumo", cover: "capa.jpg", contentMd: "## Corpo" });
  });

  it("recusa slug inválido, tipo desconhecido e arquivo sem front matter", () => {
    expect(() => parseArticle("---\ntitle: X\nslug: Com Espaço\n---\ntexto")).toThrow(/Slug/);
    expect(() => parseArticle("---\ntitle: X\nslug: x\npostType: BLOG\n---\ntexto")).toThrow(/postType/);
    expect(() => parseArticle("# sem front matter")).toThrow(/front matter/);
  });

  it("os artigos de content/articles são válidos e a capa existe", () => {
    const dir = path.resolve("content/articles");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const a = parseArticle(fs.readFileSync(path.join(dir, f), "utf8"));
      if (a.cover) expect(fs.existsSync(path.join(dir, a.cover)), `${f}: capa ${a.cover}`).toBe(true);
    }
  });
});
