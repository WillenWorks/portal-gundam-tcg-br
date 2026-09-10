/* Home v9.0 (Versão 1.2.0) — Asticassia TCG Hub.
 * Reformulada para apresentar a plataforma como um produto completo, maduro e sério.
 * Foco em: Fonte de notícias, hub de deckbuilders, arena de partidas, e acolhimento
 * a novatos na franquia e jogadores com barreira no idioma inglês. */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Gamepad2,
  Globe,
  Layers,
  Play,
  Radio,
  Shield,
  Sparkles,
  Swords,
  Video,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppTopNav } from "@/components/layout/AppTopNav";
import { DeckPreviewCard } from "@/components/deck/DeckPreviewCard";
import { LatestCardsCarousel } from "@/components/home/LatestCardsCarousel";
import { HomeDirectivesSection } from "@/components/home/HomeDirectivesSection";
import { PopularMainCardsSection } from "@/components/home/PopularMainCardsSection";
import { RecentPopularDecksCarousel } from "@/components/home/RecentPopularDecksCarousel";
import { useAuth } from "@/contexts/AuthContext";
import { useFaction } from "@/contexts/FactionContext";
import { api, type ApiDeck } from "@/lib/api";
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

const NEWS_ARTICLES = [
  {
    tag: "Artigo & Previews",
    date: "08 Set 2026",
    title: "Análise Tática dos Starters ST01 a ST04",
    summary:
      "Entenda as estratégias fundamentais de cada cor no Gundam Card Game: a pressão militar de Zeon, a versatilidade da Federação, o controle de SEED e os combos tecnológicos de Witch from Mercury.",
    link: "/sets",
  },
  {
    tag: "Regras Oficiais",
    date: "06 Set 2026",
    title: "Guia Completo de Link de Pilotos e Palavras-chave",
    summary:
      "Como funcionam as sinergias de link entre Mobile Suits e Pilotos, bônus de AP/HP e resolução de efeitos de disparo de escudo (Burst).",
    link: "/rules",
  },
  {
    tag: "Metagame",
    date: "03 Set 2026",
    title: "Curva de Recursos e Gerenciamento de Energia",
    summary:
      "Dicas avançadas de deckbuilding: proporção ideal entre Unidades, Pilotos e Comandos para nunca faltar recurso no início de partida.",
    link: "/stats",
  },
];

const COMMUNITY_VIDEOS = [
  {
    channel: "Gundam TCG Brasil",
    title: "Como Jogar Gundam Card Game — Tutorial do Zero ao Avançado",
    duration: "18:42",
    type: "Tutorial Básico",
    url: "https://www.youtube.com/results?search_query=gundam+card+game+tutorial+brasil",
  },
  {
    channel: "Hangar Competitivo",
    title: "Gameplay Comentado: ST01 Federação vs ST02 Zeon",
    duration: "24:15",
    type: "Partida Real",
    url: "https://www.youtube.com/results?search_query=gundam+tcg+gameplay+st01+st02",
  },
  {
    channel: "Deck Tech BR",
    title: "Construindo seu Primeiro Deck Competitivo — Dicas e Staples",
    duration: "15:30",
    type: "Deck Tech",
    url: "https://www.youtube.com/results?search_query=gundam+card+game+deck+tech",
  },
];

const BEGINNER_GUIDES = [
  {
    icon: Globe,
    title: "Barreira com o Inglês? Regras em Português",
    description:
      "Todas as cartas e regras oficiais traduzidas fielmente com os termos originais (Active, Rest, Shield, Burst, Link) preservados lado a lado para você aprender sem medo.",
  },
  {
    icon: Shield,
    title: "Novo na Franquia Gundam?",
    description:
      "Não precisa ser veterano de anime para jogar! Nossos guias explicam o universo, as facções (Federação, Zeon, Asticassia, ZAFT) e como cada série se comporta na mesa.",
  },
  {
    icon: Bot,
    title: "Treine no Seu Ritmo com Modo Solo",
    description:
      "Pratique suas jogadas e teste decks a qualquer hora contra o bot tático nos níveis Fácil, Normal e Difícil, sem pressão de tempo ou adversário.",
  },
];

