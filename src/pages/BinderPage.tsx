/* Binder page v9 — pasta compartilhável (wishlist/possuídas), reaproveitando a mesma
 * arquitetura provada no deckbuilder: cache por impressão (não por modelo — o mesmo bug
 * que existia no deckbuilder antes do Pacote B1 existia aqui também), pool com imagem
 * e paginação de verdade, seletor de arte específica por carta. */
import { useEffect, useMemo, useState } from "react";
import { Copy, Eye, Images as ImagesIcon, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { api, mapApiCard, type CardFilters } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CARD_TYPE_OPTIONS, groupCardsByType } from "@/lib/gundam-catalog";
import type { CardRecord } from "@/modules/core/types";

type PoolFilters = Pick<CardFilters, "q" | "color" | "cardType" | "series" | "trait">;
const defaultPoolFilters: PoolFilters = { q: "", color: "", cardType: "", series: "", trait: "" };
type PoolMeta = { colors: string[]; cardTypes: string[]; series: string[]; traits: string[] };
type BinderEntry = { printId: string; quantity: number };

/** Tile de carta na pool — clique adiciona a impressão principal direto (igual o
 *  deckbuilder), botão de galeria no canto pra escolher uma arte específica — pra um
 *  binder, "qual arte exata eu tenho/quero" importa mais do que num deck. */
