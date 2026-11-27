/* HTML de cada página do site com título, descrição, endereço canônico, imagem de prévia e dados
 * estruturados próprios, já no servidor.
 *
 * Por quê: o site é uma SPA e o index.html só tinha os dados da home. Quem não roda JavaScript (prévias
 * de WhatsApp, Discord, Telegram e X, e a primeira leitura do Google) via sempre a home, com o canônico
 * apontando para ela, e endereço inexistente respondia 200. Agora o nginx manda as páginas para a API
 * (location @app_html), que devolve o mesmo index.html do build com esses dados trocados e status 404
 * quando o endereço ou o item não existem. O React continua montando a página normalmente por cima.
 *
 * As consultas ao banco ficam em `DetailLoaders` (server/index.ts); aqui só a montagem, testável. */
import { formatTitle, routeMetaFor, SITE_NAME, SITE_URL } from "../src/lib/pageMetaRoutes.ts";
import { matchSiteRoute, type DetailKind } from "../src/lib/siteRoutes.ts";

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`;

export type DetailMeta = {
  title: string;
  description?: string;
  image?: string | null;
  /** objetos schema.org extras (Event, Article…), além da trilha de navegação */
  jsonLd?: Record<string, unknown>[];
  /** nome da seção na trilha (ex.: "Cartas") */
  section?: { name: string; path: string };
  /** item acessível pelo link mas fora do Google (ex.: deck "não listado") */
  noindex?: boolean;
  /** conteúdo da página em HTML (server/htmlContent.ts), no lugar do texto genérico do index.html */
  body?: string;
  /** endereço oficial quando o item abre por mais de um (ex.: carta por código ou por impressão → /cards/<id>) */
  canonicalPath?: string;
};

/** Conteúdo das páginas que não são de detalhe (listas, regras, arquétipos, jogadores). `null` = mantém o texto
 *  do index.html. Página com título próprio (ex.: /jogadores/:slug) devolve o objeto; `notFound` = 404 de verdade. */
/** Imagem que o navegador começa a baixar junto com o HTML, sem esperar o JavaScript e a API (LCP). */
export type PreloadImage = { href: string; srcset?: string; sizes?: string };

/** `body` ausente = mantém o texto do index.html (ex.: a home, que só traz `preloadImages`). */
export type BodyResult = { body?: string; title?: string; description?: string; noindex?: boolean; preloadImages?: PreloadImage[] } | { notFound: true };
export type BodyLoader = (path: string) => Promise<string | BodyResult | null>;

export type DetailLoaders = Record<DetailKind, (key: string) => Promise<DetailMeta | null>>;

export type HtmlPage = {
  status: 200 | 404;
  title: string;
  description: string;
  canonical: string;
  image: string;
  noindex: boolean;
  ogType: "website" | "article";
  jsonLd: Record<string, unknown>[];
  body?: string;
  preloadImages?: PreloadImage[];
};

const SECTION_BY_KIND: Record<DetailKind, { name: string; path: string }> = {
  card: { name: "Cartas", path: "/cards" },
  deck: { name: "Decks", path: "/decks" },
  set: { name: "Coleções", path: "/sets" },
  series: { name: "Séries", path: "/series" },
  article: { name: "Artigos", path: "/articles" },
  tournament: { name: "Torneios", path: "/torneios" },
};

export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${SITE_URL}${url}`;
  return null; // data:, blob: e afins não servem de prévia
}

function notFound(path: string): HtmlPage {
  return {
    status: 404,
    title: formatTitle("Página não encontrada"),
    description: "O endereço não existe ou mudou de lugar.",
    canonical: `${SITE_URL}${path}`,
    image: DEFAULT_OG_IMAGE,
    noindex: true,
    ogType: "website",
    jsonLd: [],
  };
}

function breadcrumb(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: `${SITE_URL}${item.path}` })),
  };
}

