/* Zero Copilot Drawer — Assistente Tático de Construção de Decks (docs/54, docs/55)
 * Design: Hangar Tático da OZ / Anaheim Electronics
 * Medidor de consistência de abertura (turnos 1 a 3), score global e recomendações de tech cards
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit,
  Sparkles,
  Zap,
  Shield,
  Target,
  Plus,
  Info,
  AlertTriangle,
  Layers,
  X,
  RefreshCw,
} from "lucide-react";

import { api, type ZeroDeckConsistencyResult } from "@/lib/api";
import { Button } from "@/components/ui/button";

export interface DeckCardInput {
  cardCode: string;
  quantity: number;
  cost?: number;
  level?: number;
  cardType?: string;
  isPilot?: boolean;
  color?: string;
  name?: string;
  effect?: string;
  imageUrl?: string;
}

export interface ZeroCopilotDrawerProps {
  open: boolean;
  onClose: () => void;
  deckCards: DeckCardInput[];
  deckName?: string;
  colors?: string[];
  onAddCard?: (cardCode: string) => void;
  onInspectCard?: (cardCode: string) => void;
}

export function ZeroCopilotDrawer({
  open,
  onClose,
  deckCards,
  deckName = "Deck em Edição",
  onAddCard,
  onInspectCard,
}: ZeroCopilotDrawerProps) {
  const [result, setResult] = useState<ZeroDeckConsistencyResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const data = await api.analyzeZeroDeckConsistency(deckCards);
      setResult(data);
    } catch {
      /* fallback já tratado no api.ts */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void runAnalysis();
    }
  }, [open, deckCards]);

  if (!open) return null;

  const totalCards = deckCards.reduce((acc, c) => acc + (Number(c.quantity) || 1), 0);
  const score = result?.score ?? 50;
  const scoreColor =
    score >= 80 ? "text-emerald-400 border-emerald-500" : score >= 65 ? "text-cyan-400 border-cyan-500" : score >= 45 ? "text-amber-400 border-amber-500" : "text-red-400 border-red-500";
  const scoreLabel =
    score >= 80 ? "EXCELENTE" : score >= 65 ? "CONSISTENTE" : score >= 45 ? "REGULAR / MODERADO" : "INSTÁVEL / ALTO RISCO";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop escuro com blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          data-testid="zero-copilot-backdrop"
        />

        {/* Painel do Drawer Hangar OZ */}
        <motion.aside
          data-testid="zero-copilot-drawer"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-cyan-500/30 bg-slate-950/98 text-soft shadow-2xl overflow-hidden panel-cut"
        >
          {/* Cabeçalho do Hangar */}
          <div className="flex items-center justify-between border-b border-cyan-500/20 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-none border border-cyan-400/50 bg-cyan-500/20 text-cyan-300 shadow-sm shadow-cyan-500/30">
                <BrainCircuit className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="font-heading text-sm font-black uppercase tracking-wider text-white">
                    ZERO COPILOT
                  </h2>
                  <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] font-mono px-1.5 py-0.2 font-bold tracking-widest">
                    OZ-AI
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                  Hangar Tático · {deckName} ({totalCards} cartas)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10"
                onClick={runAnalysis}
                disabled={loading}
                title="Recalcular análise"
                aria-label="Recalcular análise"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                onClick={onClose}
                title="Fechar drawer"
                aria-label="Fechar drawer"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Conteúdo rolável */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {/* Score Global de Consistência */}
            <div className="border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-950 p-4 panel-cut flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1">
                  <Sparkles className="size-3 text-cyan-400" />
                  Score de Consistência
                </span>
                <p className={`mt-1 font-heading text-3xl font-black ${scoreColor}`}>
                  {score}<span className="text-sm font-sans font-normal text-slate-400">/100</span>
                </p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300 mt-0.5">
                  {scoreLabel}
                </p>
              </div>

              <div className="text-right">
                <div className="inline-flex items-center gap-1 border border-cyan-500/30 bg-cyan-950/40 px-2 py-1 text-[10px] font-mono text-cyan-300">
                  <Layers className="size-3" />
                  <span>50 cartas alvo</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Cálculo Hipergeométrico</p>
              </div>
            </div>

            {/* Medidor de Abertura nos 3 Primeiros Turnos */}
            <div className="border border-white/10 bg-slate-900/40 p-3.5 panel-cut space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400 flex items-center gap-1">
                  <Target className="size-3" />
                  Consistência de Abertura (Turnos 1 a 3)
                </span>
                <span className="text-[10px] font-mono text-slate-400">Mão de 5 cartas</span>
              </div>

              {/* Turno 1 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 flex items-center gap-1">
                    <span className="font-heading font-bold text-cyan-400">T1:</span> Unidade Lv.1 jogável
                  </span>
                  <span className="font-mono font-bold text-white">
                    {Math.round((result?.turn1UnitChance ?? 0.6) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-none overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-500"
                    style={{ width: `${Math.round((result?.turn1UnitChance ?? 0.6) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Garante presença imediata no Turno 1 sem perder tempo de ação.
                </p>
              </div>

              {/* Turno 2 */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 flex items-center gap-1">
                    <span className="font-heading font-bold text-cyan-400">T2:</span> Unidade Lv.1–2 jogável
                  </span>
                  <span className="font-mono font-bold text-white">
                    {Math.round((result?.turn2UnitChance ?? 0.82) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-none overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-500"
                    style={{ width: `${Math.round((result?.turn2UnitChance ?? 0.82) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Transição suave para o segundo turno e desdobramento da linha de frente.
                </p>
              </div>

              {/* Turno 3 */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 flex items-center gap-1">
                    <span className="font-heading font-bold text-cyan-400">T3:</span> Unidade Lv.1–3 + Piloto
                  </span>
                  <span className="font-mono font-bold text-white">
                    {Math.round((result?.turn3UnitChance ?? 0.72) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-none overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-500"
                    style={{ width: `${Math.round((result?.turn3UnitChance ?? 0.72) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Ativação consistente de habilidades Link e superioridade de AP em combate.
                </p>
              </div>
            </div>

            {/* Diagnósticos da Curva */}
            {result?.diagnostics && result.diagnostics.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 flex items-center gap-1">
                  <Info className="size-3 text-cyan-400" />
                  Diagnóstico da Curva & Alertas
                </span>
                <div className="space-y-1">
                  {result.diagnostics.map((diag, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 border border-white/10 bg-slate-900/60 p-2 text-xs text-slate-300 panel-cut"
                    >
                      <AlertTriangle className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>{diag}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sinergias de Arquétipo */}
            {result?.archetypeSynergies && result.archetypeSynergies.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400 flex items-center gap-1">
                  <Zap className="size-3" />
                  Sinergias & Arquétipos Detectados
                </span>
                <div className="space-y-1.5">
                  {result.archetypeSynergies.map((syn, idx) => (
                    <div key={idx} className="border border-white/10 bg-slate-900/40 p-2.5 panel-cut">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-heading font-bold text-white uppercase tracking-wider">
                          {syn.name}
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-400">{syn.score}%</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-snug">{syn.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recomendações de Tech Cards (Arsenal OZ) */}
            {result?.techCardRecommendations && result.techCardRecommendations.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400 flex items-center gap-1">
                  <Shield className="size-3" />
                  Tech Cards Recomendadas (Arsenal OZ)
                </span>
                <div className="space-y-2">
                  {result.techCardRecommendations.map((tech, idx) => (
                    <div
                      key={idx}
                      className="border border-white/10 bg-slate-900/80 p-2.5 panel-cut hover:border-cyan-500/40 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-cyan-400">{tech.cardCode}</span>
                          <span className="text-xs font-bold text-white">{tech.name}</span>
                        </div>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 border border-amber-500/30 bg-amber-950/40 text-amber-400 panel-cut">
                          {tech.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">{tech.reason}</p>
                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        {onInspectCard && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-slate-400 hover:text-white"
                            onClick={() => onInspectCard(tech.cardCode)}
                          >
                            Ver Carta
                          </Button>
                        )}
                        {onAddCard && (
                          <Button
                            size="sm"
                            className="h-6 text-[10px] bg-cyan-600 hover:bg-cyan-500 text-white rounded-none font-bold uppercase tracking-wider"
                            onClick={() => onAddCard(tech.cardCode)}
                          >
                            <Plus className="size-3 mr-1" />
                            Adicionar ao Deck
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>
  );
}
