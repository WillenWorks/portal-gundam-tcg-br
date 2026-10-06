import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Coins,
  Flame,
  Layers,
  Link2,
  Lock,
  Plus,
  Shield,
  ShieldCheck,
  Skull,
  Snowflake,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GameEvent, PlayerId } from "@/modules/simulator/engine/types";
import { getScaledDuration } from "./animationSettings";
import { playerShieldKey, playerAreaKey } from "./useBoardElements";

export interface EffectResolutionCue {
  id: string;
  type:
    | "damage"
    | "heal"
    | "buff"
    | "debuff"
    | "keyword"
    | "shield"
    | "spawn"
    | "active"
    | "rest"
    | "destroy"
    | "exile"
    | "pair"
    | "block"
    | "lock"
    | "freeze"
    | "ex_pay"
    | "draw";
  label: string;
  sublabel?: string;
  x: number;
  y: number;
}

interface EffectResolutionOverlayProps {
  eventLog: GameEvent[];
  rectOf: (key: string) => DOMRect | null;
  viewerSeat: PlayerId;
  nameOf?: (id: string) => string;
  className?: string;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

let cueCounter = 0;

export function EffectResolutionOverlay({
  eventLog,
  rectOf,
  viewerSeat,
  className,
}: EffectResolutionOverlayProps) {
  const [cues, setCues] = useState<EffectResolutionCue[]>([]);
  const processedLogLenRef = useRef<number>(eventLog.length);
  const activeTimersRef = useRef<Set<NodeJS.Timeout>>(new Set());

  useEffect(() => {
    return () => {
      activeTimersRef.current.forEach((t) => clearTimeout(t));
      activeTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const prevLen = processedLogLenRef.current;
    processedLogLenRef.current = eventLog.length;

    // Se o eventLog foi reiniciado ou é a primeira carga
    if (eventLog.length <= prevLen) {
      return;
    }

    const newEvents = eventLog.slice(prevLen);
    // Limitar o lote de eventos novos a 10 para evitar sobrecarga de animações simultâneas
    const batch = newEvents.slice(-10);

    const newCues: EffectResolutionCue[] = [];
    const reduced = prefersReducedMotion();

    for (const ev of batch) {
      let targetKey: string | null = null;
      let type: EffectResolutionCue["type"] = "damage";
      let label = "";
      let sublabel: string | undefined = undefined;

      switch (ev.type) {
        case "DAMAGE_UNIT":
          targetKey = ev.instanceId;
          type = "damage";
          label = `-${ev.amount}`;
          sublabel = "DANO";
          break;

        case "DAMAGE_BASE":
          targetKey = ev.instanceId || playerShieldKey(viewerSeat);
          type = "damage";
          label = `-${ev.amount} HP`;
          sublabel = "BASE";
          break;

        case "DAMAGE_SHIELD":
          targetKey = `shieldRail:${ev.player}`;
          type = "shield";
          label = `-${ev.count} Escudo`;
          sublabel = "SHIELD";
          break;

        case "HEAL_UNIT":
          targetKey = ev.instanceId;
          type = "heal";
          label = `+${ev.amount} HP`;
          sublabel = "REPARO";
          break;

        case "DESTROY_CARD":
          targetKey = ev.instanceId;
          type = "destroy";
          label = "Destruída";
          sublabel = "K.O.";
          break;

        case "REMOVE_CARD_FROM_GAME":
          targetKey = ev.instanceId;
          type = "exile";
          label = "Exilada";
          sublabel = "EXÍLIO";
          break;

        case "REST_CARD":
          targetKey = ev.instanceId;
          type = "rest";
          label = "Descansada";
          sublabel = "REST";
          break;

        case "SET_ACTIVE":
          targetKey = ev.instanceId;
          type = "active";
          label = "Ativa";
          sublabel = "READY";
          break;

        case "PAIR_CARDS":
          targetKey = ev.unitId;
          type = "pair";
          label = "Piloto Pareado";
          sublabel = ev.asPilotMode ? "PILOT" : "PAIR";
          break;

        case "BLOCK_DECLARED":
          targetKey = ev.blockerId;
          type = "block";
          label = "Bloqueio!";
          sublabel = "BLOCK";
          break;

        case "SET_CANNOT_ATTACK":
          targetKey = ev.instanceId;
          type = "lock";
          label = "Não Pode Atacar";
          sublabel = "LOCK";
          break;

        case "SET_CANNOT_ACTIVATE":
          targetKey = ev.instanceId;
          type = "freeze";
          label = "Não Ativa";
          sublabel = "FREEZE";
          break;

        case "MARK_COMMAND_PAYMENT":
          if (ev.withEx) {
            targetKey = ev.instanceId || playerAreaKey(viewerSeat);
            type = "ex_pay";
            label = "Pago c/ EX";
            sublabel = "EX RESOURCE";
          }
          break;

        case "DRAW_CARD":
          targetKey = playerAreaKey(ev.player);
          type = "draw";
          label = "+1 Carta";
          sublabel = ev.from === "resourceDeck" ? "EX REC" : "COMPRA";
          break;

        case "MODIFY_STAT": {
          targetKey = ev.instanceId;
          const statName = ev.modifier.stat.toUpperCase();
          const amt = ev.modifier.amount;
          if (amt >= 0) {
            type = "buff";
            label = `+${amt} ${statName}`;
            sublabel = ev.modifier.duration === "thisBattle" ? "Batalha" : "Turno";
          } else {
            type = "debuff";
            label = `${amt} ${statName}`;
            sublabel = ev.modifier.duration === "thisBattle" ? "Batalha" : "Turno";
          }
          break;
        }

        case "GRANT_KEYWORD":
          targetKey = ev.instanceId;
          type = "keyword";
          label = `+<${ev.grant.keyword}>`;
          sublabel = "KEYWORD";
          break;

        case "SPAWN_TOKEN":
          targetKey = playerAreaKey(ev.player);
          type = "spawn";
          label = "Token Deploy";
          sublabel = "SPAWN";
          break;

        default:
          break;
      }

      if (!targetKey || !label) continue;

      let rect = rectOf(targetKey);
      if (!rect && ev.type === "DAMAGE_SHIELD" && "player" in ev) {
        rect = rectOf(playerShieldKey(ev.player)) ?? rectOf(playerAreaKey(ev.player));
      }
      if (!rect && ("player" in ev) && ev.player) {
        rect = rectOf(playerAreaKey(ev.player));
      }
      if (!rect) {
        // Fallback genérico para a mesa do jogador
        rect = rectOf(playerAreaKey(viewerSeat));
      }
      if (!rect) continue;

      // Adiciona leve variação de dispersão caso múltiplos efeitos caiam na mesma coordenada
      const jitterX = (Math.random() - 0.5) * 16;
      const jitterY = (Math.random() - 0.5) * 12;

      const x = rect.left + rect.width / 2 + jitterX;
      const y = rect.top + rect.height * 0.4 + jitterY;

      newCues.push({
        id: `cue-${++cueCounter}`,
        type,
        label,
        sublabel,
        x,
        y,
      });
    }

    if (newCues.length === 0) return;

    setCues((prev) => [...prev.slice(-10), ...newCues]);

    const durationMs = getScaledDuration(reduced ? 450 : 850);
    const cueIds = newCues.map((c) => c.id);

    const timer = setTimeout(() => {
      setCues((prev) => prev.filter((c) => !cueIds.includes(c.id)));
      activeTimersRef.current.delete(timer);
    }, durationMs);

    activeTimersRef.current.add(timer);
  }, [eventLog, rectOf, viewerSeat]);

  if (cues.length === 0) return null;

  return (
    <div
      className={cn("pointer-events-none fixed inset-0 z-[47] overflow-hidden", className)}
      aria-hidden
      data-testid="effect-resolution-overlay"
    >
      {cues.map((cue) => {
        let toneClasses = "border-primary/50 bg-slate-950/90 text-primary shadow-[0_0_12px_rgba(56,189,248,0.7)]";
        let Icon = Sparkles;

        switch (cue.type) {
          case "damage":
            toneClasses = "border-rose-500 bg-rose-950/90 text-rose-200 shadow-[0_0_16px_rgba(244,63,94,0.85)]";
            Icon = Flame;
            break;
          case "shield":
            toneClasses = "border-amber-500 bg-amber-950/90 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.85)]";
            Icon = Shield;
            break;
          case "heal":
            toneClasses = "border-emerald-400 bg-emerald-950/90 text-emerald-200 shadow-[0_0_16px_rgba(52,211,153,0.85)]";
            Icon = Plus;
            break;
          case "destroy":
            toneClasses = "border-red-600 bg-red-950/95 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.95)]";
            Icon = Skull;
            break;
          case "exile":
            toneClasses = "border-purple-500 bg-purple-950/95 text-purple-100 shadow-[0_0_20px_rgba(168,85,247,0.9)]";
            Icon = Sparkles;
            break;
          case "buff":
            toneClasses = "border-amber-400 bg-amber-950/90 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.85)]";
            Icon = ArrowUp;
            break;
          case "debuff":
            toneClasses = "border-purple-400 bg-purple-950/90 text-purple-200 shadow-[0_0_16px_rgba(192,132,252,0.85)]";
            Icon = ArrowDown;
            break;
          case "keyword":
            toneClasses = "border-cyan-400 bg-cyan-950/90 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.85)]";
            Icon = Sparkles;
            break;
          case "spawn":
            toneClasses = "border-fuchsia-400 bg-fuchsia-950/90 text-fuchsia-200 shadow-[0_0_16px_rgba(232,121,249,0.85)]";
            Icon = Layers;
            break;
          case "active":
            toneClasses = "border-cyan-400 bg-cyan-950/90 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.7)]";
            Icon = Zap;
            break;
          case "rest":
            toneClasses = "border-amber-500/70 bg-slate-950/90 text-amber-200/90 shadow-[0_0_10px_rgba(245,158,11,0.5)]";
            Icon = Clock;
            break;
          case "pair":
            toneClasses = "border-sky-400 bg-slate-950/90 text-sky-200 shadow-[0_0_16px_rgba(56,189,248,0.85)]";
            Icon = Link2;
            break;
          case "block":
            toneClasses = "border-blue-500 bg-blue-950/95 text-blue-100 shadow-[0_0_18px_rgba(59,130,246,0.9)]";
            Icon = ShieldCheck;
            break;
          case "lock":
            toneClasses = "border-rose-500/80 bg-rose-950/90 text-rose-200 shadow-[0_0_14px_rgba(244,63,94,0.7)]";
            Icon = Lock;
            break;
          case "freeze":
            toneClasses = "border-cyan-300/80 bg-sky-950/90 text-cyan-100 shadow-[0_0_14px_rgba(103,232,249,0.7)]";
            Icon = Snowflake;
            break;
          case "ex_pay":
            toneClasses = "border-emerald-400 bg-emerald-950/90 text-emerald-200 shadow-[0_0_16px_rgba(52,211,153,0.85)]";
            Icon = Coins;
            break;
          case "draw":
            toneClasses = "border-sky-400/70 bg-slate-950/90 text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.6)]";
            Icon = Layers;
            break;
        }

        return (
          <div
            key={cue.id}
            style={{
              position: "absolute",
              left: cue.x,
              top: cue.y,
              transform: "translate(-50%, -50%)",
            }}
            className="animate-out fade-out slide-out-to-top-4 duration-700 fill-mode-forwards"
          >
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-black tracking-wider uppercase backdrop-blur-sm",
                toneClasses,
              )}
            >
              <Icon className="size-3 shrink-0" aria-hidden />
              <span>{cue.label}</span>
              {cue.sublabel ? (
                <span className="border-l border-white/20 pl-1 text-[9px] font-bold opacity-75">
                  {cue.sublabel}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
