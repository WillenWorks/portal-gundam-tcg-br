/* Spec simulador-cadencia-de-mesa (P1) — sorteio de quem começa, como uma moeda de verdade: ela aparece num lado
 * qualquer, sobe girando, cai girando até parar no lado sorteado, e só então o aviso diz quem começa. Cara (logo do
 * Anaheim Hub) é "você", coroa (monograma "A.H.") é o oponente — cada um vê a moeda do próprio ponto de vista.
 *
 * O sorteio em si é do servidor (`activePlayer` da visão); aqui é só a cena. Tempos de `SCENE_MS.opening.coin`
 * (o servidor espera a mesma duração). Overlay `fixed`, `pointer-events-none`: o 3D fica só na moeda. */
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useSiteLanguage } from "@/i18n/siteLanguage";
import { sampleSfx } from "../audio/sampleEngine";
import { SCENE_MS } from "../scene/sceneTiming";
import { effectiveAnimSpeed, getScaledDuration } from "./animationSettings";
import { AhMonogram, AnaheimLogoFace } from "./CoinFaces";

export type CoinFace = "heads" | "tails";

const SPINS = 5;

/**
 * Giro da moeda (graus em X): parte do lado inicial, passa pelo alto no meio do giro e termina no lado de quem
 * começa (0° mostra a cara, 180° a coroa).
 */
export function coinRotation(start: CoinFace, goesFirst: boolean): { startDeg: number; apexDeg: number; finalDeg: number } {
  const startDeg = start === "heads" ? 0 : 180;
  const target = goesFirst ? 0 : 180;
  const diff = (((target - startDeg) % 360) + 360) % 360;
  const finalDeg = startDeg + SPINS * 360 + diff;
  return { startDeg, apexDeg: startDeg + (finalDeg - startDeg) / 2, finalDeg };
}

type Phase = "idle" | "up" | "down" | "settle" | "result";

interface CoinTossProps {
  goesFirst: boolean;
  onDone: () => void;
  /** lado em que a moeda aparece (padrão: sorteado na montagem) */
  startFace?: CoinFace;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

export function CoinToss({ goesFirst, onDone, startFace }: CoinTossProps) {
  const { tr } = useSiteLanguage();
  const [start] = useState<CoinFace>(() => startFace ?? (Math.random() < 0.5 ? "heads" : "tails"));
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<Phase>(reduced ? "result" : "idle");
  const ms = useMemo(
    () => ({
      idle: getScaledDuration(SCENE_MS.opening.coin.idle),
      up: getScaledDuration(SCENE_MS.opening.coin.up),
      down: getScaledDuration(SCENE_MS.opening.coin.down),
      settle: getScaledDuration(SCENE_MS.opening.coin.settle),
      result: getScaledDuration(SCENE_MS.opening.coin.result),
    }),
    [],
  );
  const rotation = coinRotation(start, goesFirst);
  // o pai re-renderiza a cada segundo (relógio): o callback vai por ref para os timers não reiniciarem
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => onDoneRef.current(), ms.result);
      return () => clearTimeout(t);
    }
    const at = { up: ms.idle, down: ms.idle + ms.up, settle: ms.idle + ms.up + ms.down };
    const result = at.settle + ms.settle;
    const scope = sampleSfx.scope();
    const speed = effectiveAnimSpeed();
    const timers = [
      setTimeout(() => {
        setPhase("up");
        scope.play("coin.flip", { speed });
      }, at.up),
      setTimeout(() => setPhase("down"), at.down),
      setTimeout(() => {
        setPhase("settle");
        scope.play("coin.land", { speed });
      }, at.settle),
      setTimeout(() => {
        setPhase("result");
        if (goesFirst) scope.play("ability.announce", { speed, untilMs: ms.result });
      }, result),
      setTimeout(() => onDoneRef.current(), result + ms.result),
    ];
    return () => {
      timers.forEach(clearTimeout);
      scope.end();
    };
  }, [reduced, ms, goesFirst]);

  const deg = phase === "idle" ? rotation.startDeg : phase === "up" ? rotation.apexDeg : rotation.finalDeg;
  const lift = phase === "up" ? "-34vh" : phase === "settle" ? "-1.5vh" : "0px";
  const transition =
    phase === "up"
      ? `transform ${ms.up}ms cubic-bezier(0.2, 0.7, 0.4, 1)`
      : phase === "down"
        ? `transform ${ms.down}ms cubic-bezier(0.55, 0, 0.85, 0.45)`
        : phase === "settle"
          ? `transform ${Math.round(ms.settle / 2)}ms ease-out`
          : `transform ${ms.settle}ms ease-in`;
  const shown = phase === "result";

  return (
    <div className="pointer-events-none fixed inset-0 z-[55] flex flex-col items-center justify-center gap-5 bg-slate-950/75 backdrop-blur-sm" data-testid="coin-toss">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-portal">{tr("Sorteio de iniciativa", "Who goes first")}</p>
      <div className="[perspective:900px]">
        <div
          data-testid="coin"
          data-face={shown || phase === "settle" ? (goesFirst ? "heads" : "tails") : undefined}
          className="relative size-[min(34vw,34vh,11rem)] [transform-style:preserve-3d]"
          style={{ transform: `translateY(${lift}) rotateX(${deg}deg)`, transition }}
        >
          <CoinSide face="heads" />
          <CoinSide face="tails" />
        </div>
      </div>
      <div className="flex min-h-[4.5rem] flex-col items-center gap-1 text-center">
        {shown ? (
          <>
            <p
              className={cn(
                "text-2xl font-black uppercase tracking-[0.08em] animate-in zoom-in-95 fade-in duration-300 sm:text-3xl",
                goesFirst ? "text-primary" : "text-amber-300",
              )}
            >
              {goesFirst ? tr("Você começa", "You go first") : tr("Oponente começa", "Opponent goes first")}
            </p>
            <p className="text-xs text-muted-portal">
              {goesFirst ? tr("Deu cara: Anaheim Hub", "Heads: Anaheim Hub") : tr("Deu coroa: A.H.", "Tails: A.H.")}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-portal">{tr("Cara (Anaheim Hub): você · Coroa (A.H.): oponente", "Heads (Anaheim Hub): you · Tails (A.H.): opponent")}</p>
        )}
      </div>
    </div>
  );
}

function CoinSide({ face }: { face: CoinFace }) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center rounded-full [backface-visibility:hidden]",
        // metal prateado com o brilho ciano do site (a identidade do Anaheim Hub, não o dourado genérico)
        "border-[0.3rem] border-slate-200 bg-[radial-gradient(circle_at_35%_30%,#1e293b_0%,#0b1220_62%,#020617_100%)]",
        "shadow-[0_0_0_2px_rgba(34,211,238,0.55),0_0_32px_rgba(34,211,238,0.4),inset_0_0_22px_rgba(0,0,0,0.75)]",
      )}
      style={{ transform: face === "heads" ? "rotateX(0deg)" : "rotateX(180deg)" }}
    >
      {face === "heads" ? <AnaheimLogoFace className="size-[82%] object-contain" /> : <AhMonogram className="size-[80%]" />}
    </div>
  );
}
