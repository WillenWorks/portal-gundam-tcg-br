/** O app usa rotas com hash (`/#/login`). Endereços "limpos" — links de e-mail (`/redefinir-senha?token=…`),
 *  páginas legais citadas no Google (`/privacidade`) ou links antigos — viram a rota com hash equivalente,
 *  mantendo a query em `location.search`, que é onde o roteador a lê. Devolve o novo endereço ou null. */
export function cleanPathToHash(pathname: string, search: string, hash: string): string | null {
  if (hash && hash !== "#") return null;
  if (pathname === "/" || pathname === "/index.html") return null;
  if (pathname.startsWith("/api/") || /\.[a-z0-9]+$/i.test(pathname)) return null;
  return `/${search}#${pathname.replace(/\/+$/, "")}`;
}
