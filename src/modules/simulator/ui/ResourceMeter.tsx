/* Fase C (docs/19) — medidor da economia de recursos.
 *
 * Sprint 5 (refinamento Arena 3D) — SEM os textos "◆◆◆◇ 2 ativos · nível 3" e
 * "RECURSO 8": a fileira de mini-cartas se lê sozinha (em pé = ativo ciano,
 * girada 90° = gasta, dourada = EX). Cada peça tem `title`; o container tem
 * `aria-label` com a leitura completa pra acessibilidade.
 *
 * Frente 4 (docs/38 §3.3) — EMPILHAMENTO: recursos idênticos (mesma
 * combinação ativo/gasto × normal/EX) são agrupados numa ÚNICA pilha com um
 * badge numérico (`x3`, `x5`) no topo direito. Isso derruba a largura total em
 * >60% e mata de vez a barra de rolagem horizontal que aparecia ao acumular
 * recursos normais + EX (Feedback.pdf §3). O modo interativo (pagamento de
 * custo) continua mostrando as peças ATIVAS uma a uma — mas agora sobrepostas
 * (leque), nunca com scroll.
 *
 * `selectable` (pagamento de custo): só as peças ATIVAS viram <button>;
 * selecionada = realce esmeralda. Com `costProgress`, uma barra "{paid}/{total}
 * pago" aparece abaixo. `readOnly` (medidor do oponente): sem clique, compacto. */
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { artSrc, cardBackUrl, type ArtLookup } from "./cardArt";

interface ResourceMeterItem {
  instanceId: string;
  rested: boolean;
  isEx: boolean;
  /** code do catálogo pra resolver a arte real (recurso é carta virada PRA CIMA). */
  code?: string;
}

interface ResourceMeterProps {
  resources: ResourceMeterItem[];
  level: number;
  /** lookup de arte — recursos face-up mostram a ilustração real, não o verso. */
  art?: ArtLookup;
  selectable?: boolean;
  selectedIds?: string[];
  onSelect?: (instanceId: string) => void;
  readOnly?: boolean;
  costProgress?: { paid: number; total: number };
  className?: string;
}

function pieceTitle(r: ResourceMeterItem): string {
  return r.isEx ? "EX Resource — sai de jogo se gasto" : r.rested ? "Recurso gasto" : "Recurso ativo";
}

/** largura-padrão da carta na arena (docs/34) — retrato; a peça gasta ocupa a
 *  mesma área girada 90° (paisagem). */
const PORTRAIT_W = "var(--card-w-std,2.17rem)";

