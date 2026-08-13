/* Estatísticas públicas — visão de metagame por coleção, cor, tipo e atividade competitiva. */
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, Cell, XAxis, YAxis } from "recharts";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import { api } from "@/lib/api";
import { CARD_TYPE_OPTIONS, GAME_COLOR_HEX } from "@/lib/gundam-catalog";

const chartConfig = {
  value: { label: "Valor", color: "var(--primary)" },
} satisfies ChartConfig;

const FALLBACK_SLICE_COLOR = "#94a3b8";
const typeLabel = (raw: string) => CARD_TYPE_OPTIONS.find((opt) => opt.value === raw)?.label || raw;

export default function StatsPage() {
  const [health, setHealth] = useState<{ userCount: number; cardCount: number; deckCount: number } | null>(null);
  const [sets, setSets] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [publicDecks, setPublicDecks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([api.health(), api.listSets(), api.listCards(), api.listPublicDecks(), api.listTournaments()])
      .then(([healthRes, setsRes, cardsRes, decksRes, eventsRes]) => {
        setHealth(healthRes);
        setSets(setsRes);
        setCards(cardsRes);
        setPublicDecks(decksRes);
        setEvents(eventsRes);
      })
      .catch(() => undefined);
  }, []);

  const setChart = useMemo(() => sets.map((set) => ({ name: set.code, value: set._count?.cards ?? 0 })), [sets]);

  const colorChart = useMemo(() => {
    const map = new Map<string, number>();
    cards.forEach((card) => map.set(card.color || "Sem cor", (map.get(card.color || "Sem cor") ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [cards]);

  const typeChart = useMemo(() => {
    const map = new Map<string, number>();
    cards.forEach((card) => map.set(card.cardType || "Sem tipo", (map.get(card.cardType || "Sem tipo") ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name: typeLabel(name), value }));
  }, [cards]);

  const deckColorMeta = useMemo(() => {
    const map = new Map<string, number>();
    publicDecks.forEach((deck) => {
      const seen = new Set<string>();
      deck.items?.forEach((item: any) => {
        const color = item.card?.color || "Sem cor";
        if (!seen.has(color)) {
          map.set(color, (map.get(color) ?? 0) + 1);
          seen.add(color);
        }
      });
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [publicDecks]);

  const tournamentChart = useMemo(
    () => events.map((event) => ({ name: event.season || event.name.slice(0, 10), value: event.participantCount || 0 })),
    [events],
  );

  const intelligenceNotes = useMemo(() => {
    const topSet = [...setChart].sort((a, b) => b.value - a.value)[0];
    const topColor = [...colorChart].sort((a, b) => b.value - a.value)[0];
    const topType = [...typeChart].sort((a, b) => b.value - a.value)[0];
    const topDeckColor = [...deckColorMeta].sort((a, b) => b.value - a.value)[0];

    return [
      { label: "Cobertura dominante", value: topSet ? `${topSet.name} com ${topSet.value} cartas cadastradas.` : "Sem coleções suficientes ainda." },
      { label: "Cor mais presente no banco", value: topColor ? `${topColor.name} aparece em ${topColor.value} cartas.` : "Sem cartas suficientes ainda." },
      { label: "Tipo mais representado", value: topType ? `${topType.name} lidera com ${topType.value} cartas.` : "Sem tipos suficientes ainda." },
      { label: "Meta público atual", value: topDeckColor ? `${topDeckColor.name} aparece em ${topDeckColor.value} decks públicos.` : "Ainda não há decks públicos suficientes." },
    ];
  }, [setChart, colorChart, typeChart, deckColorMeta]);

  return (
    <PublicShell breadcrumbs={[{ label: "Estatísticas" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Visão pública</p>
                <h2 className="mt-2 font-heading text-5xl uppercase">Metagame e cobertura do portal</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">Agora a leitura pública vai além do total bruto: mostra distribuição por coleção, cor, tipo, presença em decks públicos e atividade competitiva por evento.</p>
              </div>
              <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">Snapshot ao vivo</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["Usuários", String(health?.userCount ?? 0)],
            ["Cartas", String(health?.cardCount ?? 0)],
            ["Decks públicos", String(publicDecks.length)],
            ["Campeonatos", String(events.length)],
            ["Coleções", String(sets.length)],
          ].map(([label, value]) => (
            <Card key={label} className="panel-cut rounded-none surface-panel"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p><p className="mt-4 font-heading text-5xl leading-none text-white">{value}</p></CardContent></Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="panel-cut rounded-none surface-panel">
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

          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Banco por cor</p>
              <h3 className="mt-2 font-heading text-3xl uppercase">Distribuição de cartas por cor</h3>
              <div className="mt-6 h-[320px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                    <Pie data={colorChart} dataKey="value" nameKey="name" innerRadius={52} outerRadius={95} strokeWidth={2}>
                      {colorChart.map((entry) => <Cell key={entry.name} fill={GAME_COLOR_HEX[entry.name] || FALLBACK_SLICE_COLOR} />)}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                  </PieChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Pool por tipo</p>
              <h3 className="mt-2 font-heading text-3xl uppercase">Tipos mais presentes</h3>
              <div className="mt-6 h-[320px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={typeChart.slice(0, 8)} layout="vertical" margin={{ left: 16, right: 12 }}>
                    <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="var(--color-value)" radius={0} />
                  </BarChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Leitura rápida</p>
              <h3 className="mt-2 font-heading text-3xl uppercase">Intel pública</h3>
              <div className="mt-6 space-y-4">
                {intelligenceNotes.map((item) => (
                  <div key={item.label} className="panel-cut border surface-strong p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                    <p className="mt-2 text-sm leading-7 text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Meta público</p>
              <h3 className="mt-2 font-heading text-3xl uppercase">Cores que aparecem nos decks públicos</h3>
              <div className="mt-6 h-[320px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={deckColorMeta}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" radius={0}>
                      {deckColorMeta.map((entry) => <Cell key={entry.name} fill={GAME_COLOR_HEX[entry.name] || FALLBACK_SLICE_COLOR} />)}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Atividade competitiva</p>
              <h3 className="mt-2 font-heading text-3xl uppercase">Participantes por campeonato</h3>
              <div className="mt-6 h-[320px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <BarChart data={tournamentChart}>
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
      </div>
    </PublicShell>
  );
}
