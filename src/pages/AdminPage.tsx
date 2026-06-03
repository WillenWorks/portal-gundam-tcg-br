/* Admin v9.3 — parserização semântica + validação robusta + modal redesenhada. */
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
 
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { extractLinkSuggestions, parseCardEffects } from "@/lib/gundam-card-effects";
import { AP_HP_OPTIONS, CARD_TYPE_OPTIONS, COLOR_OPTIONS, COST_LEVEL_OPTIONS, LINK_SUGGESTION_TRAITS, PRODUCT_TYPE_OPTIONS, RARITY_OPTIONS } from "@/lib/gundam-catalog";
 
/* ── Tipos ─────────────────────────────────────────────────────────────── */
 
type AdminUser = { id: string; displayName: string; email: string; role: string; isActive: boolean };
type AdminSet = any;
type AdminCard = any;
type AdminRuling = any;
 
type CardForm = {
  id: string;
  setId: string;
  code: string;
  rarity: string;
  cost: string;
  level: string;
  cardType: string;
  nameEn: string;
  namePt: string;
  burstEnabled: boolean;
  burstEffect: string;
  ap: string;
  hp: string;
  effectText: string;
  pilotName: string;
  color: string;
  imageUrl: string;
  traits: string;
  linkText: string;
  sourceTitle: string;
  officialUrl: string;
  thumbUrl: string;
  imageSourceUrl: string;
  legalityStatus: string;
};
 
/* ── Constantes ─────────────────────────────────────────────────────────── */
 
const LEGALITY_OPTIONS = [
  { value: "legal",         label: "Legal",          color: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" },
  { value: "restricted",   label: "Restrita",        color: "text-amber-400 border-amber-400/40 bg-amber-400/10" },
  { value: "banned",       label: "Banida",          color: "text-red-400 border-red-400/40 bg-red-400/10" },
  { value: "not_in_format",label: "Fora do formato", color: "text-slate-400 border-white/20 bg-white/5" },
];
 
const emptySetForm = { id: "", code: "", nameEn: "", namePt: "", officialUrl: "", coverImage: "", releaseDate: "", shortDescription: "", setType: "BOOSTER_PACK", productCodeAlt: "", msrpUsd: "", contentSummaryPt: "", contentSummaryEn: "", raritySummary: "", productNotes: "", sourceTitles: "" };
const emptyRuleForm = { title: "", sourceType: "OFFICIAL_RULES", questionPt: "", answerPt: "", questionEn: "", answerEn: "", relatedKeyword: "", originalUrl: "", cardId: "" };
const emptyCardForm: CardForm = { id: "", setId: "", code: "", rarity: "C", cost: "0", level: "0", cardType: "UNIT", nameEn: "", namePt: "", burstEnabled: false, burstEffect: "", ap: "-", hp: "-", effectText: "", pilotName: "", color: "Blue", imageUrl: "", traits: "", linkText: "", sourceTitle: "", officialUrl: "", thumbUrl: "", imageSourceUrl: "", legalityStatus: "legal" };
 
/* ── Helpers ─────────────────────────────────────────────────────────────── */
 
const csvToArray = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
const semicolonToArray = (value: string) => value.split(";").map((item) => item.trim()).filter(Boolean);
const arrayToCsv = (value?: string[]) => (value || []).filter(Boolean).join(", ");
 
function mapSetToForm(set?: AdminSet) {
  if (!set) return emptySetForm;
  return { id: set.id, code: set.code, nameEn: set.nameEn || "", namePt: set.namePt || "", officialUrl: set.officialUrl || "", coverImage: set.coverImage || "", releaseDate: set.releaseDate ? new Date(set.releaseDate).toISOString().slice(0, 10) : "", shortDescription: set.shortDescription || "", setType: set.setType || "BOOSTER_PACK", productCodeAlt: set.productCodeAlt || "", msrpUsd: set.msrpUsd != null ? String(set.msrpUsd) : "", contentSummaryPt: set.contentSummaryPt || "", contentSummaryEn: set.contentSummaryEn || "", raritySummary: set.raritySummary || "", productNotes: set.productNotes || "", sourceTitles: arrayToCsv(set.sourceTitles) };
}
 
function mapCardToForm(card?: AdminCard): CardForm {
  if (!card) return emptyCardForm;
  const sections = Array.isArray(card.textSectionsJson) ? card.textSectionsJson : [];
  const burstSection = sections.find((item: any) => String(item?.kind || "").toLowerCase() === "burst");
  const effectSection = sections.find((item: any) => String(item?.kind || "").toLowerCase() === "effect") || sections.find((item: any) => item?.textPt || item?.textEn);
  return { id: card.id, setId: card.set?.id || "", code: card.code || "", rarity: card.rarity || "C", cost: card.cost != null ? String(card.cost) : "0", level: card.level != null ? String(card.level) : "0", cardType: card.cardType || "UNIT", nameEn: card.nameEn || "", namePt: card.namePt || "", burstEnabled: Boolean(card.hasBurst || burstSection?.textPt || burstSection?.textEn), burstEffect: burstSection?.textPt || burstSection?.textEn || "", ap: card.ap != null ? String(card.ap) : "-", hp: card.hp != null ? String(card.hp) : "-", effectText: effectSection?.textPt || effectSection?.textEn || card.effectPt || card.effectEn || "", pilotName: card.pilotName || "", color: card.color || "Blue", imageUrl: card.imageUrl || "", traits: (card.traits || []).join("; "), linkText: card.linkText || "", sourceTitle: card.sourceTitle || card.series || "", officialUrl: card.officialUrl || "", thumbUrl: card.thumbUrl || "", imageSourceUrl: card.imageSourceUrl || "", legalityStatus: card.legalityStatus || "legal" };
}
 
/* ── Componentes internos ─────────────────────────────────────────────── */
 
function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h3 className="font-heading text-3xl uppercase">{title}</h3>
      <p className="text-sm leading-6 text-slate-400 dark:text-slate-400 light:text-slate-600">{description}</p>
    </div>
  );
}
 
