/* RecentPopularDecksCarousel — Carrossel de Decks Populares Recentes.
 * Filtra os até 5 decks mais visitados na última semana ou últimos 15 dias,
 * apresentando banner temático, 4 cartas-chave com bordas neon, perfil do piloto
 * com nível e telemetria de curtidas/visualizações. Fiel à referência do portal. */

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Calendar, ChevronLeft, ChevronRight, Eye, Flame, Heart, MessageSquare, TrendingUp, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { api, type PopularRecentDeck } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import defaultDeckCover from "@/assets/home/default_deck_cover.jpg";
import defaultPilotAvatar from "@/assets/home/default_pilot_avatar.jpg";

// Bordas neon temáticas para as 4 miniaturas de cartas chave (ref: imagem 1)
const KEY_CARD_BORDER_CLASSES = [
  "border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.6)]",
  "border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]",
  "border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)]",
  "border-fuchsia-500 shadow-[0_0_12px_rgba(217,70,239,0.6)]",
];

// Imagens padrão oficiais (Hangar Tático para capas e Piloto com capacete sombreado para avatares)
const FALLBACK_DECK_BANNER = defaultDeckCover;
const FALLBACK_PILOT_AVATAR = defaultPilotAvatar;

export function RecentPopularDecksCarousel() {
  const [days, setDays] = useState<7 | 15>(15);
  const [decks, setDecks] = useState<PopularRecentDeck[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getRecentPopularDecks(days)
      .then((data) => {
        if (active) {
          setDecks(data);
          setCurrentIndex(0);
        }
      })
      .catch((err) => {
        console.error("Falha ao carregar decks populares recentes:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [days]);

  // Rotação automática suave a cada 6 segundos (pausa quando o mouse está em cima)
  useEffect(() => {
    if (decks.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % decks.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [decks.length, isPaused]);

  const currentDeck = decks[currentIndex];

  const handleToggleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentDeck) return;

    try {
      const res = await api.toggleDeckLike(currentDeck.id);
      setDecks((prev) =>
        prev.map((d, i) =>
          i === currentIndex
            ? { ...d, hasLiked: res.liked, likeCount: res.likeCount }
            : d
        )
      );
      toast.success(res.liked ? "Deck curtido!" : "Curtida removida.");
    } catch (err: any) {
      if (err?.message?.includes("Token") || err?.status === 401) {
        toast.error("Faça login para curtir este deck.");
      } else {
        toast.error("Não foi possível registrar a curtida.");
      }
    }
  };

  const nextDeck = () => {
    if (!decks.length) return;
    setCurrentIndex((prev) => (prev + 1) % decks.length);
  };

  const prevDeck = () => {
    if (!decks.length) return;
    setCurrentIndex((prev) => (prev - 1 + decks.length) % decks.length);
  };

  return (
    <section className="relative mx-auto max-w-[1760px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-6 backdrop-blur-md shadow-2xl">
        {/* Glow de fundo */}
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-rose-500/10 blur-3xl" />

        {/* ── HEADER DA SEÇÃO COM FILTRO TEMPORAL ────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-950/30 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                <TrendingUp className="size-5" />
              </div>
              <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-wide text-white">
                Decks Recentes Populares
              </h2>
            </div>
            {/* Linha com acento ciano à esquerda */}
            <div className="mt-3 relative h-[2px] w-full max-w-xl bg-slate-800/80">
              <div className="absolute left-0 top-0 h-full w-28 bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
            </div>
          </div>

          {/* Filtro de Janela Temporal (7 vs 15 dias) */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="inline-flex rounded-lg border border-white/15 bg-slate-950/80 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setDays(7)}
                className={cn(
                  "rounded-md px-3 py-1 transition-all",
                  days === 7
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Últimos 7 dias
              </button>
              <button
                type="button"
                onClick={() => setDays(15)}
                className={cn(
                  "rounded-md px-3 py-1 transition-all",
                  days === 15
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Últimos 15 dias
              </button>
            </div>
          </div>
        </div>

        {/* ── CARD PRINCIPAL EM DESTAQUE ──────────────────────────────── */}
        <div
          className="mt-6"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {loading ? (
            <div className="relative h-64 sm:h-72 md:h-80 w-full rounded-xl border border-white/10 bg-slate-950 p-6 flex flex-col justify-between overflow-hidden">
              <Skeleton className="h-7 w-28 bg-slate-800" />
              <div className="flex gap-3">
                <Skeleton className="size-14 rounded-md bg-slate-800" />
                <Skeleton className="size-14 rounded-md bg-slate-800" />
                <Skeleton className="size-14 rounded-md bg-slate-800" />
              </div>
              <Skeleton className="h-8 w-64 bg-slate-800" />
            </div>
          ) : !currentDeck ? (
            <div className="h-64 flex items-center justify-center rounded-xl border border-white/10 bg-slate-950/60 text-slate-400 text-sm">
              Nenhum deck público encontrado para o período selecionado.
            </div>
          ) : (
            <div className="relative">
              {/* Card Estruturado estilo Banner Retrô-Tático */}
              <div className="relative overflow-hidden rounded-xl border border-white/15 bg-slate-950 shadow-2xl transition-all duration-300 hover:border-cyan-500/50">
                {/* Banner de Fundo (Arte Gundam / Capa do Deck) */}
                <div className="relative h-56 sm:h-64 md:h-72 w-full overflow-hidden bg-slate-950">
                  <img
                    src={currentDeck.coverImage || FALLBACK_DECK_BANNER}
                    alt={currentDeck.name}
                    className="h-full w-full object-cover object-center filter brightness-[0.7] contrast-125 transition-transform duration-700 hover:scale-105"
                  />
                  {/* Gradiente de Fusão para legibilidade */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/60" />

                  {/* Badge de Visualizações com Fogo (Topo Esquerdo) */}
                  <div className="absolute left-3.5 top-3.5 z-20 flex items-center gap-1.5 rounded-md border border-white/20 bg-black/80 px-3 py-1 font-mono text-xs font-bold text-white shadow-lg backdrop-blur-md">
                    <Eye className="size-3.5 text-cyan-400" />
                    <span>{currentDeck.recentViews || currentDeck.viewCount}</span>
                    <span className="text-amber-400">🔥</span>
                  </div>

                  {/* 4 Miniaturas de Cartas-Chave com Bordas Neon */}
                  <div className="absolute left-3.5 sm:left-6 top-14 sm:top-16 z-20 flex items-center gap-2 sm:gap-2.5">
                    {currentDeck.featuredCards.slice(0, 4).map((card, idx) => (
                      <Link
                        key={card.id || `feat-${idx}`}
                        href={`/cards/${card.id}`}
                        className={cn(
                          "relative size-12 sm:size-14 md:size-16 shrink-0 overflow-hidden rounded-md border-2 bg-slate-950 shadow-lg transition-transform duration-200 hover:scale-110",
                          KEY_CARD_BORDER_CLASSES[idx % KEY_CARD_BORDER_CLASSES.length]
                        )}
                        title={card.name}
                      >
                        {card.imageUrl ? (
                          <img
                            src={card.imageUrl}
                            alt={card.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center p-1 text-[8px] font-mono text-slate-400">
                            {card.code}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>

                  {/* Tarja com o Nome do Deck (Centro-Inferior Esquerdo) */}
                  <div className="absolute left-3.5 sm:left-6 bottom-4 sm:bottom-6 z-20 max-w-[70%] sm:max-w-[65%] md:max-w-[60%]">
                    <Link
                      href={`/deck/${currentDeck.shareId}`}
                      className="inline-block rounded-r-md border-l-4 border-rose-500 bg-gradient-to-r from-purple-950/95 via-slate-900/90 to-slate-900/60 px-3 py-1.5 backdrop-blur-md shadow-md hover:from-purple-900 hover:to-slate-800 transition-all"
                      title={currentDeck.name}
                    >
                      <h3 className="font-heading text-sm sm:text-base md:text-lg font-bold uppercase tracking-wider text-white truncate max-w-full">
                        {currentDeck.name}
                      </h3>
                    </Link>
                  </div>

                  {/* Card do Piloto com Nível (Canto Inferior Direito, sobreposto) */}
                  <div className="absolute right-3.5 sm:right-6 bottom-3 sm:bottom-4 z-20 flex items-center gap-2 rounded-xl border border-white/20 bg-slate-950/90 px-3 py-1.5 shadow-2xl backdrop-blur-md">
                    {/* Badge de Nível (Ref: círculo 7 dourado) */}
                    <div className="relative">
                      <div className="size-10 sm:size-12 overflow-hidden rounded-lg border border-white/20 bg-slate-800 shadow-md">
                        <img
                          src={currentDeck.user?.avatarUrl || FALLBACK_PILOT_AVATAR}
                          alt={currentDeck.user?.displayName || "Piloto"}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="absolute -bottom-1.5 -left-2 flex size-6 items-center justify-center rounded-full border-2 border-slate-950 bg-gradient-to-br from-amber-400 to-amber-600 font-mono text-[11px] font-black text-slate-950 shadow-lg">
                        {currentDeck.user?.level || 7}
                      </div>
                    </div>
                    {/* Nome do Piloto */}
                    <div className="min-w-0 pl-1">
                      <p className="truncate text-xs sm:text-sm font-bold text-white border-b-2 border-rose-500/80 pb-0.5 max-w-[110px] sm:max-w-[150px]">
                        {currentDeck.user?.displayName || "Piloto"}
                      </p>
                      <p className="text-[10px] uppercase font-mono text-slate-400">
                        @{currentDeck.user?.username || "piloto"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── BARRA DE RODAPÉ COM TELEMETRIA ────────────────────── */}
                <div className="flex items-center justify-between border-t border-white/10 bg-slate-950 px-4 py-2.5 text-xs text-slate-400">
                  {/* Curtidas & Comentários */}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={handleToggleLike}
                      className="flex items-center gap-1.5 transition-colors hover:text-rose-400"
                      title="Curtir deck"
                    >
                      <Heart
                        className={cn(
                          "size-4 transition-transform active:scale-125",
                          currentDeck.hasLiked
                            ? "fill-rose-500 text-rose-500"
                            : "text-slate-400 hover:text-rose-400"
                        )}
                      />
                      <span className="font-mono text-xs">{currentDeck.likeCount}</span>
                    </button>

                    <span className="flex items-center gap-1.5 text-slate-400" title="Comentários">
                      <MessageSquare className="size-4" />
                      <span className="font-mono text-xs">0</span>
                    </span>
                  </div>

                  {/* Data de Registro */}
                  <div className="flex items-center gap-1.5 font-mono text-xs text-slate-400">
                    <Calendar className="size-3.5" />
                    <span>
                      {new Date(currentDeck.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Linha de acento inferior em gradiente vermelho/rosa */}
                <div className="h-[2.5px] w-full bg-gradient-to-r from-rose-500 via-purple-500 to-cyan-500" />
              </div>

              {/* Botões laterais de navegação flutuantes */}
              {decks.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevDeck}
                    className="absolute -left-3 sm:-left-4 top-1/2 -translate-y-1/2 z-30 flex size-9 items-center justify-center rounded-full border border-white/20 bg-slate-950/80 text-white shadow-xl backdrop-blur-md transition hover:border-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300"
                    aria-label="Deck anterior"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={nextDeck}
                    className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-30 flex size-9 items-center justify-center rounded-full border border-white/20 bg-slate-950/80 text-white shadow-xl backdrop-blur-md transition hover:border-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300"
                    aria-label="Próximo deck"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── INDICADORES DE PAGINAÇÃO EM DOTS (Ref: imagem 1) ────────── */}
          {decks.length > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {decks.map((_, idx) => (
                <button
                  key={`dot-${idx}`}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "transition-all duration-300",
                    idx === currentIndex
                      ? "h-1.5 w-6 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                      : "size-1.5 rounded-full bg-slate-700 hover:bg-slate-500"
                  )}
                  aria-label={`Ir para deck ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
