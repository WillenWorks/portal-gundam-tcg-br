/* Painel de Metagame Regional Geográfico (docs/54 §8.3, "Zero Local Intelligence") --
 * drill-down País -> Estado -> Cidade -> Loja Parceira sobre a mesma fonte de "resultado
 * real" (TournamentEntry/HostedEventParticipant travado em DeckSnapshot) usada pelo
 * Sistema VEDA (StatsPage). Cada troca de filtro refaz a busca no backend, que já devolve
 * o escopo mais específico comparado contra a média nacional (anomalias + alertas). */
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, PolarAngleAxis, PolarGrid, Radar, RadarChart, XAxis, YAxis } from "recharts";
import { MapPin, Radar as RadarIcon, ShieldAlert, Store, TriangleAlert } from "lucide-react";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import { api, type RegionalMetaResponse, type RegionGroupStats } from "@/lib/api";
import { COLOR_OPTIONS, GAME_COLOR_HEX, GAME_COLOR_LABEL_PT } from "@/lib/gundam-catalog";

const radarConfig = {
  Regional: { label: "Região Selecionada", color: "var(--primary)" },
  Nacional: { label: "Média Nacional", color: "var(--accent)" },
} satisfies ChartConfig;

const cardsConfig = {
  presenceRate: { label: "Presença (%)", color: "var(--primary)" },
} satisfies ChartConfig;

