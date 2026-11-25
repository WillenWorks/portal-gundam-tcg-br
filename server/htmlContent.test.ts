import { describe, expect, it } from "vitest";
import { aboutBody, archetypeBody, archetypesIndexBody, cardBody, decklistBody, metagameStatsBody, regionalMetaBody, markdownToHtml, playerBody, rulesBody, setBody, supportBody, supportersBody, tournamentBody } from "./htmlContent.ts";
import { SUPPORTERS_LEAD, SUPPORTERS_TITLE, groupSupportersByTier, SUPPORT_LEAD, SUPPORT_TITLE, SUPPORT_WHY, supportChannels } from "../src/lib/supportContent.ts";
import { ABOUT_CONTACT, ABOUT_LEAD, ABOUT_SECTIONS, ABOUT_TITLE, ABOUT_UPDATED } from "../src/lib/aboutContent.ts";
import { matchSiteRoute } from "../src/lib/siteRoutes.ts";
import { renderHtml, resolveHtmlPage, stripAdsBlock, type DetailLoaders } from "./htmlMeta.ts";

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

describe("anúncios só em telas com conteúdo", () => {
  const ADS = `<!-- anuncios:inicio (x) -->\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1" crossorigin="anonymous"></script>\n<!-- anuncios:fim -->`;
  const TPL = `<html><head>${ADS}</head><body><div id="root"><main>x</main></div></body></html>`;
  const base = { title: "t", description: "", canonical: "c", image: "i", ogType: "website" as const, jsonLd: [] };
  it("tira o script em página noindex e em erro; mantém em página de conteúdo", () => {
    expect(renderHtml(TPL, { ...base, status: 200, noindex: true })).not.toContain("adsbygoogle.js");
    expect(renderHtml(TPL, { ...base, status: 404, noindex: true })).not.toContain("adsbygoogle.js");
    expect(renderHtml(TPL, { ...base, status: 200, noindex: false })).toContain("adsbygoogle.js");
  });
  it("corta só entre os marcadores; sem marcador de fim, não mexe", () => {
    expect(stripAdsBlock(`a${ADS}b${ADS}c`)).toBe("abc");
    expect(stripAdsBlock("a<!-- anuncios:inicio -->b")).toBe("a<!-- anuncios:inicio -->b");
  });
  it("login (rota privada) e endereço inexistente saem sem o script", async () => {
    const tpl = `<html><head>${ADS}</head><body></body></html>`;
    expect(renderHtml(tpl, await resolveHtmlPage("/login", loaders()))).not.toContain("adsbygoogle");
    expect(renderHtml(tpl, await resolveHtmlPage("/nao-existe/de-jeito-nenhum", loaders()))).not.toContain("adsbygoogle");
    expect(renderHtml(tpl, await resolveHtmlPage("/sobre", loaders()))).toContain("adsbygoogle");
  });
});

describe("páginas com título próprio pelo carregador de conteúdo", () => {
  it("título, descrição, noindex e 404", async () => {
    const page = await resolveHtmlPage("/jogadores/ana", loaders(), async () => ({ body: "<p>ok</p>", title: "Ana — resultados", description: "d", noindex: true }));
    expect(page).toMatchObject({ title: expect.stringContaining("Ana — resultados"), description: "d", noindex: true, body: "<p>ok</p>" });
    expect((await resolveHtmlPage("/arquetipos/x", loaders(), async () => ({ notFound: true }))).status).toBe(404);
  });
  it("arquétipo e jogador com dados, links e escape", () => {
    const a = archetypeBody({
      name: "Azul <Academy>", colors: ["blue", "white"], lists: 12, share: 0.25, wins: 2, top8Share: 0.5,
      sample: { tournaments: 6, from: "2026-09-01", to: "2026-11-01" },
      cards: [{ cardModelId: "m1", code: "GD03-001", name: "Aerial", inclusion: 1, avgCopies: 4, tier: "core" }],
      results: [{ tournamentId: "t1", tournamentName: "Regional", date: "2026-11-01", placementLabel: "1º", player: { name: "Ana", slug: "ana" } }],
    });
    expect(a).toContain("Azul &lt;Academy&gt;");
    expect(a).toContain("25% do metagame");
    expect(a).toContain("Base do deck: Aerial");
    expect(a).toContain('href="/cards/m1"');
    expect(a).toContain('href="/jogadores/ana"');
    const p = playerBody({ name: "Ana", tournaments: 3, wins: 1, top8: 2, archetypes: [{ name: "Azul", slug: "azul", count: 2 }], results: [{ tournamentId: "t1", tournamentName: "Regional", date: null, placementLabel: "1º", record: "5-0", archetype: { name: "Azul", slug: "azul" } }] });
    expect(p).toContain("3 torneios, 1 título e 2 top 8");
    expect(p).toContain('href="/arquetipos/azul"');
    expect(archetypesIndexBody([{ name: "Azul", slug: "azul", colors: ["blue"], lists: 4, share: 0.5, wins: 1, top8Share: 0.25 }], { tournaments: 2, lists: 8 })).toContain("8 listas de 2 torneios");
  });
});

