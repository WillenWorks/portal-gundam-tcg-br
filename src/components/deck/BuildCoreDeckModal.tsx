import { useMemo } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, ArrowRight, ShieldCheck, Wrench, Layers } from "lucide-react";
import { getCardMetagameTier, type MetagameTier } from "@/lib/deck-analytics-engine";

export interface CoreCardItem {
  id: string;
  code: string;
  name: string;
  namePt?: string | null;
  imageUrl?: string | null;
  imageMediumUrl?: string | null;
  color?: string | null;
  cost?: number | null;
  level?: number | null;
  type?: string | null;
  presenceRate: number;
  recommendedCopies: number;
  tier?: MetagameTier;
}

interface BuildCoreDeckModalProps {
  open: boolean;
  onClose: () => void;
  archetypeName: string;
  coreCards: CoreCardItem[];
  suggestedCards?: CoreCardItem[];
}

export function BuildCoreDeckModal({
  open,
  onClose,
  archetypeName,
  coreCards,
  suggestedCards = [],
}: BuildCoreDeckModalProps) {
  const [, navigate] = useLocation();

  const totalCoreCopies = useMemo(
    () => coreCards.reduce((sum, c) => sum + (c.recommendedCopies || 1), 0),
    [coreCards]
  );

  const progressPct = Math.min(100, Math.round((totalCoreCopies / 50) * 100));

  const handleBuildInDeckbuilder = () => {
    // Monta o rascunho com o núcleo matemático no formato do Deckbuilder
    const entries = coreCards.map((c) => ({
      cardId: c.id,
      quantity: c.recommendedCopies || 1,
      section: "main",
    }));

    const draft = {
      deckName: `Núcleo: ${archetypeName || "Arquétipo Base"}`,
      visibility: "PRIVATE",
      entries,
    };

    localStorage.setItem("gundam_deckbuilder_draft", JSON.stringify(draft));
    onClose();
    navigate("/deckbuilder/new");
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-3xl max-h-[90vh] overflow-y-auto border-white/10 bg-slate-950 text-white panel-cut"
      >
        <div className="border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-primary">
            <Sparkles className="size-4 text-primary animate-pulse" />
            <span>Engenharia Reversa de Metagame · VEDA</span>
          </div>
          <DialogTitle className="mt-1 font-heading text-2xl sm:text-3xl uppercase heading-portal">
            Estrutura do Núcleo: {archetypeName || "Arquétipo"}
          </DialogTitle>
          <p className="mt-1 text-xs text-muted-portal leading-relaxed">
            Com base em decks competitivos cadastrados, calculamos as cartas com taxa de inclusão indispensável (≥50%) para iniciar a montagem da lista com consistência máxima.
          </p>
        </div>

        {/* Barra de Progresso do Núcleo */}
        <div className="panel-cut border border-primary/30 bg-primary/10 p-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span className="text-xs uppercase tracking-[0.18em] font-heading text-white">
                Slots do Deck Principal Mapeados
              </span>
            </div>
            <span className="font-heading text-lg text-primary font-mono">
              {totalCoreCopies} <span className="text-xs text-slate-400 font-sans">/ 50 cartas</span> ({progressPct}%)
            </span>
          </div>
          <Progress value={progressPct} className="h-2.5 rounded-none bg-slate-900" />
          <p className="mt-2 text-[11px] text-slate-400">
            {50 - totalCoreCopies > 0
              ? `Faltam ${50 - totalCoreCopies} slots flexíveis para completar os 50 slots obrigatórios do deck principal. Veja sugestões táticas abaixo.`
              : "Núcleo completo com 50 cartas definidas."}
          </p>
        </div>

        {/* Lista de Cartas do Núcleo (≥ 50%) */}
        <div className="space-y-3 mt-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400 border-b border-white/5 pb-1">
            <ShieldCheck className="size-4 text-emerald-400" />
            <span>Cartas do Núcleo Essencial ({coreCards.length} cartas · {totalCoreCopies} cópias)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {coreCards.map((c) => {
              const tier = getCardMetagameTier(c.presenceRate);
              const image = c.imageMediumUrl || c.imageUrl;

              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 border border-white/10 bg-slate-900/60 p-2.5 panel-cut hover:border-primary/40 transition"
                >
                  <div className="h-14 w-10 shrink-0 overflow-hidden border border-white/10 bg-slate-950">
                    {image ? (
                      <img src={image} alt={c.namePt || c.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full flex items-center justify-center text-[8px] text-slate-600 font-mono">N/A</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs sm:text-sm font-medium text-white">{c.namePt || c.name}</p>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 mt-0.5">
                      <span>{c.code}</span>
                      <span>·</span>
                      <span className="text-primary font-semibold">{c.presenceRate.toFixed(1)}% presença</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block px-2 py-1 bg-primary/20 border border-primary/40 text-primary font-heading font-bold text-sm">
                      {c.recommendedCopies}x
                    </span>
                    <p className="text-[10px] uppercase font-mono text-emerald-400 mt-0.5">{tier.label.split(" / ")[0]}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sugestões de Preenchimento / Flex (25% - 49%) */}
        {suggestedCards.length > 0 && (
          <div className="space-y-3 mt-6">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400 border-b border-white/5 pb-1">
              <Wrench className="size-4 text-sky-400" />
              <span>Opções Táticas Recomendadas para Preencher os Slots ({suggestedCards.length} sugestões)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {suggestedCards.map((c) => {
                const tier = getCardMetagameTier(c.presenceRate);
                const image = c.imageMediumUrl || c.imageUrl;

                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 border border-white/5 bg-slate-900/30 p-2 panel-cut hover:border-sky-500/40 transition"
                  >
                    <div className="h-12 w-9 shrink-0 overflow-hidden border border-white/10 bg-slate-950">
                      {image ? (
                        <img src={image} alt={c.namePt || c.name} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-300">{c.namePt || c.name}</p>
                      <p className="text-[10px] font-mono text-slate-400">
                        {c.code} · <span className="text-sky-400">{c.presenceRate.toFixed(1)}% presença</span> (média {c.recommendedCopies}x)
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 border uppercase font-mono ${tier.badgeClass}`}>
                      {tier.label.split(" / ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rodapé e CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 pt-4 mt-6">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10"
            onClick={onClose}
          >
            Fechar
          </Button>

          <Button
            type="button"
            className="w-full sm:w-auto rounded-none bg-primary text-primary-foreground font-heading uppercase tracking-wider text-sm px-6 hover:bg-primary/90 shadow-lg shadow-primary/20 flex items-center gap-2"
            onClick={handleBuildInDeckbuilder}
          >
            <span>Montar Núcleo no Hangar OZ</span>
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
