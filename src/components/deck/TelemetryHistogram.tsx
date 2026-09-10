/* Histograma de Telemetria Mecha — Exburst Style
 * Renderiza gráficos verticais limpos e precisos com escala numérica em ambos os eixos. */
import { useMemo } from "react";
import type { HistogramBin } from "@/lib/deck-advanced-stats";

interface TelemetryHistogramProps {
  title: string;
  bins: HistogramBin[];
  barColor?: string;
  height?: number;
}

export function TelemetryHistogram({
  title,
  bins,
  barColor = "#0ea5e9", // Sky/Cyan mecha color
  height = 110,
}: TelemetryHistogramProps) {
  const maxVal = useMemo(() => {
    const m = Math.max(...bins.map((b) => b.count), 0);
    return m === 0 ? 5 : Math.ceil(m / 5) * 5;
  }, [bins]);

  const yTicks = [maxVal, Math.round(maxVal / 2), 0];

  return (
    <div className="rounded-none border border-white/10 bg-slate-950/80 p-3 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-heading uppercase tracking-wider text-slate-300">
          {title}
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          Max: {maxVal}
        </span>
      </div>

      <div className="relative flex items-end gap-1.5" style={{ height: `${height}px` }}>
        {/* Eixo Y com ticks */}
        <div className="flex flex-col justify-between h-full pr-1.5 border-r border-white/10 text-[9px] font-mono text-slate-500 select-none">
          {yTicks.map((tick, idx) => (
            <span key={idx} className="leading-none text-right w-4">
              {tick}
            </span>
          ))}
        </div>

        {/* Barras do Histograma */}
        <div className="flex-1 flex items-end justify-between gap-1 h-full pt-2">
          {bins.map((bin) => {
            const pct = maxVal > 0 ? (bin.count / maxVal) * 100 : 0;
            return (
              <div
                key={bin.label}
                className="flex-1 flex flex-col items-center h-full justify-end group relative"
              >
                {/* Tooltip no hover */}
                <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-white/20 px-1.5 py-0.5 rounded text-[10px] font-mono text-white pointer-events-none z-10 whitespace-nowrap shadow-lg">
                  {bin.count} cartas ({bin.label})
                </div>

                {/* Barra */}
                <div
                  className="w-full transition-all duration-300 relative rounded-t-sm"
                  style={{
                    height: `${pct}%`,
                    backgroundColor: bin.count > 0 ? barColor : "transparent",
                    opacity: bin.count > 0 ? 0.85 : 0.2,
                    minHeight: bin.count > 0 ? "4px" : "0px",
                  }}
                >
                  {bin.count > 0 && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[8px] font-mono font-bold text-slate-300">
                      {bin.count}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Eixo X com labels */}
      <div className="flex items-center pl-6 pt-1 border-t border-white/10 mt-1">
        {bins.map((bin) => (
          <div
            key={bin.label}
            className="flex-1 text-center text-[9px] font-mono text-slate-400"
          >
            {bin.label}
          </div>
        ))}
      </div>
    </div>
  );
}
