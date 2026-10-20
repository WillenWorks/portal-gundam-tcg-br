import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Radio,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppTopNav } from "@/components/layout/AppTopNav";
import { AppFooter } from "@/components/layout/shared/AppFooter";
import { LatestCardsCarousel } from "@/components/home/LatestCardsCarousel";
import { HomeDirectivesSection } from "@/components/home/HomeDirectivesSection";
import { PopularMainCardsSection } from "@/components/home/PopularMainCardsSection";
import { RecentPopularDecksCarousel } from "@/components/home/RecentPopularDecksCarousel";
import { LatestCollectionsSection } from "@/components/home/LatestCollectionsSection";
import { RecentTournamentsSection } from "@/components/home/RecentTournamentsSection";
import { CockpitRegistrationSection } from "@/components/home/CockpitRegistrationSection";
import { GundamSeriesShowcase } from "@/components/home/GundamSeriesShowcase";
import { AboutAnaheimHubSection } from "@/components/home/AboutAnaheimHubSection";
import { useFaction } from "@/contexts/FactionContext";
import { cn } from "@/lib/utils";

import rx78HeadOff from "@/assets/home/rx78_head_off.jpg";
import rx78HeadOn from "@/assets/home/rx78_head_on.jpg";
import zakuHeadOff from "@/assets/home/zaku_head_off.jpg";
import zakuHeadOn from "@/assets/home/zaku_head_on.jpg";
import ozHangarOff from "@/assets/home/oz_hangar_off.jpg";
import ozHangarOn from "@/assets/home/oz_hangar_on.jpg";
import exiaVedaOff from "@/assets/home/exia_veda_off.jpg";
import exiaVedaOn from "@/assets/home/exia_veda_on.jpg";
import newsStartersClash from "@/assets/home/news_starters_clash.jpg";
import newsVedaTerminal from "@/assets/home/news_veda_terminal.jpg";

interface HomeProps {
  targetSection?: string;
}

const CAROUSEL_SLIDES = [
  {
    id: 1,
    category: "GUIA",
    date: "09 Set 2026",
    title: "STARTERS ST01 A ST04: GUIA PARA COMEÇAR",
    summary:
      "Entenda o estilo de cada um dos quatro starters: a agressividade de Zeon, a flexibilidade da Federação, o controle de SEED e a tecnologia de The Witch from Mercury.",
    image: newsStartersClash,
    link: "/sets",
    actionLabel: "Ver coleções",
  },
  {
    id: 2,
    category: "ESTATÍSTICAS",
    date: "08 Set 2026",
    title: "META DA TEMPORADA: DECKS E CARTAS QUE MAIS VENCEM",
    summary:
      "Taxas de vitória, cartas mais usadas em campeonatos e os arquétipos que dominam a temporada, a partir dos torneios registrados.",
    image: newsVedaTerminal,
    link: "/stats",
    actionLabel: "Ver estatísticas",
  },
  {
    id: 3,
    category: "SIMULADOR",
    date: "06 Set 2026",
    title: "SIMULADOR: PARTIDAS ONLINE E TREINO CONTRA O BOT",
    summary:
      "Jogue com as regras oficiais contra outras pessoas online ou treine sozinho contra o bot. Entrar na conta é opcional.",
    image: newsStartersClash,
    link: "/simulador",
    actionLabel: "Abrir o simulador",
  },
  {
    id: 4,
    category: "DECKBUILDER",
    date: "04 Set 2026",
    title: "MONTE SEU DECK: CURVA DE CUSTO E RECURSOS",
    summary:
      "Aprenda a equilibrar Unidades, Pilotos e Comandos para ter um deck consistente do primeiro ao último turno.",
    image: newsVedaTerminal,
    link: "/deckbuilder",
    actionLabel: "Montar um deck",
  },
];

