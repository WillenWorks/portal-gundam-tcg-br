/* Decks públicos v10.0 (Hangar de Criação de Decks da OZ)
 * Banner imersivo com Tallgeese em escala monumental, filtros avançados de metagame,
 * seleção multi-cor, rolagem infinita de 12 em 12 e acesso imediato ao deckbuilder. */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowDownAZ,
  ArrowUpDown,
  Compass,
  Filter,
  Flame,
  Layers,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Swords,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import ozDeckHangarImg from "@/assets/home/oz_deck_hangar.jpg";
import { PublicShell } from "@/components/layout/PublicShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DeckPreviewCard } from "@/components/deck/DeckPreviewCard";
import { DeckFiltersModal, type DeckFiltersState } from "@/components/deck/DeckFiltersModal";
import { api, type ApiDeck } from "@/lib/api";
import { GAME_COLOR_HEX } from "@/lib/gundam-catalog";

const SORT_OPTIONS = [
  { value: "views_desc", label: "Mais Vistos" },
  { value: "likes_desc", label: "Mais Curtidos" },
  { value: "recent", label: "Mais Recentes" },
  { value: "oldest", label: "Mais Antigos" },
  { value: "name_asc", label: "Nome A-Z" },
  { value: "name_desc", label: "Nome Z-A" },
] as const;

const AVAILABLE_COLORS = [
  { id: "BLUE", label: "Azul", hex: GAME_COLOR_HEX.BLUE || "#2563eb" },
  { id: "GREEN", label: "Verde", hex: GAME_COLOR_HEX.GREEN || "#16a34a" },
  { id: "RED", label: "Vermelho", hex: GAME_COLOR_HEX.RED || "#dc2626" },
  { id: "WHITE", label: "Branco", hex: GAME_COLOR_HEX.WHITE || "#e2e8f0" },
  { id: "PURPLE", label: "Roxo", hex: "#9333ea" },
];

