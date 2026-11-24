/**
 * Imagens enviadas ao portal (`/uploads/...`) em tamanho de tela: o servidor devolve WebP com no máximo `w` px de
 * largura (server/imageResize.ts). Imagens de fora (CDN de carta, Supabase) passam como estão.
 */
const RESIZABLE = /^\/uploads\/[^?#]+\.(jpe?g|png|webp)$/i;
export const RESIZED_WIDTHS = [320, 480, 640, 960, 1280] as const;

export function isResizableUpload(src: string | null | undefined): src is string {
  return Boolean(src && RESIZABLE.test(src));
}

export function resizedImageSrc(src: string, width: number): string {
  return isResizableUpload(src) ? `${src}?w=${width}` : src;
}

/**
 * `src`, `srcSet` e `sizes` prontos para espalhar num <img>. `sizes` diz ao navegador a largura do quadro na tela;
 * ele escolhe a menor largura que cobre o quadro na densidade da tela. Imagem de fora do portal: só o `src`.
 */
export function uploadImageProps(src: string, sizes: string, widths: readonly number[] = RESIZED_WIDTHS) {
  if (!isResizableUpload(src)) return { src };
  return { src: resizedImageSrc(src, widths[widths.length - 1]), srcSet: resizedSrcSet(src, widths), sizes };
}

/** `srcset` com as larguras do servidor, ou undefined quando a imagem não é do portal */
export function resizedSrcSet(src: string, widths: readonly number[] = RESIZED_WIDTHS): string | undefined {
  if (!isResizableUpload(src)) return undefined;
  return widths.map((w) => `${src}?w=${w} ${w}w`).join(", ");
}
