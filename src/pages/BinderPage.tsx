/* Binder editor v10 — agora edita UM binder específico por id (não mais fixo por
 * kind), com ordenação por múltiplos critérios encadeados (raridade, cor, coleção,
 * nome — cada um crescente/decrescente) e arrastar-soltar pra ordem manual. */
import { useEffect, useMemo, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Copy, Eye, ExternalLink, GripVertical, Images as ImagesIcon, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { api, mapApiCard, type CardFilters } from "@/lib/api";
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CARD_TYPE_OPTIONS, groupCardsByType } from "@/lib/gundam-catalog";
import { MultiSelectFilter } from "@/components/catalog/MultiSelectFilter";
import type { CardRecord } from "@/modules/core/types";

type PoolFilters = Pick<CardFilters, "q" | "color" | "cardType" | "series" | "trait">;
const defaultPoolFilters: PoolFilters = { q: "", color: "", cardType: "", series: "", trait: "" };
type PoolMeta = { colors: string[]; cardTypes: string[]; series: string[]; traits: string[] };
type BinderEntry = { printId: string; quantity: number };
type SortField = "rarity" | "color" | "set" | "name";
type SortLevel = { field: SortField; direction: "asc" | "desc" };
type BinderRow = CardRecord & { quantity: number };

const SORT_FIELD_LABELS: Record<SortField, string> = { rarity: "Raridade", color: "Cor", set: "Coleção/produto", name: "Nome" };
const RARITY_ORDER = ["C", "U", "R", "SR", "LR", "Promo", "Winner", "Judge"];

function sortValue(row: BinderRow, field: SortField): string {
  if (field === "rarity") { const idx = RARITY_ORDER.indexOf(row.rarity || ""); return idx === -1 ? "zz" : String(idx).padStart(2, "0"); }
  if (field === "color") return row.color || "";
  if (field === "set") return row.setCode || "";
  return row.namePt || row.name || "";
}

function applySort(rows: BinderRow[], levels: SortLevel[]): BinderRow[] {
  if (!levels.length) return rows;
  return [...rows].sort((a, b) => {
    for (const level of levels) {
      const av = sortValue(a, level.field);
      const bv = sortValue(b, level.field);
      const cmp = av.localeCompare(bv, "pt-BR");
      if (cmp !== 0) return level.direction === "asc" ? cmp : -cmp;
    }
    return 0;
  });
}

/** Tile de carta na pool — clique adiciona a impressão principal direto, botão de
 *  galeria no canto pra escolher uma arte específica. */
