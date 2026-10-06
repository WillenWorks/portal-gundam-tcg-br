/* Power Rankings semanal (Fase 2, ver PLANO_METAGAME_TORNEIOS_TELEMETRIA.md §2.3 e §5) --
 * só usa arquétipo declarado em resultado real de torneio (TournamentEntry.archetype),
 * nunca deck público. "Iniciar Build Básica" e "Explorar Núcleos" tentam casar o
 * arquétipo do ranking com um arquétipo VEDA (metaAnalyticsService, baseado em deck
 * público) pela mesma assinatura (carta+cores) -- quando não bate, avisa o usuário em
 * vez de fingir que existe núcleo matemático pra aquele arquétipo. */
import { useEffect, useState } from "react";
import { Trophy, Wrench, Telescope, Loader2, ExternalLink, Calendar, Filter, X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, type PowerRankingEntry, type MetagameProvenance } from "@/lib/api";
import { GAME_COLOR_HEX, GAME_COLOR_LABEL_PT, TOURNAMENT_TIER_OPTIONS } from "@/lib/gundam-catalog";
import { BuildCoreDeckModal, type CoreCardItem } from "@/components/deck/BuildCoreDeckModal";
import { DataSourceNote } from "@/components/stats/DataSourceNote";

const FALLBACK_SLICE_COLOR = "#94a3b8";

function vedaKeyFor(entry: PowerRankingEntry): string | null {
  if (!entry.signatureCard) return null;
  return `${entry.signatureCard.code}||${entry.colors.join(",")}`;
}

