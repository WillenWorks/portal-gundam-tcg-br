/* Modal de Seleção de Deck para Partida Rápida (Quick Match Deck Select Modal)
 * Exibida na tela de ambos os pilotos após o aceite da partida rápida.
 * Permite selecionar o deck (Presets oficiais ou Decks válidos do jogador) e envia ao servidor. */
import { useState } from "react";
import { Swords, Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SIMULATOR_DECK_PRESETS } from "@/modules/simulator/content/simulatorDeckPresets";
import { useMySimulatorDecks } from "@/modules/simulator/ui/useMySimulatorDecks";

interface QuickMatchDeckSelectModalProps {
  open: boolean;
  opponentDisplayName?: string;
  opponentUsername?: string;
  opponentConfirmed?: boolean;
  onConfirmDeck: (deckKey: string) => void;
  submitting?: boolean;
  waitingForOpponent?: boolean;
}

export function QuickMatchDeckSelectModal({
  open,
  opponentDisplayName,
  opponentUsername,
  opponentConfirmed,
  onConfirmDeck,
  submitting,
  waitingForOpponent,
}: QuickMatchDeckSelectModalProps) {
  const [selectedDeckKey, setSelectedDeckKey] = useState<string>("ST01");
  const { decks: myDecks } = useMySimulatorDecks();

  const presets = SIMULATOR_DECK_PRESETS;
  const validCustomDecks = myDecks.filter((d) => d.simulatorValid);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeckKey) return;
    onConfirmDeck(selectedDeckKey);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="sm:max-w-lg w-full border-primary/40 bg-slate-950/98 p-5 text-white rounded-none shadow-[0_0_50px_rgba(6,182,212,0.35)] backdrop-blur-md"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-lg uppercase tracking-wider text-primary flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Swords className="size-5 text-primary" /> Selecione seu Deck de Combate
            </span>
            {opponentConfirmed && (
              <Badge className="rounded-none bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-mono text-[9px] uppercase px-1.5 py-0.5">
                Oponente Pronto
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <p className="text-xs text-slate-300">
            Duelo contra <strong className="text-white">{opponentDisplayName || `@${opponentUsername}`}</strong>. Escolha sua lista para iniciar a partida:
          </p>

          <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
            {/* Presets Oficiais */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
                Decks de Demonstração Oficiais
              </span>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => {
                  const isSelected = selectedDeckKey === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      disabled={waitingForOpponent || submitting}
                      onClick={() => setSelectedDeckKey(preset.key)}
                      className={`p-2.5 text-left border rounded-none transition flex flex-col justify-between ${
                        isSelected
                          ? "border-primary bg-primary/20 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                          : "border-white/10 bg-slate-900/60 hover:bg-white/5 text-slate-300"
                      }`}
                    >
                      <span className="font-heading text-xs uppercase tracking-wide truncate block">
                        {preset.label}
                      </span>
                      <span className="text-[10px] font-mono text-primary mt-1 block">
                        {preset.key}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Meus Decks Salvos */}
            {validCustomDecks.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
                  Meus Decks Salvos (Validados no Simulador)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {validCustomDecks.map((deck) => {
                    const isSelected = selectedDeckKey === deck.id;
                    return (
                      <button
                        key={deck.id}
                        type="button"
                        disabled={waitingForOpponent || submitting}
                        onClick={() => setSelectedDeckKey(deck.id)}
                        className={`p-2.5 text-left border rounded-none transition flex flex-col justify-between ${
                          isSelected
                            ? "border-primary bg-primary/20 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                            : "border-white/10 bg-slate-900/60 hover:bg-white/5 text-slate-300"
                        }`}
                      >
                        <span className="font-heading text-xs uppercase tracking-wide truncate block">
                          {deck.name}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 mt-1 block">
                          {deck.format} · Válido
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <div className="text-xs text-slate-400 font-mono">
              {waitingForOpponent ? (
                <span className="flex items-center gap-1.5 text-primary animate-pulse">
                  <Loader2 className="size-3.5 animate-spin" /> Aguardando oponente confirmar deck...
                </span>
              ) : opponentConfirmed ? (
                <span className="text-emerald-400">Oponente já confirmou o deck!</span>
              ) : (
                <span>Ambos devem confirmar para iniciar.</span>
              )}
            </div>

            <Button
              type="submit"
              disabled={submitting || waitingForOpponent || !selectedDeckKey}
              className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-xs uppercase tracking-wider font-semibold px-4"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" /> Confirmando...
                </>
              ) : waitingForOpponent ? (
                "Deck Confirmado"
              ) : (
                <>
                  <Check className="size-3.5 mr-1.5" /> Confirmar Deck
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
