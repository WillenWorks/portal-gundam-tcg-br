/* Detalhe de carta v9 — hero com arte principal, leitura PT/EN e blocos relacionados mais úteis para catálogo real. */
import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

type CardDetail = any;

export default function CardDetailPage() {
  const [, params] = useRoute<{ id: string }>("/cards/:id");
  const [card, setCard] = useState<CardDetail | null>(null);
  const [relatedCards, setRelatedCards] = useState<CardDetail[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!params?.id) return;
      setError("");
      setCard(null);
      setRelatedCards([]);

      try {
        const detail = await api.getCard(params.id);
        if (!active) return;
        setCard(detail);

        const requests: Promise<any[]>[] = [];
        if (detail.trait) requests.push(api.listCards({ trait: detail.trait, sort: "code_asc" }));
        if (detail.series) requests.push(api.listCards({ series: detail.series, sort: "code_asc" }));
        if (detail.set?.code) requests.push(api.listCards({ setCode: detail.set.code, sort: "code_asc" }));

        if (!requests.length) return;

        const batches = await Promise.all(requests);
        if (!active) return;

        const seen = new Set<string>();
        const merged = batches
          .flat()
          .filter((item) => item.id !== detail.id)
          .filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          })
          .slice(0, 6);

        setRelatedCards(merged);
      } catch (err: any) {
        if (!active) return;
        setError(err.message || "Falha ao carregar a carta.");
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [params?.id]);

  const breadcrumbs = useMemo<Array<{ label: string; href?: string }>>(() => {
    if (!card) return [{ label: "Cartas", href: "/cards" }, { label: params?.id || "Detalhe" }];
    const trail: Array<{ label: string; href?: string }> = [{ label: "Cartas", href: "/cards" }];
    if (card.set?.code) trail.push({ label: card.set.code, href: `/sets/${card.set.code}` });
    trail.push({ label: card.code || card.namePt || card.nameEn || "Carta" });
    return trail;
  }, [card, params?.id]);

  const contextualLinks = useMemo(() => {
    if (!card) return [] as Array<{ label: string; href: string }>;

    const links: Array<{ label: string; href: string }> = [];
    const primaryTrait = card.traits?.[0] || card.trait;
    if (card.set?.code) links.push({ label: `Ver coleção ${card.set.code}`, href: `/sets/${card.set.code}` });
    if (primaryTrait) links.push({ label: `Mais cartas da trait ${primaryTrait}`, href: `/cards?trait=${encodeURIComponent(primaryTrait)}` });
    if (card.series || card.sourceTitle) links.push({ label: `Mais cartas da série ${card.series || card.sourceTitle}`, href: `/cards?series=${encodeURIComponent(card.series || card.sourceTitle)}` });
    if (card.keywordTags?.[0]) links.push({ label: `Rulings da keyword ${card.keywordTags[0]}`, href: `/rules?relatedKeyword=${encodeURIComponent(card.keywordTags[0])}` });
    return links.slice(0, 4);
  }, [card]);

  const textSections = useMemo(() => Array.isArray(card?.textSectionsJson) ? card.textSectionsJson.filter((item: any) => item?.textPt || item?.textEn) : [], [card]);
  const stateFlags = useMemo(() => card ? [card.hasBurst && "Burst", card.hasMain && "Main", card.hasAction && "Action", card.oncePerTurn && "Once per turn"].filter(Boolean) : [], [card]);

  return (
    <PublicShell breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6">
            {error ? (
              <p className="text-sm text-red-300">{error}</p>
            ) : !card ? (
              <p className="text-sm text-slate-300">Carregando detalhe da carta...</p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[0.68fr_1.32fr] lg:items-start">
                <div className="overflow-hidden border border-white/10 bg-slate-950/60 aspect-[3/4] dark:bg-slate-950/60 light:bg-slate-100">
                  {(card.imageLargeUrl || card.imageMediumUrl || card.imageUrl) ? (
                    <img src={card.imageLargeUrl || card.imageMediumUrl || card.imageUrl} alt={card.namePt || card.nameEn} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                      <span className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Sem arte vinculada</span>
                      <span className="font-heading text-4xl uppercase text-slate-300 dark:text-slate-300 light:text-slate-700">{card.code}</span>
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{card.color || "Sem cor"}</Badge>
                    <Badge className="rounded-none border border-white/15 bg-white/5 text-slate-200">{card.cardType || "Sem tipo"}</Badge>
                    {card.rarity ? <Badge variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{card.rarity}</Badge> : null}
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-400">Carta individual</p>
                  <h2 className="mt-2 font-heading text-5xl uppercase">{card.namePt || card.nameEn}</h2>
                  <p className="mt-3 text-sm uppercase tracking-[0.18em] text-primary">{card.code}</p>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{textSections[0]?.textPt || textSections[0]?.textEn || card.effectPt || card.effectEn || "Sem texto cadastrado."}</p>
                  {textSections.length > 1 ? <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">{textSections.length} blocos de texto estruturado cadastrados</p> : null}
                  {card.effectPt && card.effectEn && card.effectPt !== card.effectEn && !textSections.length ? (
                    <div className="mt-4 panel-cut border surface-strong p-4 text-sm leading-7 text-slate-300">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Texto EN</p>
                      <p className="mt-2">{card.effectEn}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {card ? (
          <>
            <div className="flex flex-wrap gap-3">
              <Link href="/cards" className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Voltar ao catálogo</Link>
              {contextualLinks.map((item) => (
                <Link key={item.href} href={item.href} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
                <CardContent className="space-y-4 p-5">
                  <h3 className="font-heading text-3xl uppercase">Ficha técnica</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-300 dark:text-slate-300 light:text-slate-700">
                    <div className="panel-cut border surface-strong p-3">Custo: {card.cost ?? "—"}</div>
                    <div className="panel-cut border surface-strong p-3">Level: {card.level ?? "—"}</div>
                    <div className="panel-cut border surface-strong p-3">AP: {card.ap ?? "—"}</div>
                    <div className="panel-cut border surface-strong p-3">HP: {card.hp ?? "—"}</div>
                    <div className="panel-cut border surface-strong p-3">Trait: {(card.traits || []).join(", ") || card.trait || "—"}</div>
                    <div className="panel-cut border surface-strong p-3">Série: {card.series || card.sourceTitle || "—"}</div>
                    <div className="panel-cut border surface-strong p-3">Raridade: {card.rarity || "—"}</div>
                    <div className="panel-cut border surface-strong p-3">Set: {card.set?.code || "—"}</div>
                  </div>
                  <div className="space-y-3 pt-2"><div className="flex flex-wrap gap-2">{card.cardSubtypes?.length ? card.cardSubtypes.map((item: string) => <Badge key={item} variant="outline" className="rounded-none border-white/20 text-slate-300">{item}</Badge>) : <Badge variant="outline" className="rounded-none border-white/20 text-slate-400">sem subtipo</Badge>}</div><div className="flex flex-wrap gap-2">{[...(card.triggerKeywords || []), ...(card.effectKeywords || []), ...stateFlags].length ? [...(card.triggerKeywords || []), ...(card.effectKeywords || []), ...stateFlags].map((keyword: string) => <Link key={keyword} href={`/rules?relatedKeyword=${encodeURIComponent(keyword)}`}><Badge variant="outline" className="cursor-pointer rounded-none border-accent/40 bg-accent/10 text-accent hover:bg-accent/20">{keyword}</Badge></Link>) : <Badge variant="outline" className="rounded-none border-white/20 text-slate-400">sem keyword</Badge>}</div></div>
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
                <CardContent className="space-y-4 p-5">
                  <h3 className="font-heading text-3xl uppercase">Contexto e fontes</h3>
                  <div className="space-y-3 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">
                    <p><span className="text-slate-500">Nome EN:</span> {card.nameEn}</p>
                    <p><span className="text-slate-500">Nome PT:</span> {card.namePt || "—"}</p>
                    <p><span className="text-slate-500">URL oficial:</span> {card.officialUrl ? <a href={card.officialUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">Abrir referência oficial</a> : "—"}</p>
                    <p><span className="text-slate-500">Origem da imagem:</span> {card.imageSourceUrl || "—"}</p>
                    <p><span className="text-slate-500">Set:</span> {card.set ? `${card.set.code} · ${card.set.namePt || card.set.nameEn}` : "—"}</p>
                    <p><span className="text-slate-500">Source title:</span> {card.sourceTitle || "—"}</p>
                    <p><span className="text-slate-500">Pilot name:</span> {card.pilotName || "—"}</p>
                    <p><span className="text-slate-500">Rulings vinculadas:</span> {card.rulings?.length ?? 0}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              {textSections.length ? <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900 xl:col-span-2"><CardContent className="space-y-4 p-5"><h3 className="font-heading text-3xl uppercase">Texto estruturado</h3><div className="grid gap-4 lg:grid-cols-2">{textSections.map((section: any, index: number) => <div key={`${section.kind}-${index}`} className="panel-cut border surface-strong p-4"><div className="flex flex-wrap items-center gap-2"><Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{section.label || section.kind || `Bloco ${index + 1}`}</Badge>{section.kind ? <Badge variant="outline" className="rounded-none border-white/20 text-slate-300">{section.kind}</Badge> : null}</div><p className="mt-3 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{section.textPt || "—"}</p>{section.textEn && section.textEn !== section.textPt ? <div className="mt-3 border-t border-white/10 pt-3 text-sm leading-7 text-slate-400 dark:text-slate-400 light:text-slate-600"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">EN</p><p className="mt-2">{section.textEn}</p></div> : null}</div>)}</div></CardContent></Card> : null}
              <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
                <CardContent className="space-y-4 p-5">
                  <h3 className="font-heading text-3xl uppercase">Rulings relacionadas</h3>
                  {card.rulings?.length ? (
                    card.rulings.map((rule: any) => (
                      <div key={rule.id} className="panel-cut border surface-strong p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{rule.sourceType}</Badge>
                          {rule.relatedKeyword ? <Badge variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{rule.relatedKeyword}</Badge> : null}
                        </div>
                        <h4 className="mt-3 text-2xl uppercase dark:text-white light:text-slate-900">{rule.title}</h4>
                        <p className="mt-3 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{rule.answerPt || rule.questionPt || "Sem resumo cadastrado."}</p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Link href={`/rules/${rule.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir detalhe da ruling</Link>
                          {rule.relatedKeyword ? <Link href={`/rules?relatedKeyword=${encodeURIComponent(rule.relatedKeyword)}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Ver mais dessa keyword</Link> : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Nenhuma ruling vinculada a esta carta ainda.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
                <CardContent className="space-y-4 p-5">
                  <h3 className="font-heading text-3xl uppercase">Cartas relacionadas</h3>
                  {relatedCards.length ? (
                    relatedCards.map((item) => (
                      <div key={item.id} className="panel-cut border surface-strong p-4">
                        <div className="grid gap-4 md:grid-cols-[72px_1fr] md:items-start">
                          <div className="aspect-[3/4] overflow-hidden border border-white/10 bg-slate-950/60 dark:bg-slate-950/60 light:bg-slate-100">
                            {(item.imageSmallUrl || item.thumbUrl || item.imageUrl) ? <img src={item.imageSmallUrl || item.thumbUrl || item.imageUrl} alt={item.namePt || item.nameEn} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.18em] text-slate-500">Sem arte</div>}
                          </div>
                          <div>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.code}</p>
                                <p className="mt-1 text-lg dark:text-white light:text-slate-900">{item.namePt || item.nameEn}</p>
                              </div>
                              <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{item.color || "—"}</Badge>
                            </div>
                            <p className="mt-3 text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">{item.cardType} · trait {item.trait || "—"} · série {item.series || "—"}</p>
                            <div className="mt-4">
                              <Link href={`/cards/${item.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir detalhe</Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Ainda não há cartas relacionadas suficientes por trait, série ou coleção.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </PublicShell>
  );
}
