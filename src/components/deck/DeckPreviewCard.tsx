/* DeckPreviewCard v9.0 — visualização de deck com capa vertical e estatísticas completas
 * (cores, composição de tipos, custo médio e curva), elevando a qualidade visual da plataforma. */
import { useMemo } from "react";
import { Link } from "wouter";
import { Copy, Eye, Flame, Heart, Layers } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeaturedCoverImage } from "@/components/deck/FeaturedCoverImage";
import { DECK_MAIN_SIZE, NON_COUNTED_SECTIONS } from "@/lib/deck-legality";
import { mapApiCard, type ApiDeck } from "@/lib/api";
import { GAME_COLOR_HEX } from "@/lib/gundam-catalog";
import { calculateDeckCostLevelCurve } from "@/lib/deck-level-stats";

interface DeckPreviewCardProps {
  deck: ApiDeck;
  isOwner?: boolean;
  onDelete?: (id: string, name: string) => void;
}

export function DeckPreviewCard({ deck, isOwner }: DeckPreviewCardProps) {
  const stats = useMemo(() => {
    const items = deck.items || [];
    const mainItems = items.filter(
      (item) => item.section !== "resource" && !NON_COUNTED_SECTIONS.has(item.section)
    );

    let units = 0;
    let pilots = 0;
    let commands = 0;
    let bases = 0;
    let totalCards = 0;
    const colors = new Set<string>();

    for (const item of mainItems) {
      const card = item.card;
      const qty = item.quantity || 1;
      totalCards += qty;

      if (card) {
        if (card.color) colors.add(card.color);
        const t = (card.cardType || "").toUpperCase();
        if (t === "UNIT") units += qty;
        else if (t === "PILOT") pilots += qty;
        else if (t === "COMMAND") commands += qty;
        else if (t === "BASE") bases += qty;
      }
    }

    const { avgCostLevel, curve, maxCurveVal } = calculateDeckCostLevelCurve(mainItems);

    return {
      totalCards,
      units,
      pilots,
      commands,
      bases,
      colors: Array.from(colors),
      avgCost: avgCostLevel,
      curve,
      maxCurveVal,
    };
  }, [deck.items]);

  const exportDeck = async () => {
    const rows = (deck.items || [])
      .filter((item) => item.section !== "resource" && !NON_COUNTED_SECTIONS.has(item.section))
      .map((item) => (item.card ? { ...mapApiCard(item.card), quantity: item.quantity } : null))
      .filter(Boolean) as Array<ReturnType<typeof mapApiCard> & { quantity: number }>;

    if (!rows.length) {
      toast.error("Deck sem cartas para exportar.");
      return;
    }
    const text = rows.map((row) => `${row.quantity}x ${row.code}`).join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("Decklist copiada no formato MSA/Exburst.");
  };

  const deckLink = isOwner ? `/deckbuilder/${deck.id}` : `/deck/${deck.shareId}`;

  return (
    <Card className="panel-cut flex flex-col overflow-hidden rounded-none border border-white/10 surface-panel transition duration-200 hover:border-primary/40 dark:text-white light:text-slate-900">
      <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] md:grid-cols-[140px_1fr] lg:grid-cols-[140px_1fr] flex-1">
        {/* Capa Vertical Portrait (Proporção de carta de TCG) */}
        <Link
          href={deckLink}
          className="group relative block aspect-[3/4] sm:aspect-auto sm:h-full w-full overflow-hidden border-b sm:border-b-0 sm:border-r border-white/10 bg-slate-950/80"
          title={`Ver deck: ${deck.name}`}
        >
          {deck.coverImage ? (
            <img
              src={deck.coverImage}
              alt={deck.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <FeaturedCoverImage
              cards={deck.featuredCards}
              fallbackLabel="Deck Asticassia"
              className="transition-transform duration-300 group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-primary/10 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[0.65rem] uppercase tracking-wider text-slate-300 drop-shadow-md">
            <span className="font-mono bg-slate-950/80 px-1.5 py-0.5 border border-white/10">
              {stats.totalCards}/{DECK_MAIN_SIZE}
            </span>
          </div>
        </Link>

        {/* Informações & Estatísticas do Deck */}
        <CardContent className="flex flex-col justify-between p-4 space-y-3">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.7rem] uppercase tracking-[0.2em] text-slate-400">
                  {deck.user?.displayName || "Piloto"}
                </p>
                <Link
                  href={deckLink}
                  className="mt-0.5 block truncate font-heading text-xl uppercase leading-tight hover:text-primary transition-colors"
                  title={deck.name}
                >
                  {deck.name}
                </Link>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                  <span>{deck.createdAt ? new Date(deck.createdAt).toLocaleDateString("pt-BR") : "Data indisponível"}</span>
                  {typeof deck.viewCount === "number" ? (
                    <span className="flex items-center gap-1 text-[0.7rem] text-slate-400 font-mono" title="Visualizações">
                      <Eye className="size-3 text-slate-400" />
                      {deck.viewCount}
                    </span>
                  ) : null}
                  {typeof deck.likeCount === "number" ? (
                    <span className="flex items-center gap-1 text-[0.7rem] text-rose-400 font-mono" title="Curtidas">
                      <Heart className="size-3 fill-rose-500/20 text-rose-400" />
                      {deck.likeCount}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Badges de Cores */}
              <div className="flex items-center gap-1 shrink-0">
                {stats.colors.map((color) => {
                  const hex = GAME_COLOR_HEX[color] || "#64748b";
                  return (
                    <span
                      key={color}
                      className="inline-block size-3 rounded-full border border-black/40 shadow-sm"
                      style={{ backgroundColor: hex }}
                      title={`Cor: ${color}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Divisão por tipos */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[0.7rem] font-medium">
              <Badge variant="outline" className="rounded-none border-blue-500/30 bg-blue-950/20 text-blue-300 px-1.5 py-0">
                {stats.units} MS
              </Badge>
              <Badge variant="outline" className="rounded-none border-amber-500/30 bg-amber-950/20 text-amber-300 px-1.5 py-0">
                {stats.pilots} Pilotos
              </Badge>
              <Badge variant="outline" className="rounded-none border-emerald-500/30 bg-emerald-950/20 text-emerald-300 px-1.5 py-0">
                {stats.commands} Cmd
              </Badge>
              {stats.bases > 0 ? (
                <Badge variant="outline" className="rounded-none border-purple-500/30 bg-purple-950/20 text-purple-300 px-1.5 py-0">
                  {stats.bases} Base
                </Badge>
              ) : null}
            </div>

            {/* Mini Curva de Custo & Custo Médio */}
            <div className="mt-3 border-t border-white/10 pt-2.5">
              <div className="flex items-center justify-between text-[0.68rem] text-slate-400 mb-1">
                <span>Curva Custo / Nível (1-7+)</span>
                <span className="font-mono text-primary font-semibold">Méd: {stats.avgCost}</span>
              </div>
              <div className="flex items-end gap-1 h-7 pt-1">
                {[1, 2, 3, 4, 5, 6, 7].map((cost) => {
                  const val = stats.curve[cost] || 0;
                  const pct = Math.round((val / stats.maxCurveVal) * 100);
                  return (
                    <div key={cost} className="flex-1 flex flex-col items-center gap-0.5" title={`Custo ${cost}: ${val} cartas`}>
                      <div className="w-full bg-slate-800/80 rounded-none h-5 flex items-end">
                        <div
                          className="w-full bg-primary/70 hover:bg-primary transition-all"
                          style={{ height: `${Math.max(pct, val > 0 ? 15 : 0)}%` }}
                        />
                      </div>
                      <span className="text-[0.6rem] font-mono text-slate-500 leading-none">{cost}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex-1 rounded-none border-white/15 bg-white/5 text-xs uppercase tracking-[0.14em] hover:bg-white/10"
            >
              <Link href={deckLink}>
                <Eye className="mr-1.5 size-3.5" />
                Abrir
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-none border-white/15 bg-white/5 size-8 text-white hover:text-primary"
              onClick={exportDeck}
              title="Copiar decklist (formato MSA)"
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
