/** O app usava rotas com hash (`/#/cards/abc`). Agora as rotas são caminhos de verdade
 *  (`/cards/abc`), que o Google indexa. Links antigos — compartilhados, salvos ou em
 *  e-mails já enviados (`/?token=x#/redefinir-senha`) — continuam valendo: este shim
 *  converte o hash no caminho equivalente, juntando a query que estava fora do hash com a
 *  que estava dentro dele. Também tira a barra final (`/cards/` → `/cards`). Devolve o
 *  novo endereço, ou null quando não há nada a mudar. */
export function legacyHashToPath(pathname: string, search: string, hash: string): string | null {
  if (hash.startsWith("#/")) {
    const raw = hash.slice(1);
    const q = raw.indexOf("?");
    const path = (q >= 0 ? raw.slice(0, q) : raw).replace(/\/+$/, "") || "/";
    const params = new URLSearchParams(search);
    if (q >= 0) new URLSearchParams(raw.slice(q + 1)).forEach((value, key) => params.set(key, value));
    const query = params.toString();
    return `${path}${query ? `?${query}` : ""}`;
  }
  if (pathname.length > 1 && pathname.endsWith("/") && !pathname.startsWith("/api/")) {
    return `${pathname.replace(/\/+$/, "") || "/"}${search}${hash}`;
  }
  return null;
}
