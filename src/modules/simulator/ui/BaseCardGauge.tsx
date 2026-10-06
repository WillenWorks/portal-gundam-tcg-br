/* docs/19, Sessão 3 — moldura de Base com barra de integridade.
 *
 * Sprint 5 (refinamento Arena 3D) — sem rótulos ("BASE", "BASE EX", "3/3 EX
 * BASE"): a carta + a barra de HP + o número de dano sobreposto contam tudo.
 * EX Base = moldura dourada (`--accent`). `title`/`aria-label` carregam a
 * leitura textual como tooltip. Alvo legal realçado em verde. */
import { CheckCircle2, Crosshair, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardInstance } from "@/modules/simulator/engine/types";
import { effectiveHp } from "@/modules/simulator/engine/types";
import { isGenericArtCard, type ArtLookup } from "./cardArt";
import { CardCornerActions, type CornerAction } from "./CardCornerActions";
import { CardFace } from "./CardFace";

interface BaseCardGaugeProps {
  base: CardInstance | null;
  art: ArtLookup;
  legalTarget?: boolean;
  /** modo de mira/seleção de alvos ativo globalmente (não-alvos ficam esmaecidos). */
  targetingActive?: boolean;
  selected?: boolean;
  onSelect?: (base: CardInstance) => void;
  onInspect?: (card: CardInstance) => void;
  /** hover / foco na Base (ou `null` ao sair) — alimenta o inspetor lateral (Sprint 3). */
  onHoverCard?: (card: CardInstance | null) => void;
  /** 【Activate·Main】 da Base em campo (ex.: ST01-015 White Base "②", ST01-016
   *  Asticassia "Rest this Base") — mesmo fluxo de custo/alvo dos Units. */
  onActivate?: (base: CardInstance) => void;
  busy?: boolean;
  /** docs/55 tarefa 5 — golpe de ataque direto acabou de acertar (fase "strike"
   *  da coreografia de combate): tremor/flash breve. O pai controla a duração. */
  struck?: boolean;
  /** Alvo legal de habilidade em andamento ("ally" = glow verde, "enemy" = glow vermelho). */
  abilityTargetPool?: "ally" | "enemy" | null;
  /** Já selecionado como alvo de habilidade. */
  abilitySelected?: boolean;
  /** Fonte ativa disparando ou ativando efeito/habilidade. */
  isAbilitySource?: boolean;
  /** Ref para medição do DOM na arena. */
  registerRef?: (el: HTMLElement | null) => void;
}

// V6.3 (docs/34): `--card-w-std` (tamanho-padrão único), não mais `*0.62` à mão.
const WIDTH = "w-[var(--card-w-std,2.17rem)]";

