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
          // V6.3 (docs/34) — tamanho-padrão único: era uma proporção própria
          // (0.5×0.7 ativo / 0.34×0.5 gasto), sem `aspect-*` nenhum e SEM
          // `rounded-arena` (achado do Willen: cantos retos, tamanho
          // diferente do Deck de Recursos ao lado). Agora usa a MESMA
          // largura-padrão `--card-w-std` que toda outra peça — `readOnly`
          // (recursos do oponente) continua menor, mas como FRAÇÃO desse
          // mesmo padrão (`*0.7`), não uma proporção própria desconectada.
          const portraitWidth = readOnly ? "calc(var(--card-w-std,2.17rem)*0.7)" : "var(--card-w-std,2.17rem)";
          const tone = selected
            ? "border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
            : r.isEx
              ? "border-accent shadow-[0_0_6px_rgba(234,179,8,0.35)]"
              : r.rested
                ? "border-white/10 opacity-60"
                : "border-primary/50";
          // V6.3 (docs/34) — corrige o corte da imagem no estado "gasto": antes,
          // `rotate-90` girava a MESMA caixa retrato (o `object-cover` já tinha
          // recortado pro formato ERRADO antes do giro). Agora a caixa EXTERNA já
          // nasce em paisagem (`aspect-[88/63]`, footprint = a caixa retrato
          // rotacionada) — e só a imagem por dentro (numa caixa retrato do
          // tamanho normal) gira 90°, preenchendo a paisagem certinho.
          const shape = cn(
            "relative block shrink-0 overflow-hidden rounded-arena border transition-all duration-100 motion-reduce:transition-none",
            r.rested ? "aspect-[88/63]" : "aspect-[63/88]",
            tone,
            pickable && "cursor-pointer hover:border-emerald-300",
          );
          const shapeStyle = { width: r.rested ? `calc(${portraitWidth} * 88 / 63)` : portraitWidth };
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
          const artBox = <img src={face} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />;
          const inner = (
            <>
              {r.rested ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="relative aspect-[63/88] overflow-hidden rotate-90" style={{ width: portraitWidth }}>
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
              key={r.instanceId}
              type="button"
              title={title}
              aria-label={title}
              aria-pressed={selected}
              onClick={() => onSelect?.(r.instanceId)}
              className={cn(shape, "min-h-11 min-w-11")}
              style={shapeStyle}
            >
              {inner}
            </button>
          ) : (
            <span key={r.instanceId} title={title} aria-label={title} className={shape} style={shapeStyle}>
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
          <p className="font-mono text-[9px] font-medium tabular-nums text-emerald-300">
            {costProgress.paid}/{costProgress.total} pago
          </p>
        </div>
      ) : null}
    </div>
  );
}