describe("página Apoie", () => {
  it("só mostra os canais configurados e só aceita https", () => {
    const none = supportChannels({});
    expect(none.map((c) => c.title)).toEqual(["Mandar correções e resultados"]);
    const all = supportChannels({ supportUrl: "https://apoia.se/anaheimhub", pixKey: "pix@anaheimhub.com", instagramUrl: "javascript:alert(1)", discordUrl: "https://discord.gg/x" });
    expect(all.map((c) => c.title)).toEqual(["Apoio mensal no Apoia.se", "Pix", "Comunidade no Discord", "Mandar correções e resultados"]);
    expect(matchSiteRoute("/apoie")).toEqual({ known: true });
    const html = supportBody({ title: SUPPORT_TITLE, lead: SUPPORT_LEAD, why: SUPPORT_WHY, channels: all });
    expect(html).toContain("<code>pix@anaheimhub.com</code>");
    expect(html).not.toContain("javascript:");
  });

  it("patentes e mural de apoiadores entram no HTML (o mural vem do banco)", () => {
    const html = supportBody({
      title: SUPPORT_TITLE, lead: SUPPORT_LEAD, why: SUPPORT_WHY, channels: supportChannels({}),
      tiers: [{ icon: "🎖️", label: "Recruta", minMonthly: 5, perks: ["Seu nome no mural"] }],
      supporters: [{ name: "Char <Zeon>", tierLabel: "Comandante" }, { name: "Fã sem patente" }],
    });
    expect(html).toContain("Patentes de apoiador");
    expect(html).toContain("Recruta — R$ 5/mês");
    expect(html).toContain("<li>Char &lt;Zeon&gt; — Comandante</li>");
    expect(html).toContain("<li>Fã sem patente</li>");
  });

  it("/apoiadores: agrupa por patente (mais alta primeiro), conta vira link e nome sem conta é só texto", () => {
    const groups = groupSupportersByTier([
      { name: "Fã", tier: "RECRUTA" },
      { name: "Char", username: "char", tier: "COMANDANTE", message: "Sieg <Zeon>" },
      { name: "Kai", username: "kai", tier: null },
      { name: "Sayla", tier: "AS" },
    ]);
    expect(groups.map((g) => [g.title, g.supporters.map((p) => p.name)])).toEqual([
      ["Comandantes", ["Char"]], ["Ases", ["Sayla"]], ["Recrutas", ["Fã"]], ["Apoiadores", ["Kai"]],
    ]);
    const html = supportersBody({ title: SUPPORTERS_TITLE, lead: SUPPORTERS_LEAD, groups });
    expect(html).toContain("👑 Comandantes (1)");
    expect(html).toContain('href="/u/char"');
    expect(html).toContain("“Sieg &lt;Zeon&gt;”");
    expect(html).toContain("<li>Fã</li>");
    expect(html).toContain('href="/apoie"');
    expect(matchSiteRoute("/apoiadores")).toEqual({ known: true });
  });

  it("/apoiadores vazio convida a ser o primeiro", () => {
    expect(supportersBody({ title: SUPPORTERS_TITLE, lead: SUPPORTERS_LEAD, groups: [] })).toContain("o primeiro nome aqui pode ser o seu");
  });

  it("sem apoiadores, a seção do mural não aparece", () => {
    expect(supportBody({ title: SUPPORT_TITLE, lead: SUPPORT_LEAD, why: SUPPORT_WHY, channels: supportChannels({}), supporters: [] })).not.toContain("Mural de apoiadores");
  });
});

