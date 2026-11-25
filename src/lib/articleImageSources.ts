/* Endereços das imagens de um ArticleImageFrame. Ficam aqui, sem React, porque o servidor usa os mesmos para o
 * <link rel="preload"> do destaque da home (server/routes/htmlPages.ts): se divergirem, o navegador baixa duas vezes. */
import { resizedImageSrc, resizedSrcSet } from "./resizedImage";
import { safeImageSrc } from "./safeImageSrc";

/** largura do quadro do destaque da home (HomeArticlesCarousel) */
export const HOME_HERO_SIZES = "(min-width: 1800px) 40vw, (min-width: 1024px) 50vw, 100vw";

export type ArticleImageSources = {
  /** fundo desfocado: a menor versão basta */
  blur: string;
  src: string;
  srcSet?: string;
  sizes?: string;
};

/** `null` quando o endereço não é imagem aceita (safeImageSrc) */
export function articleImageSources(src: string, sizes: string): ArticleImageSources | null {
  const safe = safeImageSrc(src);
  if (!safe) return null;
  const srcSet = resizedSrcSet(safe);
  return {
    blur: resizedImageSrc(safe, 320),
    src: srcSet ? resizedImageSrc(safe, 960) : safe,
    srcSet,
    sizes: srcSet ? sizes : undefined,
  };
}
