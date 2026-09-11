import { useEffect, useState, useMemo } from "react";
import { 
  Activity, 
  Cpu, 
  Layers, 
  ShieldAlert, 
  Sparkles, 
  Target, 
  Zap,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  Info
} from "lucide-react";
import { api, type ArchetypeSummary, type ArchetypeMetaBreakdown, type ClassifiedMetaCard, type MetaQuadrant } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GAME_COLOR_HEX } from "@/lib/gundam-catalog";
import gundamCardBack from "@/assets/gundam-card-back.png";

const QUADRANT_CONFIG: Record<MetaQuadrant, {
  title: string;
  badge: string;
  badgeClass: string;
  borderClass: string;
  desc: string;
  formula: string;
  icon: typeof Target;
}> = {
  CORE: {
    title: "Núcleo Indispensável (Core)",
    badge: "CORE · IDENTIDADE",
    badgeClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    borderClass: "border-emerald-500/30 hover:border-emerald-400/80 bg-emerald-950/20",
    desc: "Cartas com presença massiva e quantidade inegociável de cópias no arquétipo.",
    formula: "Inclusion Rate ≥ 60% e Slot Rigidity ≥ 70%",
    icon: Target,
  },
  STAPLE: {
    title: "Grampos Estruturais (Staples)",
    badge: "STAPLE · CONSISTÊNCIA",
    badgeClass: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    borderClass: "border-cyan-500/30 hover:border-cyan-400/80 bg-cyan-950/20",
    desc: "Presentes em quase todas as listas, porém com número de cópias variável conforme a pilotagem.",
    formula: "Inclusion Rate ≥ 60% e Slot Rigidity < 70%",
    icon: Sparkles,
  },
  FLEX: {
    title: "Slots de Ajuste Fino (Flex)",
    badge: "FLEX · ADAPTAÇÃO",
    badgeClass: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    borderClass: "border-amber-500/30 hover:border-amber-400/80 bg-amber-950/20",
    desc: "Opções de customização situacional presentes em 30% a 60% dos decks do arquétipo.",
    formula: "30% ≤ Inclusion Rate < 60%",
    icon: SlidersHorizontal,
  },
  TECH: {
    title: "Ferramentas Específicas (Techs)",
    badge: "TECH · CONTRAMEDIDA",
    badgeClass: "border-purple-500/40 bg-purple-500/10 text-purple-300",
    borderClass: "border-purple-500/30 hover:border-purple-400/80 bg-purple-950/20",
    desc: "Respostas cirúrgicas para matchups específicos ou escolhas de alto impacto de nicho.",
    formula: "Inclusion Rate < 30% com alta afinidade relativa",
    icon: Zap,
  },
};

