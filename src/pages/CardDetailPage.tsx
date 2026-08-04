/* Detalhe de carta v10 — relações editoriais confirmadas separadas de recomendações automáticas. */
import { useEffect, useMemo, useState } from "react";
import { Expand, ExternalLink, X } from "lucide-react";
import { Link, useRoute } from "wouter";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { api } from "@/lib/api";

const RELATION_LABELS: Record<string, string> = {
  PILOT_OF: "Piloto de",
  SUPPORTS: "Dá suporte a",
  UPGRADE_OF: "Upgrade de",
  SAME_ARCHETYPE: "Mesmo arquétipo",
  STORY_RELATED: "Relacionado na história",
};
const TYPE_LABELS: Record<string, string> = { UNIT: "Unidade", PILOT: "Piloto", COMMAND: "Comando", COMMAND_PILOT: "Comando", BASE: "Base", RESOURCE: "Recurso", EX_BASE: "Base EX", EX_RESOURCE: "Recurso EX" };

type CardDetail = any;

function MiniCard({ item, eyebrow, detail }: { item: any; eyebrow: string; detail?: string }) {
  return <Link href={`/cards/${item.id}`} className="group block panel-cut border surface-strong p-3 transition hover:border-primary/60 hover:bg-primary/[0.06]">
    <div className="grid grid-cols-[58px_1fr] gap-3">
      <div className="aspect-[3/4] overflow-hidden border border-white/10 bg-slate-950/60">{item.imageSmallUrl || item.thumbUrl || item.imageUrl ? <img src={item.imageSmallUrl || item.thumbUrl || item.imageUrl} alt={item.namePt || item.nameEn} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : null}</div>
      <div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.18em] text-primary">{eyebrow}</p><p className="mt-1 truncate text-xs uppercase tracking-[0.14em] text-slate-500">{item.code}</p><p className="mt-1 text-sm font-medium dark:text-white light:text-slate-900">{item.namePt || item.nameEn}</p>{detail ? <p className="mt-1 line-clamp-2 text-xs text-slate-400">{detail}</p> : <p className="mt-1 text-xs text-slate-400">{TYPE_LABELS[item.cardType] || item.cardType} · {item.set?.code || "sem coleção"}</p>}</div>
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

  useEffect(() => {
    let active = true;
    async function load() {
      if (!params?.id) return;
      setCard(null); setRelations({ outgoing: [], incoming: [] }); setRecommendations([]); setError("");
      try {
        const detail = await api.getCard(params.id);
        if (!active) return;
        setCard(detail);
        const relationRequest = api.getCardRelations(params.id).catch(() => ({ outgoing: [], incoming: [] }));
        const primaryTrait = detail.traits?.[0] || detail.trait;
        const suggestionRequests: Promise<any[]>[] = [];
        if (primaryTrait) suggestionRequests.push(api.listCards({ trait: primaryTrait, sort: "code_asc" }));
        if (detail.sourceTitle || detail.series) suggestionRequests.push(api.listCards({ media: detail.sourceTitle || detail.series, sort: "code_asc" }));
        if (detail.set?.code) suggestionRequests.push(api.listCards({ setCode: detail.set.code, sort: "code_asc" }));
        const [relationData, ...suggestionData] = await Promise.all([relationRequest, ...suggestionRequests]);
        if (!active) return;
        setRelations(relationData as { outgoing: any[]; incoming: any[] });
        const seen = new Set<string>();
        setRecommendations((suggestionData as any[][]).flat().filter((item) => item.id !== detail.id && !seen.has(item.id) && Boolean(seen.add(item.id))).slice(0, 6));
      } catch (err: any) { if (active) setError(err.message || "Falha ao carregar a carta."); }
    }
    load(); return () => { active = false; };
  }, [params?.id]);

  const artUrl = card?.imageLargeUrl || card?.imageMediumUrl || card?.imageUrl || "";
  const editorialRelations = useMemo(() => [
    ...relations.outgoing.map((relation) => ({ ...relation, direction: "outgoing", relatedCard: relation.targetCard })),
    ...relations.incoming.map((relation) => ({ ...relation, direction: "incoming", relatedCard: relation.sourceCard })),
  ], [relations]);
  const breadcrumbs = useMemo(() => [{ label: "Cartas", href: "/cards" }, ...(card?.set?.code ? [{ label: card.set.code, href: `/sets/${card.set.code}` }] : []), { label: card?.code || "Detalhe" }], [card]);
  const textSections = useMemo(() => Array.isArray(card?.textSectionsJson) ? card.textSectionsJson.filter((item: any) => item?.textPt || item?.textEn) : [], [card]);

  return <PublicShell breadcrumbs={breadcrumbs}>
    <div className="space-y-6">
      {error ? <Card className="panel-cut border-red-400/40"><CardContent className="p-6 text-red-300">{error}</CardContent></Card> : null}
      {!card && !error ? <Card className="panel-cut surface-panel"><CardContent className="p-6 text-slate-400">Carregando detalhe da carta…</CardContent></Card> : null}
      {card ? <>
        <section className="grid gap-6 lg:grid-cols-[minmax(280px,0.62fr)_minmax(0,1.38fr)]">
          <div className="relative mx-auto w-full max-w-[460px]">
            <button type="button" onClick={() => artUrl && setZoomOpen(true)} className="group relative block w-full overflow-hidden border border-primary/30 bg-slate-950/60 text-left" aria-label="Ampliar imagem da carta">
              <div className="aspect-[63/88]">{artUrl ? <img src={artUrl} alt={card.namePt || card.nameEn} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" /> : <div className="flex h-full items-center justify-center text-sm text-slate-500">Sem arte vinculada</div>}</div>
              {artUrl ? <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 border border-white/20 bg-slate-950/85 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white"><Expand className="size-4" />Ampliar</span> : null}
            </button>
          </div>
          <Card className="panel-cut rounded-none border-primary/30 hero-surface"><CardContent className="space-y-5 p-6">
            <div className="flex flex-wrap gap-2"><Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{TYPE_LABELS[card.cardType] || card.cardType}</Badge><Badge variant="outline" className="rounded-none border-white/20 text-slate-300">{card.color || "Sem cor"}</Badge>{card.rarity ? <Badge variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{card.rarity}</Badge> : null}{card.legalityStatus ? <Badge variant="outline" className="rounded-none border-emerald-400/40 bg-emerald-400/10 text-emerald-300">{card.legalityStatus}</Badge> : null}</div>
            <div><p className="text-xs uppercase tracking-[0.26em] text-slate-400">{card.set?.code || "Impressão sem coleção"} · {card.code}</p><h1 className="mt-2 font-heading text-3xl uppercase leading-none sm:text-4xl lg:text-5xl">{card.namePt || card.nameEn}</h1><p className="mt-3 text-sm text-slate-400">{card.nameEn}{card.namePt ? ` · ${card.namePt}` : ""}</p></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Custo", card.cost], ["Level", card.level], ["AP", card.ap], ["HP", card.hp]].map(([label, value]) => <div key={String(label)} className="border border-white/10 bg-slate-950/40 p-3"><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{String(label)}</p><p className="mt-1 font-heading text-3xl">{value ?? "—"}</p></div>)}</div>
            <div className="space-y-2 text-sm leading-7 text-slate-300"><p><span className="text-slate-500">Traits:</span> {(card.traits || []).join(" · ") || card.trait || "—"}</p><p><span className="text-slate-500">Mídia:</span> {card.sourceTitle || card.series || "—"}</p><p><span className="text-slate-500">Link/requisito:</span> {card.linkText || "—"}</p></div>
            <div className="border-t border-white/10 pt-4"><p className="whitespace-pre-line text-sm leading-7 text-slate-200">{textSections[0]?.textPt || textSections[0]?.textEn || card.effectPt || card.effectEn || "Sem texto cadastrado."}</p></div>
          </CardContent></Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="panel-cut rounded-none surface-panel"><CardContent className="space-y-4 p-5"><div><p className="text-xs uppercase tracking-[0.22em] text-primary">Curadoria humana</p><h2 className="font-heading text-3xl uppercase">Relações confirmadas</h2></div>{editorialRelations.length ? <div className="grid gap-3">{editorialRelations.map((relation) => <MiniCard key={`${relation.direction}-${relation.id}`} item={relation.relatedCard} eyebrow={`${RELATION_LABELS[relation.relationType] || relation.relationType}${relation.direction === "incoming" ? " · recebida" : ""}`} detail={relation.notePt || (relation.sourceUrl ? "Possui fonte editorial" : undefined)} />)}</div> : <p className="text-sm leading-7 text-slate-400">Nenhuma relação editorial confirmada para esta impressão ainda.</p>}</CardContent></Card>
          <Card className="panel-cut rounded-none surface-panel"><CardContent className="space-y-4 p-5"><div><p className="text-xs uppercase tracking-[0.22em] text-accent">Descoberta automática</p><h2 className="font-heading text-3xl uppercase">Mais para explorar</h2></div><p className="text-xs leading-5 text-slate-500">Sugestões por trait, mídia ou coleção. Não representam uma relação editorial confirmada.</p>{recommendations.length ? <div className="grid gap-3">{recommendations.map((item) => <MiniCard key={item.id} item={item} eyebrow="Mesmo contexto de catálogo" />)}</div> : <p className="text-sm text-slate-400">Ainda não há recomendações suficientes.</p>}</CardContent></Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="panel-cut rounded-none surface-panel"><CardContent className="space-y-4 p-5"><h2 className="font-heading text-3xl uppercase">Efeitos e texto</h2>{textSections.length ? <div className="grid gap-3">{textSections.map((section: any, index: number) => <div key={`${section.kind}-${index}`} className="border border-white/10 bg-slate-950/30 p-4"><Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{section.label || section.kind || `Bloco ${index + 1}`}</Badge><p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-200">{section.textPt || section.textEn}</p>{section.textEn && section.textPt && section.textEn !== section.textPt ? <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-7 text-slate-400">{section.textEn}</p> : null}</div>)}</div> : <p className="whitespace-pre-line text-sm leading-7 text-slate-200">{card.effectPt || card.effectEn || "Sem texto cadastrado."}</p>}</CardContent></Card>
          <Card className="panel-cut rounded-none surface-panel"><CardContent className="space-y-4 p-5"><h2 className="font-heading text-3xl uppercase">Fontes e rulings</h2><p className="text-sm text-slate-400">Rulings vinculadas a esta impressão: {card.rulings?.length || 0}</p>{card.officialUrl ? <a href={card.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">Abrir referência oficial <ExternalLink className="size-4" /></a> : null}{card.rulings?.length ? <div className="space-y-2">{card.rulings.slice(0, 4).map((rule: any) => <Link key={rule.id} href={`/rules/${rule.id}`} className="block border border-white/10 p-3 text-sm text-slate-200 hover:border-primary/50">{rule.title}</Link>)}</div> : <p className="text-sm text-slate-500">Nenhuma ruling vinculada.</p>}</CardContent></Card>
        </section>
      </> : null}
    </div>
    <Dialog open={zoomOpen} onOpenChange={setZoomOpen}><DialogContent className="max-h-[96vh] max-w-5xl overflow-auto border-white/10 bg-slate-950 p-3"><div className="flex justify-end"><Button type="button" variant="outline" className="rounded-none" onClick={() => setZoomOpen(false)}><X className="size-4" /></Button></div>{artUrl ? <img src={artUrl} alt={card?.namePt || card?.nameEn || "Carta"} className="mx-auto max-h-[84vh] w-auto" /> : null}</DialogContent></Dialog>
  </PublicShell>;
}
