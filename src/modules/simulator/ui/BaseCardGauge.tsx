/* docs/19, Sessão 3 — moldura de Base com barra de integridade.
 *
 * Sprint 5 (refinamento Arena 3D) — sem rótulos ("BASE", "BASE EX", "3/3 EX
 * BASE"): a carta + a barra de HP + o número de dano sobreposto contam tudo.
 * EX Base = moldura dourada (`--accent`). `title`/`aria-label` carregam a
 * leitura textual como tooltip. Alvo legal realçado em verde. */
import { Eye, Zap } from "lucide-react";
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
  selected?: boolean;
  onSelect?: (base: CardInstance) => void;
  onInspect?: (card: CardInstance) => void;
  /** hover / foco na Base (ou `null` ao sair) — alimenta o inspetor lateral (Sprint 3). */
  onHoverCard?: (card: CardInstance | null) => void;
  /** 【Activate·Main】 da Base em campo (ex.: ST01-015 White Base "②", ST01-016
   *  Asticassia "Rest this Base") — mesmo fluxo de custo/alvo dos Units. */
  onActivate?: (base: CardInstance) => void;
  busy?: boolean;
}

// V6.3 (docs/34): `--card-w-std` (tamanho-padrão único), não mais `*0.62` à mão.
const WIDTH = "w-[var(--card-w-std,2.17rem)]";

export function BaseCardGauge({ base, art, legalTarget, selected, onSelect, onInspect, onHoverCard, onActivate, busy }: BaseCardGaugeProps) {
  if (!base) {
    return (
      <div
        title="Base: nenhuma em jogo"
        aria-label="Base: nenhuma em jogo"
        className={cn("aspect-[63/88] overflow-hidden rounded-arena border border-dashed border-white/10 bg-white/[0.015]", WIDTH)}
      />
    );
  }

  const maxHp = effectiveHp(base);
  const remaining = Math.max(0, maxHp - base.damage);
  const pct = maxHp > 0 ? Math.round((remaining / maxHp) * 100) : 0;
  const isEx = base.def.isToken ?? false;
  const title = `Base${isEx ? " EX" : ""} · ${remaining}/${maxHp} HP${base.damage > 0 ? ` · ${base.damage} de dano` : ""}`;

  // "Ver" sempre presente (bug real: a Base não tinha NENHUM botão de ação —
  // nem pra inspecionar, nem pra ativar habilidade tipo White Base "②").
  // Mesmo padrão do BattleSlot/HandFan: corpo só é clicável quando é ALVO
  // LEGAL; inspecionar/ativar sempre pelo cluster do canto.
  const cornerActions: CornerAction[] = [];
  if (onActivate) cornerActions.push({ key: "activate", icon: Zap, label: "Ativar habilidade", tone: "accent", disabled: busy, onClick: () => onActivate(base) });
  if (onInspect) cornerActions.push({ key: "view", icon: Eye, label: `Ver ${base.def.nameEn}`, tone: "view", onClick: () => onInspect(base) });

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
      {...hoverProps}
      title={title}
      aria-label={title}
      className={cn(
        // V6.3 (docs/34): `overflow-hidden rounded-arena` — antes a moldura
        // era um retângulo reto em volta de uma arte já arredondada (o
        // `CardFace` interno já se arredonda sozinho), descasando borda
        // reta com conteúdo arredondado. Também clipa a barra de HP/badge
        // de dano no mesmo raio.
        "relative block overflow-hidden rounded-arena border",
        WIDTH,
        legalTarget
          ? "border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]"
          : selected
            ? "border-primary"
            : isEx
              ? "border-accent/60"
              : "border-amber-500/25",
      )}
    >
      <div
        role={legalTarget ? "button" : undefined}
        tabIndex={legalTarget ? 0 : undefined}
        onClick={legalTarget && onSelect ? () => onSelect(base) : undefined}
        onKeyDown={
          legalTarget && onSelect
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(base);
                }
              }
            : undefined
        }
        className={cn("relative block aspect-[63/88] w-full", legalTarget ? "cursor-pointer" : "cursor-default")}
      >
        <CardFace
          nameEn={base.def.nameEn}
          code={base.def.code}
          art={art}
          size="sm"
          className="h-full w-full"
          backFallback={isGenericArtCard(base.def.cardType, base.def.isToken)}
        />
        {base.damage > 0 ? (
          <span className="absolute right-0 top-0 z-10 bg-red-600/95 px-1 py-0.5 text-[8px] font-black tabular-nums text-white">
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
