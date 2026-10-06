import { useEffect, useReducer } from "react";
import { cn } from "@/lib/utils";

export interface TargetLanePoint {
  id: string;
  rect: DOMRect | null;
  pool?: "ally" | "enemy" | "secondary" | null;
  label?: string;
}

interface AbilityTargetLaneProps {
  sourceRect: DOMRect | null;
  targets: TargetLanePoint[];
  className?: string;
}

function center(r: DOMRect): { x: number; y: number } {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

export function AbilityTargetLane({ sourceRect, targets, className }: AbilityTargetLaneProps) {
  const [, remeasure] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    let scheduled = false;
    const on = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        remeasure();
      });
    };
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    on();
    const t = setTimeout(on, 120);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("scroll", on, true);
      clearTimeout(t);
    };
  }, [sourceRect, targets]);

  const validTargets = targets.filter((t): t is TargetLanePoint & { rect: DOMRect } => Boolean(t.rect));
  if (!sourceRect || validTargets.length === 0) return null;

  const reducedMotion = prefersReducedMotion();
  const a = center(sourceRect);

  return (
    <svg
      className={cn("pointer-events-none fixed inset-0 z-[44] h-full w-full", className)}
      aria-hidden
      data-testid="ability-target-lane"
    >
      <defs>
        <marker
          id="ability-arrow-enemy"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(244 63 94)" />
        </marker>
        <marker
          id="ability-arrow-ally"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(52 211 153)" />
        </marker>
        <marker
          id="ability-arrow-accent"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgb(251 191 36)" />
        </marker>
      </defs>

      {/* Halo na fonte do efeito */}
      <circle cx={a.x} cy={a.y} r={6} fill="rgb(251 191 36)" opacity={0.8} />
      <circle cx={a.x} cy={a.y} r={12} fill="none" stroke="rgb(251 191 36)" strokeWidth={1.5} opacity={0.4}>
        {!reducedMotion ? (
          <>
            <animate attributeName="r" from="6" to="18" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.7" to="0" dur="1.2s" repeatCount="indefinite" />
          </>
        ) : null}
      </circle>

      {validTargets.map((t) => {
        const b = center(t.rect);
        const isEnemy = t.pool === "enemy";
        const isAlly = t.pool === "ally";
        const glowStroke = isEnemy ? "rgba(244,63,94,0.3)" : isAlly ? "rgba(52,211,153,0.3)" : "rgba(251,191,36,0.3)";
        const lineStroke = isEnemy ? "rgb(244 63 94)" : isAlly ? "rgb(52 211 153)" : "rgb(251 191 36)";
        const markerUrl = isEnemy
          ? "url(#ability-arrow-enemy)"
          : isAlly
            ? "url(#ability-arrow-ally)"
            : "url(#ability-arrow-accent)";

        return (
          <g key={t.id}>
            {/* Feixe base mais largo com glow suave */}
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={glowStroke}
              strokeWidth={5}
              strokeLinecap="round"
            />
            {/* Feixe pontilhado com fluxo de energia */}
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={lineStroke}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="6 5"
              markerEnd={markerUrl}
            >
              {!reducedMotion ? (
                <animate attributeName="stroke-dashoffset" from="22" to="0" dur="0.5s" repeatCount="indefinite" />
              ) : null}
            </line>

            {/* Retículo de impacto no alvo */}
            <circle
              cx={b.x}
              cy={b.y}
              r={9}
              fill="none"
              stroke={lineStroke}
              strokeWidth={2}
            >
              {!reducedMotion ? (
                <>
                  <animate attributeName="r" from="8" to="16" dur="0.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.9" to="0" dur="0.8s" repeatCount="indefinite" />
                </>
              ) : null}
            </circle>
          </g>
        );
      })}
    </svg>
  );
}