export default function PublicDecksPage() {
  const [, navigate] = useLocation();

  const [decks, setDecks] = useState<ApiDeck[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalDecks, setTotalDecks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filtros
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [unitDraft, setUnitDraft] = useState("");
  const [unit, setUnit] = useState("");
  const [mainUnitOnly, setMainUnitOnly] = useState(false);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [sort, setSort] = useState<string>("views_desc");
  const [exactColor, setExactColor] = useState(false);
  const [starterDecksOnly, setStarterDecksOnly] = useState(false);
  const [dateRange, setDateRange] = useState<"3months" | "6months" | "all">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);

  // Modal de Importação Rápida
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  const observerTarget = useRef<HTMLDivElement | null>(null);

  // Debounce dos inputs de texto
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(queryDraft);
      setUnit(unitDraft);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [queryDraft, unitDraft]);

  // Carrega a primeira página quando os filtros mudam
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setPage(1);

    const colorParam = selectedColors.join(",");

    api
      .listPublicDecksPage(
        { page: 1, pageSize: 12 },
        {
          q: query,
          sort,
          color: colorParam,
          unit: unit,
          mainUnit: mainUnitOnly ? unit || "LR" : undefined,
          exactColor,
          starterDecksOnly,
          dateRange,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }
      )
      .then((res) => {
        if (isCancelled) return;
        setDecks(res.items || []);
        setHasMore(Boolean(res.hasMore));
        setTotalDecks(res.total || 0);
      })
      .catch((err) => {
        console.error("Falha ao buscar decks públicos:", err);
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [query, unit, mainUnitOnly, selectedColors, sort, exactColor, starterDecksOnly, dateRange, startDate, endDate]);

  // Função para carregar mais decks (paginação de 12 em 12)
  const loadMoreDecks = async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const colorParam = selectedColors.join(",");

    try {
      const res = await api.listPublicDecksPage(
        { page: nextPage, pageSize: 12 },
        {
          q: query,
          sort,
          color: colorParam,
          unit: unit,
          mainUnit: mainUnitOnly ? unit || "LR" : undefined,
          exactColor,
          starterDecksOnly,
          dateRange,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }
      );
      setDecks((prev) => [...prev, ...(res.items || [])]);
      setPage(nextPage);
      setHasMore(Boolean(res.hasMore));
    } catch (err) {
      console.error("Erro ao carregar mais decks:", err);
      toast.error("Erro ao carregar mais decks.");
    } finally {
      setLoadingMore(false);
    }
  };

  // Observador para rolagem infinita automática
  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    const currentTarget = observerTarget.current;
    if (!currentTarget) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreDecks();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(currentTarget);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, loadingMore, page, query, unit, mainUnitOnly, selectedColors, sort]);

  const toggleColor = (colorId: string) => {
    setSelectedColors((prev) =>
      prev.includes(colorId) ? prev.filter((c) => c !== colorId) : [...prev, colorId]
    );
  };

  const clearAllFilters = () => {
    setQueryDraft("");
    setQuery("");
    setUnitDraft("");
    setUnit("");
    setMainUnitOnly(false);
    setSelectedColors([]);
    setExactColor(false);
    setStarterDecksOnly(false);
    setDateRange("all");
    setStartDate("");
    setEndDate("");
    setSort("views_desc");
  };

  const activeFiltersCount =
    (query ? 1 : 0) +
    (unit ? 1 : 0) +
    (selectedColors.length > 0 ? 1 : 0) +
    (exactColor ? 1 : 0) +
    (starterDecksOnly ? 1 : 0) +
    (startDate || endDate || dateRange !== "all" ? 1 : 0) +
    (mainUnitOnly ? 1 : 0);

  const handleStartImport = () => {
    if (!importText.trim()) {
      toast.error("Cole ao menos uma linha de texto com o código das cartas.");
      return;
    }
    // Salva rascunho temporário no localStorage e redireciona para o deckbuilder
    localStorage.setItem("gundam_deck_import_draft", importText);
    setImportOpen(false);
    navigate("/deckbuilder/novo?import=true");
  };

  return (
    <PublicShell breadcrumbs={[{ label: "Decks" }]}>
      {/* BANNER PRINCIPAL: HANGAR DE CRIAÇÃO DE DECKS DA OZ */}
      <section className="relative mb-8 min-h-[300px] overflow-hidden border border-primary/40 bg-slate-950 shadow-2xl shadow-primary/15">
        {/* Background Hangar com Tallgeese na Escala Canônica */}
        <div className="absolute inset-0 z-0">
          <img
            src={ozDeckHangarImg}
            alt="Hangar da OZ com o Tallgeese em montagem"
            className="h-full w-full object-cover object-center opacity-70 transition-transform duration-700 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-slate-950/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-15" />
        </div>

        {/* Conteúdo do Banner */}
        <div className="relative z-10 p-6 sm:p-10 md:p-12 lg:p-14">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-3xl space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-block size-2 rounded-full bg-primary animate-ping" />
                <Badge
                  variant="outline"
                  className="rounded-none border-primary/50 bg-primary/15 text-primary font-mono text-[0.7rem] uppercase tracking-widest px-2.5 py-0.5"
                >
                  DIRETRIZ MILITAR OZ · BAIA DE MONTAGEM
                </Badge>
              </div>

              <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl uppercase tracking-tight text-white leading-tight drop-shadow-md">
                Hangar de Criação de Decks da OZ
              </h1>

              <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl font-sans drop-shadow">
                Projetos de engenharia móvel, formações táticas de combate e arsenais compartilhados
                pelos pilotos da comunidade para calibração, estudo e análise competitiva de metagame.
              </p>

              {/* Informações táticas de status */}
              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Layers className="size-3.5 text-primary" />
                  Total em Operação:{" "}
                  <strong className="text-white">{totalDecks} Decks</strong>
                </span>
                <span className="hidden sm:inline text-slate-600">|</span>
                <span className="flex items-center gap-1.5">
                  <Swords className="size-3.5 text-amber-400" />
                  Formatos: Padrão Construído
                </span>
                <span className="hidden sm:inline text-slate-600">|</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Acesso Livre para Criação
                </span>
              </div>
            </div>

            {/* Ações de Destaque no Banner */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
              <Button
                asChild
                size="lg"
                className="rounded-none bg-primary text-primary-foreground font-heading uppercase tracking-wider text-sm px-6 py-6 shadow-lg shadow-primary/25 hover:bg-primary/90 hover:scale-[1.02] transition-all"
              >
                <Link href="/deckbuilder/novo">
                  <Plus className="mr-2 size-5" />
                  Criar Deck
                </Link>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setImportOpen(true)}
                className="rounded-none border-white/20 bg-slate-900/80 backdrop-blur text-white font-heading uppercase tracking-wider text-sm px-6 py-6 hover:bg-white/10 hover:border-primary/50 transition-all"
              >
                <Upload className="mr-2 size-4 text-primary" />
                Importar Decklist
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* BARRA DE FILTROS & TELEMETRIA */}
      <div className="mb-6 space-y-4">
        {/* Linha 1: Campo de Busca, Unidade, Ordenação */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2.5 flex-1">
            {/* Busca por Nome ou Autor */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              <Input
                value={queryDraft}
                onChange={(e) => setQueryDraft(e.target.value)}
                placeholder="Buscar por nome do deck ou piloto..."
                className="field-shell pl-9 h-11 text-sm placeholder:text-slate-500"
              />
              {queryDraft && (
                <button
                  onClick={() => {
                    setQueryDraft("");
                    setQuery("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Busca por Unidade ou Código */}
            <div className="relative sm:w-64">
              <Compass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              <Input
                value={unitDraft}
                onChange={(e) => setUnitDraft(e.target.value)}
                placeholder="Unidade (ex: Tallgeese, GD01)..."
                className="field-shell pl-9 h-11 text-sm placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Ordenação, Filtros Avançados e Unidade Principal (LR) */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFiltersModalOpen(true)}
              className={`rounded-none h-11 px-3.5 text-xs uppercase tracking-wider font-mono transition-all flex items-center gap-2 ${
                activeFiltersCount > 0
                  ? "border-sky-400 bg-sky-950/60 text-sky-300 shadow-sm shadow-sky-400/20"
                  : "border-white/15 bg-slate-900/60 text-slate-300 hover:text-white"
              }`}
              title="Abrir painel de filtros avançados estilo Exburst"
            >
              <Filter className="size-3.5 text-sky-400" />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="size-4 rounded-full bg-sky-400 text-slate-950 font-bold text-[10px] flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            <Button
              type="button"
              variant={mainUnitOnly ? "default" : "outline"}
              onClick={() => setMainUnitOnly(!mainUnitOnly)}
              className={`rounded-none h-11 px-3.5 text-xs uppercase tracking-wider font-mono transition-all ${
                mainUnitOnly
                  ? "bg-amber-600 hover:bg-amber-500 text-white border-amber-500"
                  : "border-white/15 bg-slate-900/60 text-slate-300 hover:text-white"
              }`}
              title="Filtrar decks centrados em Mobile Suits Legend Rare (LR)"
            >
              <Sparkles className="mr-1.5 size-3.5" />
              Principal (LR)
            </Button>

            <div className="relative min-w-[190px]">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="field-shell pl-8 h-11 text-xs uppercase tracking-wider w-full appearance-none cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Linha 2: Seletor Multi-Cor Interativo e Badges Ativas */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5 mr-1">
              <Filter className="size-3 text-primary" /> Cores:
            </span>

            {AVAILABLE_COLORS.map((c) => {
              const active = selectedColors.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleColor(c.id)}
                  className={`group relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium uppercase tracking-wider border transition-all ${
                    active
                      ? "border-primary bg-primary/20 text-white shadow-sm shadow-primary/20"
                      : "border-white/10 bg-slate-950/60 text-slate-400 hover:border-white/25 hover:text-white"
                  }`}
                >
                  <span
                    className={`size-3 rounded-full border border-black/40 transition-transform ${
                      active ? "scale-110 ring-2 ring-primary ring-offset-1 ring-offset-slate-950" : ""
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                  <span>{c.label}</span>
                </button>
              );
            })}

            {/* Badges de filtros adicionais ativos */}
            {exactColor && (
              <Badge className="rounded-none bg-sky-950/80 border-sky-400/50 text-sky-300 text-[11px] font-mono flex items-center gap-1 py-1">
                Cor Exata
                <button onClick={() => setExactColor(false)} className="hover:text-white ml-0.5">✕</button>
              </Badge>
            )}
            {starterDecksOnly && (
              <Badge className="rounded-none bg-sky-950/80 border-sky-400/50 text-sky-300 text-[11px] font-mono flex items-center gap-1 py-1">
                Apenas Decks Iniciais
                <button onClick={() => setStarterDecksOnly(false)} className="hover:text-white ml-0.5">✕</button>
              </Badge>
            )}
            {dateRange !== "all" && (
              <Badge className="rounded-none bg-sky-950/80 border-sky-400/50 text-sky-300 text-[11px] font-mono flex items-center gap-1 py-1">
                {dateRange === "3months" ? "Últimos 3 Meses" : "Últimos 6 Meses"}
                <button onClick={() => setDateRange("all")} className="hover:text-white ml-0.5">✕</button>
              </Badge>
            )}
            {unit && (
              <Badge className="rounded-none bg-sky-950/80 border-sky-400/50 text-sky-300 text-[11px] font-mono flex items-center gap-1 py-1">
                Carta: {unit}
                <button onClick={() => { setUnit(""); setUnitDraft(""); }} className="hover:text-white ml-0.5">✕</button>
              </Badge>
            )}

            {/* Limpar Filtros se algum estiver ativo */}
            {activeFiltersCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 rounded-none h-8 px-2"
              >
                <RotateCcw className="mr-1 size-3" /> Limpar filtros
              </Button>
            )}
          </div>

          <div className="text-xs font-mono text-slate-400">
            Exibindo <span className="text-white font-bold">{decks.length}</span> de{" "}
            <span className="text-white font-bold">{totalDecks}</span> projetos
          </div>
        </div>
      </div>

      {/* CATÁLOGO DE DECKS */}
      {loading ? (
        <div className="py-24 text-center text-sm text-slate-400">
          <div className="mx-auto size-10 border-2 border-primary/40 border-t-primary animate-spin mb-4" />
          <p className="uppercase tracking-[0.2em] text-xs font-mono">
            Sincronizando Arsenal com a Base Central OZ...
          </p>
        </div>
      ) : !decks.length ? (
        <Card className="panel-cut rounded-none surface-panel border border-white/10">
          <CardContent className="p-16 text-center text-sm text-slate-400 space-y-4">
            <Swords className="mx-auto size-12 text-slate-600" />
            <p className="font-heading text-2xl uppercase text-slate-200">
              Nenhum projeto encontrado no Arsenal
            </p>
            <p className="text-xs uppercase tracking-widest text-slate-500 max-w-md mx-auto">
              {query || unit || selectedColors.length > 0
                ? "Nenhum deck coincide com os filtros atuais. Tente buscar com outros termos ou redefinir os parâmetros."
                : "Seja o primeiro comandante a enviar uma lista tática para a comunidade!"}
            </p>
            <div className="pt-2 flex justify-center gap-3">
              {(query || unit || selectedColors.length > 0) && (
                <Button
                  variant="outline"
                  onClick={clearAllFilters}
                  className="rounded-none border-white/15"
                >
                  Limpar Parâmetros
                </Button>
              )}
              <Button asChild className="rounded-none bg-primary text-primary-foreground">
                <Link href="/deckbuilder/novo">Construir Novo Deck</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-5 sm:grid-cols-1 md:grid-cols-2 2xl:grid-cols-3">
            {decks.map((deck) => (
              <DeckPreviewCard key={deck.id} deck={deck} />
            ))}
          </div>

          {/* Elemento Sentinela para Rolagem Infinita */}
          <div ref={observerTarget} className="py-4 flex justify-center">
            {loadingMore ? (
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-400 py-4">
                <div className="size-4 border-2 border-primary/40 border-t-primary animate-spin" />
                Carregando novos arsenais (12 em 12)...
              </div>
            ) : hasMore ? (
              <Button
                variant="outline"
                onClick={loadMoreDecks}
                className="rounded-none border-white/20 bg-slate-900/60 font-mono text-xs uppercase tracking-wider hover:border-primary/50"
              >
                Carregar Mais Decks ({decks.length}/{totalDecks})
              </Button>
            ) : decks.length > 12 ? (
              <p className="text-xs font-mono uppercase tracking-widest text-slate-500">
                Fim do registro de dados · Todos os {totalDecks} decks carregados
              </p>
            ) : null}
          </div>
        </div>
      )}

      {/* MODAL DE IMPORTAÇÃO RÁPIDA DE DECKLIST */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="rounded-none border-primary/40 bg-slate-950 text-white max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl uppercase tracking-wider text-primary flex items-center gap-2">
              <Upload className="size-5" /> Importar Lista Tática
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Cole sua decklist nos formatos compatíveis (MSA / Exburst, Wing Table ou lista simples
              de códigos). O Hangar montará o rascunho instantaneamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <textarea
              rows={10}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`// Exemplo MSA / Exburst:\n4x GD01-001\n4x GD01-015\n\n// Ou Formato Wing Table:\n// Main Deck\n4x GD01-001\n// Resource Deck\n10x GD01-080`}
              className="w-full field-shell font-mono text-xs p-3 resize-none h-56 bg-slate-900 border-white/15 focus:border-primary"
            />

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Qualquer usuário ou visitante pode importar e editar.</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setImportOpen(false)}
                  className="rounded-none border-white/20"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleStartImport}
                  className="rounded-none bg-primary text-primary-foreground font-heading uppercase tracking-wider"
                >
                  Abrir no Hangar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Filtros Avançados estilo Exburst */}
      <DeckFiltersModal
        open={filtersModalOpen}
        onClose={() => setFiltersModalOpen(false)}
        filters={{
          q: query,
          unit,
          selectedColors,
          exactColor,
          starterDecksOnly,
          dateRange,
          sort,
        }}
        onApply={(newFilters) => {
          setQuery(newFilters.q);
          setQueryDraft(newFilters.q);
          setUnit(newFilters.unit);
          setUnitDraft(newFilters.unit);
          setSelectedColors(newFilters.selectedColors);
          setExactColor(newFilters.exactColor);
          setStarterDecksOnly(newFilters.starterDecksOnly);
          setDateRange(newFilters.dateRange);
          setSort(newFilters.sort);
        }}
        onClear={clearAllFilters}
      />
    </PublicShell>
  );
}
