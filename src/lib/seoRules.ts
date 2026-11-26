/* Regras de indexação que o HTML do servidor (server/routes/htmlPages.ts), o sitemap (server/sitemap.ts) e as
 * páginas no navegador precisam aplicar igual: se um diz "indexa" e o outro "noindex", o Google pega o pior. */

/** Erro de API que confirma que o item não existe (ou não é público). Só ele justifica `noindex` no navegador:
 *  falha de rede, 429, 5xx ou bloqueio do robô não dizem nada sobre o item, e o Google renderiza o JavaScript —
 *  um `noindex` aplicado por erro passageiro tira a página do índice. */
export function isNotFoundError(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return status === 404 || status === 410;
}

/** Artigo: só o publicado entra no Google; rascunho / em revisão (prévia de editor) fica fora. */
export const articleIsIndexable = (post: { status?: string | null }) => post.status === "PUBLISHED";

/** Perfil de jogador (/jogadores/:slug): entra no Google quando tem conteúdo público próprio — pelo menos uma lista
 *  de deck publicada num resultado. Só a linha de classificação repete o que a página do torneio já mostra. */
export const playerIsIndexable = (player: { results: ReadonlyArray<{ hasDecklist: boolean }> }) =>
  player.results.some((r) => r.hasDecklist);
