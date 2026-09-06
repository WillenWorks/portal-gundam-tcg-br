/* Location hook do wouter para rotas com hash (#/caminho), com um ajuste em cima do
 * `useHashLocation` original da lib.
 *
 * O wouter trata query string (?cor=Azul) como parte da URL REAL (window.location.search),
 * não do hash -- então uma navegação pra "/cards?color=Blue" separa em hash="/cards" e
 * search="color=Blue". Isso funciona bem quando o destino TEM query. O problema é o
 * `navigate()` original só escreve em `url.search` quando o destino passado tem "?" --
 * se o próximo destino não tiver nenhum ("/rules", sem filtro), o search antigo fica
 * grudado na URL (ex: sai de "/rules?relatedKeyword=Burst" clicando num link sem filtro e
 * o "relatedKeyword=Burst" continua ali, contaminando a próxima página que ler a URL).
 *
 * Aqui o search é sempre reescrito por inteiro a cada navegação (limpo pra "" quando o
 * destino não pede filtro nenhum), então cada navegação é dona da URL inteira e não herda
 * resíduo de uma página anterior.
 */
import { useSyncExternalStore } from "react";

const listeners: Array<() => void> = [];
const onHashChange = () => listeners.forEach((cb) => cb());

const subscribeToHashUpdates = (callback: () => void) => {
  if (listeners.push(callback) === 1) addEventListener("hashchange", onHashChange);
  return () => {
    const index = listeners.indexOf(callback);
    if (index >= 0) listeners.splice(index, 1);
    if (!listeners.length) removeEventListener("hashchange", onHashChange);
  };
};

// leading '#' é ignorado, leading '/' é opcional. Query string desta app mora em
// `window.location.search` (ver cabeçalho), então o hash normalmente não tem '?'.
// Mas um link colado à mão pode trazer o '?' DENTRO do hash
// (`#/rota?preview=1`) -- aí o wouter não casa a rota (`/rota?preview=1` != `/rota`)
// e cai no NotFound. Cortamos tudo a partir do '?' pro casamento de rota; quem
// precisa do valor (ex.: previewLayoutGate) lê de `window.location.href` direto.
const currentHashLocation = () => {
  const raw = window.location.hash.replace(/^#?\/?/, "");
  const q = raw.indexOf("?");
  return "/" + (q >= 0 ? raw.slice(0, q) : raw);
};

type NavigateOptions = { state?: unknown; replace?: boolean };

export function navigate(to: string, { state = null, replace = false }: NavigateOptions = {}) {
  const oldURL = window.location.href;

  const [hash, query = ""] = to.replace(/^#?\/?/, "").split("?");

  const url = new URL(window.location.href);
  url.hash = `/${hash}`;
  // Sempre reescreve o search inteiro (limpa quando `query` é vazio) -- diferente do
  // `if (search) url.search = search` original, que deixava resíduo de outra página.
  url.search = query;
  const newURL = url.href;

  if (replace) {
    window.history.replaceState(state, "", newURL);
  } else {
    window.history.pushState(state, "", newURL);
  }

  const event =
    typeof HashChangeEvent !== "undefined"
      ? new HashChangeEvent("hashchange", { oldURL, newURL })
      : new Event("hashchange");
  dispatchEvent(event);
}

export const useHashLocationWithQuery = ({ ssrPath = "/" }: { ssrPath?: string } = {}): [string, typeof navigate] => [
  useSyncExternalStore(subscribeToHashUpdates, currentHashLocation, () => ssrPath),
  navigate,
];

useHashLocationWithQuery.hrefs = (href: string) => "#" + href;
