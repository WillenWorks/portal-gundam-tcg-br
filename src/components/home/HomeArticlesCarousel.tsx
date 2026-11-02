import { useEffect, useState, type TouchEvent } from "react";
import { Link } from "wouter";
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";

import { ArticleImageFrame } from "@/components/articles/ArticleImageFrame";
import { PostTagLinks } from "@/components/articles/PostTagLinks";
import { Button } from "@/components/ui/button";
import { api, type ApiPost, type PostType } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSiteLanguage } from "@/i18n/siteLanguage";

const CAROUSEL_ARTICLES = 5;
const SLIDE_INTERVAL_MS = 6000;
const SWIPE_MIN_PX = 40;

const POST_TYPE_LABEL: Record<PostType, { pt: string; en: string }> = {
  NEWS: { pt: "Notícia", en: "News" },
  PREVIEW: { pt: "Preview", en: "Preview" },
  REVIEW: { pt: "Análise", en: "Review" },
  GUIDE: { pt: "Guia", en: "Guide" },
};

const FRAME = "relative overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl light:border-slate-300";
const ARROW = "hidden sm:flex size-8 items-center justify-center rounded-full border border-white/20 bg-slate-950/60 text-white transition-all hover:bg-slate-900/90 hover:scale-110 active:scale-95";
// Altura limitada a partir de lg: a imagem aparece inteira sem o destaque ficar maior que o painel ao lado
const IMAGE_SLOT = "aspect-video w-full shrink-0 border-b border-white/10 lg:aspect-auto lg:h-80 min-[1800px]:h-auto min-[1800px]:min-h-[480px] min-[1800px]:w-3/5 min-[1800px]:self-stretch min-[1800px]:border-b-0 min-[1800px]:border-r";

/** Destaque da home: os últimos artigos publicados no Content Hub. */
export function HomeArticlesCarousel() {
  const { tr, isEn } = useSiteLanguage();
  const [articles, setArticles] = useState<ApiPost[] | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  // no celular as setas ficam escondidas; troca de slide deslizando o dedo
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    api.listPostsPage("PUBLISHED", { page: 1, pageSize: CAROUSEL_ARTICLES })
      .then((result) => setArticles(result?.items ?? []))
      .catch(() => setArticles([]));
  }, []);

  const count = articles?.length ?? 0;

  useEffect(() => {
    if (isPaused || count < 2) return;
    const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % count), SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isPaused, count]);

  if (articles === null) {
    return <div className={cn(FRAME, "min-h-[440px] lg:min-h-[500px] animate-pulse")} aria-busy="true" data-testid="home-articles-loading" />;
  }

  if (count === 0) {
    return (
      <div className={cn(FRAME, "flex min-h-[440px] lg:min-h-[500px] flex-col items-center justify-center p-8 text-center")}>
        <BookOpen className="mb-3 size-8 text-slate-500" />
        <p className="text-sm text-slate-300">{tr("Nenhum artigo publicado ainda.", "No articles published yet.")}</p>
        <p className="mt-1 text-xs text-slate-500">{tr("Guias, análises e notícias do Gundam Card Game aparecem aqui.", "Gundam Card Game guides, reviews and news will show up here.")}</p>
      </div>
    );
  }

  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + count) % count);
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % count);
  const onTouchStart = (event: TouchEvent) => setTouchStartX(event.touches[0]?.clientX ?? null);
  const onTouchEnd = (event: TouchEvent) => {
    if (touchStartX === null) return;
    const dx = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    if (dx > SWIPE_MIN_PX) prevSlide();
    else if (dx < -SWIPE_MIN_PX) nextSlide();
    setTouchStartX(null);
  };

  return (
    <div
      // os slides dividem a mesma célula da grade: o maior define a altura e nada pula na troca
      className={cn(FRAME, "grid")}
      onMouseEnter={() => setIsPaused(true)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseLeave={() => setIsPaused(false)}
    >
      {articles.map((article, idx) => {
        const isActive = idx === currentSlide;
        return (
          <div
            key={article.id}
            aria-hidden={!isActive}
            className={cn(
              "col-start-1 row-start-1 flex flex-col transition-opacity duration-700 ease-in-out min-[1800px]:flex-row",
              isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none",
            )}
          >
            {/* A imagem vai inteira, sem texto por cima: as capas costumam ter título próprio na arte */}
            {article.homeImage || article.coverImage ? (
              <ArticleImageFrame src={article.homeImage || article.coverImage || ""} priority={idx === 0} className={IMAGE_SLOT} />
            ) : (
              <div className={cn(IMAGE_SLOT, "flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950")}>
                <BookOpen className="size-10 text-slate-500" />
              </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col gap-3 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-xs border border-primary/50 bg-primary/20 px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  {tr(POST_TYPE_LABEL[article.postType])}
                </span>
                <PostTagLinks tags={article.tags} tabIndex={isActive ? undefined : -1} />
                {article.publishedAt ? (
                  <span className="text-[11px] text-slate-300 font-mono tracking-wider">
                    {new Date(article.publishedAt).toLocaleDateString(isEn ? "en-US" : "pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                ) : null}
              </div>
              <h2 className="font-heading text-xl sm:text-2xl uppercase text-white leading-tight line-clamp-3">
                {article.title}
              </h2>
              {article.excerpt ? (
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed line-clamp-2 min-[1800px]:line-clamp-6">
                  {article.excerpt}
                </p>
              ) : null}
              <div className="mt-auto pt-1">
                <Button asChild className="rounded-none bg-primary hover:bg-primary/90 text-primary-foreground text-xs uppercase tracking-[0.16em] font-semibold px-6 h-10 shadow-lg shadow-primary/20">
                  <Link href={`/articles/${article.slug}`} tabIndex={isActive ? undefined : -1}>
                    {tr("Ler artigo", "Read article")}
                    <ArrowRight className="ml-2 size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {count > 1 ? (
        <>
          <div className="absolute bottom-5 sm:bottom-6 right-5 sm:right-6 z-30 flex items-center gap-2">
            <button type="button" onClick={prevSlide} aria-label={tr("Slide anterior", "Previous slide")} className={ARROW}>
              <ChevronLeft className="size-4" />
            </button>
            {articles.map((article, idx) => (
              <button
                key={article.id}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                aria-label={tr(`Ir para o slide ${idx + 1}`, `Go to slide ${idx + 1}`)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  idx === currentSlide ? "w-7 sm:w-8 bg-primary" : "w-2 sm:w-2.5 bg-white/30 hover:bg-white/60",
                )}
              />
            ))}
            <button type="button" onClick={nextSlide} aria-label={tr("Próximo slide", "Next slide")} className={ARROW}>
              <ChevronRight className="size-4" />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
