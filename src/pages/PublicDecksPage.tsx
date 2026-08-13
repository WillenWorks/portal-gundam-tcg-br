/* Decks públicos v9 — busca, ordenação e exportar rápido por deck, além do que já tinha. */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FeaturedCoverImage } from "@/components/deck/FeaturedCoverImage";
import { DECK_MAIN_SIZE, NON_COUNTED_SECTIONS } from "@/lib/deck-legality";
import { api, mapApiCard, type ApiDeck } from "@/lib/api";

const SORT_OPTIONS = [
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "name_asc", label: "Nome A-Z" },
  { value: "name_desc", label: "Nome Z-A" },
] as const;

export default function PublicDecksPage() {
  const [decks, setDecks] = useState<ApiDeck[]>([]);
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(queryDraft), 300);
    return () => window.clearTimeout(timer);
  }, [queryDraft]);

  useEffect(() => {
    setLoading(true);
    api.listPublicDecksPage({ page: 1, pageSize: 24 }, { q: query, sort })
      .then((result) => setDecks(result.items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [query, sort]);

  const exportDeck = async (deck: ApiDeck) => {
    const rows = deck.items
      .filter((item) => item.section !== "resource" && !NON_COUNTED_SECTIONS.has(item.section))
      .map((item) => (item.card ? { ...mapApiCard(item.card), quantity: item.quantity } : null))
      .filter(Boolean) as Array<ReturnType<typeof mapApiCard> & { quantity: number }>;
    if (!rows.length) { toast.error("Deck sem cartas pra exportar."); return; }
    const text = rows.map((row) => `${row.quantity}x ${row.code}`).join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("Decklist copiada (formato MSA/Exburst).");
  };

  return (
    <PublicShell breadcrumbs={[{ label: "Decks Públicos" }]} title="Decks públicos" description="Listas compartilhadas pela comunidade para estudo, referência e comparação de build.">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input value={queryDraft} onChange={(e) => setQueryDraft(e.target.value)} placeholder="Buscar por nome do deck ou autor" className="field-shell sm:max-w-sm" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="field-shell h-10 px-3 text-sm sm:w-56">
          {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>

      {loading ? <p className="text-sm text-muted-portal">Carregando...</p> : !decks.length ? (
        <Card className="panel-cut rounded-none surface-panel"><CardContent className="p-8 text-center text-sm text-muted-portal">Nenhum deck público encontrado{query ? " pra essa busca" : ""}.</CardContent></Card>
      ) : (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {decks.map((deck) => {
          const quantity = deck.items.filter((item) => item.section !== "resource" && !NON_COUNTED_SECTIONS.has(item.section)).reduce((sum, item) => sum + item.quantity, 0);
          return (
            <Card key={deck.id} className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
              <CardContent className="space-y-4 p-4">
                <Link href={`/deck/${deck.shareId}`} className="block overflow-hidden border border-white/10 bg-slate-950/60 aspect-[16/7] dark:bg-slate-950/60 light:bg-slate-100">
                  {deck.coverImage ? <img src={deck.coverImage} alt={deck.name} className="h-full w-full object-cover" /> : <FeaturedCoverImage cards={deck.featuredCards} fallbackLabel="Deck público" />}
                </Link>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{deck.user?.displayName || "Usuário"}</p>
                    <h3 className="mt-2 font-heading text-2xl uppercase leading-none">{deck.name}</h3>
                    <p className="mt-2 text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{deck.createdAt ? new Date(deck.createdAt).toLocaleDateString("pt-BR") : "sem data"}</p>
                  </div>
                  <Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{quantity}/{DECK_MAIN_SIZE}</Badge>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href={`/deck/${deck.shareId}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] transition hover:bg-white/10 dark:text-white light:text-slate-900">Abrir deck</Link>
                  <Button variant="outline" size="icon" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={() => exportDeck(deck)} title="Copiar decklist (MSA/Exburst)"><Copy className="size-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      )}
    </PublicShell>
  );
}
