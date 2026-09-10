import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BookOpen,
  Box,
  ExternalLink,
  Layers,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

import haroRulesOff from "@/assets/home/haro_rules_off.jpg";
import haroRulesOn from "@/assets/home/haro_rules_on.jpg";

// Subsequentes aos 4 primeiros da Hero (Artigos #5 a #8)
const SUBSEQUENT_ARTICLES = [
  {
    id: 5,
    tag: "Rulings Oficiais",
    date: "02 Set 2026",
    title: "Resolução de Burst e Gatilhos de Escudo",
    summary:
      "Como funcionam as prioridades quando múltiplas cartas de escudo sofrem dano simultâneo e a ordem de ativação das cartas de Comando.",
    link: "/rules",
  },
  {
    id: 6,
    tag: "Guia Tático",
    date: "31 Ago 2026",
    title: "Sinergia de Traits: Earth Alliance vs Zeon",
    summary:
      "Estudo detalhado das tags militares, acoplamento de pilotos correspondentes e ganhos de poder de combate por fidelidade temática.",
    link: "/sets",
  },
  {
    id: 7,
    tag: "Deckbuilding",
    date: "28 Ago 2026",
    title: "Curva de Recursos e Gestão de Energia",
    summary:
      "A proporção ideal entre Unidades pesadas, pilotos de suporte e cartas de comando para manter ritmo contínuo desde o turno 1.",
    link: "/deckbuilder",
  },
  {
    id: 8,
    tag: "Metagame & Stats",
    date: "25 Ago 2026",
    title: "Relatório de Eficiência: ST01 vs ST02",
    summary:
      "Dados consolidados pelo Sistema VEDA demonstrando o confronto entre a agressividade de Zeon e a estabilidade da Federação.",
    link: "/stats",
  },
];

