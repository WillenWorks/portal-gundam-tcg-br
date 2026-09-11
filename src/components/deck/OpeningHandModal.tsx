import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import gundamCardBack from "@/assets/gundam-card-back.png";

export interface OpeningHandCard {
  id: string;
  name?: string;
  namePt?: string;
  imageUrl?: string | null;
  imageMediumUrl?: string | null;
  cost?: number;
  quantity: number;
  section?: string;
}

export function buildDeckPopulation<T extends { quantity: number }>(rows: T[]): T[] {
  const population: T[] = [];
  rows.forEach((row) => {
    for (let i = 0; i < (row.quantity || 1); i++) {
      population.push(row);
    }
  });
  return population;
}

export function shuffleDraw<T>(population: T[], count: number): T[] {
  const pool = [...population];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

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

  if (!open) return null;
  const done = revealCount >= hand.length;
  const lowCostHits = hand.filter((card) => (card.cost ?? 99) <= 2).length;
  const turn1Hits = hand.filter((card) => (card.cost ?? 99) <= 1).length;

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
                const isLowCost = (card.cost ?? 99) <= 2;
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
                        {isLowCost ? (
                          <span className="absolute left-1 top-1 rounded-none border border-emerald-400/60 bg-emerald-950/80 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.08em] text-emerald-300">
                            Custo {card.cost}
                          </span>
                        ) : null}
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
              <div className="text-xs text-slate-300">
                {done ? (
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-white">
                      Curva inicial: {lowCostHits} carta(s) de custo ≤ 2
                    </span>
                    {turn1Hits > 0 ? (
                      <span className="text-emerald-400">({turn1Hits} jogável no T1)</span>
                    ) : (
                      <span className="text-amber-400/90">(Sem jogo direto de T1)</span>
                    )}
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
