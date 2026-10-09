import { useMemo, useState } from "react";
import { Database, ExternalLink, Info, ShieldCheck, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { MetagameProvenance, TournamentProvenanceItem } from "@/lib/api";
import { TOURNAMENT_TIER_OPTIONS } from "@/lib/gundam-catalog";

const tierLabel = (tier?: string | null) =>
  TOURNAMENT_TIER_OPTIONS.find((t) => t.value === tier)?.label || tier || "Torneio Registrado";

function formatDatePtBr(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return null;
  }
}

function formatPeriod(start?: string | null, end?: string | null): string | null {
  const s = formatDatePtBr(start);
  const e = formatDatePtBr(end);
  if (s && e) {
    if (s === e) return `em ${s}`;
    return `de ${s} a ${e}`;
  }
  if (s) return `a partir de ${s}`;
  if (e) return `até ${e}`;
  return null;
}

export interface DataSourceNoteProps {
  provenance?: MetagameProvenance | null;
  totalDecks?: number;
  totalTournaments?: number;
  startDate?: string | null;
  endDate?: string | null;
  tournaments?: TournamentProvenanceItem[];
  labelPrefix?: string;
  weightNote?: string;
  className?: string;
  variant?: "inline" | "badge" | "card" | "banner";
  archetypeName?: string;
}

