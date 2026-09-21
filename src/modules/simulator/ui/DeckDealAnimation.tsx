/* Frente 4 (docs/38 §4) — sequências de microinteração de setup do simulador:
 *  - `shuffle`      : deck sendo embaralhado com palco tático proeminente e cartas em 3D
 *  - `deal-hand`    : 5 cartas completas em alta resolução saem da pilha pra mão com som individual
 *  - `mulligan`     : as 5 voltam pra pilha → embaralha centralmente → 5 novas saem
 *  - `deal-shields` : 6 cartas completas com moldura dourada e som de impacto de escudo
 *  - `single-draw`  : docs/56 tarefa 2 — 1 carta só, saque normal de Draw Phase
 *    (início de qualquer turno > 1). ~750ms (escalável, ver `animationSettings.ts`)
 *    e nunca bloqueia a mão — a página não inclui este modo na lista que
 *    esvazia a `HandFan`.
 *
 * Componente APRESENTACIONAL e auto-contido: renderiza um overlay `fixed`
 * (`pointer-events-none`) com cartas reais e card-backs animados por CSS. */
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getScaledDuration } from "./animationSettings";
import { cardBackUrl, isGenericArtCard, type ArtLookup } from "./cardArt";
import { CardFace } from "./CardFace";
import { sfx } from "../audio/soundEffects";

export type DeckDealMode = "shuffle" | "deal-hand" | "mulligan" | "deal-shields" | "single-draw";

/** ponto em coords de viewport (px). */
export interface DeckDealPoint {
  x: number;
  y: number;
}

export interface DeckDealCard {
  def: {
    code: string;
    nameEn: string;
    cardType?: string;
    isToken?: boolean;
    cost?: number;
    ap?: number;
    hp?: number;
  };
}

export interface DeckDealAnimationProps {
  mode: DeckDealMode;
  onDone: () => void;
  /** rótulo curto mostrado sobre a animação (ex.: "Embaralhando…"). */
  label?: string;
  /** pilha do deck em coords de viewport — origem da animação (opcional). */
  origin?: DeckDealPoint | null;
  /** zona de destino (mão / escudos) em coords de viewport (opcional). */
  dest?: DeckDealPoint | null;
  /** largura da carta no tabuleiro (px) — `--card-w-std`. */
  cardW?: number | null;
  /** cartas reais a serem reveladas ao final do draw / mulligan. */
  cards?: DeckDealCard[];
  /** mapa de artes do simulador para exibição em alta definição. */
  art?: ArtLookup;
}

/** posições-alvo (px, relativas ao ponto de origem do palco) por modo. */
function targets(
  mode: DeckDealMode,
  base: { dx: number; dy: number } | null,
  w: number,
): { dx: number; dy: number }[] {
  if (base) {
    if (mode === "deal-shields") {
      // Pilha vertical de escudos: todas as 6 cartas alinhadas na mesma coluna,
      // empilhadas em cascata idêntica ao ShieldRail (passo exato ~0.097*w por shield)
      const cascadeStep = Math.max(6, Math.round(w * 0.097));
      return Array.from({ length: 6 }, (_, i) => ({
        dx: base.dx,
        dy: base.dy + i * cascadeStep,
      }));
    }
    if (mode === "single-draw") {
      // 1 carta só — vai reto pro ponto de destino, sem leque.
      return [{ dx: base.dx, dy: base.dy }];
    }
    // Leque horizontal da mão: 5 cartas distribuídas exatamente no passo do HandFan (1.14*w)
    const handSpacing = Math.round(w * 1.14);
    return Array.from({ length: 5 }, (_, i) => ({
      dx: base.dx + (i - 2) * handSpacing,
      dy: base.dy,
    }));
  }
  if (mode === "single-draw") {
    return [{ dx: 0, dy: 130 }];
  }
  if (mode === "deal-shields") {
    // Coluna vertical empilhada no palco não-ancorado
    const cascadeStep = Math.max(6, Math.round(w * 0.097));
    return Array.from({ length: 6 }, (_, i) => ({
      dx: -180,
      dy: -60 + i * cascadeStep,
    }));
  }
  // Leque horizontal da mão no palco não-ancorado
  const handSpacing = Math.round(w * 1.14);
  return Array.from({ length: 5 }, (_, i) => ({
    dx: (i - 2) * handSpacing,
    dy: 130,
  }));
}

