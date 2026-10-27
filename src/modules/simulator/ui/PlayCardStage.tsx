/* Spec simulador-cadencia-de-mesa (P3) — a carta jogada da mão, como na mesa de verdade:
 *  - "rise": sai da mão e fica à mostra (a minha no centro da tela; a do oponente revelada perto da mão dele; Command
 *    sempre no centro), virando de verso para face no caminho;
 *  - "hold": parada à mostra enquanto os recursos pagos giram um a um (a página cuida deles);
 *  - "drop": cai no lugar exato onde vai ficar (vaga do campo, Base, Unit do Piloto), já no tamanho dela — pesada
 *    (mais rápida, com tremor, a página treme a mesa) do Lv 5 em diante;
 *  - "used": a Command some no centro, com zoom, usada.
 * A página troca a fase e mede as pontas; a geometria de cada fase fica a da troca (o relógio da página re-renderiza
 * a cada segundo). Overlay `fixed`, `pointer-events-none`. */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SCENE_MS } from "../scene/sceneTiming";
import { getScaledDuration } from "./animationSettings";
import { cardBackUrl, isGenericArtCard, type ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";
import type { TravelCard, TravelPoint } from "./CardTravel";

export interface PlayStage {
  key: number;
  /** a carta jogada (sai da mão enquanto está em cena) */
  instanceId: string;
  card: TravelCard;
  phase: "rise" | "hold" | "drop" | "used";
  from: TravelPoint;
  fromW: number;
  hold: TravelPoint;
  holdW: number;
  target?: TravelPoint | null;
  targetW?: number;
  heavy?: boolean;
  /** quem jogou é o oponente (cor do contorno) */
  opponent?: boolean;
}

const ASPECT = 88 / 63;

/** P6 — sem movimento: a carta aparece direto em cada posição (a cena dura o mesmo, só não anda) */
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

export function PlayCardStage({ stage, art }: { stage: PlayStage; art?: ArtLookup }) {
  const [reduced] = useState(prefersReducedMotion);
  // um quadro na mão antes de subir, para a transição ter de onde partir
  const [left, setLeft] = useState(reduced);
  useEffect(() => {
    const t = setTimeout(() => setLeft(true), 30);
    return () => clearTimeout(t);
  }, []);

  const p = SCENE_MS.play;
  const atHand = !left && stage.phase === "rise";
  const dropping = stage.phase === "drop" && stage.target;
  const at = atHand
    ? { ...stage.from, w: stage.fromW }
    : dropping
      ? { ...stage.target!, w: stage.targetW ?? stage.holdW }
      : { ...stage.hold, w: stage.holdW };
  const h = Math.round(at.w * ASPECT);
  const moveMs =
    stage.phase === "rise" ? getScaledDuration(p.rise) : dropping ? getScaledDuration(stage.heavy ? p.dropHeavy : p.drop) : 0;
  const ease =
    stage.phase === "rise" ? "cubic-bezier(0.16, 1, 0.3, 1)" : stage.heavy ? "cubic-bezier(0.7, 0, 0.9, 0.4)" : "cubic-bezier(0.45, 0, 0.25, 1)";
  const used = stage.phase === "used";
  const usedMs = getScaledDuration(p.used);

  return (
    <div className="pointer-events-none fixed inset-0 z-[56]" aria-hidden data-testid="play-card-stage" data-phase={stage.phase}>
      <div
        className="absolute [perspective:1000px]"
        style={{
          left: at.x - at.w / 2,
          top: at.y - h / 2,
          width: at.w,
          height: h,
          opacity: used ? 0 : 1,
          transform: used ? "scale(1.35)" : "scale(1)",
          transition: reduced ? undefined : [
            moveMs ? `left ${moveMs}ms ${ease}, top ${moveMs}ms ${ease}, width ${moveMs}ms ${ease}, height ${moveMs}ms ${ease}` : "",
            used ? `opacity ${usedMs}ms ease-out, transform ${usedMs}ms ease-out` : "",
          ]
            .filter(Boolean)
            .join(", ") || undefined,
        }}
      >
        <div
          className="relative h-full w-full [transform-style:preserve-3d]"
          style={{ transform: atHand ? "rotateY(0deg)" : "rotateY(180deg)", transition: reduced ? undefined : `transform ${getScaledDuration(p.rise)}ms cubic-bezier(0.3, 0.7, 0.3, 1)` }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-arena border border-primary/50 bg-slate-950 [backface-visibility:hidden]">
            <img src={cardBackUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div
            className={cn(
              "absolute inset-0 overflow-hidden rounded-arena border bg-slate-950 [backface-visibility:hidden]",
              stage.opponent ? "border-rose-400 shadow-[0_0_26px_rgba(244,63,94,0.5)]" : "border-cyan-300 shadow-[0_0_26px_rgba(34,211,238,0.55)]",
            )}
            style={{ transform: "rotateY(180deg)" }}
          >
            <CardFace
              nameEn={stage.card.def.nameEn}
              code={stage.card.def.code}
              art={art ?? {}}
              size="lg"
              style={{ width: "100%", height: "100%" }}
              className="!h-full !w-full"
              backFallback={stage.card.def.cardType ? isGenericArtCard(stage.card.def.cardType, stage.card.def.isToken) : false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
