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
};

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
export async function resolveHtmlPage(pathname: string, loaders: DetailLoaders): Promise<HtmlPage> {
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
    page.jsonLd = [breadcrumb([{ name: "Início", path: "/" }, section, { name: detail.title, path }]), ...(detail.jsonLd ?? [])];
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

/** Troca os metadados do index.html do build pelos da página. O resto do arquivo (scripts, CSS, conteúdo
 *  sem JavaScript) fica igual. */
export function renderHtml(template: string, page: HtmlPage): string {
  let html = template;
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
  ].filter(Boolean);
  return html.replace(/<\/head>/i, `    ${tags.join("\n    ")}\n  </head>`);
}

/** Cache curto por caminho: a mesma página pedida várias vezes seguidas (robôs, prévias) não vai ao banco. */
export function createPageCache(ttlMs = 5 * 60_000, max = 3000, now: () => number = Date.now) {
  const cache = new Map<string, { at: number; page: Promise<HtmlPage> }>();
  return (path: string, build: () => Promise<HtmlPage>) => {
    const hit = cache.get(path);
    if (hit && now() - hit.at < ttlMs) return hit.page;
    const page = build().catch((error) => {
      cache.delete(path);
      throw error;
    });
    cache.set(path, { at: now(), page });
    if (cache.size > max) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return page;
  };
}