/** Monta os dados da página para um caminho (sem query). `loaders` só é chamado nas páginas de detalhe. */
export async function resolveHtmlPage(pathname: string, loaders: DetailLoaders, bodyFor?: BodyLoader): Promise<HtmlPage> {
  const path = pathname.replace(/\/+$/, "") || "/";
  const match = matchSiteRoute(path);
  if (!match.known) return notFound(path);

  const base = routeMetaFor(path);
  const page: HtmlPage = {
    status: 200,
    title: formatTitle(base.title),
    description: base.description ?? "",
    canonical: `${SITE_URL}${base.path ?? path}`.replace(/\/$/, "") || SITE_URL,
    image: DEFAULT_OG_IMAGE,
    noindex: Boolean(base.noindex),
    ogType: "website",
    jsonLd: [],
  };
  if (base.path === "/") page.canonical = `${SITE_URL}/`;

  if (match.detail && match.key) {
    const detail = await loaders[match.detail](match.key);
    if (!detail) return notFound(path);
    const section = detail.section ?? SECTION_BY_KIND[match.detail];
    page.title = formatTitle(detail.title);
    if (detail.description) page.description = detail.description;
    page.image = absoluteUrl(detail.image) ?? DEFAULT_OG_IMAGE;
    page.ogType = match.detail === "article" ? "article" : "website";
    if (detail.noindex) page.noindex = true;
    const officialPath = detail.canonicalPath ?? path;
    page.canonical = `${SITE_URL}${officialPath}`;
    page.jsonLd = [breadcrumb([{ name: "Início", path: "/" }, section, { name: detail.title, path: officialPath }]), ...(detail.jsonLd ?? [])];
    if (detail.body) page.body = detail.body;
  } else if (bodyFor && !page.noindex) {
    const result = await bodyFor(path);
    if (result && typeof result === "object" && "notFound" in result) return notFound(path);
    if (typeof result === "string") page.body = result;
    else if (result) {
      if (result.body) page.body = result.body;
      if (result.preloadImages?.length) page.preloadImages = result.preloadImages;
      if (result.title) page.title = formatTitle(result.title);
      if (result.description) page.description = result.description;
      if (result.noindex) page.noindex = true;
    }
  }
  return page;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** JSON dentro de <script>: `</` e `<!--` não podem fechar a tag nem abrir comentário. */
const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

const STRIP = [
  /<title>[\s\S]*?<\/title>\s*/i,
  /<meta\s[^>]*name="description"[^>]*>\s*/gi,
  /<meta\s[^>]*name="robots"[^>]*>\s*/gi,
  /<link\s[^>]*rel="canonical"[^>]*>\s*/gi,
  /<meta\s[^>]*property="og:[^"]*"[^>]*>\s*/gi,
  /<meta\s[^>]*name="twitter:[^"]*"[^>]*>\s*/gi,
];

/** Marcadores em volta do script dos anúncios automáticos no index.html. O trecho é cortado por posição (indexOf),
 *  não por regex sobre `<script`: limpar HTML com regex é frágil (e o CodeQL aponta, com razão, como sanitização
 *  incompleta). Aqui o template é o nosso próprio build, mas o corte por marcador é exato e não depende de atributos. */
export const ADS_START = "<!-- anuncios:inicio";
export const ADS_END = "<!-- anuncios:fim -->";

/** Remove todo trecho entre ADS_START e ADS_END (marcadores inclusive). Sem marcador, devolve igual. */
export function stripAdsBlock(html: string): string {
  let out = html;
  for (let start = out.indexOf(ADS_START); start !== -1; start = out.indexOf(ADS_START)) {
    const end = out.indexOf(ADS_END, start);
    if (end === -1) break;
    out = out.slice(0, start) + out.slice(end + ADS_END.length);
  }
  return out;
}

/** Página sem conteúdo próprio para anúncio: erro, login, painel, ferramentas logadas (todas noindex). A política
 *  do Google proíbe anúncio nessas telas ("Google-served ads on screens without publisher-content"). */
export const pageAllowsAds = (page: Pick<HtmlPage, "status" | "noindex">) => page.status === 200 && !page.noindex;

const preloadTag = (image: PreloadImage) =>
  [
    `<link rel="preload" as="image" href="${escapeHtml(image.href)}"`,
    image.srcset ? ` imagesrcset="${escapeHtml(image.srcset)}"` : "",
    image.srcset && image.sizes ? ` imagesizes="${escapeHtml(image.sizes)}"` : "",
    ` fetchpriority="high" />`,
  ].join("");

/** Troca os metadados do index.html do build pelos da página e, quando a página tem conteúdo próprio
 *  (`body`), troca o texto genérico do <main> por ele. Em página sem conteúdo (pageAllowsAds = false) tira o
 *  script dos anúncios automáticos. O resto do arquivo (scripts, CSS, cabeçalho e rodapé sem JavaScript) fica igual. */
