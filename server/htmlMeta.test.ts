import { describe, expect, it, vi } from "vitest";
import { absoluteUrl, createPageCache, DEFAULT_OG_IMAGE, renderHtml, resolveHtmlPage, type DetailLoaders } from "./htmlMeta.ts";

const TEMPLATE = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="description"
      content="descrição da home"
    />
    <title>Título da home</title>
    <link rel="canonical" href="https://anaheimhub.com/" />
    <meta property="og:title" content="og da home" />
    <meta property="og:url" content="https://anaheimhub.com" />
    <script type="module" src="/assets/index.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>`;

const nada = async () => null;
const loaders = (over: Partial<DetailLoaders> = {}): DetailLoaders => ({
  card: nada, deck: nada, set: nada, series: nada, article: nada, tournament: nada, ...over,
});

describe("resolveHtmlPage", () => {
  it("página fixa usa o título da rota e canônico sem barra final", async () => {
    const page = await resolveHtmlPage("/cards/", loaders());
    expect(page.status).toBe(200);
    expect(page.title).toContain("Catálogo de cartas");
    expect(page.canonical).toBe("https://anaheimhub.com/cards");
    expect(page.noindex).toBe(false);
  });

  it("home e seções da home apontam para a raiz", async () => {
    expect((await resolveHtmlPage("/", loaders())).canonical).toBe("https://anaheimhub.com/");
    expect((await resolveHtmlPage("/ultimos-eventos", loaders())).canonical).toBe("https://anaheimhub.com/");
  });

  it("rota privada fica fora do Google", async () => {
    expect((await resolveHtmlPage("/deckbuilder", loaders())).noindex).toBe(true);
  });

  it("endereço inexistente é 404 sem indexar", async () => {
    const page = await resolveHtmlPage("/cartas", loaders());
    expect(page.status).toBe(404);
    expect(page.noindex).toBe(true);
  });

  it("detalhe usa os dados do item, imagem absoluta e trilha de navegação", async () => {
    const card = vi.fn(async () => ({ title: "Gundam (GD01-001)", description: "Unidade azul", image: "/uploads/gd01-001.webp" }));
    const page = await resolveHtmlPage("/cards/abc", loaders({ card }));
    expect(card).toHaveBeenCalledWith("abc");
    expect(page.title).toContain("Gundam (GD01-001)");
    expect(page.description).toBe("Unidade azul");
    expect(page.image).toBe("https://anaheimhub.com/uploads/gd01-001.webp");
    expect(page.jsonLd[0]).toMatchObject({ "@type": "BreadcrumbList" });
    expect(JSON.stringify(page.jsonLd[0])).toContain("Cartas");
  });

  it("item que não existe é 404", async () => {
    expect((await resolveHtmlPage("/deck/naoexiste", loaders())).status).toBe(404);
  });

  it("imagem inválida cai na padrão", async () => {
    const deck = async () => ({ title: "Meu deck", image: "data:image/png;base64,AAA" });
    expect((await resolveHtmlPage("/deck/x", loaders({ deck }))).image).toBe(DEFAULT_OG_IMAGE);
  });
});

describe("renderHtml", () => {
  it("troca os metadados e mantém o resto do arquivo", async () => {
    const page = await resolveHtmlPage("/cards/abc", loaders({ card: async () => ({ title: 'Zaku "II" <Char>', description: "x" }) }));
    const html = renderHtml(TEMPLATE, page);
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).toContain("Zaku &quot;II&quot; &lt;Char&gt;");
    expect(html).not.toContain("descrição da home");
    expect(html).not.toContain("og da home");
    expect(html).toContain('<link rel="canonical" href="https://anaheimhub.com/cards/abc" />');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('<script type="module" src="/assets/index.js"></script>');
  });

  it("JSON-LD não deixa fechar a tag script", async () => {
    const page = await resolveHtmlPage("/cards/abc", loaders({ card: async () => ({ title: "</script><script>alert(1)</script>" }) }));
    const html = renderHtml(TEMPLATE, page);
    expect(html).not.toContain("</script><script>alert(1)");
  });

  it("404 leva noindex", async () => {
    const html = renderHtml(TEMPLATE, await resolveHtmlPage("/nao-existe", loaders()));
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
  });
});

describe("absoluteUrl", () => {
  it("aceita http(s) e caminho do site; recusa o resto", () => {
    expect(absoluteUrl("https://cdn.x/a.png")).toBe("https://cdn.x/a.png");
    expect(absoluteUrl("/a.png")).toBe("https://anaheimhub.com/a.png");
    expect(absoluteUrl("data:image/png;base64,AA")).toBeNull();
    expect(absoluteUrl(null)).toBeNull();
  });
});

describe("createPageCache", () => {
  it("reaproveita dentro do prazo e não guarda erro", async () => {
    let t = 0;
    const cache = createPageCache(1000, 10, () => t);
    const build = vi.fn(async () => resolveHtmlPage("/", loaders()));
    await cache("/", build);
    await cache("/", build);
    expect(build).toHaveBeenCalledTimes(1);
    t = 2000;
    await cache("/", build);
    expect(build).toHaveBeenCalledTimes(2);
    const falha = vi.fn().mockRejectedValueOnce(new Error("db")).mockImplementation(async () => resolveHtmlPage("/", loaders()));
    await expect(cache("/x", falha)).rejects.toThrow("db");
    await expect(cache("/x", falha)).resolves.toBeTruthy();
  });
});