export function PowerRankingsPanel({ seasonId, setId, onExploreArchetype }: { seasonId: string; setId?: string; onExploreArchetype: (key: string) => void }) {
  const [rankings, setRankings] = useState<PowerRankingEntry[]>([]);
  const [provenance, setProvenance] = useState<MetagameProvenance | null>(null);
  const [selectedPlacementsArchetype, setSelectedPlacementsArchetype] = useState<PowerRankingEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [buildingKey, setBuildingKey] = useState<string | null>(null);
  const [buildModal, setBuildModal] = useState<{ archetypeName: string; coreCards: CoreCardItem[]; suggestedCards: CoreCardItem[] } | null>(null);

  // Filtros de tipo de evento (tier) e período (datas)
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    api.getPowerRankings({
      seasonId,
      setId,
      tier: selectedTier === "ALL" ? undefined : selectedTier,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })
      .then((res) => {
        setRankings(res.rankings.slice(0, 10));
        setProvenance(res.provenance || null);
      })
      .catch(() => {
        setRankings([]);
        setProvenance(null);
      })
      .finally(() => setLoading(false));
  }, [seasonId, setId, selectedTier, startDate, endDate]);

  const startBuild = async (entry: PowerRankingEntry) => {
    const key = vedaKeyFor(entry);
    if (!key) {
      toast.info("Esse arquétipo ainda não tem decklist suficiente registrada pra montar um núcleo matemático.");
      return;
    }
    setBuildingKey(entry.archetype);
    try {
      const breakdown = await api.getArchetypeBreakdown(key);
      if (!breakdown || !breakdown.coreBuild?.coreCards.length) {
        toast.info(`Núcleo matemático ainda não disponível pra "${entry.archetype}" -- a amostra de deck público da engine VEDA não bateu com a decklist de torneio desse arquétipo.`);
        return;
      }
      const mapCard = (c: (typeof breakdown.coreBuild.coreCards)[number]): CoreCardItem => ({
        id: c.id,
        code: c.code,
        name: c.name,
        namePt: c.namePt,
        imageUrl: c.imageUrl,
        imageMediumUrl: c.imageMediumUrl,
        color: c.color,
        cost: c.cost,
        level: c.level,
        type: c.cardType,
        presenceRate: Math.round(c.inclusionRate * 100),
        recommendedCopies: c.recommendedCopies,
      });
      setBuildModal({
        archetypeName: entry.archetype,
        coreCards: breakdown.coreBuild.coreCards.map(mapCard),
        suggestedCards: breakdown.coreBuild.suggestedCards.map(mapCard),
      });
    } catch {
      toast.error("Falha ao carregar o núcleo do arquétipo.");
    } finally {
      setBuildingKey(null);
    }
  };

  const exploreCore = (entry: PowerRankingEntry) => {
    const key = vedaKeyFor(entry);
    if (!key) {
      toast.info("Esse arquétipo ainda não tem decklist suficiente registrada na engine VEDA.");
      return;
    }
    onExploreArchetype(key);
  };

  return (
    <Card className="panel-cut rounded-none border-primary/30 hero-surface">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.24em] text-primary">
              <Trophy className="size-3.5 text-accent" /> Classificação de Poder Semanal
            </p>
            <h3 className="mt-2 font-heading text-3xl uppercase">Power Rankings · Top 10</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
              Composto de Presença no Metagame e Taxa de Vitória (suavizada contra amostra pequena) calculado só a partir de arquétipo declarado em resultado real de torneio reportado.
            </p>
          </div>
          <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary uppercase text-[10px] tracking-wider">Fonte: Torneios Reportados</Badge>
        </div>

        {provenance && (
          <DataSourceNote
            provenance={provenance}
            labelPrefix="Power Rankings baseado em"
            weightNote="Eventos maiores e com maior competitividade têm maior peso amostral no score."
            className="mt-4"
          />
        )}

        {/* Filtros de Tier e Período */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-mono">
            <Filter className="size-3.5 text-primary" />
            <span className="uppercase tracking-wider text-[11px]">Tipo de Torneio:</span>
          </div>
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="field-shell h-8 rounded-none border border-white/15 bg-slate-950/70 px-2.5 text-xs text-white"
          >
            <option value="ALL">Todos os tipos de evento</option>
            {TOURNAMENT_TIER_OPTIONS.map((tier) => (
              <option key={tier.value} value={tier.value}>
                {tier.label}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-2 text-slate-400 font-mono">
            <span className="uppercase tracking-wider text-[11px]">De:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="field-shell h-8 rounded-none border border-white/15 bg-slate-950/70 px-2 text-xs text-white"
            />
            <span className="uppercase tracking-wider text-[11px]">Até:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="field-shell h-8 rounded-none border border-white/15 bg-slate-950/70 px-2 text-xs text-white"
            />
          </div>

          {(selectedTier !== "ALL" || startDate || endDate) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedTier("ALL");
                setStartDate("");
                setEndDate("");
              }}
              className="h-8 px-2 text-xs text-slate-400 hover:text-white"
            >
              <X className="mr-1 size-3" /> Limpar filtros
            </Button>
          )}
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-slate-400">Carregando ranking...</p>
        ) : !rankings.length ? (
          <p className="mt-6 text-sm text-slate-500">Ainda não há arquétipo declarado suficiente em torneios reportados nesse recorte pra montar o ranking.</p>
        ) : (
          <div className="mt-6 space-y-2">
            {rankings.map((entry, index) => (
              <div key={entry.archetype} className="panel-cut flex flex-wrap items-center gap-4 border border-white/10 bg-slate-950/60 p-4 transition-colors hover:border-primary/40">
                <div className="flex size-10 shrink-0 items-center justify-center panel-cut border border-primary/40 bg-primary/10 font-heading text-lg text-primary">#{index + 1}</div>

                {entry.signatureCard?.imageMediumUrl ? (
                  <img src={entry.signatureCard.imageMediumUrl} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-14 w-10 shrink-0 rounded bg-white/5" />
                )}

                <div className="min-w-[180px] flex-1">
                  <div className="flex items-center gap-1.5">
                    {entry.colors.map((c) => <span key={c} title={GAME_COLOR_LABEL_PT[c] || c} className="size-2.5 rounded-full" style={{ backgroundColor: GAME_COLOR_HEX[c] || FALLBACK_SLICE_COLOR }} />)}
                  </div>
                  <p className="mt-1 font-heading text-xl uppercase leading-tight text-white">{entry.archetype}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-xs text-slate-500">{entry.deckCount} entrada(s){entry.bestPlacement ? ` · melhor: ${entry.bestPlacement}º` : ""}</p>
                    {entry.isSmallSample && (
                      <Badge
                        variant="outline"
                        className="text-[9px] uppercase font-mono tracking-wider text-amber-400 border-amber-500/40 bg-amber-500/10"
                        title="Amostra pequena de torneios — métricas podem ter maior volatilidade."
                      >
                        Poucos dados
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-4 sm:gap-6 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Meta Share</p>
                    <p className="font-heading text-xl text-white">{Math.round(entry.metaShare * 100)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Top Cut</p>
                    <p className="font-heading text-xl text-sky-400" title="Proporção de listas deste arquétipo que atingiram o Top 8">
                      {entry.topCutConversion != null ? `${Math.round(entry.topCutConversion * 100)}%` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Winrate</p>
                    <p className="font-heading text-xl text-white">{entry.winRate != null ? `${Math.round(entry.winRate * 100)}%` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Power</p>
                    <p className="font-heading text-xl text-accent">{entry.powerRankingScore.toFixed(1)}</p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {entry.tournamentPlacements && entry.tournamentPlacements.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-none text-[11px] uppercase tracking-[0.1em] border-primary/30 text-primary hover:bg-primary/20"
                      onClick={() => setSelectedPlacementsArchetype(entry)}
                    >
                      <Trophy className="mr-1 size-3 text-accent" />
                      {entry.tournamentPlacements.length} {entry.tournamentPlacements.length === 1 ? "colocação" : "colocações"}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-8 rounded-none text-[11px] uppercase tracking-[0.1em]" disabled={buildingKey === entry.archetype} onClick={() => startBuild(entry)}>
                    {buildingKey === entry.archetype ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Wrench className="mr-1 size-3" />} Iniciar Build Básica
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 rounded-none text-[11px] uppercase tracking-[0.1em]" onClick={() => exploreCore(entry)}>
                    <Telescope className="mr-1 size-3" /> Explorar Núcleos
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {selectedPlacementsArchetype && (
        <Dialog open={Boolean(selectedPlacementsArchetype)} onOpenChange={(open) => !open && setSelectedPlacementsArchetype(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-none border-white/15 bg-slate-950 text-white panel-cut p-6">
            <DialogHeader className="p-0 text-left">
              <div className="flex items-center gap-2 text-xs uppercase font-mono tracking-[0.2em] text-primary">
                <Trophy className="size-4 text-accent" />
                <span>Colocações Competitivas em Torneios</span>
              </div>
              <DialogTitle className="mt-1 font-heading text-2xl uppercase text-white">
                {selectedPlacementsArchetype.archetype}
              </DialogTitle>
              <p className="mt-1 text-xs text-slate-400">
                Origem das {selectedPlacementsArchetype.tournamentPlacements?.length || 0} listas reportadas para este arquétipo e colocações alcançadas em cada evento.
              </p>
            </DialogHeader>

            <div className="mt-4 space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
              {(!selectedPlacementsArchetype.tournamentPlacements || selectedPlacementsArchetype.tournamentPlacements.length === 0) ? (
                <p className="py-6 text-center text-xs text-slate-500 font-mono">
                  Nenhuma colocação detalhada encontrada para este arquétipo.
                </p>
              ) : (
                selectedPlacementsArchetype.tournamentPlacements.map((p, idx) => {
                  const tierObj = TOURNAMENT_TIER_OPTIONS.find((t) => t.value === p.tier);
                  const tierLabel = tierObj?.label || p.tier || "Torneio Registrado";
                  const dateStr = p.date ? new Date(p.date).toLocaleDateString("pt-BR") : null;
                  const hasRecord = p.wins != null && p.losses != null;

                  return (
                    <div
                      key={p.tournamentId ? `${p.tournamentId}-${idx}` : idx}
                      className="panel-cut border border-white/10 bg-slate-900/60 p-3 transition-colors hover:border-primary/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex size-10 shrink-0 items-center justify-center panel-cut border border-primary/40 bg-primary/10 font-heading text-sm text-primary">
                            {p.placement ? `${p.placement}º` : "Top"}
                          </div>
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary text-[10px] font-mono uppercase">
                                {tierLabel}
                              </Badge>
                              {dateStr && (
                                <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                                  <Calendar className="size-3" />
                                  {dateStr}
                                </span>
                              )}
                            </div>
                            <h4 className="font-heading text-base uppercase text-white truncate">
                              {p.tournamentName}
                            </h4>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                              {p.organizer && (
                                <span>Organizador: <strong className="text-slate-200">{p.organizer}</strong></span>
                              )}
                              {hasRecord && (
                                <span className="font-mono text-slate-300">
                                  Campanha: {p.wins}V - {p.losses}D{p.draws ? ` - ${p.draws}E` : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {p.sourceUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 shrink-0 rounded-none border-primary/30 bg-primary/10 text-[11px] font-mono uppercase text-primary hover:bg-primary/20 hover:text-white"
                            asChild
                          >
                            <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1 size-3" />
                              Fonte Oficial
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-white/10 mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedPlacementsArchetype(null)}
                className="rounded-none border-white/15 text-xs uppercase"
              >
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {buildModal ? (
        <BuildCoreDeckModal
          open={Boolean(buildModal)}
          onClose={() => setBuildModal(null)}
          archetypeName={buildModal.archetypeName}
          coreCards={buildModal.coreCards}
          suggestedCards={buildModal.suggestedCards}
        />
      ) : null}
    </Card>
  );
}
