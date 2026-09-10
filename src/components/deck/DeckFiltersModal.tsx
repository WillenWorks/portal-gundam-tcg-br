/* Modal de Filtros Avançados estilo Exburst (Image 1)
 * Inclui carrossel horizontal de cartas principais LR com custo, busca reativa,
 * cores com correspondência exata, starter decks e intervalo de data. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X, Check, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api, type PopularLrCard } from "@/lib/api";
import { GAME_COLOR_HEX } from "@/lib/gundam-catalog";

export interface DeckFiltersState {
  q: string;
  unit: string;
  selectedColors: string[];
  exactColor: boolean;
  starterDecksOnly: boolean;
  dateRange: "3months" | "6months" | "all";
  sort: string;
}

interface DeckFiltersModalProps {
  open: boolean;
  onClose: () => void;
  filters: DeckFiltersState;
  onApply: (newFilters: DeckFiltersState) => void;
  onClear: () => void;
}

const FILTER_COLORS = [
  { id: "PURPLE", label: "Roxo", hex: "#9333ea" },
  { id: "RED", label: "Vermelho", hex: GAME_COLOR_HEX.RED || "#dc2626" },
  { id: "BLUE", label: "Azul", hex: GAME_COLOR_HEX.BLUE || "#2563eb" },
  { id: "GREEN", label: "Verde", hex: GAME_COLOR_HEX.GREEN || "#16a34a" },
  { id: "WHITE", label: "Branco", hex: GAME_COLOR_HEX.WHITE || "#e2e8f0" },
  { id: "YELLOW", label: "Amarelo", hex: GAME_COLOR_HEX.YELLOW || "#ca8a04" },
  { id: "BLACK", label: "Preto", hex: GAME_COLOR_HEX.BLACK || "#475569" },
];

const SORT_OPTIONS = [
  { value: "views_desc", label: "Mais Vistos" },
  { value: "recent", label: "Mais Recentes" },
  { value: "likes_desc", label: "Mais Curtidos" },
  { value: "oldest", label: "Mais Antigos" },
  { value: "name_asc", label: "Nome (A-Z)" },
  { value: "name_desc", label: "Nome (Z-A)" },
];

export function DeckFiltersModal({
  open,
  onClose,
  filters,
  onApply,
  onClear,
}: DeckFiltersModalProps) {
  // Estado local do modal para edição prévia antes de aplicar
  const [draftFilters, setDraftFilters] = useState<DeckFiltersState>(filters);
  const [lrCards, setLrCards] = useState<PopularLrCard[]>([]);
  const [loadingLr, setLoadingLr] = useState(false);
  const [cardSearchQuery, setCardSearchQuery] = useState("");

  const carouselRef = useRef<HTMLDivElement | null>(null);

  // Sincroniza ao abrir
  useEffect(() => {
    if (open) {
      setDraftFilters(filters);
      if (lrCards.length === 0) {
        setLoadingLr(true);
        api
          .listMainLRUnits()
          .then((cards) => setLrCards(cards || []))
          .catch((err) => console.error("Erro ao carregar cartas principais LR:", err))
          .finally(() => setLoadingLr(false));
      }
    }
  }, [open, filters, lrCards.length]);

  // Filtra as cartas do carrossel pela busca local
  const filteredCards = useMemo(() => {
    const term = cardSearchQuery.trim().toLowerCase();
    if (!term) return lrCards;
    return lrCards.filter(
      (c) =>
        c.nameEn?.toLowerCase().includes(term) ||
        c.namePt?.toLowerCase().includes(term) ||
        c.code?.toLowerCase().includes(term)
    );
  }, [lrCards, cardSearchQuery]);

  const scrollCarousel = (direction: "left" | "right") => {
    if (!carouselRef.current) return;
    const offset = direction === "left" ? -320 : 320;
    carouselRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  const toggleSelectCard = (card: PopularLrCard) => {
    setDraftFilters((prev) => {
      const isCurrent = prev.unit === card.nameEn || prev.unit === card.code;
      return {
        ...prev,
        unit: isCurrent ? "" : (card.nameEn || card.code),
      };
    });
  };

  const toggleColor = (colorId: string) => {
    setDraftFilters((prev) => {
      const exists = prev.selectedColors.includes(colorId);
      const nextColors = exists
        ? prev.selectedColors.filter((c) => c !== colorId)
        : [...prev.selectedColors, colorId];
      return { ...prev, selectedColors: nextColors };
    });
  };

  const handleApply = () => {
    onApply(draftFilters);
    onClose();
  };

  const handleReset = () => {
    const cleared: DeckFiltersState = {
      q: "",
      unit: "",
      selectedColors: [],
      exactColor: false,
      starterDecksOnly: false,
      dateRange: "all",
      sort: "recent",
    };
    setDraftFilters(cleared);
    setCardSearchQuery("");
    onClear();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-5xl lg:max-w-6xl w-[95vw] border-white/10 bg-[#12161c] text-white p-0 overflow-hidden shadow-2xl rounded-none"
      >
        <DialogHeader className="p-5 border-b border-white/10 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-5 bg-sky-400 inline-block" />
            <div>
              <DialogTitle className="font-heading text-xl uppercase tracking-wider text-white">
                Filtros Avançados
              </DialogTitle>
              <DialogDescription className="sr-only">
                Painel de filtragem avançada de decks do Hangar da OZ
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-white/5 border border-white/10"
            title="Fechar filtros"
          >
            <X className="size-5" />
          </button>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* SEÇÃO 1: CARTA PRINCIPAL (LR) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1 h-4 bg-sky-400 inline-block" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400">
                  CARTA PRINCIPAL (LR)
                </h3>
              </div>
              {draftFilters.unit && (
                <button
                  type="button"
                  onClick={() => setDraftFilters((prev) => ({ ...prev, unit: "" }))}
                  className="text-xs text-rose-400 hover:text-rose-300 font-mono"
                >
                  Remover seleção ({draftFilters.unit}) ✕
                </button>
              )}
            </div>

            {/* Input de busca de cartas */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
              <Input
                value={cardSearchQuery}
                onChange={(e) => setCardSearchQuery(e.target.value)}
                placeholder="Buscar carta principal por nome ou código..."
                className="bg-[#181f28] border-white/10 pl-9 text-sm text-white placeholder:text-slate-500 rounded-none h-10"
              />
              {cardSearchQuery && (
                <button
                  onClick={() => setCardSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Carrossel Horizontal de Cartas LR */}
            <div className="relative group/carousel">
              <div
                ref={carouselRef}
                className="flex items-center gap-3 overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-sky-500/30 scrollbar-track-transparent select-none"
              >
                {loadingLr ? (
                  <div className="py-8 text-center w-full text-xs text-slate-400 font-mono">
                    Carregando cartas principais...
                  </div>
                ) : !filteredCards.length ? (
                  <div className="py-8 text-center w-full text-xs text-slate-500 font-mono">
                    Nenhuma carta encontrada para "{cardSearchQuery}".
                  </div>
                ) : (
                  filteredCards.map((card) => {
                    const isSelected =
                      draftFilters.unit === card.nameEn || draftFilters.unit === card.code;
                    const cardImg = card.imageMediumUrl || card.imageUrl;
                    const cardColor = card.color?.toUpperCase();
                    const cardName = card.namePt || card.nameEn;
                    const badgeBg =
                      cardColor === "RED"
                        ? "bg-red-600"
                        : cardColor === "BLUE"
                        ? "bg-blue-600"
                        : cardColor === "GREEN"
                        ? "bg-emerald-600"
                        : cardColor === "YELLOW"
                        ? "bg-amber-600"
                        : cardColor === "PURPLE"
                        ? "bg-purple-600"
                        : cardColor === "BLACK"
                        ? "bg-slate-700"
                        : "bg-slate-800";

                    return (
                      <button
                        key={card.id || card.code}
                        type="button"
                        onClick={() => toggleSelectCard(card)}
                        className={`relative shrink-0 w-28 sm:w-32 aspect-[3/4] rounded-md overflow-hidden border transition-all text-left group cursor-pointer ${
                          isSelected
                            ? "border-sky-400 ring-2 ring-sky-400 ring-offset-2 ring-offset-[#12161c] shadow-lg shadow-sky-500/20 scale-[1.03]"
                            : "border-white/15 bg-slate-900/80 hover:border-white/40 hover:scale-[1.02]"
                        }`}
                        title={`${cardName} (${card.code})`}
                      >
                        {cardImg ? (
                          <img
                            src={cardImg}
                            alt={cardName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-1 text-[10px] text-center font-mono text-slate-400">
                            {card.code}
                          </div>
                        )}

                        {/* Custo Badge no Topo-Esquerdo */}
                        {typeof card.cost === "number" && (
                          <div
                            className={`absolute top-1 left-1 size-5 rounded flex items-center justify-center text-[10px] font-bold font-mono text-white shadow-md border border-white/20 ${badgeBg}`}
                          >
                            {card.cost}
                          </div>
                        )}

                        {/* Indicador de Selecionado */}
                        {isSelected && (
                          <div className="absolute top-1 right-1 size-5 rounded-full bg-sky-400 text-slate-950 flex items-center justify-center shadow-md">
                            <Check className="size-3.5 stroke-[3]" />
                          </div>
                        )}

                        {/* Nome da carta na parte inferior */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-1.5 pt-4">
                          <p className="text-[10px] font-medium text-white truncate drop-shadow">
                            {isSelected ? `✓ ${cardName}` : cardName}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Botões de navegação do carrossel */}
              {filteredCards.length > 5 && (
                <>
                  <button
                    type="button"
                    onClick={() => scrollCarousel("left")}
                    className="absolute left-0 top-1/2 -translate-y-1/2 size-8 bg-slate-950/80 hover:bg-slate-900 border border-white/20 text-white flex items-center justify-center shadow-lg transition-opacity opacity-70 group-hover/carousel:opacity-100"
                    title="Rolar para a esquerda"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCarousel("right")}
                    className="absolute right-0 top-1/2 -translate-y-1/2 size-8 bg-slate-950/80 hover:bg-slate-900 border border-white/20 text-white flex items-center justify-center shadow-lg transition-opacity opacity-70 group-hover/carousel:opacity-100"
                    title="Rolar para a direita"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* SEÇÃO 2: GRID DE CONFIGURAÇÕES (CORES, TIPO DE DECK, PERÍODO, BUSCA E ORDENAÇÃO) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2 border-t border-white/10">
            {/* COLUNA 1: CORES */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1 h-4 bg-sky-400 inline-block" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400">
                  CORES
                </h3>
              </div>

              <div className="space-y-1.5 bg-[#181f28] p-2 border border-white/10 max-h-48 overflow-y-auto">
                {FILTER_COLORS.map((c) => {
                  const active = draftFilters.selectedColors.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleColor(c.id)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs rounded transition-all ${
                        active
                          ? "bg-sky-950/80 border border-sky-500/50 text-white font-semibold"
                          : "bg-transparent text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full border border-black/50"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span>{c.label}</span>
                      </div>
                      {active && <Check className="size-3 text-sky-400" />}
                    </button>
                  );
                })}
              </div>

              {/* Exact Color Match Toggle */}
              <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-slate-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  checked={draftFilters.exactColor}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({ ...prev, exactColor: e.target.checked }))
                  }
                  className="size-4 rounded border-white/20 bg-slate-900 text-sky-500 focus:ring-sky-500"
                />
                <span>Apenas correspondência exata de cor</span>
              </label>
            </div>

            {/* COLUNA 2: TIPO DE DECK */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1 h-4 bg-sky-400 inline-block" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400">
                  TIPO DE DECK
                </h3>
              </div>

              <div
                onClick={() =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    starterDecksOnly: !prev.starterDecksOnly,
                  }))
                }
                className={`p-3 border rounded cursor-pointer transition-all flex items-center gap-2.5 ${
                  draftFilters.starterDecksOnly
                    ? "bg-sky-950/60 border-sky-400 text-white"
                    : "bg-[#181f28] border-white/10 text-slate-300 hover:border-white/30"
                }`}
              >
                <div
                  className={`size-4 rounded border flex items-center justify-center ${
                    draftFilters.starterDecksOnly
                      ? "bg-sky-400 border-sky-400 text-slate-950"
                      : "border-white/30 bg-slate-900"
                  }`}
                >
                  {draftFilters.starterDecksOnly && <Check className="size-3 stroke-[3]" />}
                </div>
                <span className="text-xs font-medium">Apenas Decks Iniciais (Starter Decks)</span>
              </div>
            </div>

            {/* COLUNA 3: PERÍODO */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1 h-4 bg-sky-400 inline-block" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400">
                  PERÍODO
                </h3>
              </div>

              {/* Botão de Recent Decks Only */}
              <div
                onClick={() =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    dateRange: prev.dateRange === "3months" ? "all" : "3months",
                  }))
                }
                className={`p-3 border rounded cursor-pointer transition-all flex items-center gap-2.5 ${
                  draftFilters.dateRange === "3months"
                    ? "bg-sky-950/60 border-sky-400 text-white"
                    : "bg-[#181f28] border-white/10 text-slate-300 hover:border-white/30"
                }`}
              >
                <div
                  className={`size-4 rounded border flex items-center justify-center ${
                    draftFilters.dateRange === "3months"
                      ? "bg-sky-400 border-sky-400 text-slate-950"
                      : "border-white/30 bg-slate-900"
                  }`}
                >
                  {draftFilters.dateRange === "3months" && <Check className="size-3 stroke-[3]" />}
                </div>
                <span className="text-xs font-medium">Apenas Decks Recentes (últimos 3 meses)</span>
              </div>

              {/* Dropdown de Intervalo */}
              <div className="relative">
                <select
                  value={draftFilters.dateRange}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      dateRange: e.target.value as any,
                    }))
                  }
                  className="w-full bg-[#181f28] border border-white/10 rounded-none h-10 px-3 text-xs text-white uppercase tracking-wider cursor-pointer"
                >
                  <option value="all">Todo o período</option>
                  <option value="3months">Últimos 3 meses</option>
                  <option value="6months">Últimos 6 meses</option>
                </select>
              </div>
            </div>

            {/* COLUNA 4: BUSCA E ORDENAÇÃO */}
            <div className="space-y-4">
              {/* BUSCA */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-sky-400 inline-block" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400">
                    BUSCAR POR NOME OU PILOTO
                  </h3>
                </div>
                <Input
                  value={draftFilters.q}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({ ...prev, q: e.target.value }))
                  }
                  placeholder="Buscar decks ou pilotos..."
                  className="bg-[#181f28] border-white/10 text-xs text-white placeholder:text-slate-500 rounded-none h-10"
                />
              </div>

              {/* ORDENAÇÃO */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-sky-400 inline-block" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-400">
                    ORDENAÇÃO
                  </h3>
                </div>
                <select
                  value={draftFilters.sort}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({ ...prev, sort: e.target.value }))
                  }
                  className="w-full bg-[#181f28] border border-white/10 rounded-none h-10 px-3 text-xs text-white uppercase tracking-wider cursor-pointer"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER COM BOTÕES */}
        <div className="p-4 border-t border-white/10 bg-[#0d1015] flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-white rounded-none"
          >
            <RotateCcw className="mr-1.5 size-3.5" /> Limpar Filtros
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-none border-white/15 text-xs text-slate-300 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              className="rounded-none bg-sky-600 hover:bg-sky-500 text-white font-heading uppercase tracking-wider text-xs px-6 py-2 shadow-lg shadow-sky-600/30"
            >
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