function PoolCardTile({ card, quantity, onAdd, onOpenGallery }: { card: CardRecord; quantity: number; onAdd: (card: CardRecord) => void; onOpenGallery: (modelId: string) => void }) {
  const image = card.imageMediumUrl || card.imageUrl;
  return (
    <div className="group relative">
      <button type="button" onClick={() => onAdd(card)} title={`Adicionar ${card.namePt || card.name}`} className="relative block aspect-[63/88] w-full overflow-hidden border border-white/15 transition group-hover:border-primary/60">
        {image ? <img src={image} alt={card.namePt || card.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.05]" /> : <div className="flex h-full items-center justify-center bg-slate-950/80 p-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">{card.namePt || card.name}</div>}
        {quantity > 0 ? <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{quantity}</span> : null}
        <div className="absolute inset-x-0 bottom-0 bg-slate-950/90 p-1.5 text-left">
          <p className="truncate text-[11px] font-medium text-white">{card.namePt || card.name}</p>
        </div>
      </button>
      <button type="button" onClick={() => onOpenGallery(card.id)} title="Escolher arte específica" className="absolute left-1 top-1 flex size-6 items-center justify-center rounded-full bg-slate-950/80 text-white opacity-100 transition hover:bg-primary hover:text-primary-foreground lg:opacity-0 lg:group-hover:opacity-100">
        <ImagesIcon className="size-3.5" />
      </button>
    </div>
  );
}

/** Tile de item já no binder — clicar remove uma unidade (simétrico à pool, que
 *  adiciona), botão de olho abre a imagem grande. */
function BinderItemTile({ row, onDecrement, onPreview }: { row: CardRecord & { quantity: number }; onDecrement: (printId: string) => void; onPreview: (card: CardRecord) => void }) {
  const image = row.imageMediumUrl || row.imageUrl;
  const printId = row.printId || row.id;
  return (
    <div className="group relative">
      <button type="button" onClick={() => onDecrement(printId)} title={`Remover 1 de ${row.namePt || row.name}`} className="relative block aspect-[63/88] w-full overflow-hidden border border-white/15 transition group-hover:border-red-400/50">
        {image ? <img src={image} alt={row.namePt || row.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-slate-950/80 p-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">{row.namePt || row.name}</div>}
        <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{row.quantity}</span>
      </button>
      <button type="button" onClick={() => onPreview(row)} title="Ver imagem grande" className="absolute left-1 top-1 flex size-6 items-center justify-center rounded-full bg-slate-950/80 text-white opacity-100 transition hover:bg-white/20 lg:opacity-0 lg:group-hover:opacity-100">
        <Eye className="size-3.5" />
      </button>
    </div>
  );
}

/** Modal de galeria — mostra todas as impressões da carta, cada uma com seu próprio
 *  +/-. Sem limite de cópia (diferente do deckbuilder) — um binder pode ter qualquer
 *  quantidade de qualquer arte, é inventário/desejo, não deckbuilding. */
function PrintPickerModal({ modelId, onClose, entries, onIncrement, onDecrement }: { modelId: string | null; onClose: () => void; entries: BinderEntry[]; onIncrement: (card: CardRecord) => void; onDecrement: (printId: string) => void }) {
  const [prints, setPrints] = useState<CardRecord[] | null>(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!modelId) { setPrints(null); return; }
    let active = true;
    setPrints(null);
    api.getCard(modelId).then((data) => {
      if (!active) return;
      setLabel(data.namePt || data.nameEn || "");
      const modelFields = { cardModelId: modelId, nameEn: data.nameEn, namePt: data.namePt, cardType: data.cardType, color: data.color, cost: data.cost, level: data.level, ap: data.ap, hp: data.hp, trait: data.trait, series: data.series, sourceTitle: data.sourceTitle, keywordTags: data.keywordTags, effectPt: data.effectPt, effectEn: data.effectEn };
      setPrints((data.prints || []).map((print: any) => mapApiCard({ ...print, ...modelFields })));
    }).catch(() => { if (active) setPrints([]); });
    return () => { active = false; };
  }, [modelId]);

  if (!modelId) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl lg:max-w-4xl border-white/10 bg-slate-950 text-white">
        <div className="border-b border-white/10 pb-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Galeria de arte</p>
          <h3 className="font-heading text-2xl uppercase heading-portal">{label || "Carregando…"}</h3>
        </div>
        {!prints ? <p className="py-8 text-center text-sm text-muted-portal">Carregando impressões...</p> : !prints.length ? <p className="py-8 text-center text-sm text-muted-portal">Não achei impressões dessa carta.</p> : (
          <div className="grid max-h-[65vh] grid-cols-2 gap-4 overflow-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
            {prints.map((print) => {
              const printId = print.printId || print.id;
              const quantity = entries.filter((entry) => entry.printId === printId).reduce((sum, entry) => sum + entry.quantity, 0);
              const image = print.imageMediumUrl || print.imageUrl;
              return (
                <div key={printId} className="border border-white/10 bg-slate-900/60 p-2.5">
                  <div className="aspect-[63/88] overflow-hidden border border-white/10 bg-slate-950/70">{image ? <img src={image} alt={print.namePt || print.name} className="h-full w-full object-cover" /> : null}</div>
                  <p className="mt-2 truncate text-[11px] text-slate-400">{print.code}</p>
                  <div className="mt-2 flex items-center justify-center gap-2.5">
                    <button type="button" onClick={() => onDecrement(printId)} disabled={quantity <= 0} className="flex size-8 shrink-0 items-center justify-center rounded-none border border-white/15 bg-white/5 text-white transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"><Minus className="size-4" /></button>
                    <span className="w-6 shrink-0 text-center text-sm font-bold">{quantity}</span>
                    <button type="button" onClick={() => onIncrement(print)} className="flex size-8 shrink-0 items-center justify-center rounded-none bg-primary text-primary-foreground transition hover:bg-primary/90"><Plus className="size-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CardPreviewModal({ card, onClose }: { card: CardRecord | null; onClose: () => void }) {
  if (!card) return null;
  const image = card.imageLargeUrl || card.imageMediumUrl || card.imageUrl;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-white/10 bg-slate-950 text-white">
        <div className="overflow-hidden border border-white/10 bg-slate-950/70">{image ? <img src={image} alt={card.namePt || card.name} className="w-full" /> : null}</div>
        <p className="text-sm text-soft">{card.namePt || card.name} · {card.code}</p>
      </DialogContent>
    </Dialog>
  );
}

export default function BinderPage({ kind }: { kind: "WISHLIST" | "OWNED" }) {
  const { isAuthenticated } = useAuth();
  const pageTitle = kind === "WISHLIST" ? "Lista de desejos" : "Cartas possuídas";

  const [shareId, setShareId] = useState<string | null>(null);
  const [name, setName] = useState(pageTitle);
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [entries, setEntries] = useState<BinderEntry[]>([]);
  const [cardCache, setCardCache] = useState<Record<string, CardRecord>>({});
  const [loadingBinder, setLoadingBinder] = useState(true);
  const [saving, setSaving] = useState(false);

  const [poolFilters, setPoolFilters] = useState<PoolFilters>(defaultPoolFilters);
  const [poolQueryDraft, setPoolQueryDraft] = useState("");
  const [poolMeta, setPoolMeta] = useState<PoolMeta>({ colors: [], cardTypes: [], series: [], traits: [] });
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [loadingPool, setLoadingPool] = useState(true);
  const [poolPage, setPoolPage] = useState(1);
  const [poolTotal, setPoolTotal] = useState(0);
  const [poolTotalPages, setPoolTotalPages] = useState(1);
  const poolPageSize = 24;

  const [altArtModelId, setAltArtModelId] = useState<string | null>(null);
  const [previewCard, setPreviewCard] = useState<CardRecord | null>(null);

  const cacheCards = (records: CardRecord[]) => {
    setCardCache((current) => {
      const next = { ...current };
      for (const record of records) if (record.printId) next[record.printId] = record;
      return next;
    });
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingBinder(true);
    api.listMyBinders().then((result) => {
      const current = result.find((item) => item.kind === kind);
      if (current) {
        setShareId(current.shareId);
        setName(current.name);
        setDescription(current.description || "");
        setIsPublic(current.isPublic);
        const mapped = current.items.map((item) => mapApiCard(item.card));
        cacheCards(mapped);
        setEntries(current.items.map((item) => ({ printId: item.cardId, quantity: item.quantity })));
      }
    }).catch(() => undefined).finally(() => setLoadingBinder(false));
  }, [isAuthenticated, kind]);

  useEffect(() => {
    api.getCardFilters().then(setPoolMeta).catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPoolFilters((current) => (current.q === poolQueryDraft ? current : { ...current, q: poolQueryDraft }));
      setPoolPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [poolQueryDraft]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingPool(true);
    api.listCardsPage({ ...poolFilters, sort: "code_asc" }, { page: poolPage, pageSize: poolPageSize })
      .then((result) => {
        const mapped = result.items.map(mapApiCard);
        setCards(mapped);
        cacheCards(mapped);
        setPoolTotal(result.total);
        setPoolTotalPages(result.totalPages);
      })
      .finally(() => setLoadingPool(false));
  }, [isAuthenticated, poolFilters, poolPage]);

  const setPoolFilter = (key: keyof PoolFilters, value: string) => {
    setPoolFilters((current) => ({ ...current, [key]: value }));
    setPoolPage(1);
  };

  const rows = useMemo(
    () => entries.map((entry) => {
      const card = cardCache[entry.printId];
      return card ? { ...card, quantity: entry.quantity } : null;
    }).filter(Boolean) as Array<CardRecord & { quantity: number }>,
    [entries, cardCache],
  );

  const quantityByModel = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.cardModelId || row.id, (map.get(row.cardModelId || row.id) || 0) + row.quantity);
    return map;
  }, [rows]);

  const totals = useMemo(() => ({ unique: rows.length, quantity: rows.reduce((sum, r) => sum + r.quantity, 0) }), [rows]);
  const [itemsViewMode, setItemsViewMode] = useState<"grid" | "type">("grid");
  const groupedRows = useMemo(() => groupCardsByType(rows), [rows]);

  const increment = (card: CardRecord) => {
    const printId = card.printId || card.id;
    cacheCards([card]);
    setEntries((current) => {
      const found = current.find((e) => e.printId === printId);
      if (found) return current.map((e) => (e.printId === printId ? { ...e, quantity: e.quantity + 1 } : e));
      return [...current, { printId, quantity: 1 }];
    });
  };

  const decrement = (printId: string) => {
    setEntries((current) => current.map((e) => (e.printId === printId ? { ...e, quantity: e.quantity - 1 } : e)).filter((e) => e.quantity > 0));
  };

  const saveBinder = async () => {
    setSaving(true);
    try {
      const items = entries.filter((e) => e.quantity > 0).map((e) => ({ cardId: e.printId, quantity: e.quantity }));
      const updated = await api.updateMyBinder(kind, { name, description, isPublic, items });
      setShareId(updated.shareId);
      toast.success(`${pageTitle} salva.`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareId) { toast.error("Salva a pasta primeiro pra gerar o link."); return; }
    await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#/binder/${shareId}`);
    toast.success("Link compartilhável copiado.");
  };

  return (
    <PortalShell breadcrumbs={[{ label: pageTitle }]}>
      {loadingBinder ? <p className="text-sm text-muted-portal">Carregando...</p> : (
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="space-y-3">
                <Input value={name} onChange={(e) => setName(e.target.value)} className="field-shell font-heading text-xl uppercase heading-portal" />
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="field-shell min-h-20" placeholder="Descrição pública opcional" />
                <label className="flex items-center gap-3 text-sm text-soft">
                  <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Compartilhar publicamente
                </label>
              </div>
              <div className="flex flex-col justify-between gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="panel-cut border surface-strong p-3"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Itens únicos</p><p className="mt-1 font-heading text-3xl">{totals.unique}</p></div>
                  <div className="panel-cut border surface-strong p-3"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Quantidade</p><p className="mt-1 font-heading text-3xl">{totals.quantity}</p></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveBinder} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
                  <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white" onClick={copyShareLink}><Copy className="mr-2 size-4" />Link</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-portal">Base do catálogo</p>
              <h3 className="mt-2 font-heading text-3xl uppercase heading-portal">Adicionar cartas</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Input value={poolQueryDraft} onChange={(e) => setPoolQueryDraft(e.target.value)} placeholder="Nome, código, série ou trait" className="field-shell sm:col-span-2" />
                <select value={poolFilters.color} onChange={(e) => setPoolFilter("color", e.target.value)} className="field-shell h-10 px-3 text-sm"><option value="">Todas as cores</option>{poolMeta.colors.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                <select value={poolFilters.cardType} onChange={(e) => setPoolFilter("cardType", e.target.value)} className="field-shell h-10 px-3 text-sm"><option value="">Todos os tipos</option>{poolMeta.cardTypes.map((c) => <option key={c} value={c}>{CARD_TYPE_OPTIONS.find((opt) => opt.value === c)?.label || c}</option>)}</select>
              </div>
              <Badge variant="outline" className="mt-4 rounded-none border-white/20 text-soft">{poolTotal} cartas encontradas</Badge>
              <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 xl:grid-cols-5">
                {loadingPool ? <p className="col-span-full text-sm text-muted-portal">Carregando...</p> : null}
                {!loadingPool && !cards.length ? <p className="col-span-full text-sm text-muted-portal">Nenhuma carta encontrada.</p> : null}
                {cards.map((card) => <PoolCardTile key={card.id} card={card} quantity={quantityByModel.get(card.id) || 0} onAdd={increment} onOpenGallery={setAltArtModelId} />)}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Página {poolPage} de {poolTotalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:text-white disabled:opacity-40" disabled={poolPage <= 1} onClick={() => setPoolPage((p) => Math.max(1, p - 1))}>Anterior</Button>
                  <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white hover:text-white disabled:opacity-40" disabled={poolPage >= poolTotalPages} onClick={() => setPoolPage((p) => Math.min(poolTotalPages, p + 1))}>Próxima</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="panel-cut rounded-none surface-panel">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-heading text-3xl uppercase heading-portal">{pageTitle}</h3>
                <div className="flex border border-white/15">
                  <button type="button" onClick={() => setItemsViewMode("grid")} className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition ${itemsViewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-white/5 text-soft hover:bg-white/10"}`}>Grade única</button>
                  <button type="button" onClick={() => setItemsViewMode("type")} className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition ${itemsViewMode === "type" ? "bg-primary text-primary-foreground" : "bg-white/5 text-soft hover:bg-white/10"}`}>Por tipo</button>
                </div>
              </div>
              {!rows.length ? (
                <p className="mt-6 text-sm text-muted-portal">Ainda vazio — adiciona cartas pela pool ao lado.</p>
              ) : itemsViewMode === "grid" ? (
                <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-6 xl:grid-cols-7">
                  {rows.map((row) => <BinderItemTile key={row.printId || row.id} row={row} onDecrement={decrement} onPreview={setPreviewCard} />)}
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  {groupedRows.map((group) => (
                    <div key={group.type}>
                      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">{group.label} · {group.rows.reduce((sum, r) => sum + r.quantity, 0)}</p>
                      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 xl:grid-cols-7">
                        {group.rows.map((row) => <BinderItemTile key={row.printId || row.id} row={row} onDecrement={decrement} onPreview={setPreviewCard} />)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      )}
      <PrintPickerModal modelId={altArtModelId} onClose={() => setAltArtModelId(null)} entries={entries} onIncrement={increment} onDecrement={decrement} />
      <CardPreviewModal card={previewCard} onClose={() => setPreviewCard(null)} />
    </PortalShell>
  );
}
