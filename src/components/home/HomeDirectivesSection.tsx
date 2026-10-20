import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BookOpen,
  Box,
  ExternalLink,
  Layers,
  ShieldCheck,
  Swords,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

import haroRulesOff from "@/assets/home/haro_rules_off.webp";
import haroRulesOn from "@/assets/home/haro_rules_on.webp";
import { useSiteLanguage } from "@/i18n/siteLanguage";

// Subsequentes aos 4 primeiros da Hero (Artigos #5 a #8)
const SUBSEQUENT_ARTICLES = [
  {
    id: 5,
    tag: { pt: "Rulings Oficiais", en: "Official Rulings" },
    date: { pt: "02 Set 2026", en: "Sep 02, 2026" },
    title: { pt: "Resolução de Burst e Gatilhos de Escudo", en: "Resolving Burst and Shield Triggers" },
    summary:
      { pt: "Como funcionam as prioridades quando múltiplas cartas de escudo sofrem dano simultâneo e a ordem de ativação das cartas de Comando.", en: "How priorities work when several shield cards take damage at the same time, and the activation order of Command cards." },
    link: "/rules",
  },
  {
    id: 6,
    tag: { pt: "Guia", en: "Guide" },
    date: { pt: "31 Ago 2026", en: "Aug 31, 2026" },
    title: { pt: "Sinergia de Traits: Earth Alliance vs Zeon", en: "Trait Synergy: Earth Alliance vs Zeon" },
    summary:
      { pt: "Estudo detalhado das tags militares, acoplamento de pilotos correspondentes e ganhos de poder de combate por fidelidade temática.", en: "A detailed look at military traits, pairing matching pilots and the combat bonuses of staying on theme." },
    link: "/sets",
  },
  {
    id: 7,
    tag: { pt: "Deckbuilding", en: "Deckbuilding" },
    date: { pt: "28 Ago 2026", en: "Aug 28, 2026" },
    title: { pt: "Curva de Recursos e Gestão de Energia", en: "Resource Curve and Energy Management" },
    summary:
      { pt: "A proporção ideal entre Unidades pesadas, pilotos de suporte e cartas de comando para manter ritmo contínuo desde o turno 1.", en: "The ideal mix of heavy Units, support pilots and command cards to keep a steady pace from turn 1." },
    link: "/deckbuilder",
  },
  {
    id: 8,
    tag: { pt: "Metagame & Stats", en: "Metagame & Stats" },
    date: { pt: "25 Ago 2026", en: "Aug 25, 2026" },
    title: { pt: "Relatório de Eficiência: ST01 vs ST02", en: "Efficiency Report: ST01 vs ST02" },
    summary:
      { pt: "Dados dos torneios registrados mostrando o confronto entre a agressividade de Zeon e a estabilidade da Federação.", en: "Recorded tournament data on the clash between Zeon's aggression and the Federation's stability." },
    link: "/stats",
  },
];

// Links Oficiais (Referência Bandai e Compêndio)
const OFFICIAL_LINKS = [
  {
    tag: { pt: "REGRAS", en: "RULES" },
    tagColor: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
    title: { pt: "Regras & Rulings Oficiais", en: "Official Rules & Rulings" },
    description: { pt: "Manual oficial, estrutura de fases, combate e decisões oficiais de arbitragem.", en: "Official manual, phase structure, combat and official judge rulings." },
    link: "/rules",
    isExternal: false,
  },
  {
    tag: { pt: "CONSTRUÇÃO", en: "BUILDING" },
    tagColor: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    title: { pt: "Regulamento de Decks & Torneios", en: "Deck & Tournament Regulations" },
    description: { pt: "Formatos válidos, restrições de cores, regras de 50 cartas e cartas banidas.", en: "Legal formats, color limits, the 50-card rule and banned cards." },
    link: "/deckbuilder",
    isExternal: false,
  },
  {
    tag: { pt: "APRENDA", en: "LEARN" },
    tagColor: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    title: { pt: "Guia Como Jogar", en: "How to Play Guide" },
    description: { pt: "Passo a passo para quem está começando: fluxo do turno, Link e conceitos básicos.", en: "Step by step for beginners: turn flow, Link and the basics." },
    link: "/rules",
    isExternal: false,
  },
  {
    tag: { pt: "OFICIAL", en: "OFFICIAL" },
    tagColor: "border-red-500/40 bg-red-500/10 text-red-400",
    title: { pt: "Portal Global Bandai", en: "Bandai Global Portal" },
    description: { pt: "Site mundial oficial do Gundam Card Game com novidades, erratas e torneios.", en: "The official worldwide Gundam Card Game site with news, errata and tournaments." },
    link: "https://www.gundam-gcg.com/",
    isExternal: true,
  },
];

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  trigger: boolean;
}

