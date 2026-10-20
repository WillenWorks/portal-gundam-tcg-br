/* Rotas que o site conhece, no formato do wouter (App.tsx). Usado pela API para responder 404 de verdade
 * a endereços inexistentes e para saber de que tipo é cada página de detalhe (server/htmlMeta.ts).
 * O teste siteRoutes.test.ts falha se o App.tsx ganhar uma rota que não esteja aqui. */
import { HOME_SECTIONS } from "./pageMeta";

export type DetailKind = "card" | "deck" | "set" | "series" | "article" | "tournament";

export const SITE_ROUTES: Array<{ path: string; detail?: DetailKind }> = [
  { path: "/" },
  { path: "/admin" }, { path: "/admin/:section" }, { path: "/admin/articles" }, { path: "/admin/dashboard" },
  { path: "/admin/simulador/autoria" }, { path: "/admin/simulador/cobertura" },
  { path: "/arquetipos" }, { path: "/arquetipos/:slug" },
  { path: "/articles" }, { path: "/articles/:slug", detail: "article" },
  { path: "/auth" },
  { path: "/binder/:shareId" }, { path: "/binders" }, { path: "/binders/:id" },
  { path: "/cards" }, { path: "/cards/:id", detail: "card" },
  { path: "/confirmar-email" },
  { path: "/database" },
  { path: "/deck/:shareId", detail: "deck" },
  { path: "/deckbuilder" }, { path: "/deckbuilder/:id" }, { path: "/deckbuilder/new" }, { path: "/deckbuilder/novo" },
  { path: "/decks" },
  { path: "/eventos" }, { path: "/eventos/:id/checkin" }, { path: "/eventos/:id/tv" },
  { path: "/jogadores/:slug" },
  { path: "/login" },
  { path: "/metagame/regional" },
  { path: "/my-decks" },
  { path: "/novidades" },
  { path: "/organizador" }, { path: "/organizador/eventos/:id/tv" },
  { path: "/portal" },
  { path: "/privacidade" },
  { path: "/profile" },
  { path: "/recuperar-senha" }, { path: "/redefinir-senha" },
  { path: "/rules" }, { path: "/rules/:id" },
  { path: "/series" }, { path: "/series/:slug", detail: "series" },
  { path: "/sets" }, { path: "/sets/:code", detail: "set" },
  { path: "/simulador" }, { path: "/simulador/multiplayer" }, { path: "/simulador/partida/:matchId" },
  { path: "/simulador/preview-layout" }, { path: "/simulador/treino" },
  { path: "/stats" },
  { path: "/termos" },
  { path: "/torneios" }, { path: "/torneios/:id", detail: "tournament" }, { path: "/torneios/:id/lista/:entryId" },
  { path: "/tournaments" },
  { path: "/u/:username" },
  { path: "/zero" },
];

const COMPILED = SITE_ROUTES.map((route) => ({
  ...route,
  re: new RegExp(`^${route.path.replace(/:[A-Za-z]+/g, "([^/]+)")}$`),
}));

export type RouteMatch = { known: false } | { known: true; detail?: DetailKind; key?: string };

/** Caminho sem query e sem barra final. `/:section` só vale para as seções da home. */
export function matchSiteRoute(pathname: string): RouteMatch {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (/^\/[^/]+$/.test(path) && HOME_SECTIONS.has(path.slice(1))) return { known: true };
  for (const route of COMPILED) {
    const m = route.re.exec(path);
    if (!m) continue;
    if (!route.detail) return { known: true };
    let key = m[1];
    try {
      key = decodeURIComponent(key);
    } catch {
      return { known: false };
    }
    return { known: true, detail: route.detail, key };
  }
  return { known: false };
}
