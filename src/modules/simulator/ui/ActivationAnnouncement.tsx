/* Spec simulador-ritmo-de-resolucao — anúncio de habilidade: a carta cuja habilidade vai resolver sai do lugar dela,
 * fica em destaque com o selo do gatilho (【Deploy】, 【Attack】, 【Burst】…) e volta, e só então o que o efeito fez
 * aparece na mesa. Mesmo anúncio para o jogador e para o oponente (lado e cor mudam), como o "chain" do Master Duel.
 * Fases controladas em JS, como `CommandCastAnimation`, pra escalar pela velocidade (`animationSettings.ts`).
 *
 * Componente APRESENTACIONAL e auto-contido: overlay `fixed` (`pointer-events-none`). */
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { CardDef } from "@/modules/simulator/engine/types";
import { getScaledDuration } from "./animationSettings";
import { artSrc, cardBackUrl, isGenericArtCard, type ArtLookup } from "./cardArt";
import { triggerLabel } from "../scene/choreography";
import { SCENE_MS } from "../scene/sceneTiming";
import { useSceneSound } from "../audio/useSceneSound";
import { announceSound } from "../scene/soundCues";
import { useSiteLanguage } from "@/i18n/siteLanguage";

export interface ActivationPoint {
  x: number;
  y: number;
}

interface ActivationAnnouncementProps {
  cardDef: CardDef;
  art: ArtLookup;
  trigger: string;
  /** habilidade do próprio jogador (embaixo, ciano) ou do oponente (em cima, vermelho) */
  mine: boolean;
  /** centro da carta na mesa — `null` (carta que acabou de entrar) sai do centro */
  origin: ActivationPoint | null;
  cardW: number;
  /** ritmo do lote (`tempoFor`): lote longo encurta */
  tempo?: number;
  /** para onde a carta vai no fim (carta entrando em campo); sem isto ela volta para `origin` */
  dest?: ActivationPoint | null;
  /** selo no lugar do gatilho, e a linha de baixo (ex.: "Oponente implanta") */
  label?: { pt: string; en: string };
  caption?: { pt: string; en: string };
  holdBaseMs?: number;
  onDone: () => void;
}

const { rise: RISE_BASE_MS, hold: HOLD_BASE_MS, out: OUT_BASE_MS } = SCENE_MS.announce;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

