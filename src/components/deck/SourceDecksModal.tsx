import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Database, Trophy } from "lucide-react";
import type { SourceDeckEntry } from "@/lib/api";

interface SourceDecksModalProps {
  open: boolean;
  onClose: () => void;
  archetypeName: string;
  sourceDecks: SourceDeckEntry[];
}

export function SourceDecksModal({
  open,
  onClose,
  archetypeName,
  sourceDecks,
}: SourceDecksModalProps) {
  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="sm:max-w-2xl max-h-[85vh] overflow-y-auto border-white/10 bg-slate-950 text-white panel-cut"
      >
        <div className="border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-primary">
            <Database className="size-4 text-primary" />
            <span>Amostra de Decks do Metagame</span>
          </div>
          <DialogTitle className="mt-1 font-heading text-2xl uppercase heading-portal">
            Base Analítica: {archetypeName || "Decks Registrados"}
          </DialogTitle>
          <p className="mt-1 text-xs text-muted-portal">
            Total de {sourceDecks.length} deck(s) cadastrados utilizados como base estatística para as taxas de inclusão, staples e média de cópias.
          </p>
        </div>

        <div className="space-y-2 mt-3">
          {sourceDecks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-portal">
              Nenhum deck específico listado na amostra atual.
            </p>
          ) : (
            sourceDecks.map((deck, idx) => (
              <div
                key={deck.id || idx}
                className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-slate-900/60 p-3 panel-cut hover:border-primary/40 transition"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex size-9 shrink-0 items-center justify-center border border-white/10 bg-slate-950 text-xs font-mono font-bold text-primary">
                    {deck.placement?.includes("1") || idx === 0 ? (
                      <Trophy className="size-4 text-amber-400" />
                    ) : (
                      deck.placement ? `${deck.placement}º` : `#${idx + 1}`
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{deck.name}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 font-mono">
                      <span>Piloto: {deck.author}</span>
                      {deck.tournament && (
                        <>
                          <span>·</span>
                          <span className="text-primary font-medium">{deck.tournament}</span>
                        </>
                      )}
                      {deck.tier && (
                        <>
                          <span>·</span>
                          <span className="rounded-none border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                            {deck.tier}
                          </span>
                        </>
                      )}
                      {deck.organizer && (
                        <>
                          <span>·</span>
                          <span className="text-slate-300">Org: {deck.organizer}</span>
                        </>
                      )}
                      {(deck.date || deck.tournamentDate) && (
                        <>
                          <span>·</span>
                          <span>{new Date(deck.date || deck.tournamentDate!).toLocaleDateString("pt-BR")}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {deck.sourceUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-none border-primary/30 bg-primary/10 text-xs text-primary hover:bg-primary/20 hover:text-white"
                      asChild
                    >
                      <a href={deck.sourceUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3.5 mr-1" />
                        Fonte Oficial
                      </a>
                    </Button>
                  )}
                  {deck.shareId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0 rounded-none border-white/15 bg-white/5 text-xs text-slate-200 hover:text-white"
                      asChild
                    >
                      <a href={`#/deck/${deck.shareId}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3.5 mr-1" />
                        Ver Deck
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end border-t border-white/10 pt-4 mt-4">
          <Button
            type="button"
            variant="outline"
            className="rounded-none border-white/15 bg-white/5 text-white hover:bg-white/10"
            onClick={onClose}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
