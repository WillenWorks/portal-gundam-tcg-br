/* Fase 4 §6.3 (docs/44) — dashboard de cobertura de efeitos do motor do simulador.
 *
 * Fonte: `src/modules/simulator/content/_index/coverage.json`, gerado por
 * `pnpm gundam:coverage` (determinístico, versionado). O gate
 * `catalog:coverage:gate` roda no CI e falha o PR que adiciona carta `faltando`.
 * Esta tela é só leitura — não chama backend. */
import { useMemo, useState } from "react";

import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import coverageJson from "@/modules/simulator/content/_index/coverage.json";

type CoverageStatus = "implementada" | "implementada*" | "vanilla" | "deferida" | "faltando";

type CoverageCard = {
  code: string;
  name: string;
  status: CoverageStatus;
  deferredClauses: string[];
};

type CoverageCounts = {
  impl: number;
  implStar: number;
  vanilla: number;
  deferida: number;
  faltando: number;
};

type CoverageSet = { cards: CoverageCard[]; counts: CoverageCounts };

type CoverageData = { generatedFrom: string; sets: Record<string, CoverageSet> };

const coverage = coverageJson as CoverageData;

const STATUS_META: Record<CoverageStatus, { label: string; badge: string; countKey: keyof CoverageCounts }> = {
  implementada: {
    label: "Implementada",
    badge: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    countKey: "impl",
  },
  "implementada*": {
    label: "Implementada* (com deferimento)",
    badge: "border-sky-400/40 bg-sky-400/10 text-sky-300",
    countKey: "implStar",
  },
  vanilla: {
    label: "Vanilla (sem texto bespoke)",
    badge: "border-white/20 bg-white/5 text-slate-300",
    countKey: "vanilla",
  },
  deferida: {
    label: "Deferida (texto sem cobertura)",
    badge: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    countKey: "deferida",
  },
  faltando: {
    label: "Faltando (falha o CI)",
    badge: "border-red-400/40 bg-red-400/10 text-red-300",
    countKey: "faltando",
  },
};

const STATUS_ORDER: CoverageStatus[] = ["implementada", "implementada*", "vanilla", "deferida", "faltando"];

export default function SimulatorCoveragePage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<CoverageStatus | "todos">("todos");

  const setEntries = useMemo(() => Object.entries(coverage.sets), []);

  const totals = useMemo<CoverageCounts>(() => {
    const acc: CoverageCounts = { impl: 0, implStar: 0, vanilla: 0, deferida: 0, faltando: 0 };
    for (const [, set] of setEntries) {
      acc.impl += set.counts.impl;
      acc.implStar += set.counts.implStar;
      acc.vanilla += set.counts.vanilla;
      acc.deferida += set.counts.deferida;
      acc.faltando += set.counts.faltando;
    }
    return acc;
  }, [setEntries]);

  const totalCards = totals.impl + totals.implStar + totals.vanilla + totals.deferida + totals.faltando;

  if (user?.role !== "ADMIN") {
    return (
      <PortalShell breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Cobertura de efeitos" }]}>
        <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
          <CardContent className="p-6">Essa área é exclusiva para administradores.</CardContent>
        </Card>
      </PortalShell>
    );
  }

  return (
    <PortalShell breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Cobertura de efeitos" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="space-y-4 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">
              Simulador · motor de regras
            </p>
            <h2 className="font-heading text-5xl uppercase leading-none">Cobertura de efeitos</h2>
            <p className="max-w-4xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">
              Classificação carta a carta dos sets ST01–ST04 contra o motor do simulador. Gerado por{" "}
              <code className="rounded-none bg-white/10 px-1.5 py-0.5 text-xs">pnpm gundam:coverage</code> a partir de{" "}
              {coverage.generatedFrom}; o gate{" "}
              <code className="rounded-none bg-white/10 px-1.5 py-0.5 text-xs">catalog:coverage:gate</code> roda no CI e
              falha o PR que adicionar carta <span className="text-red-300">faltando</span>.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <button
            type="button"
            onClick={() => setStatusFilter("todos")}
            className={cn(
              "panel-cut rounded-none border p-4 text-left transition",
              statusFilter === "todos"
                ? "border-primary/50 bg-primary/10"
                : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]",
            )}
          >
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Total</p>
            <p className="mt-2 font-heading text-4xl leading-none tabular-nums">{totalCards}</p>
          </button>
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            const value = totals[meta.countKey];
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter((current) => (current === status ? "todos" : status))}
                className={cn(
                  "panel-cut rounded-none border p-4 text-left transition",
                  statusFilter === status
                    ? "border-primary/50 bg-primary/10"
                    : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]",
                )}
              >
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{status}</p>
                <p className="mt-2 font-heading text-4xl leading-none tabular-nums">{value}</p>
              </button>
            );
          })}
        </div>

        {statusFilter !== "todos" ? (
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Filtrando por <span className="text-primary">{STATUS_META[statusFilter].label}</span> ·{" "}
            <button type="button" className="underline underline-offset-4 hover:text-white" onClick={() => setStatusFilter("todos")}>
              limpar
            </button>
          </p>
        ) : null}

        {setEntries.map(([setCode, set]) => {
          const visibleCards =
            statusFilter === "todos" ? set.cards : set.cards.filter((card) => card.status === statusFilter);
          return (
            <Card key={setCode} className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="font-heading text-3xl uppercase">{setCode}</h3>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                    {set.counts.impl} impl · {set.counts.implStar} impl* · {set.counts.vanilla} vanilla ·{" "}
                    {set.counts.deferida} deferida · {set.counts.faltando} faltando
                  </p>
                </div>

                {visibleCards.length === 0 ? (
                  <p className="border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
                    Nenhuma carta com status <span className="text-primary">{STATUS_META[statusFilter as CoverageStatus]?.label}</span> neste set.
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-white/10">
                    <table className="min-w-full text-sm">
                      <thead className="bg-white/5 text-left uppercase tracking-[0.16em] text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Código</th>
                          <th className="px-4 py-3">Carta</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Cláusulas deferidas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleCards.map((card) => (
                          <tr key={card.code} className="border-t border-white/10 align-top">
                            <td className="px-4 py-3 font-mono text-xs text-slate-400">{card.code}</td>
                            <td className="px-4 py-3">{card.name}</td>
                            <td className="px-4 py-3">
                              <Badge className={cn("rounded-none border", STATUS_META[card.status].badge)}>
                                {card.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              {card.deferredClauses.length === 0 ? (
                                <span className="text-slate-600">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {card.deferredClauses.map((clause, index) => (
                                    <Tooltip key={index}>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help border border-amber-400/30 bg-amber-400/[0.06] px-2 py-1 text-[11px] text-amber-200/90">
                                          {clause.length > 48 ? `${clause.slice(0, 48)}…` : clause}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm text-left">{clause}</TooltipContent>
                                    </Tooltip>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PortalShell>
  );
}
