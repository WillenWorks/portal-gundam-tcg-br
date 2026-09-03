/* Fase D do redesenho visual — leque plano da mão. Cartas sobrepostas na
 * horizontal (margin-left negativo derivado de `overlap`), SEM curvar num arco.
 * A carta em foco (hover / teclado) sobe e ganha z-index, desencobrindo a
 * vizinha. Referência: leque com hover-lift de Hearthstone / Master Duel.
 *
 * Sprint 6 · P3 — modo `anchored` (prateleira de comando na base da arena): a
 * carta NÃO é mais cortada no rodapé (só overlap + hover-lift dão o efeito de
 * prateleira); custo/nome/nível e a arte ficam legíveis em repouso, sem hover.
 * Cada carta tem 2 controles sempre visíveis (touch-friendly, sem depender de
 * hover): "Jogar" (dispara `onPeek` — joga direto / avisa / abre modal dual) e
 * "Ver" (`onViewCard` — abre a modal de zoom SÓ pra ler, jogável ou não).
 * `onHoverCard` alimenta o `CardInspectorPanel` das asas largas. */
import type { CSSProperties } from "react";
import { Eye, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardInstance } from "@/modules/simulator/engine/types";
import { CardFace } from "./CardFace";
import { isGenericArtCard, type ArtLookup } from "./cardArt";

export interface HandFanCard {
  card: CardInstance;
  playable: boolean;
  /** motivo curto em PT — mostrado via `title` e embutido no rótulo acessível. */
  blockedReason?: string;
}

interface HandFanProps {
  cards: HandFanCard[];
  art: ArtLookup;
  /** botão "Jogar" — o pai joga direto / avisa / abre modal dual. */
  onPeek: (card: CardInstance) => void;
  /** botão "Ver" — o pai abre a modal de zoom só pra leitura (jogável ou não). */
  onViewCard?: (card: CardInstance) => void;
  /** hover / foco numa carta (ou `null` ao sair) — alimenta o inspetor lateral. */
  onHoverCard?: (card: CardInstance | null) => void;
  /** fração de sobreposição entre cartas vizinhas (0..1). */
  overlap?: number;
  emptyLabel?: string;
  /** prateleira ancorada na base da arena (overlap + hover-lift, sem corte). */
  anchored?: boolean;
}

const DEFAULT_OVERLAP = 0.42;
/** teto de sobreposição — acima disto a carta vira uma lasca ilegível. */
const MAX_OVERLAP = 0.85;

export function HandFan({
  cards,
  art,
  onPeek,
  onViewCard,
  onHoverCard,
  overlap = DEFAULT_OVERLAP,
  emptyLabel = "Mão vazia.",
  anchored,
}: HandFanProps) {
  if (cards.length === 0) {
    return (
      <p className="px-2 py-4 text-center text-[11px] uppercase tracking-[0.18em] text-muted-portal">{emptyLabel}</p>
    );
  }

  const clampedOverlap = Math.min(MAX_OVERLAP, Math.max(0, overlap));
  const overlapMargin = `calc(var(--card, 3.5rem) * -${clampedOverlap})`;
  const lift = anchored
    ? "hover:-translate-y-6 focus-within:-translate-y-6"
    : "hover:-translate-y-4 focus-within:-translate-y-4";

  return (
    <div className="w-full overflow-x-auto overflow-y-visible overscroll-x-contain">
      <div className={cn("mx-auto flex w-max min-w-max items-end px-4", anchored ? "pt-8 pb-1" : "pb-2 pt-9")}>
        {cards.map((entry, index) => {
          const { card, playable, blockedReason } = entry;
          const cost = card.def.cost;
          const state = playable ? "jogável" : (blockedReason ?? "indisponível");
          const style: CSSProperties = index === 0 ? {} : { marginLeft: overlapMargin };

          return (
            <div
              key={card.instanceId}
              data-playable={playable}
              title={blockedReason}
              style={style}
              onMouseEnter={onHoverCard ? () => onHoverCard(card) : undefined}
              onMouseLeave={onHoverCard ? () => onHoverCard(null) : undefined}
              onFocus={onHoverCard ? () => onHoverCard(card) : undefined}
              onBlur={onHoverCard ? () => onHoverCard(null) : undefined}
              className={cn(
                "group/hc relative block shrink-0 border-t-2 bg-slate-950/80 transition-transform duration-100 ease-out",
                "hover:z-20 focus-within:z-20 motion-reduce:transition-none",
                lift,
                playable
                  ? "border-primary shadow-[0_0_12px_rgba(6,182,212,0.5)]"
                  : "border-transparent [filter:grayscale(1)_brightness(0.65)]",
              )}
            >
              <CardFace
                nameEn={card.def.nameEn}
                code={card.def.code}
                art={art}
                size="md"
                style={{ width: "var(--card, 3.5rem)" }}
                backFallback={isGenericArtCard(card.def.cardType, card.def.isToken)}
              >
                {cost !== undefined ? (
                  <span className="absolute left-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-black">
                    {cost}
                  </span>
                ) : null}
                {card.def.cardType === "UNIT" ? (
                  <div className="absolute inset-x-0 bottom-0 flex text-[9px] font-black">
                    <span className="flex-1 bg-cyan-600/90 py-0.5 text-center text-white">{card.def.ap ?? 0}</span>
                    <span className="flex-1 bg-slate-700/90 py-0.5 text-center text-white">{card.def.hp ?? 0}</span>
                  </div>
                ) : null}
              </CardFace>

              {/* P2 — controles flutuantes AGARRADOS NO TOPO da carta (não tapam
                  a arte nem o pip de custo). Sempre visíveis (touch-friendly). */}
              <div className="absolute -top-5 inset-x-0 z-20 flex justify-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onPeek(card)}
                  title={`Jogar ${card.def.nameEn}${cost !== undefined ? ` · custo ${cost}` : ""}`}
                  aria-label={`Jogar ${card.def.nameEn} · ${cost !== undefined ? `custo ${cost} · ` : ""}${state}`}
                  className={cn(
                    "flex size-5 items-center justify-center rounded-none border border-black/30 shadow-lg transition-colors motion-reduce:transition-none",
                    playable ? "bg-primary/95 text-black hover:bg-primary" : "bg-slate-800/95 text-slate-300 hover:bg-slate-700",
                  )}
                >
                  <Play className="size-3" aria-hidden />
                </button>
                {onViewCard ? (
                  <button
                    type="button"
                    onClick={() => onViewCard(card)}
                    title={`Ver ${card.def.nameEn}`}
                    aria-label={`Ver ${card.def.nameEn}`}
                    className="flex size-5 items-center justify-center rounded-none border border-black/30 bg-slate-900/95 text-slate-200 shadow-lg transition-colors hover:text-primary motion-reduce:transition-none"
                  >
                    <Eye className="size-3" aria-hidden />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
