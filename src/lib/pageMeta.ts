/* Metadados de SEO por página (title, description, canonical, Open Graph, robots).
 *
 * O app é uma SPA: o index.html só tem os metadados da home. Aqui cada rota ganha os seus —
 * `RouteMeta` (em App.tsx) aplica os padrões da rota a cada troca de caminho, e as páginas de
 * detalhe (carta, deck, artigo, coleção, série) chamam `usePageMeta` quando os dados chegam
 * para pôr o nome do item. O Google renderiza JS e lê esses valores. */
import { useEffect } from "react";

export const SITE_URL = "https://anaheimhub.com";
export const SITE_NAME = "Anaheim Hub";
const DEFAULT_DESCRIPTION =
  "Plataforma pública e gratuita de Gundam Card Game no Brasil: catálogo de cartas, deckbuilder, torneios, regras e metagame.";
const DEFAULT_IMAGE = `${SITE_URL}/favicon-64.png`;

export type PageMeta = {
  title?: string;
  description?: string;
  image?: string | null;
  noindex?: boolean;
  /** Caminho canônico; padrão = caminho atual sem query. */
  path?: string;
};

/** Rotas de conta, ferramentas logadas e telas operacionais: não devem aparecer no Google. */
const PRIVATE_PREFIXES = [
  "/admin", "/portal", "/profile", "/my-decks", "/deckbuilder", "/simulador", "/organizador",
  "/binders", "/binder/", "/u/", "/login", "/auth", "/recuperar-senha", "/redefinir-senha",
  "/confirmar-email", "/zero",
];

function matchesPrefix(pathname: string, prefix: string) {
  if (prefix.endsWith("/")) return pathname.startsWith(prefix);
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPrivatePath(pathname: string): boolean {
  if (/^\/eventos\/[^/]+\/(tv|checkin)$/.test(pathname)) return true;
  return PRIVATE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

const ROUTE_META: Array<[RegExp, { title: string; description?: string }]> = [
  [/^\/cards\/[^/]+$/, { title: "Carta", description: "Detalhes, impressões, regras e estatísticas de uso desta carta de Gundam Card Game." }],
  [/^\/cards$/, { title: "Catálogo de cartas", description: "Busque todas as cartas de Gundam Card Game por cor, tipo, nível, custo, traço, série e coleção." }],
  [/^\/database$/, { title: "Base de dados", description: "Base de dados completa de cartas, coleções e séries de Gundam Card Game." }],
  [/^\/decks$/, { title: "Decks da comunidade", description: "Decks públicos de Gundam Card Game montados pela comunidade brasileira." }],
  [/^\/deck\/[^/]+$/, { title: "Deck", description: "Lista de cartas, curva e estatísticas deste deck de Gundam Card Game." }],
  [/^\/sets\/[^/]+$/, { title: "Coleção", description: "Cartas e informações desta coleção de Gundam Card Game." }],
  [/^\/sets$/, { title: "Coleções", description: "Todas as coleções e produtos lançados de Gundam Card Game." }],
  [/^\/series\/[^/]+$/, { title: "Série", description: "Cartas de Gundam Card Game desta série / obra." }],
  [/^\/series$/, { title: "Séries Gundam", description: "As obras do universo Gundam presentes no card game." }],
  [/^\/articles\/[^/]+$/, { title: "Artigo" }],
  [/^\/(articles|novidades)$/, { title: "Artigos e novidades", description: "Notícias, guias e análises de Gundam Card Game." }],
  [/^\/torneios\/[^/]+\/lista\/[^/]+$/, { title: "Lista de torneio" }],
  [/^\/torneios\/[^/]+$/, { title: "Torneio", description: "Resultados, decks e classificação deste torneio de Gundam Card Game." }],
  [/^\/torneios$/, { title: "Torneios", description: "Torneios oficiais e da comunidade de Gundam Card Game, com resultados e decks." }],
  [/^\/jogadores\/[^/]+$/, { title: "Jogador" }],
  [/^\/arquetipos\/[^/]+$/, { title: "Arquétipo", description: "Desempenho, listas e cartas-chave deste arquétipo no metagame." }],
  [/^\/arquetipos$/, { title: "Arquétipos", description: "Arquétipos do metagame de Gundam Card Game e seu desempenho em torneios." }],
  [/^\/stats$/, { title: "Estatísticas do metagame", description: "Estatísticas de uso de cartas e decks no metagame de Gundam Card Game." }],
  [/^\/metagame\/regional$/, { title: "Metagame regional", description: "O metagame de Gundam Card Game por região do Brasil." }],
  [/^\/rules\/[^/]+$/, { title: "Regra", description: "Esclarecimento oficial de regra de Gundam Card Game." }],
  [/^\/rules$/, { title: "Regras e rulings", description: "Regras, palavras-chave e esclarecimentos oficiais de Gundam Card Game." }],
  [/^\/privacidade$/, { title: "Política de Privacidade" }],
  [/^\/termos$/, { title: "Termos de Uso" }],
  [/^\/login$/, { title: "Entrar" }],
  [/^\/simulador/, { title: "Simulador" }],
  [/^\/deckbuilder/, { title: "Deckbuilder" }],
];

export function routeMetaFor(pathname: string): PageMeta {
  const path = pathname.replace(/\/+$/, "") || "/";
  const noindex = isPrivatePath(path);
  if (path === "/") return { title: undefined, description: DEFAULT_DESCRIPTION, noindex, path };
  const hit = ROUTE_META.find(([re]) => re.test(path));
  return { title: hit?.[1].title, description: hit?.[1].description ?? DEFAULT_DESCRIPTION, noindex, path };
}

export function formatTitle(title?: string) {
  return title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} | Laboratório Tático · Gundam Card Game BR`;
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function absoluteUrl(src: string) {
  if (/^https?:\/\//i.test(src)) return src;
  return `${SITE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
}

export function applyPageMeta(meta: PageMeta) {
  if (typeof document === "undefined") return;
  const path = meta.path ?? (window.location.pathname.replace(/\/+$/, "") || "/");
  const title = formatTitle(meta.title);
  const description = (meta.description || DEFAULT_DESCRIPTION).replace(/\s+/g, " ").trim().slice(0, 300);
  const url = `${SITE_URL}${path === "/" ? "/" : path}`;
  document.title = title;
  setMeta("name", "description", description);
  setMeta("name", "robots", meta.noindex ? "noindex, nofollow" : "index, follow");
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:url", url);
  setMeta("property", "og:image", absoluteUrl(meta.image || DEFAULT_IMAGE));
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = url;
}

/** Metadados específicos de uma página (rode quando os dados do item chegarem).
 *  Sem `meta` (ainda carregando) não faz nada e ficam os padrões da rota. */
export function usePageMeta(meta: PageMeta | null | undefined) {
  const key = meta ? JSON.stringify(meta) : "";
  useEffect(() => {
    if (!meta) return;
    const base = routeMetaFor(window.location.pathname);
    applyPageMeta({ ...base, ...meta, noindex: meta.noindex ?? base.noindex });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
