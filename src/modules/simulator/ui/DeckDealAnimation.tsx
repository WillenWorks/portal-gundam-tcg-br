/* Frente 4 (docs/38 §4) — sequências de microinteração de setup do simulador:
 *  - `shuffle`      : deck sendo embaralhado (3 cartas deslizando)
 *  - `deal-hand`    : 5 cartas saem da pilha pra zona da mão
 *  - `mulligan`     : as 5 voltam pra pilha → embaralha → 5 novas saem
 *  - `deal-shields` : 6 cartas saem da pilha pra a zona de escudos
 *
 * Componente APRESENTACIONAL e auto-contido: renderiza um overlay `fixed`
 * (`pointer-events-none`) com card-backs animados por CSS (`src/index.css`
 * `sim-anim-*`, todos com `motion-reduce`). `onDone` dispara quando a
 * sequência termina (ou imediatamente sob `prefers-reduced-motion`).
 *
 * Frente 4 (feedback Willen 4ª rodada) — pode ancorar nas ZONAS REAIS: se
 * `origin` (pilha do deck) e `dest` (mão / zona de escudos) vêm em coords de
 * viewport, o palco é posicionado no `origin` e as cartas viajam até perto do
 * `dest`. Sem essas props, cai no modo centrado (usado pela preview). O
 * `SimulatorMatchPage` liga isso no fluxo real via heurística de diff de
 * contagem (ver `useSetupAnimation` lá). */
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { cardBackUrl } from "./cardArt";

export type DeckDealMode = "shuffle" | "deal-hand" | "mulligan" | "deal-shields";

/** ponto em coords de viewport (px). */
export interface DeckDealPoint {
  x: number;
  y: number;
}

interface DeckDealAnimationProps {
  mode: DeckDealMode;
  onDone: () => void;
  /** rótulo curto mostrado sobre a animação (ex.: "Embaralhando…"). */
  label?: string;
  /** pilha do deck em coords de viewport — origem da animação (opcional). */
  origin?: DeckDealPoint | null;
  /** zona de destino (mão / escudos) em coords de viewport (opcional). */
  dest?: DeckDealPoint | null;
  /** largura da carta no tabuleiro (px) — `--card-w-std`, medida de uma zona
   *  real pelo pai. As card-backs animadas usam ESTE tamanho pra bater com as
   *  cartas do jogo (feedback Willen: "no mesmo tamanho das cartas"). Sem isso
   *  cai no fallback fixo. */
  cardW?: number | null;
}

/** fallback quando o pai não mede a carta (ex.: testes) — antes era o tamanho
 *  fixo de TODAS as instâncias, pequeno demais no board real. */
const FALLBACK_CARD_W = 56;

/** posições-alvo (px, relativas ao ponto de origem do palco) por modo. Os
 *  offsets de espalhamento escalam com `u` (= cardW / referência) pra o leque /
 *  a coluna acompanharem o tamanho da carta.
 *  `base` = vetor origem→destino quando ancorado nas zonas reais; `null` = modo
 *  centrado (offsets fixos em torno do centro do palco). */
function targets(
  mode: DeckDealMode,
  base: { dx: number; dy: number } | null,
  u: number,
): { dx: number; dy: number }[] {
  if (base) {
    if (mode === "deal-shields") {
      return Array.from({ length: 6 }, (_, i) => ({ dx: base.dx, dy: base.dy + (-40 + i * 16) * u }));
    }
    return Array.from({ length: 5 }, (_, i) => ({ dx: base.dx + (-120 + i * 60) * u, dy: base.dy }));
  }
  if (mode === "deal-shields") {
    // coluna vertical (zona de escudos, à esquerda)
    return Array.from({ length: 6 }, (_, i) => ({ dx: -170 * u, dy: (-70 + i * 16) * u }));
  }
  // leque horizontal (zona da mão, embaixo)
  return Array.from({ length: 5 }, (_, i) => ({ dx: (-140 + i * 70) * u, dy: 96 * u }));
}

