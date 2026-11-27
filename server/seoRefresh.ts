/* Aviso de "conteúdo público mudou" para o que o Google vê: descarta o HTML guardado da página (server/htmlMeta.ts
 * createPageCache) e pede um sitemap novo (server/sitemap.ts). Quem publica/edita não precisa conhecer os dois:
 * chama `publicContentChanged` e o server/index.ts liga os ouvintes no boot. Sem ouvinte (testes, scripts) não faz nada. */
type Listener = (paths: string[]) => void;
const listeners: Listener[] = [];

export function onPublicContentChanged(listener: Listener) {
  listeners.push(listener);
  return () => {
    const i = listeners.indexOf(listener);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function publicContentChanged(paths: string[]) {
  for (const listener of listeners) {
    try {
      listener(paths);
    } catch (error) {
      console.warn("[seo] aviso de conteúdo alterado falhou:", error instanceof Error ? error.message : error);
    }
  }
}

/** Páginas afetadas por um artigo: a dele, a lista e a home (destaque). */
export const articlePaths = (slug: string | null | undefined) =>
  [slug ? `/articles/${slug}` : null, "/articles", "/novidades", "/"].filter((p): p is string => !!p);
