import { useState, useMemo, useEffect } from "react";
import {
  Clock,
  ShieldAlert,
  ShieldCheck,
  ArrowLeftRight,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Radio,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlayerId, CardDef } from "@/modules/simulator/engine/types";
import {
  validateDeckWithSideboard,
  type DeckListWithSideboard,
  type SideboardSwapRequest,
} from "@/modules/simulator/engine/sideboard";
import type { ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";
import { sfx } from "@/modules/simulator/audio/soundEffects";

export interface SideboardModalProps {
  matchId: string;
  seat: PlayerId;
  initialDeck?: DeckListWithSideboard;
  sideboardDeadlineAt?: number | null;
  sideboardConfirmed?: Partial<Record<PlayerId, boolean>>;
  bo3Score?: { A: number; B: number };
  currentGameIndex?: number;
  art: ArtLookup;
  busy?: boolean;
  onConfirmSwaps: (swaps: SideboardSwapRequest) => void | Promise<void>;
  onInspectCard?: (code: string) => void;
}

export function SideboardModal({
  matchId: _matchId,
  seat,
  initialDeck,
  sideboardDeadlineAt,
  sideboardConfirmed,
  bo3Score = { A: 0, B: 0 },
  currentGameIndex = 2,
  art,
  busy = false,
  onConfirmSwaps,
  onInspectCard,
}: SideboardModalProps) {
  // Lista de códigos retirados do Main e inseridos do Sideboard
  const [mainOut, setMainOut] = useState<string[]>([]);
  const [sideIn, setSideIn] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(180);

  // Jogador já confirmou?
  const isConfirmed = Boolean(sideboardConfirmed?.[seat]);
  const oppSeat: PlayerId = seat === "A" ? "B" : "A";
  const oppConfirmed = Boolean(sideboardConfirmed?.[oppSeat]);

  // Cronômetro regressivo baseado em sideboardDeadlineAt
  useEffect(() => {
    if (!sideboardDeadlineAt) {
      setTimeLeft(180);
      return;
    }

    const updateTimer = () => {
      const remainingMs = Math.max(0, sideboardDeadlineAt - Date.now());
      setTimeLeft(Math.ceil(remainingMs / 1000));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);
    return () => clearInterval(interval);
  }, [sideboardDeadlineAt]);

  // Decks originais (fallback caso venha vazio)
  const baseMain = useMemo(() => initialDeck?.main ?? [], [initialDeck]);
  const baseSide = useMemo(() => initialDeck?.sideboard ?? [], [initialDeck]);
  const baseResources = useMemo(() => initialDeck?.resources ?? [], [initialDeck]);

  // Constrói o deck simulado com as trocas aplicadas
  const simulatedDeck: DeckListWithSideboard = useMemo(() => {
    const currentMain = [...baseMain];
    const currentSide = [...baseSide];

    // Remove do main as cartas em mainOut e adiciona ao side
    const movedToSide: CardDef[] = [];
    for (const code of mainOut) {
      const idx = currentMain.findIndex((c) => c.code === code);
      if (idx !== -1) {
        const [card] = currentMain.splice(idx, 1);
        movedToSide.push(card);
      }
    }

    // Remove do side as cartas em sideIn e adiciona ao main
    const movedToMain: CardDef[] = [];
    for (const code of sideIn) {
      const idx = currentSide.findIndex((c) => c.code === code);
      if (idx !== -1) {
        const [card] = currentSide.splice(idx, 1);
        movedToMain.push(card);
      }
    }

    return {
      main: [...currentMain, ...movedToMain],
      sideboard: [...currentSide, ...movedToSide],
      resources: baseResources,
    };
  }, [baseMain, baseSide, baseResources, mainOut, sideIn]);

  // Validação em tempo real
  const validation = useMemo(() => {
    return validateDeckWithSideboard(simulatedDeck);
  }, [simulatedDeck]);

  // Agrupamento de cartas no Main Deck original para listagem amigável
  const groupedMain = useMemo(() => {
    const map = new Map<string, { card: CardDef; initialCount: number }>();
    for (const c of baseMain) {
      const existing = map.get(c.code);
      if (existing) {
        existing.initialCount += 1;
      } else {
        map.set(c.code, { card: c, initialCount: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.card.code.localeCompare(b.card.code));
  }, [baseMain]);

  // Agrupamento de cartas no Sideboard original para listagem amigável
  const groupedSide = useMemo(() => {
    const map = new Map<string, { card: CardDef; initialCount: number }>();
    for (const c of baseSide) {
      const existing = map.get(c.code);
      if (existing) {
        existing.initialCount += 1;
      } else {
        map.set(c.code, { card: c, initialCount: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.card.code.localeCompare(b.card.code));
  }, [baseSide]);

  // Contagem de retiradas e entradas por código
  const mainOutCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const code of mainOut) counts[code] = (counts[code] ?? 0) + 1;
    return counts;
  }, [mainOut]);

  const sideInCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const code of sideIn) counts[code] = (counts[code] ?? 0) + 1;
    return counts;
  }, [sideIn]);

  // Ações de swap
  const handleMarkMainOut = (code: string) => {
    if (isConfirmed) return;
    const initialItem = groupedMain.find((g) => g.card.code === code);
    const initialCount = initialItem?.initialCount ?? 0;
    const currentOut = mainOutCounts[code] ?? 0;
    if (currentOut < initialCount) {
      sfx?.playClick?.();
      setMainOut((prev) => [...prev, code]);
    }
  };

  const handleUnmarkMainOut = (code: string) => {
    if (isConfirmed) return;
    const idx = mainOut.lastIndexOf(code);
    if (idx !== -1) {
      sfx?.playClick?.();
      setMainOut((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const handleMarkSideIn = (code: string) => {
    if (isConfirmed) return;
    const initialItem = groupedSide.find((g) => g.card.code === code);
    const initialCount = initialItem?.initialCount ?? 0;
    const currentIn = sideInCounts[code] ?? 0;
    if (currentIn < initialCount) {
      sfx?.playClick?.();
      setSideIn((prev) => [...prev, code]);
    }
  };

  const handleUnmarkSideIn = (code: string) => {
    if (isConfirmed) return;
    const idx = sideIn.lastIndexOf(code);
    if (idx !== -1) {
      sfx?.playClick?.();
      setSideIn((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const handleReset = () => {
    if (isConfirmed) return;
    sfx?.playClick?.();
    setMainOut([]);
    setSideIn([]);
  };

  const handleConfirm = () => {
    if (isConfirmed || busy) return;
    sfx?.playClick?.();
    onConfirmSwaps({ mainOut, sideIn });
  };

  // Formata o cronômetro MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const isTimerCritical = timeLeft <= 30;
  const isSwapBalanced = mainOut.length === sideIn.length;
  const canConfirm = !isConfirmed && validation.valid && isSwapBalanced;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="panel-cut relative flex flex-col w-full max-w-5xl max-h-[95vh] bg-slate-950 border-2 border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.15)] text-slate-100 overflow-hidden">
        {/* Linha decorativa de topo militar */}
        <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-amber-400 to-cyan-500" />

        {/* Cabeçalho Tático */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900/90 border-b border-cyan-500/20">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-sm bg-cyan-950/80 border border-cyan-400/40 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
              <Layers className="size-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">
                  HANGAR TÁTICO ANAHEIM
                </span>
                <Badge variant="outline" className="border-amber-400/60 bg-amber-950/30 text-amber-300 font-mono text-[10px] uppercase">
                  Bo3 // Jogo {currentGameIndex}
                </Badge>
              </div>
              <h2 className="text-lg font-black tracking-wider uppercase text-white drop-shadow">
                Fase de Sideboard Tático
              </h2>
            </div>
          </div>

          {/* Placar e Timer */}
          <div className="flex items-center gap-4">
            {/* Placar */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">Placar da Série</span>
              <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-white bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                <span className={cn(bo3Score.A > bo3Score.B ? "text-cyan-400" : "text-slate-300")}>
                  P1: {bo3Score.A}
                </span>
                <span className="text-slate-500">x</span>
                <span className={cn(bo3Score.B > bo3Score.A ? "text-cyan-400" : "text-slate-300")}>
                  P2: {bo3Score.B}
                </span>
              </div>
            </div>

            {/* Cronômetro */}
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-sm border font-mono tracking-wider transition-colors",
                isTimerCritical
                  ? "bg-red-950/70 border-red-500/80 text-red-300 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                  : "bg-slate-900 border-cyan-400/40 text-cyan-300"
              )}
            >
              <Clock className={cn("size-4", isTimerCritical ? "text-red-400" : "text-cyan-400")} />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-tighter opacity-70 leading-none">Tempo Restante</span>
                <span className="text-base font-black leading-none mt-0.5">{formatTimer(timeLeft)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Telemetria e Validação de Regras */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Status de Main Deck */}
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-slate-400 uppercase tracking-wider text-[11px]">Main Deck:</span>
              <span
                className={cn(
                  "font-bold px-1.5 py-0.5 rounded text-[11px]",
                  simulatedDeck.main.length === 50
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                    : "bg-red-950/80 text-red-300 border border-red-500/40"
                )}
              >
                {simulatedDeck.main.length}/50
              </span>
            </div>

            {/* Status de Sideboard */}
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-slate-400 uppercase tracking-wider text-[11px]">Sideboard:</span>
              <span
                className={cn(
                  "font-bold px-1.5 py-0.5 rounded text-[11px]",
                  simulatedDeck.sideboard.length <= 10
                    ? "bg-cyan-950/80 text-cyan-300 border border-cyan-500/40"
                    : "bg-red-950/80 text-red-300 border border-red-500/40"
                )}
              >
                {simulatedDeck.sideboard.length}/10
              </span>
            </div>

            {/* Cores Ativas */}
            <div className="flex items-center gap-1 font-mono">
              <span className="text-slate-400 uppercase tracking-wider text-[11px]">Cores:</span>
              <div className="flex gap-1">
                {validation.colors.map((color) => (
                  <Badge
                    key={color}
                    variant="outline"
                    className="border-slate-700 bg-slate-800/90 text-[10px] text-cyan-300 uppercase py-0"
                  >
                    {color}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Balanço de Trocas */}
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <ArrowLeftRight className="size-3.5 text-amber-400" />
              <span className="text-slate-400">Trocas:</span>
              <span className={cn("font-bold", isSwapBalanced ? "text-cyan-300" : "text-amber-400")}>
                {mainOut.length} fora ⇄ {sideIn.length} dentro
              </span>
            </div>
          </div>

          {/* Status de Validação Global */}
          <div className="flex items-center gap-2">
            {validation.valid ? (
              <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px] font-bold">
                <ShieldCheck className="size-4" />
                <span>DECK LEGALIZADO</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[11px] font-bold">
                <ShieldAlert className="size-4" />
                <span>{validation.errors[0]?.message ?? "DECK INVÁLIDO"}</span>
              </div>
            )}
          </div>
        </div>

        {/* Estado: "Aguardando confirmação do oponente" Overlay */}
        {isConfirmed && (
          <div className="p-4 bg-cyan-950/40 border-b border-cyan-500/30 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 animate-spin">
                <Radio className="size-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-cyan-200 tracking-wide uppercase">
                  Suas trocas foram transmitidas com sucesso!
                </p>
                <p className="text-xs text-cyan-400/80 font-mono">
                  {oppConfirmed
                    ? "Ambos os jogadores confirmaram. Iniciando próximo jogo..."
                    : "Aguardando confirmação tática do oponente ou fim dos 180s..."}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-cyan-400/50 bg-cyan-900/40 text-cyan-300 font-mono text-xs uppercase px-3 py-1">
              Pronto para a Batalha
            </Badge>
          </div>
        )}

        {/* Conteúdo Principal: 2 Colunas (Main Deck à Esquerda, Sideboard à Direita) */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800/80 flex-1 overflow-y-auto p-4 gap-4">
          {/* Coluna Esquerda: Main Deck */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold tracking-widest uppercase text-cyan-400">
                  Main Deck Atual
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  ({baseMain.length} cartas base)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Clique na carta para retirar pro Sideboard
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto pr-1">
              {groupedMain.map(({ card, initialCount }) => {
                const outCount = mainOutCounts[card.code] ?? 0;
                const remainingCount = initialCount - outCount;
                const isAllOut = remainingCount === 0;

                return (
                  <div
                    key={card.code}
                    className={cn(
                      "group relative flex flex-col p-1.5 rounded-sm border transition-all text-left bg-slate-900/80 select-none",
                      outCount > 0
                        ? "border-amber-500/50 bg-amber-950/20 shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                        : "border-slate-800 hover:border-cyan-500/40 hover:bg-slate-800/50",
                      isAllOut && "opacity-50"
                    )}
                  >
                    <div className="flex gap-2 items-start">
                      <div
                        className="cursor-pointer shrink-0"
                        onClick={() => onInspectCard?.(card.code)}
                        title="Inspecionar carta"
                      >
                        <CardFace
                          code={card.code}
                          nameEn={card.nameEn}
                          art={art}
                          size="sm"
                          dimmed={isAllOut}
                          className="w-12 h-auto rounded-none border border-slate-700/60"
                        />
                      </div>

                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-[10px] font-mono text-cyan-400 font-bold truncate">
                          {card.code}
                        </span>
                        <span className="text-xs font-semibold text-slate-200 truncate leading-snug">
                          {card.nameEn}
                        </span>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge variant="outline" className="text-[9px] py-0 px-1 border-slate-700 bg-slate-800 text-slate-300">
                            {card.cardType}
                          </Badge>
                          {card.cost !== undefined && (
                            <span className="text-[9px] font-mono text-amber-300 bg-amber-950/60 px-1 rounded border border-amber-500/30">
                              C:{card.cost}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Controles de Swap */}
                    <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-1 font-mono text-[10px]">
                        <span className="text-slate-400">Qtd:</span>
                        <span className="font-bold text-white">{remainingCount}x</span>
                        {outCount > 0 && (
                          <span className="text-amber-400 font-bold">(-{outCount})</span>
                        )}
                      </div>

                      {!isConfirmed && (
                        <div className="flex items-center gap-1">
                          {outCount > 0 && (
                            <button
                              type="button"
                              onClick={() => handleUnmarkMainOut(card.code)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                              title="Desfazer retirada"
                            >
                              <Plus className="size-3" />
                            </button>
                          )}
                          {remainingCount > 0 && (
                            <button
                              type="button"
                              onClick={() => handleMarkMainOut(card.code)}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold"
                              title="Retirar para o Sideboard"
                            >
                              <Minus className="size-3" />
                              <span>SIDE</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coluna Direita: Sideboard */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold tracking-widest uppercase text-cyan-400">
                  Sideboard Disponível
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  ({baseSide.length} cartas)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Clique na carta para subir ao Main Deck
              </span>
            </div>

            {groupedSide.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-slate-800 rounded bg-slate-900/40">
                <AlertTriangle className="size-8 text-amber-400/60 mb-2" />
                <p className="text-sm font-bold text-slate-300">Nenhum Sideboard Registrado</p>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Este deck não possui cartas de sideboard reservadas. O formato Bo3 seguirá com a lista principal inalterada.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto pr-1">
                {groupedSide.map(({ card, initialCount }) => {
                  const inCount = sideInCounts[card.code] ?? 0;
                  const remainingCount = initialCount - inCount;
                  const isAllIn = remainingCount === 0;

                  return (
                    <div
                      key={card.code}
                      className={cn(
                        "group relative flex flex-col p-1.5 rounded-sm border transition-all text-left bg-slate-900/80 select-none",
                        inCount > 0
                          ? "border-cyan-500/60 bg-cyan-950/20 shadow-[0_0_8px_rgba(6,182,212,0.15)]"
                          : "border-slate-800 hover:border-cyan-500/40 hover:bg-slate-800/50",
                        isAllIn && "opacity-50"
                      )}
                    >
                      <div className="flex gap-2 items-start">
                        <div
                          className="cursor-pointer shrink-0"
                          onClick={() => onInspectCard?.(card.code)}
                          title="Inspecionar carta"
                        >
                          <CardFace
                            code={card.code}
                            nameEn={card.nameEn}
                            art={art}
                            size="sm"
                            dimmed={isAllIn}
                            className="w-12 h-auto rounded-none border border-slate-700/60"
                          />
                        </div>

                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-[10px] font-mono text-cyan-400 font-bold truncate">
                            {card.code}
                          </span>
                          <span className="text-xs font-semibold text-slate-200 truncate leading-snug">
                            {card.nameEn}
                          </span>
                          <div className="flex items-center gap-1 mt-1">
                            <Badge variant="outline" className="text-[9px] py-0 px-1 border-slate-700 bg-slate-800 text-slate-300">
                              {card.cardType}
                            </Badge>
                            {card.cost !== undefined && (
                              <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950/60 px-1 rounded border border-cyan-500/30">
                                C:{card.cost}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Controles de Swap */}
                      <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
                        <div className="flex items-center gap-1 font-mono text-[10px]">
                          <span className="text-slate-400">Side:</span>
                          <span className="font-bold text-white">{remainingCount}x</span>
                          {inCount > 0 && (
                            <span className="text-cyan-400 font-bold">(+{inCount})</span>
                          )}
                        </div>

                        {!isConfirmed && (
                          <div className="flex items-center gap-1">
                            {inCount > 0 && (
                              <button
                                type="button"
                                onClick={() => handleUnmarkSideIn(card.code)}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                                title="Desfazer adição ao main"
                              >
                                <Minus className="size-3" />
                              </button>
                            )}
                            {remainingCount > 0 && (
                              <button
                                type="button"
                                onClick={() => handleMarkSideIn(card.code)}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-bold"
                                title="Mover para o Main Deck"
                              >
                                <Plus className="size-3" />
                                <span>MAIN</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé Tático de Confirmação */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-900/90 border-t border-cyan-500/20">
          <div className="flex items-center gap-2">
            {!isConfirmed && (mainOut.length > 0 || sideIn.length > 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={busy}
                className="border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white font-mono text-xs"
              >
                <RotateCcw className="size-3.5 mr-1.5" />
                Resetar Trocas
              </Button>
            )}

            {!isSwapBalanced && !isConfirmed && (
              <span className="text-xs font-mono text-amber-400 flex items-center gap-1">
                <AlertTriangle className="size-3.5" />
                Trocas devem ser 1:1 ({mainOut.length} fora vs {sideIn.length} dentro).
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              type="button"
              disabled={!canConfirm || busy}
              onClick={handleConfirm}
              className={cn(
                "h-11 px-6 rounded-[3px] font-black tracking-wider uppercase font-mono text-sm w-full sm:w-auto transition-all",
                canConfirm
                  ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-slate-950 hover:from-cyan-400 hover:to-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                  : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
              )}
            >
              {isConfirmed ? (
                <>
                  <CheckCircle2 className="size-4 mr-2" />
                  Trocas Confirmadas
                </>
              ) : mainOut.length === 0 && sideIn.length === 0 ? (
                <>
                  <Sparkles className="size-4 mr-2" />
                  Manter Deck Sem Trocas
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4 mr-2" />
                  Confirmar Trocas de Sideboard
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