const CAROUSEL_SLIDES = [
  {
    id: 1,
    category: "ANÁLISE DE COMBATE",
    date: "09 Set 2026",
    title: "ANÁLISE TÁTICA DOS STARTERS ST01 A ST04: GUIA DE PILOTAGEM",
    summary:
      "Entenda os arquétipos e mecânicas das 4 cores fundamentais: a agressão militar de Zeon, a flexibilidade da Federação, o controle tático de SEED e a tecnologia de Asticassia.",
    image: newsStartersClash,
    link: "/sets",
    actionLabel: "Explorar Coleção",
  },
  {
    id: 2,
    category: "TERMINAL QUÂNTICO VEDA",
    date: "08 Set 2026",
    title: "RELATÓRIO DO SISTEMA VEDA: METAGAME & EFICIÊNCIA DE COMBATE",
    summary:
      "O supercomputador quântico consolida telemetria tática de vitórias, cartas mais utilizadas em campeonatos e as sinergias dominantes da temporada.",
    image: newsVedaTerminal,
    link: "/stats",
    actionLabel: "Acessar Telemetria",
  },
  {
    id: 3,
    category: "ARENA DE DUELOS",
    date: "06 Set 2026",
    title: "ARENA ASTICASSIA: DUELOS ONLINE EM TEMPO REAL E MODO SOLO",
    summary:
      "Dispute partidas oficiais via matchmaking online ou teste sua linha de combate no modo de treino contra a inteligência artificial com heurística e MCTS.",
    image: newsStartersClash,
    link: "/simulador",
    actionLabel: "Entrar na Arena",
  },
  {
    id: 4,
    category: "HANGAR TÁTICO",
    date: "04 Set 2026",
    title: "HANGAR TÁTICO: CALIBRAÇÃO DE DECKS E CURVA DE RECURSOS",
    summary:
      "Aprenda a balancear Unidades, Pilotos acoplados e cartas de Comando para garantir consistência operacional e máxima eficiência em combate.",
    image: newsVedaTerminal,
    link: "/deckbuilder",
    actionLabel: "Abrir Construtor",
  },
];