export function ResourceMeter({
  resources,
  level,
  art,
  selectable,
  selectedIds = [],
  onSelect,
  readOnly,
  costProgress,
  className,
}: ResourceMeterProps) {
  const active = resources.filter((r) => !r.rested).length;
  const summary = `${active} recurso(s) ativo(s) de ${resources.length} · nível ${level}`;
  const interactive = Boolean(selectable && !readOnly && onSelect);

  function pieceVisual(r: ResourceMeterItem, selected: boolean, pickable: boolean) {
    const tone = selected
      ? "border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
      : r.isEx
        ? "border-accent shadow-[0_0_6px_rgba(234,179,8,0.35)]"
        : r.rested
          ? "border-white/10 opacity-60"
          : "border-primary/50";
    // caixa EXTERNA já nasce em paisagem quando gasto (footprint = retrato
    // rotacionado); só a imagem por dentro gira 90° (docs/34).
    const shape = cn(
      "relative block shrink-0 overflow-hidden rounded-arena border transition-all duration-100 motion-reduce:transition-none",
      r.rested ? "aspect-[88/63]" : "aspect-[63/88]",
      tone,
      pickable && "cursor-pointer hover:border-emerald-300",
    );
    const shapeStyle: CSSProperties = { width: r.rested ? `calc(${PORTRAIT_W} * 88 / 63)` : PORTRAIT_W };
    const tint = selected
      ? "bg-emerald-500/35"
      : r.isEx
        ? "bg-accent/25"
        : r.rested
          ? "bg-slate-950/45"
          : "bg-transparent";
    // recurso é carta virada PRA CIMA — ilustração real; verso só se faltar arte.
    const face = (art && r.code && artSrc(art, r.code, "sm")) || cardBackUrl;
    const artBox = <img src={face} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />;
    return { shape, shapeStyle, tint, artBox };
  }

  function Piece({ r, selected, pickable }: { r: ResourceMeterItem; selected: boolean; pickable: boolean }) {
    const { shape, shapeStyle, tint, artBox } = pieceVisual(r, selected, pickable);
    const title = pieceTitle(r);
    const inner = (
      <>
        {r.rested ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="relative aspect-[63/88] overflow-hidden rotate-90" style={{ width: PORTRAIT_W }}>
              {artBox}
            </span>
          </span>
        ) : (
          artBox
        )}
        <span className={cn("absolute inset-0", tint)} />
      </>
    );
    return pickable ? (
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-pressed={selected}
        onClick={() => onSelect?.(r.instanceId)}
        className={shape}
        style={shapeStyle}
      >
        {inner}
      </button>
    ) : (
      <span title={title} aria-label={title} className={shape} style={shapeStyle}>
        {inner}
      </span>
    );
  }

  // ── Modo empilhado (padrão / oponente): 1 pilha por tipo + badge xN ────────
  const groups = (() => {
    const order: string[] = [];
    const byKey = new Map<string, { sample: ResourceMeterItem; count: number }>();
    for (const r of resources) {
      const key = `${r.isEx ? "ex" : "std"}-${r.rested ? "rested" : "active"}`;
      const g = byKey.get(key);
      if (g) {
        g.count += 1;
      } else {
        byKey.set(key, { sample: r, count: 1 });
        order.push(key);
      }
    }
    return order.map((k) => byKey.get(k)!);
  })();

  return (
    <div aria-label={summary} title={summary} className={cn("flex flex-col gap-1", readOnly && "opacity-90", className)}>
      {interactive ? (
        // leque sobreposto das peças (sem scrollbar): 1ª peça normal, as
        // seguintes com margem negativa. As ATIVAS são <button> pickable.
        <div className={cn("flex min-w-0 flex-wrap items-end gap-y-1 pb-0.5")}>
          {resources.map((r, i) => {
            const selected = selectedIds.includes(r.instanceId);
            const pickable = Boolean(!r.rested && onSelect);
            return (
              <span
                key={r.instanceId}
                className="shrink-0"
                style={i === 0 ? undefined : { marginLeft: `calc(${PORTRAIT_W} * -0.34)` }}
              >
                <Piece r={r} selected={selected} pickable={pickable} />
              </span>
            );
          })}
        </div>
      ) : (
        <div className={cn("flex min-w-0 items-end gap-2", readOnly && "gap-1.5")}>
          {groups.map((g, i) => (
            <span key={i} className="relative shrink-0">
              <Piece r={g.sample} selected={false} pickable={false} />
              {g.count > 1 ? (
                <span className="absolute -right-1 -top-1 z-10 rounded-arena border border-white/25 bg-slate-950 px-1 font-mono text-[clamp(0.6875rem,calc(var(--card-w-std,2.17rem)*0.2),1.125rem)] font-black leading-tight tabular-nums text-slate-100">
                  x{g.count}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      )}

      {costProgress ? (
        <div className="flex flex-col gap-0.5">
          <div className="h-1.5 w-full bg-black/60">
            <div
              className="h-full bg-emerald-500 transition-all duration-100 motion-reduce:transition-none"
              style={{
                width: `${costProgress.total > 0 ? Math.min(100, (costProgress.paid / costProgress.total) * 100) : 0}%`,
              }}
            />
          </div>
          <p className="font-mono text-[9px] font-medium tabular-nums text-emerald-300">
            {costProgress.paid}/{costProgress.total} pago
          </p>
        </div>
      ) : null}
    </div>
  );
}
