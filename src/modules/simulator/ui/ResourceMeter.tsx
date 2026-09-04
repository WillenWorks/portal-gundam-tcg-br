/* Fase C (docs/19) — medidor da economia de recursos.
 *
 * Sprint 5 (refinamento Arena 3D) — SEM os textos "◆◆◆◇ 2 ativos · nível 3" e
 * "RECURSO 8": a fileira de mini-cartas se lê sozinha (em pé = ativo ciano,
 * girada 90° = gasta, dourada = EX). Cada peça tem `title`; o container tem
 * `aria-label` com a leitura completa pra acessibilidade.
 *
 * `selectable` (pagamento de custo): só as peças ATIVAS viram <button>;
 * selecionada = realce esmeralda. Com `costProgress`, uma barra "{paid}/{total}
 * pago" aparece abaixo. `readOnly` (medidor do oponente): sem clique, compacto. */
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

  return (
    <div
      aria-label={summary}
      title={summary}
      className={cn("flex flex-col gap-1", readOnly && "opacity-90", className)}
    >
      <div
        className={cn(
          "scrollbar-ghost flex min-w-0 items-end gap-1 overflow-x-auto overscroll-x-contain pb-0.5",
          readOnly && "gap-0.5",
        )}
      >
        {resources.map((r) => {
          const selected = selectedIds.includes(r.instanceId);
          const pickable = Boolean(selectable && !readOnly && !r.rested && onSelect);
          const title = r.isEx
            ? "EX Resource — sai de jogo se gasto"
            : r.rested
              ? "Recurso gasto"
              : "Recurso ativo";
          // arte padrão do verso (Sprint 6) + moldura/tint que carrega o estado.
          const shape = cn(
            "relative block shrink-0 overflow-hidden border transition-all duration-100 motion-reduce:transition-none",
            readOnly
              ? "h-[calc(var(--card,3.5rem)*0.5)] w-[calc(var(--card,3.5rem)*0.34)]"
              : "h-[calc(var(--card,3.5rem)*0.7)] w-[calc(var(--card,3.5rem)*0.5)]",
            selected
              ? "border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
              : r.isEx
                ? "border-accent shadow-[0_0_6px_rgba(234,179,8,0.35)]"
                : r.rested
                  ? "rotate-90 border-white/10 opacity-60"
                  : "border-primary/50",
            pickable && "cursor-pointer hover:border-emerald-300",
          );
          const tint = selected
            ? "bg-emerald-500/35"
            : r.isEx
              ? "bg-accent/25"
              : r.rested
                ? "bg-slate-950/45"
                : "bg-transparent";
          // recurso é carta virada PRA CIMA — mostra a ilustração real (via alias
          // ST01-RESOURCE→R-001 / TOKEN-EX-RESOURCE→EXR-001); verso só se faltar arte.
          const face = (art && r.code && artSrc(art, r.code, "sm")) || cardBackUrl;
          const inner = (
            <>
              <img src={face} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              <span className={cn("absolute inset-0", tint)} />
            </>
          );
          return pickable ? (
            <button
              key={r.instanceId}
              type="button"
              title={title}
              aria-label={title}
              aria-pressed={selected}
              onClick={() => onSelect?.(r.instanceId)}
              className={cn(shape, "min-h-11 min-w-11")}
            >
              {inner}
            </button>
          ) : (
            <span key={r.instanceId} title={title} aria-label={title} className={shape}>
              {inner}
            </span>
          );
        })}
      </div>

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
          <p className="font-mono text-[9px] tabular-nums text-emerald-300">
            {costProgress.paid}/{costProgress.total} pago
          </p>
        </div>
      ) : null}
    </div>
  );
}
