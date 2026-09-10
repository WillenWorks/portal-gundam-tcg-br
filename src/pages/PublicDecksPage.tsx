/* Decks públicos v9.0 (Versão 1.2.0) — catálogo de listas públicas com capas verticais,
 * estatísticas detalhadas de tipos, cores e curvas de custo para cada deck. */
import { useEffect, useState } from "react";
import { PublicShell } from "@/components/layout/PublicShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DeckPreviewCard } from "@/components/deck/DeckPreviewCard";
import { api, type ApiDeck } from "@/lib/api";

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
    api
      .listPublicDecksPage({ page: 1, pageSize: 24 }, { q: query, sort })
      .then((result) => setDecks(result.items))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [query, sort]);

  return (
    <PublicShell
      breadcrumbs={[{ label: "Arsenal Aberto da OZ" }]}
      title="Arsenal Aberto da OZ"
      description="Projetos de decks e formações de combate compartilhados pelos pilotos da comunidade para calibração, estudo e análise de metagame."
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-1 max-w-2xl">
          <Input
            value={queryDraft}
            onChange={(e) => setQueryDraft(e.target.value)}
            placeholder="Buscar por nome do deck ou autor..."
            className="field-shell sm:max-w-md"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="field-shell h-10 px-3 text-xs uppercase tracking-wider sm:w-52"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">
          <div className="mx-auto size-8 border-2 border-primary/40 border-t-primary animate-spin mb-3" />
          <p className="uppercase tracking-[0.2em] text-xs">Carregando listas da comunidade...</p>
        </div>
      ) : !decks.length ? (
        <Card className="panel-cut rounded-none surface-panel">
          <CardContent className="p-12 text-center text-sm text-slate-400">
            <p className="font-heading text-2xl uppercase text-slate-200">Nenhum deck encontrado</p>
            <p className="mt-2 text-xs uppercase tracking-widest text-slate-500">
              {query ? "Tente buscar com outros termos ou filtros" : "Seja o primeiro a publicar um deck público!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {decks.map((deck) => (
            <DeckPreviewCard key={deck.id} deck={deck} />
          ))}
        </div>
      )}
    </PublicShell>
  );
}
