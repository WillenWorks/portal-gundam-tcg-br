/* Estatísticas públicas — visão de metagame por coleção, cor, tipo e atividade competitiva.
 * Reformulado com segmentação modular em 4 Abas Táticas (Metagame da temporada padrão — src/lib/seasons.ts,
 * Metagame Nacional/Brasil, Acervo Geral e Telemetria Avançada VEDA). */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Trophy,
  Layers,
  Swords,
  MapPin,
  Database,
  Cpu,
  RotateCcw,
} from "lucide-react";

import { PublicShell } from "@/components/layout/PublicShell";
import { AdSlot } from "@/components/ads/AdSlot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { api, type MetagameStatsResponse } from "@/lib/api";
import {
  NON_STATS_SECTIONS,
  isNonStatsCard,
  isNonStatsSetCode,
  isNonStatsCardType,
} from "@/lib/deck-legality";
import { CARD_TYPE_OPTIONS, GAME_COLOR_HEX, GAME_COLOR_LABEL_PT, COLOR_OPTIONS } from "@/lib/gundam-catalog";
import { MetaAnalyticsPanel } from "@/components/stats/MetaAnalyticsPanel";
import { PowerRankingsPanel } from "@/components/stats/PowerRankingsPanel";
import { FormatArchetypeCoresPanel } from "@/components/stats/FormatArchetypeCoresPanel";
import { RegionalMetaPanel } from "@/components/stats/RegionalMetaPanel";
import { MatchupMatrixPanel } from "@/components/stats/MatchupMatrixPanel";
import { WeeklyTrendsPanel } from "@/components/stats/WeeklyTrendsPanel";
import { DEFAULT_ANALYSIS_SEASON, LATEST_SEASON, normalizeSeasonCode, seasonsNewestFirst } from "@/lib/seasons";

const chartConfig = {
  value: { label: "Valor", color: "var(--primary)" },
} satisfies ChartConfig;

const FALLBACK_SLICE_COLOR = "#94a3b8";
const typeLabel = (raw: string) => CARD_TYPE_OPTIONS.find((opt) => opt.value === raw)?.label || raw;
const ALL_VALUE = "__all__";
const DEFAULT_FORMAT = DEFAULT_ANALYSIS_SEASON;

