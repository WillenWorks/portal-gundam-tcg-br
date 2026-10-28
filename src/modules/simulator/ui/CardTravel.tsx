/* Spec simulador-cadencia-de-mesa (P2) — uma carta viajando de um lugar da mesa para outro, já no tamanho de cada
 * ponta (medido na tela pelo pai). Dois jeitos:
 *  - `viaCenter` (a minha compra): sai do deck, vem ao centro maior, vira, fica à mostra e pousa à direita da mão;
 *  - direto (a compra do oponente, o recurso): vai reto do deck ao destino; `flipOnArrival` vira no caminho.
 * A cena dura `totalMs` nas duas telas (o servidor espera o mesmo): a viagem direta termina antes e o resto é espera.
 * Overlay `fixed`, `pointer-events-none`; o 3D fica só na carta. */
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getScaledDuration } from "./animationSettings";
import { cardBackUrl, isGenericArtCard, type ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";

export interface TravelPoint {
  x: number;
  y: number;
}

export interface TravelCard {
  def: { code: string; nameEn: string; cardType?: string; isToken?: boolean };
}

interface CardTravelProps {
  from: TravelPoint | null;
  to: TravelPoint | null;
  /** largura da carta na origem e no destino (px) */
  fromW: number;
  toW: number;
  /** face revelada (sem ela, a carta viaja de verso) */
  card?: TravelCard | null;
  art?: ArtLookup;
  viaCenter?: boolean;
  flipOnArrival?: boolean;
  /** tempos-base (ms, antes da velocidade do jogador) */
  timings: { rise: number; flip: number; hold: number; land: number };
  /** duração da cena inteira (ms-base); a viagem direta usa `rise + land` e espera o resto */
  totalMs: number;
  onDone: () => void;
}

type Phase = "start" | "center" | "flip" | "land" | "travel" | "done";

const ASPECT = 88 / 63;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

/** a carta à mostra no centro: grande o bastante para ler, nunca maior que a tela */
export function centerCardWidth(viewportW: number, viewportH: number): number {
  return Math.round(Math.min(220, viewportW * 0.3, (viewportH * 0.42) / ASPECT));
}

export function CardTravel(props: CardTravelProps) {
  const { card, art, viaCenter, flipOnArrival, timings, totalMs, onDone } = props;
  // a geometria fica a da montagem: o pai re-renderiza a cada segundo (relógio) e mede de novo, o que reiniciaria a
  // viagem no meio
  const [{ from, to, fromW, toW }] = useState(() => ({ from: props.from, to: props.to, fromW: props.fromW, toW: props.toW }));
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<Phase>("start");
  const ms = useMemo(
    () => ({
      rise: getScaledDuration(timings.rise),
      flip: getScaledDuration(timings.flip),
      hold: getScaledDuration(timings.hold),
      land: getScaledDuration(timings.land),
      total: getScaledDuration(totalMs),
    }),
    [timings.rise, timings.flip, timings.hold, timings.land, totalMs],
  );
  // o pai re-renderiza a cada segundo (relógio): o callback vai por ref para os timers não reiniciarem
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (reduced || !from || !to) {
      const t = setTimeout(() => onDoneRef.current(), reduced ? Math.min(ms.total, 200) : ms.total);
      return () => clearTimeout(t);
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    // um quadro na origem antes de sair, para a transição ter de onde partir
    timers.push(setTimeout(() => setPhase(viaCenter ? "center" : "travel"), 30));
    if (viaCenter) {
      timers.push(setTimeout(() => setPhase("flip"), 30 + ms.rise));
      timers.push(setTimeout(() => setPhase("land"), 30 + ms.rise + ms.flip + ms.hold));
      timers.push(setTimeout(() => setPhase("done"), 30 + ms.rise + ms.flip + ms.hold + ms.land));
    } else {
      timers.push(setTimeout(() => setPhase("done"), 30 + ms.rise + ms.land));
    }
    timers.push(setTimeout(() => onDoneRef.current(), Math.max(ms.total, 30 + ms.rise + ms.land)));
    return () => timers.forEach(clearTimeout);
  }, [reduced, from, to, viaCenter, ms]);

  if (reduced || !from || !to || phase === "done") return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const centerW = centerCardWidth(vw, vh);
  const at =
    phase === "start"
      ? { ...from, w: fromW }
      : phase === "center" || phase === "flip"
        ? { x: vw / 2, y: vh / 2, w: centerW }
        : { ...to, w: toW };
  const faceUp = Boolean(card) && (phase === "flip" || phase === "land" || (flipOnArrival && phase === "travel"));
  const moveMs = phase === "center" ? ms.rise : phase === "travel" ? ms.rise + ms.land : phase === "land" ? ms.land : 0;
  const ease = phase === "center" ? "cubic-bezier(0.16, 1, 0.3, 1)" : "cubic-bezier(0.45, 0, 0.25, 1)";
  const flipMs = phase === "flip" ? ms.flip : phase === "travel" ? ms.rise + ms.land : ms.flip;
  const h = Math.round(at.w * ASPECT);

  return (
    <div className="pointer-events-none fixed inset-0 z-[56]" aria-hidden data-testid="card-travel" data-phase={phase}>
      <div
        className="absolute [perspective:1000px]"
        style={{
          left: at.x - at.w / 2,
          top: at.y - h / 2,
          width: at.w,
          height: h,
          transition: moveMs ? `left ${moveMs}ms ${ease}, top ${moveMs}ms ${ease}, width ${moveMs}ms ${ease}, height ${moveMs}ms ${ease}` : undefined,
        }}
      >
        <div
          className="relative h-full w-full [transform-style:preserve-3d]"
          style={{ transform: faceUp ? "rotateY(180deg)" : "rotateY(0deg)", transition: `transform ${flipMs}ms cubic-bezier(0.3, 0.7, 0.3, 1)` }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-arena border border-primary/50 bg-slate-950 shadow-[0_10px_30px_rgba(0,0,0,0.7)] [backface-visibility:hidden]">
            <img src={cardBackUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div
            className={cn(
              "absolute inset-0 overflow-hidden rounded-arena border border-cyan-300 bg-slate-950 [backface-visibility:hidden]",
              viaCenter && "shadow-[0_0_28px_rgba(34,211,238,0.55)]",
            )}
            style={{ transform: "rotateY(180deg)" }}
          >
            {card ? (
              <CardFace
                nameEn={card.def.nameEn}
                code={card.def.code}
                art={art ?? {}}
                size={viaCenter ? "lg" : "md"}
                style={{ width: "100%", height: "100%" }}
                className="!h-full !w-full"
                backFallback={card.def.cardType ? isGenericArtCard(card.def.cardType, card.def.isToken) : false}
              />
            ) : (
              <img src={cardBackUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