export default function Home({ targetSection }: HomeProps) {
  const { isAuthenticated, user, register } = useAuth();
  const { faction } = useFaction();
  const isZeon = faction === "zeon";

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [featuredDecks, setFeaturedDecks] = useState<ApiDeck[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registering, setRegistering] = useState(false);

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

  useEffect(() => {
    api
      .listPublicDecksPage({ page: 1, pageSize: 3 }, { sort: "recent" })
      .then((res) => setFeaturedDecks(res.items))
      .catch(() => undefined);
  }, []);

  const submitQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !email.trim() || !password.trim()) return;
    setRegistering(true);
    try {
      await register({ displayName: displayName.trim(), email: email.trim(), password: password.trim() });
    } catch {
      // toast já tratado no AuthContext
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      <div className="pointer-events-none absolute inset-0 bg-grid-tech opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-20" />

      <AppTopNav />

      <main id="topo">
        {/* ── HERO SECTION: PORTAL RESUMO (CARROSSEL + LINKS RÁPIDOS) ───── */}
        <section className="relative isolate overflow-hidden border-b border-white/10 py-6 sm:py-8 lg:py-10">
          <div className="mx-auto max-w-[1760px] px-4 sm:px-6 lg:px-8">
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
                      <img
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
                            Destaque do Portal
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
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Acesso Operacional</p>
                      <h3 className="font-heading text-xl uppercase tracking-wider text-white heading-portal">Centrais do Anaheim Hub</h3>
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
                    title="Acessar o Simulador de Duelos (Arena Asticassia) — Partidas online e modo solo"
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
                      <img
                        src={isZeon ? zakuHeadOff : rx78HeadOff}
                        alt={isZeon ? "Zaku II do Char Standby" : "RX-78-2 Gundam Standby"}
                        className="absolute inset-0 size-full object-cover transition-opacity duration-300 group-hover:opacity-0"
                      />
                      {/* Estado Energizado / Olhos Acesos no Hover */}
                      <img
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
                          SIMULADOR ONLINE
                        </span>
                      </div>
                      <h4 className={cn(
                        "font-heading text-lg sm:text-xl uppercase text-white transition-colors duration-200 heading-portal truncate",
                        isZeon ? "group-hover:text-red-400" : "group-hover:text-primary"
                      )}>
                        Arena Asticassia
                      </h4>
                      <p className="text-xs text-muted-portal line-clamp-2 mt-0.5 leading-relaxed">
                        Duelos oficiais online contra outros pilotos ou treinos contra a IA heurística.
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
                    title="Acessar o Construtor de Decks (Hangar Tático) — Montagem, validação e telemetria"
                    className="group relative flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4 transition-all duration-300 hover:bg-white/[0.07] hover:border-amber-400/40 light:border-slate-300 light:bg-slate-50 light:hover:bg-slate-100"
                  >
                    {/* Ícone com Efeito Hangar On/Off no Hover */}
                    <div className="relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-950 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_24px_rgba(234,179,8,0.5)] group-hover:border-amber-400/60">
                      <img
                        src={ozHangarOff}
                        alt="Hangar Tático Standby"
                        className="absolute inset-0 size-full object-cover transition-opacity duration-300 group-hover:opacity-0"
                      />
                      <img
                        src={ozHangarOn}
                        alt="Hangar Tático Ativo"
                        className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      />
                    </div>

                    {/* Textos do Hangar Tático */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-xs border border-amber-500/40 bg-amber-500/15 text-amber-400">
                          <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                          DECKBUILDER
                        </span>
                      </div>
                      <h4 className="font-heading text-lg sm:text-xl uppercase text-white transition-colors duration-200 heading-portal truncate group-hover:text-amber-400">
                        Hangar Tático
                      </h4>
                      <p className="text-xs text-muted-portal line-clamp-2 mt-0.5 leading-relaxed">
                        Linha de montagem e calibração de decks com telemetria tática em tempo real.
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
                    title="Acessar o Terminal de Metagame (Sistema VEDA) — Estatísticas de vitórias e sinergias"
                    className="group relative flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4 transition-all duration-300 hover:bg-white/[0.07] hover:border-emerald-400/40 light:border-slate-300 light:bg-slate-50 light:hover:bg-slate-100"
                  >
                    {/* Ícone com Efeito VEDA On/Off no Hover */}
                    <div className="relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-950 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_24px_rgba(16,185,129,0.55)] group-hover:border-emerald-400/60">
                      <img
                        src={exiaVedaOff}
                        alt="Sistema VEDA Exia Standby"
                        className="absolute inset-0 size-full object-cover transition-opacity duration-300 group-hover:opacity-0"
                      />
                      <img
                        src={exiaVedaOn}
                        alt="Sistema VEDA Exia Ativo"
                        className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      />
                    </div>

                    {/* Textos do Sistema VEDA */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-xs border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          METAGAME & STATS
                        </span>
                      </div>
                      <h4 className="font-heading text-lg sm:text-xl uppercase text-white transition-colors duration-200 heading-portal truncate group-hover:text-emerald-400">
                        Sistema VEDA
                      </h4>
                      <p className="text-xs text-muted-portal line-clamp-2 mt-0.5 leading-relaxed">
                        Terminal quântico de inteligência com taxas de vitória, cores dominantes e metagame.
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
                    Telemetria Operacional
                  </span>
                  <Link href="/novidades" className="hover:text-primary transition-colors flex items-center gap-1 font-medium">
                    Ver Novidades do Portal <ArrowRight className="size-3" />
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

        {/* ── SEÇÃO DE RECRUTAMENTO / GUIA PARA NOVATOS ─────────────────── */}
        <section id="recrutamento" className="relative mx-auto max-w-[1760px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <Badge className="rounded-none border border-accent/40 bg-accent/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-accent">
                  Novos Recrutas
                </Badge>
                <h2 className="heading-portal font-heading text-4xl uppercase mt-2 md:text-5xl">
                  Portal Aberto para Jogadores Iniciantes
                </h2>
                <p className="text-soft mt-2 max-w-3xl text-sm leading-7">
                  Criamos esta plataforma especialmente para derrubar barreiras: tanto para quem nunca jogou um card game
                  de Gundam quanto para quem se sente inseguro com os termos em inglês do material internacional.
                </p>
              </div>
              <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-xs uppercase tracking-[0.14em] shrink-0">
                <Link href="/rules">Acessar manual completo <ArrowRight className="ml-1.5 size-3.5" /></Link>
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {BEGINNER_GUIDES.map((guide) => {
                const Icon = guide.icon;
                return (
                  <Card key={guide.title} className="panel-cut rounded-none surface-panel border border-white/10 p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex size-12 items-center justify-center border border-primary/40 bg-primary/10 text-primary mb-4">
                        <Icon className="size-6" />
                      </div>
                      <h3 className="font-heading text-2xl uppercase leading-snug">{guide.title}</h3>
                      <p className="text-soft mt-3 text-sm leading-6">{guide.description}</p>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Glossário Rápido de Termos em Inglês */}
            <div className="panel-cut surface-strong border border-white/10 p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-primary font-semibold mb-4">
                Glossário Tático Rápido (Inglês ⇄ Português)
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                {[
                  ["Active / Rest", "Carta em pé (pronta) ou virada (usada/cansada)"],
                  ["Unit & Pilot", "O Mobile Suit de combate e seu piloto embarcado"],
                  ["Shield Rail", "Linha de escudos que protege a sua Base contra dano"],
                  ["Burst Trigger", "Efeito ativado imediatamente quando o escudo é destruído"],
                ].map(([term, desc]) => (
                  <div key={term} className="panel-cut border border-white/10 bg-slate-950/60 p-3">
                    <p className="font-heading text-base text-accent uppercase">{term}</p>
                    <p className="text-slate-400 mt-1 leading-5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── MURAL DE NOTÍCIAS & ARTIGOS ───────────────────────────────── */}
        <section id="noticias" className="border-t border-white/10 bg-slate-950/50 py-16 sm:py-20">
          <div className="mx-auto max-w-[1760px] px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-primary">
                  Informativo
                </Badge>
                <h2 className="heading-portal font-heading text-4xl uppercase mt-2 md:text-5xl">
                  Notícias, Cards & Análises
                </h2>
                <p className="text-soft mt-2 max-w-2xl text-sm leading-7">
                  Fique por dentro das revelações de novas coleções, análises estratégicas de cartas e novidades do
                  cenário nacional.
                </p>
              </div>
              <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-xs uppercase tracking-[0.14em]">
                <Link href="/sets">Ver todas as coleções <ArrowRight className="ml-1.5 size-3.5" /></Link>
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {NEWS_ARTICLES.map((article) => (
                <Card key={article.title} className="panel-cut rounded-none surface-panel border border-white/10 flex flex-col justify-between transition-all hover:border-primary/50">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <Badge variant="outline" className="rounded-none border-primary/30 text-primary text-[0.68rem]">
                        {article.tag}
                      </Badge>
                      <span>{article.date}</span>
                    </div>
                    <h3 className="font-heading text-2xl uppercase leading-snug">{article.title}</h3>
                    <p className="text-soft text-sm leading-6">{article.summary}</p>
                    <div className="pt-2">
                      <Button asChild variant="outline" size="sm" className="rounded-none border-white/15 text-xs uppercase tracking-wider">
                        <Link href={article.link}>Ler análise</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── CENTRAL DE VÍDEOS & CRIADORES DA COMUNIDADE ───────────────── */}
        <section id="videos" className="mx-auto max-w-[1760px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <Badge className="rounded-none border border-red-500/40 bg-red-950/20 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-red-300">
                Conteúdo em Vídeo
              </Badge>
              <h2 className="heading-portal font-heading text-4xl uppercase mt-2 md:text-5xl">
                Criadores & Comunidade
              </h2>
              <p className="text-soft mt-2 max-w-2xl text-sm leading-7">
                Assista a tutoriais em vídeo, gameplays comentados e unboxings feitos pela comunidade brasileira de
                Gundam Card Game.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Video className="size-4 text-red-400" />
              <span>Vídeos recomendados</span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {COMMUNITY_VIDEOS.map((vid) => (
              <Card key={vid.title} className="panel-cut rounded-none surface-panel border border-white/10 overflow-hidden flex flex-col justify-between">
                <div className="relative aspect-video bg-slate-950/90 border-b border-white/10 flex items-center justify-center group">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
                  <div className="relative z-10 size-14 rounded-full border border-red-500/60 bg-red-600/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="size-6 text-white ml-0.5" />
                  </div>
                  <span className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 font-mono text-[0.68rem] text-slate-300 border border-white/10">
                    {vid.duration}
                  </span>
                  <span className="absolute top-2 left-2 bg-red-950/80 px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-red-300 border border-red-500/40">
                    {vid.type}
                  </span>
                </div>
                <CardContent className="p-5 space-y-3">
                  <p className="text-[0.7rem] uppercase tracking-[0.2em] text-slate-400">{vid.channel}</p>
                  <h3 className="font-heading text-xl uppercase leading-snug">{vid.title}</h3>
                  <div className="pt-2">
                    <a
                      href={vid.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs uppercase tracking-wider text-primary hover:underline"
                    >
                      Assistir no YouTube <ExternalLink className="ml-1 size-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── VITRINE DE DECKS EM DESTAQUE ──────────────────────────────── */}
        <section id="decks" className="border-t border-white/10 bg-slate-950/40 py-16 sm:py-20">
          <div className="mx-auto max-w-[1760px] px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <Badge className="rounded-none border border-primary/40 bg-primary/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-primary">
                  Arsenal Aberto da OZ
                </Badge>
                <h2 className="heading-portal font-heading text-4xl uppercase mt-2 md:text-5xl">
                  Projetos de Decks da Comunidade
                </h2>
                <p className="text-soft mt-2 max-w-2xl text-sm leading-7">
                  Veja o que outros comandantes estão pilotando. Abra qualquer lista para ver curva de custo, contagem de
                  Mobile Suits e exportar o código oficial.
                </p>
              </div>
              <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-xs uppercase tracking-[0.14em]">
                <Link href="/decks">Explorar todos os decks <ArrowRight className="ml-1.5 size-3.5" /></Link>
              </Button>
            </div>

            {featuredDecks.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-3">
                {featuredDecks.map((deck) => (
                  <DeckPreviewCard key={deck.id} deck={deck} />
                ))}
              </div>
            ) : (
              <div className="panel-cut surface-panel p-8 text-center text-sm text-slate-400">
                <p>Nenhum deck público no momento. Crie sua conta e seja o primeiro a publicar!</p>
              </div>
            )}
          </div>
        </section>

        {/* ── ARENA DE PARTIDAS & SIMULADOR ─────────────────────────────── */}
        <section id="arena" className="mx-auto max-w-[1760px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="panel-cut hero-surface border border-primary/40 p-8 lg:p-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 pointer-events-none" />
            <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div className="space-y-4">
                <Badge className="rounded-none border border-primary/50 bg-primary/20 px-3 py-1 text-[0.7rem] uppercase tracking-[0.24em] text-primary font-semibold">
                  Arena de Combate Asticassia
                </Badge>
                <h2 className="heading-portal font-heading text-4xl uppercase md:text-5xl leading-none">
                  Entre na Cabine: Dispute Partidas Online ou Solo
                </h2>
                <p className="text-soft text-base leading-7 max-w-2xl">
                  Nosso simulador reproduz fielmente as regras oficiais do Mobile Suit Arena: zonas de combate,
                  destruição de escudos com efeitos Burst, docking de pilotos e contadores de dano. Jogue contra amigos
                  com link direto ou pratique contra a IA tática.
                </p>
                <div className="flex flex-wrap gap-4 pt-2">
                  <Button asChild size="lg" className="rounded-none bg-primary text-xs uppercase tracking-[0.16em] text-primary-foreground hover:bg-primary/90">
                    <Link href="/simulador">
                      <Swords className="mr-2 size-4" />
                      Entrar na Central de Partidas
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="rounded-none border-white/20 bg-white/5 text-xs uppercase tracking-[0.16em] text-white hover:bg-white/10 light:border-slate-400/90 light:bg-white light:text-slate-950">
                    <Link href="/simulador/treino">
                      <Bot className="mr-2 size-4" />
                      Treino Solo contra Bot
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-3">
                {[
                  ["Partida Online Pareada", "Encontre adversários de todo o Brasil na fila de espera rápida."],
                  ["Desafio com Link Privado", "Gere um código de sala e convide amigos para amistosos."],
                  ["Treino com IA Heurística", "Níveis Fácil, Normal e Difícil para refinar suas estratégias."],
                ].map(([title, desc]) => (
                  <div key={title} className="panel-cut surface-strong border border-white/10 p-4">
                    <p className="font-heading text-lg uppercase text-white flex items-center gap-2">
                      <Zap className="size-4 text-accent" />
                      {title}
                    </p>
                    <p className="text-slate-400 text-xs mt-1 leading-5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CADASTRO RÁPIDO & ALISTAMENTO ─────────────────────────────── */}
        {!isAuthenticated ? (
          <section id="cadastro" className="border-t border-white/10 bg-slate-950/60 py-16 sm:py-20">
            <div className="mx-auto max-w-[1760px] px-4 sm:px-6 lg:px-8">
              <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr] items-center">
                <div className="space-y-5">
                  <Badge className="rounded-none border border-accent/40 bg-accent/10 px-3 py-1 text-[0.7rem] uppercase tracking-[0.24em] text-accent font-semibold">
                    Alistamento
                  </Badge>
                  <h2 className="heading-portal font-heading text-4xl uppercase md:text-5xl leading-none">
                    Crie sua conta de piloto gratuitamente.
                  </h2>
                  <p className="text-soft text-sm leading-7 max-w-xl">
                    Salve listas ilimitadas de decks, compartilhe links públicos com amigos, organize suas cartas na
                    pasta de coleção e registre suas partidas na arena.
                  </p>

                  <form onSubmit={submitQuickRegister} className="grid gap-3 sm:grid-cols-3 max-w-2xl pt-2">
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Nome de Piloto"
                      className="field-shell sm:col-span-3"
                      required
                    />
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Seu melhor email"
                      className="field-shell sm:col-span-2"
                      type="email"
                      required
                    />
                    <Input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Senha de acesso"
                      className="field-shell"
                      type="password"
                      required
                    />
                    <div className="sm:col-span-3 pt-2">
                      <Button
                        type="submit"
                        className="rounded-none bg-accent text-xs uppercase tracking-[0.16em] text-accent-foreground hover:bg-accent/90"
                        disabled={registering}
                      >
                        {registering ? "Cadastrando..." : "Criar conta agora"}
                      </Button>
                    </div>
                  </form>
                </div>

                <div className="grid gap-4">
                  {[
                    ["Perfil Personalizado", "Escolha facção visual (Hangar ou Zeon), avatar e bio de comandante."],
                    ["Deckbuilder em Nuvem", "Acesse seus decks pelo computador, tablet ou celular."],
                    ["Exportação MSA", "Gere listas oficiais formatadas para torneios nacionais e regionais."],
                  ].map(([title, desc]) => (
                    <div key={title} className="panel-cut surface-panel border border-white/10 p-5 flex items-start gap-3">
                      <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="font-heading text-lg uppercase text-white">{title}</p>
                        <p className="text-soft text-xs mt-1 leading-5">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      {/* ── FOOTER INSTITUCIONAL ──────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-slate-950/80 py-10 text-xs text-slate-400">
        <div className="mx-auto max-w-[1760px] px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <p className="font-heading text-2xl uppercase tracking-wider text-white">Anaheim Hub</p>
            <p className="mt-1 text-slate-400">
              Laboratório Tático e Engenharia de Combate para o Gundam Card Game. Cartas, artes e marcas registradas pertencem à Bandai Co., Ltd. e Sunrise/Sotsu.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-5 uppercase tracking-widest text-[0.7rem] text-slate-400">
            <Link href="/database" className="hover:text-primary transition-colors">Cartas</Link>
            <Link href="/decks" className="hover:text-primary transition-colors">Decks</Link>
            <Link href="/rules" className="hover:text-primary transition-colors">Regras pt-BR</Link>
            <Link href="/stats" className="hover:text-primary transition-colors">Estatísticas</Link>
            <Link href="/novidades" className="hover:text-primary transition-colors">Novidades</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
