/* Modal de Seleção de Deck para Partida Rápida (Quick Match Deck Select Modal)
 * Exibida na tela de ambos os pilotos após o aceite da partida rápida.
 * Permite selecionar apenas os decks cadastrados pelo jogador e envia ao servidor. */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Swords, Check, Loader2, CircleCheck, CircleX, PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMySimulatorDecks } from "@/modules/simulator/ui/useMySimulatorDecks";
import { SimulatorDeckCoverageNotice } from "@/modules/simulator/ui/SimulatorDeckCoverageNotice";

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
  const [selectedDeckKey, setSelectedDeckKey] = useState<string>("");
  const { decks: myDecks, loading: myDecksLoading } = useMySimulatorDecks();

  useEffect(() => {
    if (!open || myDecksLoading) return;
    if (myDecks.length === 0) {
      setSelectedDeckKey("");
      return;
    }
    if (!selectedDeckKey || !myDecks.some((d) => d.id === selectedDeckKey)) {
      const firstValid = myDecks.find((d) => d.simulatorValid) ?? myDecks[0];
      if (firstValid) setSelectedDeckKey(firstValid.id);
    }
  }, [open, myDecks, myDecksLoading, selectedDeckKey]);

  const selectedDeck = myDecks.find((d) => d.id === selectedDeckKey);
  const isSelectedValid = Boolean(selectedDeck && selectedDeck.simulatorValid);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeckKey || !isSelectedValid) return;
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

          <div className="space-y-3">
            {myDecksLoading ? (
              <p className="text-xs text-slate-400 py-2">Carregando seus decks…</p>
            ) : myDecks.length === 0 ? (
              <div className="rounded-none border border-primary/30 bg-slate-900/60 p-4 space-y-2.5 text-xs text-slate-300">
                <p>Você ainda não possui nenhum deck cadastrado no seu Hangar para jogar partidas PvP.</p>
                <Link
                  href="/deckbuilder"
                  className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-primary hover:underline"
                >
                  <PlusCircle className="size-3.5" />
                  Montar um deck no Deckbuilder
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
                  Meus Decks Salvos
                </span>
                <Select
                  value={selectedDeckKey}
                  onValueChange={setSelectedDeckKey}
                  disabled={waitingForOpponent || submitting}
                >
                  <SelectTrigger className="w-full h-11 border border-white/15 bg-slate-900/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white focus:border-primary focus:ring-1 focus:ring-primary rounded-none">
                    <SelectValue placeholder="Selecione seu deck" />
                  </SelectTrigger>
                  <SelectContent className="border border-white/15 bg-slate-950/98 text-white shadow-2xl z-50">
                    <SelectGroup>
                      <SelectLabel className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                        Meus Decks Salvos
                      </SelectLabel>
                      {myDecks.map((deck) => (
                        <SelectItem
                          key={deck.id}
                          value={deck.id}
                          disabled={!deck.simulatorValid}
                          className="cursor-pointer py-2 px-3 text-xs uppercase tracking-wide focus:bg-primary/20 focus:text-primary"
                        >
                          <span className="flex items-center gap-1.5">
                            {deck.simulatorValid ? (
                              <CircleCheck className="size-3 shrink-0 text-emerald-400" />
                            ) : (
                              <CircleX className="size-3 shrink-0 text-red-400" />
                            )}
                            <span>{deck.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              ({deck.format}{!deck.simulatorValid ? " · Sem cobertura" : ""})
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedDeck && !selectedDeck.simulatorValid ? <SimulatorDeckCoverageNotice deck={selectedDeck} /> : null}
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
              disabled={submitting || waitingForOpponent || !isSelectedValid}
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