function PoolCardTile({ card, quantity, onAdd, onOpenGallery }: { card: CardRecord; quantity: number; onAdd: (card: CardRecord) => void; onOpenGallery: (modelId: string) => void }) {
  const image = card.imageMediumUrl || card.imageUrl;
  return (
    <div className="group relative">
      <button type="button" onClick={() => onAdd(card)} title={`Adicionar ${card.namePt || card.name}`} className="relative block aspect-[63/88] w-full overflow-hidden border border-white/15 transition group-hover:border-primary/60">
        {image ? <img src={image} alt={card.namePt || card.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.05]" /> : <div className="flex h-full items-center justify-center bg-slate-950/80 p-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">{card.namePt || card.name}</div>}
        {quantity > 0 ? <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{quantity}</span> : null}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-slate-950/95 p-1.5 text-left opacity-0 transition duration-150 group-hover:translate-y-0 group-hover:opacity-100">
          <p className="truncate text-[11px] font-medium text-white">{card.namePt || card.name}</p>
        </div>
      </button>
      <button type="button" onClick={() => onOpenGallery(card.id)} title="Escolher arte específica" className="absolute left-1 top-1 flex size-6 items-center justify-center rounded-full bg-slate-950/80 text-white opacity-100 transition hover:bg-primary hover:text-primary-foreground lg:opacity-0 lg:group-hover:opacity-100">
        <ImagesIcon className="size-3.5" />
      </button>
    </div>
  );
}

/** Tile de item já no binder. Em modo manual (sem critério de ordenação ativo) fica
 *  arrastável — GripVertical no canto inferior esquerdo é a alça de arraste, não
 *  conflita com o clique de remover (que continua sendo a carta em si). */
function BinderItemTile({ row, onDecrement, onPreview, draggable }: { row: BinderRow; onDecrement: (printId: string) => void; onPreview: (card: BinderRow) => void; draggable: boolean }) {
  const printId = row.printId || row.id;
  const sortable = useSortable({ id: printId, disabled: !draggable });
  const image = row.imageMediumUrl || row.imageUrl;
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? 0.4 : 1 };

  return (
    <div ref={sortable.setNodeRef} style={style} className="group relative">
      <button type="button" onClick={() => onDecrement(printId)} title={`Remover 1 de ${row.namePt || row.name}`} className="relative block aspect-[63/88] w-full overflow-hidden border border-white/15 transition group-hover:border-red-400/50">
        {image ? <img src={image} alt={row.namePt || row.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-slate-950/80 p-2 text-center text-[10px] uppercase tracking-[0.18em] text-slate-500">{row.namePt || row.name}</div>}
        <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{row.quantity}</span>
      </button>
      <button type="button" onClick={() => onPreview(row)} title="Ver imagem grande" className="absolute left-1 top-1 flex size-6 items-center justify-center rounded-full bg-slate-950/80 text-white opacity-100 transition hover:bg-white/20 lg:opacity-0 lg:group-hover:opacity-100">
        <Eye className="size-3.5" />
      </button>
      {draggable ? (
        <button type="button" {...sortable.attributes} {...sortable.listeners} title="Arrastar pra reordenar" className="absolute bottom-1 left-1 flex size-6 cursor-grab items-center justify-center rounded-full bg-slate-950/80 text-white opacity-100 transition active:cursor-grabbing lg:opacity-0 lg:group-hover:opacity-100">
          <GripVertical className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

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
      <DialogContent aria-describedby={undefined} className="sm:max-w-2xl lg:max-w-4xl border-white/10 bg-slate-950 text-white">
        <div className="border-b border-white/10 pb-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Galeria de arte</p>
          <DialogTitle className="font-heading text-2xl uppercase heading-portal">{label || "Carregando…"}</DialogTitle>
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
                  <p className="mt-2 truncate text-[11px] text-slate-400">{print.code}{print.rarity ? ` · ${print.rarity}` : ""}</p>
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

function CardPreviewModal({ card, onClose }: { card: BinderRow | null; onClose: () => void }) {
  if (!card) return null;
  const image = card.imageLargeUrl || card.imageMediumUrl || card.imageUrl;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[380px] max-h-[90vh] overflow-y-auto border-white/10 bg-slate-950 text-white">
        <DialogTitle className="sr-only">{`Carta ampliada: ${card.namePt || card.name}`}</DialogTitle>
        <div className="mx-auto h-[447px] w-[320px] overflow-hidden border border-white/10 bg-slate-950/70">{image ? <img src={image} alt={card.namePt || card.name} className="h-full w-full object-cover" /> : null}</div>
        <div className="flex flex-col items-center gap-2 pt-1">
          <p className="text-sm text-slate-400">{card.quantity}x nesse binder</p>
          <a href={`/#/cards/${card.cardModelId || card.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-none border border-white/15 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.16em] text-white nav-hover-soft hover:text-white">
            <ExternalLink className="size-3.5" />Abrir detalhe
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BinderPage() {
  const [, params] = useRoute<{ id: string }>("/binders/:id");
  const [, navigate] = useLocation();
  const binderId = params?.id && params.id !== "new" ? params.id : null;

  const [name, setName] = useState("Novo binder");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [shareId, setShareId] = useState<string | null>(null);
  const [entries, setEntries] = useState<BinderEntry[]>([]);
  const [cardCache, setCardCache] = useState<Record<string, CardRecord>>({});
  const [loadingBinder, setLoadingBinder] = useState(Boolean(binderId));
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
  const [previewCard, setPreviewCard] = useState<BinderRow | null>(null);
  const [itemsViewMode, setItemsViewMode] = useState<"list" | "type">("list");
  const [sortLevels, setSortLevels] = useState<SortLevel[]>([]);

  const cacheCards = (records: CardRecord[]) => {
    setCardCache((current) => {
      const next = { ...current };
      for (const record of records) if (record.printId) next[record.printId] = record;
      return next;
    });
  };

  useEffect(() => {
    if (!binderId) { setLoadingBinder(false); return; }
    setLoadingBinder(true);
    api.getMyBinder(binderId).then((binder) => {
      setName(binder.name);
      setDescription(binder.description || "");
      setIsPublic(binder.isPublic);
      setShareId(binder.shareId);
      const sorted = [...binder.items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const mapped = sorted.map((item) => mapApiCard(item.card));
      cacheCards(mapped);
      setEntries(sorted.map((item) => ({ printId: item.cardId, quantity: item.quantity })));
    }).catch((err: any) => toast.error(err?.message || "Erro ao carregar binder.")).finally(() => setLoadingBinder(false));
  }, [binderId]);

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
  }, [poolFilters, poolPage]);

  const setPoolFilter = (key: keyof PoolFilters, value: string) => {
    setPoolFilters((current) => ({ ...current, [key]: value }));
    setPoolPage(1);
  };

  const rawRows = useMemo(
    () => entries.map((entry) => {
      const card = cardCache[entry.printId];
      return card ? { ...card, quantity: entry.quantity } : null;
    }).filter(Boolean) as BinderRow[],
    [entries, cardCache],
  );
  const rows = useMemo(() => applySort(rawRows, sortLevels), [rawRows, sortLevels]);
  const canDrag = sortLevels.length === 0;

  const quantityByModel = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rawRows) map.set(row.cardModelId || row.id, (map.get(row.cardModelId || row.id) || 0) + row.quantity);
    return map;
  }, [rawRows]);

  const totals = useMemo(() => ({ unique: rawRows.length, quantity: rawRows.reduce((sum, r) => sum + r.quantity, 0) }), [rawRows]);
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setEntries((current) => {
      const oldIndex = current.findIndex((e) => e.printId === active.id);
      const newIndex = current.findIndex((e) => e.printId === over.id);
      if (oldIndex === -1 || newIndex === -1) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  };

  const addSortLevel = () => setSortLevels((current) => (current.length >= 3 ? current : [...current, { field: "rarity", direction: "asc" }]));
  const updateSortLevel = (index: number, patch: Partial<SortLevel>) => setSortLevels((current) => current.map((level, i) => (i === index ? { ...level, ...patch } : level)));
  const removeSortLevel = (index: number) => setSortLevels((current) => current.filter((_, i) => i !== index));

  const saveBinder = async () => {
    setSaving(true);
    try {
      // Salva na ordem exibida no momento — se tiver critério de ordenação ativo, essa
      // vira a nova ordem "de verdade" (posição persistida); modo manual já é a ordem real.
      const orderedEntries = sortLevels.length ? rows.map((row) => entries.find((e) => e.printId === (row.printId || row.id))!).filter(Boolean) : entries;
      const items = orderedEntries.filter((e) => e.quantity > 0).map((e, index) => ({ cardId: e.printId, quantity: e.quantity, position: index }));
      if (binderId) {
        const updated = await api.updateMyBinder(binderId, { name, description, isPublic, items });
        setShareId(updated.shareId);
        toast.success("Binder salvo.");
      } else {
        const created = await api.createBinder({ name, description, isPublic });
        await api.updateMyBinder(created.id, { name, description, isPublic, items });
        toast.success("Binder criado.");
        navigate(`/binders/${created.id}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareId) { toast.error("Salva o binder primeiro pra gerar o link."); return; }
    await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#/binder/${shareId}`);
    toast.success("Link compartilhável copiado.");
  };

  const renderTile = (row: BinderRow) => <BinderItemTile key={row.printId || row.id} row={row} onDecrement={decrement} onPreview={setPreviewCard} draggable={canDrag} />;

  return (
    <PortalShell breadcrumbs={[{ label: "Binders", href: "/binders" }, { label: name }]}>
      {loadingBinder ? <p className="text-sm text-muted-portal">Carregando...</p> : (
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="space-y-3">
                <Input value={name} onChange={(e) => setName(e.target.value)} className="field-shell font-heading text-xl uppercase heading-portal" />
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="field-shell min-h-20" placeholder="Descrição pública opcional" />
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-3 text-sm text-soft">
                    <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Compartilhar publicamente
                  </label>
                </div>
              </div>
              <div className="flex flex-col justify-between gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="panel-cut border surface-strong p-3"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Itens únicos</p><p className="mt-1 font-heading text-3xl">{totals.unique}</p></div>
                  <div className="panel-cut border surface-strong p-3"><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Quantidade</p><p className="mt-1 font-heading text-3xl">{totals.quantity}</p></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveBinder} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
                  {binderId ? <Button variant="outline" className="rounded-none border-white/15 bg-white/5 text-white nav-hover-soft hover:text-white" onClick={copyShareLink}><Copy className="mr-2 size-4" />Link</Button> : null}
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
                <MultiSelectFilter label="Cores" options={poolMeta.colors} value={poolFilters.color ?? ""} onChange={(v) => setPoolFilter("color", v)} />
                <select value={poolFilters.cardType} onChange={(e) => setPoolFilter("cardType", e.target.value)} className="field-shell h-10 px-3 text-sm"><option value="">Todos os tipos</option>{poolMeta.cardTypes.map((c) => <option key={c} value={c}>{CARD_TYPE_OPTIONS.find((opt) => opt.value === c)?.label || c}</option>)}</select>
              </div>
              <Badge variant="outline" className="mt-4 rounded-none border-white/20 text-soft">{poolTotal} cartas encontradas</Badge>
              <div className="mt-4 grid grid-cols-4 gap-2.5 sm:grid-cols-5 xl:grid-cols-6">
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
                <h3 className="font-heading text-3xl uppercase heading-portal">Cartas no binder</h3>
                <div className="flex border border-white/15">
                  <button type="button" onClick={() => setItemsViewMode("list")} className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition ${itemsViewMode === "list" ? "bg-primary text-primary-foreground" : "bg-white/5 text-soft hover:bg-white/10"}`}>Grade única</button>
                  <button type="button" onClick={() => setItemsViewMode("type")} className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition ${itemsViewMode === "type" ? "bg-primary text-primary-foreground" : "bg-white/5 text-soft hover:bg-white/10"}`}>Por tipo</button>
                </div>
              </div>

              {/* Ordenação por criterio — encadeia ate 3 niveis. Enquanto tiver algum
                  criterio ativo, a ordem vira so leitura (arrastar desliga) porque a lista
                  e recalculada a cada render pelo criterio, nao daria pra "segurar" um
                  arraste manual dentro de uma ordem que se recalcula sozinha. */}
              <div className="mt-4 space-y-2 border-y border-white/10 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Ordenar por critério {sortLevels.length ? "" : "(desligado — arrastar ativo)"}</p>
                  {sortLevels.length < 3 ? <button type="button" onClick={addSortLevel} className="text-xs text-primary hover:underline">+ adicionar critério</button> : null}
                </div>
                {sortLevels.map((level, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{index + 1}º</span>
                    <select value={level.field} onChange={(e) => updateSortLevel(index, { field: e.target.value as SortField })} className="field-shell h-8 px-2 text-xs">
                      {Object.entries(SORT_FIELD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <button type="button" onClick={() => updateSortLevel(index, { direction: level.direction === "asc" ? "desc" : "asc" })} className="field-shell h-8 px-3 text-xs">{level.direction === "asc" ? "Crescente" : "Decrescente"}</button>
                    <button type="button" onClick={() => removeSortLevel(index)} className="text-slate-500 hover:text-red-300"><X className="size-4" /></button>
                  </div>
                ))}
              </div>

              {!rows.length ? (
                <p className="mt-6 text-sm text-muted-portal">Ainda vazio — adiciona cartas pela pool ao lado.</p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  {itemsViewMode === "list" ? (
                    <SortableContext items={rows.map((r) => r.printId || r.id)} strategy={rectSortingStrategy}>
                      <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-6 xl:grid-cols-7">
                        {rows.map(renderTile)}
                      </div>
                    </SortableContext>
                  ) : (
                    <div className="mt-6 space-y-5">
                      {groupedRows.map((group) => (
                        <div key={group.type}>
                          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">{group.label} · {group.rows.reduce((sum, r) => sum + r.quantity, 0)}</p>
                          <SortableContext items={group.rows.map((r) => r.printId || r.id)} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 xl:grid-cols-7">
                              {group.rows.map(renderTile)}
                            </div>
                          </SortableContext>
                        </div>
                      ))}
                    </div>
                  )}
                </DndContext>
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
