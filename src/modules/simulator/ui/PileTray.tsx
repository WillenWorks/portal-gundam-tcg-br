/* Fase C (docs/19) — pilha visual que abre uma bandeja overlay de largura total
 * (substitui o `renderPile`/`renderDeckTile` da página + a inspeção 1-a-1). Em
 * repouso é um <CounterChip variant="stack"> mostrando a última carta com o
 * número num badge de canto (Sprint 5 — sem texto "TRASH 0"); ao clicar, abre
 * uma faixa `fixed` na base da tela, `max-h-[40vh]`, com um grid rolável de
 * miniaturas. Clicar numa miniatura chama `onInspect`. O estado `open` é interno. */
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import type { CardInstance } from "@/modules/simulator/engine/types";
import { isGenericArtCard, type ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";
import { CounterChip } from "./CounterChip";

interface PileTrayProps {
  label: string;
  count: number;
  icon?: LucideIcon;
  tone?: "normal" | "warn" | "crit";
  cards: CardInstance[];
  art: ArtLookup;
  onInspect?: (card: CardInstance) => void;
}

export function PileTray({ label, count, icon, tone, cards, art, onInspect }: PileTrayProps) {
  const [open, setOpen] = useState(false);
  const topCard = cards.length > 0 ? cards[cards.length - 1] : null;

  return (
    <>
      <CounterChip
        label={label}
        count={count}
        tone={tone}
        icon={icon}
        variant="stack"
        onClick={() => setOpen(true)}
        face={
          topCard ? (
            <CardFace
              nameEn={topCard.def.nameEn}
              code={topCard.def.code}
              art={art}
              size="sm"
              className="w-full"
              backFallback={isGenericArtCard(topCard.def.cardType, topCard.def.isToken)}
            />
          ) : undefined
        }
      />
      {open ? (
        <div
          role="dialog"
          aria-label={`Pilha: ${label}`}
          className="panel-cut fixed inset-x-0 bottom-0 z-50 flex max-h-[40vh] flex-col border-t border-primary/30 bg-slate-950/95"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
              {label} <span className="font-mono font-black text-slate-100">{count}</span>
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-none border border-white/15 px-2 text-[10px] uppercase text-slate-200 transition-colors duration-100 hover:border-primary/70 motion-reduce:transition-none"
            >
              <X className="size-3.5" aria-hidden /> Fechar
            </button>
          </div>
          {cards.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-portal">Pilha vazia.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-1.5 overflow-y-auto p-3">
              {cards.map((card) => (
                <button
                  key={card.instanceId}
                  type="button"
                  onClick={() => onInspect?.(card)}
                  aria-label={card.def.nameEn}
                  className="block rounded-none border border-white/10 transition-colors duration-100 hover:border-primary/70 motion-reduce:transition-none"
                >
                  <CardFace
                    nameEn={card.def.nameEn}
                    code={card.def.code}
                    art={art}
                    size="sm"
                    className="w-full"
                    backFallback={isGenericArtCard(card.def.cardType, card.def.isToken)}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
