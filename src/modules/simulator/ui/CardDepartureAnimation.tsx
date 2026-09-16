/* docs/56 tarefa 1 — clones translúcidos de cartas que acabaram de sair do
 * tabuleiro/mão DIRETO pro Trash ou Exílio (Unit destruída em combate/efeito,
 * carta descartada). O pai detecta a saída por DIFF de estado (posição
 * anterior já capturada no DOM antes do `setMatchView` re-renderizar — ver
 * `SimulatorMatchPage.tsx#applyIncomingView`) e monta 1 `DepartingCard` por
 * saída; este componente só anima e se autolimpa via `onDone(id)`.
 *
 * Componente APRESENTACIONAL e auto-contido: overlay `fixed` (`pointer-events-none`),
 * cada carta é independente (várias podem voar ao mesmo tempo — ex. fim de
 * turno com descarte por limite de mão + uma Unit destruída no mesmo tick). */
import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { artSrc, cardBackUrl, isGenericArtCard, type ArtLookup } from "./cardArt";
import { sfx } from "../audio/soundEffects";

/** ponto em coords de viewport (px). */
export interface DepartureDest {
  x: number;
  y: number;
}

export interface DepartingCard {
  /** chave estável — nunca reaproveitar entre saídas diferentes (ex.: `${instanceId}-${version}`). */
  id: string;
  origin: DepartureDest;
  /** `null` quando a pilha de destino ainda não tem posição medida — cai num deslize genérico pra baixo. */
  dest: DepartureDest | null;
  /** largura da carta na origem (px) — mantém o clone no tamanho real. */
  cardW: number;
  /** "destroyed" = Unit morta em combate/efeito (some com explosão); "discarded" = descarte comum (desliza liso). */
  kind: "destroyed" | "discarded";
  code?: string;
  nameEn?: string;
  cardType?: string;
  isToken?: boolean;
}

interface CardDepartureAnimationProps {
  cards: DepartingCard[];
  art?: ArtLookup;
  onDone: (id: string) => void;
}

const DEPART_MS = 420;

export function CardDepartureAnimation({ cards, art, onDone }: CardDepartureAnimationProps) {
  if (cards.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[52]" aria-hidden>
      {cards.map((c) => (
        <DepartureGhost key={c.id} card={c} art={art} onDone={onDone} />
      ))}
    </div>
  );
}

function DepartureGhost({
  card,
  art,
  onDone,
}: {
  card: DepartingCard;
  art?: ArtLookup;
  onDone: (id: string) => void;
}) {
  const reduced = useMemo(
    () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches),
    [],
  );

  useEffect(() => {
    if (card.kind === "destroyed") {
      sfx.playExplosion();
    } else {
      sfx.playCardDraw();
    }
    if (reduced) {
      onDone(card.id);
      return;
    }
    const t = setTimeout(() => onDone(card.id), DEPART_MS);
    return () => clearTimeout(t);
    // roda 1x na montagem — `card`/`onDone` não devem re-disparar o timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reduced) return null;

  const h = Math.round(card.cardW * (88 / 63));
  const dx = (card.dest?.x ?? card.origin.x) - card.origin.x;
  // sem pilha medida ainda: desliza pra baixo genericamente, nunca fica parado.
  const dy = card.dest ? card.dest.y - card.origin.y : card.cardW * 2;
  const face = (art && card.code && artSrc(art, card.code, "sm")) || cardBackUrl;
  const showFace = Boolean(art && card.code && card.cardType && !isGenericArtCard(card.cardType, card.isToken));

  return (
    <div
      style={
        {
          position: "absolute",
          left: card.origin.x,
          top: card.origin.y,
          width: `${card.cardW}px`,
          height: `${h}px`,
          marginLeft: `${-card.cardW / 2}px`,
          marginTop: `${-h / 2}px`,
          "--dx": `${dx}px`,
          "--dy": `${dy}px`,
        } as React.CSSProperties
      }
      className={cn(
        "overflow-hidden rounded-arena border-2 bg-slate-950 shadow-[0_6px_18px_rgba(0,0,0,0.7)]",
        card.kind === "destroyed"
          ? "border-red-500/80 sim-anim-depart-destroy"
          : "border-slate-400/60 sim-anim-depart",
      )}
      title={card.nameEn}
    >
      <img src={showFace ? face : cardBackUrl} alt="" className="h-full w-full object-cover object-center" />
    </div>
  );
}
