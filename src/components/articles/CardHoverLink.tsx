/* Módulo Editorial — resolve uma referência [[GD01-001]] ou [[Nome da Carta]] detectada no
 * markdown do artigo (ver CardMarkdown.tsx) pra um card real via GET /api/cards?q=, com
 * hovercard de preview (arte + stats) e link direto pro detalhe. Cache local por query
 * evita refazer a mesma busca quando a carta é citada várias vezes no mesmo artigo. */
import { useEffect, useState } from "react";
import { Link } from "wouter";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

type ResolvedCard = { id: string; code: string; namePt?: string | null; nameEn: string; color?: string | null; cardType?: string; cost?: number | null; ap?: number | null; hp?: number | null; imageSmallUrl?: string | null; thumbUrl?: string | null; imageUrl?: string | null } | null;

const resolveCache = new Map<string, Promise<ResolvedCard>>();

function resolveCard(query: string): Promise<ResolvedCard> {
  const key = query.trim().toLowerCase();
  const cached = resolveCache.get(key);
  if (cached) return cached;

  const promise = api.listCards({ q: query, sort: "code_asc" }).then((results) => {
    if (!results.length) return null;
    const exactCode = results.find((c) => c.code?.toLowerCase() === key);
    const exactName = results.find((c) => (c.namePt || c.nameEn)?.toLowerCase() === key || c.nameEn?.toLowerCase() === key);
    return (exactCode || exactName || results[0]) as ResolvedCard;
  }).catch(() => null);

  resolveCache.set(key, promise);
  return promise;
}

export function CardHoverLink({ query, label }: { query: string; label: string }) {
  const [card, setCard] = useState<ResolvedCard>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    resolveCard(query).then((result) => {
      if (!cancelled) {
        setCard(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const badgeClass = "inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[0.85em] uppercase tracking-[0.04em] no-underline transition-colors";

  if (loading) {
    return <span className={`${badgeClass} border-white/15 bg-white/5 text-slate-400`}>{label}</span>;
  }

  if (!card) {
    return (
      <span title="Carta não encontrada no catálogo" className={`${badgeClass} border-red-500/30 bg-red-500/10 text-red-300`}>
        {label}
      </span>
    );
  }

  const image = card.imageSmallUrl || card.thumbUrl || card.imageUrl;
  const displayName = card.namePt || card.nameEn;

  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <Link href={`/cards/${card.id}`} className={`${badgeClass} border-primary/40 bg-primary/10 text-primary hover:bg-primary/20`}>
          {label}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 rounded-none border-white/10 bg-slate-950/98 p-3 text-white">
        <div className="flex gap-3">
          <div className="aspect-[3/4] w-20 shrink-0 overflow-hidden border border-white/10 bg-slate-950/60">
            {image ? <img src={image} alt={displayName} className="h-full w-full object-cover" /> : null}
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{card.code}</p>
            <p className="font-heading text-base uppercase leading-tight">{displayName}</p>
            <div className="flex flex-wrap gap-1.5">
              {card.color ? <Badge className="rounded-none border border-primary/40 bg-primary/10 px-1.5 py-0 text-[10px] text-primary">{card.color}</Badge> : null}
              {card.cost != null ? <Badge variant="outline" className="rounded-none border-white/15 bg-white/5 px-1.5 py-0 text-[10px] text-slate-300">Custo {card.cost}</Badge> : null}
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
