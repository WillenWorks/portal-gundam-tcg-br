import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import gundamCardBack from "@/assets/gundam-card-back.png";
import { buildDeckPopulation, shuffleDraw } from "@/lib/deck-sampling";
import { earliestPlayableTurn, evaluateOpeningHandAgainstDeck, scoreOpeningHand, type HandVerdict } from "@/lib/opening-hand-score";

export interface OpeningHandCard {
  id: string;
  name?: string;
  namePt?: string;
  imageUrl?: string | null;
  imageMediumUrl?: string | null;
  cost?: number;
  level?: number | null;
  type?: string | null;
  cardType?: string | null;
  quantity: number;
  section?: string;
}

export { buildDeckPopulation, shuffleDraw };

const VERDICT_STYLE: Record<HandVerdict, { label: string; className: string }> = {
  MULLIGAN: { label: "Sugestão: Mulligan", className: "text-red-400" },
  SITUACIONAL: { label: "Sugestão: situacional", className: "text-amber-400/90" },
  MANTER: { label: "Sugestão: Manter", className: "text-emerald-400" },
};

interface OpeningHandModalProps {
  open: boolean;
  onClose: () => void;
  cards: OpeningHandCard[];
}

export function OpeningHandModal({ open, onClose, cards }: OpeningHandModalProps) {
  const [hand, setHand] = useState<OpeningHandCard[]>([]);
  const [revealCount, setRevealCount] = useState(0);
  const [round, setRound] = useState(0);

  const mainRows = useMemo(() => {
    return cards.filter((c) => !c.section || c.section === "main");
  }, [cards]);

  const population = useMemo(() => buildDeckPopulation(mainRows), [mainRows]);

  const draw = () => {
    setHand(shuffleDraw(population, Math.min(5, population.length)));
    setRound((r) => r + 1);
  };

  useEffect(() => {
    if (open) draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!hand.length) return;
    setRevealCount(0);
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setRevealCount(i);
      if (i >= hand.length) window.clearInterval(timer);
    }, 320);
    return () => window.clearInterval(timer);
  }, [round, hand.length]);

  // Nota de Abertura real (custo + nível + tipo) e comparação estatística contra o
  // próprio deck -- ver src/lib/opening-hand-score.ts pro motivo de não usar mais só
  // "custo <= 1" pra decidir se a mão é jogável no T1.
  const handBreakdown = useMemo(() => scoreOpeningHand(hand), [hand]);
  const done = revealCount >= hand.length;
  const verdict = useMemo(() => (done && hand.length ? evaluateOpeningHandAgainstDeck(hand, mainRows) : null), [done, hand, mainRows]);

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-3xl border-white/10 bg-slate-950 text-white shadow-2xl">
        <div className="border-b border-white/10 pb-3">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-primary">Diretriz Tática OZ · Simulação de Curva</p>
          <DialogTitle className="font-heading text-2xl uppercase tracking-wider text-white">Simulador de Mão Inicial (Draw)</DialogTitle>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            5 cartas sorteadas da população do deck principal (amostra sem reposição). Sortear novamente simula tanto uma nova partida quanto o Mulligan oficial da regra do Gundam Card Game.
          </p>
        </div>

        {population.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">O deck principal não possui cartas para sortear.</p>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-3 py-6">
              {hand.map((card, index) => {
                const revealed = index < revealCount;
                const image = card.imageMediumUrl || card.imageUrl;
                const earliestTurn = earliestPlayableTurn(card);
                const isEarlyBoardCard = ["UNIT", "BASE"].includes((card.type || card.cardType || "").toUpperCase()) && earliestTurn <= 2;
                return (
                  <motion.div
                    key={`${round}-${index}`}
                    initial={{ opacity: 0, y: 24, scale: 0.88 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: index * 0.08, duration: 0.28, ease: "easeOut" }}
                    className="h-[196px] w-[140px] shrink-0"
                    style={{ perspective: 800 }}
                  >
                    <motion.div
                      className="relative h-full w-full rounded-md shadow-md"
                      animate={{ rotateY: revealed ? 180 : 0 }}
                      transition={{ duration: 0.38, ease: "easeInOut", delay: revealed ? index * 0.08 : 0 }}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <div className="absolute inset-0 overflow-hidden rounded-md border border-primary/30 bg-slate-900" style={{ backfaceVisibility: "hidden" }}>
                        <img src={gundamCardBack} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="absolute inset-0 overflow-hidden rounded-md border border-white/15 bg-slate-950/80" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                        {image ? <img src={image} alt={card.namePt || card.name || "Carta"} className="h-full w-full object-cover" /> : null}
                        <span
                          className={`absolute left-1 top-1 rounded-none border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.08em] ${
                            isEarlyBoardCard ? "border-emerald-400/60 bg-emerald-950/80 text-emerald-300" : "border-white/20 bg-slate-950/80 text-slate-400"
                          }`}
                        >
                          T{Math.max(earliestTurn, 1)} · {(card.type || card.cardType || "?").slice(0, 4)}
                        </span>
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
              <div className="text-xs text-slate-300">
                {done && verdict ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium text-white">Nota de Abertura: {handBreakdown.score}/100</span>
                    <span className="text-slate-500">
                      (média do deck: {verdict.deckMeanScore} · percentil {verdict.percentile})
                    </span>
                    <span className={`font-semibold ${VERDICT_STYLE[verdict.verdict].className}`}>{VERDICT_STYLE[verdict.verdict].label}</span>
                    <span className="w-full text-[11px] text-slate-500">
                      {handBreakdown.earlyUnitCount} Unidade(s) e {handBreakdown.earlyBoardCount - handBreakdown.earlyUnitCount} Base(s) jogável(is) até o T2
                      {handBreakdown.supportOnlyCount ? ` · ${handBreakdown.supportOnlyCount} Piloto/Comando sem desenvolvimento de campo próprio` : ""}
                    </span>
                  </div>
                ) : (
                  <span className="animate-pulse text-cyan-400">Embaralhando e comprando cartas...</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" className="border-white/20 text-xs uppercase tracking-wider" onClick={draw}>
                  Comprar Novamente (Mulligan)
                </Button>
                <Button variant="ghost" className="text-xs uppercase tracking-wider text-slate-400 hover:text-white" onClick={onClose}>
                  Fechar
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