export function ActivationAnnouncement({
  cardDef,
  art,
  trigger,
  mine,
  origin,
  cardW,
  tempo = 1,
  dest,
  label: labelOverride,
  caption,
  holdBaseMs = HOLD_BASE_MS,
  onDone,
}: ActivationAnnouncementProps) {
  const { tr } = useSiteLanguage();
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const [phase, setPhase] = useState<"rise" | "hold" | "out">(reduced ? "hold" : "rise");
  const [bigLoaded, setBigLoaded] = useState(false);
  const riseMs = useMemo(() => getScaledDuration(RISE_BASE_MS * tempo), [tempo]);
  const holdMs = useMemo(() => getScaledDuration(holdBaseMs * tempo), [holdBaseMs, tempo]);
  const outMs = useMemo(() => getScaledDuration(OUT_BASE_MS * tempo), [tempo]);

  // o selo assenta no fim da subida: é ali que o som estoura
  useSceneSound(announceSound(trigger), { alignImpactAtMs: reduced ? 0 : RISE_BASE_MS * tempo });

  useEffect(() => {
    if (reduced) {
      // sem movimento: o selo aparece parado, por menos tempo
      const t = setTimeout(onDone, Math.round(holdMs * 0.6));
      return () => clearTimeout(t);
    }
    const raf = requestAnimationFrame(() => setPhase("hold"));
    const t1 = setTimeout(() => setPhase("out"), riseMs + holdMs);
    const t2 = setTimeout(onDone, riseMs + holdMs + outMs);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // 1 instância = 1 anúncio; quem chama troca a `key` para o próximo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasWindow = typeof window !== "undefined";
  const vw = hasWindow ? window.innerWidth : 1000;
  const vh = hasWindow ? window.innerHeight : 700;
  const anchorX = vw / 2;
  const anchorY = vh * (mine ? 0.56 : 0.4);
  const fromX = origin?.x ?? anchorX;
  const fromY = origin?.y ?? anchorY;
  const atAnchor = phase === "hold";
  const leaving = phase === "out" && dest ? dest : null;
  const x = atAnchor ? anchorX : (leaving?.x ?? fromX);
  const y = atAnchor ? anchorY : (leaving?.y ?? fromY);

  const w = Math.max(cardW, 1);
  const h = Math.round(w * (88 / 63));
  const showFace = Boolean(cardDef.code && cardDef.cardType && !isGenericArtCard(cardDef.cardType, cardDef.isToken));
  // a arte pequena (a da mesa) aparece na hora; a grande entra por cima quando terminar de baixar — carta do
  // oponente nunca vista ainda não está em cache, e a grande sozinha deixava o anúncio com a carta preta
  const small = showFace ? artSrc(art, cardDef.code, "sm") : undefined;
  const big = showFace ? artSrc(art, cardDef.code, "lg") : undefined;
  const label = labelOverride ?? triggerLabel(trigger);
  const burst = trigger === "Burst";
  const tone = burst
    ? "border-amber-300 shadow-[0_0_36px_rgba(251,191,36,0.9),0_0_70px_rgba(245,158,11,0.45)]"
    : mine
      ? "border-cyan-300 shadow-[0_0_36px_rgba(34,211,238,0.9),0_0_70px_rgba(56,189,248,0.4)]"
      : "border-rose-400 shadow-[0_0_36px_rgba(244,63,94,0.85),0_0_70px_rgba(244,63,94,0.35)]";
  const chip = burst
    ? "from-amber-400 to-yellow-200"
    : mine
      ? "from-cyan-400 to-sky-200"
      : "from-rose-500 to-orange-300";

  return (
    <div className="pointer-events-none fixed inset-0 z-[58]" data-testid="activation-announcement" aria-live="polite">
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: `${w}px`,
          height: `${h}px`,
          marginLeft: `${-w / 2}px`,
          marginTop: `${-h / 2}px`,
          transform: `scale(${atAnchor ? 1.7 : 0.9})`,
          opacity: phase === "out" ? 0 : 1,
          transition: reduced
            ? undefined
            : phase === "out"
              ? `left ${outMs}ms ease-in, top ${outMs}ms ease-in, transform ${outMs}ms ease-in, opacity ${outMs}ms ease-in`
              : `left ${riseMs}ms cubic-bezier(0.16, 1, 0.3, 1), top ${riseMs}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${riseMs}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        }}
        className={cn("overflow-hidden rounded-arena border-2 bg-slate-950", tone)}
      >
        <img src={small ?? big ?? cardBackUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        {big && big !== small ? (
          <img
            src={big}
            alt=""
            onLoad={() => setBigLoaded(true)}
            className={cn("absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-150", bigLoaded ? "opacity-100" : "opacity-0")}
          />
        ) : null}
      </div>
      {atAnchor ? (
        <div
          style={{ left: anchorX, top: anchorY + h * 0.85 + 8 }}
          className="absolute flex -translate-x-1/2 flex-col items-center gap-1 whitespace-nowrap"
        >
          <span className={cn("rounded-arena bg-gradient-to-r px-3 py-1 text-sm font-black tracking-wide text-black", chip)}>
            {tr(label.pt, label.en)}
          </span>
          <span className="rounded-arena bg-slate-950/85 px-2 py-0.5 text-[11px] font-semibold text-slate-100">
            {caption ? tr(caption.pt, caption.en) : mine ? tr("Você ativa", "You activate") : tr("Oponente ativa", "Opponent activates")} ·{" "}
            {cardDef.nameEn}
          </span>
        </div>
      ) : null}
    </div>
  );
}
