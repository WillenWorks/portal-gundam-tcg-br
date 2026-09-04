/* Fase D do redesenho visual — leque plano da mão. Cartas sobrepostas na
 * horizontal (margin-left negativo derivado de `overlap`), SEM curvar num arco.
 * A carta em foco (hover / teclado) sobe e ganha z-index, desencobrindo a
 * vizinha. Referência: leque com hover-lift de Hearthstone / Master Duel.
 *
 * Rodada Willen 2026-09-03 (capturas 6 + ajuste):
 *  - MAIS espaço entre cartas em repouso; só aperta o overlap quando a mão
 *    cresce (`overlapFor`).
 *  - Cluster no canto sup. direito (`CardCornerActions`): "Ver" (olho) SEMPRE;
 *    "Jogar" (play) à esquerda dele quando a carta é jogável. O corpo da carta
 *    NÃO é mais clicável (removido o conflito com a ação).
 * `onHoverCard` alimenta o `CardInspectorPanel` das asas largas. */
import type { CSSProperties } from "react";
import { Eye, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardInstance } from "@/modules/simulator/engine/types";
import { CardCornerActions, type CornerAction } from "./CardCornerActions";
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
  /** botão "Ver" (olho) — abre a modal de zoom (jogável ou não). */
  onInspect?: (card: CardInstance) => void;
  /** hover / foco numa carta (ou `null` ao sair) — alimenta o inspetor lateral. */
  onHoverCard?: (card: CardInstance | null) => void;
  /** override manual da sobreposição (0..1). Default: derivado da qtd de cartas. */
  overlap?: number;
  emptyLabel?: string;
  /** prateleira ancorada na base da arena (overlap + hover-lift, sem corte). */
  anchored?: boolean;
}

/** teto de sobreposição — acima disto a carta vira uma lasca ilegível. */
const MAX_OVERLAP = 0.72;

/** Mão pequena = quase sem overlap (cartas espaçadas, capturas 6); só aperta
 *  quando passa de ~6 cartas. */
function overlapFor(count: number): number {
  if (count <= 6) return 0.12;
  return Math.min(MAX_OVERLAP, 0.12 + (count - 6) * 0.07);
}

export function HandFan({
  cards,
  art,
  onPeek,
  onInspect,
  onHoverCard,
  overlap,
  emptyLabel = "Mão vazia.",
  anchored,
}: HandFanProps) {
  if (cards.length === 0) {
    return (
      <p className="px-2 py-4 text-center text-[11px] uppercase tracking-[0.18em] text-muted-portal">{emptyLabel}</p>
    );
  }

  const clampedOverlap = Math.min(MAX_OVERLAP, Math.max(0, overlap ?? overlapFor(cards.length)));
  const overlapMargin = `calc(var(--card-w, 3.5rem) * -${clampedOverlap})`;
  const lift = anchored
    ? "hover:-translate-y-6 focus-within:-translate-y-6"
    : "hover:-translate-y-4 focus-within:-translate-y-4";

  return (
    <div className="scrollbar-ghost w-full overflow-x-auto overflow-y-visible overscroll-x-contain">
      <div className={cn("mx-auto flex w-max min-w-max items-end px-4", anchored ? "pt-8 pb-1" : "pb-2 pt-9")}>
        {cards.map((entry, index) => {
          const { card, playable, blockedReason } = entry;
          const cost = card.def.cost;
          const state = playable ? "jogável" : (blockedReason ?? "indisponível");
          const style: CSSProperties = index === 0 ? {} : { marginLeft: overlapMargin };

          // "Ver" sempre; "Jogar" à esquerda dele quando dá pra jogar.
          const cornerActions: CornerAction[] = [];
          if (playable) {
            cornerActions.push({
              key: "play",
              icon: Play,
              label: `Jogar ${card.def.nameEn}${cost !== undefined ? ` · custo ${cost}` : ""}`,
              tone: "primary",
              onClick: () => onPeek(card),
            });
          }
          if (onInspect) {
            cornerActions.push({
              key: "view",
              icon: Eye,
              label: `Ver ${card.def.nameEn} · ${state}`,
              tone: "view",
              onClick: () => onInspect(card),
            });
          }

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
                playable ? "border-primary shadow-[0_0_12px_rgba(6,182,212,0.5)]" : "border-transparent",
              )}
            >
              {/* só a ARTE fica em P&B quando injogável — os botões do canto não. */}
              <div className={cn("block w-full", playable ? "" : "[filter:grayscale(1)_brightness(0.65)]")}>
                <CardFace
                  nameEn={card.def.nameEn}
                  code={card.def.code}
                  art={art}
                  size="md"
                  style={{ width: "var(--card-w, 3.5rem)" }}
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
              </div>

              <CardCornerActions actions={cornerActions} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
