/* Fase C (docs/19) — medidor horizontal da economia de recursos (substitui a
 * ResourceTray). Cada recurso é uma peça: em pé = ativo, girada (mas ainda
 * legível como retângulo tombado) = rested/gasto. EX Resource ganha moldura
 * dourada (`--accent`) e o aviso de que sai de jogo se gasto.
 *
 * A leitura rápida é uma linha segmentada em mono (`◆◆◆◆◇`) + "{ativos}
 * ativos · nível {level}".
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
}

export function ResourceMeter({
  resources,
  level,
  selectable,
  selectedIds = [],
  onSelect,
  readOnly,
  costProgress,
}: ResourceMeterProps) {
  const active = resources.filter((r) => !r.rested).length;
  const segments = resources.length ? resources.map((r) => (r.rested ? "◇" : "◆")).join("") : "—";

  return (
    <div className={cn("flex flex-col gap-1", readOnly && "opacity-90")}>
      <p className="font-mono text-xs font-bold tabular-nums text-slate-200">
        <span className={cn("mr-1 tracking-tight", readOnly ? "text-sm" : "text-base")}>{segments}</span>
        <span className="text-cyan-300">{active}</span> ativos
        <span className="text-slate-600"> · </span>
        nível <span className="text-amber-300">{level}</span>
      </p>

      {resources.length === 0 ? (
        <p className="text-[9px] text-muted-portal">Nenhum recurso.</p>
      ) : (
        <div className={cn("flex flex-wrap items-center gap-1", readOnly && "gap-0.5")}>
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
                ? "border-emerald-400 bg-emerald-500/30"
                : r.isEx
                  ? "border-accent bg-accent/20"
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
          <p className="font-mono text-[9px] tabular-nums text-emerald-300">
            {costProgress.paid}/{costProgress.total} pago
          </p>
        </div>
      ) : null}
    </div>
  );
}