export default function Home({ targetSection }: HomeProps) {
  const { faction } = useFaction();
  const isZeon = faction === "zeon";

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % CAROUSEL_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [isPaused]);

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % CAROUSEL_SLIDES.length);
  };

  useEffect(() => {
    if (targetSection) {
      document.getElementById(targetSection)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [targetSection]);

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      <div className="pointer-events-none absolute inset-0 bg-grid-tech opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-20" />

      <AppTopNav />

      {/* ── BARRA INSTITUCIONAL DE ACESSO PÚBLICO E TRANSPARÊNCIA (DIRETRIZES GOOGLE) — OCULTADA TEMPORARIAMENTE
      <div className="border-b border-white/10 bg-slate-950/75 dark:bg-slate-950/75 light:border-slate-300 light:bg-slate-100 py-2 px-4 text-xs">
        <div className="container-ultrawide flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300 dark:text-slate-300 light:text-slate-700">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              <strong>PLATAFORMA PÚBLICA & ABERTA:</strong> Consulta irrestrita a cartas, decks, regras e torneios sem exigência de login.
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 dark:text-slate-400 light:text-slate-600">
            <Link href="/database" className="text-primary hover:underline">Cartas</Link>
            <Link href="/torneios" className="text-primary hover:underline">Torneios</Link>
            <Link href="/rules" className="text-primary hover:underline">Regras</Link>
            <Link href="/privacidade" className="hover:text-primary transition-colors">Privacidade</Link>
            <Link href="/termos" className="hover:text-primary transition-colors">Termos</Link>
          </div>
        </div>
      </div>
      */}

      <main id="topo">
        <h1 className="sr-only">AnaheimHub: cartas, decks, torneios, estatísticas e simulador de Gundam Card Game no Brasil</h1>
        {/* ── HERO SECTION: PORTAL RESUMO (CARROSSEL + LINKS RÁPIDOS) ───── */}
        <section className="relative isolate overflow-hidden border-b border-white/10 py-6 sm:py-8 lg:py-10">
          <div className="container-ultrawide">
            <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.95fr] xl:grid-cols-[1.45fr_0.95fr] gap-6 lg:gap-8 items-stretch">
              {/* LADO ESQUERDO: CARROSSEL DE NOTÍCIAS COM MAIOR VISIBILIDADE */}
              <div
                className="relative flex flex-col justify-end overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl min-h-[440px] sm:min-h-[480px] lg:min-h-[520px] group"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              >
                {/* Slides com transição suave */}
                {CAROUSEL_SLIDES.map((slide, idx) => {
                  const isActive = idx === currentSlide;
                  return (
                    <div
                      key={slide.id}
                      className={cn(
                        "absolute inset-0 transition-opacity duration-700 ease-in-out",
                        isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                      )}
                    >
                      {/* Imagem de Fundo da Notícia */}
                      <img decoding="async"
                        src={slide.image}
                        alt={slide.title}
                        className="size-full object-cover object-center transform transition-transform duration-1000 group-hover:scale-105"
                      />
                      {/* Overlay Escuro com Gradiente para Leitura Perfeita */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-transparent" />
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-transparent to-slate-950/30" />

                      {/* Elementos dentro da Capa da Notícia */}
                      <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8 lg:p-10 z-20">
                        {/* Topo do Card da Notícia: Tag de Categoria e Data */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="rounded-xs border border-primary/50 bg-primary/20 backdrop-blur-md px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-primary">
                              {slide.category}
                            </span>
                            <span className="text-[11px] text-slate-300 font-mono tracking-wider">
                              {slide.date}
                            </span>
                          </div>
                          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-black/40 border border-white/10 px-3 py-0.5 text-[10px] text-slate-300 backdrop-blur-md">
                            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                            Destaque
                          </span>
                        </div>

                        {/* Base do Card: Título integrado na Capa, Resumo e Botão de Ação */}
                        <div className="space-y-3 sm:space-y-4 max-w-3xl">
                          <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl uppercase text-white leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                            {slide.title}
                          </h2>
                          <p className="text-slate-300 text-xs sm:text-sm md:text-base leading-relaxed line-clamp-2 sm:line-clamp-3 drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]">
                            {slide.summary}
                          </p>
                          <div className="pt-2 flex items-center gap-4">
                            <Button asChild className="rounded-none bg-primary hover:bg-primary/90 text-primary-foreground text-xs uppercase tracking-[0.16em] font-semibold px-6 h-10 shadow-lg shadow-primary/20">
                              <Link href={slide.link}>
                                {slide.actionLabel}
                                <ArrowRight className="ml-2 size-3.5" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Controles do Carrossel: Setas de Navegação */}
                <button
                  type="button"
                  onClick={prevSlide}
                  aria-label="Slide anterior"
                  className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-30 flex size-9 sm:size-10 items-center justify-center rounded-full border border-white/20 bg-slate-950/60 text-white backdrop-blur-md transition-all hover:bg-slate-900/90 hover:scale-110 active:scale-95"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={nextSlide}
                  aria-label="Próximo slide"
                  className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-30 flex size-9 sm:size-10 items-center justify-center rounded-full border border-white/20 bg-slate-950/60 text-white backdrop-blur-md transition-all hover:bg-slate-900/90 hover:scale-110 active:scale-95"
                >
                  <ChevronRight className="size-5" />
                </button>

                {/* Indicadores de Slide (Barras/Dots) */}
                <div className="absolute bottom-3 sm:bottom-4 right-6 sm:right-8 z-30 flex items-center gap-2">
                  {CAROUSEL_SLIDES.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentSlide(idx)}
                      aria-label={`Ir para o slide ${idx + 1}`}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        idx === currentSlide
                          ? "w-7 sm:w-8 bg-primary"
                          : "w-2 sm:w-2.5 bg-white/30 hover:bg-white/60"
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* LADO DIREITO: PAINEL DE ACESSO OPERACIONAL (SIMULADOR, DECKBUILDER, VEDA) */}
              <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-950/85 p-5 sm:p-6 shadow-2xl backdrop-blur-xl light:border-slate-300 light:bg-white light:shadow-md">
                {/* Cabeçalho do Painel */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 light:border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
                      <Activity className="size-4 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Comece por aqui</p>
                      <h3 className="font-heading text-xl uppercase tracking-wider text-white heading-portal">O que dá para fazer</h3>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Online
                  </span>
                </div>

                {/* Lista dos 3 Links Rápidos com Ícones Animados */}
                <div className="space-y-3.5 flex-1 flex flex-col justify-around">
                  {/* Linha 1: Simulador (Arena Asticassia) */}
                  <Link
                    href="/simulador"
                    title="Abrir o simulador — partidas online e treino contra o bot"
                    className={cn(
                      "group relative flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4 transition-all duration-300 hover:bg-white/[0.07] hover:border-white/20 light:border-slate-300 light:bg-slate-50 light:hover:bg-slate-100",
                      isZeon ? "hover:border-red-500/40" : "hover:border-primary/40"
                    )}
                  >
                    {/* Ícone com Efeito Mecha On/Off no Hover */}
                    <div
                      className={cn(
                        "relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-950 transition-all duration-300 group-hover:scale-105",
                        isZeon
                          ? "group-hover:shadow-[0_0_24px_rgba(239,68,68,0.55)] group-hover:border-red-500/60"
                          : "group-hover:shadow-[0_0_24px_rgba(56,189,248,0.55)] group-hover:border-sky-400/60"
                      )}
                    >
                      {/* Estado Desativado / Standby */}
                      <img loading="lazy" decoding="async"
                        src={isZeon ? zakuHeadOff : rx78HeadOff}
                        alt={isZeon ? "Zaku II do Char Standby" : "RX-78-2 Gundam Standby"}
                        className="absolute inset-0 size-full object-cover transition-opacity duration-300 group-hover:opacity-0"
                      />
                      {/* Estado Energizado / Olhos Acesos no Hover */}
                      <img loading="lazy" decoding="async"
                        src={isZeon ? zakuHeadOn : rx78HeadOn}
                        alt={isZeon ? "Zaku II do Char Monoeye Ativo" : "RX-78-2 Gundam Olhos Amarelos"}
                        className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      />
                    </div>

                    {/* Textos da Arena Asticassia */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-xs border",
                          isZeon
                            ? "border-red-500/40 bg-red-500/15 text-red-400"
                            : "border-primary/40 bg-primary/15 text-primary"
                        )}>
                          <span className={cn("size-1.5 rounded-full animate-pulse", isZeon ? "bg-red-500" : "bg-primary")} />
                          SIMULADOR ONLINE · LOGIN OPCIONAL
                        </span>
                      </div>
                      <h4 className={cn(
                        "font-heading text-lg sm:text-xl uppercase text-white transition-colors duration-200 heading-portal truncate",
                        isZeon ? "group-hover:text-red-400" : "group-hover:text-primary"
                      )}>
                        Simulador
                      </h4>
                      <p className="text-xs text-muted-portal line-clamp-2 mt-0.5 leading-relaxed">
                        Jogue online contra outras pessoas ou treine contra o bot.
                      </p>
                    </div>

                    {/* Seta Indicativa */}
                    <div className="shrink-0 text-slate-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white light:group-hover:text-slate-900">
                      <ArrowRight className="size-5" />
                    </div>
                  </Link>

                  {/* Linha 2: Deckbuilder (Hangar Tático) */}
                  <Link
                    href="/deckbuilder"
                    title="Abrir o deckbuilder — montar e validar decks"
                    className="group relative flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4 transition-all duration-300 hover:bg-white/[0.07] hover:border-amber-400/40 light:border-slate-300 light:bg-slate-50 light:hover:bg-slate-100"
                  >
                    {/* Ícone com Efeito Hangar On/Off no Hover */}
                    <div className="relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-950 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_24px_rgba(234,179,8,0.5)] group-hover:border-amber-400/60">
                      <img loading="lazy" decoding="async"
                        src={ozHangarOff}
                        alt=""
                        className="absolute inset-0 size-full object-cover transition-opacity duration-300 group-hover:opacity-0"
                      />
                      <img loading="lazy" decoding="async"
                        src={ozHangarOn}
                        alt=""
                        className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      />
                    </div>

                    {/* Textos do Hangar Tático */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-xs border border-amber-500/40 bg-amber-500/15 text-amber-400">
                          <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                          DECKBUILDER · ACESSO PÚBLICO LIVRE
                        </span>
                      </div>
                      <h4 className="font-heading text-lg sm:text-xl uppercase text-white transition-colors duration-200 heading-portal truncate group-hover:text-amber-400">
                        Deckbuilder
                      </h4>
                      <p className="text-xs text-muted-portal line-clamp-2 mt-0.5 leading-relaxed">
                        Monte, valide e compartilhe decks, com estatísticas do deck enquanto você monta.
                      </p>
                    </div>

                    {/* Seta Indicativa */}
                    <div className="shrink-0 text-slate-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white light:group-hover:text-slate-900">
                      <ArrowRight className="size-5" />
                    </div>
                  </Link>

                  {/* Linha 3: Estatísticas (Sistema VEDA) */}
                  <Link
                    href="/stats"
                    title="Abrir as estatísticas — taxas de vitória e meta"
                    className="group relative flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4 transition-all duration-300 hover:bg-white/[0.07] hover:border-emerald-400/40 light:border-slate-300 light:bg-slate-50 light:hover:bg-slate-100"
                  >
                    {/* Ícone com Efeito VEDA On/Off no Hover */}
                    <div className="relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-950 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_24px_rgba(16,185,129,0.55)] group-hover:border-emerald-400/60">
                      <img loading="lazy" decoding="async"
                        src={exiaVedaOff}
                        alt=""
                        className="absolute inset-0 size-full object-cover transition-opacity duration-300 group-hover:opacity-0"
                      />
                      <img loading="lazy" decoding="async"
                        src={exiaVedaOn}
                        alt=""
                        className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      />
                    </div>

                    {/* Textos do Sistema VEDA */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-xs border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          METAGAME & STATS · ACESSO PÚBLICO LIVRE
                        </span>
                      </div>
                      <h4 className="font-heading text-lg sm:text-xl uppercase text-white transition-colors duration-200 heading-portal truncate group-hover:text-emerald-400">
                        Estatísticas
                      </h4>
                      <p className="text-xs text-muted-portal line-clamp-2 mt-0.5 leading-relaxed">
                        Taxas de vitória, cores mais jogadas e o meta de cada temporada.
                      </p>
                    </div>

                    {/* Seta Indicativa */}
                    <div className="shrink-0 text-slate-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white light:group-hover:text-slate-900">
                      <ArrowRight className="size-5" />
                    </div>
                  </Link>
                </div>

                {/* Rodapé do Painel com Link de Novidades */}
                <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between text-xs text-muted-portal light:border-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Radio className="size-3 text-primary animate-pulse" />
                    Atualizado com os torneios registrados
                  </span>
                  <Link href="/novidades" className="hover:text-primary transition-colors flex items-center gap-1 font-medium">
                    Ver novidades do site <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CARROSSEL EM LINHA DE CARTAS RECENTES (DATABASE) ──────────── */}
        <LatestCardsCarousel limit={30} />

        {/* ── ÁREA INSTITUCIONAL: GRATIDÃO, MÉTRICAS, RULINGS & LINKS OFICIAIS ── */}
        <HomeDirectivesSection />

        {/* ── DECKS POPULARES RECENTES (ÚLTIMA SEMANA / 15 DIAS) ─────────── */}
        <RecentPopularDecksCarousel />

        {/* ── CARTAS PRINCIPAIS POPULARES (LR RANKING) ──────────────────── */}
        <PopularMainCardsSection />

        {/* ── ÚLTIMAS COLEÇÕES (PRODUTOS EM LINHA) ─────────────────────── */}
        <LatestCollectionsSection />

        {/* ── ÚLTIMOS EVENTOS & METAGAME NACIONAL ───────────────────────── */}
        <RecentTournamentsSection />

        {/* ── CADASTRE-SE AQUI E PILOTE (COCKPIT DO GUNDAM) ─────────────── */}
        <CockpitRegistrationSection />

        {/* ── CONHEÇA AS SÉRIES DE GUNDAM (LORE & ROADMAP WIKI) ─────────── */}
        <GundamSeriesShowcase />

        {/* ── SOBRE A ANAHEIM HUB (CARD INSTITUCIONAL COM LOGO) ─────────── */}
        <AboutAnaheimHubSection />
      </main>

      {/* ── FOOTER INSTITUCIONAL PADRONIZADO ────────────────────────────── */}
      <AppFooter />
    </div>
  );
}
