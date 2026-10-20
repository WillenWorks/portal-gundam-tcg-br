/* Parte de metadados de página que não depende do navegador: rotas, títulos, descrições, o que é privado.
 * Usada pelo site (src/lib/pageMeta.ts) e pela API (server/htmlMeta.ts). */
export const SITE_URL = "https://anaheimhub.com";
export const SITE_NAME = "Anaheim Hub";
export const DEFAULT_DESCRIPTION =
  "Plataforma pública e gratuita de Gundam Card Game no Brasil: catálogo de cartas, deckbuilder, torneios, regras e metagame.";
export const DEFAULT_IMAGE = `${SITE_URL}/og-default.jpg`;

/** Seções da landing acessíveis por caminho (`/ultimos-eventos` rola até a seção). São a home:
 *  canonical "/". Qualquer outro caminho de um nível desconhecido é 404 (ver App.tsx). */
export const HOME_SECTIONS = new Set(["topo", "sobre-anaheim-hub", "cockpit-registro", "conheca-gundam", "ultimas-colecoes", "ultimos-eventos"]);

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
  [/^\/recuperar-senha$/, { title: "Recuperar senha" }],
  [/^\/redefinir-senha$/, { title: "Criar nova senha" }],
  [/^\/confirmar-email$/, { title: "Confirmar e-mail" }],
  [/^\/simulador/, { title: "Simulador" }],
  [/^\/deckbuilder/, { title: "Deckbuilder" }],
];

export function routeMetaFor(pathname: string): PageMeta {
  const path = pathname.replace(/\/+$/, "") || "/";
  const noindex = isPrivatePath(path);
  if (path === "/" || HOME_SECTIONS.has(path.slice(1))) return { title: undefined, description: DEFAULT_DESCRIPTION, noindex: false, path: "/" };
  const hit = ROUTE_META.find(([re]) => re.test(path));
  return { title: hit?.[1].title, description: hit?.[1].description ?? DEFAULT_DESCRIPTION, noindex, path };
}

export function formatTitle(title?: string) {
  return title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} | Cartas, decks e torneios de Gundam Card Game`;
}

