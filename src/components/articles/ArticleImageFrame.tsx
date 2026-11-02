import { cn } from "@/lib/utils";

type ArticleImageFrameProps = {
  src: string;
  className?: string;
  priority?: boolean;
};

/**
 * Mostra a imagem inteira em qualquer proporção. O que sobra do quadro é preenchido pela
 * própria imagem desfocada, para capa com título na arte ou carta em pé não serem cortadas.
 */
export function ArticleImageFrame({ src, className, priority = false }: ArticleImageFrameProps) {
  return (
    <div className={cn("relative overflow-hidden bg-slate-900", className)}>
      <img src={src} alt="" aria-hidden="true" loading={priority ? "eager" : "lazy"} decoding="async" className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-xl" />
      <img
        src={src}
        alt=""
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "low"}
        decoding={priority ? "sync" : "async"}
        className="absolute inset-0 size-full object-contain"
      />
    </div>
  );
}
