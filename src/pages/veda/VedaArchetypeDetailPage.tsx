import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  Calendar,
  ChevronLeft,
  Crown,
  ExternalLink,
  Layers,
  Medal,
  Shield,
  Sparkles,
  Trophy,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VedaShell } from "@/components/veda/VedaShell";
import { VedaColorPills } from "@/components/veda/VedaColorPills";
import { VedaPlacementBadge } from "@/components/veda/VedaPlacementBadge";
import { VedaPlayerLink } from "@/components/veda/VedaPlayerLink";
import { VedaSampleNote } from "@/components/veda/VedaSampleNote";
import { VedaErrorView, VedaLoadingView } from "@/components/veda/VedaStateViews";
import { vedaApi } from "@/lib/veda/api";
import type { VedaArchetypeDetail, VedaCardInclusion } from "@/lib/veda/types";

function formatDatePtBr(raw?: string | null): string {
  if (!raw) return "Data não informada";
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return raw;
  }
}

export default function VedaArchetypeDetailPage() {
  const [, params] = useRoute<{ slug: string }>("/arquetipos/:slug");
  const archetypeSlug = params?.slug ? decodeURIComponent(params.slug) : "";

  const [detail, setDetail] = useState<VedaArchetypeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [activeCardTab, setActiveCardTab] = useState<"all" | "core" | "flex" | "tech">("all");

  const loadArchetypeDetail = async () => {
    if (!archetypeSlug) return;
    setLoading(true);
    setError(null);
    try {
      const result = await vedaApi.getArchetype(archetypeSlug, {
        season: selectedSeason || undefined,
      });
      setDetail(result);
    } catch (err: any) {
      setError(err?.message || "Arquétipo não encontrado.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchetypeDetail();
  }, [archetypeSlug, selectedSeason]);

  const filteredCards = useMemo(() => {
    if (!detail?.cards) return [];
    if (activeCardTab === "all") return detail.cards;
    return detail.cards.filter((c) => c.tier === activeCardTab);
  }, [detail?.cards, activeCardTab]);

  const coreCards = useMemo(() => detail?.cards.filter((c) => c.tier === "core") || [], [detail?.cards]);
  const flexCards = useMemo(() => detail?.cards.filter((c) => c.tier === "flex") || [], [detail?.cards]);
  const techCards = useMemo(() => detail?.cards.filter((c) => c.tier === "tech") || [], [detail?.cards]);

  if (loading) {
    return (
      <VedaShell
        breadcrumbs={[
          { label: "Arquétipos", href: "/arquetipos" },
          { label: "Carregando..." },
        ]}
      >
        <VedaLoadingView label="Analisando composição e cartas do arquétipo..." />
      </VedaShell>
    );
  }

  if (error || !detail) {
    return (
      <VedaShell
        breadcrumbs={[
          { label: "Arquétipos", href: "/arquetipos" },
          { label: "Não encontrado" },
        ]}
      >
        <VedaErrorView
          title="Arquétipo não encontrado"
          error={error || "Não há registros disponíveis para este arquétipo."}
          onRetry={loadArchetypeDetail}
        />
        <div className="pt-4 flex justify-center">
          <Button variant="outline" asChild className="rounded-none font-mono text-xs uppercase">
            <Link href="/arquetipos">
              <ChevronLeft className="mr-1.5 size-3.5" />
              Voltar para Ranking de Arquétipos
            </Link>
          </Button>
        </div>
      </VedaShell>
    );
  }

  const { row, sample } = detail;
  const sharePercent = (row.share * 100).toFixed(1);
  const top8Percent = (row.top8Share * 100).toFixed(1);
  const winPercent = (row.winShare * 100).toFixed(1);

  return (
    <VedaShell
      breadcrumbs={[
        { label: "Arquétipos", href: "/arquetipos" },
        { label: row.archetype.name },
      ]}
      sample={sample}
    >
      <div className="space-y-6">
        {/* Cabeçalho do Arquétipo */}
        <div className="panel-cut border border-primary/30 hero-surface p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-widest text-primary">
                  Dossiê Tático de Arquétipo
                </span>
                {row.archetype.colors && row.archetype.colors.length > 0 && (
                  <VedaColorPills colors={row.archetype.colors} size="sm" showLabel />
                )}
              </div>
              <h1 className="font-heading text-2xl sm:text-4xl uppercase text-white tracking-wide">
                {row.archetype.name}
              </h1>
            </div>

            {/* Filtro Rápido de Temporada */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400 uppercase">Temporada:</span>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="h-8 px-2 rounded-none border border-white/15 bg-slate-900 text-xs text-white font-mono focus:border-primary outline-none"
              >
                <option value="">Todas as Temporadas</option>
                <option value="GD05">GD05</option>
                <option value="GD04">GD04</option>
                <option value="GD03">GD03</option>
                <option value="GD02">GD02</option>
                <option value="GD01">GD01</option>
              </select>
            </div>
          </div>

          {/* Cards de Métricas Competitivas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="panel-cut border border-white/10 bg-slate-950/60 p-3 sm:p-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Presença no Meta</p>
              <p className="mt-1 font-heading text-2xl sm:text-3xl text-primary">{sharePercent}%</p>
              <p className="text-[11px] font-mono text-slate-400">{row.lists} decklists</p>
            </div>
            <div className="panel-cut border border-white/10 bg-slate-950/60 p-3 sm:p-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Conversão em Top 8</p>
              <p className="mt-1 font-heading text-2xl sm:text-3xl text-emerald-400">{top8Percent}%</p>
              <p className="text-[11px] font-mono text-slate-400">das listas do arquétipo</p>
            </div>
            <div className="panel-cut border border-amber-500/30 bg-amber-950/20 p-3 sm:p-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <Trophy className="size-3" />
                Títulos Conquistados
              </p>
              <p className="mt-1 font-heading text-2xl sm:text-3xl text-amber-300">{row.wins}</p>
              <p className="text-[11px] font-mono text-amber-400/80">{winPercent}% dos títulos</p>
            </div>
            <div className="panel-cut border border-white/10 bg-slate-950/60 p-3 sm:p-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Melhor Colocação</p>
              <p className="mt-1 font-heading text-2xl sm:text-3xl text-white">
                {row.bestPlacement ? `${row.bestPlacement}º` : "—"}
              </p>
              <p className="text-[11px] font-mono text-slate-400">no período</p>
            </div>
          </div>

          {/* Nota de Amostra com aviso se small */}
          <VedaSampleNote sample={sample} variant="banner" />
        </div>

        {/* Anatomia do Arquétipo: Núcleo (Core), Ajustes (Flex) e Techs */}
        <div className="panel-cut border border-white/10 bg-slate-950/80 p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <h2 className="font-heading text-lg sm:text-xl uppercase text-white flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                Anatomia de Cartas do Arquétipo
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cartas mais utilizadas nas listas compiladas, classificadas pela taxa de inclusão.
              </p>
            </div>

            {/* Abas de Filtro de Cartas */}
            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveCardTab("all")}
                className={`px-2.5 py-1 text-xs font-mono uppercase transition ${
                  activeCardTab === "all" ? "bg-primary text-primary-foreground font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Todas ({detail.cards.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCardTab("core")}
                className={`px-2.5 py-1 text-xs font-mono uppercase transition ${
                  activeCardTab === "core" ? "bg-primary text-primary-foreground font-bold" : "text-slate-400 hover:text-white"
                }`}
                title="Cartas presentes em 80% ou mais das listas"
              >
                Núcleo ({coreCards.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCardTab("flex")}
                className={`px-2.5 py-1 text-xs font-mono uppercase transition ${
                  activeCardTab === "flex" ? "bg-primary text-primary-foreground font-bold" : "text-slate-400 hover:text-white"
                }`}
                title="Cartas presentes em 30% a 79% das listas"
              >
                Ajustes ({flexCards.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCardTab("tech")}
                className={`px-2.5 py-1 text-xs font-mono uppercase transition ${
                  activeCardTab === "tech" ? "bg-primary text-primary-foreground font-bold" : "text-slate-400 hover:text-white"
                }`}
                title="Cartas presentes em menos de 30% das listas"
              >
                Techs ({techCards.length})
              </button>
            </div>
          </div>

          {/* Grade de Cartas */}
          {filteredCards.length === 0 ? (
            <p className="py-8 text-center text-xs font-mono text-slate-500">
              Nenhuma carta nesta categoria para o recorte atual.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {filteredCards.map((inc: VedaCardInclusion, idx: number) => {
                const cardDisplayName = inc.card.namePt || inc.card.name;
                const cardTargetId = inc.card.cardModelId || inc.card.code;
                const inclusionPercent = Math.round(inc.inclusion * 100);

                const tierBadgeColor =
                  inc.tier === "core"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : inc.tier === "flex"
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-purple-500/40 bg-purple-500/10 text-purple-400";

                return (
                  <Link
                    key={`${inc.card.code}-${idx}`}
                    href={`/cards/${encodeURIComponent(cardTargetId)}`}
                    className="group relative block panel-cut border border-white/15 bg-slate-900/60 overflow-hidden hover:border-primary transition-all"
                    title={`${cardDisplayName} (${inc.card.code}) — Inclusão: ${inclusionPercent}%, Média: ${inc.avgCopies.toFixed(1)} cópias`}
                  >
                    <div className="relative aspect-[63/88] w-full bg-slate-950 overflow-hidden">
                      {inc.card.imageUrl ? (
                        <img
                          src={inc.card.imageUrl}
                          alt={cardDisplayName}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center p-2 text-center text-[10px] uppercase font-mono text-slate-500">
                          {cardDisplayName}
                        </div>
                      )}

                      {/* Selo do Tier (Núcleo / Flex / Tech) */}
                      <span
                        className={`absolute top-1 left-1 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border rounded-none shadow-sm ${tierBadgeColor}`}
                      >
                        {inc.tier === "core" ? "Núcleo" : inc.tier === "flex" ? "Flex" : "Tech"}
                      </span>

                      {/* Taxa de Inclusão no Canto Superior Direito */}
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-950/90 text-white border border-white/20">
                        {inclusionPercent}%
                      </span>

                      {/* Média de Cópias no Canto Inferior Direito */}
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 text-[10px] font-mono bg-primary text-primary-foreground font-bold shadow-sm">
                        ~{inc.avgCopies.toFixed(1)}x
                      </span>
                    </div>

                    <div className="p-2 space-y-0.5 bg-slate-950/90">
                      <p className="font-mono text-[10px] text-primary truncate">{inc.card.code}</p>
                      <p className="text-xs text-slate-200 truncate font-medium">{cardDisplayName}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Listas de Exemplo de Torneios Reais */}
        {detail.sampleDecklists && detail.sampleDecklists.length > 0 && (
          <div className="panel-cut border border-white/10 bg-slate-950/80 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-primary" />
                <h2 className="font-heading text-lg sm:text-xl uppercase text-white">
                  Decklists de Exemplo em Torneios
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {detail.sampleDecklists.length} lista(s) disponível(is)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {detail.sampleDecklists.map((sampleList) => (
                <div
                  key={sampleList.entryId}
                  className="panel-cut border border-white/10 bg-slate-900/40 p-4 space-y-2 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <VedaPlacementBadge placementLabel={sampleList.placementLabel} />
                    <span className="text-[11px] font-mono text-slate-400">
                      {formatDatePtBr(sampleList.date)}
                    </span>
                  </div>

                  <div className="font-heading text-base uppercase text-white">
                    <VedaPlayerLink player={sampleList.player} />
                  </div>

                  <p className="text-xs text-slate-300 truncate">{sampleList.tournamentName}</p>

                  <div className="pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="w-full h-7 rounded-none border-primary/30 bg-primary/10 text-xs font-mono uppercase text-primary hover:bg-primary/20 hover:text-white"
                    >
                      <Link href={`/torneios/${sampleList.entryId}/lista/${sampleList.entryId}`}>
                        Inspecionar Lista
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resultados Recentes em Torneios */}
        {detail.recentResults && detail.recentResults.length > 0 && (
          <div className="panel-cut border border-white/10 bg-slate-950/80 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                <h2 className="font-heading text-lg sm:text-xl uppercase text-white">
                  Resultados Recentes do Arquétipo
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {detail.recentResults.length} entrada(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/15 text-[10px] font-mono uppercase tracking-wider text-slate-400 bg-white/5">
                    <th className="py-2.5 px-3 w-16">Colocação</th>
                    <th className="py-2.5 px-3">Jogador</th>
                    <th className="py-2.5 px-3">Torneio</th>
                    <th className="py-2.5 px-3 w-24">Placar</th>
                    <th className="py-2.5 px-3 text-right w-32">Decklist</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 font-mono">
                  {detail.recentResults.map((res) => (
                    <tr key={res.entryId} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-3">
                        <VedaPlacementBadge placement={res.placement} placementLabel={res.placementLabel} />
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <VedaPlayerLink player={res.player} />
                      </td>
                      <td className="py-3 px-3">
                        <Link
                          href={`/torneios/${res.tournamentId}`}
                          className="text-slate-200 hover:text-primary transition-colors block"
                        >
                          {res.tournamentName}
                        </Link>
                        <span className="text-[10px] text-slate-400">{formatDatePtBr(res.date)}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-300">{res.record || "—"}</td>
                      <td className="py-3 px-3 text-right">
                        {res.hasDecklist ? (
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="h-7 rounded-none border-primary/30 bg-primary/10 text-[11px] font-mono uppercase text-primary hover:bg-primary/20 hover:text-white"
                          >
                            <Link href={`/torneios/${res.tournamentId}/lista/${res.entryId}`}>
                              Ver Lista
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">Não informada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </VedaShell>
  );
}
