import { useState } from "react";
import { ChevronDown, CheckCircle2, AlertTriangle, Layers, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useAllCardsPlayability } from "./useCardPlayability";

export interface SetPlayabilityProgressProps {
  defaultOpen?: boolean;
  className?: string;
}

export function SetPlayabilityProgress({
  defaultOpen = false,
  className,
}: SetPlayabilityProgressProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { sets, summary, isLoading } = useAllCardsPlayability();

  if (isLoading && !summary) {
    return null;
  }

  const setEntries = Object.values(sets).sort((a, b) => {
    // Ordena sets: ST e GD primeiro, depois EB, depois outros
    return a.set.localeCompare(b.set, undefined, { numeric: true });
  });

  return (
    <Card className={`panel-cut rounded-none surface-panel border-primary/20 ${className ?? ""}`}>
      <CardContent className="p-4 sm:p-5">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 text-left transition hover:opacity-90"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
                  <Activity className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-primary">
                      Motor do Simulador
                    </p>
                    {summary ? (
                      <Badge className="rounded-none border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 text-[10px] font-mono">
                        {summary.percentAptas}% das cartas prontas
                      </Badge>
                    ) : null}
                  </div>
                  <h3 className="font-heading text-xl uppercase tracking-wide text-white">
                    Progresso de Implementação por Coleção
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {summary ? (
                  <div className="hidden text-right sm:block">
                    <p className="font-mono text-sm font-bold text-emerald-300">
                      {summary.aptas} / {summary.total} cartas
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      {summary.revisao} em revisão
                    </p>
                  </div>
                ) : null}
                <div className="flex size-8 items-center justify-center border border-white/10 bg-white/5 text-slate-300">
                  <ChevronDown
                    className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                  />
                </div>
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-5 space-y-4 border-t border-white/10 pt-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              O simulador valida cada carta cláusula por cláusula no motor. Acompanhe abaixo o status de cada conjunto comercial:
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {setEntries.map((setInfo) => {
                const isComplete = setInfo.percentAptas === 100;
                const isPartial = setInfo.percentAptas > 0 && !isComplete;

                return (
                  <div
                    key={setInfo.set}
                    className="border border-white/10 bg-slate-950/60 p-3 space-y-2 transition hover:border-white/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-sm text-white">
                        <Layers className="size-3.5 text-primary" />
                        <span>{setInfo.set}</span>
                      </div>
                      <span
                        className={`font-mono text-xs font-bold ${
                          isComplete
                            ? "text-emerald-400"
                            : isPartial
                              ? "text-amber-400"
                              : "text-slate-500"
                        }`}
                      >
                        {setInfo.percentAptas}%
                      </span>
                    </div>

                    <div className="h-1.5 w-full bg-slate-900 border border-white/10 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isComplete
                            ? "bg-emerald-400"
                            : isPartial
                              ? "bg-amber-400"
                              : "bg-slate-700"
                        }`}
                        style={{ width: `${setInfo.percentAptas}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span className="flex items-center gap-1">
                        {isComplete ? (
                          <CheckCircle2 className="size-2.5 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="size-2.5 text-amber-400" />
                        )}
                        {setInfo.aptas}/{setInfo.total} aptas
                      </span>
                      {setInfo.revisao > 0 ? (
                        <span className="text-amber-300/80">
                          {setInfo.revisao} em revisão
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export default SetPlayabilityProgress;
