/* Estatísticas públicas — visão macro do portal para usuários deslogados entenderem cobertura e escala atual. */
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { api } from "@/lib/api";

const chartConfig = {
  value: { label: "Valor", color: "#47a0ff" },
} satisfies ChartConfig;

export default function StatsPage() {
  const [health, setHealth] = useState<{ userCount: number; cardCount: number; deckCount: number } | null>(null);
  const [sets, setSets] = useState<Array<{ code: string; _count?: { cards: number } }>>([]);
  const [publicDecks, setPublicDecks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([api.health(), api.listSets(), api.listPublicDecks(), api.listTournaments()]).then(([healthRes, setsRes, decksRes, eventsRes]) => {
      setHealth(healthRes);
      setSets(setsRes);
      setPublicDecks(decksRes);
      setEvents(eventsRes);
    }).catch(() => undefined);
  }, []);

  const setChart = useMemo(() => sets.map((set) => ({ name: set.code, value: set._count?.cards ?? 0 })), [sets]);

  return (
    <PortalShell breadcrumbs={[{ label: "Estatísticas" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Visão pública</p>
                <h2 className="mt-2 font-heading text-5xl uppercase">Cobertura atual do portal</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">Antes mesmo do login, o usuário já entende o tamanho da base, quantos decks públicos existem, quantas coleções estão publicadas e o estado do hub competitivo.</p>
              </div>
              <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">Snapshot ao vivo</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Usuários", String(health?.userCount ?? 0)],
            ["Cartas", String(health?.cardCount ?? 0)],
            ["Decks públicos", String(publicDecks.length)],
            ["Campeonatos", String(events.length)],
          ].map(([label, value]) => (
            <Card key={label} className="panel-cut rounded-none border-white/10 bg-white/5 text-white"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p><p className="mt-4 font-heading text-5xl leading-none text-white">{value}</p></CardContent></Card>
          ))}
        </div>

        <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
          <CardContent className="p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Cobertura por coleção</p>
            <h3 className="mt-2 font-heading text-3xl uppercase">Cartas cadastradas por expansão</h3>
            <div className="mt-6 h-[320px]">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <BarChart data={setChart}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={0} />
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}
