import { describe, expect, it } from "vitest";
import { aboutBody, cardBody, markdownToHtml, rulesBody, setBody, tournamentBody } from "./htmlContent.ts";
import { ABOUT_CONTACT, ABOUT_LEAD, ABOUT_SECTIONS, ABOUT_TITLE, ABOUT_UPDATED } from "../src/lib/aboutContent.ts";
import { matchSiteRoute } from "../src/lib/siteRoutes.ts";
import { renderHtml, resolveHtmlPage, type DetailLoaders } from "./htmlMeta.ts";

const TEMPLATE = `<!doctype html><html><head><title>Home</title></head><body><div id="root"><header>nav</header><main><section>texto genérico da home</section></main><footer>rodapé</footer></div></body></html>`;
const nada = async () => null;
const loaders = (over: Partial<DetailLoaders> = {}): DetailLoaders => ({
  card: nada, deck: nada, set: nada, series: nada, article: nada, tournament: nada, ...over,
});

describe("conteúdo das páginas no HTML", () => {
  it("página de detalhe troca o texto genérico pelo conteúdo dela, mantendo cabeçalho e rodapé", async () => {
    const page = await resolveHtmlPage("/sets/ST14", loaders({
      set: async () => ({ title: "Heavy Dominion (ST14)", body: setBody({ code: "ST14", name: "Heavy Dominion", cards: [{ id: "m1", code: "ST14-001", name: "Gundam", typeLabel: "Unidade", colorLabel: "Azul", level: 3, cost: 2 }] }) }),
    }));
    const html = renderHtml(TEMPLATE, page);
    expect(html).not.toContain("texto genérico da home");
    expect(html).toContain('<a href="/cards/m1"');
    expect(html).toContain("ST14-001");
    expect(html).toContain("<header>nav</header>");
    expect(html).toContain("<footer>rodapé</footer>");
  });

  it("página de lista usa o carregador de conteúdo; sem conteúdo, fica o texto do index.html", async () => {
    const comLista = await resolveHtmlPage("/rules", loaders(), async (path) => (path === "/rules" ? "<p>Breach</p>" : null));
    expect(renderHtml(TEMPLATE, comLista)).toContain("<p>Breach</p>");
    const semLista = await resolveHtmlPage("/stats", loaders(), async () => null);
    expect(renderHtml(TEMPLATE, semLista)).toContain("texto genérico da home");
  });

  it("`$` no conteúdo não vira padrão de substituição", () => {
    const html = renderHtml(TEMPLATE, { status: 200, title: "t", description: "", canonical: "c", image: "i", noindex: false, ogType: "website", jsonLd: [], body: "<p>custa $& e $1</p>" });
    expect(html).toContain("<p>custa $& e $1</p>");
  });

  it("escapa o texto das cartas", () => {
    const html = cardBody({ name: "<script>x</script>", code: "GD01-001", typeLabel: "Unidade", effectPt: "【Deploy】 Compre 1.\n\nSegundo parágrafo", prints: [], rulings: [{ title: "Pode?", question: "a < b", answer: "Sim" }] });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<p>【Deploy】 Compre 1.</p>");
    expect(html).toContain("a &lt; b");
  });

  it("torneio mostra classificação, campeão e arquétipos", () => {
    const html = tournamentBody({
      id: "t1", name: "Regional SP", entries: [
        { id: "e1", placement: 1, playerName: "Ana", wins: 5, losses: 0, archetype: "Azul/Branco", hasList: true },
        { id: "e2", placement: 2, playerName: "Bia", wins: 4, losses: 1, archetype: "Azul/Branco", hasList: false },
      ],
    });
    expect(html).toContain("Ana venceu com Azul/Branco.");
    expect(html).toContain('href="/torneios/t1/lista/e1"');
    expect(html).toContain("100%");
  });

  it("regras listam glossário e rulings", () => {
    const html = rulesBody({ keywords: [{ name: "Breach", raw: "<Breach N>", descriptionPt: "Causa dano ao escudo.", category: "effect_keyword" }], rulings: [{ id: "r1", title: "Breach e Blocker", answer: "Sim." }] });
    expect(html).toContain("&lt;Breach N&gt;");
    expect(html).toContain('href="/rules/r1"');
  });
});

describe("página Sobre", () => {
  it("existe como rota e o HTML traz todas as seções e o contato", () => {
    expect(matchSiteRoute("/sobre")).toEqual({ known: true });
    const html = aboutBody({ title: ABOUT_TITLE, lead: ABOUT_LEAD, updated: ABOUT_UPDATED, contact: ABOUT_CONTACT, sections: ABOUT_SECTIONS });
    for (const s of ABOUT_SECTIONS) expect(html).toContain(s.title);
    expect(html).toContain('href="/cards"');
    expect(html).toContain(`mailto:${ABOUT_CONTACT}`);
  });
});

describe("markdownToHtml", () => {
  it("títulos, listas, negrito e links seguros", () => {
    const html = markdownToHtml("# Título\n\nTexto **forte** e [link](https://x.com) e [ruim](javascript:alert(1)).\n\n- um\n- dois\n\n<div onclick=x>");
    expect(html).toContain("<h2>Título</h2>");
    expect(html).toContain("<strong>forte</strong>");
    expect(html).toContain('<a href="https://x.com"');
    expect(html).not.toContain("javascript:");
    expect(html).toContain("<ul><li>um</li><li>dois</li></ul>");
    expect(html).not.toContain("<div");
  });
});
