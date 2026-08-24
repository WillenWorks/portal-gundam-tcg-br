/* Detalhe de carta v10 — relações editoriais confirmadas separadas de recomendações automáticas. */
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Expand, ExternalLink } from "lucide-react";
import { Link, useRoute } from "wouter";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatCardText } from "@/lib/utils";
import { translateRuleTitle } from "@/lib/ruleLabels";
import { normalizeRarityLabel } from "@/lib/rarityLabels";

const RELATION_LABELS: Record<string, string> = {
  PILOT_OF: "Piloto",
  SUPPORTS: "Dá suporte a",
  UPGRADE_OF: "Upgrade de",
  SAME_ARCHETYPE: "Mesmo arquétipo",
  STORY_RELATED: "Relacionado na história",
};
const TYPE_LABELS: Record<string, string> = { UNIT: "Unidade", PILOT: "Piloto", COMMAND: "Comando", COMMAND_PILOT: "Comando", BASE: "Base", RESOURCE: "Recurso", EX_BASE: "Base EX", EX_RESOURCE: "Recurso EX" };

type CardDetail = any;

function MiniCard({ item, eyebrow, detail }: { item: any; eyebrow?: string; detail?: string }) {
  if (!item) return null;
  return <Link href={`/cards/${item.id}`} className="group block panel-cut border surface-strong p-3 transition hover:border-primary/60 hover:bg-primary/[0.06]">
    <div className="grid grid-cols-[58px_1fr] gap-3">
      <div className="aspect-[3/4] overflow-hidden border border-white/10 bg-slate-950/60">{item.imageSmallUrl || item.thumbUrl || item.imageUrl ? <img src={item.imageSmallUrl || item.thumbUrl || item.imageUrl} alt={item.namePt || item.nameEn} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : null}</div>
      <div className="min-w-0">{eyebrow ? <p className="text-[10px] uppercase tracking-[0.18em] text-primary">{eyebrow}</p> : null}<p className="mt-1 truncate text-xs uppercase tracking-[0.14em] text-slate-500">{item.code}</p><p className="mt-1 text-sm font-medium dark:text-white light:text-slate-900">{item.namePt || item.nameEn}</p>{detail ? <p className="mt-1 line-clamp-2 text-xs text-slate-400">{detail}</p> : <p className="mt-1 text-xs text-slate-400">{TYPE_LABELS[item.cardType] || item.cardType} · {item.set?.code || "sem coleção"}</p>}</div>
    </div>
  </Link>;
}