export function BaseCardGauge({
  base,
  art,
  legalTarget,
  targetingActive,
  selected,
  onSelect,
  onInspect,
  onHoverCard,
  onActivate,
  busy,
  struck,
  abilityTargetPool,
  abilitySelected,
  isAbilitySource,
  registerRef,
}: BaseCardGaugeProps) {
  if (!base) {
    return (
      <div
        ref={registerRef}
        title={legalTarget ? "Atacar jogador (Base)" : "Base: nenhuma em jogo"}
        aria-label={legalTarget ? "Atacar jogador (Base)" : "Base: nenhuma em jogo"}
        onClick={legalTarget && onSelect ? () => onSelect(null as any) : undefined}
        className={cn(
          "aspect-[63/88] overflow-hidden rounded-arena border border-dashed transition-all duration-150",
          WIDTH,
          legalTarget
            ? "z-20 border-emerald-400 ring-2 ring-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.85)] animate-pulse cursor-pointer hover:brightness-125 bg-emerald-950/20"
            : "border-white/10 bg-white/[0.015]",
        )}
      />
    );
  }

  const maxHp = effectiveHp(base);
  const remaining = Math.max(0, maxHp - base.damage);
  const pct = maxHp > 0 ? Math.round((remaining / maxHp) * 100) : 0;
  const isEx = Boolean(base.def.isToken);
  const title = `Base${isEx ? " EX" : ""} · ${remaining}/${maxHp} HP${base.rested ? " · Rested" : ""}${base.damage > 0 ? ` · ${base.damage} de dano` : ""}`;

  const isInvalidTarget = Boolean(targetingActive && !legalTarget);
  const isAbilityTarget = Boolean(abilityTargetPool);
  // Frente 4 (docs/38 §3.1) — o botão de "olho" foi eliminado. Inspeção agora
  // é por clique na área neutra da carta (ver `bodyInspects` abaixo). O cluster
  // do canto guarda só ações OPERACIONAIS (ex.: Ativar habilidade da Base tipo
  // White Base "②"). Corpo só é clicável como ALVO LEGAL quando `selecting`.
  const cornerActions: CornerAction[] = [];
  if (onActivate) cornerActions.push({ key: "activate", icon: Zap, label: "Ativar habilidade", tone: "accent", disabled: busy, onClick: () => onActivate(base) });

  // clique na carta (fora de seleção de alvo) abre o inspetor.
  const bodyInspects = Boolean(onInspect) && !legalTarget && !isInvalidTarget && !isAbilityTarget;

  const hoverProps = onHoverCard
    ? {
        onMouseEnter: () => onHoverCard(base),
        onMouseLeave: () => onHoverCard(null),
        onFocus: () => onHoverCard(base),
        onBlur: () => onHoverCard(null),
      }
    : {};

  return (
    <div
      ref={registerRef}
      {...hoverProps}
      title={title}
      aria-label={title}
      className={cn(
        // V6.3 (docs/34): `overflow-hidden rounded-arena` — antes a moldura
        // era um retângulo reto em volta de uma arte já arredondada (o
        // `CardFace` interno já se arredondava sozinho), descasando borda
        // reta com conteúdo arredondado. Também clipa a barra de HP/badge
        // de dano no mesmo raio.
        "relative block overflow-hidden rounded-arena border transition-[transform,box-shadow,opacity,filter] duration-200",
        WIDTH,
        // docs/55 tarefa 5 — impacto de ataque direto: flash/tremor vermelho
        // breve (o pai controla a duração via `struck`), some sozinho.
        struck && "z-20 scale-105 ring-4 ring-red-500 shadow-[0_0_20px_rgba(239,68,68,0.9)]",
        isAbilitySource && "z-25 ring-2 ring-amber-400 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.85)] animate-pulse",
        legalTarget
          ? "z-20 border-emerald-400 ring-2 ring-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.85)] animate-pulse scale-[1.02]"
          : abilitySelected
            ? cn(
                "z-20 scale-[1.03]",
                abilityTargetPool === "enemy"
                  ? "border-rose-300 ring-4 ring-rose-300 shadow-[0_0_22px_rgba(244,63,94,0.95)]"
                  : "border-emerald-300 ring-4 ring-emerald-300 shadow-[0_0_22px_rgba(52,211,153,0.95)]",
              )
            : abilityTargetPool === "ally"
              ? "z-20 border-emerald-400 ring-2 ring-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.85)] animate-pulse scale-[1.02]"
              : abilityTargetPool === "enemy"
                ? "z-20 border-rose-500 ring-2 ring-rose-500 shadow-[0_0_16px_rgba(244,63,94,0.85)] animate-pulse scale-[1.02]"
                : selected
                  ? "border-primary"
                  : isInvalidTarget
                    ? "border-white/5 opacity-35 grayscale-[75%] contrast-75 brightness-75 pointer-events-none select-none"
                    : base.rested
                      ? "border-slate-600/40 opacity-75"
                      : isEx
                        ? "border-accent/60"
                        : "border-amber-500/25",
      )}
    >
      {isAbilitySource ? (
        <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-full border border-amber-300 bg-amber-950/90 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.8)]">
          <Zap className="size-2 text-amber-300 animate-pulse" />
          <span>Ativando</span>
        </div>
      ) : null}

      <div
        role={legalTarget || isAbilityTarget || bodyInspects ? "button" : undefined}
        tabIndex={legalTarget || isAbilityTarget || bodyInspects ? 0 : undefined}
        aria-label={
          isAbilityTarget
            ? `${abilitySelected ? "Desfazer alvo" : "Selecionar como alvo"}: ${base.def.nameEn}`
            : bodyInspects
              ? `Ver ${base.def.nameEn}`
              : undefined
        }
        aria-pressed={isAbilityTarget ? abilitySelected : undefined}
        onClick={
          legalTarget && onSelect
            ? () => onSelect(base)
            : isAbilityTarget && onSelect
              ? () => onSelect(base)
              : bodyInspects && onInspect
                ? () => onInspect(base)
                : undefined
        }
        onKeyDown={
          legalTarget && onSelect
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(base);
                }
              }
            : isAbilityTarget && onSelect
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(base);
                  }
                }
              : bodyInspects && onInspect
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onInspect(base);
                    }
                  }
                : undefined
        }
        className={cn("relative block aspect-[63/88] w-full", legalTarget || isAbilityTarget || bodyInspects ? "cursor-pointer" : "cursor-default")}
      >
        <CardFace
          nameEn={base.def?.nameEn ?? ""}
          code={base.def?.code ?? ""}
          art={art}
          size="sm"
          className="h-full w-full"
          dimmed={base.rested}
          backFallback={base.def?.cardType ? isGenericArtCard(base.def.cardType, base.def.isToken) : false}
        >
          {legalTarget ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <span
                aria-label="Alvo Válido"
                className="flex size-[clamp(1.5rem,calc(var(--card-w-std,2.17rem)*0.55),2.6rem)] items-center justify-center rounded-full border border-emerald-400 bg-emerald-950/70 text-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.75)] animate-pulse"
              >
                <Crosshair className="size-3/4" />
              </span>
            </div>
          ) : null}
          {isAbilityTarget ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <span
                aria-hidden
                className={cn(
                  "flex size-[clamp(1.5rem,calc(var(--card-w-std,2.17rem)*0.55),2.6rem)] items-center justify-center rounded-full border",
                  abilitySelected
                    ? abilityTargetPool === "enemy"
                      ? "border-rose-300 bg-rose-950/80 text-rose-200 shadow-[0_0_16px_rgba(244,63,94,0.9)]"
                      : "border-emerald-300 bg-emerald-950/80 text-emerald-200 shadow-[0_0_16px_rgba(52,211,153,0.9)]"
                    : abilityTargetPool === "enemy"
                      ? "border-rose-500 bg-rose-950/70 text-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.75)] animate-pulse"
                      : "border-emerald-400 bg-emerald-950/70 text-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.75)] animate-pulse",
                )}
              >
                {abilitySelected ? <CheckCircle2 className="size-3/4" /> : <Crosshair className="size-3/4" />}
              </span>
            </div>
          ) : null}
          {base.rested ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45">
              <span className="rotate-[-12deg] border border-slate-300/60 bg-black/70 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-slate-200">
                Rested
              </span>
            </div>
          ) : null}
        </CardFace>
        {base.damage > 0 ? (
          // Frente 4 (docs/38 §3.2) — dano acumulado no canto INFERIOR direito
          // (não mais topo, onde o "olho" o cobria). Badge preto translúcido,
          // borda vermelha sutil, mono de alto contraste. Feedback Willen 2ª
          // rodada: escala com `--card-w-std` (era `text-[9px]` fixo).
          <span
            className="absolute bottom-2 right-0 z-10 rounded-arena border border-red-400/70 px-1 py-0.5 font-mono text-[clamp(0.625rem,calc(var(--card-w-std,2.17rem)*0.18),1.0625rem)] font-black leading-none tabular-nums text-white shadow-[0_0_6px_rgba(0,0,0,0.7)]"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.85)" }}
          >
            -{base.damage}
          </span>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/70">
          <div
            className={cn("h-full transition-all duration-150 motion-reduce:transition-none", pct > 50 ? "bg-emerald-500" : pct > 25 ? "bg-amber-500" : "bg-red-500")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <CardCornerActions actions={cornerActions} />
    </div>
  );
}
