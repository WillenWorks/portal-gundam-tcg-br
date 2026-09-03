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

interface ResourceMeterItem {
  instanceId: string;
  rested: boolean;
  isEx: boolean;
}

interface ResourceMeterProps {
  resources: ResourceMeterItem[];
  level: number;
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
          "flex min-w-0 items-end gap-1 overflow-x-auto overscroll-x-contain pb-0.5",
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
          const shape = cn(
            "block shrink-0 border transition-all duration-100 motion-reduce:transition-none",
            readOnly
              ? "h-[calc(var(--card,3.5rem)*0.5)] w-[calc(var(--card,3.5rem)*0.34)]"
              : "h-[calc(var(--card,3.5rem)*0.7)] w-[calc(var(--card,3.5rem)*0.5)]",
            selected
              ? "border-emerald-400 bg-emerald-500/30 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
              : r.isEx
                ? "border-accent bg-accent/20 shadow-[0_0_6px_rgba(234,179,8,0.35)]"
                : r.rested
                  ? "rotate-90 border-white/10 bg-slate-700/40 opacity-60"
                  : "border-primary/50 bg-primary/15",
            pickable && "cursor-pointer hover:border-emerald-300",
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
            />
          ) : (
            <span key={r.instanceId} title={title} aria-label={title} className={shape} />
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