export function MetaAnalyticsPanel() {
  const [archetypes, setArchetypes] = useState<ArchetypeSummary[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<ArchetypeMetaBreakdown | null>(null);
  const [loadingArchetypes, setLoadingArchetypes] = useState(true);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [activeQuadrantTab, setActiveQuadrantTab] = useState<"ALL" | MetaQuadrant>("ALL");

  useEffect(() => {
    setLoadingArchetypes(true);
    api.getMetaArchetypes()
      .then((data) => {
        setArchetypes(data);
        if (data.length > 0) {
          setSelectedKey(data[0].key);
        }
      })
      .catch((err) => console.error("Erro ao carregar arquétipos:", err))
      .finally(() => setLoadingArchetypes(false));
  }, []);

  useEffect(() => {
    if (!selectedKey) return;
    setLoadingBreakdown(true);
    api.getArchetypeBreakdown(selectedKey)
      .then(setBreakdown)
      .catch((err) => console.error("Erro ao carregar breakdown:", err))
      .finally(() => setLoadingBreakdown(false));
  }, [selectedKey]);

  const activeArchetype = useMemo(() => {
    return archetypes.find((a) => a.key === selectedKey) || null;
  }, [archetypes, selectedKey]);

  return (
    <div className="space-y-6">
      {/* Header com estilo tático militar Anaheim HUB */}
      <Card className="panel-cut rounded-none border-primary/40 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-accent animate-pulse" />
                <p className="text-xs uppercase tracking-[0.26em] text-primary font-mono font-semibold">
                  ATMI · Anaheim Tactical Meta Intelligence
                </p>
                <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent text-[10px] uppercase">
                  Engine VEDA
                </Badge>
              </div>
              <h2 className="mt-2 font-heading text-3xl sm:text-4xl uppercase tracking-wider text-white">
                Matriz de Arquétipos & Classificação Quadrante
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
                Categorização matemática pura do metagame sem faixas empíricas. Os cards são posicionados nos eixos
                de <strong>Frequência de Inclusão (IR)</strong> e <strong>Rigidez de Slot (SR)</strong> para distinguir
                verdadeiras peças estruturais de escolhas adaptativas ou ferramentas de surpresa.
              </p>
            </div>

            {/* Modal de Metodologia Matemática */}
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-none border border-white/20 bg-white/5 px-4 py-2 text-xs uppercase tracking-widest text-slate-200 transition hover:border-primary hover:bg-primary/10 hover:text-white"
                >
                  <Info className="size-4 text-primary" />
                  Metodologia Matemática
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl border-white/20 bg-slate-950 text-white panel-cut rounded-none">
                <DialogHeader>
                  <DialogTitle className="font-heading text-2xl uppercase tracking-wider text-primary flex items-center gap-2">
                    <Activity className="size-5 text-accent" />
                    Protocolo Analítico ATMI (Fórmulas Oficiais)
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed max-h-[70vh] overflow-y-auto pr-2">
                  <div className="p-3 bg-white/5 border border-white/10 panel-cut">
                    <h4 className="font-heading uppercase text-accent font-semibold">1. Frequência de Inclusão (Inclusion Rate - IR)</h4>
                    <p className="mt-1 font-mono text-xs text-white">IR = D_c / D_arch</p>
                    <p className="mt-1 text-slate-400 text-xs">
                      Proporção de listas do arquétipo que contêm pelo menos 1 cópia da carta <em>c</em>.
                    </p>
                  </div>

                  <div className="p-3 bg-white/5 border border-white/10 panel-cut">
                    <h4 className="font-heading uppercase text-cyan-300 font-semibold">2. Rigidez de Slot (Slot Rigidity - SR)</h4>
                    <p className="mt-1 font-mono text-xs text-white">SR = 1 - (σ / μ)</p>
                    <p className="mt-1 text-slate-400 text-xs">
                      Mede o grau de consenso do número de cópias. Se todas as listas usam rigorosamente 4 cópias, σ = 0 e SR = 1.0 (100% de rigidez).
                      Se varia muito entre 1 e 4 cópias, σ aumenta e a rigidez diminui, indicando flexibilidade de slots.
                    </p>
                  </div>

                  <div className="p-3 bg-white/5 border border-white/10 panel-cut">
                    <h4 className="font-heading uppercase text-amber-300 font-semibold">3. Fator de Afinidade de Arquétipo (Affinity)</h4>
                    <p className="mt-1 font-mono text-xs text-white">Affinity = IR_arch / IR_color</p>
                    <p className="mt-1 text-slate-400 text-xs">
                      Relação de exclusividade da carta em relação aos decks gerais da mesma cor. Afinidade &gt; 1.5 indica forte especialização para o arquétipo.
                    </p>
                  </div>

                  <div className="p-3 bg-white/5 border border-white/10 panel-cut">
                    <h4 className="font-heading uppercase text-emerald-300 font-semibold">4. Curva Tática Composta (Composite Curve Score)</h4>
                    <p className="mt-1 font-mono text-xs text-white">S_curve = (μ_cost × 0.6) + (μ_level × 0.4)</p>
                    <p className="mt-1 text-slate-400 text-xs">
                      Ponderação mista entre o custo de ativação de recursos e a exigência de patamar de nível dos Mobile Suits no campo de batalha.
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Seletor de Arquétipos com Chips / Cards */}
          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-mono mb-3">
              Selecione o Arquétipo Operacional:
            </p>
            {loadingArchetypes ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 animate-pulse">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-20 bg-white/5 border border-white/10 panel-cut" />
                ))}
              </div>
            ) : archetypes.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum arquétipo catalogado com amostra suficiente no momento.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {archetypes.map((arch) => {
                  const isSelected = arch.key === selectedKey;
                  return (
                    <button
                      key={arch.key}
                      type="button"
                      onClick={() => setSelectedKey(arch.key)}
                      className={`panel-cut p-3 text-left transition-all border relative overflow-hidden group ${
                        isSelected
                          ? "border-primary bg-primary/15 shadow-[0_0_15px_rgba(20,184,166,0.25)]"
                          : "border-white/10 bg-slate-950/60 hover:border-white/30 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <div className="flex items-center gap-1">
                          {arch.colors.map((c) => (
                            <span
                              key={c}
                              className="size-2.5 rounded-full"
                              style={{ backgroundColor: GAME_COLOR_HEX[c] || "#94a3b8" }}
                            />
                          ))}
                        </div>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono border-white/20 text-slate-300">
                          {(arch.share * 100).toFixed(1)}% META
                        </Badge>
                      </div>

                      <p className="font-heading text-sm uppercase tracking-wide text-white truncate group-hover:text-primary transition-colors">
                        {arch.name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-1">
                        {arch.deckCount} {arch.deckCount === 1 ? "deck catalogado" : "decks catalogados"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detalhamento do Arquétipo Selecionado */}
      {loadingBreakdown && (
        <div className="p-12 text-center text-slate-400 animate-pulse font-mono text-sm">
          CALCULANDO MÉTRICAS QUADRANTES COM ENGINE VEDA...
        </div>
      )}

      {!loadingBreakdown && breakdown && (
        <div className="space-y-6">
          {/* Barra de Telemetria de Curva e Médias do Arquétipo */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="panel-cut border border-white/10 bg-slate-950/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono">Custo Médio (μ_cost)</p>
              <p className="mt-1 font-heading text-2xl text-white">{(breakdown.averages?.avgCost ?? 0).toFixed(2)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Recursos por ativação média</p>
            </div>

            <div className="panel-cut border border-white/10 bg-slate-950/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono">Nível Médio (μ_lvl)</p>
              <p className="mt-1 font-heading text-2xl text-cyan-300">{(breakdown.averages?.avgLevel ?? 0).toFixed(2)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Nível médio dos Mobile Suits</p>
            </div>

            <div className="panel-cut border border-white/10 bg-slate-950/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono">Escore de Curva Tática</p>
              <p className="mt-1 font-heading text-2xl text-accent">{(breakdown.averages?.compositeCurveScore ?? 0).toFixed(2)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Ponderação Custo × Nível</p>
            </div>

            <div className="panel-cut border border-white/10 bg-slate-950/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono">Unidades / Pilotos</p>
              <p className="mt-1 font-heading text-2xl text-emerald-300">
                {breakdown.averages?.unitCount ?? 0} <span className="text-sm font-sans text-slate-400">/</span> {breakdown.averages?.pilotCount ?? 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Média por lista no arquétipo</p>
            </div>

            <div className="panel-cut border border-white/10 bg-slate-950/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono">Comandos / Bases</p>
              <p className="mt-1 font-heading text-2xl text-purple-300">
                {breakdown.averages?.commandCount ?? 0} <span className="text-sm font-sans text-slate-400">/</span> {breakdown.averages?.baseCount ?? 0}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Suporte tático e infraestrutura</p>
            </div>
          </div>

          {/* Abas dos Quadrantes */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveQuadrantTab("ALL")}
                className={`px-3 py-1.5 text-xs uppercase tracking-wider font-mono rounded-none transition border ${
                  activeQuadrantTab === "ALL"
                    ? "border-primary bg-primary/20 text-white font-semibold"
                    : "border-transparent text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Todos os Quadrantes ({
                  (breakdown.quadrants?.core?.length ?? 0) +
                  (breakdown.quadrants?.staples?.length ?? 0) +
                  (breakdown.quadrants?.flex?.length ?? 0) +
                  (breakdown.quadrants?.techs?.length ?? 0)
                })
              </button>

              {(["CORE", "STAPLE", "FLEX", "TECH"] as MetaQuadrant[]).map((q) => {
                const count = (breakdown.quadrants?.[q.toLowerCase() as keyof typeof breakdown.quadrants] || []).length;
                const config = QUADRANT_CONFIG[q];
                const isCurrent = activeQuadrantTab === q;
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setActiveQuadrantTab(q)}
                    className={`px-3 py-1.5 text-xs uppercase tracking-wider font-mono rounded-none transition border flex items-center gap-1.5 ${
                      isCurrent
                        ? `${config.badgeClass} border font-semibold`
                        : "border-transparent text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span>{config.badge}</span>
                    <span className="text-[10px] opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-400 font-mono">
              Amostragem: {breakdown.totalDecksSampled ?? 0} {breakdown.totalDecksSampled === 1 ? "deck validado" : "decks validados"}
            </p>
          </div>

          {/* Renderização dos Quadrantes */}
          <div className="space-y-8">
            {(["CORE", "STAPLE", "FLEX", "TECH"] as MetaQuadrant[]).map((quadrantKey) => {
              if (activeQuadrantTab !== "ALL" && activeQuadrantTab !== quadrantKey) return null;

              const cardsInQuadrant = breakdown.quadrants?.[quadrantKey.toLowerCase() as keyof typeof breakdown.quadrants] || [];
              const config = QUADRANT_CONFIG[quadrantKey];
              const IconComp = config.icon;

              return (
                <div key={quadrantKey} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <IconComp className="size-4 text-primary" />
                      <h3 className="font-heading text-xl uppercase tracking-wider text-white">
                        {config.title}
                      </h3>
                      <Badge className={`rounded-none text-[10px] uppercase font-mono ${config.badgeClass}`}>
                        {cardsInQuadrant.length} {cardsInQuadrant.length === 1 ? "card" : "cards"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">
                      Critério: {config.formula}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400">
                    {config.desc}
                  </p>

                  {cardsInQuadrant.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 border border-white/5 bg-slate-950/40 panel-cut">
                      Nenhuma carta enquadrada nesta categoria para o arquétipo atual.
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {cardsInQuadrant.map((c) => (
                        <MetaCardItem key={c.id || c.code} card={c} config={config} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MetaCardItem({ 
  card, 
  config 
}: { 
  card: ClassifiedMetaCard; 
  config: typeof QUADRANT_CONFIG[MetaQuadrant];
}) {
  const [imgSrc, setImgSrc] = useState(card.imageUrl || card.imageMediumUrl || gundamCardBack);

  return (
    <div className={`panel-cut p-3 border transition-all duration-200 group flex flex-col justify-between ${config.borderClass}`}>
      <div>
        <div className="flex items-center justify-between gap-1 mb-2">
          <div className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: GAME_COLOR_HEX[card.color || "Blue"] || "#94a3b8" }}
            />
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              {card.code}
            </span>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="rounded-none font-mono text-[10px] px-1.5 py-0 border-white/20 bg-white/10 text-white cursor-help">
                Moda: {card.modeCopies}x
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 border-white/20 text-xs">
              Número de cópias mais frequentemente adotado nas listas competitivas.
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex gap-3">
          <div className="relative w-16 h-22 shrink-0 bg-slate-950 overflow-hidden border border-white/10 panel-cut">
            <img
              src={imgSrc}
              alt={card.name}
              onError={() => setImgSrc(gundamCardBack)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="font-heading text-sm uppercase tracking-wide text-white truncate group-hover:text-primary transition-colors">
              {card.namePt || card.nameEn || card.name}
            </h4>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {card.cardType} {card.cost !== null && card.cost !== undefined ? `· Custo ${card.cost}` : ""}{card.level ? ` · Lv.${card.level}` : ""}
            </p>

            <div className="mt-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-400">Inclusão (IR)</span>
                <span className="text-white font-semibold">{(card.inclusionRate * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-none overflow-hidden mt-1">
                <div 
                  className="h-full bg-primary transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(0, card.inclusionRate * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-white/10 grid grid-cols-3 gap-1 text-center font-mono">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-1 rounded bg-black/30 cursor-help">
              <p className="text-[9px] uppercase text-slate-500">Média (μ)</p>
              <p className="text-xs text-white font-medium">{card.meanCopies.toFixed(1)} ± {card.stdDevCopies.toFixed(1)}</p>
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-slate-900 border-white/20 text-xs">
            Média amostral de cópias (μ) e desvio padrão (σ).
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-1 rounded bg-black/30 cursor-help">
              <p className="text-[9px] uppercase text-slate-500">Rigidez (SR)</p>
              <p className="text-xs text-cyan-300 font-medium">{(card.slotRigidity * 100).toFixed(0)}%</p>
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-slate-900 border-white/20 text-xs">
            Rigidez do Slot: proximidade de consenso no número de cópias (1 - σ/μ).
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-1 rounded bg-black/30 cursor-help">
              <p className="text-[9px] uppercase text-slate-500">Afinidade</p>
              <p className="text-xs text-amber-300 font-medium">{card.affinity.toFixed(1)}x</p>
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-slate-900 border-white/20 text-xs">
            Fator de Especialização: quantas vezes mais frequente nesta lista do que no total da cor.
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
