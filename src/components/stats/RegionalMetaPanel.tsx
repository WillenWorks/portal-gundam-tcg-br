/* Painel de Metagame Regional Geográfico (docs/54 §8.3, "Zero Local Intelligence") --
 * Drill-down País -> Estado -> Cidade -> Loja Parceira sobre a mesma fonte de "resultado
 * real" (TournamentEntry/HostedEventParticipant travado em DeckSnapshot) usada pelo
 * Sistema VEDA. Suporta modo embutido (StatsPage) e autônomo (RegionalMetaPage). */
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, PolarAngleAxis, PolarGrid, Radar, RadarChart, XAxis, YAxis } from "recharts";
import { MapPin, Radar as RadarIcon, ShieldAlert, Store, TriangleAlert } from "lucide-react";

import { DataSourceNote } from "@/components/stats/DataSourceNote";
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
  presenceRate: { label: "Presença", color: "var(--primary)" },
} satisfies ChartConfig;

export interface RegionalMetaPanelProps {
  seasonId?: string;
  setId?: string;
  initialState?: string;
  initialCity?: string;
  initialStore?: string;
  onFilterChange?: (filters: { state?: string; city?: string; store?: string }) => void;
  showHeader?: boolean;
}

export function RegionalMetaPanel({
  seasonId,
  setId,
  initialState = "",
  initialCity = "",
  initialStore = "",
  onFilterChange,
  showHeader = true,
}: RegionalMetaPanelProps) {
  const [selectedState, setSelectedState] = useState<string>(initialState);
  const [selectedCity, setSelectedCity] = useState<string>(initialCity);
  const [selectedStore, setSelectedStore] = useState<string>(initialStore);

  const [data, setData] = useState<RegionalMetaResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getRegionalMeta({
      seasonId,
      setId,
      state: selectedState || undefined,
      city: selectedCity || undefined,
      store: selectedStore || undefined,
    })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [seasonId, setId, selectedState, selectedCity, selectedStore]);

  const handleStateChange = (state: string) => {
    setSelectedState(state);
    setSelectedCity("");
    setSelectedStore("");
    onFilterChange?.({ state: state || undefined, city: undefined, store: undefined });
  };

  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    setSelectedStore("");
    onFilterChange?.({ state: selectedState || undefined, city: city || undefined, store: undefined });
  };

  const handleStoreChange = (store: string) => {
    setSelectedStore(store);
    onFilterChange?.({ state: selectedState || undefined, city: selectedCity || undefined, store: store || undefined });
  };

  const focusRegion: RegionGroupStats | null = useMemo(() => {
    if (!data) return null;
    if (selectedStore) return data.stores.find((s) => s.label === selectedStore) || null;
    if (selectedCity) return data.cities.find((c) => c.label === selectedCity) || null;
    if (selectedState) return data.states.find((s) => s.key === selectedState) || null;
    return data.national;
  }, [data, selectedStore, selectedCity, selectedState]);

  const radarData = useMemo(() => {
    if (!data || !focusRegion) return [];
    const regionByColor = new Map(focusRegion.colorDistribution.map((c) => [c.color.toLowerCase(), c.presenceRate]));
    const nationalByColor = new Map(data.national.colorDistribution.map((c) => [c.color.toLowerCase(), c.presenceRate]));
    return COLOR_OPTIONS.map((c) => ({
      color: GAME_COLOR_LABEL_PT[c] || c,
      Regional: regionByColor.get(c.toLowerCase()) ?? 0,
      Nacional: nationalByColor.get(c.toLowerCase()) ?? 0,
    }));
  }, [data, focusRegion]);

  const cardsData = useMemo(() => {
    return (focusRegion?.topCards || []).slice(0, 8).map((c) => ({
      name: c.name,
      presenceRate: c.presenceRate,
      color: c.color,
    }));
  }, [focusRegion]);

  const focusLabel = selectedStore || selectedCity || (selectedState ? data?.states.find((s) => s.key === selectedState)?.label : null) || "Brasil (Nacional)";

  return (
    <div className="space-y-6">
      <Card className="panel-cut rounded-none border-primary/30 hero-surface">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.24em] text-primary font-semibold">
                <RadarIcon className="size-3.5 text-accent" /> Zero Local Intelligence · Metagame Brasil
              </p>
              {showHeader && (
                <>
                  <h3 className="mt-2 font-heading text-3xl sm:text-4xl uppercase dark:text-white light:text-slate-900">
                    Metagame Regional Geográfico
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed dark:text-slate-300 light:text-slate-600">
                    Comparação do metagame brasileiro por Estado ➔ Cidade ➔ Loja Parceira contra a média nacional, alimentada por resultados reais de torneios e ligas parceiras.
                  </p>
                </>
              )}
            </div>
            <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">
              {data ? `${data.totalDecks} decks analisados` : "Carregando..."}
            </Badge>
          </div>

          {data?.provenance ? (
            <DataSourceNote
              provenance={data.provenance}
              labelPrefix={`${focusLabel}: baseado em`}
              weightNote="Cada lista conta igual, independente do tamanho do torneio."
              className="mt-4"
            />
          ) : null}

          {/* Filtros Geográficos */}
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t dark:border-white/10 light:border-slate-200 pt-5">
            <p className="text-xs uppercase tracking-[0.2em] dark:text-slate-500 light:text-slate-600 font-mono">Circuito:</p>
            <select
              value={selectedState}
              onChange={(event) => handleStateChange(event.target.value)}
              className="field-shell h-9 rounded-none border dark:border-white/15 dark:bg-slate-950/70 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 px-3 text-sm"
            >
              <option value="">Todos os estados (Nacional)</option>
              {(data?.states || [])
                .filter((s) => s.key !== "Não informado")
                .map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label} ({s.totalDecks})
                  </option>
                ))}
            </select>
            <select
              value={selectedCity}
              onChange={(event) => handleCityChange(event.target.value)}
              disabled={!data?.cities.length}
              className="field-shell h-9 rounded-none border dark:border-white/15 dark:bg-slate-950/70 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 px-3 text-sm disabled:opacity-40"
            >
              <option value="">{selectedState ? "Todas as cidades do estado" : "Todas as cidades (Top nacional)"}</option>
              {(data?.cities || []).map((c) => (
                <option key={c.key} value={c.label}>
                  {c.label} ({c.totalDecks})
                </option>
              ))}
            </select>
            <select
              value={selectedStore}
              onChange={(event) => handleStoreChange(event.target.value)}
              disabled={!data?.stores.length}
              className="field-shell h-9 rounded-none border dark:border-white/15 dark:bg-slate-950/70 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 px-3 text-sm disabled:opacity-40"
            >
              <option value="">{selectedCity ? "Todas as lojas da cidade" : "Todas as lojas parceiras"}</option>
              {(data?.stores || []).map((s) => (
                <option key={s.key} value={s.label}>
                  {s.label} ({s.totalDecks})
                </option>
              ))}
            </select>
            {selectedState || selectedCity || selectedStore ? (
              <button
                type="button"
                onClick={() => handleStateChange("")}
                className="text-xs uppercase tracking-[0.16em] text-primary hover:underline font-mono"
              >
                Limpar filtro
              </button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Gráficos Radar e Barras */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] dark:text-slate-400 light:text-slate-600 font-mono">
              <MapPin className="size-3.5 text-primary" /> Distribuição de Cores
            </p>
            <h4 className="mt-1 font-heading text-2xl uppercase dark:text-white light:text-slate-900">{focusLabel} vs. Nacional</h4>
            <div className="mt-4 h-[320px]">
              {!loading && radarData.length ? (
                <ChartContainer config={radarConfig} className="h-full w-full">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.12)" />
                    <PolarAngleAxis dataKey="color" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Radar
                      name="Região Selecionada"
                      dataKey="Regional"
                      stroke="var(--primary)"
                      fill="var(--primary)"
                      fillOpacity={0.35}
                    />
                    <Radar
                      name="Média Nacional"
                      dataKey="Nacional"
                      stroke="var(--accent)"
                      fill="var(--accent)"
                      fillOpacity={0.15}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                  </RadarChart>
                </ChartContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm dark:text-slate-500 light:text-slate-600">
                  {loading ? "Carregando telemetria regional..." : "Sem dados suficientes pra esse recorte."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] dark:text-slate-400 light:text-slate-600 font-mono">
              <Store className="size-3.5 text-primary" /> Staple Cards Locais
            </p>
            <h4 className="mt-1 font-heading text-2xl uppercase dark:text-white light:text-slate-900">Cartas Mais Utilizadas — {focusLabel}</h4>
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
                <p className="flex h-full items-center justify-center text-sm dark:text-slate-500 light:text-slate-600">
                  {loading ? "Carregando telemetria regional..." : "Sem dados suficientes pra esse recorte."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas Táticos Regionais */}
      <Card className="panel-cut rounded-none border-accent/40 hero-surface">
        <CardContent className="p-6">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.24em] text-accent font-semibold font-mono">
            <ShieldAlert className="size-3.5" /> Alertas Táticos Regionais do Zero System
          </p>
          <h4 className="mt-2 font-heading text-2xl uppercase dark:text-white light:text-slate-900">Desvios de Meta — {focusLabel}</h4>
          <div className="mt-4 space-y-3">
            {data?.alerts.length ? (
              data.alerts.map((alert, index) => (
                <div key={index} className="flex items-start gap-3 border dark:border-accent/20 dark:bg-accent/5 light:border-sky-300 light:bg-sky-50/70 p-4 panel-cut">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent" />
                  <p className="text-sm leading-relaxed dark:text-slate-200 light:text-slate-800">{alert}</p>
                </div>
              ))
            ) : (
              <p className="text-sm dark:text-slate-500 light:text-slate-600">
                {selectedState || selectedCity || selectedStore
                  ? "Nenhum desvio relevante detectado pra esse recorte (a região está alinhada com a média nacional, ou a amostra ainda é pequena demais pra ser conclusiva)."
                  : "Selecione um estado, cidade ou loja parceira para o Zero System comparar o metagame local contra a média nacional."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumo Estatístico do Recorte */}
      {focusRegion ? (
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6">
            <p className="text-xs uppercase tracking-[0.2em] dark:text-slate-400 light:text-slate-600 font-mono">Resumo Tático Local</p>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4 font-mono">
              <div>
                <p className="text-3xl font-heading dark:text-white light:text-slate-900">{focusRegion.totalDecks}</p>
                <p className="text-xs uppercase tracking-wider dark:text-slate-400 light:text-slate-600">Decks Registrados</p>
              </div>
              <div>
                <p className="text-3xl font-heading text-primary">
                  {focusRegion.winRate != null ? `${focusRegion.winRate}%` : "—"}
                </p>
                <p className="text-xs uppercase tracking-wider dark:text-slate-400 light:text-slate-600">Winrate Local</p>
              </div>
              <div>
                <p className="text-3xl font-heading dark:text-white light:text-slate-900">
                  {focusRegion.wins}-{focusRegion.losses}-{focusRegion.draws}
                </p>
                <p className="text-xs uppercase tracking-wider dark:text-slate-400 light:text-slate-600">V-D-E</p>
              </div>
              <div>
                <p className="text-3xl font-heading text-accent">{data?.anomalies.length ?? 0}</p>
                <p className="text-xs uppercase tracking-wider dark:text-slate-400 light:text-slate-600">Anomalias Detectadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
