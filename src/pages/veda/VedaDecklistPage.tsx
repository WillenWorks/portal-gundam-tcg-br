import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import {
  BarChart2,
  Calendar,
  Check,
  ChevronLeft,
  Copy,
  ExternalLink,
  Hammer,
  Layers,
  MapPin,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VedaShell } from "@/components/veda/VedaShell";
import { VedaArchetypeBadge } from "@/components/veda/VedaArchetypeBadge";
import { VedaColorPills } from "@/components/veda/VedaColorPills";
import { VedaPlacementBadge } from "@/components/veda/VedaPlacementBadge";
import { VedaPlayerLink } from "@/components/veda/VedaPlayerLink";
import { VedaSourceCredit } from "@/components/veda/VedaSourceCredit";
import { VedaErrorView, VedaLoadingView } from "@/components/veda/VedaStateViews";
import { vedaApi } from "@/lib/veda/api";
import type { VedaDeckCard, VedaDecklist } from "@/lib/veda/types";
import { CARD_TYPE_OPTIONS, normalizeDeckColors, resolveGameColorHex, resolveGameColorLabelPt } from "@/lib/gundam-catalog";

function formatDatePtBr(raw?: string | null): string {
  if (!raw) return "Data não informada";
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return raw;
  }
}

function cardTypeLabel(type: string): string {
  const match = CARD_TYPE_OPTIONS.find((t) => t.value === type);
  return match?.label || type;
}

