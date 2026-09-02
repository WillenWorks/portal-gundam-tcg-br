/* Fase D do redesenho visual — leque plano da mão. Cartas sobrepostas na
 * horizontal (margin-left negativo derivado de `overlap`), SEM curvar num arco.
 * A carta em foco (hover / teclado) sobe e ganha z-index, desencobrindo a
 * vizinha. Referência: leque com hover-lift de Hearthstone / Master Duel.
 *
 * Componente apresentacional puro: recebe as cartas já classificadas
 * (`playable` + `blockedReason`) e só encaminha o clique/Enter via `onPeek` —
 * o preview/modos de jogo e o modal são de outro componente. Cobre o mesmo que
 * o `renderHandCard` da página: pip de custo, faixa AP/HP pra Unit, máscara
 * (dimmed) quando injogável, clique abre o preview. */
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { CardInstance } from "@/modules/simulator/engine/types";
import { CardFace } from "./CardFace";
import type { ArtLookup } from "./cardArt";

export interface HandFanCard {
  card: CardInstance;
  playable: boolean;
  /** motivo curto em PT — mostrado via `title` e embutido no rótulo acessível. */
  blockedReason?: string;
}

interface HandFanProps {
  cards: HandFanCard[];
  art: ArtLookup;
  /** clique / Enter numa carta — o pai abre o preview (e os modos de jogo). */
  onPeek: (card: CardInstance) => void;
  /** fração de sobreposição entre cartas vizinhas (0..1). */
  overlap?: number;
  emptyLabel?: string;
}

const DEFAULT_OVERLAP = 0.42;
/** teto de sobreposição — acima disto a carta vira uma lasca ilegível. */
const MAX_OVERLAP = 0.85;

export function HandFan({ cards, art, onPeek, overlap = DEFAULT_OVERLAP, emptyLabel = "Mão vazia." }: HandFanProps) {
  if (cards.length === 0) {
    return (
      <p className="px-2 py-4 text-center text-[11px] uppercase tracking-[0.18em] text-muted-portal">{emptyLabel}</p>
    );
  }

  const clampedOverlap = Math.min(MAX_OVERLAP, Math.max(0, overlap));
  const overlapMargin = `calc(var(--card, 3.5rem) * -${clampedOverlap})`;

  return (
    // Quando o leque cabe: `w-max` + `mx-auto` centram. Quando não cabe:
    // `overflow-x-auto` rola. `pt-9` dá folga pro lift (-translate-y-4) e pro anel de foco.
    <div className="w-full overflow-x-auto overscroll-x-contain">
      <div className="mx-auto flex w-max min-w-max items-end px-4 pb-2 pt-9">
        {cards.map((entry, index) => {
          const { card, playable, blockedReason } = entry;
          const cost = card.def.cost;
          const label = [
            card.def.nameEn,
            cost !== undefined ? `custo ${cost}` : null,
            playable ? "jogável" : (blockedReason ?? "indisponível"),
          ]
            .filter(Boolean)
            .join(" · ");

          const style: CSSProperties = index === 0 ? {} : { marginLeft: overlapMargin };

          return (
            <button
              key={card.instanceId}
              type="button"
              onClick={() => onPeek(card)}
              title={blockedReason}
              aria-label={label}
              data-playable={playable}
              style={style}
              className={cn(
                "relative block shrink-0 border-t-2 bg-slate-950/80 transition-transform duration-100 ease-out",
                "hover:z-20 hover:-translate-y-4 focus-visible:z-20 focus-visible:-translate-y-4",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                "motion-reduce:transition-none",
                playable ? "border-primary" : "border-transparent",
              )}
            >
              <CardFace
                nameEn={card.def.nameEn}
                code={card.def.code}
                art={art}
                size="md"
                dimmed={!playable}
                style={{ width: "var(--card, 3.5rem)" }}
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
