/* Power Rankings semanal (Fase 2, ver PLANO_METAGAME_TORNEIOS_TELEMETRIA.md §2.3 e §5) --
 * só usa arquétipo declarado em resultado real de torneio (TournamentEntry.archetype),
 * nunca deck público. "Iniciar Build Básica" e "Explorar Núcleos" tentam casar o
 * arquétipo do ranking com um arquétipo VEDA (metaAnalyticsService, baseado em deck
 * público) pela mesma assinatura (carta+cores) -- quando não bate, avisa o usuário em
 * vez de fingir que existe núcleo matemático pra aquele arquétipo. */
import { useEffect, useState } from "react";
import { Trophy, Wrench, Telescope, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type PowerRankingEntry } from "@/lib/api";
import { GAME_COLOR_HEX, GAME_COLOR_LABEL_PT } from "@/lib/gundam-catalog";
import { BuildCoreDeckModal, type CoreCardItem } from "@/components/deck/BuildCoreDeckModal";

const FALLBACK_SLICE_COLOR = "#94a3b8";

function vedaKeyFor(entry: PowerRankingEntry): string | null {
  if (!entry.signatureCard) return null;
  return `${entry.signatureCard.code}||${entry.colors.join(",")}`;
}

export function PowerRankingsPanel({ seasonId, setId, onExploreArchetype }: { seasonId: string; setId?: string; onExploreArchetype: (key: string) => void }) {
  const [rankings, setRankings] = useState<PowerRankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [buildingKey, setBuildingKey] = useState<string | null>(null);
  const [buildModal, setBuildModal] = useState<{ archetypeName: string; coreCards: CoreCardItem[]; suggestedCards: CoreCardItem[] } | null>(null);

  useEffect(() => {
    setLoading(true);
    api.getPowerRankings({ seasonId, setId })
      .then((res) => setRankings(res.rankings.slice(0, 10)))
      .catch(() => setRankings([]))
      .finally(() => setLoading(false));
  }, [seasonId, setId]);

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
                  <p className="text-xs text-slate-500">{entry.deckCount} entrada(s){entry.bestPlacement ? ` · melhor colocação: ${entry.bestPlacement}º` : ""}</p>
                </div>

                <div className="flex shrink-0 items-center gap-6 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Meta Share</p>
                    <p className="font-heading text-xl text-white">{Math.round(entry.metaShare * 100)}%</p>
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