export default function CardDetailPage() {
  const [, params] = useRoute<{ id: string }>("/cards/:id");
  const [card, setCard] = useState<CardDetail | null>(null);
  const [relations, setRelations] = useState<{ outgoing: any[]; incoming: any[] }>({ outgoing: [], incoming: [] });
  const [recommendations, setRecommendations] = useState<CardDetail[]>([]);
  const [error, setError] = useState("");
  const [zoomOpen, setZoomOpen] = useState(false);
  const [selectedPrintId, setSelectedPrintId] = useState<string | null>(null);
  const [cardStats, setCardStats] = useState<Awaited<ReturnType<typeof api.getCardStats>> | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!params?.id) return;
      setCard(null); setRelations({ outgoing: [], incoming: [] }); setRecommendations([]); setError(""); setSelectedPrintId(null); setCardStats(null);
      try {
        const detail = await api.getCard(params.id);
        if (!active) return;
        setCard(detail);
        setSelectedPrintId(detail.printId ?? null);
        const relationRequest = api.getCardRelations(params.id).catch(() => ({ outgoing: [], incoming: [] }));
        // Estatísticas competitivas são "best effort" -- se a rota falhar (ou a carta não
        // tiver amostra), a seção simplesmente não aparece, não é motivo pra bloquear a
        // página inteira (ver getCard acima, que é a única request que realmente importa).
        api.getCardStats(params.id).then((result) => { if (active) setCardStats(result); }).catch(() => { if (active) setCardStats(null); });
        const primaryTrait = detail.traits?.[0] || detail.trait;
        const suggestionRequests: Promise<any[]>[] = [];
        if (primaryTrait) suggestionRequests.push(api.listCards({ trait: primaryTrait, sort: "code_asc" }));
        if (detail.sourceTitle || detail.series) suggestionRequests.push(api.listCards({ media: detail.sourceTitle || detail.series, sort: "code_asc" }));
        if (detail.set?.code) suggestionRequests.push(api.listCards({ setCode: detail.set.code, sort: "code_asc" }));
        const [relationData, ...suggestionData] = await Promise.all([relationRequest, ...suggestionRequests]);
        if (!active) return;
        setRelations(relationData as { outgoing: any[]; incoming: any[] });
        const seen = new Set<string>([detail.id]);
        const uniqueRecs = (suggestionData as any[][]).flat().filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
        setRecommendations(uniqueRecs.slice(0, 6));
      } catch (err: any) { if (active) setError(err.message || "Falha ao carregar a carta."); }
    }
    load(); return () => { active = false; };
  }, [params?.id]);

  const prints: any[] = card?.prints || [];
  const selectedPrint = prints.find((p) => p.id === selectedPrintId) || prints[0] || card;
  const artUrl = selectedPrint?.imageLargeUrl || selectedPrint?.imageMediumUrl || selectedPrint?.imageUrl || "";
  const selectedPrintIndex = Math.max(0, prints.findIndex((p) => p.id === selectedPrint?.id));
  const goToPrint = (offset: number) => {
    if (!prints.length) return;
    const next = (selectedPrintIndex + offset + prints.length) % prints.length;
    setSelectedPrintId(prints[next].id);
  };

  // Relação agora é 1 linha por par de CardModel (sem broadcast por impressão) e o
  // back-end já devolve `relatedCard` pronto (a impressão primária da carta relacionada)
  // — só precisa juntar as duas direções, sem remapear nada.
  const editorialRelations = useMemo(() => [...relations.outgoing, ...relations.incoming].filter((relation) => relation.relatedCard).slice(0, 8), [relations]);
  const breadcrumbs = useMemo(() => [{ label: "Cartas", href: "/cards" }, ...(selectedPrint?.set?.code ? [{ label: selectedPrint.set.code, href: `/sets/${selectedPrint.set.code}` }] : []), { label: selectedPrint?.code || "Detalhe" }], [selectedPrint]);
  const textSections = useMemo(() => Array.isArray(card?.textSectionsJson) ? card.textSectionsJson.filter((item: any) => item?.textPt || item?.textEn) : [], [card]);
  const traitList: string[] = card?.traits?.length ? card.traits : (card?.trait ? [card.trait] : []);
  const mediaValue: string = card?.sourceTitle || card?.series || "";
  // Mesma lógica de agregação de keywords usada no card list (CardsPage) -- trigger +
  // effect + flags booleanos de tipo de habilidade -- pra manter os links consistentes
  // com o que aparece na busca do catálogo.
  const cardKeywords = useMemo(() => {
    if (!card) return [] as string[];
    const flags = [card.hasBurst && "Burst", card.hasMain && "Main", card.hasAction && "Action", card.oncePerTurn && "Once per turn"].filter(Boolean) as string[];
    return Array.from(new Set([...(card.triggerKeywords || []), ...(card.effectKeywords || []), ...flags]));
  }, [card]);

  return <PublicShell breadcrumbs={breadcrumbs}>
    <div className="space-y-6">
      {error ? <Card className="panel-cut border-red-400/40"><CardContent className="p-6 text-red-300">{error}</CardContent></Card> : null}
      {!card && !error ? <Card className="panel-cut surface-panel"><CardContent className="p-6 text-slate-400">Carregando detalhe da carta…</CardContent></Card> : null}
      {card ? <>
        <section className="grid gap-6 lg:grid-cols-[minmax(280px,0.62fr)_minmax(0,1.38fr)]">
          <div className="mx-auto w-full max-w-[460px] space-y-3">
            <button type="button" onClick={() => artUrl && setZoomOpen(true)} className="group relative block w-full overflow-hidden border border-primary/30 bg-slate-950/60 text-left" aria-label="Ampliar imagem da carta">
              <div className="aspect-[63/88]">{artUrl ? <img src={artUrl} alt={card.namePt || card.nameEn} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" /> : <div className="flex h-full items-center justify-center text-sm text-slate-500">Sem arte vinculada</div>}</div>
              {artUrl ? <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 border border-white/20 bg-slate-950/85 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white"><Expand className="size-4" />Ampliar</span> : null}
            </button>
            {prints.length > 1 ? (
              <div className="grid grid-cols-5 gap-2">
                {prints.map((print) => {
                  const thumb = print.imageSmallUrl || print.thumbUrl || print.imageUrl;
                  const active = print.id === selectedPrint?.id;
                  return (
                    <button key={print.id} type="button" onClick={() => setSelectedPrintId(print.id)}
                      className={`aspect-[63/88] overflow-hidden border transition ${active ? "border-primary ring-2 ring-primary/50" : "border-white/15 opacity-70 hover:opacity-100"}`}
                      aria-label={`Ver arte: ${print.printLabel || print.rarity || "impressão"}`} title={print.printLabel || print.rarity || undefined}>
                      {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-slate-950/60 text-[9px] text-slate-500">?</div>}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <Card className="panel-cut rounded-none border-primary/30 hero-surface"><CardContent className="space-y-5 p-6">
            <div className="flex flex-wrap gap-2">
              {card.cardType ? (
                <Link href={`/cards?cardType=${encodeURIComponent(card.cardType === "COMMAND_PILOT" ? "COMMAND" : card.cardType)}`}>
                  <Badge className="cursor-pointer rounded-none border border-primary/40 bg-primary/10 text-primary transition hover:bg-primary/20">{TYPE_LABELS[card.cardType] || card.cardType}</Badge>
                </Link>
              ) : <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{TYPE_LABELS[card.cardType] || card.cardType}</Badge>}
              {card.color ? <Link href={`/cards?color=${encodeURIComponent(card.color)}`}><Badge variant="outline" className="cursor-pointer rounded-none border-white/20 text-slate-300 transition hover:border-primary/60 hover:text-primary">{card.color}</Badge></Link> : <Badge variant="outline" className="rounded-none border-white/20 text-slate-300">Sem cor</Badge>}
              {selectedPrint?.rarity ? (
                <Link href={`/cards?rarity=${encodeURIComponent(normalizeRarityLabel(selectedPrint.rarity))}`}>
                  <Badge variant="outline" className="cursor-pointer rounded-none border-accent/40 bg-accent/10 text-accent transition hover:border-accent hover:bg-accent/20">{normalizeRarityLabel(selectedPrint.rarity)}</Badge>
                </Link>
              ) : null}
              {card.legalityStatus ? <Badge variant="outline" className="rounded-none border-emerald-400/40 bg-emerald-400/10 text-emerald-300">{card.legalityStatus}</Badge> : null}
              {prints.length > 1 ? <Badge variant="outline" className="rounded-none border-white/20 text-slate-400">{prints.length} artes</Badge> : null}
              {card.publicDeckCount ? (
                <Link href="/stats">
                  <Badge variant="outline" className="cursor-pointer rounded-none border-cyan-400/40 bg-cyan-400/10 text-cyan-300 transition hover:border-cyan-400 hover:bg-cyan-400/20">Usada em {card.publicDeckCount} deck{card.publicDeckCount === 1 ? "" : "s"} público{card.publicDeckCount === 1 ? "" : "s"}</Badge>
                </Link>
              ) : null}
            </div>
            <div><p className="text-xs uppercase tracking-[0.26em] text-slate-400">{selectedPrint?.set?.code ? <Link href={`/sets/${selectedPrint.set.code}`} className="hover:text-primary hover:underline">{selectedPrint.set.code}</Link> : "Sem coleção"} · {selectedPrint?.code || card.code}</p><h1 className="mt-2 font-heading text-3xl uppercase leading-none sm:text-4xl lg:text-5xl">{card.namePt || card.nameEn}</h1><p className="mt-3 text-sm text-slate-400">{card.nameEn}{card.namePt ? ` · ${card.namePt}` : ""}</p></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Custo", card.cost], ["Level", card.level], ["AP", card.ap], ["HP", card.hp]].map(([label, value]) => <div key={String(label)} className="border border-white/10 bg-slate-950/40 p-3 light:border-slate-300/80 light:bg-slate-50"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{String(label)}</p><p className="mt-1 font-heading text-3xl dark:text-white light:text-slate-900">{value ?? "—"}</p></div>)}</div>
            <div className="space-y-2 text-sm leading-7 text-slate-300">
              <p>
                <span className="text-slate-500">Traits:</span>{" "}
                {traitList.length ? traitList.map((trait: string, index: number) => (
                  <span key={trait}>
                    {index > 0 ? " · " : ""}
                    <Link href={`/cards?trait=${encodeURIComponent(trait)}`} className="hover:text-primary hover:underline">{trait}</Link>
                  </span>
                )) : "—"}
              </p>
              <p>
                <span className="text-slate-500">Mídia:</span>{" "}
                {mediaValue ? <Link href={`/cards?series=${encodeURIComponent(mediaValue)}`} className="hover:text-primary hover:underline">{mediaValue}</Link> : "—"}
              </p>
              <p><span className="text-slate-500">Link/requisito:</span> {card.linkText || "—"}</p>
            </div>
            {cardKeywords.length ? (
              <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
                {cardKeywords.map((keyword) => (
                  <Link key={keyword} href={`/rules?relatedKeyword=${encodeURIComponent(keyword)}`}>
                    <Badge variant="outline" className="cursor-pointer rounded-none border-accent/40 bg-accent/10 text-accent transition hover:border-accent hover:bg-accent/20">{keyword}</Badge>
                  </Link>
                ))}
              </div>
            ) : null}
            <div className="border-t border-white/10 pt-4"><p className="whitespace-pre-line text-sm leading-7 dark:text-slate-200 light:text-slate-700">{formatCardText(textSections[0]?.textPt || textSections[0]?.textEn || card.effectPt || card.effectEn) || "Sem texto cadastrado."}</p></div>
          </CardContent></Card>
        </section>

        {cardStats?.hasEnoughData ? (
          <section>
            <Card className="panel-cut rounded-none border-cyan-400/30 surface-panel">
              <CardContent className="p-5">
                <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex w-full items-center justify-between gap-4 text-left">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-cyan-400">Estatísticas competitivas</p>
                        <h2 className="mt-1 font-heading text-3xl uppercase">Uso e desempenho</h2>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden text-right sm:block">
                          <p className="text-2xl font-heading text-cyan-300">{cardStats.usageRate ?? "—"}%</p>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">taxa de uso</p>
                        </div>
                        {cardStats.winRate != null ? (
                          <div className="hidden text-right sm:block">
                            <p className="text-2xl font-heading text-emerald-300">{cardStats.winRate}%</p>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">taxa de vitória</p>
                          </div>
                        ) : null}
                        <ChevronDown className={`size-5 shrink-0 text-slate-400 transition-transform ${statsOpen ? "rotate-180" : ""}`} />
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-5 space-y-4 border-t border-white/10 pt-5">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="border border-white/10 bg-slate-950/40 p-3 light:border-slate-300/80 light:bg-slate-50">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Taxa de uso</p>
                        <p className="mt-1 font-heading text-2xl text-cyan-300">{cardStats.usageRate ?? "—"}%</p>
                      </div>
                      <div className="border border-white/10 bg-slate-950/40 p-3 light:border-slate-300/80 light:bg-slate-50">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Taxa de vitória</p>
                        <p className="mt-1 font-heading text-2xl text-emerald-300">{cardStats.winRate ?? "—"}%</p>
                      </div>
                      <div className="border border-white/10 bg-slate-950/40 p-3 light:border-slate-300/80 light:bg-slate-50">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Decks com a carta</p>
                        <p className="mt-1 font-heading text-2xl dark:text-white light:text-slate-900">{cardStats.deckAppearances} <span className="text-sm text-slate-500">/ {cardStats.totalDecks}</span></p>
                      </div>
                      <div className="border border-white/10 bg-slate-950/40 p-3 light:border-slate-300/80 light:bg-slate-50">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">V / E / D</p>
                        <p className="mt-1 font-heading text-2xl dark:text-white light:text-slate-900">{cardStats.wins}V {cardStats.draws}E {cardStats.losses}D</p>
                      </div>
                    </div>
                    <p className="text-xs leading-6 text-slate-500">
                      Calculado a partir de {cardStats.deckAppearances} decklist{cardStats.deckAppearances === 1 ? "" : "s"} reais com essa carta,
                      entre torneios reportados e eventos ao vivo já finalizados (deste total, {cardStats.totalMatches} partida{cardStats.totalMatches === 1 ? "" : "s"} com
                      resultado lançado). Taxa de uso = decks com a carta / {cardStats.totalDecks} decks registrados no total. Amostra pequena — trate como indicativo, não absoluto.
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="panel-cut rounded-none surface-panel"><CardContent className="space-y-4 p-5"><h2 className="font-heading text-3xl uppercase">Relações</h2>{editorialRelations.length ? <div className="grid gap-3">{editorialRelations.map((relation) => <MiniCard key={relation.id} item={relation.relatedCard} eyebrow={RELATION_LABELS[relation.relationType] || relation.relationType} />)}</div> : <p className="text-sm leading-7 text-slate-400">Nenhuma relação confirmada para esta carta ainda.</p>}</CardContent></Card>
          <Card className="panel-cut rounded-none surface-panel"><CardContent className="space-y-4 p-5"><h2 className="font-heading text-3xl uppercase">Mais para explorar</h2><p className="text-xs leading-5 text-slate-500">Sugestões por trait, mídia ou coleção.</p>{recommendations.length ? <div className="grid gap-3">{recommendations.map((item) => <MiniCard key={item.id} item={item} />)}</div> : <p className="text-sm text-slate-400">Ainda não há recomendações suficientes.</p>}</CardContent></Card>
        </section>

        <section>
          <Card className="panel-cut rounded-none surface-panel"><CardContent className="space-y-4 p-5"><h2 className="font-heading text-3xl uppercase">Fontes e rulings</h2><p className="text-sm text-slate-400">Rulings vinculadas a esta impressão: {card.rulings?.length || 0}</p>{card.officialUrl ? <a href={card.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">Abrir referência oficial <ExternalLink className="size-4" /></a> : null}{card.rulings?.length ? <div className="grid gap-2 sm:grid-cols-2">{card.rulings.slice(0, 8).map((rule: any) => <Link key={rule.id} href={`/rules/${rule.id}`} className="block border border-white/10 p-3 text-sm hover:border-primary/50 dark:text-slate-200 light:text-slate-700"><span className="block text-[11px] uppercase tracking-[0.16em] text-slate-500">{translateRuleTitle(rule.title)}</span>{rule.questionPt || rule.title}</Link>)}</div> : <p className="text-sm text-slate-500">Nenhuma ruling vinculada.</p>}</CardContent></Card>
        </section>
      </> : null}
    </div>
    <Dialog open={zoomOpen} onOpenChange={setZoomOpen}><DialogContent aria-describedby={undefined} className="max-h-[96vh] max-w-5xl overflow-auto border-white/10 bg-slate-950 p-3 text-white">
      <DialogTitle className="sr-only">{`Arte ampliada: ${card?.namePt || card?.nameEn || "Carta"}`}</DialogTitle>
      <div className="relative">
        {artUrl ? <img src={artUrl} alt={card?.namePt || card?.nameEn || "Carta"} className="mx-auto max-h-[84vh] w-auto" /> : null}
        {prints.length > 1 ? <>
          <button type="button" onClick={() => goToPrint(-1)} aria-label="Arte anterior" className="absolute left-2 top-1/2 -translate-y-1/2 border border-white/20 bg-slate-950/80 p-2 hover:bg-slate-900"><ChevronLeft className="size-5" /></button>
          <button type="button" onClick={() => goToPrint(1)} aria-label="Próxima arte" className="absolute right-2 top-1/2 -translate-y-1/2 border border-white/20 bg-slate-950/80 p-2 hover:bg-slate-900"><ChevronRight className="size-5" /></button>
          <p className="mt-2 text-center text-xs uppercase tracking-[0.18em] text-slate-400">{selectedPrint?.printLabel || selectedPrint?.rarity || "—"} · {selectedPrintIndex + 1}/{prints.length}</p>
        </> : null}
      </div>
    </DialogContent></Dialog>
  </PublicShell>;
}
