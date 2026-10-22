import { useEffect, useState } from "react";
import {
  Layers,
  Target,
  Zap,
  SlidersHorizontal,
  AlertTriangle,
  Flame,
  ListOrdered,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  api,
  type FormatOverviewItem,
  type FormatMetaResponse,
  type FormatArchetypeSummary,
  type FormatCardDetail,
  type ArchetypeEvolution,
} from "@/lib/api";
import { COLOR_OPTIONS, GAME_COLOR_HEX, GAME_COLOR_LABEL_PT, normalizeDeckColors, resolveGameColorHex, resolveGameColorLabelPt } from "@/lib/gundam-catalog";
import { DataSourceNote } from "@/components/stats/DataSourceNote";
import gundamCardBack from "@/assets/gundam-card-back.png";

const FALLBACK_COLOR = "#94a3b8";

export interface FormatArchetypeCoresPanelProps {
  selectedFormat?: string;
  onFormatChange?: (format: string) => void;
  hideHeader?: boolean;
}

export function FormatArchetypeCoresPanel({
  selectedFormat: controlledFormat,
  onFormatChange,
  hideHeader = false,
}: FormatArchetypeCoresPanelProps = {}) {
  const [formats, setFormats] = useState<FormatOverviewItem[]>([]);
  const [internalFormat, setInternalFormat] = useState<string>("GD05_COMBINED");
  const selectedFormat = controlledFormat || internalFormat;

  const [formatMeta, setFormatMeta] = useState<FormatMetaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [viewMode, setViewMode] = useState<"archetypes" | "evolution">("archetypes");
  const [evolution, setEvolution] = useState<ArchetypeEvolution[]>([]);
  const [loadingEvolution, setLoadingEvolution] = useState(false);
  const [showAllArchetypes, setShowAllArchetypes] = useState(false);

  // Arquétipo selecionado para inspeção profunda do núcleo (Core/Flex/Tech)
  const [inspectingArchetype, setInspectingArchetype] = useState<FormatArchetypeSummary | null>(null);
  const [medianModalArchetype, setMedianModalArchetype] = useState<FormatArchetypeSummary | null>(null);

  const handleSelectFormat = (format: string) => {
    setInternalFormat(format);
    setShowAllArchetypes(false);
    onFormatChange?.(format);
  };

  useEffect(() => {
    api.getFormatList()
      .then((res) => {
        setFormats(res);
        if (res.length > 0 && !controlledFormat && !res.some((f) => f.format === internalFormat)) {
          setInternalFormat(res[0].format);
        }
      })
      .catch(() => setFormats([]));
  }, [controlledFormat]);

  useEffect(() => {
    if (!selectedFormat) return;
    setLoading(true);
    api.getFormatMeta(selectedFormat, { color: selectedColor || undefined })
      .then(setFormatMeta)
      .catch(() => setFormatMeta(null))
      .finally(() => setLoading(false));
  }, [selectedFormat, selectedColor]);

  useEffect(() => {
    if (viewMode === "evolution" && evolution.length === 0) {
      setLoadingEvolution(true);
      api.getFormatEvolution()
        .then(setEvolution)
        .catch(() => setEvolution([]))
        .finally(() => setLoadingEvolution(false));
    }
  }, [viewMode, evolution.length]);

  return (
    <Card className="panel-cut rounded-none dark:border-primary/40 dark:bg-gradient-to-r dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 light:border-slate-300 light:bg-gradient-to-r light:from-white light:via-slate-50 light:to-white light:shadow-sm">
      <CardContent className="p-6">
        {/* Header do Módulo */}
        {!hideHeader && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-accent" />
                <p className="text-xs uppercase tracking-[0.26em] text-primary font-mono font-semibold">
                  Formato & Temporada · Inteligência de Núcleos
                </p>
                <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary text-[10px] font-mono uppercase">
                  GD01 a GD05
                </Badge>
              </div>
              <h2 className="mt-2 font-heading text-3xl sm:text-4xl uppercase tracking-wider dark:text-white light:text-slate-900">
                Metagame por Formato & Núcleos de Arquétipo
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed dark:text-slate-300 light:text-slate-600">
                Análise profunda de listas reais de torneios competitivos oficiais. Explore presença, conversão em Top Cut,
                taxa de vitórias e a composição exata do núcleo (cartas indispensáveis, de flexibilidade e opções tech).
              </p>
            </div>

            {/* Seletor de Modo: Arquétipos vs Evolução */}
            <div className="flex items-center border dark:border-white/15 dark:bg-slate-950 light:border-slate-300 light:bg-slate-100 p-1 panel-cut">
              <Button
                size="sm"
                variant={viewMode === "archetypes" ? "default" : "ghost"}
                onClick={() => setViewMode("archetypes")}
                className="h-8 rounded-none text-xs font-mono uppercase tracking-wider dark:text-slate-300 dark:hover:text-white light:text-slate-700 light:hover:text-slate-900"
              >
                <ListOrdered className="mr-1.5 size-3.5" />
                Por Formato
              </Button>
              <Button
                size="sm"
                variant={viewMode === "evolution" ? "default" : "ghost"}
                onClick={() => setViewMode("evolution")}
                className="h-8 rounded-none text-xs font-mono uppercase tracking-wider dark:text-slate-300 dark:hover:text-white light:text-slate-700 light:hover:text-slate-900"
              >
                <TrendingUp className="mr-1.5 size-3.5" />
                Evolução Temporal
              </Button>
            </div>
          </div>
        )}

        {/* Barra de Abas dos Formatos (GD01..GD05) */}
        {viewMode === "archetypes" && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b dark:border-white/10 light:border-slate-300 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              {formats.map((f) => {
                const isSelected = f.format === selectedFormat;
                const formatLabel =
                  f.format === "GD05_COMBINED"
                    ? "GD05 / GD05.5"
                    : f.format === "ALL"
                    ? "Todas as Seasons"
                    : f.format;
                const badgeLabel =
                  f.format === "GD05_COMBINED"
                    ? "Atual"
                    : f.format === "ALL"
                    ? "Histórico"
                    : `${f.totalLists} listas`;

                return (
                  <button
                    key={f.format}
                    type="button"
                    onClick={() => handleSelectFormat(f.format)}
                    className={`panel-cut px-3.5 py-2 text-left transition-all border font-mono ${
                      isSelected
                        ? "border-primary bg-primary/20 dark:text-white light:text-slate-950 font-bold shadow-[0_0_12px_rgba(20,184,166,0.3)]"
                        : "dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-400 dark:hover:border-white/20 dark:hover:text-white light:border-slate-300 light:bg-slate-50 light:text-slate-600 light:hover:border-slate-400 light:hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-heading tracking-wider uppercase">{formatLabel}</span>
                      <span
                        className={`rounded-none px-1.5 py-0.5 text-[10px] ${
                          f.format === "GD05_COMBINED"
                            ? "bg-primary/20 text-primary font-bold border border-primary/30"
                            : "dark:bg-white/10 dark:text-slate-300 light:bg-slate-200 light:text-slate-700"
                        }`}
                      >
                        {badgeLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Filtro por Cor do Arquétipo */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs uppercase font-mono tracking-wider dark:text-slate-400 light:text-slate-600 mr-1">Cor:</span>
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
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={GAME_COLOR_LABEL_PT[c] || c}
                  onClick={() => setSelectedColor((cur) => (cur === c.toLowerCase() ? "" : c.toLowerCase()))}
                  className={`size-6 rounded-full border-2 transition-transform ${
                    selectedColor === c.toLowerCase() ? "scale-110 border-white shadow-md" : "border-white/20 opacity-70 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: GAME_COLOR_HEX[c] || FALLBACK_COLOR }}
                />
              ))}
            </div>
          </div>
        )}

        {/* NOTA DE PROVENIÊNCIA TRANSPARENTE */}
        {viewMode === "archetypes" && formatMeta?.provenance && (
          <DataSourceNote
            provenance={formatMeta.provenance}
            labelPrefix={`Formato ${formatMeta.format === "GD05_COMBINED" || formatMeta.format === "GD05" ? "GD05" : formatMeta.format} consolidado a partir de`}
            weightNote="Regionais e torneios de grande porte possuem ponderação superior no cálculo de conversão e vitórias."
            className="mt-4"
          />
        )}

        {/* MODO 1: ARQUÉTIPOS DO FORMATO */}
        {viewMode === "archetypes" && (
          <div className="mt-6 space-y-4">
            {loading ? (
              <p className="py-8 text-center text-xs font-mono dark:text-slate-400 light:text-slate-600 animate-pulse">
                CARREGANDO ESTATÍSTICAS E NÚCLEOS DO FORMATO {selectedFormat === "GD05_COMBINED" ? "GD05 / GD05.5" : selectedFormat}...
              </p>
            ) : !formatMeta?.archetypes.length ? (
              <p className="py-8 text-center text-xs font-mono dark:text-slate-500 light:text-slate-500">
                Nenhum arquétipo registrado com os filtros aplicados neste formato.
              </p>
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  {(showAllArchetypes ? formatMeta.archetypes : formatMeta.archetypes.slice(0, 6)).map((arch, idx) => {
                  const isSmall = arch.isSmallSample;
                  return (
                    <div
                      key={arch.id || idx}
                      className="panel-cut border dark:border-white/10 dark:bg-slate-950/70 light:border-slate-300 light:bg-white light:shadow-sm p-4 transition-all hover:border-primary/40 flex flex-col justify-between"
                    >
                      <div>
                        {/* Topo do Card: Ranking, Cores e Amostra */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex size-7 items-center justify-center panel-cut border border-primary/40 bg-primary/10 font-heading text-sm text-primary">
                              #{idx + 1}
                            </span>
                            <div className="flex items-center gap-1">
                              {normalizeDeckColors(arch.colors).map((c) => (
                                <span
                                  key={c}
                                  title={resolveGameColorLabelPt(c)}
                                  className="size-2.5 rounded-full border border-white/30 dark:border-white/25 light:border-slate-400"
                                  style={{ backgroundColor: resolveGameColorHex(c) }}
                                />
                              ))}
                            </div>
                            <h3 className="font-heading text-xl uppercase tracking-wide dark:text-white light:text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                              {arch.name}
                            </h3>
                          </div>

                          {/* Badge de Confiabilidade da Amostra */}
                          {isSmall ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className="rounded-none border dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 light:border-amber-300 light:bg-amber-50 light:text-amber-800 text-[10px] font-mono uppercase flex items-center gap-1">
                                  <AlertTriangle className="size-3 text-amber-500" />
                                  Poucos dados ({arch.lists} listas)
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="dark:bg-slate-900 dark:border-white/20 dark:text-slate-200 light:bg-white light:border-slate-300 light:text-slate-800 text-xs">
                                {arch.sampleWarning || "Amostra pequena — estatísticas com margem de flutuação."}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Badge className="rounded-none border dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300 light:border-emerald-300 light:bg-emerald-50 light:text-emerald-800 text-[10px] font-mono uppercase">
                              {arch.lists} listas analisadas
                            </Badge>
                          )}
                        </div>

                        {/* Grade com as 3 Métricas Centrais */}
                        <div className="mt-4 grid grid-cols-3 gap-2 border-y dark:border-white/10 light:border-slate-200 py-3 text-center font-mono">
                          <div className="p-1">
                            <p className="text-[10px] uppercase tracking-wider dark:text-slate-400 light:text-slate-600">Meta Share</p>
                            <p className="mt-1 font-heading text-xl text-primary">
                              {(arch.share * 100).toFixed(1)}%
                            </p>
                            <div className="w-full h-1 dark:bg-white/10 light:bg-slate-200 mt-1.5">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${Math.min(100, arch.share * 200)}%` }}
                              />
                            </div>
                          </div>

                          <div className="p-1 border-x dark:border-white/10 light:border-slate-200">
                            <p className="text-[10px] uppercase tracking-wider dark:text-slate-400 light:text-slate-600">Top Cut (Top 8)</p>
                            <p className="mt-1 font-heading text-xl text-sky-400">
                              {(arch.top8Share * 100).toFixed(1)}%
                            </p>
                            <div className="w-full h-1 dark:bg-white/10 light:bg-slate-200 mt-1.5">
                              <div
                                className="h-full bg-sky-400"
                                style={{ width: `${Math.min(100, arch.top8Share * 200)}%` }}
                              />
                            </div>
                          </div>

                          <div className="p-1">
                            <p className="text-[10px] uppercase tracking-wider dark:text-slate-400 light:text-slate-600">Fatia de Vitórias</p>
                            <p className="mt-1 font-heading text-xl text-amber-400">
                              {(arch.winShare * 100).toFixed(1)}%
                            </p>
                            <div className="w-full h-1 dark:bg-white/10 light:bg-slate-200 mt-1.5">
                              <div
                                className="h-full bg-amber-400"
                                style={{ width: `${Math.min(100, arch.winShare * 200)}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Prévia do Núcleo: Cartas Core mais relevantes */}
                        <div className="mt-3">
                          <p className="text-[10px] font-mono uppercase tracking-[0.18em] dark:text-slate-400 light:text-slate-600 mb-1.5 flex items-center justify-between">
                            <span>Estrutura do Arquétipo ({arch.cards.core.length} Core · {arch.cards.flex.length} Flex · {arch.cards.tech.length} Tech)</span>
                            <span className="text-accent font-semibold">{arch.points.toFixed(2)} pts</span>
                          </p>

                          <div className="flex flex-wrap gap-1.5">
                            {arch.cards.core.slice(0, 5).map((c) => (
                              <span
                                key={c.code}
                                className="inline-flex items-center gap-1 rounded-none border dark:border-emerald-500/30 dark:bg-emerald-950/20 dark:text-emerald-300 light:border-emerald-400/50 light:bg-emerald-50 light:text-emerald-800 px-2 py-0.5 text-[11px] font-mono"
                              >
                                <strong>{c.modeCopies}x</strong> {c.namePt || c.name}
                                <span className="opacity-60 text-[10px]">({Math.round(c.inclusionRate * 100)}%)</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Ações: Inspecionar Núcleo & Ver Lista Mediana */}
                      <div className="mt-4 pt-3 border-t dark:border-white/10 light:border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInspectingArchetype(arch)}
                          className="h-8 rounded-none border-primary/40 bg-primary/10 text-xs font-mono uppercase tracking-wider text-primary hover:bg-primary/20 hover:text-white"
                        >
                          <Target className="mr-1.5 size-3.5" />
                          Explorar Núcleo Completo
                        </Button>

                        {Object.keys(arch.medianDecklist).length > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setMedianModalArchetype(arch)}
                            className="h-8 rounded-none text-xs font-mono uppercase tracking-wider dark:text-slate-400 dark:hover:text-white light:text-slate-600 light:hover:text-slate-900"
                          >
                            Lista Mediana Consolidada
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

                {/* Botão de Expansão de Arquétipos */}
                {formatMeta.archetypes.length > 6 && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowAllArchetypes(!showAllArchetypes)}
                      className="panel-cut border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-mono uppercase tracking-wider h-9"
                    >
                      {showAllArchetypes ? (
                        <>Recolher arquétipos (mostrando todos os {formatMeta.archetypes.length})</>
                      ) : (
                        <>Ver todos os {formatMeta.archetypes.length} arquétipos ({formatMeta.archetypes.length - 6} restantes)</>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* MODO 2: EVOLUÇÃO TEMPORAL ENTRE FORMATOS */}
        {viewMode === "evolution" && (
          <div className="mt-6 space-y-6">
            <div className="rounded-none border dark:border-white/10 dark:bg-slate-950/60 light:border-slate-300 light:bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] font-mono text-primary flex items-center gap-1.5">
                <TrendingUp className="size-4 text-accent" />
                Trajetória de Relevância por Formato (GD01 a GD05)
              </p>
              <h3 className="mt-1 font-heading text-2xl uppercase dark:text-white light:text-slate-900">
                Como os Arquétipos Evoluíram ao Longo das Coleções
              </h3>
              <p className="mt-1 text-xs dark:text-slate-400 light:text-slate-600">
                Acompanhe o ganho e perda de fatia de metagame entre cada formato com a chegada de novos lançamentos.
              </p>
            </div>

            {loadingEvolution ? (
              <p className="py-8 text-center text-xs font-mono dark:text-slate-400 light:text-slate-600 animate-pulse">
                CONSOLIDANDO SÉRIE TEMPORAL...
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {evolution.map((arch) => (
                  <div key={arch.name} className="panel-cut border dark:border-white/10 dark:bg-slate-950/70 light:border-slate-300 light:bg-white light:shadow-sm p-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        {normalizeDeckColors(arch.colors).map((c) => (
                          <span
                            key={c}
                            title={resolveGameColorLabelPt(c)}
                            className="size-2.5 rounded-full border border-white/30 dark:border-white/25 light:border-slate-400"
                            style={{ backgroundColor: resolveGameColorHex(c) }}
                          />
                        ))}
                        <h4 className="font-heading text-lg uppercase dark:text-white light:text-slate-900 truncate max-w-[180px]">
                          {arch.name}
                        </h4>
                      </div>
                      <Badge variant="outline" className="dark:border-white/20 dark:text-slate-300 light:border-slate-300 light:text-slate-700 text-[10px] font-mono">
                        {arch.points.length} formatos
                      </Badge>
                    </div>

                    {/* Tabela de Evolução por Formato */}
                    <div className="space-y-1.5 font-mono text-xs">
                      {arch.points.map((pt) => (
                        <div
                          key={pt.format}
                          className="flex items-center justify-between border-b dark:border-white/5 dark:text-slate-300 light:border-slate-100 light:text-slate-700 pb-1"
                        >
                          <span className="font-bold text-primary">{pt.format}</span>
                          <span className="text-[11px] dark:text-slate-400 light:text-slate-600">
                            Meta: <strong className="dark:text-white light:text-slate-900">{(pt.share * 100).toFixed(1)}%</strong>
                          </span>
                          <span className="text-[11px] dark:text-slate-400 light:text-slate-600">
                            Top 8: <strong className="text-sky-400">{(pt.top8Share * 100).toFixed(1)}%</strong>
                          </span>
                          <span className="text-[11px] dark:text-slate-400 light:text-slate-600">
                            Win: <strong className="text-amber-400">{(pt.winShare * 100).toFixed(1)}%</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* DIALOG: EXPLORAÇÃO PROFUNDA DO NÚCLEO (Core, Flex, Tech) */}
      {inspectingArchetype && (
        <Dialog open={Boolean(inspectingArchetype)} onOpenChange={(open) => !open && setInspectingArchetype(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto rounded-none dark:border-white/15 dark:bg-slate-950 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 panel-cut p-6">
            <DialogHeader className="p-0 text-left">
              <div className="flex items-center gap-2 text-xs uppercase font-mono tracking-[0.2em] text-primary">
                <Target className="size-4 text-accent" />
                <span>Núcleo do Arquétipo · Formato {selectedFormat}</span>
              </div>
              <DialogTitle className="mt-1 font-heading text-3xl uppercase dark:text-white light:text-slate-900 flex items-center gap-3">
                <span>{inspectingArchetype.name}</span>
                <span className="flex items-center gap-1">
                  {normalizeDeckColors(inspectingArchetype.colors).map((c) => (
                    <span
                      key={c}
                      title={resolveGameColorLabelPt(c)}
                      className="size-3.5 rounded-full border border-white/30 dark:border-white/25 light:border-slate-400"
                      style={{ backgroundColor: resolveGameColorHex(c) }}
                    />
                  ))}
                </span>
              </DialogTitle>
              <p className="mt-1 text-xs dark:text-slate-400 light:text-slate-600">
                Classificação matemática de cada carta nas {inspectingArchetype.lists} listas reais de torneios do formato.
              </p>
            </DialogHeader>

            {/* Abas e Seções de Núcleo (Core, Flex, Tech) */}
            <div className="mt-6 space-y-6">
              {/* SEÇÃO 1: CARTAS NÚCLEO (CORE) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-emerald-500/30 pb-2">
                  <div className="flex items-center gap-2">
                    <Target className="size-4 text-emerald-400" />
                    <h4 className="font-heading text-lg uppercase dark:text-emerald-300 light:text-emerald-800">
                      Cartas Núcleo (Core) · Inclusão Inegociável
                    </h4>
                  </div>
                  <Badge className="rounded-none border border-emerald-500/40 bg-emerald-500/10 dark:text-emerald-300 light:text-emerald-800 text-[10px] font-mono uppercase">
                    {inspectingArchetype.cards.core.length} cartas
                  </Badge>
                </div>
                <p className="text-xs dark:text-slate-400 light:text-slate-600">
                  Presentes em praticamente 100% das listas com número de cópias unânime. Compõem a espinha dorsal do deck.
                </p>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {inspectingArchetype.cards.core.map((card) => (
                    <FormatCardTile key={card.code} card={card} badgeClass="dark:border-emerald-500/40 dark:bg-emerald-950/20 dark:text-emerald-300 light:border-emerald-400/50 light:bg-emerald-50 light:text-emerald-900" />
                  ))}
                </div>
              </div>

              {/* SEÇÃO 2: CARTAS DE AJUSTE (FLEX) */}
              {inspectingArchetype.cards.flex.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between gap-2 border-b border-amber-500/30 pb-2">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="size-4 text-amber-400" />
                      <h4 className="font-heading text-lg uppercase dark:text-amber-300 light:text-amber-800">
                        Slots de Ajuste Fino (Flex) · Adaptação Tática
                      </h4>
                    </div>
                    <Badge className="rounded-none border border-amber-500/40 bg-amber-500/10 dark:text-amber-300 light:text-amber-800 text-[10px] font-mono uppercase">
                      {inspectingArchetype.cards.flex.length} cartas
                    </Badge>
                  </div>
                  <p className="text-xs dark:text-slate-400 light:text-slate-600">
                    Presentes em 30% a 79% dos decks ou com variação no número de cópias dependendo da leitura do metagame.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {inspectingArchetype.cards.flex.map((card) => (
                      <FormatCardTile key={card.code} card={card} badgeClass="dark:border-amber-500/40 dark:bg-amber-950/20 dark:text-amber-300 light:border-amber-400/50 light:bg-amber-50 light:text-amber-900" />
                    ))}
                  </div>
                </div>
              )}

              {/* SEÇÃO 3: CARTAS TECH */}
              {inspectingArchetype.cards.tech.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between gap-2 border-b border-purple-500/30 pb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="size-4 text-purple-400" />
                      <h4 className="font-heading text-lg uppercase dark:text-purple-300 light:text-purple-800">
                        Ferramentas Específicas (Techs) · Contramedidas
                      </h4>
                    </div>
                    <Badge className="rounded-none border border-purple-500/40 bg-purple-500/10 dark:text-purple-300 light:text-purple-800 text-[10px] font-mono uppercase">
                      {inspectingArchetype.cards.tech.length} cartas
                    </Badge>
                  </div>
                  <p className="text-xs dark:text-slate-400 light:text-slate-600">
                    Opções surpresa ou respostas para matchups adversários específicos presentes em menos de 30% das listas.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {inspectingArchetype.cards.tech.map((card) => (
                      <FormatCardTile key={card.code} card={card} badgeClass="dark:border-purple-500/40 dark:bg-purple-950/20 dark:text-purple-300 light:border-purple-400/50 light:bg-purple-50 light:text-purple-900" />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t dark:border-white/10 light:border-slate-200 mt-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInspectingArchetype(null)}
                className="rounded-none dark:border-white/15 light:border-slate-300 text-xs uppercase"
              >
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* DIALOG: LISTA MEDIANA CONSOLIDADA DO ARQUÉTIPO */}
      {medianModalArchetype && (
        <Dialog open={Boolean(medianModalArchetype)} onOpenChange={(open) => !open && setMedianModalArchetype(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-none dark:border-white/15 dark:bg-slate-950 dark:text-white light:border-slate-300 light:bg-white light:text-slate-900 panel-cut p-6">
            <DialogHeader className="p-0 text-left">
              <div className="flex items-center gap-2 text-xs uppercase font-mono tracking-[0.2em] text-primary">
                <Flame className="size-4 text-accent" />
                <span>Lista Mediana do Torneio · 50 Cartas</span>
              </div>
              <DialogTitle className="mt-1 font-heading text-2xl uppercase dark:text-white light:text-slate-900">
                {medianModalArchetype.name} ({selectedFormat})
              </DialogTitle>
              <p className="mt-1 text-xs dark:text-slate-400 light:text-slate-600">
                Lista central representativa calculada a partir da mediana de cópias de cada carta usada no torneio.
              </p>
            </DialogHeader>

            <div className="mt-4 space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {Object.entries(medianModalArchetype.medianDecklist).map(([code, qty]) => (
                <div
                  key={code}
                  className="flex items-center justify-between border dark:border-white/10 dark:bg-slate-900/60 light:border-slate-200 light:bg-slate-50 p-2.5 panel-cut text-xs font-mono"
                >
                  <span className="font-bold text-primary">{qty}x</span>
                  <span className="dark:text-white light:text-slate-900 font-medium flex-1 px-3">{code}</span>
                  <Badge variant="outline" className="dark:border-white/15 light:border-slate-300 text-[10px]">
                    {qty === 4 ? "4 cópias (Max)" : `${qty} cópias`}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t dark:border-white/10 light:border-slate-200 mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMedianModalArchetype(null)}
                className="rounded-none dark:border-white/15 light:border-slate-300 text-xs uppercase"
              >
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function FormatCardTile({ card, badgeClass }: { card: FormatCardDetail; badgeClass: string }) {
  const [imgSrc, setImgSrc] = useState(card.imageMediumUrl || card.imageUrl || gundamCardBack);

  return (
    <div className={`panel-cut p-2.5 border transition-colors flex items-center gap-3 ${badgeClass}`}>
      <div className="relative w-12 h-16 shrink-0 dark:bg-slate-950 light:bg-slate-100 overflow-hidden border dark:border-white/15 light:border-slate-300 panel-cut">
        <img
          src={imgSrc}
          alt={card.name}
          onError={() => setImgSrc(gundamCardBack)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="min-w-0 flex-1 font-mono">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] uppercase font-bold dark:text-slate-400 light:text-slate-600">{card.code}</span>
          <span className="rounded-none border dark:border-white/20 dark:bg-black/40 dark:text-white light:border-slate-300 light:bg-slate-200 light:text-slate-900 px-1 py-0.2 text-[10px] font-bold">
            Moda: {card.modeCopies}x
          </span>
        </div>
        <h5 className="font-heading text-sm uppercase dark:text-white light:text-slate-900 truncate mt-0.5">
          {card.namePt || card.name}
        </h5>
        <div className="flex items-center justify-between text-[11px] dark:text-slate-300 light:text-slate-700 mt-1">
          <span>Inclusão: <strong>{Math.round(card.inclusionRate * 100)}%</strong></span>
          <span className="dark:text-slate-400 light:text-slate-500">μ: {card.avgCopies}</span>
        </div>
      </div>
    </div>
  );
}