function ToggleCard({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-none border px-3 py-2 text-xs uppercase tracking-[0.16em] transition ${active ? "border-primary/50 bg-primary/15 text-primary" : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 light:border-slate-300/80 light:bg-white light:text-slate-700"}`}>
      {label}
    </button>
  );
}
 
/** Separador de seção dentro da modal */
function ModalSection({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="h-px flex-1 bg-white/8" />
      <span className="text-[10px] uppercase tracking-[0.32em] text-slate-600">{label}</span>
      <div className="h-px flex-1 bg-white/8" />
    </div>
  );
}
 
/** Flag de status (Main / Action / Burst / Once per Turn) */
function StatusFlag({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-none border px-2 py-1 text-[10px] uppercase tracking-[0.2em] transition ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-white/10 bg-white/3 text-slate-600"}`}>
      <div className={`size-1.5 rounded-full ${active ? "bg-primary" : "bg-slate-700"}`} />
      {label}
    </div>
  );
}
 
/* ── Página ─────────────────────────────────────────────────────────────── */
 
export default function AdminPage() {
  const { user } = useAuth();
  const [location] = useLocation();
  const tab = useMemo(() => new URLSearchParams(location.split("?")[1] || "").get("tab") || "dashboard", [location]);
 
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sets, setSets] = useState<AdminSet[]>([]);
  const [cards, setCards] = useState<AdminCard[]>([]);
  const [rules, setRules] = useState<AdminRuling[]>([]);
  const [setForm, setSetForm] = useState(emptySetForm);
  const [cardForm, setCardForm] = useState<CardForm>(emptyCardForm);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const [setModalOpen, setSetModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [setSearch, setSetSearch] = useState("");
  const [cardSearch, setCardSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
 
  const loadAll = async () => {
    setLoading(true);
    try {
      const [userRows, setRows, cardRows, ruleRows] = await Promise.all([api.listAdminUsers(), api.listSets(), api.listCards(), api.listRulings()]);
      setUsers(userRows); setSets(setRows); setCards(cardRows); setRules(ruleRows);
    } finally { setLoading(false); }
  };
 
  useEffect(() => { if (user?.role === "ADMIN") loadAll().catch(() => undefined); }, [user?.role]);
 
  const visibleSets = useMemo(() => { const term = setSearch.trim().toLowerCase(); return term ? sets.filter((set) => [set.code, set.namePt, set.nameEn, set.setType].filter(Boolean).some((item) => String(item).toLowerCase().includes(term))) : sets; }, [setSearch, sets]);
  const visibleCards = useMemo(() => { const term = cardSearch.trim().toLowerCase(); return term ? cards.filter((card) => [card.code, card.namePt, card.nameEn, card.cardType, card.set?.code, card.linkText].filter(Boolean).some((item) => String(item).toLowerCase().includes(term))) : cards; }, [cardSearch, cards]);
 
  const effectPreview = useMemo(() => parseCardEffects(cardForm.effectText, cardForm.burstEnabled ? cardForm.burstEffect : ""), [cardForm.effectText, cardForm.burstEffect, cardForm.burstEnabled]);
  const linkSuggestions = useMemo(() => Array.from(new Set([...LINK_SUGGESTION_TRAITS.map((item) => `${item} trait`), ...extractLinkSuggestions(cards)])).sort(), [cards]);
 
  const openSetModal = (set?: AdminSet) => { setSetForm(mapSetToForm(set)); setSetModalOpen(true); };
  const openCardModal = (card?: AdminCard) => { setCardForm(mapCardToForm(card)); setCardModalOpen(true); };
 
  const saveSet = async () => {
    if (!setForm.code.trim()) { toast.error("Código da coleção é obrigatório."); return; }
    if (!setForm.nameEn.trim()) { toast.error("Nome em inglês é obrigatório."); return; }
    setSaving(true);
    try {
      const payload = { code: setForm.code.trim(), nameEn: setForm.nameEn.trim(), namePt: setForm.namePt.trim() || null, officialUrl: setForm.officialUrl.trim() || null, coverImage: setForm.coverImage.trim() || null, releaseDate: setForm.releaseDate ? new Date(`${setForm.releaseDate}T00:00:00.000Z`).toISOString() : null, shortDescription: setForm.shortDescription.trim() || null, setType: setForm.setType, productCodeAlt: setForm.productCodeAlt.trim() || null, msrpUsd: setForm.msrpUsd ? Number(setForm.msrpUsd) : null, contentSummaryPt: setForm.contentSummaryPt.trim() || null, contentSummaryEn: setForm.contentSummaryEn.trim() || null, raritySummary: setForm.raritySummary.trim() || null, productNotes: setForm.productNotes.trim() || null, sourceTitles: csvToArray(setForm.sourceTitles) };
      if (setForm.id) await api.updateSet(setForm.id, payload); else await api.createSet(payload);
      setSetModalOpen(false); setSetForm(emptySetForm); await loadAll();
      toast.success(setForm.id ? "Coleção atualizada." : "Coleção criada.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar coleção.");
    } finally { setSaving(false); }
  };
 
  const saveCard = async () => {
    if (!cardForm.code.trim()) { toast.error("Código da carta é obrigatório."); return; }
    if (!cardForm.nameEn.trim()) { toast.error("Nome em inglês é obrigatório."); return; }
    setSaving(true);
    try {
      const parsed = parseCardEffects(cardForm.effectText, cardForm.burstEnabled ? cardForm.burstEffect : "");
      const payload = { code: cardForm.code.trim(), rarity: cardForm.rarity, cost: Number(cardForm.cost), level: Number(cardForm.level), cardType: cardForm.cardType, nameEn: cardForm.nameEn.trim(), namePt: cardForm.namePt.trim() || null, effectPt: cardForm.effectText.trim() || null, burstEffectPt: cardForm.burstEnabled ? cardForm.burstEffect.trim() || null : null, ap: cardForm.ap === "-" ? null : Number(cardForm.ap), hp: cardForm.hp === "-" ? null : Number(cardForm.hp), pilotName: ["PILOT", "COMMAND_PILOT"].includes(cardForm.cardType) ? cardForm.pilotName.trim() || null : null, color: cardForm.color || null, setId: cardForm.setId || null, imageUrl: cardForm.imageUrl.trim() || null, linkText: cardForm.linkText.trim() || null, traits: semicolonToArray(cardForm.traits), trait: semicolonToArray(cardForm.traits).join(" | ") || null, sourceTitle: cardForm.sourceTitle.trim() || null, series: cardForm.sourceTitle.trim() || null, officialUrl: cardForm.officialUrl.trim() || null, thumbUrl: cardForm.thumbUrl.trim() || null, imageSourceUrl: cardForm.imageSourceUrl.trim() || null, legalityStatus: cardForm.legalityStatus || "legal", triggerKeywords: parsed.triggerKeywords, effectKeywords: parsed.effectKeywords, keywordTags: parsed.keywordTags, hasBurst: parsed.hasBurst, hasMain: parsed.hasMain, hasAction: parsed.hasAction, oncePerTurn: parsed.oncePerTurn, textSectionsJson: parsed.sections, cardSubtypes: [] };
      if (cardForm.id) await api.updateCard(cardForm.id, payload); else await api.createCard(payload);
      setCardModalOpen(false); setCardForm(emptyCardForm); await loadAll();
      toast.success(cardForm.id ? "Carta atualizada." : "Carta criada.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar carta.");
    } finally { setSaving(false); }
  };
 
  const deleteSet = async (set: AdminSet) => {
    if (!window.confirm(`Excluir ${set.code}?`)) return;
    await api.deleteSet(set.id); await loadAll(); toast.success("Coleção removida.");
  };
 
  const deleteCard = async (card: AdminCard) => {
    if (!window.confirm(`Excluir ${card.code}?`)) return;
    await api.deleteCard(card.id); await loadAll(); toast.success("Carta removida.");
  };
 
  if (user?.role !== "ADMIN") {
    return <PortalShell breadcrumbs={[{ label: "Admin" }]}><Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900"><CardContent className="p-6">Essa área é exclusiva para administradores.</CardContent></Card></PortalShell>;
  }
 
  return (
    <PortalShell breadcrumbs={[{ label: "Admin" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="space-y-4 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Admin v9.3 · cadastro limpo e semântico</p>
            <h2 className="font-heading text-5xl uppercase leading-none">Centro administrativo</h2>
            <p className="max-w-4xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">O cadastro de cartas prioriza fluxo rápido, campos fechados onde faz sentido e um texto de efeito único com parsing automático de keywords entre {"`<>`"}.</p>
            {loading ? <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Atualizando base…</p> : null}
          </CardContent>
        </Card>
 
        <Tabs defaultValue={tab} className="space-y-6">
          <TabsList className="h-auto flex-wrap rounded-none border border-white/10 bg-white/5 p-1">
            <TabsTrigger value="dashboard" className="rounded-none uppercase tracking-[0.18em]">Dashboard</TabsTrigger>
            <TabsTrigger value="cards" className="rounded-none uppercase tracking-[0.18em]">Cartas</TabsTrigger>
            <TabsTrigger value="sets" className="rounded-none uppercase tracking-[0.18em]">Coleções</TabsTrigger>
            <TabsTrigger value="users" className="rounded-none uppercase tracking-[0.18em]">Usuários</TabsTrigger>
            <TabsTrigger value="rules" className="rounded-none uppercase tracking-[0.18em]">Rulings</TabsTrigger>
          </TabsList>
 
          <TabsContent value="dashboard">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[["Usuários", users.length], ["Coleções", sets.length], ["Cartas", cards.length], ["Rulings", rules.length]].map(([label, value]) => <Card key={String(label)} className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">{String(label)}</p><p className="mt-4 font-heading text-5xl leading-none">{String(value)}</p></CardContent></Card>)}</div>
          </TabsContent>
 
          <TabsContent value="cards">
            <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
              <CardContent className="space-y-5 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <SectionTitle title="Catálogo de cartas" description="Busca rápida, tabela operacional e um modal focado no fluxo real de cadastro." />
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[280px]"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input value={cardSearch} onChange={(e) => setCardSearch(e.target.value)} placeholder="Buscar por código, nome, tipo, link ou coleção" className="rounded-none pl-9" /></div>
                    <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => openCardModal()}><Plus className="mr-2 size-4" />Nova carta</Button>
                  </div>
                </div>
                <div className="overflow-x-auto border border-white/10"><table className="min-w-full text-sm"><thead className="bg-white/5 text-left uppercase tracking-[0.16em] text-slate-400"><tr><th className="px-4 py-3">Carta</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Coleção</th><th className="px-4 py-3">Stats</th><th className="px-4 py-3">Keywords</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody>{visibleCards.map((card) => <tr key={card.id} className="border-t border-white/10 align-top"><td className="px-4 py-4"><div className="flex items-start gap-3"><div className="h-16 w-12 overflow-hidden border border-white/10 bg-slate-950/60">{card.imageUrl ? <img src={card.imageUrl} alt={card.namePt || card.nameEn} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[9px] uppercase tracking-[0.18em] text-slate-500">Sem arte</div>}</div><div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.code}</p><p className="mt-1 font-medium">{card.namePt || card.nameEn}</p><p className="text-xs text-slate-500">{card.linkText || card.sourceTitle || "sem link"}</p></div></div></td><td className="px-4 py-4"><Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{card.cardType}</Badge>{card.pilotName ? <p className="mt-2 text-xs text-slate-500">Piloto: {card.pilotName}</p> : null}</td><td className="px-4 py-4">{card.set?.code || "—"}</td><td className="px-4 py-4 text-xs text-slate-400">Lv {card.level ?? "-"} · Cost {card.cost ?? "-"} · AP {card.ap ?? "-"} · HP {card.hp ?? "-"}</td><td className="px-4 py-4"><div className="flex max-w-[320px] flex-wrap gap-2">{[...(card.triggerKeywords || []), ...(card.effectKeywords || [])].slice(0, 6).map((keyword: string) => <Badge key={keyword} variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-accent">{keyword}</Badge>)}</div></td><td className="px-4 py-4"><div className="flex justify-end gap-2"><Button variant="outline" className="rounded-none" onClick={() => openCardModal(card)}><Pencil className="size-4" /></Button><Button variant="outline" className="rounded-none text-red-400 hover:text-red-300" onClick={() => deleteCard(card)}><Trash2 className="size-4" /></Button></div></td></tr>)}</tbody></table></div>
              </CardContent>
            </Card>
          </TabsContent>
 
          <TabsContent value="sets">
            <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900"><CardContent className="space-y-5 p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><SectionTitle title="Coleções e produtos" description="Produtos cadastrados como booster, starter deck, promo pack ou evento com campos próprios." /><div className="flex flex-wrap items-center gap-3"><div className="relative min-w-[280px]"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input value={setSearch} onChange={(e) => setSetSearch(e.target.value)} placeholder="Buscar por código, nome ou categoria" className="rounded-none pl-9" /></div><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => openSetModal()}><Plus className="mr-2 size-4" />Nova coleção</Button></div></div><div className="overflow-x-auto border border-white/10"><table className="min-w-full text-sm"><thead className="bg-white/5 text-left uppercase tracking-[0.16em] text-slate-400"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Lançamento</th><th className="px-4 py-3">MSRP</th><th className="px-4 py-3">Cartas</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody>{visibleSets.map((set) => <tr key={set.id} className="border-t border-white/10 align-top"><td className="px-4 py-4"><div className="flex items-start gap-3"><div className="h-16 w-24 overflow-hidden border border-white/10 bg-slate-950/60">{set.coverImage ? <img src={set.coverImage} alt={set.namePt || set.nameEn} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[9px] uppercase tracking-[0.18em] text-slate-500">Sem capa</div>}</div><div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">{set.code}{set.productCodeAlt ? ` · ${set.productCodeAlt}` : ""}</p><p className="mt-1 font-medium">{set.namePt || set.nameEn}</p><p className="text-xs text-slate-500">{set.sourceTitles?.join(", ") || "sem obras vinculadas"}</p></div></div></td><td className="px-4 py-4"><Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{set.setType || "OTHER"}</Badge></td><td className="px-4 py-4">{set.releaseDate ? new Date(set.releaseDate).toLocaleDateString("pt-BR") : "—"}</td><td className="px-4 py-4">{set.msrpUsd != null ? `US$ ${set.msrpUsd.toFixed(2)}` : "—"}</td><td className="px-4 py-4">{set._count?.cards ?? 0}</td><td className="px-4 py-4"><div className="flex justify-end gap-2"><Button variant="outline" className="rounded-none" onClick={() => openSetModal(set)}><Pencil className="size-4" /></Button><Button variant="outline" className="rounded-none text-red-400 hover:text-red-300" onClick={() => deleteSet(set)}><Trash2 className="size-4" /></Button></div></td></tr>)}</tbody></table></div></CardContent></Card>
          </TabsContent>
 
          <TabsContent value="users"><Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900"><CardContent className="space-y-3 p-5"><SectionTitle title="Usuários" description="Bloqueio e reativação rápidos para o fluxo de homologação." />{users.map((entry) => <div key={entry.id} className="panel-cut flex items-center justify-between gap-4 border border-white/10 bg-slate-950/60 p-4 dark:bg-slate-950/60 light:bg-slate-50"><div><p className="text-lg">{entry.displayName}</p><p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{entry.email} · {entry.role} · {entry.isActive ? "ativo" : "bloqueado"}</p></div><Button variant="outline" className="rounded-none" onClick={async () => { await api.updateAdminUser(entry.id, { isActive: !entry.isActive }); await loadAll(); toast.success(entry.isActive ? "Usuário bloqueado." : "Usuário reativado."); }}>{entry.isActive ? "Bloquear" : "Reativar"}</Button></div>)}</CardContent></Card></TabsContent>
 
          <TabsContent value="rules"><Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900"><CardContent className="space-y-4 p-5"><SectionTitle title="Nova ruling" description="Registro rápido de FAQ oficial e vínculo opcional com carta." /><Input value={ruleForm.title} onChange={(e) => setRuleForm((s) => ({ ...s, title: e.target.value }))} placeholder="Título" className="rounded-none" /><div className="grid gap-4 md:grid-cols-2"><Textarea value={ruleForm.questionPt} onChange={(e) => setRuleForm((s) => ({ ...s, questionPt: e.target.value }))} placeholder="Pergunta PT-BR" className="min-h-24 rounded-none" /><Textarea value={ruleForm.answerPt} onChange={(e) => setRuleForm((s) => ({ ...s, answerPt: e.target.value }))} placeholder="Resposta PT-BR" className="min-h-24 rounded-none" /><Textarea value={ruleForm.questionEn} onChange={(e) => setRuleForm((s) => ({ ...s, questionEn: e.target.value }))} placeholder="Question EN" className="min-h-24 rounded-none" /><Textarea value={ruleForm.answerEn} onChange={(e) => setRuleForm((s) => ({ ...s, answerEn: e.target.value }))} placeholder="Answer EN" className="min-h-24 rounded-none" /></div><div className="grid gap-4 md:grid-cols-2"><Input value={ruleForm.relatedKeyword} onChange={(e) => setRuleForm((s) => ({ ...s, relatedKeyword: e.target.value }))} placeholder="Keyword relacionada" className="rounded-none" /><Input value={ruleForm.originalUrl} onChange={(e) => setRuleForm((s) => ({ ...s, originalUrl: e.target.value }))} placeholder="URL da fonte" className="rounded-none" /></div><div className="grid gap-4 md:grid-cols-2"><select value={ruleForm.sourceType} onChange={(e) => setRuleForm((s) => ({ ...s, sourceType: e.target.value }))} className="field-shell h-10 px-3 text-sm"><option value="OFFICIAL_RULES">Official Rules</option><option value="OFFICIAL_FAQ">Official FAQ</option><option value="COMMUNITY_EXPLAINER">Community</option></select><select value={ruleForm.cardId} onChange={(e) => setRuleForm((s) => ({ ...s, cardId: e.target.value }))} className="field-shell h-10 px-3 text-sm"><option value="">Carta vinculada</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.code} · {card.namePt || card.nameEn}</option>)}</select></div><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={async () => { await api.createRuling({ ...ruleForm, relatedKeyword: ruleForm.relatedKeyword || null, originalUrl: ruleForm.originalUrl || null, cardId: ruleForm.cardId || null }); setRuleForm(emptyRuleForm); await loadAll(); toast.success("Ruling criada."); }}>Salvar ruling</Button><div className="grid gap-3">{rules.map((rule) => <div key={rule.id} className="panel-cut border surface-strong p-4 dark:bg-slate-950/60 light:bg-slate-50"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{rule.sourceType} · {rule.relatedKeyword || "sem keyword"}</p><p className="mt-1 text-lg">{rule.title}</p><p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{rule.originalUrl || "sem fonte externa"}</p></div>)}</div></CardContent></Card></TabsContent>
        </Tabs>
      </div>
 
      {/* ── Modal: Coleção ──────────────────────────────────────────────────── */}
      <Dialog open={setModalOpen} onOpenChange={setSetModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none border-white/10 bg-slate-950 text-white sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-3xl uppercase">{setForm.id ? "Editar coleção" : "Nova coleção"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Input value={setForm.code} onChange={(e) => setSetForm((s) => ({ ...s, code: e.target.value }))} placeholder="Código *" className="rounded-none" />
            <Input value={setForm.nameEn} onChange={(e) => setSetForm((s) => ({ ...s, nameEn: e.target.value }))} placeholder="Nome EN *" className="rounded-none" />
            <Input value={setForm.namePt} onChange={(e) => setSetForm((s) => ({ ...s, namePt: e.target.value }))} placeholder="Nome PT-BR" className="rounded-none" />
            <Input type="date" value={setForm.releaseDate} onChange={(e) => setSetForm((s) => ({ ...s, releaseDate: e.target.value }))} className="rounded-none" />
            <Input value={setForm.officialUrl} onChange={(e) => setSetForm((s) => ({ ...s, officialUrl: e.target.value }))} placeholder="URL oficial" className="rounded-none" />
            <Input value={setForm.coverImage} onChange={(e) => setSetForm((s) => ({ ...s, coverImage: e.target.value }))} placeholder="Capa local" className="rounded-none" />
            <Input value={setForm.productCodeAlt} onChange={(e) => setSetForm((s) => ({ ...s, productCodeAlt: e.target.value }))} placeholder="Código variante" className="rounded-none" />
            <Input value={setForm.msrpUsd} onChange={(e) => setSetForm((s) => ({ ...s, msrpUsd: e.target.value }))} placeholder="MSRP USD" className="rounded-none" />
          </div>
          <div className="flex flex-wrap gap-2">{PRODUCT_TYPE_OPTIONS.map((option) => <ToggleCard key={option.value} active={setForm.setType === option.value} label={option.label} onClick={() => setSetForm((s) => ({ ...s, setType: option.value }))} />)}</div>
          <Textarea value={setForm.shortDescription} onChange={(e) => setSetForm((s) => ({ ...s, shortDescription: e.target.value }))} placeholder="Descrição curta" className="min-h-24 rounded-none" />
          <div className="grid gap-4 md:grid-cols-2">
            <Textarea value={setForm.contentSummaryPt} onChange={(e) => setSetForm((s) => ({ ...s, contentSummaryPt: e.target.value }))} placeholder="Conteúdo PT-BR" className="min-h-24 rounded-none" />
            <Textarea value={setForm.contentSummaryEn} onChange={(e) => setSetForm((s) => ({ ...s, contentSummaryEn: e.target.value }))} placeholder="Content EN" className="min-h-24 rounded-none" />
          </div>
          <Textarea value={setForm.raritySummary} onChange={(e) => setSetForm((s) => ({ ...s, raritySummary: e.target.value }))} placeholder="Resumo de raridades" className="min-h-24 rounded-none" />
          <Textarea value={setForm.productNotes} onChange={(e) => setSetForm((s) => ({ ...s, productNotes: e.target.value }))} placeholder="Notas do produto" className="min-h-24 rounded-none" />
          <Input value={setForm.sourceTitles} onChange={(e) => setSetForm((s) => ({ ...s, sourceTitles: e.target.value }))} placeholder="Obras separadas por vírgula" className="rounded-none" />
          <div className="flex justify-end gap-3">
            <Button variant="outline" className="rounded-none" onClick={() => setSetModalOpen(false)}>Cancelar</Button>
            <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveSet} disabled={saving}>{saving ? "Salvando…" : "Salvar coleção"}</Button>
          </div>
        </DialogContent>
      </Dialog>
 
      {/* ── Modal: Carta ────────────────────────────────────────────────────── */}
      <Dialog open={cardModalOpen} onOpenChange={setCardModalOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-none border-white/10 bg-slate-950 text-white sm:max-w-6xl">
 
          {/* Cabeçalho */}
          <DialogHeader className="border-b border-white/8 pb-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <DialogTitle className="font-heading text-4xl uppercase leading-none">
                {cardForm.id ? "Editar carta" : "Nova carta"}
              </DialogTitle>
              {cardForm.id && (
                <span className="text-xs uppercase tracking-[0.28em] text-slate-500">{cardForm.code || "—"}</span>
              )}
            </div>
          </DialogHeader>
 
          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
 
            {/* ── Coluna principal ────────────────────────────── */}
            <div className="space-y-5">
 
              {/* IDENTIDADE */}
              <ModalSection label="Identidade" />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Input value={cardForm.code} onChange={(e) => setCardForm((s) => ({ ...s, code: e.target.value }))} placeholder="Código *" className="rounded-none col-span-2 md:col-span-1" />
                <select value={cardForm.rarity} onChange={(e) => setCardForm((s) => ({ ...s, rarity: e.target.value }))} className="field-shell h-10 px-3 text-sm">{RARITY_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                <select value={cardForm.cost} onChange={(e) => setCardForm((s) => ({ ...s, cost: e.target.value }))} className="field-shell h-10 px-3 text-sm">{COST_LEVEL_OPTIONS.map((item) => <option key={item} value={item}>Custo {item}</option>)}</select>
                <select value={cardForm.level} onChange={(e) => setCardForm((s) => ({ ...s, level: e.target.value }))} className="field-shell h-10 px-3 text-sm">{COST_LEVEL_OPTIONS.map((item) => <option key={item} value={item}>Level {item}</option>)}</select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <select value={cardForm.cardType} onChange={(e) => setCardForm((s) => ({ ...s, cardType: e.target.value }))} className="field-shell h-10 px-3 text-sm">{CARD_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                <select value={cardForm.setId} onChange={(e) => setCardForm((s) => ({ ...s, setId: e.target.value }))} className="field-shell h-10 px-3 text-sm"><option value="">Coleção</option>{sets.map((set) => <option key={set.id} value={set.id}>{set.code} · {set.namePt || set.nameEn}</option>)}</select>
                <Input value={cardForm.nameEn} onChange={(e) => setCardForm((s) => ({ ...s, nameEn: e.target.value }))} placeholder="Nome do card (EN) *" className="rounded-none" />
                <Input value={cardForm.namePt} onChange={(e) => setCardForm((s) => ({ ...s, namePt: e.target.value }))} placeholder="Nome traduzido (PT-BR)" className="rounded-none" />
              </div>
 
              {/* STATS */}
              <ModalSection label="Stats" />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <select value={cardForm.ap} onChange={(e) => setCardForm((s) => ({ ...s, ap: e.target.value }))} className="field-shell h-10 px-3 text-sm">{AP_HP_OPTIONS.map((item) => <option key={item} value={item}>AP {item}</option>)}</select>
                <select value={cardForm.hp} onChange={(e) => setCardForm((s) => ({ ...s, hp: e.target.value }))} className="field-shell h-10 px-3 text-sm">{AP_HP_OPTIONS.map((item) => <option key={item} value={item}>HP {item}</option>)}</select>
                <select value={cardForm.color} onChange={(e) => setCardForm((s) => ({ ...s, color: e.target.value }))} className="field-shell h-10 px-3 text-sm"><option value="">Cor</option>{COLOR_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                <select value={cardForm.legalityStatus} onChange={(e) => setCardForm((s) => ({ ...s, legalityStatus: e.target.value }))} className="field-shell h-10 px-3 text-sm">
                  {LEGALITY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
 
              {/* EFEITOS */}
              <ModalSection label="Efeitos" />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Burst</p>
                    <div className="flex gap-1.5">
                      <ToggleCard active={cardForm.burstEnabled} label="Sim" onClick={() => setCardForm((s) => ({ ...s, burstEnabled: true }))} />
                      <ToggleCard active={!cardForm.burstEnabled} label="Não" onClick={() => setCardForm((s) => ({ ...s, burstEnabled: false, burstEffect: "" }))} />
                    </div>
                  </div>
                  {cardForm.burstEnabled
                    ? <Textarea value={cardForm.burstEffect} onChange={(e) => setCardForm((s) => ({ ...s, burstEffect: e.target.value }))} placeholder="Ex.: <Burst> Draw 1." className="min-h-[140px] rounded-none font-mono text-sm" />
                    : <div className="flex min-h-[140px] items-center justify-center border border-dashed border-white/10 text-xs uppercase tracking-[0.2em] text-slate-700">Sem efeito burst</div>
                  }
                </div>
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Efeito principal</p>
                  <Textarea value={cardForm.effectText} onChange={(e) => setCardForm((s) => ({ ...s, effectText: e.target.value }))} placeholder={"Ex.: <During Link>: This unit gains <Blocker>."} className="min-h-[140px] rounded-none font-mono text-sm" />
                </div>
              </div>
 
              {/* METADADOS */}
              <ModalSection label="Metadados" />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {["PILOT", "COMMAND_PILOT"].includes(cardForm.cardType)
                  ? <Input value={cardForm.pilotName} onChange={(e) => setCardForm((s) => ({ ...s, pilotName: e.target.value }))} placeholder="Nome do piloto" className="rounded-none" />
                  : <div className="hidden xl:block" />
                }
                <Input value={cardForm.imageUrl} onChange={(e) => setCardForm((s) => ({ ...s, imageUrl: e.target.value }))} placeholder="URL da imagem" className="rounded-none" />
                <Input value={cardForm.traits} onChange={(e) => setCardForm((s) => ({ ...s, traits: e.target.value }))} placeholder="Facção / traits (sep. por ;)" className="rounded-none" />
                <div className="xl:col-span-2">
                  <Input list="link-suggestions" value={cardForm.linkText} onChange={(e) => setCardForm((s) => ({ ...s, linkText: e.target.value }))} placeholder="Link: piloto(s) ou trait genérica" className="rounded-none" />
                  <datalist id="link-suggestions">{linkSuggestions.map((item) => <option key={item} value={item} />)}</datalist>
                </div>
                <Input value={cardForm.sourceTitle} onChange={(e) => setCardForm((s) => ({ ...s, sourceTitle: e.target.value }))} placeholder="Obra / source title" className="rounded-none" />
                <Input value={cardForm.officialUrl} onChange={(e) => setCardForm((s) => ({ ...s, officialUrl: e.target.value }))} placeholder="URL oficial" className="rounded-none xl:col-span-2" />
              </div>
            </div>
 
            {/* ── Coluna lateral: Semântica ────────────────────── */}
            <div className="space-y-4">
 
              {/* Leitura semântica */}
              <Card className="panel-cut rounded-none border-white/10 bg-slate-900/60">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-xl uppercase">Leitura semântica</h3>
                    <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] ${(effectPreview.triggerKeywords.length + effectPreview.effectKeywords.length) > 0 ? "text-emerald-400" : "text-slate-600"}`}>
                      <div className={`size-1.5 rounded-full ${(effectPreview.triggerKeywords.length + effectPreview.effectKeywords.length) > 0 ? "bg-emerald-400 animate-pulse" : "bg-slate-700"}`} />
                      {(effectPreview.triggerKeywords.length + effectPreview.effectKeywords.length) > 0 ? "Detectadas" : "Aguardando"}
                    </div>
                  </div>
 
                  <div className="space-y-3">
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-slate-600">Trigger / timing</p>
                      <div className="flex flex-wrap gap-1.5">
                        {effectPreview.triggerKeywords.length
                          ? effectPreview.triggerKeywords.map((item) => <Badge key={item} className="rounded-none border border-primary/40 bg-primary/10 text-xs text-primary">{item}</Badge>)
                          : <span className="text-xs text-slate-700">nenhuma</span>}
                      </div>
                    </div>
 
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-slate-600">Effect keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {effectPreview.effectKeywords.length
                          ? effectPreview.effectKeywords.map((item) => <Badge key={item} variant="outline" className="rounded-none border-accent/40 bg-accent/10 text-xs text-accent">{item}</Badge>)
                          : <span className="text-xs text-slate-700">nenhuma</span>}
                      </div>
                    </div>
                  </div>
 
                  <div className="border-t border-white/8 pt-3">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-slate-600">Flags automáticas</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <StatusFlag label="Main" active={effectPreview.hasMain} />
                      <StatusFlag label="Action" active={effectPreview.hasAction} />
                      <StatusFlag label="Burst" active={effectPreview.hasBurst} />
                      <StatusFlag label="Once/Turn" active={effectPreview.oncePerTurn} />
                    </div>
                  </div>
 
                  <div className="border-t border-white/8 pt-3">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-slate-600">Legalidade</p>
                    <div className={`inline-flex items-center gap-1.5 rounded-none border px-2.5 py-1 text-xs uppercase tracking-[0.16em] ${LEGALITY_OPTIONS.find((o) => o.value === cardForm.legalityStatus)?.color || ""}`}>
                      {LEGALITY_OPTIONS.find((o) => o.value === cardForm.legalityStatus)?.label || cardForm.legalityStatus}
                    </div>
                  </div>
                </CardContent>
              </Card>
 
              {/* Ajuda de sintaxe */}
              <Card className="panel-cut rounded-none border-white/10 bg-slate-900/60">
                <CardContent className="space-y-3 p-5">
                  <h3 className="font-heading text-xl uppercase">Sintaxe</h3>
                  <ul className="space-y-2 text-xs leading-6 text-slate-500">
                    <li><span className="text-slate-400">Envolva keywords em</span> <code className="rounded bg-white/8 px-1 py-0.5 text-primary">&lt; &gt;</code></li>
                    <li><code className="text-slate-300">&lt;High-Maneuver&gt;</code></li>
                    <li><code className="text-slate-300">&lt;Deploy&gt;: Draw 1.</code></li>
                    <li><code className="text-slate-300">&lt;During Link&gt;: gains &lt;Blocker&gt;.</code></li>
                    <li><span className="text-slate-600">Alias:</span> <code className="text-slate-400">&lt;While Paired&gt;</code> → <code className="text-slate-300">During Pair</code></li>
                    <li><span className="text-slate-600">Valor numérico:</span> <code className="text-slate-300">&lt;Repair 3&gt;</code></li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
 
          {/* Rodapé */}
          <div className="flex items-center justify-between border-t border-white/8 pt-4">
            <p className="text-xs text-slate-600">
              {(effectPreview.triggerKeywords.length + effectPreview.effectKeywords.length) > 0
                ? `${effectPreview.keywordTags.length} keyword${effectPreview.keywordTags.length !== 1 ? "s" : ""} detectada${effectPreview.keywordTags.length !== 1 ? "s" : ""}`
                : "Nenhuma keyword detectada"}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="rounded-none" onClick={() => setCardModalOpen(false)}>Cancelar</Button>
              <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveCard} disabled={saving}>
                {saving ? "Salvando…" : (cardForm.id ? "Salvar alterações" : "Criar carta")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PortalShell>
  );
}