export function DataSourceNote({
  provenance,
  totalDecks: directDecks,
  totalTournaments: directTournaments,
  startDate: directStart,
  endDate: directEnd,
  tournaments: directTournamentsList,
  labelPrefix = "Baseado em",
  weightNote,
  className = "",
  variant = "inline",
  archetypeName,
}: DataSourceNoteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("ALL");

  const decksCount = provenance?.totalDecks ?? directDecks ?? 0;
  const tourneysList = provenance?.tournaments ?? directTournamentsList ?? [];
  const tournamentsCount = provenance?.totalTournaments ?? directTournaments ?? tourneysList.length;
  const start = provenance?.startDate ?? directStart ?? null;
  const end = provenance?.endDate ?? directEnd ?? null;
  const periodText = formatPeriod(start, end);

  const filteredTournaments = useMemo(() => {
    return tourneysList.filter((t) => {
      if (selectedTier !== "ALL" && t.tier !== selectedTier) return false;
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      const name = (t.name || "").toLowerCase();
      const org = (t.organizer || "").toLowerCase();
      const tier = tierLabel(t.tier).toLowerCase();
      return name.includes(term) || org.includes(term) || tier.includes(term);
    });
  }, [tourneysList, search, selectedTier]);

  const summaryText = useMemo(() => {
    if (decksCount === 0 && tournamentsCount === 0) {
      return "Amostragem em processamento para este recorte.";
    }
    const decksLabel = `${decksCount} ${decksCount === 1 ? "lista" : "listas"}`;
    const tourneysLabel = `${tournamentsCount} ${tournamentsCount === 1 ? "torneio" : "torneios"}`;
    const periodPart = periodText ? ` (${periodText})` : "";
    return `${labelPrefix} ${decksLabel} de ${tourneysLabel}${periodPart}`;
  }, [decksCount, tournamentsCount, periodText, labelPrefix]);

  const availableTiers = useMemo(() => {
    const set = new Set<string>();
    tourneysList.forEach((t) => {
      if (t.tier) set.add(t.tier);
    });
    return Array.from(set);
  }, [tourneysList]);

  return (
    <>
      {variant === "inline" && (
        <div className={`flex flex-wrap items-center justify-between gap-2 rounded-none border border-primary/20 bg-slate-950/60 px-3 py-2 text-xs text-slate-300 panel-cut ${className}`}>
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Database className="size-3.5 shrink-0 text-primary" />
              <span className="truncate">{summaryText}</span>
            </div>
            {weightNote && (
              <span className="text-[11px] text-slate-400 pl-5">{weightNote}</span>
            )}
          </div>
          {tournamentsCount > 0 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpen(true)}
              className="h-6 shrink-0 rounded-none border-primary/30 bg-primary/10 px-2 text-[11px] font-mono uppercase tracking-wider text-primary hover:bg-primary/20 hover:text-white"
            >
              Ver {tournamentsCount} {tournamentsCount === 1 ? "torneio" : "torneios"}
            </Button>
          ) : null}
        </div>
      )}

      {variant === "badge" && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded-none border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-mono text-primary uppercase tracking-wider hover:bg-primary/20 hover:border-primary transition-colors ${className}`}
        >
          <Database className="size-3 text-accent" />
          <span>{summaryText}</span>
        </button>
      )}

      {variant === "banner" && (
        <Card className={`panel-cut rounded-none border-primary/30 hero-surface ${className}`}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] font-mono text-primary">
                  <ShieldCheck className="size-3.5 text-accent" />
                  Transparência de Metagame & Proveniência
                </p>
                <p className="font-heading text-lg sm:text-xl uppercase text-white">{summaryText}</p>
                <p className="text-xs text-slate-400 max-w-2xl">{weightNote}</p>
              </div>

              {tournamentsCount > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOpen(true)}
                  className="rounded-none border-primary/40 bg-primary/10 text-xs font-mono uppercase tracking-wider text-primary hover:bg-primary/20 hover:text-white"
                >
                  <Database className="mr-1.5 size-3.5" />
                  Inspecionar {tournamentsCount} {tournamentsCount === 1 ? "torneio" : "torneios"}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-none border-white/15 bg-slate-950 text-white panel-cut p-6">
          <DialogHeader className="p-0 text-left">
            <div className="flex items-center gap-2 text-xs uppercase font-mono tracking-[0.2em] text-primary">
              <Database className="size-4 text-accent" />
              <span>Proveniência e Origem dos Dados Competitivos</span>
            </div>
            <DialogTitle className="mt-1 font-heading text-2xl uppercase text-white">
              {archetypeName ? `Torneios do Arquétipo: ${archetypeName}` : "Torneios e Eventos Analisados"}
            </DialogTitle>
            <p className="mt-1 text-xs text-slate-400">
              Rastreabilidade de cada número: apenas listas travadas em eventos com snapshots imutáveis compõem as estatísticas.
            </p>
          </DialogHeader>

          {/* Cards de Resumo da Amostra */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="panel-cut border border-white/10 bg-slate-900/60 p-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500">Listas Analisadas</p>
              <p className="mt-1 font-heading text-2xl text-white">{decksCount}</p>
            </div>
            <div className="panel-cut border border-white/10 bg-slate-900/60 p-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500">Torneios Únicos</p>
              <p className="mt-1 font-heading text-2xl text-primary">{tournamentsCount}</p>
            </div>
            <div className="panel-cut border border-white/10 bg-slate-900/60 p-3 sm:col-span-2">
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500">Período Competitivo</p>
              <p className="mt-1 font-heading text-lg text-slate-200 truncate">{periodText || "Histórico consolidado"}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-none border border-accent/20 bg-accent/5 p-3 text-xs text-slate-300">
            <Info className="size-4 shrink-0 text-accent mt-0.5" />
            <p className="leading-relaxed">
              <strong>Critério de Relevância:</strong> {weightNote} Cada entrada representa uma decklist real submetida e congelada na conclusão da rodada.
            </p>
          </div>

          {/* Filtro e Busca nos Torneios */}
          {tourneysList.length > 2 && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Input
                    placeholder="Buscar torneio ou organizador..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 rounded-none border-white/15 bg-white/5 text-xs text-white placeholder:text-slate-500"
                  />
                </div>

                {availableTiers.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      size="sm"
                      variant={selectedTier === "ALL" ? "default" : "outline"}
                      onClick={() => setSelectedTier("ALL")}
                      className="h-8 rounded-none text-[10px] font-mono uppercase px-2"
                    >
                      Todos
                    </Button>
                    {availableTiers.map((tier) => (
                      <Button
                        key={tier}
                        size="sm"
                        variant={selectedTier === tier ? "default" : "outline"}
                        onClick={() => setSelectedTier(tier)}
                        className="h-8 rounded-none text-[10px] font-mono uppercase px-2"
                      >
                        {tier === "LARGE_OFFICIAL" ? "Regionais/Majors" : tier === "SMALL_OFFICIAL" ? "Lojas" : tier}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lista de Torneios */}
          <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
            {filteredTournaments.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500 font-mono">
                Nenhum torneio encontrado com os filtros atuais.
              </p>
            ) : (
              filteredTournaments.map((t, idx) => (
                <div
                  key={t.id || idx}
                  className="panel-cut border border-white/10 bg-slate-900/60 p-3 transition-colors hover:border-primary/40 hover:bg-slate-900/90"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary text-[10px] font-mono uppercase">
                          {tierLabel(t.tier)}
                        </Badge>
                        {t.date && (
                          <span className="text-[11px] font-mono text-slate-400">
                            {formatDatePtBr(t.date)}
                          </span>
                        )}
                      </div>

                      <h4 className="font-heading text-base uppercase text-white truncate">{t.name}</h4>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                        {t.organizer && (
                          <span>
                            Organizador: <strong className="text-slate-200">{t.organizer}</strong>
                          </span>
                        )}
                        {t.playerCount ? (
                          <span className="flex items-center gap-1 font-mono">
                            <Users className="size-3 text-slate-400" />
                            {t.playerCount} jogadores
                          </span>
                        ) : null}
                        {t.deckCount ? (
                          <Badge variant="outline" className="border-white/15 text-[10px] font-mono text-accent">
                            {t.deckCount} {t.deckCount === 1 ? "deck no recorte" : "decks no recorte"}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    {t.sourceUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 rounded-none border-primary/30 bg-primary/10 text-[11px] font-mono uppercase text-primary hover:bg-primary/20 hover:text-white"
                        asChild
                      >
                        <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-1 size-3" />
                          Fonte Oficial
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="rounded-none border-white/15 text-xs uppercase"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