export default function StatsPage() {
  const [health, setHealth] = useState<{ userCount: number; cardCount: number; deckCount: number } | null>(null);
  const [sets, setSets] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [publicDecks, setPublicDecks] = useState<any[]>([]);

  // Filtro de formato / temporada (padrão: DEFAULT_ANALYSIS_SEASON; recortes como GD05.5 contam no próprio formato)
  const [selectedFormat, setSelectedFormat] = useState<string>(DEFAULT_FORMAT);
  const [selectedSetId, setSelectedSetId] = useState<string>(ALL_VALUE);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedTrait, setSelectedTrait] = useState<string>("");
  const [selectedSeries, setSelectedSeries] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Aba ativa selecionada
  const [activeTab, setActiveTab] = useState<string>("competitive");

  // Dados do endpoint de metagame competitivo
  const [metagame, setMetagame] = useState<MetagameStatsResponse | null>(null);

  // Deep-link para o painel ATMI
  const [atmiFocusKey, setAtmiFocusKey] = useState<{ key: string; token: number } | null>(null);
  const handleExploreArchetype = (key: string) => {
    setActiveTab("telemetry");
    setAtmiFocusKey((prev) => ({ key, token: (prev?.token ?? 0) + 1 }));
  };

  useEffect(() => {
    Promise.all([
      api.health(),
      api.listSets(),
      api.listCards(),
      api.listPublicDecks(),
    ])
      .then(([healthRes, setsRes, cardsRes, decksRes]) => {
        setHealth(healthRes);
        setSets(setsRes);
        setCards(cardsRes);
        setPublicDecks(decksRes);
      })
      .catch(() => undefined);
  }, []);

  // Metagame competitivo sincronizado com o filtro de formato/season
  useEffect(() => {
    const seasonParam = selectedFormat === "ALL" ? "all" : selectedFormat;
    api.getMetagameStats({
      seasonId: seasonParam,
      setId: selectedSetId === ALL_VALUE ? undefined : selectedSetId,
      color: selectedColor || undefined,
      trait: selectedTrait || undefined,
      series: selectedSeries || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })
      .then(setMetagame)
      .catch(() => setMetagame(null));
  }, [selectedFormat, selectedSetId, selectedColor, selectedTrait, selectedSeries, startDate, endDate]);

  const relevantItems = (deck: any) =>
    (deck.items || []).filter(
      (item: any) =>
        item.card &&
        !NON_STATS_SECTIONS.includes(item.section) &&
        !isNonStatsCard(item.card),
    );

  const filteredCards = useMemo(
    () => (selectedSetId === ALL_VALUE ? cards : cards.filter((card) => card.setId === selectedSetId)),
    [cards, selectedSetId],
  );

  const statsCards = useMemo(
    () => filteredCards.filter((card) => !isNonStatsCard(card)),
    [filteredCards],
  );

  const filteredDecks = useMemo(
    () =>
      selectedSetId === ALL_VALUE
        ? publicDecks
        : publicDecks.filter((deck) => relevantItems(deck).some((item: any) => item.card.setId === selectedSetId)),
    [publicDecks, selectedSetId],
  );

  const totalEventsCount = metagame?.provenance?.totalTournaments ?? 0;

  const isFiltered =
    selectedFormat !== DEFAULT_FORMAT ||
    selectedSetId !== ALL_VALUE ||
    Boolean(selectedColor || selectedTrait || selectedSeries || startDate || endDate);

  const clearAllFilters = () => {
    setSelectedFormat(DEFAULT_FORMAT);
    setSelectedSetId(ALL_VALUE);
    setSelectedColor("");
    setSelectedTrait("");
    setSelectedSeries("");
    setStartDate("");
    setEndDate("");
  };

  // Gráficos de Acervo e Base Geral
  const setChart = useMemo(
    () =>
      sets
        .filter((set) => !isNonStatsSetCode(set.code))
        .map((set) => ({ name: set.code, value: set._count?.cards ?? 0 })),
    [sets],
  );

  const colorChart = useMemo(() => {
    const map = new Map<string, number>();
    statsCards.forEach((card) => {
      if (card.color) {
        map.set(card.color, (map.get(card.color) ?? 0) + 1);
      }
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [statsCards]);

  const typeChart = useMemo(() => {
    const map = new Map<string, number>();
    statsCards.forEach((card) => {
      if (card.cardType && !isNonStatsCardType(card.cardType)) {
        map.set(card.cardType, (map.get(card.cardType) ?? 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name: typeLabel(name), value }));
  }, [statsCards]);

  // Metagame Competitivo
  const cardPresence = useMemo(
    () => (metagame?.topCards || []).map((entry) => ({ name: entry.name, value: entry.appearances, color: entry.color })),
    [metagame],
  );
  const colorCombos = useMemo(
    () => (metagame?.colorCombos || []).map((entry) => ({ name: entry.combo, value: entry.decks })),
    [metagame],
  );
  const risingCards = metagame?.risingCards ?? [];
  const decliningCards = metagame?.decliningCards ?? [];


  return (
    <PublicShell breadcrumbs={[{ label: "Sistema VEDA", href: "/torneios" }, { label: "Estatísticas & Cartas" }]}>
      <div className="space-y-6">
        {/* Barra superior padronizada do Sistema VEDA */}
        <div className="panel-cut border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/80 p-2 sm:p-2.5">
          <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
            <Link
              href="/torneios"
              title="Eventos e súmulas na íntegra"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent"
            >
              <Trophy className="size-3.5 shrink-0" />
              <span>Torneios & Reports</span>
            </Link>
            <Link
              href="/arquetipos"
              title="Tier list e listas de cada deck"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent"
            >
              <Layers className="size-3.5 shrink-0" />
              <span>Arquétipos & Decks</span>
            </Link>
            <Link
              href="/metagame/regional"
              title="Recorte por estado, cidade e loja"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent"
            >
              <MapPin className="size-3.5 shrink-0" />
              <span>Metagame Regional</span>
            </Link>
            <Link
              href="/stats"
              title="Métricas de cartas, confrontos e tendências"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-primary/50 bg-primary/20 text-primary font-bold shadow-[0_0_10px_rgba(59,130,246,0.15)]"
            >
              <BarChart className="size-3.5 shrink-0" />
              <span>Estatísticas & Cartas</span>
            </Link>
          </nav>
        </div>
        {/* HERO TÁTICO VEDA */}
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-primary font-semibold font-mono">
                  Estatísticas do meta
                </p>
                <h2 className="mt-2 font-heading text-4xl sm:text-5xl uppercase tracking-wider dark:text-white light:text-slate-900">
                  Meta e estatísticas
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed dark:text-slate-300 light:text-slate-600">
                  Processamento em tempo real do metagame competitivo oficial: presença de arquétipos, núcleos de cartas
                  (Core, Flex e Tech), telemetria regional brasileira e sinergias de Mobile Suits.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent font-mono text-xs">
                  Dados atualizados
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="rounded-none border-primary/40 bg-primary/10 text-xs font-mono uppercase text-primary hover:bg-primary/20"
                >
                  <Link href="/torneios">
                    <Trophy className="size-3 mr-1" />
                    Torneios Oficiais
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="rounded-none border-primary/40 bg-primary/10 text-xs font-mono uppercase text-primary hover:bg-primary/20"
                >
                  <Link href="/arquetipos">
                    <Layers className="size-3 mr-1" />
                    Arquétipos
                  </Link>
                </Button>
              </div>
            </div>

            {/* BARRA UNIFICADA DE FILTRO DE METAGAME */}
            <div className="mt-6 border-t dark:border-white/10 light:border-slate-300/80 pt-5 space-y-3 font-mono">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs uppercase tracking-[0.2em] dark:text-slate-400 light:text-slate-600 font-bold">Temporada:</span>

                {/* Seletor de Temporada / Formato (lista em src/lib/seasons.ts) */}
                <select
                  value={selectedFormat}
                  onChange={(event) => setSelectedFormat(event.target.value)}
                  className="field-shell h-9 rounded-none border border-primary/40 dark:bg-slate-950/90 light:bg-white px-3 text-sm text-primary font-bold shadow-[0_0_10px_rgba(20,184,166,0.2)]"
                >
                  {seasonsNewestFirst().map((s) => (
                    <option key={s.code} value={s.code}>
                      Formato {s.code}
                      {s.code === LATEST_SEASON ? " (Temporada Atual)" : ""}
                    </option>
                  ))}
                  <option value="ALL">Todas as Temporadas (Histórico Geral)</option>
                </select>

                <select
                  value={selectedSetId}
                  onChange={(event) => setSelectedSetId(event.target.value)}
                  className="field-shell h-9 rounded-none border dark:border-white/15 dark:bg-slate-950/70 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 px-3 text-sm"
                >
                  <option value={ALL_VALUE}>Todas as coleções cadastradas</option>
                  {sets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.code} — {set.namePt || set.nameEn}
                    </option>
                  ))}
                </select>

                {isFiltered && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="flex items-center gap-1 text-xs uppercase tracking-[0.16em] text-primary hover:underline ml-auto"
                  >
                    <RotateCcw className="size-3" />
                    Restaurar Padrão ({DEFAULT_FORMAT})
                  </button>
                )}
              </div>

              {/* Filtros Secundários de Cor e Período */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] dark:text-slate-400 light:text-slate-600">Filtrar Cor:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedColor("")}
                    className={`px-2 py-1 text-[11px] font-mono uppercase border transition-colors ${
                      !selectedColor
                        ? "border-primary bg-primary/20 text-primary font-bold"
                        : "dark:border-white/10 dark:text-slate-400 dark:hover:text-white light:border-slate-300 light:text-slate-600 light:hover:text-slate-900"
                    }`}
                  >
                    Todas
                  </button>
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor((current) => (current === color ? "" : color))}
                      title={GAME_COLOR_LABEL_PT[color]}
                      className={`size-6 rounded-full border-2 transition-transform ${
                        selectedColor === color ? "scale-110 border-white shadow-md" : "border-white/20 hover:border-white/50"
                      }`}
                      style={{ backgroundColor: GAME_COLOR_HEX[color] }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] dark:text-slate-400 light:text-slate-600">
                  <span>Período:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="field-shell h-8 rounded-none border dark:border-white/15 dark:bg-slate-950/70 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 px-2 text-xs"
                  />
                  <span>até</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="field-shell h-8 rounded-none border dark:border-white/15 dark:bg-slate-950/70 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 px-2 text-xs"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NAVEGAÇÃO EM 4 ABAS TÁTICAS */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto border-b dark:border-white/10 light:border-slate-300 bg-transparent p-0 gap-2 h-auto rounded-none pb-px">
            <TabsTrigger
              value="competitive"
              className="panel-cut rounded-none border border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/20 dark:data-[state=active]:text-white light:data-[state=active]:text-primary data-[state=active]:font-bold dark:text-slate-400 dark:hover:text-white light:text-slate-600 light:hover:text-slate-900 px-4 py-2.5 text-xs uppercase font-mono tracking-wider transition-all flex items-center gap-2"
            >
              <Swords className="size-4 text-accent" />
              1. Metagame Competitivo ({normalizeSeasonCode(selectedFormat) ?? selectedFormat})
            </TabsTrigger>

            <TabsTrigger
              value="regional"
              className="panel-cut rounded-none border border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/20 dark:data-[state=active]:text-white light:data-[state=active]:text-primary data-[state=active]:font-bold dark:text-slate-400 dark:hover:text-white light:text-slate-600 light:hover:text-slate-900 px-4 py-2.5 text-xs uppercase font-mono tracking-wider transition-all flex items-center gap-2"
            >
              <MapPin className="size-4 text-primary" />
              2. Metagame Nacional (Brasil & Praças)
            </TabsTrigger>

            <TabsTrigger
              value="catalog"
              className="panel-cut rounded-none border border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/20 dark:data-[state=active]:text-white light:data-[state=active]:text-primary data-[state=active]:font-bold dark:text-slate-400 dark:hover:text-white light:text-slate-600 light:hover:text-slate-900 px-4 py-2.5 text-xs uppercase font-mono tracking-wider transition-all flex items-center gap-2"
            >
              <Database className="size-4 text-emerald-400" />
              3. Estatísticas gerais
            </TabsTrigger>

            <TabsTrigger
              value="telemetry"
              className="panel-cut rounded-none border border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/20 dark:data-[state=active]:text-white light:data-[state=active]:text-primary data-[state=active]:font-bold dark:text-slate-400 dark:hover:text-white light:text-slate-600 light:hover:text-slate-900 px-4 py-2.5 text-xs uppercase font-mono tracking-wider transition-all flex items-center gap-2"
            >
              <Cpu className="size-4 text-sky-400" />
              4. Confrontos e análise avançada
            </TabsTrigger>
          </TabsList>

          {/* ========================================================================= */}
          {/* ABA 1: METAGAME COMPETITIVO (TEMPORADA SELECIONADA)            */}
          {/* ========================================================================= */}
          <TabsContent value="competitive" className="space-y-6 focus-visible:outline-none">
            {/* Painel de Núcleos de Arquétipo com seletor sincronizado */}
            <FormatArchetypeCoresPanel
              selectedFormat={selectedFormat}
              onFormatChange={setSelectedFormat}
            />

            {/* Power Rankings Semanal */}
            <PowerRankingsPanel
              seasonId={selectedFormat === "ALL" ? "all" : selectedFormat}
              setId={selectedSetId === ALL_VALUE ? undefined : selectedSetId}
              onExploreArchetype={handleExploreArchetype}
            />
          </TabsContent>

          {/* ========================================================================= */}
          {/* ABA 2: METAGAME NACIONAL (BRASIL & PRAÇAS REGIONAIS)                      */}
          {/* ========================================================================= */}
          <TabsContent value="regional" className="space-y-6 focus-visible:outline-none">
            <RegionalMetaPanel
              seasonId={selectedFormat === "ALL" ? "all" : selectedFormat}
              setId={selectedSetId === ALL_VALUE ? undefined : selectedSetId}
            />
          </TabsContent>

          {/* ========================================================================= */}
          {/* ABA 3: ESTATÍSTICAS GERAIS & ACERVO DO BANCO                              */}
          {/* ========================================================================= */}
          <TabsContent value="catalog" className="space-y-6 focus-visible:outline-none">
            {/* Grade de Métricas do Acervo */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6 font-mono">
              {[
                ["Usuários", String(health?.userCount ?? 0)],
                ["Cartas no Banco", String(isFiltered ? filteredCards.length : (health?.cardCount ?? 0))],
                ["Decks da Comunidade", String(filteredDecks.length)],
                ["Decks de Metagame", String(metagame?.totalDecks ?? 0)],
                ["Campeonatos", String(totalEventsCount)],
                ["Coleções", String(sets.length)],
              ].map(([label, value]) => (
                <Card key={label} className="panel-cut rounded-none surface-panel">
                  <CardContent className="p-5">
                    <p className="text-xs uppercase tracking-[0.24em] dark:text-slate-400 light:text-slate-600">{label}</p>
                    <p className="mt-4 font-heading text-4xl leading-none dark:text-white light:text-slate-900">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Gráficos de Cobertura por Expansão e Cores */}
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.24em] dark:text-slate-400 light:text-slate-600 font-mono">Cobertura por coleção</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase dark:text-white light:text-slate-900">Cartas cadastradas por expansão</h3>
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
                  <p className="text-xs uppercase tracking-[0.24em] dark:text-slate-400 light:text-slate-600 font-mono">Distribuição por Cor</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase dark:text-white light:text-slate-900">Proporção de cartas por cor</h3>
                  <div className="mt-6 h-[320px]">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                      <BarChart data={colorChart}>
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

            {/* Gráficos de Tipos e Séries */}
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-[0.24em] dark:text-slate-400 light:text-slate-600 font-mono">Proporção de Tipos</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase dark:text-white light:text-slate-900">Unit, Pilot, Command e Base</h3>
                  <div className="mt-6 h-[320px]">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                      <BarChart data={typeChart}>
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
                  <p className="text-xs uppercase tracking-[0.24em] dark:text-slate-400 light:text-slate-600 font-mono">Combinação de Cores</p>
                  <h3 className="mt-2 font-heading text-3xl uppercase dark:text-white light:text-slate-900">Cores mais jogadas juntas</h3>
                  <div className="mt-6 h-[320px]">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                      <BarChart data={colorCombos}>
                        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" fill="var(--color-value)" radius={0} />
                      </BarChart>
                    </ChartContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cartas Mais Presentes no Metagame Geral */}
            <Card className="panel-cut rounded-none surface-panel">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-primary font-mono">Presença no Metagame</p>
                <h3 className="mt-2 font-heading text-3xl uppercase dark:text-white light:text-slate-900">Cartas Mais Utilizadas</h3>
                {cardPresence.length ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm font-mono">
                      <thead>
                        <tr className="border-b dark:border-white/10 light:border-slate-200 text-xs uppercase dark:text-slate-400 light:text-slate-600">
                          <th className="py-2 pr-3">Carta</th>
                          <th className="py-2 pr-3">Cor</th>
                          <th className="py-2 pr-3">Aparições</th>
                          <th className="py-2 pr-3">Presença</th>
                          <th className="py-2 pr-3">Média Cópias</th>
                          <th className="py-2 pr-3">Win Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metagame?.topCards?.slice(0, 10).map((card) => (
                          <tr key={card.cardModelId} className="border-b dark:border-white/5 light:border-slate-100 dark:text-slate-300 light:text-slate-700">
                            <td className="py-2 pr-3 dark:text-white light:text-slate-900 font-medium">
                              <HoverCard openDelay={150}>
                                <HoverCardTrigger asChild>
                                  <Link
                                    href={card.code ? `/cards/${card.code}` : "#"}
                                    className="hover:text-primary hover:underline transition-colors cursor-pointer"
                                  >
                                    {card.name}
                                  </Link>
                                </HoverCardTrigger>
                                <HoverCardContent side="right" className="w-56 p-2 bg-slate-950 border border-primary/30 panel-cut">
                                  {card.imageUrl ? (
                                    <img
                                      src={card.imageUrl}
                                      alt={card.name}
                                      className="w-full h-auto rounded border border-white/10 object-contain"
                                    />
                                  ) : (
                                    <p className="text-xs text-slate-400 font-mono text-center py-4">Sem imagem regular</p>
                                  )}
                                  <div className="mt-2 text-center font-mono text-[11px] text-primary font-bold">
                                    {card.code || "Print Regular Oficial"}
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            </td>
                            <td className="py-2 pr-3">
                              {card.color ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <span
                                    className="size-2.5 rounded-full"
                                    style={{ backgroundColor: GAME_COLOR_HEX[card.color] || FALLBACK_SLICE_COLOR }}
                                  />
                                  {GAME_COLOR_LABEL_PT[card.color] || card.color}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-2 pr-3">{card.appearances}</td>
                            <td className="py-2 pr-3">{card.presenceRate != null ? `${card.presenceRate}%` : "—"}</td>
                            <td className="py-2 pr-3">{card.avgCopies ?? "—"}</td>
                            <td className="py-2 pr-3 text-primary">{card.winRate != null ? `${card.winRate}%` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500 font-mono">
                    Carregando dados de presença de cartas...
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Cartas em Alta & Cartas em Queda */}
            <div className="grid gap-6 xl:grid-cols-2 font-mono">
              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.24em] dark:text-emerald-400 light:text-emerald-600">
                    <TrendingUp className="size-3.5" /> Tendência de Alta
                  </p>
                  <h3 className="mt-2 font-heading text-3xl uppercase dark:text-white light:text-slate-900">Cartas em Alta</h3>
                  {risingCards.length ? (
                    <div className="mt-4 space-y-2">
                      {risingCards.slice(0, 5).map((card) => (
                        <div
                          key={card.cardModelId}
                          className="flex items-center justify-between gap-3 panel-cut border dark:border-emerald-500/20 dark:bg-emerald-950/10 light:border-emerald-300 light:bg-emerald-50 px-3 py-2 text-xs"
                        >
                          <HoverCard openDelay={150}>
                            <HoverCardTrigger asChild>
                              <Link
                                href={card.code ? `/cards/${card.code}` : "#"}
                                className="dark:text-white light:text-slate-900 font-medium hover:text-emerald-400 hover:underline transition-colors truncate max-w-[220px]"
                              >
                                {card.name}
                              </Link>
                            </HoverCardTrigger>
                            <HoverCardContent side="top" className="w-56 p-2 bg-slate-950 border border-emerald-500/40 panel-cut">
                              {card.imageUrl ? (
                                <img
                                  src={card.imageUrl}
                                  alt={card.name}
                                  className="w-full h-auto rounded border border-white/10 object-contain"
                                />
                              ) : (
                                <p className="text-xs text-slate-400 font-mono text-center py-4">Sem imagem regular</p>
                              )}
                              <div className="mt-2 text-center font-mono text-[11px] text-emerald-400 font-bold">
                                {card.code || "Print Regular Oficial"}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                          <span className="whitespace-nowrap font-semibold dark:text-emerald-400 light:text-emerald-700">
                            +{card.trendDelta}pp{" "}
                            <span className="dark:text-slate-500 light:text-slate-500 font-normal">
                              ({card.priorPresenceRate}% → {card.recentPresenceRate}%)
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-slate-500">
                      Nenhuma carta com tendência acentuada de alta calculada para este recorte.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none surface-panel">
                <CardContent className="p-6">
                  <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.24em] dark:text-red-400 light:text-red-600">
                    <TrendingDown className="size-3.5" /> Tendência de Queda
                  </p>
                  <h3 className="mt-2 font-heading text-3xl uppercase dark:text-white light:text-slate-900">Cartas em Queda</h3>
                  {decliningCards.length ? (
                    <div className="mt-4 space-y-2">
                      {decliningCards.slice(0, 5).map((card) => (
                        <div
                          key={card.cardModelId}
                          className="flex items-center justify-between gap-3 panel-cut border dark:border-red-500/20 dark:bg-red-950/10 light:border-red-300 light:bg-red-50 px-3 py-2 text-xs"
                        >
                          <HoverCard openDelay={150}>
                            <HoverCardTrigger asChild>
                              <Link
                                href={card.code ? `/cards/${card.code}` : "#"}
                                className="dark:text-white light:text-slate-900 font-medium hover:text-red-400 hover:underline transition-colors truncate max-w-[220px]"
                              >
                                {card.name}
                              </Link>
                            </HoverCardTrigger>
                            <HoverCardContent side="top" className="w-56 p-2 bg-slate-950 border border-red-500/40 panel-cut">
                              {card.imageUrl ? (
                                <img
                                  src={card.imageUrl}
                                  alt={card.name}
                                  className="w-full h-auto rounded border border-white/10 object-contain"
                                />
                              ) : (
                                <p className="text-xs text-slate-400 font-mono text-center py-4">Sem imagem regular</p>
                              )}
                              <div className="mt-2 text-center font-mono text-[11px] text-red-400 font-bold">
                                {card.code || "Print Regular Oficial"}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                          <span className="whitespace-nowrap font-semibold dark:text-red-400 light:text-red-700">
                            {card.trendDelta}pp{" "}
                            <span className="dark:text-slate-500 light:text-slate-500 font-normal">
                              ({card.priorPresenceRate}% → {card.recentPresenceRate}%)
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-slate-500">
                      Nenhuma carta com tendência acentuada de queda calculada para este recorte.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ========================================================================= */}
          {/* ABA 4: TELEMETRIA AVANÇADA & CONFRONTOS (SISTEMA VEDA)                     */}
          {/* ========================================================================= */}
          <TabsContent value="telemetry" className="space-y-6 focus-visible:outline-none">
            {/* Banner de Clareza de Fontes e Dados */}
            <div className="panel-cut border border-primary/30 hero-surface p-4 sm:p-5 font-mono text-xs">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-primary uppercase tracking-wider">Origem dos Dados Táticos VEDA:</span>
                  <Badge className="rounded-none border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[10px] uppercase">
                    Torneios Oficiais via API
                  </Badge>
                  <span className="text-slate-400">vs</span>
                  <Badge className="rounded-none border border-sky-500/40 bg-sky-500/10 text-sky-400 text-[10px] uppercase">
                    Torneios na Plataforma
                  </Badge>
                </div>
                <p className="text-slate-300 leading-relaxed font-sans text-xs">
                  A <strong>Evolução Semanal</strong> e a <strong>Inteligência de Listas (ATMI)</strong> processam os torneios competitivos oficiais sincronizados (DigiLab / Egman Events), que registram as colocações finais e listas dos jogadores. Já a <strong>Matriz de Confrontos Diretos (Head-to-Head)</strong> calcula os embates específicos entre arquétipos e dados de iniciativa a partir das rodadas Swiss disputadas nos torneios sediados dentro do AnaheimHub.
                </p>
              </div>
            </div>

            {/* Matriz de Confrontos Diretos */}
            <MatchupMatrixPanel seasonId={selectedFormat === "ALL" ? "all" : selectedFormat} />

            {/* Evolução Temporal Semanal */}
            <WeeklyTrendsPanel
              seasonId={selectedFormat === "ALL" ? "all" : selectedFormat}
            />

            {/* Inteligência Algorítmica VEDA / ATMI */}
            <MetaAnalyticsPanel focusKey={atmiFocusKey} />
          </TabsContent>
        </Tabs>

        {/* Bloco de Patrocínio / Publicidade com Reserva Rígida de Espaço (Zero CLS) */}
        <AdSlot format="leaderboard" className="mt-8 mb-4" />
      </div>
    </PublicShell>
  );
}
