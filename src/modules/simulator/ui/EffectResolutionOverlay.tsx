import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { GameEvent, PlayerId } from "@/modules/simulator/engine/types";
import { getScaledDuration } from "./animationSettings";
import { playerShieldKey, playerAreaKey } from "./useBoardElements";

export interface EffectResolutionCue {
  id: string;
  type: "damage" | "heal" | "buff" | "debuff" | "keyword" | "shield" | "spawn" | "active" | "rest";
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
    // Limitar o lote de eventos novos a 8 para evitar explosão de animações simultâneas
    const batch = newEvents.slice(-8);

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

        case "SET_ACTIVE":
          targetKey = ev.instanceId;
          type = "active";
          label = "Ativa";
          sublabel = "READY";
          break;

        default:
          break;
      }

      if (!targetKey || !label) continue;

      let rect = rectOf(targetKey);
      if (!rect && ev.type === "DAMAGE_SHIELD" && "player" in ev) {
        rect = rectOf(playerShieldKey(ev.player)) ?? rectOf(playerAreaKey(ev.player));
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

    setCues((prev) => [...prev.slice(-8), ...newCues]);

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
        const isDamage = cue.type === "damage";
        const isShield = cue.type === "shield";
        const isHeal = cue.type === "heal";
        const isBuff = cue.type === "buff";
        const isDebuff = cue.type === "debuff";
        const isKeyword = cue.type === "keyword";
        const isSpawn = cue.type === "spawn";

        const toneClasses = isDamage
          ? "border-rose-500 bg-rose-950/90 text-rose-200 shadow-[0_0_16px_rgba(244,63,94,0.85)]"
          : isShield
            ? "border-amber-500 bg-amber-950/90 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.85)]"
            : isHeal
              ? "border-emerald-400 bg-emerald-950/90 text-emerald-200 shadow-[0_0_16px_rgba(52,211,153,0.85)]"
              : isBuff
                ? "border-amber-400 bg-amber-950/90 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.85)]"
                : isDebuff
                  ? "border-purple-400 bg-purple-950/90 text-purple-200 shadow-[0_0_16px_rgba(192,132,252,0.85)]"
                  : isKeyword
                    ? "border-cyan-400 bg-cyan-950/90 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.85)]"
                    : isSpawn
                      ? "border-fuchsia-400 bg-fuchsia-950/90 text-fuchsia-200 shadow-[0_0_16px_rgba(232,121,249,0.85)]"
                      : "border-primary/50 bg-slate-950/90 text-primary shadow-[0_0_12px_rgba(56,189,248,0.7)]";

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
