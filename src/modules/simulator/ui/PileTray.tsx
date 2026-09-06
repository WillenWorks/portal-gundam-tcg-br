/* Fase C (docs/19) — pilha visual que abre uma bandeja overlay (substitui o
 * `renderPile`/`renderDeckTile` da página + a inspeção 1-a-1). Em repouso é um
 * <CounterChip variant="stack"> mostrando a última carta com o número num badge
 * de canto (Sprint 5 — sem texto "TRASH 0"); ao clicar, abre uma bandeja
 * `fixed` centrada na base da tela com um grid rolável de miniaturas.
 *
 * Frente 4 (feedback Willen 2ª rodada):
 *  - a bandeja tinha `inset-x-0` (largura total): Exílio + Descarte abertos ao
 *    mesmo tempo se sobrepunham e estouravam o campo. Agora é um painel
 *    centrado de largura limitada (`min(92vw, 30rem)`).
 *  - fecha pelo X, clicando no backdrop OU com Esc.
 *  - só UMA bandeja de pilha aberta por vez (registro em módulo) — abrir uma
 *    fecha qualquer outra. */
import { useCallback, useEffect, useId, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import type { CardInstance } from "@/modules/simulator/engine/types";
import { isGenericArtCard, type ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";
import { CounterChip } from "./CounterChip";

// ── Registro global: no máximo 1 bandeja de pilha aberta por vez ──────────────
let openPileId: string | null = null;
const pileListeners = new Set<() => void>();
function setOpenPile(id: string | null) {
  openPileId = id;
  for (const l of pileListeners) l();
}
function usePileOpen(id: string): [boolean, (open: boolean) => void] {
  const subscribe = useCallback((cb: () => void) => {
    pileListeners.add(cb);
    return () => {
      pileListeners.delete(cb);
    };
  }, []);
  const isOpen = useSyncExternalStore(
    subscribe,
    () => openPileId === id,
    () => false,
  );
  const setOpen = useCallback((open: boolean) => setOpenPile(open ? id : null), [id]);
  return [isOpen, setOpen];
}

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
  const id = useId();
  const [open, setOpen] = usePileOpen(id);
  const topCard = cards.length > 0 ? cards[cards.length - 1] : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // ao desmontar, se esta era a bandeja aberta, limpa o registro.
  useEffect(() => {
    return () => {
      if (openPileId === id) setOpenPile(null);
    };
  }, [id]);

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
        <>
          {/* backdrop — clicar fora fecha */}
          <div className="fixed inset-0 z-40 bg-black/50" aria-hidden onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Pilha: ${label}`}
            className="panel-cut fixed bottom-0 left-1/2 z-50 flex max-h-[45vh] w-[min(92vw,30rem)] -translate-x-1/2 flex-col border border-primary/30 bg-slate-950/97"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                {label} <span className="font-mono font-black text-slate-100">{count}</span>
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-arena border border-white/10 px-2 text-[10px] uppercase text-slate-200 transition-colors duration-100 hover:border-primary/70 motion-reduce:transition-none"
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
                    className="block rounded-arena border border-white/10 transition-colors duration-100 hover:border-primary/70 motion-reduce:transition-none"
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
        </>
      ) : null}
    </>
  );
}