export default function VedaDecklistPage() {
  const [, params] = useRoute<{ id: string; entryId: string }>("/torneios/:id/lista/:entryId");
  const tournamentId = params?.id ? decodeURIComponent(params.id) : "";
  const entryId = params?.entryId ? decodeURIComponent(params.entryId) : "";
  const [, navigate] = useLocation();

  const [decklist, setDecklist] = useState<VedaDecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const loadDeck = async () => {
    if (!entryId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await vedaApi.getDecklist(entryId);
      setDecklist(result);
    } catch (err: any) {
      setError(err?.message || "Decklist não encontrada ou não informada.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeck();
  }, [entryId]);

  const handleCopyCode = async () => {
    if (!decklist?.deckCode) return;
    try {
      await navigator.clipboard.writeText(decklist.deckCode);
      setCopiedCode(true);
      toast.success("Código da lista copiado para a área de transferência.");
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error("Falha ao copiar o código da lista.");
    }
  };

  const handleSendToDeckbuilder = () => {
    if (!decklist?.deckCode) return;
    navigate(`/deckbuilder/novo?lista=${encodeURIComponent(decklist.deckCode)}`);
  };

  if (loading) {
    return (
      <VedaShell
        breadcrumbs={[
          { label: "Torneios", href: "/torneios" },
          { label: "Carregando decklist..." },
        ]}
      >
        <VedaLoadingView label="Recuperando snapshot imutável da decklist..." />
      </VedaShell>
    );
  }

  if (error || !decklist) {
    return (
      <VedaShell
        breadcrumbs={[
          { label: "Torneios", href: "/torneios" },
          { label: "Decklist não disponível" },
        ]}
      >
        <VedaErrorView
          title="Decklist não encontrada"
          error={error || "Esta inscrição não possui uma decklist registrada ou informada pelo organizador."}
          onRetry={loadDeck}
        />
        <div className="pt-4 flex justify-center">
          <Button variant="outline" asChild className="rounded-none font-mono text-xs uppercase">
            <Link href={tournamentId ? `/torneios/${tournamentId}` : "/torneios"}>
              <ChevronLeft className="mr-1.5 size-3.5" />
              Voltar ao Relatório do Torneio
            </Link>
          </Button>
        </div>
      </VedaShell>
    );
  }

  const hasRegionalLink = Boolean(decklist.tournament.place.uf);
  const regionalUrl = hasRegionalLink
    ? `/metagame/regional?uf=${encodeURIComponent(decklist.tournament.place.uf || "")}${
        decklist.tournament.place.city ? `&cidade=${encodeURIComponent(decklist.tournament.place.city)}` : ""
      }`
    : null;

  // Curva de custo ordenada
  const curveEntries = Object.entries(decklist.curve || {})
    .map(([cost, count]) => ({ cost: parseInt(cost, 10), count }))
    .sort((a, b) => a.cost - b.cost);
  const maxCurveCount = Math.max(1, ...curveEntries.map((c) => c.count));

  return (
    <VedaShell
      breadcrumbs={[
        { label: "Torneios", href: "/torneios" },
        { label: decklist.tournament.name, href: `/torneios/${decklist.tournament.id}` },
        { label: `Deck de ${decklist.player.name}` },
      ]}


    >
      <div className="space-y-6">
        {/* Painel de Cabeçalho da Decklist */}
        <div className="panel-cut border border-primary/30 hero-surface p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <VedaPlacementBadge placement={decklist.placement} placementLabel={decklist.placementLabel} showIcon />
              {decklist.tournament.season && (
                <span className="text-xs font-mono text-slate-300 uppercase bg-white/5 px-2 py-0.5 border border-white/10">
                  {decklist.tournament.season}
                </span>
              )}
              {decklist.record && (
                <span className="text-xs font-mono text-slate-300 px-2 py-0.5 border border-white/10">
                  Placar: <strong className="text-white">{decklist.record}</strong>
                </span>
              )}
            </div>

            <VedaSourceCredit source={decklist.source} sourceUrl={decklist.sourceUrl} />
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-mono uppercase text-slate-400">Piloto:</span>
                <span className="font-heading text-xl sm:text-2xl uppercase text-white">
                  <VedaPlayerLink player={decklist.player} />
                </span>
              </div>

              <div className="flex items-center gap-3 flex-wrap text-sm">
                <span className="text-xs font-mono text-slate-400">Arquétipo:</span>
                {decklist.archetype ? (
                  <VedaArchetypeBadge archetype={decklist.archetype} />
                ) : (
                  <span className="text-xs text-slate-500 font-mono">Não categorizado</span>
                )}
                {decklist.colors && decklist.colors.length > 0 && (
                  <VedaColorPills colors={decklist.colors} size="sm" showLabel />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-1">
                <Link
                  href={`/torneios/${decklist.tournament.id}`}
                  className="hover:text-primary underline decoration-dotted transition-colors font-medium text-slate-300"
                >
                  {decklist.tournament.name}
                </Link>
                <span className="flex items-center gap-1 font-mono">
                  <Calendar className="size-3 text-slate-400" />
                  {formatDatePtBr(decklist.tournament.date)}
                </span>
                {(decklist.tournament.place.store || decklist.tournament.place.city || decklist.tournament.place.uf) && (
                  <span className="flex items-center gap-1 font-mono">
                    <MapPin className="size-3 text-slate-400" />
                    {decklist.tournament.place.store ? `${decklist.tournament.place.store} · ` : ""}
                    {regionalUrl ? (
                      <Link
                        href={regionalUrl}
                        className="hover:text-primary underline decoration-dotted transition-colors"
                      >
                        {decklist.tournament.place.city ? `${decklist.tournament.place.city}, ` : ""}
                        {decklist.tournament.place.uf}
                      </Link>
                    ) : (
                      <span>{decklist.tournament.place.city || decklist.tournament.place.country}</span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Ações de Deckbuilder e Cópia */}
            <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0">
              <Button
                variant="outline"
                onClick={handleCopyCode}
                className="h-9 rounded-none border-white/20 bg-white/5 font-mono text-xs uppercase hover:bg-white/10"
              >
                {copiedCode ? <Check className="mr-1.5 size-3.5 text-emerald-400" /> : <Copy className="mr-1.5 size-3.5" />}
                {copiedCode ? "Copiado!" : "Copiar Código"}
              </Button>

              <Button
                onClick={handleSendToDeckbuilder}
                className="h-9 rounded-none bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider font-bold hover:bg-primary/90"
              >
                <Hammer className="mr-1.5 size-3.5" />
                Copiar para o Deckbuilder
              </Button>
            </div>
          </div>
        </div>

        {/* Linha de Análise Rápida: Curva de Custo & Totais */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Gráfico Tático da Curva de Custos */}
          <div className="panel-cut border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/80 p-4 sm:p-5 lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <BarChart2 className="size-4 text-primary" />
                <h3 className="font-heading text-sm uppercase text-slate-900 dark:text-white">Curva de Custo de Energia</h3>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{decklist.totalCards} cartas registradas</span>
            </div>

            <div className="pt-2 flex items-end justify-between gap-2 h-32 px-2">
              {curveEntries.map((entry) => {
                const heightPercent = Math.max(8, Math.round((entry.count / maxCurveCount) * 100));
                return (
                  <div key={entry.cost} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300 font-bold">{entry.count}</span>
                    <div className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 h-20 flex items-end">
                      <div
                        className="w-full bg-primary/70 hover:bg-primary transition-all border-t border-primary"
                        style={{ height: `${heightPercent}%` }}
                        title={`Custo ${entry.cost}: ${entry.count} cartas`}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">C.{entry.cost}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Distribuição por Cores & Resumo */}
          <div className="panel-cut border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/80 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <h3 className="font-heading text-sm uppercase text-slate-900 dark:text-white">Distribuição por Cores</h3>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {decklist.colors && decklist.colors.length > 0 ? (
                normalizeDeckColors(decklist.colors).map((color) => {
                  const hex = resolveGameColorHex(color, "#3b82f6");
                  return (
                    <div
                      key={color}
                      className="flex items-center justify-between p-2 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full border border-slate-400/80 dark:border-white/40" style={{ backgroundColor: hex }} />
                        <span className="text-xs font-mono uppercase text-slate-900 dark:text-white">{resolveGameColorLabelPt(color) || color}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-300">
                        Cor de Jogo
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-500 font-mono py-4 text-center">Nenhuma cor identificada</p>
              )}
            </div>
          </div>
        </div>

        {/* Grupos de Cartas por Tipo (UNIT, PILOT, COMMAND, BASE, RESOURCE) */}
        <div className="space-y-6">
          {decklist.groups.map((group) => {
            return (
              <div
                key={group.cardType}
                className="panel-cut border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/80 p-4 sm:p-5 space-y-4"
              >
                {/* Cabeçalho do Grupo */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2 bg-primary" />
                    <h3 className="font-heading text-base sm:text-lg uppercase text-slate-900 dark:text-white">
                      {cardTypeLabel(group.cardType)}
                    </h3>
                  </div>
                  <Badge variant="outline" className="border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-300 font-mono text-xs">
                    {group.count} {group.count === 1 ? "carta" : "cartas"}
                  </Badge>
                </div>

                {/* Grade de Cartas do Grupo */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                  {group.cards.map((card: VedaDeckCard, cardIdx: number) => {
                    const cardDisplayName = card.namePt || card.name;
                    const cardTargetId = card.cardModelId || card.code;

                    return (
                      <Link
                        key={`${card.code}-${cardIdx}`}
                        href={`/cards/${encodeURIComponent(cardTargetId)}`}
                        className="group relative block panel-cut border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-900/60 overflow-hidden hover:border-primary transition-all"
                        title={`${cardDisplayName} (${card.code}) - Clique para inspecionar`}
                      >
                        {/* Imagem da Carta */}
                        <div className="relative aspect-[63/88] w-full bg-slate-100 dark:bg-slate-950 overflow-hidden">
                          {card.imageUrl ? (
                            <img
                              src={card.imageUrl}
                              alt={cardDisplayName}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center p-2 text-center text-[10px] uppercase font-mono text-slate-500">
                              {cardDisplayName}
                            </div>
                          )}

                          {/* Badge de Quantidade em Destaque */}
                          <span className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-none bg-primary text-primary-foreground font-mono font-bold text-xs shadow-md border border-white/20">
                            {card.quantity}x
                          </span>

                          {/* Badge de Nível / Custo se existir */}
                          {(card.level !== null || card.cost !== null) && (
                            <div className="absolute top-1 left-1 flex items-center gap-1">
                              {card.cost !== null && (
                                <span className="bg-slate-950/80 px-1 py-0.5 text-[9px] font-mono text-amber-300 border border-white/15">
                                  C.{card.cost}
                                </span>
                              )}
                              {card.level !== null && (
                                <span className="bg-slate-950/80 px-1 py-0.5 text-[9px] font-mono text-cyan-300 border border-white/15">
                                  Lv.{card.level}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Hover Overlay com Link */}
                          <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="p-1.5 bg-slate-950/90 text-white rounded-none border border-white/20">
                              <ExternalLink className="size-3.5 text-primary" />
                            </span>
                          </div>
                        </div>

                        {/* Rótulo inferior da Carta */}
                        <div className="p-2 space-y-0.5 bg-white dark:bg-slate-950/90 border-t border-slate-200 dark:border-white/10">
                          <p className="font-mono text-[10px] text-primary truncate">{card.code}</p>
                          <p className="text-xs text-slate-800 dark:text-slate-200 truncate font-medium">{cardDisplayName}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </VedaShell>
  );
}