function AnimatedCounter({ value, duration = 1400, trigger }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!trigger || value <= 0) return;

    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out expo curve
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.floor(easeOut * value);

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration, trigger]);

  return <span>{displayValue.toLocaleString("pt-BR")}</span>;
}

export function HomeDirectivesSection() {
  const { tr } = useSiteLanguage();
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [metrics, setMetrics] = useState({
    userCount: 0,
    cardCount: 0,
    deckCount: 0,
    productCount: 0,
  });

  // Carrega métricas reais do backend (usuários, cartas, decks, produtos)
  useEffect(() => {
    Promise.all([api.health().catch(() => null), api.listSets().catch(() => [])]).then(
      ([healthRes, setsRes]) => {
        const setsCount = Array.isArray(setsRes) ? setsRes.length : 0;
        setMetrics({
          userCount: healthRes?.userCount ?? 0,
          cardCount: healthRes?.cardCount ?? 0,
          deckCount: healthRes?.deckCount ?? 0,
          productCount: healthRes?.productCount ?? setsCount,
        });
      }
    );
  }, []);

  // Dispara o CountUp quando o usuário rolar até esta seção
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-hidden border-b border-white/10 py-10 sm:py-12 lg:py-16"
    >
      <div className="container-ultrawide">
        {/* Layout Bipartido: Lado Direito Maior (lg:grid-cols-[1fr_1.35fr]) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.35fr] xl:grid-cols-[1fr_1.4fr] gap-6 lg:gap-8 items-stretch">
          
          {/* ── LADO ESQUERDO: INSTITUCIONAL + MÉTRICAS ANIMADAS + CARD RULINGS ── */}
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-950/80 p-6 sm:p-7 lg:p-8 shadow-2xl backdrop-blur-xl light:border-slate-300 light:bg-white light:shadow-md">
            {/* Cabeçalho Institucional */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="rounded-xs border border-primary/50 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  {tr("AnaheimHub · Comunidade", "AnaheimHub · Community")}
                </span>
              </div>

              <h3 className="font-heading text-2xl sm:text-3xl uppercase text-white leading-tight heading-portal">
                {tr("Obrigado por jogar com a gente", "Thanks for playing with us")}
              </h3>

              {/* Texto Institucional Solicitado */}
              <p className="text-sm sm:text-base leading-relaxed text-slate-300 light:text-slate-700">
                {tr(
                  "A Anaheim HUB agradece a todos os jogadores cadastrados. Se tiver dúvida sobre como jogar ou sobre alguma regra, veja a área de regras.",
                  "Anaheim HUB thanks every registered player. If you have questions about how to play or about a rule, check the rules section.",
                )}
              </p>
            </div>

            {/* Grid com os 4 Contadores de Telemetria (CountUp animado de 0 ao total) */}
            <div className="my-6 grid grid-cols-2 gap-3 sm:gap-4">
              {/* 1. Pilotos Registrados */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-cyan-400/40 light:border-slate-200 light:bg-slate-50">
                <div className="flex items-center gap-2 text-cyan-400 mb-1">
                  <Users className="size-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{tr("Jogadores", "Players")}</span>
                </div>
                <div className="font-heading text-2xl sm:text-3xl text-white heading-portal">
                  <AnimatedCounter value={metrics.userCount} trigger={inView} />
                </div>
                <p className="text-[11px] text-muted-portal mt-0.5">{tr("Cadastrados no sistema", "Registered")}</p>
              </div>

              {/* 2. Cards Cadastrados */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-primary/40 light:border-slate-200 light:bg-slate-50">
                <div className="flex items-center gap-2 text-primary mb-1">
                  <Layers className="size-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Cards</span>
                </div>
                <div className="font-heading text-2xl sm:text-3xl text-white heading-portal">
                  <AnimatedCounter value={metrics.cardCount} trigger={inView} />
                </div>
                <p className="text-[11px] text-muted-portal mt-0.5">{tr("No acervo oficial", "In the official catalog")}</p>
              </div>

              {/* 3. Decks Registrados */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-amber-400/40 light:border-slate-200 light:bg-slate-50">
                <div className="flex items-center gap-2 text-amber-400 mb-1">
                  <Swords className="size-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Decks</span>
                </div>
                <div className="font-heading text-2xl sm:text-3xl text-white heading-portal">
                  <AnimatedCounter value={metrics.deckCount} trigger={inView} />
                </div>
                <p className="text-[11px] text-muted-portal mt-0.5">{tr("Montados no site", "Built on the site")}</p>
              </div>

              {/* 4. Produtos Cadastrados */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-emerald-400/40 light:border-slate-200 light:bg-slate-50">
                <div className="flex items-center gap-2 text-emerald-400 mb-1">
                  <Box className="size-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{tr("Produtos", "Products")}</span>
                </div>
                <div className="font-heading text-2xl sm:text-3xl text-white heading-portal">
                  <AnimatedCounter value={metrics.productCount} trigger={inView} />
                </div>
                <p className="text-[11px] text-muted-portal mt-0.5">{tr("Coleções e starters", "Sets and starters")}</p>
              </div>
            </div>

            {/* Card Tático para Rulings (No mesmo estilo dos ícones da Hero com Haro Árbitro) */}
            <Link
              href="/rules"
              title={tr("Acessar o Compêndio Oficial de Regras, Rulings e Arbitragem", "Open the official rules, rulings and judging compendium")}
              className="group relative flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4 transition-all duration-300 hover:bg-white/[0.07] hover:border-emerald-400/50 light:border-slate-300 light:bg-slate-50 light:hover:bg-slate-100"
            >
              {/* Ícone com Efeito Haro On/Off no Hover */}
              <div className="relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-950 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_24px_rgba(132,204,22,0.55)] group-hover:border-lime-400/60">
                {/* Standby: Haro Clássico em Modo Bola Fechado */}
                <img loading="lazy" decoding="async"
                  src={haroRulesOff}
                  alt={tr("Haro Clássico em Modo Bola Fechado", "Classic Haro, closed ball mode")}
                  className="absolute inset-0 size-full object-cover transition-opacity duration-300 group-hover:opacity-0"
                />
                {/* Energizado no Hover: Haro Aberto com Orelhas e Olhos Acesos */}
                <img loading="lazy" decoding="async"
                  src={haroRulesOn}
                  alt={tr("Haro Clássico Aberto com Orelhas e Olhos Acesos", "Classic Haro open with ears and glowing eyes")}
                  className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
              </div>

              {/* Textos do Card de Rulings */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-xs border border-lime-500/40 bg-lime-500/15 text-lime-400">
                    <span className="size-1.5 rounded-full bg-lime-400 animate-pulse" />
                    MANUAL & REGRAS
                  </span>
                </div>
                <h4 className="font-heading text-lg sm:text-xl uppercase text-white transition-colors duration-200 heading-portal truncate group-hover:text-lime-400">
                  {tr("Diretrizes & Rulings", "Guidelines & Rulings")}
                </h4>
                <p className="text-xs text-muted-portal line-clamp-2 mt-0.5 leading-relaxed">
                  {tr("Consulte regras oficiais, timing de ações, precedência de efeitos e resoluções homologadas com o Haro!", "Check official rules, action timing, effect precedence and approved rulings with Haro!")}
                </p>
              </div>

              {/* Seta Indicativa */}
              <div className="shrink-0 text-slate-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white light:group-hover:text-slate-900">
                <ArrowRight className="size-5" />
              </div>
            </Link>
          </div>

          {/* ── LADO DIREITO (MAIS LARGO): LINKS OFICIAIS + ARTIGOS #5 A #8 ──── */}
          <div className="flex flex-col gap-6 justify-between">
            
            {/* Bloco 1: Official Links (Estilo idêntico à imagem de referência) */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 sm:p-6 shadow-2xl backdrop-blur-xl light:border-slate-300 light:bg-white light:shadow-md">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 light:border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-500/10 text-cyan-400">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">{tr("Referência Oficial", "Official Reference")}</p>
                    <h3 className="font-heading text-xl uppercase tracking-wider text-white heading-portal">{tr("Links Oficiais", "Official Links")}</h3>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                  Bandai GCG
                </span>
              </div>

              {/* Lista dos Cards de Links Oficiais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {OFFICIAL_LINKS.map((item, idx) => {
                  const content = (
                    <div
                      key={idx}
                      className="group relative flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-all duration-300 hover:bg-white/[0.06] hover:border-cyan-400/40 light:border-slate-200 light:bg-slate-50 light:hover:bg-slate-100"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={cn("px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-xs border", item.tagColor)}>
                            {tr(item.tag)}
                          </span>
                          {item.isExternal ? (
                            <ExternalLink className="size-3.5 text-slate-500 transition-transform duration-300 group-hover:scale-110 group-hover:text-cyan-400" />
                          ) : (
                            <ArrowRight className="size-3.5 text-slate-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-cyan-400" />
                          )}
                        </div>
                        <h4 className="font-heading text-base uppercase text-white transition-colors duration-200 heading-portal group-hover:text-cyan-300">
                          {tr(item.title)}
                        </h4>
                        <p className="text-xs text-muted-portal mt-1 leading-relaxed line-clamp-2">
                          {tr(item.description)}
                        </p>
                      </div>
                    </div>
                  );

                  return item.isExternal ? (
                    <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className="block">
                      {content}
                    </a>
                  ) : (
                    <Link key={idx} href={item.link} className="block">
                      {content}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Bloco 2: Artigos Recentes Subsequentes (#5 a #8, excluindo os 4 do Hero) */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 sm:p-6 shadow-2xl backdrop-blur-xl light:border-slate-300 light:bg-white light:shadow-md flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 light:border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
                    <BookOpen className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">{tr("Notícias", "News")}</p>
                    <h3 className="font-heading text-xl uppercase tracking-wider text-white heading-portal">{tr("Artigos & Análises Táticas", "Articles & Tactical Analysis")}</h3>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[10px] text-slate-400 font-mono">
                  Matérias #05 a #08
                </span>
              </div>

              {/* Grid 2x2 com os 4 Artigos Subsequentes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1">
                {SUBSEQUENT_ARTICLES.map((article) => (
                  <Link
                    key={article.id}
                    href={article.link}
                    className="group relative flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-all duration-300 hover:bg-white/[0.06] hover:border-primary/40 light:border-slate-200 light:bg-slate-50 light:hover:bg-slate-100"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          {tr(article.tag)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">{tr(article.date)}</span>
                      </div>
                      <h4 className="font-heading text-sm uppercase text-white transition-colors duration-200 heading-portal line-clamp-1 group-hover:text-primary">
                        {tr(article.title)}
                      </h4>
                      <p className="text-xs text-muted-portal mt-1.5 leading-relaxed line-clamp-2">
                        {tr(article.summary)}
                      </p>
                    </div>

                    <div className="pt-3 mt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-semibold text-primary/80 group-hover:text-primary">
                      <span>{tr("Ler Matéria", "Read Article")}</span>
                      <ArrowRight className="size-3 transition-transform duration-200 group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}
