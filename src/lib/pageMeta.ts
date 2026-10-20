/* Metadados de SEO por página (title, description, canonical, Open Graph, robots).
 *
 * O app é uma SPA: o index.html só tem os metadados da home. Aqui cada rota ganha os seus —
 * `RouteMeta` (em App.tsx) aplica os padrões da rota a cada troca de caminho, e as páginas de
 * detalhe (carta, deck, artigo, coleção, série) chamam `usePageMeta` quando os dados chegam
 * para pôr o nome do item. O Google renderiza JS e lê esses valores. */
import { useEffect } from "react";
import { DEFAULT_DESCRIPTION, DEFAULT_IMAGE, SITE_URL, formatTitle, routeMetaFor, type PageMeta } from "./pageMetaRoutes";

export { DEFAULT_DESCRIPTION, HOME_SECTIONS, SITE_NAME, SITE_URL, formatTitle, isPrivatePath, routeMetaFor, type PageMeta } from "./pageMetaRoutes";


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
