/* "Nova leva de correções" — lançamento e revelação de Comandos: a carta sobe
 * da mão, fica em destaque no centro da arena ("Ativando Comando") por um
 * intervalo, e então viaja até o Trash. Fases controladas em JS (mesmo padrão
 * de `executeAttackStrike`/`BurstRevealStage`), não 1 keyframe monolítico, pra
 * facilitar escalar por velocidade (`animationSettings.ts`).
 *
 * Componente APRESENTACIONAL e auto-contido: overlay `fixed` (`pointer-events-none`). */
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { CardDef } from "@/modules/simulator/engine/types";
import { getScaledDuration } from "./animationSettings";
import { artSrc, cardBackUrl, isGenericArtCard, type ArtLookup } from "./cardArt";
import { sfx } from "../audio/soundEffects";

export interface CommandCastPoint {
  x: number;
  y: number;
}

interface CommandCastAnimationProps {
  cardDef: CardDef;
  art: ArtLookup;
  /** centro de `hand:self` em coords de viewport — `null` cai no centro da tela. */
  origin: CommandCastPoint | null;
  /** centro de `trashStation:${seat}` em coords de viewport — `null` cai num deslize genérico. */
  dest: CommandCastPoint | null;
  cardW: number;
  onDone: () => void;
}

const RISE_BASE_MS = 320;
const HOLD_BASE_MS = 700;
const FLY_BASE_MS = 360;
const HOLD_SETTLE_BASE_MS = 160;

export function CommandCastAnimation({ cardDef, art, origin, dest, cardW, onDone }: CommandCastAnimationProps) {
  const [phase, setPhase] = useState<"rise" | "hold" | "fly">("rise");
  const riseMs = useMemo(() => getScaledDuration(RISE_BASE_MS), []);
  const holdMs = useMemo(() => getScaledDuration(HOLD_BASE_MS), []);
  const flyMs = useMemo(() => getScaledDuration(FLY_BASE_MS), []);
  const holdSettleMs = useMemo(() => getScaledDuration(HOLD_SETTLE_BASE_MS), []);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    if (reduced) {
      onDone();
      return;
    }
    sfx.playNewtypeFlash();
    const t1 = setTimeout(() => setPhase("hold"), riseMs);
    const t2 = setTimeout(() => setPhase("fly"), riseMs + holdMs);
    const t3 = setTimeout(() => onDone(), riseMs + holdMs + flyMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // roda 1x na montagem — cada instância representa 1 lançamento de comando só.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasWindow = typeof window !== "undefined";
  const originX = origin?.x ?? (hasWindow ? window.innerWidth / 2 : 0);
  const originY = origin?.y ?? (hasWindow ? window.innerHeight / 2 : 0);
  const centerX = hasWindow ? window.innerWidth / 2 : originX;
  const centerY = hasWindow ? window.innerHeight / 2 : originY;
  const destX = dest?.x ?? centerX;
  const destY = dest?.y ?? centerY + (hasWindow ? window.innerHeight * 0.3 : 200);

  const w = Math.max(cardW, 1);
  const h = Math.round(w * (88 / 63));
  const face = artSrc(art, cardDef.code, "lg");
  const showFace = Boolean(face && cardDef.cardType && !isGenericArtCard(cardDef.cardType, cardDef.isToken));

  const targetX = phase === "fly" ? destX : centerX;
  const targetY = phase === "fly" ? destY : centerY;
  const fromX = phase === "rise" ? originX : phase === "hold" ? centerX : centerX;
  const fromY = phase === "rise" ? originY : phase === "hold" ? centerY : centerY;
  const scale = phase === "fly" ? 0.55 : 1.8;

  return (
    <div className="pointer-events-none fixed inset-0 z-[58]" aria-hidden>
      <div
        style={{
          position: "absolute",
          left: fromX,
          top: fromY,
          width: `${w}px`,
          height: `${h}px`,
          marginLeft: `${-w / 2}px`,
          marginTop: `${-h / 2}px`,
          transform: `translate3d(${targetX - fromX}px, ${targetY - fromY}px, 0) scale(${scale})`,
          opacity: phase === "fly" ? 0 : 1,
          transition:
            phase === "rise"
              ? `transform ${riseMs}ms cubic-bezier(0.16, 1, 0.3, 1)`
              : phase === "hold"
                ? `transform ${holdSettleMs}ms ease-out`
                : `transform ${flyMs}ms cubic-bezier(0.4, 0, 0.6, 1), opacity ${flyMs}ms ease-in`,
        }}
        className={cn(
          "overflow-hidden rounded-arena border-2 border-cyan-300 bg-slate-950",
          phase === "hold"
            ? "shadow-[0_0_36px_rgba(34,211,238,0.9),0_0_60px_rgba(217,70,239,0.5)]"
            : "shadow-[0_10px_30px_rgba(0,0,0,0.9)]",
        )}
      >
        <img
          src={showFace && face ? face : cardBackUrl}
          alt={cardDef.nameEn}
          className="h-full w-full object-cover object-center"
        />
      </div>
      {phase === "hold" ? (
        <p
          style={{ left: centerX, top: centerY }}
          className="pointer-events-none absolute -translate-x-1/2 translate-y-[calc(50%+2.6rem)] whitespace-nowrap rounded-arena bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-black shadow-[0_0_18px_rgba(217,70,239,0.8)]"
        >
          Ativando Comando
        </p>
      ) : null}
    </div>
  );
}