export default function RegionalMetaPage() {
  const [data, setData] = useState<RegionalMetaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedStore, setSelectedStore] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    api
      .getRegionalMeta({
        state: selectedState || undefined,
        city: selectedCity || undefined,
        store: selectedStore || undefined,
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selectedState, selectedCity, selectedStore]);

  const focusRegion: RegionGroupStats | null = useMemo(() => {
    if (!data) return null;
    if (selectedStore) return data.stores.find((s) => s.label === selectedStore) || null;
    if (selectedCity) return data.cities.find((c) => c.label === selectedCity) || null;
    if (selectedState) return data.states.find((s) => s.key === selectedState) || null;
    return data.national;
  }, [data, selectedState, selectedCity, selectedStore]);

  const focusLabel = selectedStore || selectedCity || (selectedState ? data?.states.find((s) => s.key === selectedState)?.label : null) || "Brasil (Nacional)";

  const radarData = useMemo(() => {
    if (!data || !focusRegion) return [];
    const regionByColor = new Map(focusRegion.colorDistribution.map((c) => [c.color, c.presenceRate]));
    const nationalByColor = new Map(data.national.colorDistribution.map((c) => [c.color, c.presenceRate]));
    return COLOR_OPTIONS.map((color) => ({
      color: GAME_COLOR_LABEL_PT[color] || color,
      Regional: regionByColor.get(color) ?? 0,
      Nacional: nationalByColor.get(color) ?? 0,
    }));
  }, [data, focusRegion]);

  const cardsData = useMemo(() => (focusRegion?.topCards || []).map((c) => ({ name: c.name, presenceRate: c.presenceRate, color: c.color })), [focusRegion]);

  const handleStateChange = (value: string) => {
    setSelectedState(value);
    setSelectedCity("");
    setSelectedStore("");
  };
  const handleCityChange = (value: string) => {
    setSelectedCity(value);
    setSelectedStore("");
  };

  return (
    <PublicShell breadcrumbs={[{ label: "Zero System" }, { label: "Metagame Regional" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.24em] text-primary font-semibold">
                  <RadarIcon className="size-3.5 text-accent" /> Zero Local Intelligence
                </p>
                <h2 className="mt-2 font-heading text-5xl uppercase">Metagame Regional Geográfico</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                  Comparação do metagame local contra a média nacional, agrupado por País → Estado → Cidade → Loja Parceira, a partir de resultados reais de torneios e eventos concluídos.
                </p>
              </div>
              <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{data ? `${data.totalDecks} decks analisados` : "Carregando..."}</Badge>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Circuito</p>
              <select
                value={selectedState}
                onChange={(event) => handleStateChange(event.target.value)}
                className="field-shell h-9 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white"
              >
                <option value="">Todos os estados (Nacional)</option>
                {(data?.states || [])
                  .filter((s) => s.key !== "Não informado")
                  .map((s) => (
                    <option key={s.key} value={s.key}>{s.label} ({s.totalDecks})</option>
                  ))}
              </select>
              <select
                value={selectedCity}
                onChange={(event) => handleCityChange(event.target.value)}
                disabled={!data?.cities.length}
                className="field-shell h-9 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white disabled:opacity-40"
              >
                <option value="">{selectedState ? "Todas as cidades do estado" : "Todas as cidades (Top nacional)"}</option>
                {(data?.cities || []).map((c) => (
                  <option key={c.key} value={c.label}>{c.label} ({c.totalDecks})</option>
                ))}
              </select>
              <select
                value={selectedStore}
                onChange={(event) => setSelectedStore(event.target.value)}
                disabled={!data?.stores.length}
                className="field-shell h-9 rounded-none border border-white/15 bg-slate-950/70 px-3 text-sm text-white disabled:opacity-40"
              >
                <option value="">{selectedCity ? "Todas as lojas da cidade" : "Todas as lojas parceiras"}</option>
                {(data?.stores || []).map((s) => (
                  <option key={s.key} value={s.label}>{s.label} ({s.totalDecks})</option>
                ))}
              </select>
              {(selectedState || selectedCity || selectedStore) ? (
                <button type="button" onClick={() => handleStateChange("")} className="text-xs uppercase tracking-[0.16em] text-primary hover:underline">
                  Limpar filtro
                </button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="panel-cut rounded-none border-primary/30 hero-surface">
            <CardContent className="p-6">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-slate-500"><MapPin className="size-3.5" /> Distribuição de Cores</p>
              <h3 className="mt-1 font-heading text-2xl uppercase">{focusLabel} vs. Nacional</h3>
              <div className="mt-4 h-[320px]">
                {!loading && radarData.length ? (
                  <ChartContainer config={radarConfig} className="h-full w-full">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.12)" />
                      <PolarAngleAxis dataKey="color" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Radar name="Região Selecionada" dataKey="Regional" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.35} />
                      <Radar name="Média Nacional" dataKey="Nacional" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15} />
                      <ChartLegend content={<ChartLegendContent />} />
                    </RadarChart>
                  </ChartContainer>
                ) : (
                  <p className="flex h-full items-center justify-center text-sm text-slate-500">{loading ? "Carregando telemetria regional..." : "Sem dados suficientes pra esse recorte."}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none border-primary/30 hero-surface">
            <CardContent className="p-6">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-slate-500"><Store className="size-3.5" /> Staple Cards Locais</p>
              <h3 className="mt-1 font-heading text-2xl uppercase">Cartas Mais Utilizadas — {focusLabel}</h3>
              <div className="mt-4 h-[320px]">
                {!loading && cardsData.length ? (
                  <ChartContainer config={cardsConfig} className="h-full w-full">
                    <BarChart data={cardsData} layout="vertical" margin={{ left: 16, right: 12 }}>
                      <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.08)" />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} unit="%" />
                      <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="presenceRate" radius={0}>
                        {cardsData.map((entry, index) => (
                          <Cell key={index} fill={GAME_COLOR_HEX[entry.color || ""] || "#94a3b8"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <p className="flex h-full items-center justify-center text-sm text-slate-500">{loading ? "Carregando telemetria regional..." : "Sem dados suficientes pra esse recorte."}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="panel-cut rounded-none border-accent/40 hero-surface">
          <CardContent className="p-6">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.24em] text-accent">
              <ShieldAlert className="size-3.5" /> Alertas Táticos Regionais do Zero System
            </p>
            <h3 className="mt-2 font-heading text-3xl uppercase">Desvios de Meta — {focusLabel}</h3>
            <div className="mt-4 space-y-3">
              {data?.alerts.length ? (
                data.alerts.map((alert, index) => (
                  <div key={index} className="flex items-start gap-3 border border-accent/20 bg-accent/5 p-4">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent" />
                    <p className="text-sm leading-relaxed text-slate-200">{alert}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  {selectedState || selectedCity || selectedStore
                    ? "Nenhum desvio relevante detectado pra esse recorte (a região está alinhada com a média nacional, ou a amostra ainda é pequena demais pra ser conclusiva)."
                    : "Selecione um estado, cidade ou loja parceira pra o Zero System comparar o metagame local contra a média nacional."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {focusRegion ? (
          <Card className="panel-cut rounded-none border-primary/30 hero-surface">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Resumo Tático</p>
              <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-3xl font-heading">{focusRegion.totalDecks}</p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Decks Registrados</p>
                </div>
                <div>
                  <p className="text-3xl font-heading">{focusRegion.winRate != null ? `${focusRegion.winRate}%` : "—"}</p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Winrate Local</p>
                </div>
                <div>
                  <p className="text-3xl font-heading">{focusRegion.wins}-{focusRegion.losses}-{focusRegion.draws}</p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">V-D-E</p>
                </div>
                <div>
                  <p className="text-3xl font-heading">{data?.anomalies.length ?? 0}</p>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Anomalias Detectadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PublicShell>
  );
}