const DEAL_STAGGER = 90;
/** docs/53 — escudos usam um stagger mais lento que a mão: 6 cartas empilhando
 *  em 90ms cada ficavam borradas/quase simultâneas; 160ms deixa cada uma
 *  visivelmente voar e pousar antes da próxima sair da pilha. */
const SHIELD_STAGGER = 160;
const FLIGHT_MS = 450;
const HAND_REVEAL_HOLD = 340;
const SHIELD_STACK_HOLD = 250;
const RETURN_MS = 340;
const SHUFFLE_MS = 1300;
/** docs/56 tarefa 2 — saque de 1 carta por turno. Revisão do plano de
 *  polimento: 400ms cortava a carta antes do jogador conseguir ler o que
 *  comprou; 750ms (escalado por `getScaledDuration`, ver `animationSettings.ts`)
 *  dá tempo de ver a face real sem segurar o jogo. */
const SINGLE_DRAW_BASE_MS = 750;

export function DeckDealAnimation({
  mode,
  onDone,
  label,
  origin,
  dest,
  cardW,
  cards,
  art,
}: DeckDealAnimationProps) {
  // lido no corpo (não em const de módulo) pra cada montagem pegar a
  // velocidade atual — a página remonta este componente (`key={setupAnim}`)
  // a cada troca de modo, então isso já é "fresco o bastante" sem precisar
  // reagir a mudanças de configuração no meio de uma animação em curso.
  const singleDrawMs = useMemo(() => getScaledDuration(SINGLE_DRAW_BASE_MS), []);

  const anchored = Boolean(origin && dest);
  const w = cardW && cardW > 0 ? cardW : anchored ? 84 : 140;
  const h = Math.round(w * (88 / 63)); // aspect-[63/88] fixo em pixels para evitar colapso de imagem
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

  // docs/53 — bug real: a página reusa a MESMA instância de `DeckDealAnimation`
  // conforme `setupAnim` muda de valor (shuffle → deal-hand → deal-shields),
  // sem desmontar. Como `phase` só era inicializado no `useState` (roda 1x, no
  // mount), a troca de `mode` sozinha nunca reposicionava a fase — depois do
  // shuffle, `phase` ficava travado em "shuffle" e as 5 cartas da mão nunca
  // saíam da pilha (`showTravel` exige `phase === "deal" | "return"`). Este
  // efeito resincroniza `phase` toda vez que `mode` muda; como o mulligan
  // mantém `mode === "mulligan"` do início ao fim, os `setPhase` internos do
  // temporizador abaixo (return → shuffle → deal) não são pisados por aqui.
  useEffect(() => {
    setPhase(mode === "mulligan" ? "return" : mode === "shuffle" ? "shuffle" : "deal");
  }, [mode]);

  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // Embaralhamento (ou fase shuffle do mulligan) se destaca de forma cinematográfica no centro do palco
  const isCenteredStage = !anchored || mode === "shuffle" || (mode === "mulligan" && phase === "shuffle");

  // Largura cinematográfica das cartas durante o palco central
  const stageCardW = isCenteredStage ? Math.max(w, 140) : w;
  const stageCardH = Math.round(stageCardW * (88 / 63));

  // Temporizadores e Sincronia de Áudio Procedural Gundam
  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => onDoneRef.current(), 60);
      return () => clearTimeout(t);
    }
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (mode === "shuffle") {
      // Riffle rítmico de cartas durante o embaralhamento
      [100, 320, 560, 800, 1040].forEach((ms) => {
        timers.push(setTimeout(() => sfx.playCardDraw(), ms));
      });
      timers.push(setTimeout(() => onDoneRef.current(), SHUFFLE_MS));
    } else if (mode === "deal-hand") {
      // Som individual de saque para cada uma das 5 cartas
      for (let i = 0; i < 5; i++) {
        timers.push(setTimeout(() => sfx.playCardDraw(), i * DEAL_STAGGER));
      }
      // Última carta aterrissa e vira em 4 * 120 + 560 = 1040ms.
      // Sfx suave de confirmação de mão pronta:
      timers.push(setTimeout(() => sfx.playCardDraw(), 4 * DEAL_STAGGER + FLIGHT_MS));
      // Hold para o jogador ver as cartas compradas antes de passar o controle à mão:
      timers.push(setTimeout(() => onDoneRef.current(), 4 * DEAL_STAGGER + FLIGHT_MS + HAND_REVEAL_HOLD));
    } else if (mode === "deal-shields") {
      // Som individual de saída para cada um dos 6 escudos, no stagger mais
      // lento (docs/53) pra cada um ficar visivelmente audível ao sair da pilha.
      for (let i = 0; i < 6; i++) {
        timers.push(setTimeout(() => sfx.playCardDraw(), i * SHIELD_STAGGER));
      }
      // O 6º escudo (índice 5) pousa e trava — impacto de escudo!
      timers.push(setTimeout(() => sfx.playShieldBlock(), 5 * SHIELD_STAGGER + FLIGHT_MS));
      // Hold com os 6 escudos empilhados e visíveis antes de liberar pro ShieldRail real:
      timers.push(setTimeout(() => onDoneRef.current(), 6 * SHIELD_STAGGER + FLIGHT_MS + SHIELD_STACK_HOLD));
    } else if (mode === "single-draw") {
      sfx.playCardDraw();
      timers.push(setTimeout(() => onDoneRef.current(), singleDrawMs));
    } else {
      // Mulligan: return (460ms) → shuffle (1300ms) → deal (1790ms)
      sfx.playCardDraw();
      timers.push(
        setTimeout(() => {
          setPhase("shuffle");
          sfx.playNewtypeFlash();
          [200, 480, 760, 1020].forEach((ms) => {
            timers.push(setTimeout(() => sfx.playCardDraw(), ms));
          });
        }, RETURN_MS),
      );
      timers.push(
        setTimeout(() => {
          setPhase("deal");
          for (let i = 0; i < 5; i++) {
            timers.push(setTimeout(() => sfx.playCardDraw(), i * DEAL_STAGGER));
          }
          timers.push(setTimeout(() => sfx.playCardDraw(), 4 * DEAL_STAGGER + FLIGHT_MS));
        }, RETURN_MS + SHUFFLE_MS),
      );
      timers.push(setTimeout(() => onDoneRef.current(), RETURN_MS + SHUFFLE_MS + 4 * DEAL_STAGGER + FLIGHT_MS + HAND_REVEAL_HOLD));
    }
    return () => timers.forEach(clearTimeout);
  }, [mode, reduced, base, singleDrawMs]);

  const pts = targets(mode, base, w);
  const shuffling = !reduced && phase === "shuffle";
  const showTravel = !reduced && (phase === "deal" || phase === "return");
  // docs/53 — escudos usam o stagger mais lento (SHIELD_STAGGER); mão/mulligan seguem no DEAL_STAGGER de sempre.
  const travelStagger = mode === "deal-shields" ? SHIELD_STAGGER : DEAL_STAGGER;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-[55]",
        isCenteredStage ? "flex items-center justify-center" : "",
      )}
      aria-hidden
    >
      <div
        className={
          isCenteredStage
            ? "relative flex h-80 w-96 flex-col items-center justify-center"
            : "absolute h-0 w-0"
        }
        style={!isCenteredStage && anchored && origin ? { left: origin.x, top: origin.y } : undefined}
      >
        {/* Moldura tática Gundam HUD para o palco central de embaralhamento */}
        {isCenteredStage && (
          <div className="absolute inset-0 -m-6 flex flex-col items-center justify-between rounded-2xl border border-cyan-400/50 bg-slate-950/85 p-3 shadow-[0_0_35px_rgba(6,182,212,0.35)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-300">
            <div className="flex w-full items-center justify-between border-b border-cyan-500/30 pb-1 text-[10px] font-mono font-black uppercase tracking-[0.2em] text-cyan-300">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,1)] animate-ping" />
                TACTICAL_DECK_SYNC
              </span>
              <span className="text-cyan-400/70">GN-PARTICLE / ACTIVE</span>
            </div>
            <div className="flex w-full items-center justify-between border-t border-cyan-500/30 pt-1 text-[9px] font-mono tracking-widest text-slate-400">
              <span>CALIBRATION PROTOCOL</span>
              <span className="text-emerald-400 font-bold">100% READY</span>
            </div>
          </div>
        )}

        {/* Rótulo de status da operação */}
        {label ? (
          <p
            className={cn(
              "whitespace-nowrap rounded-arena border font-mono font-black uppercase tracking-[0.16em] shadow-lg",
              isCenteredStage
                ? "relative z-20 -top-8 border-cyan-400/80 bg-slate-900/90 px-4 py-1.5 text-xs text-cyan-300 shadow-[0_0_16px_rgba(6,182,212,0.5)]"
                : "absolute -top-4 left-1/2 -translate-x-1/2 border-primary/40 bg-slate-950/90 px-3 py-1 text-xs text-primary shadow-md",
            )}
          >
            {label}
          </p>
        ) : null}

        {/* Pilha do deck com cascata e fan-out 3D no embaralhamento */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {shuffling ? (
            <div className="relative flex items-center justify-center">
              {/* Carta da esquerda abrindo em leque */}
              <div
                style={{ width: `${stageCardW}px`, height: `${stageCardH}px` }}
                className="block rounded-arena overflow-hidden border-2 border-cyan-400/90 bg-slate-950 shadow-[0_8px_25px_rgba(0,0,0,0.8),0_0_15px_rgba(34,211,238,0.5)] sim-anim-shuffle sim-anim-shuffle-left"
              >
                <img src={cardBackUrl} alt="Deck" className="h-full w-full object-cover object-center" />
              </div>
              {/* Carta central flutuando no feixe de energia */}
              <div
                style={{ width: `${stageCardW}px`, height: `${stageCardH}px`, marginLeft: `${-stageCardW * 0.75}px` }}
                className="block rounded-arena overflow-hidden border-2 border-cyan-300 bg-slate-950 shadow-[0_10px_30px_rgba(0,0,0,0.9),0_0_20px_rgba(34,211,238,0.7)] sim-anim-shuffle sim-anim-shuffle-center z-10"
              >
                <img src={cardBackUrl} alt="Deck" className="h-full w-full object-cover object-center" />
              </div>
              {/* Carta da direita abrindo em leque */}
              <div
                style={{ width: `${stageCardW}px`, height: `${stageCardH}px`, marginLeft: `${-stageCardW * 0.75}px` }}
                className="block rounded-arena overflow-hidden border-2 border-cyan-400/90 bg-slate-950 shadow-[0_8px_25px_rgba(0,0,0,0.8),0_0_15px_rgba(34,211,238,0.5)] sim-anim-shuffle sim-anim-shuffle-right"
              >
                <img src={cardBackUrl} alt="Deck" className="h-full w-full object-cover object-center" />
              </div>
            </div>
          ) : (
            // Pilha compacta de repouso antes do saque ou retorno
            [0, 1, 2].map((i) => (
              <div
                key={i}
                style={{ width: `${w}px`, height: `${h}px`, marginTop: i === 0 ? 0 : `${-h}px`, marginLeft: `${i * 2}px` }}
                className="block rounded-arena overflow-hidden border border-primary/40 bg-slate-950 shadow-lg"
              >
                <img src={cardBackUrl} alt="Deck" className="h-full w-full object-cover object-center" />
              </div>
            ))
          )}
        </div>

        {/* Cartas viajando pra zona-alvo (deal) ou voltando (return) com dimensões reais e 3D flip */}
        {showTravel &&
          pts.map((t, i) => {
            const isFlipping = phase === "deal" && mode !== "deal-shields";
            const card = cards?.[i];
            return (
              <div
                key={i}
                style={
                  {
                    width: `${w}px`,
                    height: `${h}px`,
                    marginLeft: `${-w / 2}px`,
                    marginTop: `${-h / 2}px`,
                    "--dx": `${t.dx}px`,
                    "--dy": `${t.dy}px`,
                    zIndex: 40 + i,
                    animationDelay: `${i * travelStagger}ms`,
                    animationDuration: mode === "single-draw" ? `${singleDrawMs}ms` : undefined,
                  } as React.CSSProperties
                }
                className={cn(
                  "absolute left-1/2 top-1/2 block z-40",
                  isFlipping && "sim-perspective",
                  phase === "deal" && mode === "deal-shields"
                    ? "rounded-arena overflow-hidden border-2 border-amber-400/90 bg-slate-950 shadow-[0_6px_20px_rgba(0,0,0,0.8),0_0_12px_rgba(251,191,36,0.5)] sim-anim-deal"
                    : phase === "deal"
                      ? "sim-anim-deal"
                      : "rounded-arena overflow-hidden border-2 border-rose-400/90 bg-slate-950 shadow-[0_6px_20px_rgba(0,0,0,0.8),0_0_12px_rgba(244,63,94,0.5)] sim-anim-return",
                )}
              >
                {isFlipping ? (
                  <div
                    style={{
                      animationDelay: `${i * travelStagger}ms`,
                      animationDuration: mode === "single-draw" ? `${singleDrawMs}ms` : undefined,
                    }}
                    className="relative h-full w-full sim-preserve-3d sim-anim-card-flip"
                  >
                    {/* Verso (Back Face) */}
                    <div
                      style={{
                        transform: "rotateY(0deg)",
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                      }}
                      className="absolute inset-0 sim-backface-hidden overflow-hidden rounded-arena border-2 border-cyan-400/90 bg-slate-950 shadow-[0_6px_20px_rgba(0,0,0,0.8),0_0_12px_rgba(34,211,238,0.5)]"
                    >
                      <img
                        src={cardBackUrl}
                        alt="Verso da carta"
                        className="h-full w-full object-cover object-center"
                      />
                    </div>

                    {/* Frente (Front Face) com a arte e dados reais da carta */}
                    <div
                      style={{
                        transform: "rotateY(180deg)",
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                      }}
                      className="absolute inset-0 sim-backface-hidden overflow-hidden rounded-arena border-2 border-cyan-300 bg-slate-950 shadow-[0_8px_24px_rgba(0,0,0,0.9),0_0_16px_rgba(34,211,238,0.6)]"
                    >
                      {card ? (
                        <>
                          <CardFace
                            nameEn={card.def.nameEn}
                            code={card.def.code}
                            art={art ?? {}}
                            size="md"
                            className="!h-full !w-full"
                            style={{ width: "100%", height: "100%" }}
                            backFallback={card.def.cardType ? isGenericArtCard(card.def.cardType, card.def.isToken) : false}
                          />
                          {card.def.cost !== undefined ? (
                            <span
                              className="absolute left-0.5 top-0.5 z-10 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-black shadow-sm"
                              title={`Custo ${card.def.cost}`}
                            >
                              {card.def.cost}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <img
                          src={cardBackUrl}
                          alt="Carta revelada"
                          className="h-full w-full object-cover object-center"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <img
                    src={cardBackUrl}
                    alt="Carta em trânsito"
                    className="h-full w-full object-cover object-center"
                  />
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
