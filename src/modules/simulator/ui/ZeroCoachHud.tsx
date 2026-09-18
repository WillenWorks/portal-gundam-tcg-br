/* Zero Coach HUD — Assistente Tático In-Game do ZERO SYSTEM (docs/54, docs/55)
 * Design: Hangar Tático Neo-Militar / Anaheim Electronics / OZ HUD
 * Integrado na Arena de Batalha (SimulatorMatchPage) com atalho 'Z'
 */
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldAlert,
  Zap,
  Target,
  Clock,
  Radio,
  X,
  Crosshair,
} from "lucide-react";

import {
  api,
  type PilotPersonaId,
  type ZeroTerminalAnalysis,
  type ZeroThreatLevel,
  type ZeroTacticalLine,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { PlayerId } from "@/modules/simulator/engine/types";
import type { ViewGameState } from "@/modules/simulator/engine/viewState";

export interface ZeroCoachHudProps {
  open: boolean;
  onToggle: () => void;
  matchId: string;
  turnNumber?: number;
  activePlayer?: PlayerId;
  seat: PlayerId;
  view?: ViewGameState;
  initialAnalysis?: ZeroTerminalAnalysis;
  className?: string;
}

const PERSONA_CONFIGS: Record<
  PilotPersonaId,
  { name: string; subtitle: string; callsign: string; faction: string; accentColor: string; avatarBorder: string }
> = {
  adaptive: {
    name: "Zero Core Adaptativo",
    subtitle: "Seleção Heurística Dinâmica",
    callsign: "SYSTEM-ZERO",
    faction: "ANAHEIM CORP",
    accentColor: "text-cyan-400",
    avatarBorder: "border-cyan-500/50",
  },
  amuro: {
    name: "Amuro Ray",
    subtitle: "Preservação & Controle Reativo",
    callsign: "WHITE-DEVIL",
    faction: "E.F.S.F.",
    accentColor: "text-blue-400",
    avatarBorder: "border-blue-500/60",
  },
  char: {
    name: "Char Aznable",
    subtitle: "Velocidade & Ataque Total",
    callsign: "RED-COMET",
    faction: "ZEON FORCES",
    accentColor: "text-red-400",
    avatarBorder: "border-red-500/60",
  },
  heero: {
    name: "Heero Yuy",
    subtitle: "Cálculo Frio de Letal & Trocas",
    callsign: "WING-ZERO-01",
    faction: "COLONIES",
    accentColor: "text-emerald-400",
    avatarBorder: "border-emerald-500/60",
  },
  analyst: {
    name: "Analista Tático OZ",
    subtitle: "Rulings Oficiais & Metagame",
    callsign: "OZ-INTEL",
    faction: "ORGANIZATION OF ZODIAC",
    accentColor: "text-amber-400",
    avatarBorder: "border-amber-500/60",
  },
};

function CircularGauge({ value, size = 80, strokeWidth = 7 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - value * circumference;
  const percent = Math.round(value * 100);

  const color =
    percent >= 65
      ? "#10b981" // emerald
      : percent >= 45
        ? "#06b6d4" // cyan
        : percent >= 30
          ? "#f59e0b" // amber
          : "#ef4444"; // red

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-heading text-lg font-bold leading-none tracking-tight text-white">{percent}%</span>
        <span className="text-[8px] uppercase tracking-wider text-slate-400">Vitória</span>
      </div>
    </div>
  );
}

function ThreatLevelBadge({ level }: { level: ZeroThreatLevel }) {
  const configs = {
    LOW: { label: "AMEAÇA BAIXA", bg: "bg-emerald-950/40 border-emerald-500/40 text-emerald-400", pulse: false },
    MEDIUM: { label: "ALERTA MÉDIO", bg: "bg-cyan-950/40 border-cyan-500/40 text-cyan-400", pulse: false },
    HIGH: { label: "PERIGO ELEVADO", bg: "bg-amber-950/40 border-amber-500/50 text-amber-400", pulse: false },
    CRITICAL: {
      label: "AMEAÇA CRÍTICA",
      bg: "bg-red-950/70 border-red-500 text-red-300 shadow-[0_0_18px_rgba(239,68,68,0.5)]",
      pulse: true,
    },
  };
  const cfg = configs[level] || configs.LOW;

  return (
    <div
      data-testid="zero-threat-badge"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] border panel-cut transition-all ${cfg.bg} ${
        cfg.pulse ? "animate-pulse" : ""
      }`}
    >
      <span
        className={`size-2 rounded-full shrink-0 ${
          level === "CRITICAL"
            ? "bg-red-500 animate-ping"
            : level === "HIGH"
              ? "bg-amber-400"
              : level === "MEDIUM"
                ? "bg-cyan-400"
                : "bg-emerald-400"
        }`}
      />
      <span>{cfg.label}</span>
    </div>
  );
}

function StrategyTag({ strategy }: { strategy: ZeroTacticalLine["strategy"] }) {
  const labels = {
    aggressive: { text: "AGRESSÃO", cls: "bg-red-950/50 text-red-400 border-red-500/40" },
    control: { text: "CONTROLE", cls: "bg-blue-950/50 text-blue-400 border-blue-500/40" },
    tempo: { text: "TEMPO", cls: "bg-cyan-950/50 text-cyan-400 border-cyan-500/40" },
    defensive: { text: "DEFESA", cls: "bg-emerald-950/50 text-emerald-400 border-emerald-500/40" },
  };
  const cfg = labels[strategy] || labels.control;
  return (
    <span className={`inline-block border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider panel-cut ${cfg.cls}`}>
      {cfg.text}
    </span>
  );
}

export function ZeroCoachHud({
  open,
  onToggle,
  matchId,
  turnNumber,
  activePlayer,
  seat,
  view,
  initialAnalysis,
  className = "",
}: ZeroCoachHudProps) {
  const [selectedPersona, setSelectedPersona] = useState<PilotPersonaId>("adaptive");
  const [analysis, setAnalysis] = useState<ZeroTerminalAnalysis | null>(initialAnalysis ?? null);
  const [loading, setLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const fetchTelemetry = useCallback(async (personaToFetch = selectedPersona) => {
    if (!matchId) return;
    setLoading(true);
    try {
      const res = await api.getSimulatorZeroTerminal(matchId, personaToFetch);
      setAnalysis(res);
    } catch {
      /* silencia erros transitórios */
    } finally {
      setLoading(false);
    }
  }, [matchId, selectedPersona]);

  // Atualiza telemetria ao mudar de turno, assento ou persona
  useEffect(() => {
    if (open && !initialAnalysis) {
      void fetchTelemetry(selectedPersona);
    }
  }, [open, turnNumber, activePlayer, selectedPersona, fetchTelemetry, initialAnalysis]);

  // Persona ativa: se o usuário selecionou uma persona específica, honra a seleção; se adaptive, usa a recomendação da IA
  const currentPersonaId = selectedPersona === "adaptive" ? (analysis?.resolvedPersona || "amuro") : selectedPersona;
  const personaMeta = PERSONA_CONFIGS[currentPersonaId] || PERSONA_CONFIGS.adaptive;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        data-testid="zero-coach-hud"
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.98 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className={`fixed right-3 top-14 z-[48] w-[min(28rem,calc(100vw-1.5rem))] overflow-hidden border border-cyan-500/40 bg-slate-950/95 shadow-2xl backdrop-blur-md panel-cut text-soft ${
          analysis?.threatLevel === "CRITICAL" ? "border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.35)]" : ""
        } ${className}`}
      >
        {/* Barra de Título Superior do Hangar Tático */}
        <div className="flex items-center justify-between border-b border-cyan-500/30 bg-gradient-to-r from-cyan-950/60 via-slate-900/80 to-slate-950 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="relative flex size-5 items-center justify-center rounded-none bg-cyan-500/20 text-cyan-400">
              <BrainCircuit className="size-3.5" />
              <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-heading text-xs font-black uppercase tracking-[0.18em] text-white">
                  ZERO COACH
                </span>
                <span className="text-[9px] font-mono tracking-widest text-cyan-400/80">HUD v2.0</span>
              </div>
              <p className="text-[8px] uppercase tracking-wider text-slate-400">
                Anaheim Neural Copilot · Atalho [Z]
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10"
              onClick={() => fetchTelemetry(selectedPersona)}
              disabled={loading}
              title="Recalcular telemetria agora"
              aria-label="Atualizar telemetria"
            >
              <RefreshCw className={`size-3 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              data-testid="zero-hud-minimize"
              className="size-6 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10"
              onClick={() => setIsMinimized((v) => !v)}
              title={isMinimized ? "Expandir HUD" : "Recolher HUD"}
              aria-label={isMinimized ? "Expandir HUD" : "Recolher HUD"}
            >
              {isMinimized ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              data-testid="zero-hud-close"
              className="size-6 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
              onClick={onToggle}
              title="Fechar Zero Coach (Z)"
              aria-label="Fechar painel"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Modo Compacto / Recolhido */}
        {isMinimized ? (
          <div className="flex items-center justify-between p-2.5 bg-slate-950/90 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-heading text-sm font-bold text-white">
                {Math.round((analysis?.winProbabilityEstimate ?? 0.5) * 100)}% WP
              </span>
              <ThreatLevelBadge level={analysis?.threatLevel || "LOW"} />
            </div>
            <span className="text-[10px] font-mono text-cyan-400">
              {analysis?.lethalClockTurns !== undefined && analysis.lethalClockTurns < 90
                ? `Clock: ${analysis.lethalClockTurns}T`
                : "Clock Seguro"}
            </span>
          </div>
        ) : (
          /* Modo Expandido Completo */
          <div className="p-3 space-y-3 max-h-[80vh] overflow-y-auto custom-scrollbar">
            {/* Seletor de Personas Táticas */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 flex items-center gap-1">
                  <Radio className="size-2.5 text-cyan-400" />
                  Link de Comunicação Piloto
                </span>
                <span className="text-[9px] font-mono text-cyan-400/70">{personaMeta.callsign}</span>
              </div>
              <div className="grid grid-cols-5 gap-1" data-testid="zero-persona-selector">
                {(["adaptive", "amuro", "char", "heero", "analyst"] as PilotPersonaId[]).map((pid) => {
                  const active = selectedPersona === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => setSelectedPersona(pid)}
                      data-persona={pid}
                      className={`px-1 py-1.5 text-[9px] font-heading font-bold uppercase tracking-wider border transition-all text-center panel-cut ${
                        active
                          ? "border-cyan-400 bg-cyan-500/20 text-white shadow-sm shadow-cyan-500/30"
                          : "border-white/10 bg-white/5 text-slate-400 hover:border-cyan-500/30 hover:text-soft"
                      }`}
                    >
                      {pid === "adaptive"
                        ? "AUTO"
                        : pid === "amuro"
                          ? "AMURO"
                          : pid === "char"
                            ? "CHAR"
                            : pid === "heero"
                              ? "HEERO"
                              : "OZ"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gauge de Win Probability + Threat Level + Burst Matrix */}
            <div className="grid grid-cols-12 gap-2 border border-white/10 bg-slate-900/60 p-2.5 panel-cut">
              <div className="col-span-4 flex items-center justify-center">
                <CircularGauge value={analysis?.winProbabilityEstimate ?? 0.5} />
              </div>
              <div className="col-span-8 flex flex-col justify-between py-0.5 space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <ThreatLevelBadge level={analysis?.threatLevel || "LOW"} />
                  <span className="text-[9px] font-mono text-slate-400">
                    {analysis?.provider?.toUpperCase() || "VEDA"}
                  </span>
                </div>

                {/* Lethal Clock */}
                <div className="flex items-center justify-between border-t border-white/5 pt-1.5 text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1 text-[10px] uppercase tracking-wider">
                    <Clock className="size-3 text-cyan-400" />
                    Lethal Clock
                  </span>
                  <span
                    className={`font-heading font-bold ${
                      (analysis?.lethalClockTurns ?? 99) <= 1
                        ? "text-red-400 animate-pulse font-black"
                        : (analysis?.lethalClockTurns ?? 99) <= 2
                          ? "text-amber-400"
                          : "text-white"
                    }`}
                  >
                    {(analysis?.lethalClockTurns ?? 99) >= 90
                      ? "Seguro (>10 T)"
                      : `${analysis?.lethalClockTurns} turno${(analysis?.lethalClockTurns ?? 1) > 1 ? "s" : ""}`}
                  </span>
                </div>

                {/* Matriz de Burst no próximo escudo */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1 text-[10px] uppercase tracking-wider">
                    <Zap className="size-3 text-amber-400" />
                    Risco Burst (Escudo)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1.5 bg-slate-800 rounded-none overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all duration-500"
                        style={{ width: `${Math.round((analysis?.burstProbabilityEstimate ?? 0.28) * 100)}%` }}
                      />
                    </div>
                    <span className="font-heading font-bold text-amber-400">
                      {Math.round((analysis?.burstProbabilityEstimate ?? 0.28) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card de Comunicação do Piloto & Citação Tática */}
            <div
              data-testid="zero-pilot-card"
              className={`border bg-gradient-to-r from-slate-900/90 to-slate-950 p-2.5 panel-cut space-y-1.5 ${personaMeta.avatarBorder}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`size-6 rounded-none flex items-center justify-center text-xs font-heading font-black border bg-slate-950 ${personaMeta.avatarBorder} ${personaMeta.accentColor}`}
                  >
                    {currentPersonaId[0].toUpperCase()}
                  </div>
                  <div>
                    <p className={`font-heading text-xs font-bold uppercase leading-none ${personaMeta.accentColor}`}>
                      {personaMeta.name}
                    </p>
                    <p className="text-[8px] uppercase tracking-widest text-slate-400">{personaMeta.subtitle}</p>
                  </div>
                </div>
                <span className="text-[8px] font-mono uppercase tracking-widest text-slate-500">
                  {personaMeta.faction}
                </span>
              </div>
              <p
                data-testid="zero-tactical-quote"
                className="text-[11px] leading-relaxed text-slate-300 italic border-l-2 border-cyan-400/40 pl-2 bg-white/[0.02] py-1"
              >
                &ldquo;{analysis?.tacticalAdvice || "Calculando opções táticas de vitória para esta rodada..."}&rdquo;
              </p>
            </div>

            {/* Ameaças Identificadas */}
            {analysis?.keyThreats && analysis.keyThreats.length > 0 && (
              <div className="space-y-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-red-400 flex items-center gap-1">
                  <ShieldAlert className="size-2.5" />
                  Ameaças Prioritárias do Oponente
                </span>
                <div className="space-y-1">
                  {analysis.keyThreats.slice(0, 3).map((threat, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-1.5 text-[10px] text-slate-300 bg-red-950/20 border border-red-500/20 px-2 py-1 panel-cut"
                    >
                      <Crosshair className="size-3 text-red-400 shrink-0 mt-0.5" />
                      <span>{threat}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Linhas Recomendadas de Ação */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-400 flex items-center gap-1">
                <Target className="size-2.5" />
                Linhas Táticas Recomendadas
              </span>

              <div className="space-y-1.5">
                {(analysis?.recommendedLines || []).map((line, idx) => {
                  const wpDeltaPercent = Math.round((line.winProbabilityDelta || 0) * 100);
                  return (
                    <div
                      key={idx}
                      className="border border-white/10 bg-slate-900/70 p-2 panel-cut hover:border-cyan-500/40 transition-colors space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] font-mono px-1 py-0.2 rounded-none font-bold">
                            P{line.priority}
                          </span>
                          <StrategyTag strategy={line.strategy} />
                        </div>
                        {wpDeltaPercent > 0 && (
                          <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-1 py-0.2">
                            +{wpDeltaPercent}% WP
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-white leading-snug">
                        {line.actionRecommendation}
                      </p>
                      <p className="text-[10px] text-slate-400 leading-snug">{line.rationale}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