const DEAL_STAGGER = 110;
const SHUFFLE_MS = 1300;

/** referência em que os offsets de `targets()` foram calibrados. */
const OFFSET_REF_W = 48;

export function DeckDealAnimation({ mode, onDone, label, origin, dest, cardW }: DeckDealAnimationProps) {
  const w = cardW && cardW > 0 ? cardW : FALLBACK_CARD_W;
  const h = w * (88 / 63); // aspect-[63/88]
  const u = w / OFFSET_REF_W; // escala dos offsets de espalhamento
  const anchored = Boolean(origin && dest);
  const ox = origin?.x ?? null;
  const oy = origin?.y ?? null;
  const dx = dest?.x ?? null;
  const dy = dest?.y ?? null;
  const base = useMemo(
    () => (ox !== null && oy !== null && dx !== null && dy !== null ? { dx: dx - ox, dy: dy - oy } : null),
    [ox, oy, dx, dy],
  );
  const reduced = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  // fases pro mulligan: return → shuffle → deal. Outros modos têm 1 fase só.
  const [phase, setPhase] = useState<"return" | "shuffle" | "deal">(
    mode === "mulligan" ? "return" : mode === "shuffle" ? "shuffle" : "deal",
  );
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => onDoneRef.current(), 60);
      return () => clearTimeout(t);
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const dealCount = mode === "deal-shields" ? 6 : 5;
    const dealMs = () => dealCount * DEAL_STAGGER + 360;

    if (mode === "shuffle") {
      timers.push(setTimeout(() => onDoneRef.current(), SHUFFLE_MS));
    } else if (mode === "deal-hand" || mode === "deal-shields") {
      timers.push(setTimeout(() => onDoneRef.current(), dealMs()));
    } else {
      // mulligan
      timers.push(setTimeout(() => setPhase("shuffle"), 340));
      timers.push(setTimeout(() => setPhase("deal"), 340 + SHUFFLE_MS));
      timers.push(setTimeout(() => onDoneRef.current(), 340 + SHUFFLE_MS + dealMs()));
    }
    return () => timers.forEach(clearTimeout);
  }, [mode, reduced, base]);

  const pts = targets(mode, base, u);
  const shuffling = !reduced && phase === "shuffle";
  const showTravel = !reduced && (phase === "deal" || phase === "return");

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-[55]",
        anchored ? "" : "flex items-center justify-center",
      )}
      aria-hidden
    >
      <div
        className={anchored ? "absolute h-0 w-0" : "relative flex h-64 w-80 items-center justify-center"}
        style={anchored && origin ? { left: origin.x, top: origin.y } : undefined}
      >
        {label ? (
          <p className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-arena border border-primary/40 bg-slate-950/90 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
            {label}
          </p>
        ) : null}

        {/* pilha do deck (referência) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {[0, 1, 2].map((i) => (
            <img
              key={i}
              src={cardBackUrl}
              alt=""
              style={{ width: w, marginTop: i === 0 ? 0 : -h, marginLeft: i * 2 }}
              className={cn(
                "block aspect-[63/88] rounded-arena border border-primary/40 object-cover shadow-lg",
                shuffling && "sim-anim-shuffle",
              )}
            />
          ))}
        </div>

        {/* cartas viajando pra zona-alvo (deal) ou voltando (return) */}
        {showTravel &&
          pts.map((t, i) => (
            <img
              key={i}
              src={cardBackUrl}
              alt=""
              style={
                {
                  width: w,
                  marginLeft: -w / 2,
                  marginTop: -h / 2,
                  "--dx": `${t.dx}px`,
                  "--dy": `${t.dy}px`,
                  animationDelay: `${i * DEAL_STAGGER}ms`,
                } as React.CSSProperties
              }
              className={cn(
                "absolute left-1/2 top-1/2 block aspect-[63/88] rounded-arena border border-primary/50 object-cover shadow-xl",
                phase === "deal" ? "sim-anim-deal" : "sim-anim-return",
              )}
            />
          ))}
      </div>
    </div>
  );
}
