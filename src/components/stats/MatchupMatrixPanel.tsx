/* Matriz de Confrontos (Fase 3, SCAFFOLD -- ver PLANO_METAGAME_TORNEIOS_TELEMETRIA.md
 * §2.4 e §5). Hoje não existe nenhum fluxo de captura de arquétipo/iniciativa por
 * partida em evento ao vivo, então hasData normalmente vem false -- o painel mostra o
 * estado vazio de forma resiliente (critério de aceitação §6.2) em vez de quebrar ou
 * fingir dado que não existe. Assim que essa captura existir, o painel passa a
 * preencher sozinho (a leitura já está correta em tournamentIntelligenceService.ts). */
import { useEffect, useState } from "react";
import { Swords, Info } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, type MatchupMatrixResponse } from "@/lib/api";

const WINDOW_OPTIONS = [
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "all", label: "Histórico Geral" },
] as const;

function winRateColor(rate: number | null) {
  if (rate == null) return "bg-white/5 text-slate-500";
  if (rate >= 0.6) return "bg-emerald-500/20 text-emerald-300";
  if (rate >= 0.45) return "bg-amber-500/15 text-amber-200";
  return "bg-red-500/15 text-red-300";
}

export function MatchupMatrixPanel({ seasonId }: { seasonId: string }) {
  const [windowValue, setWindowValue] = useState<(typeof WINDOW_OPTIONS)[number]["value"]>("all");
  const [data, setData] = useState<MatchupMatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getMatchupMatrix({ seasonId, window: windowValue })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [seasonId, windowValue]);

  const cellFor = (a: string, b: string) => data?.cells.find((c) => c.archetypeA === a && c.archetypeB === b) || null;

  return (
    <Card className="panel-cut rounded-none surface-panel">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.24em] text-slate-400">
              <Swords className="size-3.5 text-accent" /> Matriz de Confrontos & Telemetria Avançada
            </p>
            <h3 className="mt-2 font-heading text-3xl uppercase">Matchups por Arquétipo</h3>
          </div>
          <div className="flex gap-2">
            {WINDOW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setWindowValue(opt.value)}
                className={`panel-cut border px-3 py-1.5 text-xs uppercase tracking-[0.12em] ${windowValue === opt.value ? "border-primary/60 bg-primary/10 text-primary" : "border-white/15 text-slate-400 hover:border-white/30"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-slate-400">Carregando matriz...</p>
        ) : !data?.hasData ? (
          <div className="mt-6 panel-cut border border-white/10 bg-slate-950/60 p-6">
            <p className="flex items-center gap-2 text-sm text-slate-300">
              <Info className="size-4 shrink-0 text-accent" />
              Ainda não há partidas com arquétipo e telemetria de iniciativa declarados o suficiente pra montar a matriz nesse recorte.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Este módulo já está pronto pra ler confronto direto, Vitórias no Turno 1/2 (WR 1st/2nd) e Taxa de Iniciativa (Dice WR) assim que o fluxo de lançamento de partida do Hoster passar a capturar esse dado por confronto.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-slate-500">Arquétipo \ Adversário</th>
                    {data.archetypes.map((a) => <th key={a} className="p-2 text-center uppercase tracking-[0.08em] text-slate-500">{a}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.archetypes.map((rowArch) => (
                    <tr key={rowArch}>
                      <th className="p-2 text-left font-normal text-white">{rowArch}</th>
                      {data.archetypes.map((colArch) => {
                        if (rowArch === colArch) return <td key={colArch} className="p-2 text-center text-slate-700">—</td>;
                        const cell = cellFor(rowArch, colArch);
                        return (
                          <td key={colArch} className={`p-2 text-center ${winRateColor(cell?.winRate ?? null)}`}>
                            {cell?.winRate != null ? `${Math.round(cell.winRate * 100)}%` : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: "Vitórias no Turno 1 (1º a Jogar)", data: data.wr1st },
                { label: "Vitórias no Turno 2 (2º a Jogar)", data: data.wr2nd },
                { label: "Taxa de Iniciativa (Dado)", data: data.diceWinRate },
              ].map((block) => (
                <div key={block.label} className="panel-cut border surface-strong p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{block.label}</p>
                  <div className="mt-3 space-y-1.5">
                    {Object.entries(block.data).map(([archetype, rate]) => (
                      <div key={archetype} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{archetype}</span>
                        <Badge variant="outline" className="border-white/15 text-slate-200">{rate != null ? `${Math.round(rate * 100)}%` : "—"}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
