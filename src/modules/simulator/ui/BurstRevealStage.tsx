/* "Nova leva de correções" — revelação cinemática do 【Burst】 antes do
 * `BurstModal`: o shield quebrado sai da trilha (`shieldRail:${pid}`), voa
 * até o centro da tela e vira a face em 3D (verso -> frente, mesmo par de
 * classes `sim-preserve-3d`/`sim-anim-card-flip` do `DeckDealAnimation`), só
 * então o modal de decisão abre. Fases controladas em JS (mesmo padrão de
 * `executeAttackStrike` em `SimulatorMatchPage.tsx`) em vez de 1 keyframe
 * monolítico, pra facilitar escalar por velocidade quando `animationSettings.ts`
 * existir (Agente 2 — ainda não integrado aqui).
 *
 * Componente APRESENTACIONAL e auto-contido: overlay `fixed` (`pointer-events-none`). */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { CardDef } from "@/modules/simulator/engine/types";
import { artSrc, cardBackUrl, isGenericArtCard, type ArtLookup } from "./cardArt";
import { sfx } from "../audio/soundEffects";

export interface BurstRevealOrigin {
  x: number;
  y: number;
}

interface BurstRevealStageProps {
  cardDef: CardDef;
  art: ArtLookup;
  /** centro da trilha de escudos do dono (`shieldRail:${pid}`) em coords de viewport — `null` cai no centro da tela. */
  origin: BurstRevealOrigin | null;
  /** largura de referência da carta (px) — mesma fonte que o resto da arena (`--card-w-std`). */
  cardW: number;
  onDone: () => void;
}

// TODO: escalar por getScaledDuration quando animationSettings.ts existir (Agente 2, item 8 do plano).
const FLY_MS = 420;
const FLIP_MS = 500;
const HOLD_MS = 550;

export function BurstRevealStage({ cardDef, art, origin, cardW, onDone }: BurstRevealStageProps) {
  const [phase, setPhase] = useState<"fly" | "flip" | "hold">("fly");

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    if (reduced) {
      onDone();
      return;
    }
    sfx.playCardDraw();
    const t1 = setTimeout(() => setPhase("flip"), FLY_MS);
    const t2 = setTimeout(() => sfx.playShieldBurst(), FLY_MS + FLIP_MS * 0.3);
    const t3 = setTimeout(() => setPhase("hold"), FLY_MS + FLIP_MS);
    const t4 = setTimeout(() => onDone(), FLY_MS + FLIP_MS + HOLD_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
    // roda 1x na montagem — cada instância do componente representa 1 revelação só.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasWindow = typeof window !== "undefined";
  const originX = origin?.x ?? (hasWindow ? window.innerWidth / 2 : 0);
  const originY = origin?.y ?? (hasWindow ? window.innerHeight / 2 : 0);
  const centerX = hasWindow ? window.innerWidth / 2 : originX;
  const centerY = hasWindow ? window.innerHeight / 2 : originY;

  const w = Math.max(cardW, 1);
  const h = Math.round(w * (88 / 63));
  const scale = phase === "fly" ? 1 : 2.6;
  const face = artSrc(art, cardDef.code, "lg");
  const showFace = Boolean(face && cardDef.cardType && !isGenericArtCard(cardDef.cardType, cardDef.isToken));

  return (
    <div className="pointer-events-none fixed inset-0 z-[58] sim-perspective" aria-hidden>
      <div
        style={{
          position: "absolute",
          left: originX,
          top: originY,
          width: `${w}px`,
          height: `${h}px`,
          marginLeft: `${-w / 2}px`,
          marginTop: `${-h / 2}px`,
          transform: `translate3d(${centerX - originX}px, ${centerY - originY}px, 0) scale(${scale})`,
          transition:
            phase === "fly"
              ? `transform ${FLY_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
              : `transform ${FLIP_MS}ms ease-out`,
        }}
      >
        <div
          className={cn("relative h-full w-full sim-preserve-3d", phase !== "fly" && "sim-anim-card-flip")}
          style={phase !== "fly" ? ({ animationDuration: `${FLIP_MS}ms` } as React.CSSProperties) : undefined}
        >
          {/* Verso — visível durante o voo, antes do giro */}
          <div
            style={{ transform: "rotateY(0deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            className="absolute inset-0 sim-backface-hidden overflow-hidden rounded-arena border-2 border-amber-400/90 bg-slate-950 shadow-[0_10px_30px_rgba(0,0,0,0.9),0_0_24px_rgba(251,191,36,0.6)]"
          >
            <img src={cardBackUrl} alt="Verso da carta" className="h-full w-full object-cover object-center" />
          </div>
          {/* Frente — revelada pelo giro 3D */}
          <div
            style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            className="absolute inset-0 sim-backface-hidden overflow-hidden rounded-arena border-2 border-amber-300 bg-slate-950 shadow-[0_12px_36px_rgba(0,0,0,0.95),0_0_32px_rgba(251,191,36,0.8)]"
          >
            <img
              src={showFace && face ? face : cardBackUrl}
              alt={cardDef.nameEn}
              className="h-full w-full object-cover object-center"
            />
          </div>
        </div>
        {phase === "hold" ? (
          <p className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-arena bg-amber-500 px-2 py-0.5 text-[11px] font-black uppercase tracking-[0.2em] text-black shadow-[0_0_14px_rgba(251,191,36,0.9)] animate-pulse motion-reduce:animate-none">
            Burst
          </p>
        ) : null}
      </div>
    </div>
  );
}
