/* Meus decks — listagem pessoal, ponto de entrada pro editor (DeckbuilderPage). */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Plus, Share2, Trash2 } from "lucide-react";

import { api, type ApiDeck } from "@/lib/api";
import { DECK_MAIN_SIZE, NON_COUNTED_SECTIONS } from "@/lib/deck-legality";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FeaturedCoverImage } from "@/components/deck/FeaturedCoverImage";

const VISIBILITY_LABEL: Record<string, string> = { PRIVATE: "Privado", UNLISTED: "Não listado", PUBLIC: "Público" };

export default function DeckListPage() {
  const [, navigate] = useLocation();
  const [decks, setDecks] = useState<ApiDeck[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (options?: { bypassCache?: boolean; silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const result = await api.listMyDecks(options);
      setDecks(result);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  };

  useEffect(() => { load().catch(() => undefined); }, []);

  const removeDeck = async (id: string, name: string) => {
    if (!window.confirm(`Excluir o deck "${name}"? Não tem como desfazer.`)) return;
    try {
      await api.deleteMyDeck(id);
      // Some da lista na hora (não espera o reload) — o reload logo depois é só
      // consistência silenciosa, ignorando o cache HTTP do navegador pra não voltar
      // stale, sem piscar o estado de "carregando" já que a lista já está certa.
      setDecks((current) => current.filter((deck) => deck.id !== id));
      toast.success("Deck excluído.");
      await load({ bypassCache: true, silent: true });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir o deck.");
    }
  };

  const copyShareLink = async (deck: ApiDeck) => {
    const url = `${window.location.origin}${window.location.pathname}#/deck/${deck.shareId}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado.");
  };

  return (
    <PortalShell breadcrumbs={[{ label: "Minha Área", href: "/portal" }, { label: "Decks" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Deckbuilder</p>
              <h1 className="mt-2 font-heading text-4xl uppercase heading-portal">Meus decks</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-soft">Cada deck aqui é um dossiê próprio — capa, legalidade e as duas listas (principal e recursos) ficam dentro do editor.</p>
            </div>
            <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => navigate("/deckbuilder/new")}><Plus className="mr-2 size-4" />Novo deck</Button>
          </CardContent>
        </Card>

        {loading ? <p className="text-sm text-muted-portal">Carregando seus decks...</p> : null}

        {!loading && !decks.length ? (
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-10 text-center">
              <p className="text-lg heading-portal">Nenhum deck criado ainda</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted-portal">Comece um deck novo pra montar sua lista principal (50 cartas) e o deck de recursos (10 cartas) com validação de legalidade em tempo real.</p>
              <Button className="mt-5 rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => navigate("/deckbuilder/new")}><Plus className="mr-2 size-4" />Criar meu primeiro deck</Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {decks.map((deck) => {
            const mainCount = deck.items.filter((item) => item.section !== "resource" && !NON_COUNTED_SECTIONS.has(item.section)).reduce((sum, item) => sum + item.quantity, 0);
            const valid = deck.legality?.valid ?? false;
            return (
              <Card key={deck.id} className="panel-cut overflow-hidden rounded-none surface-panel">
                {/* Altura fixa (não aspect-ratio) — em 1 coluna (mobile), acompanhar a largura
                    toda deixava a capa enorme. Altura fixa fica igual não importa quantas
                    colunas cabem na tela. */}
                <button type="button" onClick={() => navigate(`/deckbuilder/${deck.id}`)} className="block h-52 w-full overflow-hidden border-b border-white/10 bg-slate-950/70 text-left light:border-slate-300/70">
                  {deck.coverImage ? <img src={deck.coverImage} alt={deck.name} className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]" /> : <FeaturedCoverImage cards={deck.featuredCards} className="transition duration-300 hover:scale-[1.03]" />}
                </button>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => navigate(`/deckbuilder/${deck.id}`)} className="text-left text-lg heading-portal hover:text-primary">{deck.name}</button>
                    {deck.isPrimary ? <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">principal</Badge> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-none border-white/20 text-soft">{VISIBILITY_LABEL[deck.visibility] || deck.visibility}</Badge>
                    <Badge variant="outline" className={`rounded-none ${valid ? "border-emerald-400/40 text-emerald-300" : "border-amber-400/40 text-amber-300"}`}>{valid ? "válido" : "pendente"}</Badge>
                  </div>
                  <p className="text-sm text-muted-portal">{mainCount}/{DECK_MAIN_SIZE}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={() => navigate(`/deckbuilder/${deck.id}`)}>Editar</Button>
                    {deck.visibility !== "PRIVATE" ? <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white light:border-slate-400/90 light:bg-white light:text-slate-950" onClick={() => copyShareLink(deck)}><Share2 className="size-4" /></Button> : null}
                    <Button variant="ghost" className="rounded-none text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => removeDeck(deck.id, deck.name)}><Trash2 className="size-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </PortalShell>
  );
}
