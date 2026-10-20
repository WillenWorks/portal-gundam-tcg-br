/* Busca global do topo (Ctrl+K / ⌘K ou o botão de lupa): cartas por nome ou código, decks públicos e
 * atalhos para as páginas principais. Busca no servidor com espera de 250 ms entre as teclas; respostas
 * de uma busca antiga não sobrescrevem a atual. */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Command as CommandPrimitive } from "cmdk";
import { FileText, Layers, Search, Swords } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSiteLanguage } from "@/i18n/siteLanguage";
import { useCardLanguage } from "@/i18n/useCardLanguage";

/** Páginas da busca. A busca casa nos dois idiomas (nome em português, em inglês e palavras-chave). */
export const SEARCH_PAGES: Array<{ label: string; labelEn: string; href: string; keywords: string }> = [
  { label: "Catálogo de cartas", labelEn: "Card catalog", href: "/cards", keywords: "cartas database catalogo cards" },
  { label: "Decks públicos", labelEn: "Public decks", href: "/decks", keywords: "decks listas comunidade lists community" },
  { label: "Deckbuilder", labelEn: "Deckbuilder", href: "/deckbuilder", keywords: "montar deck construtor build" },
  { label: "Torneios", labelEn: "Tournaments", href: "/torneios", keywords: "torneios eventos resultados events results" },
  { label: "Estatísticas do meta", labelEn: "Meta stats", href: "/stats", keywords: "estatisticas meta metagame statistics" },
  { label: "Arquétipos", labelEn: "Archetypes", href: "/arquetipos", keywords: "arquetipos meta" },
  { label: "Coleções", labelEn: "Sets", href: "/sets", keywords: "colecoes sets produtos products" },
  { label: "Séries Gundam", labelEn: "Gundam series", href: "/series", keywords: "series obras" },
  { label: "Regras", labelEn: "Rules", href: "/rules", keywords: "regras rulings rules" },
  { label: "Simulador", labelEn: "Simulator", href: "/simulador", keywords: "simulador jogar partida bot play match" },
];

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Páginas cujo nome ou palavras-chave contêm todos os termos digitados (sem acento, sem caixa). */
export function matchSearchPages(term: string) {
  const words = normalize(term).split(/\s+/).filter(Boolean);
  if (words.length === 0) return SEARCH_PAGES;
  return SEARCH_PAGES.filter((page) => {
    const hay = normalize(`${page.label} ${page.labelEn} ${page.keywords}`);
    return words.every((w) => hay.includes(w));
  });
}

type CardHit = { id: string; code: string; nameEn: string; namePt?: string | null };
type DeckHit = { id: string; shareId?: string | null; name: string; user?: { displayName?: string | null; username?: string | null } | null };

/** `shortcut`: registra o Ctrl+K / ⌘K (só uma instância na página deve ter). */
export function GlobalSearch({ className, shortcut = false }: { className?: string; shortcut?: boolean }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [cards, setCards] = useState<CardHit[]>([]);
  const [decks, setDecks] = useState<DeckHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const { tr, isEn } = useSiteLanguage();
  const { isPt: cardsInPt } = useCardLanguage();

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setCards([]);
      setDecks([]);
      setLoading(false);
      return;
    }
    let stale = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      Promise.allSettled([
        api.listCardsPage({ q }, { page: 1, pageSize: 8 }),
        api.listPublicDecksPage({ page: 1, pageSize: 5 }, { q }),
      ]).then(([cardResult, deckResult]) => {
        if (stale) return;
        setCards(cardResult.status === "fulfilled" ? (cardResult.value.items as CardHit[]) : []);
        setDecks(deckResult.status === "fulfilled" ? (deckResult.value.items as DeckHit[]) : []);
        setLoading(false);
      });
    }, 250);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [term]);

  const pages = useMemo(() => matchSearchPages(term), [term]);

  const go = (href: string) => {
    setOpen(false);
    setTerm("");
    navigate(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={tr("Buscar cartas, decks e páginas (Ctrl+K)", "Search cards, decks and pages (Ctrl+K)")}
        title={tr("Buscar (Ctrl+K)", "Search (Ctrl+K)")}
        className={cn(
          "inline-flex h-9 min-w-9 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-2.5 text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white light:border-slate-300 light:bg-white light:text-slate-600",
          className,
        )}
      >
        <Search className="size-4" />
        <span className="hidden 2xl:inline">{tr("Buscar", "Search")}</span>
        <kbd className="hidden rounded border border-white/15 px-1 font-mono text-[10px] text-slate-400 2xl:inline">Ctrl K</kbd>
      </button>

      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setTerm(""); }}>
        <DialogHeader className="sr-only">
          <DialogTitle>{tr("Buscar no AnaheimHub", "Search AnaheimHub")}</DialogTitle>
          <DialogDescription>{tr("Cartas por nome ou código, decks públicos e páginas do site.", "Cards by name or code, public decks and site pages.")}</DialogDescription>
        </DialogHeader>
        <DialogContent className="overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
          <CommandPrimitive shouldFilter={false} className="flex h-full w-full flex-col overflow-hidden bg-popover text-popover-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-item]]:py-2.5">
            <CommandInput value={term} onValueChange={setTerm} placeholder={tr("Nome ou código da carta, nome do deck, página...", "Card name or code, deck name, page...")} />
            <CommandList className="max-h-[60vh]">
              <CommandEmpty>{loading ? tr("Buscando...", "Searching...") : term.trim().length < 2 ? tr("Digite pelo menos 2 letras.", "Type at least 2 letters.") : tr("Nada encontrado.", "Nothing found.")}</CommandEmpty>
              {cards.length > 0 && (
                <CommandGroup heading={tr("Cartas", "Cards")}>
                  {cards.map((card) => (
                    <CommandItem key={card.id} value={`card-${card.id}`} onSelect={() => go(`/cards/${encodeURIComponent(card.id)}`)}>
                      <Layers className="text-muted-foreground" />
                      <span className="font-mono text-xs text-muted-foreground">{card.code}</span>
                      <span>{cardsInPt ? card.namePt || card.nameEn : card.nameEn || card.namePt}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {decks.length > 0 && (
                <CommandGroup heading={tr("Decks públicos", "Public decks")}>
                  {decks.filter((deck) => deck.shareId).map((deck) => (
                    <CommandItem key={deck.id} value={`deck-${deck.id}`} onSelect={() => go(`/deck/${encodeURIComponent(deck.shareId!)}`)}>
                      <Swords className="text-muted-foreground" />
                      <span>{deck.name}</span>
                      {deck.user?.displayName || deck.user?.username ? (
                        <span className="text-xs text-muted-foreground">{tr("de", "by")} {deck.user.displayName || deck.user.username}</span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {pages.length > 0 && (
                <CommandGroup heading={tr("Páginas", "Pages")}>
                  {pages.map((page) => (
                    <CommandItem key={page.href} value={`page-${page.href}`} onSelect={() => go(page.href)}>
                      <FileText className="text-muted-foreground" />
                      <span>{isEn ? page.labelEn : page.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </CommandPrimitive>
        </DialogContent>
      </Dialog>
    </>
  );
}
