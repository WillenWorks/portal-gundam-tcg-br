import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface LatestCardsCarouselProps {
  limit?: number;
  className?: string;
}

export function LatestCardsCarousel({ limit = 30, className }: LatestCardsCarouselProps) {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasDraggedRef = useRef(false);

  // Busca e ordenação estrita conforme especificado:
  // "se houver cartas cadastradas no mesmo dia, então considerar ordenação de id/código/coleção do último cadastrado para o primeiro"
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api
      .listCardsPage({ sort: "created_desc" }, { page: 1, pageSize: limit })
      .then((res) => {
        if (!isMounted) return;
        const rawItems = res?.items ?? [];

        const sorted = [...rawItems].sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : "";
          const dateB = b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 10) : "";

          // 1. Data diferente: o mais recente primeiro
          if (dateA !== dateB) {
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
          }

          // 2. Mesmo dia: do último cadastrado para o primeiro (código/coleção decrescente)
          if (a.code && b.code && a.code !== b.code) {
            return b.code.localeCompare(a.code, undefined, { numeric: true });
          }

          // 3. Fallback id decrescente
          return String(b.id || "").localeCompare(String(a.id || ""));
        });

        setCards(sorted);
      })
      .catch((err) => {
        console.error("Falha ao carregar cartas recentes:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [limit]);

  // Atualização da barra de progresso e estado das setas
  const updateScrollMetrics = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) {
      setScrollProgress(0);
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const current = Math.max(0, el.scrollLeft);
    const progress = Math.min(1, Math.max(0, current / maxScroll));
    setScrollProgress(progress);
    setCanScrollLeft(current > 8);
    setCanScrollRight(current < maxScroll - 8);
  }, []);

  useEffect(() => {
    updateScrollMetrics();
    window.addEventListener("resize", updateScrollMetrics);
    return () => window.removeEventListener("resize", updateScrollMetrics);
  }, [updateScrollMetrics, cards]);

  const scrollByAmount = (amount: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  // Suporte a Mouse Drag para Desktop e Touch para Mobile
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.3;
    if (Math.abs(walk) > 4) {
      hasDraggedRef.current = true;
    }
    scrollRef.current.scrollLeft = scrollLeftRef.current - walk;
    updateScrollMetrics();
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Se o usuário estava arrastando o carrossel, previne navegar acidentalmente
    if (hasDraggedRef.current) {
      e.preventDefault();
    }
  };

  return (
    <section className={cn("relative mx-auto max-w-[1760px] px-4 py-6 sm:px-6 lg:px-8", className)}>
      {/* Container Principal Estilo Terminal Militar / Dark Tech */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/75 p-4 sm:p-6 lg:p-7 shadow-2xl backdrop-blur-xl light:border-slate-300 light:bg-white light:shadow-md">
        {/* Marca d'água técnica de fundo */}
        <div className="pointer-events-none absolute -right-16 -top-16 size-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 size-80 rounded-full bg-accent/5 blur-3xl" />

        {/* ── BARRA DE CABEÇALHO DO CARROSSEL ───────────────────────────────── */}
        <div className="relative flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4 sm:pb-5 light:border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex size-9 sm:size-10 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.25)]">
              <Sparkles className="size-4 sm:size-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">Database Oficial</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[9px] text-slate-400">
                  <span className="size-1.5 rounded-full bg-cyan-400 animate-ping" />
                  {cards.length > 0 ? `${cards.length} cartas recentes` : "Carregando acervo"}
                </span>
              </div>
              <h3 className="font-heading text-xl sm:text-2xl lg:text-3xl uppercase tracking-wider text-white heading-portal">
                Cartas Recentes
              </h3>
            </div>
          </div>

          {/* Botão de Navegar para o Catálogo Geral */}
          <Button
            asChild
            variant="outline"
            className="rounded-xl border-white/20 bg-white/5 hover:bg-white/10 hover:border-cyan-400/50 text-xs sm:text-sm uppercase tracking-[0.16em] font-semibold text-white light:border-slate-300 light:text-slate-900 light:hover:bg-slate-100 transition-all duration-300"
          >
            <Link href="/cards">
              Explorar Catálogo
              <ArrowRight className="ml-2 size-3.5" />
            </Link>
          </Button>
        </div>

        {/* ── LINHA HORIZONTAL DE CARTAS (CARROSSEL) ────────────────────────── */}
        <div className="relative mt-5 sm:mt-6">
          <div
            ref={scrollRef}
            onScroll={updateScrollMetrics}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-none py-3 px-1 select-none cursor-grab active:cursor-grabbing scroll-smooth"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {/* Estado de Carregamento: Skeletons */}
            {loading &&
              Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="w-[135px] sm:w-[155px] md:w-[170px] shrink-0 space-y-2">
                  <Skeleton className="aspect-[63/88] w-full rounded-xl bg-white/5" />
                  <Skeleton className="h-3 w-3/4 rounded bg-white/5" />
                </div>
              ))}

            {/* Renderização das Cartas */}
            {!loading &&
              cards.map((card) => {
                const imgUrl = card.imageMediumUrl || card.imageUrl || card.imageLargeUrl || card.thumbUrl;
                const cardName = card.namePt || card.nameEn || "Carta sem nome";
                const cardCode = card.code || "—";
                const setCode = card.set?.code || "";

                return (
                  <Link
                    key={card.id || card.code}
                    href={`/cards/${card.id}`}
                    onClick={handleCardClick}
                    title={`${cardCode} • ${cardName}${card.rarity ? ` (${card.rarity})` : ""}`}
                    className="group relative w-[135px] sm:w-[155px] md:w-[170px] shrink-0 block transition-transform duration-300 hover:scale-105 hover:-translate-y-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    {/* Moldura da Carta com Bordas Limpas Arredondadas */}
                    <div className="relative aspect-[63/88] w-full overflow-hidden rounded-xl border border-white/15 bg-slate-900 shadow-lg shadow-black/60 transition-all duration-300 group-hover:border-cyan-400/70 group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.8),0_0_24px_rgba(34,211,238,0.35)] light:border-slate-300">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={cardName}
                          loading="lazy"
                          draggable={false}
                          className="size-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center p-3 text-center bg-slate-950/80">
                          <Layers className="size-6 text-slate-600 mb-1.5" />
                          <span className="text-[10px] font-mono text-slate-400 uppercase">{cardCode}</span>
                          <span className="text-[9px] text-slate-500 line-clamp-2 mt-1">{cardName}</span>
                        </div>
                      )}

                      {/* Efeito Glow / Shimmer no Hover */}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                      {/* Badge Flutuante Inferior no Hover */}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2 text-left opacity-0 transition-all duration-300 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0">
                        <span className="font-mono text-[10px] font-bold text-cyan-300 drop-shadow-[0_1px_4px_rgba(0,0,0,1)]">
                          {cardCode}
                        </span>
                        <p className="font-heading text-xs text-white uppercase truncate drop-shadow-[0_1px_4px_rgba(0,0,0,1)]">
                          {cardName}
                        </p>
                      </div>

                      {/* Tag de Coleção no Topo Direito (Discreta) */}
                      {setCode && (
                        <div className="pointer-events-none absolute right-1.5 top-1.5 rounded-md bg-black/60 backdrop-blur-md px-1.5 py-0.5 border border-white/15 text-[9px] font-mono text-slate-300 shadow">
                          {setCode}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
          </div>

          {/* ── BARRA DE CONTROLE INFERIOR COM SETAS E INDICADOR DE TRILHA ────── */}
          <div className="mt-4 sm:mt-5 flex items-center justify-between gap-4 pt-3 border-t border-white/10 light:border-slate-200">
            {/* Seta Esquerda */}
            <button
              type="button"
              onClick={() => scrollByAmount(-480)}
              disabled={!canScrollLeft}
              aria-label="Rolar cartas para a esquerda"
              className={cn(
                "flex size-8 sm:size-9 items-center justify-center rounded-lg border transition-all duration-200",
                canScrollLeft
                  ? "border-white/20 bg-slate-900/90 text-white hover:bg-slate-800 hover:border-cyan-400/50 hover:scale-105 active:scale-95 shadow-md"
                  : "border-white/5 bg-slate-950/40 text-slate-600 cursor-not-allowed opacity-40"
              )}
            >
              <ChevronLeft className="size-4" />
            </button>

            {/* Trilha de Progresso do Slider (Exatamente como na referência) */}
            <div className="relative flex-1 h-1.5 max-w-xl mx-auto rounded-full bg-white/10 overflow-hidden light:bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-primary transition-all duration-150 ease-out shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                style={{
                  width: "28%",
                  transform: `translateX(${scrollProgress * 257}%)`,
                }}
              />
            </div>

            {/* Seta Direita */}
            <button
              type="button"
              onClick={() => scrollByAmount(480)}
              disabled={!canScrollRight}
              aria-label="Rolar cartas para a direita"
              className={cn(
                "flex size-8 sm:size-9 items-center justify-center rounded-lg border transition-all duration-200",
                canScrollRight
                  ? "border-white/20 bg-slate-900/90 text-white hover:bg-slate-800 hover:border-cyan-400/50 hover:scale-105 active:scale-95 shadow-md"
                  : "border-white/5 bg-slate-950/40 text-slate-600 cursor-not-allowed opacity-40"
              )}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
