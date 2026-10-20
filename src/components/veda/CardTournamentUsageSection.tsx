import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  BarChart2,
  Layers,
  Trophy,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VedaArchetypeBadge } from "@/components/veda/VedaArchetypeBadge";
import { VedaPlacementBadge } from "@/components/veda/VedaPlacementBadge";
import { VedaPlayerLink } from "@/components/veda/VedaPlayerLink";
import { VedaSampleNote } from "@/components/veda/VedaSampleNote";
import { vedaApi } from "@/lib/veda/api";
import type { VedaCardUsage } from "@/lib/veda/types";
import { useSiteLanguage } from "@/i18n/siteLanguage";

function formatDatePtBr(raw?: string | null): string {
  if (!raw) return "";
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "";
  }
}

export interface CardTournamentUsageSectionProps {
  cardModelId?: string | null;
  cardCode?: string | null;
  className?: string;
}

export function CardTournamentUsageSection({
  cardModelId,
  cardCode,
  className = "",
}: CardTournamentUsageSectionProps) {
  const { tr } = useSiteLanguage();
  const [usage, setUsage] = useState<VedaCardUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const targetId = cardModelId || cardCode;
    if (!targetId) return;

    let active = true;
    setLoading(true);
    setChecked(false);

    vedaApi
      .getCardUsage(targetId)
      .then((data) => {
        if (active) {
          setUsage(data);
          setChecked(true);
        }
      })
      .catch(() => {
        if (active) {
          setUsage(null);
          setChecked(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cardModelId, cardCode]);

  if (loading) {
    return (
      <div className={`panel-cut border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-4 text-xs font-mono text-slate-500 dark:text-slate-400 text-center ${className}`}>
        {tr("Consultando telemetria de torneios no Veda System...", "Loading tournament data...")}
      </div>
    );
  }

  // Se já consultou e a carta não tem dados de uso em torneios
  if (checked && !usage) {
    return (
      <div className={`panel-cut border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/60 p-4 text-xs font-mono text-slate-500 dark:text-slate-400 space-y-1 ${className}`}>
        <p className="uppercase text-slate-800 dark:text-slate-300 font-semibold flex items-center gap-1.5">
          <Trophy className="size-3.5 text-primary" />
          {tr("Em Torneios Competitivos", "In Competitive Tournaments")}
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          {tr("Esta carta ainda não possui registros de uso nas decklists congeladas de torneios oficiais do Veda System.", "This card has no recorded use yet in official tournament decklists.")}
        </p>
      </div>
    );
  }

  if (!usage) return null;

  const inclusionPercent = (usage.inclusion * 100).toFixed(1);

  return (
    <div className={`panel-cut border border-primary/30 hero-surface p-5 space-y-4 ${className}`}>
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-3">
        <div>
          <h3 className="font-heading text-lg uppercase text-slate-900 dark:text-white flex items-center gap-2">
            <Trophy className="size-4 text-primary" />
            {tr("Em Torneios Competitivos (Veda System)", "In Competitive Tournaments")}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            {tr("Presença consolidada da carta nas decklists de eventos competitivos.", "How often this card appears in competitive event decklists.")}
          </p>
        </div>

        {/* Amostra Oficial */}
        <VedaSampleNote sample={usage.sample} variant="badge" />
      </div>

      {/* Grid de Métricas Principais */}
      <div className="grid grid-cols-3 gap-3">
        <div className="panel-cut border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/60 p-3 text-center sm:text-left">
          <p className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 tracking-wider">{tr("Inclusão Geral", "Overall Inclusion")}</p>
          <p className="mt-1 font-heading text-xl sm:text-2xl text-primary">{inclusionPercent}%</p>
          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{tr("das listas do período", "of lists in the period")}</p>
        </div>

        <div className="panel-cut border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/60 p-3 text-center sm:text-left">
          <p className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 tracking-wider">{tr("Média por Deck", "Average per Deck")}</p>
          <p className="mt-1 font-heading text-xl sm:text-2xl text-slate-900 dark:text-white">~{usage.avgCopies.toFixed(1)}x</p>
          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{tr("cópias por lista", "copies per list")}</p>
        </div>

        <div className="panel-cut border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/60 p-3 text-center sm:text-left">
          <p className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 tracking-wider">{tr("Volume de Listas", "List Volume")}</p>
          <p className="mt-1 font-heading text-xl sm:text-2xl text-slate-800 dark:text-slate-200">{usage.lists}</p>
          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{tr("decks utilizando", "decks using it")}</p>
        </div>
      </div>

      {/* Arquétipos que mais utilizam a carta */}
      {usage.archetypes && usage.archetypes.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Layers className="size-3.5 text-primary" />
            {tr("Arquétipos que utilizam esta carta", "Archetypes using this card")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {usage.archetypes.map(({ archetype, lists, inclusion }) => {
              const archInclusion = Math.round(inclusion * 100);
              return (
                <div
                  key={archetype.slug}
                  className="panel-cut border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 p-2.5 flex items-center justify-between gap-2 hover:border-primary/40 transition-colors"
                >
                  <VedaArchetypeBadge archetype={archetype} />
                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs text-primary font-bold">{archInclusion}%</span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block">{lists} decks</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Decklists Recentes com a Carta */}
      {usage.recentDecklists && usage.recentDecklists.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
          <p className="text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <BarChart2 className="size-3.5 text-primary" />
            {tr("Decklists Recentes em Torneios", "Recent Tournament Decklists")}
          </p>
          <div className="space-y-2">
            {usage.recentDecklists.slice(0, 5).map((deck) => (
              <div
                key={deck.entryId}
                className="panel-cut border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-2.5 flex flex-wrap items-center justify-between gap-2 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  <VedaPlacementBadge placementLabel={deck.placementLabel} />
                  <span className="text-xs text-slate-900 dark:text-white font-medium">
                    <VedaPlayerLink player={deck.player} />
                  </span>
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px] font-mono">
                    {deck.quantity}x {tr("na lista", "in the list")}
                  </Badge>
                  <Link
                    href={`/torneios/${deck.tournamentId}`}
                    className="text-xs text-slate-600 dark:text-slate-300 hover:text-primary transition-colors underline decoration-dotted truncate max-w-xs"
                  >
                    {deck.tournamentName}
                  </Link>
                  {deck.date && (
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      {formatDatePtBr(deck.date)}
                    </span>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="h-6 rounded-none border-primary/30 bg-primary/10 text-[10px] font-mono uppercase text-primary hover:bg-primary/20 hover:text-slate-900 dark:hover:text-white"
                >
                  <Link href={`/torneios/${deck.tournamentId}/lista/${deck.entryId}`}>
                    {tr("Ver Decklist", "View Decklist")}
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
