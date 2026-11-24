import { resizedImageSrc, resizedSrcSet } from "@/lib/resizedImage";
import { safeImageSrc } from "@/lib/safeImageSrc";
import { cn } from "@/lib/utils";

type ArticleImageFrameProps = {
  src: string;
  className?: string;
  priority?: boolean;
  /** largura em que o quadro aparece (atributo `sizes`): o navegador escolhe a versão do `srcset` por ela */
  sizes?: string;
};

/** quadro de largura cheia no celular, metade da tela em diante */
const DEFAULT_SIZES = "(min-width: 1024px) 50vw, 100vw";

/**
 * Mostra a imagem inteira em qualquer proporção. O que sobra do quadro é preenchido pela
 * própria imagem desfocada, para capa com título na arte ou carta em pé não serem cortadas.
 * Imagens do portal vêm do servidor já no tamanho da tela, em WebP (`srcset`); o fundo desfocado usa a menor.
 */
export function ArticleImageFrame({ src, className, priority = false, sizes = DEFAULT_SIZES }: ArticleImageFrameProps) {
  const safeSrc = safeImageSrc(src);
  if (!safeSrc) return <div className={cn("bg-slate-900", className)} />;
  const srcSet = resizedSrcSet(safeSrc);
  return (
    <div className={cn("relative overflow-hidden bg-slate-900", className)}>
      <img
        src={resizedImageSrc(safeSrc, 320)}
        alt=""
        aria-hidden="true"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-xl"
      />
      <img
        src={srcSet ? resizedImageSrc(safeSrc, 960) : safeSrc}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt=""
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "low"}
        decoding={priority ? "sync" : "async"}
        className="absolute inset-0 size-full object-contain"
      />
    </div>
  );
}