export function renderHtml(template: string, page: HtmlPage): string {
  let html = template;
  if (!pageAllowsAds(page)) html = stripAdsBlock(html);
  if (page.body) {
    // função no replace: `$` do conteúdo não pode virar padrão de substituição
    const body = page.body;
    if (/<main\b[^>]*>[\s\S]*?<\/main>/i.test(html)) html = html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/i, () => `<main>\n${body}\n</main>`);
    else html = html.replace(/<div id="root">\s*<\/div>/i, () => `<div id="root"><main>\n${body}\n</main></div>`);
  }
  for (const re of STRIP) html = html.replace(re, "");
  const description = page.description.replace(/\s+/g, " ").trim().slice(0, 300);
  const tags = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    page.noindex ? `<meta name="robots" content="noindex, nofollow" />` : "",
    `<link rel="canonical" href="${escapeHtml(page.canonical)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:type" content="${page.ogType}" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(page.canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(page.image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(page.image)}" />`,
    ...page.jsonLd.map((obj) => `<script type="application/ld+json">${safeJson(obj)}</script>`),
    ...(page.preloadImages ?? []).map(preloadTag),
  ].filter(Boolean);
  return html.replace(/<\/head>/i, `    ${tags.join("\n    ")}\n  </head>`);
}

export type PageCacheState = "hit" | "stale" | "miss";
type PageCacheBuild = () => Promise<HtmlPage>;

/**
 * Cache das páginas HTML montadas no servidor.
 * - até `ttlMs`: entrega o que está guardado ("hit");
 * - de `ttlMs` a `staleMs`: entrega o guardado na hora e monta a versão nova em segundo plano ("stale") — com
 *   pouco tráfego quase toda visita chegava depois dos 5 min do cache antigo e esperava o banco (TTFB ~1,7 s);
 * - sem nada guardado (ou velho demais): monta e espera ("miss"). Erro não fica guardado.
 * - 404 (inclusive rascunho de artigo, que é 404 para o público) vale só `notFoundTtlMs` e nunca é entregue velho:
 *   senão o artigo publicado seguia respondendo 404 + noindex por até 24 h para quem chegasse primeiro (o Google).
 * `warm` monta e guarda sem visita (aquecimento das páginas principais); `invalidate` descarta um caminho.
 */
export function createPageCache(
  ttlMs = 10 * 60_000, max = 3000, now: () => number = Date.now, staleMs = 24 * 60 * 60_000, notFoundTtlMs = 60_000,
) {
  type Entry = { at: number; page: Promise<HtmlPage>; refreshing?: boolean; status?: HtmlPage["status"] };
  const cache = new Map<string, Entry>();
  const track = (entry: Entry) => {
    entry.page.then((page) => (entry.status = page.status), () => {});
    return entry;
  };
  const store = (path: string, entry: Entry) => {
    track(entry);
    cache.delete(path); // reinsere no fim: o mais antigo sai primeiro quando passa de `max`
    cache.set(path, entry);
    if (cache.size > max) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  };
  const get = (path: string, build: PageCacheBuild, onState?: (state: PageCacheState) => void): Promise<HtmlPage> => {
    let hit = cache.get(path);
    // 404 já resolvido passa a valer menos; ainda pendente (status indefinido) segue a regra normal
    if (hit && hit.status === 404 && now() - hit.at >= notFoundTtlMs) hit = undefined;
    const age = hit ? now() - hit.at : Infinity;
    if (hit && age < ttlMs) {
      onState?.("hit");
      return hit.page;
    }
    if (hit && age < staleMs && hit.status === 200) {
      onState?.("stale");
      const stale = hit;
      if (!stale.refreshing) {
        stale.refreshing = true;
        build().then(
          (page) => store(path, { at: now(), page: Promise.resolve(page) }),
          () => {
            stale.refreshing = false; // banco fora: segue entregando a versão guardada e tenta de novo na próxima visita
          },
        );
      }
      return stale.page;
    }
    onState?.("miss");
    const entry: Entry = { at: now(), page: build() };
    store(path, entry);
    entry.page.catch(() => {
      if (cache.get(path) === entry) cache.delete(path);
    });
    return entry.page;
  };
  get.warm = async (path: string, build: PageCacheBuild) => {
    store(path, { at: now(), page: Promise.resolve(await build()) });
  };
  get.invalidate = (path: string) => {
    cache.delete(path.replace(/\/+$/, "") || "/");
    cache.delete(path);
  };
  /** Descarta todo 404 guardado (algo acabou de ser publicado e pode ter sido pedido antes por outro endereço). */
  get.invalidateNotFound = () => {
    for (const [key, entry] of cache) if (entry.status === 404) cache.delete(key);
  };
  return get;
}
