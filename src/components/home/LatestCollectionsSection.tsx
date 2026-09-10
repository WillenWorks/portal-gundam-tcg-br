import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ChevronLeft, ChevronRight, Layers, Package, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type SetItem = {
  id: string;
  code: string;
  namePt?: string | null;
  nameEn: string;
  releaseDate?: string | null;
  _count?: { cards: number };
  coverImage?: string | null;
  setType?: string;
  shortDescription?: string | null;
};

export function LatestCollectionsSection() {
  const [sets, setSets] = useState<SetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    let mounted = true;
    api
      .listSets()
      .then((data: any) => {
        if (!mounted) return;
        const list: SetItem[] = Array.isArray(data) ? data : [];
        // Ordenados por id do último ao primeiro conforme solicitado
        const sorted = [...list].sort((a, b) => String(b.id || "").localeCompare(String(a.id || "")));
        setSets(sorted);
      })
      .catch((err) => {
        console.error("Erro ao listar últimas coleções:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [sets]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = direction === "left" ? -340 : 340;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  const formatSetType = (type?: string) => {
    if (!type) return "EXPANSÃO";
    if (type === "STARTER_DECK") return "STARTER DECK";
    if (type === "BOOSTER_PACK") return "BOOSTER PACK";
    if (type === "PREMIUM_BANDAI") return "PREMIUM BANDAI";
    if (type === "ACCESSORIES") return "ACESSÓRIOS";
    return type.replace(/_/g, " ");
  };

  return (
    <section id="ultimas-colecoes" className="border-t border-white/10 bg-slate-950/60 py-12 sm:py-16">
      <div className="mx-auto max-w-[1760px] px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Cabeçalho da Seção */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="rounded-none border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
                Lançamentos
              </Badge>
              <span className="text-xs text-slate-400 font-mono">Catálogo Oficial</span>
            </div>
            <h2 className="heading-portal font-heading text-3xl sm:text-4xl uppercase mt-2 text-white">
              Últimas Coleções
            </h2>
            <p className="text-soft text-xs sm:text-sm mt-1 max-w-2xl">
              Produtos e expansões oficiais de Gundam TCG ordenados dos mais recentes para os primeiros lançamentos.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Controles de navegação */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scroll("left")}
                disabled={!canScrollLeft}
                aria-label="Rolar coleções para a esquerda"
                className="flex size-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => scroll("right")}
                disabled={!canScrollRight}
                aria-label="Rolar coleções para a direita"
                className="flex size-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <Button asChild variant="outline" className="rounded-none border-white/20 bg-white/5 text-xs uppercase tracking-[0.14em]">
              <Link href="/sets">
                Ver Todas <ArrowRight className="ml-1.5 size-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Lista em linha com produtos */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-4 sm:gap-5 overflow-x-auto pb-4 pt-1 scrollbar-none snap-x snap-mandatory"
        >
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="w-[260px] sm:w-[290px] shrink-0 aspect-[16/11] rounded-xl border border-white/10 bg-slate-900/40 animate-pulse"
              />
            ))
          ) : sets.length === 0 ? (
            <div className="w-full py-12 text-center text-sm text-slate-400">
              Nenhuma coleção encontrada no catálogo.
            </div>
          ) : (
            sets.map((set) => {
              const displayName = set.namePt || set.nameEn;
              const cardCount = set._count?.cards ?? 0;

              return (
                <div
                  key={set.id}
                  className="group relative flex w-[260px] sm:w-[300px] shrink-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-950/80 shadow-xl backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_24px_rgba(6,182,212,0.25)] hover:-translate-y-1 snap-start"
                >
                  {/* Capa do Produto */}
                  <Link
                    href={`/sets/${encodeURIComponent(set.code)}`}
                    className="relative block aspect-[16/10] w-full overflow-hidden bg-slate-900"
                  >
                    {set.coverImage ? (
                      <img
                        src={set.coverImage}
                        alt={displayName}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                        <Package className="size-8 text-slate-600 mb-2 group-hover:text-primary transition-colors" />
                        <span className="font-heading text-2xl uppercase tracking-wider text-slate-300">
                          {set.code}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
                          Sem Capa
                        </span>
                      </div>
                    )}

                    {/* Tag no topo da imagem */}
                    <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
                      <span className="rounded bg-black/80 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300 border border-cyan-500/40 backdrop-blur-md">
                        {set.code}
                      </span>
                    </div>

                    {cardCount > 0 && (
                      <div className="absolute bottom-2.5 right-2.5 z-10">
                        <span className="rounded bg-slate-950/85 px-2 py-0.5 font-mono text-[10px] text-slate-300 border border-white/10">
                          {cardCount} cartas
                        </span>
                      </div>
                    )}

                    {/* Overlay sutil ao passar o mouse */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60 pointer-events-none" />
                  </Link>

                  {/* Detalhes do Produto */}
                  <div className="flex flex-1 flex-col justify-between p-4 border-t border-white/10">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
                        {formatSetType(set.setType)}
                      </p>
                      <h3 className="mt-1 font-heading text-lg uppercase text-white truncate group-hover:text-primary transition-colors">
                        {displayName}
                      </h3>
                      {set.releaseDate && (
                        <p className="text-[11px] text-slate-400 mt-1 font-mono">
                          Lançamento: {new Date(set.releaseDate).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>

                    {/* Ações Rápidas */}
                    <div className="mt-4 flex items-center gap-2 pt-2 border-t border-white/5">
                      <Link
                        href={`/cards?setCode=${encodeURIComponent(set.code)}`}
                        className="flex-1 rounded-none border border-white/15 bg-white/5 px-2.5 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-200 transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                      >
                        Ver Cartas
                      </Link>
                      <Link
                        href={`/sets/${encodeURIComponent(set.code)}`}
                        className="rounded-none border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-primary transition hover:bg-primary hover:text-primary-foreground"
                      >
                        Detalhes
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
