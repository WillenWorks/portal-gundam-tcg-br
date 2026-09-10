/* PopularMainCardsSection — Estatísticas de Cartas Principais Populares (LR).
 * Exibe contagem de decks que utilizam cada carta Legend Rare, ordenadas da mais
 * popular para a menor, com acabamento tático fiel ao portal Anaheim HUB. */

import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, LayoutGrid, Layers, Sparkles } from "lucide-react";
import { api, type PopularLrCard } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export function PopularMainCardsSection() {
  const [cards, setCards] = useState<PopularLrCard[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    api
      .getPopularLRCards()
      .then((data) => {
        if (active) setCards(data);
      })
      .catch((err) => {
        console.error("Falha ao carregar cartas LR populares:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (!scrollContainerRef.current) return;
    const offset = direction === "left" ? -320 : 320;
    scrollContainerRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <section className="relative mx-auto max-w-[1760px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-6 backdrop-blur-md shadow-2xl">
        {/* Glow tático de fundo */}
        <div className="pointer-events-none absolute -top-24 -left-24 size-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-80 rounded-full bg-primary/10 blur-3xl" />

        {/* ── HEADER DA SEÇÃO ────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-950/30 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                <LayoutGrid className="size-5" />
              </div>
              <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-wide text-white">
                Cartas Principais Populares
              </h2>
            </div>
            {/* Linha com acento ciano à esquerda */}
            <div className="mt-3 relative h-[2px] w-full max-w-xl bg-slate-800/80">
              <div className="absolute left-0 top-0 h-full w-28 bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
            </div>
          </div>

          {/* Controles de Navegação do Scroll */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              onClick={() => scroll("left")}
              className="flex size-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-300 transition hover:border-cyan-400 hover:bg-cyan-500/10 hover:text-white"
              aria-label="Rolar para a esquerda"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              className="flex size-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-300 transition hover:border-cyan-400 hover:bg-cyan-500/10 hover:text-white"
              aria-label="Rolar para a direita"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {/* ── PRATELEIRA HORIZONTAL DE CARTAS ────────────────────────── */}
        <div
          ref={scrollContainerRef}
          className="mt-6 flex items-stretch gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]"
        >
          {loading ? (
            Array.from({ length: 7 }).map((_, idx) => (
              <div
                key={`skel-${idx}`}
                className="w-[145px] sm:w-[165px] md:w-[180px] shrink-0 aspect-[63/88] rounded-xl overflow-hidden border border-white/10 bg-slate-950 flex flex-col justify-between p-2"
              >
                <Skeleton className="h-5 w-8 bg-slate-800" />
                <div className="space-y-1 mt-auto">
                  <Skeleton className="h-4 w-full bg-slate-800" />
                  <Skeleton className="h-3 w-16 mx-auto bg-slate-800" />
                </div>
              </div>
            ))
          ) : cards.length === 0 ? (
            <div className="w-full py-12 text-center text-sm text-slate-400">
              Nenhuma carta LR registrada em decks públicos no momento.
            </div>
          ) : (
            <>
              {cards.map((card, idx) => {
                const rank = idx + 1;
                const cardImage = card.imageMediumUrl || card.imageUrl;
                const displayName = card.namePt || card.nameEn;

                return (
                  <Link
                    key={card.id}
                    href={`/cards/${card.id}`}
                    className="group relative flex w-[145px] sm:w-[165px] md:w-[180px] shrink-0 flex-col overflow-hidden rounded-xl border border-white/15 bg-slate-950 shadow-lg transition-all duration-300 hover:scale-[1.03] hover:border-cyan-400/80 hover:shadow-[0_0_24px_rgba(6,182,212,0.35)]"
                    title={`${displayName} — Presente em ${card.deckCount} decks`}
                  >
                    {/* Badge de Ranking (#1, #2...) */}
                    <div className="absolute left-2 top-2 z-10 rounded bg-slate-950/90 px-2 py-0.5 font-mono text-[11px] font-bold text-white border border-white/20 shadow-md">
                      #{rank}
                    </div>

                    {/* Proporção TCG da Carta */}
                    <div className="relative aspect-[63/88] w-full overflow-hidden bg-slate-950">
                      {cardImage ? (
                        <img
                          src={cardImage}
                          alt={displayName}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center p-3 text-center text-xs text-slate-500">
                          <Layers className="size-6 text-slate-600 mb-1" />
                          <span className="font-mono text-[10px] text-cyan-400">{card.code}</span>
                          <span className="line-clamp-2 mt-1">{displayName}</span>
                        </div>
                      )}

                      {/* Efeito Glow overlay no hover */}
                      <div className="absolute inset-0 bg-cyan-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
                    </div>

                    {/* Tarja Inferior com Nome e Contagem de Decks */}
                    <div className="flex min-h-[52px] flex-col items-center justify-center border-t border-white/10 bg-slate-950/95 px-2 py-1.5 text-center">
                      <p className="w-full truncate text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                        {displayName}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                        {card.deckCount} {card.deckCount === 1 ? "deck" : "decks"}
                      </p>
                    </div>
                  </Link>
                );
              })}

              {/* ── CARD FINAL "BROWSE MORE" ──────────────────────────── */}
              <Link
                href="/cards"
                className="group relative flex w-[145px] sm:w-[165px] md:w-[180px] shrink-0 aspect-[63/88] flex-col items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-slate-950/70 p-4 text-center shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-[1.03] hover:border-cyan-400/80 hover:shadow-[0_0_24px_rgba(6,182,212,0.35)]"
              >
                {/* Background com leve blur / padrão tático */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 to-slate-950/90 pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center gap-2.5">
                  <div className="flex size-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-slate-300 transition-all duration-300 group-hover:border-cyan-400 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 group-hover:scale-110">
                    <Sparkles className="size-5" />
                  </div>
                  <span className="font-heading text-sm font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
                    Browse More
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                    Ver Database
                  </span>
                </div>
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