// Links Oficiais (Inspirado na referência oficial)
const OFFICIAL_LINKS = [
  {
    tag: "RULES",
    tagColor: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
    title: "Official Rules & Rulings",
    description: "Core rules, turn structure, combat phases, and official Bandai rulings.",
    link: "/rules",
    isExternal: false,
  },
  {
    tag: "DECKBUILDING",
    tagColor: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    title: "Deckbuilding Regulations",
    description: "Official deck construction rules, color restrictions, and 50-card regulations.",
    link: "/deckbuilder",
    isExternal: false,
  },
  {
    tag: "LEARN",
    tagColor: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    title: "How to Play Guide",
    description: "Beginner-friendly learn, unit classification, pilot link, and quickstart guides.",
    link: "/rules",
    isExternal: false,
  },
  {
    tag: "BANDAI TCG",
    tagColor: "border-red-500/40 bg-red-500/10 text-red-400",
    title: "Bandai Official Global Portal",
    description: "Official Gundam Card Game site, erratas, worldwide tournament circuit, and news.",
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
      <div className="mx-auto max-w-[1760px] px-4 sm:px-6 lg:px-8">
        {/* Layout Bipartido: Lado Direito Maior (lg:grid-cols-[1fr_1.35fr]) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.35fr] xl:grid-cols-[1fr_1.4fr] gap-6 lg:gap-8 items-stretch">
          
          {/* ── LADO ESQUERDO: INSTITUCIONAL + MÉTRICAS ANIMADAS + CARD RULINGS ── */}
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-950/80 p-6 sm:p-7 lg:p-8 shadow-2xl backdrop-blur-xl light:border-slate-300 light:bg-white light:shadow-md">
            {/* Cabeçalho Institucional */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="rounded-xs border border-primary/50 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  Anaheim HUB · Comunidade Operacional
                </span>
              </div>

              <h3 className="font-heading text-2xl sm:text-3xl uppercase text-white leading-tight heading-portal">
                Aviso aos Pilotos
              </h3>

              {/* Texto Institucional Solicitado */}
              <p className="text-sm sm:text-base leading-relaxed text-slate-300 light:text-slate-700">
                A <strong className="text-white light:text-slate-900 font-semibold">Anaheim HUB</strong> expressa
                sua gratidão pelos seus pilotos registrados. Para o caso de não saber como manusear o deck, ou tirar
                dúvidas sobre o sistema, acesse nossa área de regras.
              </p>
            </div>

            {/* Grid com os 4 Contadores de Telemetria (CountUp animado de 0 ao total) */}
            <div className="my-6 grid grid-cols-2 gap-3 sm:gap-4">
              {/* 1. Pilotos Registrados */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-cyan-400/40 light:border-slate-200 light:bg-slate-50">
                <div className="flex items-center gap-2 text-cyan-400 mb-1">
                  <Users className="size-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Pilotos</span>
                </div>
                <div className="font-heading text-2xl sm:text-3xl text-white heading-portal">
                  <AnimatedCounter value={metrics.userCount} trigger={inView} />
                </div>
                <p className="text-[11px] text-muted-portal mt-0.5">Cadastrados no sistema</p>
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
                <p className="text-[11px] text-muted-portal mt-0.5">No acervo oficial</p>
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
                <p className="text-[11px] text-muted-portal mt-0.5">Construídos no Hangar</p>
              </div>

              {/* 4. Produtos Cadastrados */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-emerald-400/40 light:border-slate-200 light:bg-slate-50">
                <div className="flex items-center gap-2 text-emerald-400 mb-1">
                  <Box className="size-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Produtos</span>
                </div>
                <div className="font-heading text-2xl sm:text-3xl text-white heading-portal">
                  <AnimatedCounter value={metrics.productCount} trigger={inView} />
                </div>
                <p className="text-[11px] text-muted-portal mt-0.5">Coleções e starters</p>
              </div>
            </div>

            {/* Card Tático para Rulings (No mesmo estilo dos ícones da Hero com Haro Árbitro) */}
            <Link
              href="/rules"
              title="Acessar o Compêndio Oficial de Regras, Rulings e Arbitragem"
              className="group relative flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4 transition-all duration-300 hover:bg-white/[0.07] hover:border-emerald-400/50 light:border-slate-300 light:bg-slate-50 light:hover:bg-slate-100"
            >
              {/* Ícone com Efeito Haro On/Off no Hover */}
              <div className="relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-slate-950 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_24px_rgba(132,204,22,0.55)] group-hover:border-lime-400/60">
                {/* Standby: Haro Clássico em Modo Bola Fechado */}
                <img
                  src={haroRulesOff}
                  alt="Haro Clássico em Modo Bola Fechado"
                  className="absolute inset-0 size-full object-cover transition-opacity duration-300 group-hover:opacity-0"
                />
                {/* Energizado no Hover: Haro Aberto com Orelhas e Olhos Acesos */}
                <img
                  src={haroRulesOn}
                  alt="Haro Clássico Aberto com Orelhas e Olhos Acesos"
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
                  Diretrizes & Rulings
                </h4>
                <p className="text-xs text-muted-portal line-clamp-2 mt-0.5 leading-relaxed">
                  Consulte regras oficiais, timing de ações, precedência de efeitos e resoluções homologadas com o Haro!
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
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">Referência Oficial</p>
                    <h3 className="font-heading text-xl uppercase tracking-wider text-white heading-portal">Official Links</h3>
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
                            {item.tag}
                          </span>
                          {item.isExternal ? (
                            <ExternalLink className="size-3.5 text-slate-500 transition-transform duration-300 group-hover:scale-110 group-hover:text-cyan-400" />
                          ) : (
                            <ArrowRight className="size-3.5 text-slate-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-cyan-400" />
                          )}
                        </div>
                        <h4 className="font-heading text-base uppercase text-white transition-colors duration-200 heading-portal group-hover:text-cyan-300">
                          {item.title}
                        </h4>
                        <p className="text-xs text-muted-portal mt-1 leading-relaxed line-clamp-2">
                          {item.description}
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
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Arquivo de Notícias</p>
                    <h3 className="font-heading text-xl uppercase tracking-wider text-white heading-portal">Artigos & Análises Táticas</h3>
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
                          {article.tag}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">{article.date}</span>
                      </div>
                      <h4 className="font-heading text-sm uppercase text-white transition-colors duration-200 heading-portal line-clamp-1 group-hover:text-primary">
                        {article.title}
                      </h4>
                      <p className="text-xs text-muted-portal mt-1.5 leading-relaxed line-clamp-2">
                        {article.summary}
                      </p>
                    </div>

                    <div className="pt-3 mt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-semibold text-primary/80 group-hover:text-primary">
                      <span>Ler Matéria</span>
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
