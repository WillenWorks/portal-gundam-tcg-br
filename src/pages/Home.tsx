import { useEffect } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowRight,
  Radio,
} from "lucide-react";

import { AdSlot } from "@/components/ads/AdSlot";
import { AppTopNav } from "@/components/layout/AppTopNav";
import { AppFooter } from "@/components/layout/shared/AppFooter";
import { LatestCardsCarousel } from "@/components/home/LatestCardsCarousel";
import { HomeArticlesCarousel } from "@/components/home/HomeArticlesCarousel";
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
import { useSiteLanguage } from "@/i18n/siteLanguage";

import rx78HeadOff from "@/assets/home/rx78_head_off.webp";
import rx78HeadOn from "@/assets/home/rx78_head_on.webp";
import zakuHeadOff from "@/assets/home/zaku_head_off.webp";
import zakuHeadOn from "@/assets/home/zaku_head_on.webp";
import ozHangarOff from "@/assets/home/oz_hangar_off.webp";
import ozHangarOn from "@/assets/home/oz_hangar_on.webp";
import exiaVedaOff from "@/assets/home/exia_veda_off.webp";
import exiaVedaOn from "@/assets/home/exia_veda_on.webp";

interface HomeProps {
  targetSection?: string;
}

export default function Home({ targetSection }: HomeProps) {
  const { faction } = useFaction();
  const isZeon = faction === "zeon";
  const { tr } = useSiteLanguage();

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
        <h1 className="sr-only">{tr("AnaheimHub: cartas, decks, torneios, estatísticas e simulador de Gundam Card Game no Brasil", "AnaheimHub: Gundam Card Game cards, decks, tournaments, stats and simulator")}</h1>
        {/* ── HERO SECTION: PORTAL RESUMO (CARROSSEL + LINKS RÁPIDOS) ───── */}
        <section className="relative isolate overflow-hidden border-b border-white/10 py-6 sm:py-8 lg:py-10">
          <div className="container-ultrawide">
            <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] min-[1800px]:grid-cols-[1.45fr_0.95fr] gap-6 lg:gap-8 items-stretch">
              {/* LADO ESQUERDO: ARTIGOS PUBLICADOS EM DESTAQUE */}
              <HomeArticlesCarousel />

              {/* LADO DIREITO: PAINEL DE ACESSO OPERACIONAL (SIMULADOR, DECKBUILDER, VEDA) */}
              <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-950/85 p-5 sm:p-6 shadow-2xl backdrop-blur-xl light:border-slate-300 light:bg-white light:shadow-md">
                {/* Cabeçalho do Painel */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 light:border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
                      <Activity className="size-4 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">{tr("Comece por aqui", "Start here")}</p>
                      <h3 className="font-heading text-xl uppercase tracking-wider text-white heading-portal">{tr("O que dá para fazer", "What you can do")}</h3>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Online
                  </span>
                </div>

                {/* Lista dos 3 Links Rápidos com Ícones Animados */}
                <div className="flex flex-1 flex-col gap-3">
                  {/* Linha 1: Simulador (Arena Asticassia) */}
                  <Link
                    href="/simulador"
                    title={tr("Abrir o simulador — partidas online e treino contra o bot", "Open the simulator — online matches and practice against the bot")}
                    className={cn(
                      "group relative flex flex-1 items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4 transition-all duration-300 hover:bg-white/[0.07] hover:border-white/20 light:border-slate-300 light:bg-slate-50 light:hover:bg-slate-100",
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
                          {tr("SIMULADOR ONLINE · LOGIN OPCIONAL", "ONLINE SIMULATOR · SIGN-IN OPTIONAL")}
                        </span>
                      </div>
                      <h4 className={cn(
                        "font-heading text-lg sm:text-xl uppercase text-white transition-colors duration-200 heading-portal line-clamp-2",
                        isZeon ? "group-hover:text-red-400" : "group-hover:text-primary"
                      )}>
                        {tr("Simulador", "Simulator")}
                      </h4>
                      <p className="text-xs text-muted-portal line-clamp-2 mt-0.5 leading-relaxed">
                        {tr("Jogue online contra outras pessoas ou treine contra o bot.", "Play online against other people or practice against the bot.")}
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
                    title={tr("Abrir o deckbuilder — montar e validar decks", "Open the deckbuilder — build and validate decks")}
                    className="group relative flex flex-1 items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4 transition-all duration-300 hover:bg-white/[0.07] hover:border-amber-400/40 light:border-slate-300 light:bg-slate-50 light:hover:bg-slate-100"
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
                          {tr("DECKBUILDER · ACESSO PÚBLICO LIVRE", "DECKBUILDER · FREE PUBLIC ACCESS")}
                        </span>
                      </div>
                      <h4 className="font-heading text-lg sm:text-xl uppercase text-white transition-colors duration-200 heading-portal line-clamp-2 group-hover:text-amber-400">
                        Deckbuilder
                      </h4>
                      <p className="text-xs text-muted-portal line-clamp-2 mt-0.5 leading-relaxed">
                        {tr("Monte, valide e compartilhe decks, com estatísticas do deck enquanto você monta.", "Build, validate and share decks, with deck stats while you build.")}
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
                    title={tr("Abrir as estatísticas — taxas de vitória e meta", "Open the stats — win rates and meta")}
                    className="group relative flex flex-1 items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4 transition-all duration-300 hover:bg-white/[0.07] hover:border-emerald-400/40 light:border-slate-300 light:bg-slate-50 light:hover:bg-slate-100"
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
                          {tr("METAGAME & STATS · ACESSO PÚBLICO LIVRE", "METAGAME & STATS · FREE PUBLIC ACCESS")}
                        </span>
                      </div>
                      <h4 className="font-heading text-lg sm:text-xl uppercase text-white transition-colors duration-200 heading-portal line-clamp-2 group-hover:text-emerald-400">
                        {tr("Estatísticas", "Stats")}
                      </h4>
                      <p className="text-xs text-muted-portal line-clamp-2 mt-0.5 leading-relaxed">
                        {tr("Taxas de vitória, cores mais jogadas e o meta de cada temporada.", "Win rates, most played colors and each season's meta.")}
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
                    {tr("Atualizado com os torneios registrados", "Updated with recorded tournaments")}
                  </span>
                  <Link href="/novidades" className="hover:text-primary transition-colors flex items-center gap-1 font-medium">
                    {tr("Ver novidades do site", "See site news")} <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CARROSSEL EM LINHA DE CARTAS RECENTES (DATABASE) ──────────── */}
        <LatestCardsCarousel limit={16} />

        {/* ── ÁREA INSTITUCIONAL: GRATIDÃO, MÉTRICAS, RULINGS & LINKS OFICIAIS ── */}
        <HomeDirectivesSection />

        {/* ── DECKS POPULARES RECENTES (ÚLTIMA SEMANA / 15 DIAS) ─────────── */}
        <RecentPopularDecksCarousel />

        {/* ── CARTAS PRINCIPAIS POPULARES (LR RANKING) ──────────────────── */}
        <PopularMainCardsSection />

        {/* ── PUBLICIDADE: no meio da página, longe do topo e dos botões de ação ── */}
        <AdSlot format="responsive" className="container-ultrawide my-4" />

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