describe("decklistBody", () => {
  it("mostra jogador, colocação, campanha e as cartas com link para cada uma", () => {
    const html = decklistBody({
      tournament: { id: "t1", name: "Regional SP", date: "10/11/2026" }, playerName: "Ana", placement: 1, wins: 5, losses: 0, archetype: "Aerial",
      totalPlayers: 32,
      items: [
        { quantity: 4, section: "main", card: { id: "m1", code: "GD01-001", name: "Gundam", typeLabel: "Unidade" } },
        { quantity: 10, section: "resource", card: { id: "r1", code: "R-001", name: "Recurso", typeLabel: "Recurso" } },
      ],
    });
    expect(html).toContain("1º lugar entre 32 jogadores, com campanha 5-0");
    expect(html).toContain("Arquétipo: Aerial");
    expect(html).toContain('href="/cards/m1"');
    expect(html).toContain("Deck principal (4 cartas)");
    expect(html).toContain('href="/torneios/t1"');
  });
});

describe("metagameStatsBody", () => {
  const base = { seasonName: "GD03", totalDecks: 0, totalTournaments: 0, topCards: [], colors: [], combos: [], traits: [], rising: [], tournaments: [] };

  it("mostra a amostra, as cartas mais jogadas e os torneios de origem", () => {
    const html = metagameStatsBody({
      ...base, totalDecks: 120, totalTournaments: 6, period: "de 1 a 30 de outubro",
      topCards: [{ id: "m1", code: "GD01-001", name: "Gundam", colorLabel: "Azul", presenceRate: 45.5, avgCopies: 3.5, winRate: 52 }],
      colors: [{ label: "Azul", decks: 60, presenceRate: 50 }],
      rising: [{ id: "m2", code: "GD03-010", name: "Aerial", colorLabel: "Branco", presenceRate: 30, delta: 12.5 }],
      tournaments: [{ id: "t1", name: "Regional SP", date: "10/10", decks: 32 }],
    });
    expect(html).toContain("120 listas usadas em 6 torneios");
    expect(html).toContain('href="/cards/m1"');
    expect(html).toContain("45,5%");
    expect(html).toContain("subiu 12,5 pontos");
    expect(html).toContain('href="/torneios/t1"');
  });

  it("sem listas explica o que a página vai mostrar", () => {
    expect(metagameStatsBody(base)).toContain("Ainda não há listas de torneio");
  });
});

describe("regionalMetaBody", () => {
  it("compara estados com a média nacional", () => {
    const region = (label: string, totalDecks: number) => ({ label, totalDecks, winRate: 50, colors: [{ label: "Azul", decks: 5, presenceRate: 40 }], topCards: [{ id: "m1", code: "", name: "Gundam", colorLabel: "Azul", presenceRate: 60 }] });
    const html = regionalMetaBody({
      seasonName: "GD03", totalDecks: 40, national: region("Brasil", 40), states: [region("São Paulo", 25)], cities: [region("Campinas", 10)],
      anomalies: [{ scope: "São Paulo", label: "Vermelho", regionRate: 30, nationalRate: 15, deltaPp: 15 }],
    });
    expect(html).toContain("40 listas de torneio");
    expect(html).toContain("São Paulo");
    expect(html).toContain("Campinas");
    expect(html).toContain("contra 15% no país (+15 pontos)");
  });
});


describe("pré-carregamento da imagem principal", () => {
  it("a home mantém o texto genérico e ganha o <link rel=preload> com srcset e sizes, escapados", async () => {
    const page = await resolveHtmlPage("/", loaders(), async (path) =>
      path === "/" ? { preloadImages: [{ href: "/uploads/a.jpg?w=320" }, { href: "/uploads/a.jpg?w=960", srcset: "/uploads/a.jpg?w=320 320w", sizes: "100vw" }] } : null,
    );
    const html = renderHtml(TEMPLATE, page);
    expect(html).toContain("texto genérico da home");
    expect(html).toContain('<link rel="preload" as="image" href="/uploads/a.jpg?w=320" fetchpriority="high" />');
    expect(html).toContain('<link rel="preload" as="image" href="/uploads/a.jpg?w=960" imagesrcset="/uploads/a.jpg?w=320 320w" imagesizes="100vw" fetchpriority="high" />');
    expect(html.indexOf('rel="preload"')).toBeLessThan(html.indexOf("</head>"));
    const hostile = renderHtml(TEMPLATE, { ...page, preloadImages: [{ href: '/x.jpg" onload="alert(1)' }] });
    expect(hostile).not.toContain('" onload="');
  });

  it("página sem imagem não ganha preload", async () => {
    const page = await resolveHtmlPage("/stats", loaders(), nada);
    expect(renderHtml(TEMPLATE, page)).not.toContain('rel="preload"');
  });
});
