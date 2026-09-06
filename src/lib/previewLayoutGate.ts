/* Trava de runtime da rota `/simulador/preview-layout` (docs/38, Frente 4).
 *
 * Antes a rota só era montada em DEV local ou com `VITE_LAYOUT_PREVIEW=1` no
 * build (staging). O build de produção da Vercel não seta env var, então a
 * rota nunca existia lá. Como a página é 100% dados de exemplo — sem auth, sem
 * backend, sem fetch — ela passou a ser liberável em runtime por um link:
 *
 *   abrir a rota UMA vez com `?preview=1` na URL destrava e grava a permissão
 *   no `localStorage` daquele navegador; daí em diante o preview abre direto.
 *
 * Continua "escondida" de quem só navega o site (nenhum link aponta pra ela),
 * mas um link compartilhado (`.../#/simulador/preview-layout?preview=1`) abre
 * em qualquer navegador. */
const STORAGE_KEY = "gundam:preview-layout";

function urlHasPreviewFlag(): boolean {
  try {
    return window.location.href.includes("preview=1");
  } catch {
    return false;
  }
}

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function previewLayoutEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (import.meta.env.VITE_LAYOUT_PREVIEW === "1") return true;
  if (urlHasPreviewFlag()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* modo privado / storage bloqueado — segue liberado nesta navegação mesmo assim */
    }
    return true;
  }
  return readStored();
}
