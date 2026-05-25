/* Detalhe de carta — leitura individual via API com dados táticos, breadcrumbs completos e navegação relacionada. */
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
    if (card.set?.code) links.push({ label: `Ver coleção ${card.set.code}`, href: `/sets/${card.set.code}` });
    if (card.trait) links.push({ label: `Mais cartas da trait ${card.trait}`, href: `/cards?trait=${encodeURIComponent(card.trait)}` });
    if (card.series) links.push({ label: `Mais cartas da série ${card.series}`, href: `/cards?series=${encodeURIComponent(card.series)}` });
    if (card.keywordTags?.[0]) links.push({ label: `Rulings da keyword ${card.keywordTags[0]}`, href: `/rules?relatedKeyword=${encodeURIComponent(card.keywordTags[0])}` });
    return links.slice(0, 4);
  }, [card]);

  return (
    <PublicShell breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 bg-gradient-to-br from-slate-900 to-cyan-950/20 text-white">
          <CardContent className="p-6">
            {error ? (
              <p className="text-sm text-red-300">{error}</p>
            ) : !card ? (
              <p className="text-sm text-slate-300">Carregando detalhe da carta...</p>
            ) : (
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Carta individual</p>
                  <h2 className="mt-2 font-heading text-5xl uppercase">{card.namePt || card.nameEn}</h2>
                  <p className="mt-3 text-sm uppercase tracking-[0.18em] text-primary">{card.code}</p>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{card.effectPt || card.effectEn || "Sem texto cadastrado."}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{card.color || "Sem cor"}</Badge>
                  <Badge className="rounded-none border border-white/15 bg-white/5 text-slate-200">{card.cardType || "Sem tipo"}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {card ? (
          <>
            <div className="flex flex-wrap gap-3">
              <Link href="/cards" className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Voltar ao catálogo</Link>
              {contextualLinks.map((item) => (
                <Link key={item.href} href={item.href} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-4 p-5">
                  <h3 className="font-heading text-3xl uppercase">Ficha técnica</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                    <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">Custo: {card.cost ?? "—"}</div>
                    <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">Level: {card.level ?? "—"}</div>
                    <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">AP: {card.ap ?? "—"}</div>
                    <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">HP: {card.hp ?? "—"}</div>
                    <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">Trait: {card.trait || "—"}</div>
                    <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">Série: {card.series || "—"}</div>
                    <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">Raridade: {card.rarity || "—"}</div>
                    <div className="panel-cut border border-white/10 bg-slate-950/60 p-3">Set: {card.set?.code || "—"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {card.keywordTags?.length ? (
                      card.keywordTags.map((keyword: string) => (
                        <Link key={keyword} href={`/rules?relatedKeyword=${encodeURIComponent(keyword)}`}>
                          <Badge variant="outline" className="cursor-pointer rounded-none border-accent/40 bg-accent/10 text-accent hover:bg-accent/20">
                            {keyword}
                          </Badge>
                        </Link>
                      ))
                    ) : (
                      <Badge variant="outline" className="rounded-none border-white/20 text-slate-400">sem keyword</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-4 p-5">
                  <h3 className="font-heading text-3xl uppercase">Contexto e fontes</h3>
                  <div className="space-y-3 text-sm leading-7 text-slate-300">
                    <p><span className="text-slate-500">Nome EN:</span> {card.nameEn}</p>
                    <p><span className="text-slate-500">Nome PT:</span> {card.namePt || "—"}</p>
                    <p><span className="text-slate-500">URL oficial:</span> {card.officialUrl ? <a href={card.officialUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">Abrir referência oficial</a> : "—"}</p>
                    <p><span className="text-slate-500">Origem da imagem:</span> {card.imageSourceUrl || "—"}</p>
                    <p><span className="text-slate-500">Set:</span> {card.set ? `${card.set.code} · ${card.set.namePt || card.set.nameEn}` : "—"}</p>
                    <p><span className="text-slate-500">Rulings vinculadas:</span> {card.rulings?.length ?? 0}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-4 p-5">
                  <h3 className="font-heading text-3xl uppercase">Rulings relacionadas</h3>
                  {card.rulings?.length ? (
                    card.rulings.map((rule: any) => (
                      <div key={rule.id} className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{rule.sourceType}</Badge>
                          {rule.relatedKeyword ? <Badge variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{rule.relatedKeyword}</Badge> : null}
                        </div>
                        <h4 className="mt-3 text-2xl uppercase text-white">{rule.title}</h4>
                        <p className="mt-3 text-sm leading-7 text-slate-300">{rule.answerPt || rule.questionPt || "Sem resumo cadastrado."}</p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Link href={`/rules/${rule.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Abrir detalhe da ruling</Link>
                          {rule.relatedKeyword ? <Link href={`/rules?relatedKeyword=${encodeURIComponent(rule.relatedKeyword)}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Ver mais dessa keyword</Link> : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Nenhuma ruling vinculada a esta carta ainda.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="panel-cut rounded-none border-white/10 bg-white/5 text-white">
                <CardContent className="space-y-4 p-5">
                  <h3 className="font-heading text-3xl uppercase">Cartas relacionadas</h3>
                  {relatedCards.length ? (
                    relatedCards.map((item) => (
                      <div key={item.id} className="panel-cut border border-white/10 bg-slate-950/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.code}</p>
                            <p className="mt-1 text-lg text-white">{item.namePt || item.nameEn}</p>
                          </div>
                          <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{item.color || "—"}</Badge>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-slate-300">{item.cardType} · trait {item.trait || "—"} · série {item.series || "—"}</p>
                        <div className="mt-4">
                          <Link href={`/cards/${item.id}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Abrir detalhe</Link>
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
