/* Admin v9.4 — parserização semântica + validação robusta + modal redesenhada. */
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Copy, Pencil, Plus, Search, Star, Trash2, Upload, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
 
import { PortalShell } from "@/components/layout/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { extractLinkSuggestions, getKeywordIcon, getKeywordStyleClass, parseCardEffects } from "@/lib/gundam-card-effects";
import { AP_HP_OPTIONS, ART_RARITY_OPTIONS, CARD_TYPE_OPTIONS, COLOR_OPTIONS, COST_LEVEL_OPTIONS, LINK_SUGGESTION_TRAITS, PRODUCT_TYPE_OPTIONS, RARITY_OPTIONS, SOURCE_TITLE_OPTIONS, TRAIT_OPTIONS } from "@/lib/gundam-catalog";
 
/* ── Tipos ─────────────────────────────────────────────────────────────── */
 
type AdminUser = { id: string; displayName: string; email: string; role: string; isActive: boolean };
type AdminSet = any;
type AdminCard = any;
type AdminRuling = any;
type AdminTaxonomy = { id: string; kind: "TRAIT" | "SOURCE_TITLE"; name: string; description?: string | null };
type CardFilterOptions = { colors: string[]; cardTypes: string[]; rarities: string[]; statuses: string[]; media: string[]; traits: string[]; sets: Array<{ code: string; namePt?: string | null; nameEn: string }>; missingRelationCounts: { PILOT: number; UNIT: number; COMMAND: number } };
type ActiveCardFilter = { key: keyof CardCatalogQuery; label: string; value: string };
type CardCatalogQuery = { q: string; color: string; cardType: string; setCode: string; rarity: string; ap: string; hp: string; cost: string; level: string; trait: string; media: string; link: string; relation: string; status: string; sort: string; page: number; pageSize: number };
const EMPTY_CARD_FILTERS: CardFilterOptions = { colors: [], cardTypes: [], rarities: [], statuses: [], media: [], traits: [], sets: [], missingRelationCounts: { PILOT: 0, UNIT: 0, COMMAND: 0 } };
const CATALOG_CARD_TYPE_FILTERS = [
  { value: "UNIT", label: "Unidade" },
  { value: "PILOT", label: "Piloto" },
  { value: "COMMAND", label: "Comando (inclui comandos com piloto)" },
  { value: "BASE", label: "Base" },
  { value: "RESOURCE", label: "Recurso" },
  { value: "EX_BASE", label: "Base EX" },
  { value: "EX_RESOURCE", label: "Recurso EX" },
] as const;
const cardTypeLabel = (value?: string | null) => CARD_TYPE_OPTIONS.find((item) => item.value === value)?.label || value || "—";

type ArtVariantForm = {
  id: string;
  label: string;
  url: string;
  thumbUrl: string;
  sourceUrl: string;
  rarity: string;
  isPrimary: boolean;
};
 
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
  traits: string;
  linkText: string;
  sourceTitle: string;
  officialUrl: string;
  arts: ArtVariantForm[];
  activeArtId: string;
  legalityStatus: string;
};
 
/* ── Constantes ─────────────────────────────────────────────────────────── */
 
const LEGALITY_OPTIONS = [
  { value: "legal",         label: "Legal",          color: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" },
  { value: "restricted",   label: "Restrita",        color: "text-amber-400 border-amber-400/40 bg-amber-400/10" },
  { value: "banned",       label: "Banida",          color: "text-red-400 border-red-400/40 bg-red-400/10" },
  { value: "not_in_format",label: "Fora do formato", color: "text-slate-400 border-white/20 bg-white/5" },
];

/* Convenção de direção por tipo de relação editorial — ver docs/10-convencoes-relacoes-cartas.md.
   "origem" é a carta sendo editada agora; "destino" é a carta buscada no campo acima. */
const RELATION_TYPE_HINTS: Record<string, string> = {
  PILOT_OF: "Origem = Piloto → destino = Unidade que ele pilota. Use só quando a ligação vier de fonte oficial (Link Condition do jogo) ou de continuidade confirmada do anime/mangá — não para \"combina bem com\".",
  SUPPORTS: "Origem = carta que dá suporte → destino = carta apoiada. Típico de Command que cita um Piloto/Unidade específico no efeito. Não use para sinergia genérica de arquétipo — isso é SAME_ARCHETYPE.",
  UPGRADE_OF: "Origem = Upgrade/Command de equipamento → destino = Unidade/carta base que ele modifica. Exige que o efeito da origem altere diretamente a carta de destino (ex.: Striker Pack em um Strike Gundam).",
  SAME_ARCHETYPE: "Sem direção fixa. Cartas do mesmo grupo temático/mecânico (mesma facção, mesmo time, mesma sinergia de trait) sem vínculo de piloto, upgrade ou suporte direto entre elas.",
  STORY_RELATED: "Sem direção fixa. Aparecem juntas na narrativa do anime/mangá (rivais, aliados, família) mas sem nenhuma mecânica de jogo em comum. Última opção — prefira um tipo mais específico se ele se aplicar.",
};
 
const emptySetForm = { id: "", code: "", nameEn: "", namePt: "", officialUrl: "", coverImage: "", galleryImages: [] as string[], releaseDate: "", shortDescription: "", setType: "BOOSTER_PACK", productCodeAlt: "", msrpUsd: "", contentSummaryPt: "", contentSummaryEn: "", raritySummary: "", productNotes: "", sourceTitles: "" }; 
const emptyRuleForm = { title: "", sourceType: "OFFICIAL_RULES", questionPt: "", answerPt: "", questionEn: "", answerEn: "", relatedKeyword: "", originalUrl: "", cardId: "" };
const defaultArtState = normalizeArtState([createArtVariant({ label: "Arte 1", rarity: "C", isPrimary: true })], undefined, "C");
const emptyCardForm: CardForm = { id: "", setId: "", code: "", rarity: "C", cost: "0", level: "0", cardType: "UNIT", nameEn: "", namePt: "", burstEnabled: false, burstEffect: "", ap: "-", hp: "-", effectText: "", pilotName: "", color: "Blue", traits: "", linkText: "", sourceTitle: "", officialUrl: "", arts: defaultArtState.arts, activeArtId: defaultArtState.activeArtId, legalityStatus: "legal" };
 
/* ── Helpers ─────────────────────────────────────────────────────────────── */
 
const csvToArray = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
const semicolonToArray = (value: string) => value.split(";").map((item) => item.trim()).filter(Boolean);
const arrayToCsv = (value?: string[]) => (value || []).filter(Boolean).join(", ");
function createArtId() {
  return `art-${Math.random().toString(36).slice(2, 10)}`;
}

function createArtVariant(seed: Partial<ArtVariantForm> = {}): ArtVariantForm {
  return {
    id: seed.id || createArtId(),
    label: seed.label || "",
    url: seed.url || "",
    thumbUrl: seed.thumbUrl || "",
    sourceUrl: seed.sourceUrl || "",
    rarity: seed.rarity || "C",
    isPrimary: Boolean(seed.isPrimary ?? false),
  };
}

function normalizeArtState(arts: ArtVariantForm[], activeArtId?: string, fallbackRarity = "C") {
  const seeded = arts.length ? arts.map((art) => createArtVariant(art)) : [createArtVariant({ rarity: fallbackRarity, isPrimary: true })];
  let primaryIndex = seeded.findIndex((art) => art.isPrimary);
  if (primaryIndex < 0) primaryIndex = seeded.findIndex((art) => art.url.trim().length > 0);
  if (primaryIndex < 0) primaryIndex = 0;
  const normalized = seeded.map((art, index) => ({ ...art, isPrimary: index === primaryIndex }));
  return {
    arts: normalized,
    activeArtId: normalized.find((art) => art.id === activeArtId)?.id || normalized[primaryIndex]?.id || normalized[0]?.id || "",
  };
}

function mapCardArts(card?: AdminCard) {
  if (!card) return normalizeArtState([createArtVariant({ label: "Arte 1", rarity: "C", isPrimary: true })], undefined, "C").arts;

  const rawVariants = Array.isArray(card.metadataJson?.artVariants) ? card.metadataJson.artVariants : [];
  const mappedVariants = rawVariants
    .map((item: any, index: number) => createArtVariant({
      id: String(item?.id || `art-${index + 1}`),
      label: String(item?.label || `Arte ${index + 1}`),
      url: String(item?.url || item?.imageUrl || ""),
      thumbUrl: String(item?.thumbUrl || ""),
      sourceUrl: String(item?.sourceUrl || item?.imageSourceUrl || ""),
      rarity: String(item?.rarity || card.rarity || "C"),
      isPrimary: Boolean(item?.isPrimary),
    }))
    .filter((item) => item.url || item.thumbUrl || item.sourceUrl || item.label || item.isPrimary);

  if (mappedVariants.length) return normalizeArtState(mappedVariants, undefined, String(card.rarity || "C")).arts;

  if (card.imageUrl || card.thumbUrl || card.imageSourceUrl) {
    return normalizeArtState([createArtVariant({
      label: "Arte 1",
      url: card.imageUrl || "",
      thumbUrl: card.thumbUrl || "",
      sourceUrl: card.imageSourceUrl || "",
      rarity: String(card.rarity || "C"),
      isPrimary: true,
    })], undefined, String(card.rarity || "C")).arts;
  }

  return normalizeArtState([createArtVariant({ label: "Arte 1", rarity: String(card.rarity || "C"), isPrimary: true })], undefined, String(card.rarity || "C")).arts;
}
 
function mapSetToForm(set?: AdminSet) {
  if (!set) return emptySetForm;
  const galleryImages = Array.isArray(set.metadataJson?.galleryImages) ? set.metadataJson.galleryImages.filter((item: unknown) => typeof item === "string") : (set.coverImage ? [set.coverImage] : []);
  return { id: set.id, code: set.code, nameEn: set.nameEn || "", namePt: set.namePt || "", officialUrl: set.officialUrl || "", coverImage: set.coverImage || galleryImages[0] || "", galleryImages, releaseDate: set.releaseDate ? new Date(set.releaseDate).toISOString().slice(0, 10) : "", shortDescription: set.shortDescription || "", setType: set.setType || "BOOSTER_PACK", productCodeAlt: set.productCodeAlt || "", msrpUsd: set.msrpUsd != null ? String(set.msrpUsd) : "", contentSummaryPt: set.contentSummaryPt || "", contentSummaryEn: set.contentSummaryEn || "", raritySummary: set.raritySummary || "", productNotes: set.productNotes || "", sourceTitles: arrayToCsv(set.sourceTitles) }; 
}
 
function mapCardToForm(card?: AdminCard): CardForm {
  if (!card) return emptyCardForm;
  const sections = Array.isArray(card.textSectionsJson) ? card.textSectionsJson : [];
  const burstSection = sections.find((item: any) => String(item?.kind || "").toLowerCase() === "burst");
  const effectSection = sections.find((item: any) => String(item?.kind || "").toLowerCase() === "effect") || sections.find((item: any) => item?.textPt || item?.textEn);
  const arts = mapCardArts(card);
  const activeArtId = arts.find((item) => item.isPrimary)?.id || arts[0]?.id || "";
  return { id: card.id, setId: card.set?.id || "", code: card.code || "", rarity: ["C", "U", "R", "LR"].includes(card.rarity) ? card.rarity : "C", cost: card.cost != null ? String(card.cost) : "0", level: card.level != null ? String(card.level) : "0", cardType: card.cardType === "COMMAND_PILOT" ? "COMMAND" : (card.cardType || "UNIT"), nameEn: card.nameEn || "", namePt: "", burstEnabled: Boolean(card.hasBurst || burstSection?.textPt || burstSection?.textEn), burstEffect: burstSection?.textPt || burstSection?.textEn || "", ap: card.ap != null ? String(card.ap) : "-", hp: card.hp != null ? String(card.hp) : "-", effectText: effectSection?.textPt || effectSection?.textEn || card.effectPt || card.effectEn || "", pilotName: card.pilotName || "", color: card.color || "Blue", traits: (card.traits || []).join("; "), linkText: card.linkText || "", sourceTitle: card.sourceTitle || card.series || "", officialUrl: card.officialUrl || "", arts, activeArtId, legalityStatus: card.legalityStatus || "legal" };
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

function FieldBlock({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] leading-4 text-slate-600">{hint}</span> : null}
    </label>
  );
}

function typeUsesStats(type: string) {
  return ["UNIT", "UNIT_TOKEN", "PILOT", "COMMAND_PILOT", "BASE", "EX_BASE"].includes(type);
}

function typeUsesPilotName(type: string) {
  return ["PILOT", "COMMAND_PILOT"].includes(type);
}

function typeUsesBurst(type: string) {
  return !["RESOURCE", "EX_RESOURCE"].includes(type);
}

function typeUsesEffects(type: string) {
  return !["RESOURCE", "EX_RESOURCE"].includes(type);
}
 
/* ── Página ─────────────────────────────────────────────────────────────── */
 
export default function AdminPage() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const adminSection = useMemo(() => {
    const path = location.split("?")[0];
    const value = path.replace(/^\/admin\/?/, "").split("/")[0];
    const aliases: Record<string, string> = { collections: "sets", traits: "taxonomies", media: "taxonomies", rulings: "rules", events: "events", decks: "decks" };
    return aliases[value] || value || "dashboard";
  }, [location]);
  const sectionLabel = useMemo(() => ({ dashboard: "Visão geral", users: "Usuários", cards: "Cartas", sets: "Coleções", taxonomies: location.includes("/admin/media") ? "Mídias" : "Traits", rules: "Rulings", decks: "Decks", events: "Eventos" }[adminSection] || "Gestão"), [adminSection, location]);
  const isMediaManagement = location.split("?")[0] === "/admin/media";
  const urlCardQuery = useMemo<CardCatalogQuery>(() => {
    const params = new URLSearchParams(location.split("?")[1] || "");
    const intParam = (key: string, fallback: number) => {
      const value = Number.parseInt(params.get(key) || "", 10);
      return Number.isFinite(value) && value > 0 ? value : fallback;
    };
    return {
      q: params.get("q") || "", color: params.get("color") || "", cardType: params.get("cardType") || "", setCode: params.get("setCode") || "",
      rarity: params.get("rarity") || "", ap: params.get("ap") || "", hp: params.get("hp") || "", cost: params.get("cost") || "", level: params.get("level") || "",
      trait: params.get("trait") || "", media: params.get("media") || "", link: params.get("link") || "", relation: params.get("relation") || "", status: params.get("status") || "",
      sort: params.get("sort") || "code_asc", page: intParam("page", 1), pageSize: [25, 50, 80, 100].includes(intParam("pageSize", 50)) ? intParam("pageSize", 50) : 50,
    };
  }, [location]);
  const [cardQuery, setCardQuery] = useState<CardCatalogQuery>(() => urlCardQuery);
  useEffect(() => { setCardQuery(urlCardQuery); }, [urlCardQuery]);

  const updateCardQuery = (patch: Partial<CardCatalogQuery>) => {
    const next = { ...cardQuery, ...patch };
    setCardQuery(next);
    const params = new URLSearchParams();
    (Object.entries(next) as Array<[keyof CardCatalogQuery, string | number]>).forEach(([key, value]) => {
      const defaults: Partial<CardCatalogQuery> = { q: "", color: "", cardType: "", setCode: "", rarity: "", ap: "", hp: "", cost: "", level: "", trait: "", media: "", link: "", relation: "", status: "", sort: "code_asc", page: 1, pageSize: 50 };
      if (value !== defaults[key]) params.set(key, String(value));
    });
    setLocation(`/admin/cards${params.size ? `?${params.toString()}` : ""}`);
  };
 
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sets, setSets] = useState<AdminSet[]>([]);
  const [cards, setCards] = useState<AdminCard[]>([]);
  const [cardTotal, setCardTotal] = useState(0);
  const [cardTotalPages, setCardTotalPages] = useState(1);
  const [cardFilterOptions, setCardFilterOptions] = useState<CardFilterOptions>(EMPTY_CARD_FILTERS);
  const [cardFiltersLoading, setCardFiltersLoading] = useState(false);
  const [cardFiltersError, setCardFiltersError] = useState<string | null>(null);
  const [rules, setRules] = useState<AdminRuling[]>([]);
  const [taxonomies, setTaxonomies] = useState<AdminTaxonomy[]>([]);
  const [setForm, setSetForm] = useState(emptySetForm);
  const [cardForm, setCardForm] = useState<CardForm>(emptyCardForm);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const [taxonomyForm, setTaxonomyForm] = useState({ kind: "TRAIT" as "TRAIT" | "SOURCE_TITLE", name: "", description: "" });
  const [setModalOpen, setSetModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [setSearch, setSetSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quickPilotOpen, setQuickPilotOpen] = useState(false);
  const [quickPilotForm, setQuickPilotForm] = useState({ code: "", nameEn: "", trait: "", sourceTitle: "" });
  const [cardRelations, setCardRelations] = useState<any[]>([]);
  const [relationSearch, setRelationSearch] = useState("");
  const [relationCandidates, setRelationCandidates] = useState<AdminCard[]>([]);
  const [relationDraft, setRelationDraft] = useState({ targetCardId: "", relationType: "PILOT_OF", notePt: "", sourceUrl: "" });
  const artUploadInputRef = useRef<HTMLInputElement | null>(null);
  const setGalleryUploadInputRef = useRef<HTMLInputElement | null>(null);
 
  const loadAdminCards = async () => {
    const { page, pageSize, ...filters } = cardQuery;
    const result = await api.listCardsPage(filters, { page, pageSize });
    if (result.total > 0 && cardQuery.page > result.totalPages) {
      updateCardQuery({ page: result.totalPages });
      return;
    }
    setCards(result.items);
    setCardTotal(result.total);
    setCardTotalPages(result.totalPages);
  };

  const loadCardFilterOptions = async () => {
    setCardFiltersLoading(true);
    try {
      const result = await api.getCardFilters();
      setCardFilterOptions(result);
      setCardFiltersError(null);
    } catch (error: any) {
      setCardFiltersError(error?.message || "Não foi possível atualizar as opções dinâmicas.");
    } finally {
      setCardFiltersLoading(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([api.listAdminUsers(), api.listSets(), api.listRulings(), api.listTaxonomies()]);
      const [usersResult, setsResult, rulesResult, taxonomiesResult] = results;
      if (usersResult.status === "fulfilled") setUsers(usersResult.value);
      if (setsResult.status === "fulfilled") setSets(setsResult.value);
      if (rulesResult.status === "fulfilled") setRules(rulesResult.value);
      if (taxonomiesResult.status === "fulfilled") setTaxonomies(taxonomiesResult.value);

      const failedResources = results.map((result, index) => result.status === "rejected" ? ["usuários", "coleções", "rulings", "taxonomias"][index] : null).filter(Boolean);
      if (failedResources.length) {
        const firstError = results.find((result): result is PromiseRejectedResult => result.status === "rejected")?.reason;
        toast.error(`Não foi possível carregar: ${failedResources.join(", ")}. ${firstError?.message || "Verifique a API e o banco."}`);
      }
    } finally { setLoading(false); }
  };
 
  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    loadAll().catch((error) => toast.error(error?.message || "Erro ao carregar a área administrativa."));
    loadCardFilterOptions();
  }, [user?.role]);
  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    const timer = window.setTimeout(() => {
      loadAdminCards().catch((error) => toast.error(error?.message || "Erro ao buscar cartas."));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [cardQuery, user?.role]);

 
  const visibleSets = useMemo(() => { const term = setSearch.trim().toLowerCase(); return term ? sets.filter((set) => [set.code, set.namePt, set.nameEn, set.setType].filter(Boolean).some((item) => String(item).toLowerCase().includes(term))) : sets; }, [setSearch, sets]);
  const availableCardFilters = useMemo<CardFilterOptions>(() => ({
    colors: Array.from(new Set([...COLOR_OPTIONS, ...cardFilterOptions.colors])).filter(Boolean).sort(),
    cardTypes: CATALOG_CARD_TYPE_FILTERS.map((item) => item.value),
    rarities: Array.from(new Set([...RARITY_OPTIONS, ...cardFilterOptions.rarities])).filter(Boolean).sort(),
    statuses: Array.from(new Set([...LEGALITY_OPTIONS.map((item) => item.value), ...cardFilterOptions.statuses])).filter(Boolean).sort(),
    media: Array.from(new Set([...taxonomies.filter((item) => item.kind === "SOURCE_TITLE").map((item) => item.name), ...cardFilterOptions.media])).filter(Boolean).sort(),
    traits: Array.from(new Set([...taxonomies.filter((item) => item.kind === "TRAIT").map((item) => item.name), ...cardFilterOptions.traits])).filter(Boolean).sort(),
    sets: cardFilterOptions.sets.length ? cardFilterOptions.sets : sets.map((set) => ({ code: set.code, namePt: set.namePt, nameEn: set.nameEn })),
    missingRelationCounts: cardFilterOptions.missingRelationCounts,
  }), [cardFilterOptions, sets, taxonomies]);
  const activeCardFilters = useMemo<ActiveCardFilter[]>(() => {
    const labels: Partial<Record<keyof CardCatalogQuery, string>> = { q: "Busca", color: "Cor", cardType: "Tipo", setCode: "Coleção", rarity: "Raridade", ap: "AP", hp: "HP", cost: "Custo", level: "Level", trait: "Trait", media: "Mídia", link: "Link/piloto", relation: "Relação", status: "Status" };
    return (Object.entries(labels) as Array<[keyof CardCatalogQuery, string]>).flatMap(([key, label]) => {
      const value = cardQuery[key];
      if (!value) return [];
      const text = key === "link" ? ({ has: "Com Link/requisito", "pilot-card": "Cartas Piloto", "pilot-reference": "Comandos com referência a piloto", none: "Sem Link/requisito" }[String(value)] || String(value)) : key === "relation" ? ({ missing: "Sem relação confirmada", confirmed: "Com relação confirmada" }[String(value)] || String(value)) : key === "status" ? (LEGALITY_OPTIONS.find((item) => item.value === value)?.label || String(value)) : String(value);
      return [{ key, label, value: text }];
    });
  }, [cardQuery]);
  const cardPageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(cardQuery.page - 2, Math.max(1, cardTotalPages - 4)));
    return Array.from({ length: Math.min(5, cardTotalPages) }, (_, index) => start + index);
  }, [cardQuery.page, cardTotalPages]);
 
  const effectPreview = useMemo(() => parseCardEffects(cardForm.effectText, cardForm.burstEnabled ? cardForm.burstEffect : ""), [cardForm.effectText, cardForm.burstEffect, cardForm.burstEnabled]);
  const showStats = typeUsesStats(cardForm.cardType);
  const showPilotName = typeUsesPilotName(cardForm.cardType);
  const showBurst = typeUsesBurst(cardForm.cardType);
  const showEffects = typeUsesEffects(cardForm.cardType);
  const taxonomyTraits = useMemo(() => taxonomies.filter((item) => item.kind === "TRAIT").map((item) => item.name), [taxonomies]);
  const taxonomySources = useMemo(() => taxonomies.filter((item) => item.kind === "SOURCE_TITLE").map((item) => item.name), [taxonomies]);
  const traitOptions = useMemo(() => Array.from(new Set([...TRAIT_OPTIONS, ...taxonomyTraits])).sort(), [taxonomyTraits]);
  const sourceTitleOptions = useMemo(() => Array.from(new Set([...SOURCE_TITLE_OPTIONS, ...taxonomySources])).sort(), [taxonomySources]);
  const selectedArtIndex = useMemo(() => {
    const found = cardForm.arts.findIndex((item) => item.id === cardForm.activeArtId);
    return found >= 0 ? found : 0;
  }, [cardForm.activeArtId, cardForm.arts]);
  const selectedArt = cardForm.arts[selectedArtIndex] || null;
  const linkSuggestions = useMemo(() => {
    const seeded = Array.from(new Set([...LINK_SUGGESTION_TRAITS, ...taxonomyTraits])).map((item) => `${item} trait`);
    const detected = extractLinkSuggestions(cards.map((card) => ({
      ...card,
      keywordMeta: card.metadataJson?.keywordMeta || [],
    })));
    return Array.from(new Set([...seeded, ...detected])).sort();
  }, [cards, taxonomyTraits]);
 
  const openSetModal = (set?: AdminSet) => { setSetForm(mapSetToForm(set)); setSetModalOpen(true); };
  const openCardModal = (card?: AdminCard) => {
    setCardForm(mapCardToForm(card));
    setCardRelations([]);
    setRelationSearch("");
    setRelationCandidates([]);
    setRelationDraft({ targetCardId: "", relationType: "PILOT_OF", notePt: "", sourceUrl: "" });
    setCardModalOpen(true);
    if (card?.id) api.getCardRelations(card.id).then((result) => setCardRelations([...result.outgoing.map((item) => ({ ...item, direction: "outgoing", relatedCard: item.targetCard })), ...result.incoming.map((item) => ({ ...item, direction: "incoming", relatedCard: item.sourceCard }))])).catch(() => toast.error("Não foi possível carregar as relações editoriais."));
  };

  useEffect(() => {
    if (!cardModalOpen || !cardForm.id || relationSearch.trim().length < 2) { setRelationCandidates([]); return; }
    const timer = window.setTimeout(() => {
      api.listCardsPage({ q: relationSearch.trim(), sort: "code_asc" }, { page: 1, pageSize: 12 })
        .then((result) => setRelationCandidates(result.items.filter((item) => item.id !== cardForm.id)))
        .catch(() => setRelationCandidates([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [cardModalOpen, cardForm.id, relationSearch]);

  const saveCardRelation = async () => {
    if (!cardForm.id) { toast.error("Salve a carta antes de criar relações."); return; }
    if (!relationDraft.targetCardId) { toast.error("Selecione a carta relacionada."); return; }
    setSaving(true);
    try {
      await api.createCardRelation(cardForm.id, { ...relationDraft, notePt: relationDraft.notePt || null, sourceUrl: relationDraft.sourceUrl || null });
      const result = await api.getCardRelations(cardForm.id);
      setCardRelations([...result.outgoing.map((item) => ({ ...item, direction: "outgoing", relatedCard: item.targetCard })), ...result.incoming.map((item) => ({ ...item, direction: "incoming", relatedCard: item.sourceCard }))]);
      setRelationSearch(""); setRelationCandidates([]); setRelationDraft({ targetCardId: "", relationType: "PILOT_OF", notePt: "", sourceUrl: "" });
      toast.success("Relação editorial salva.");
    } catch (error: any) { toast.error(error?.message || "Erro ao salvar relação."); }
    finally { setSaving(false); }
  };

  const deleteCardRelation = async (relation: any) => {
    if (!cardForm.id || relation.direction !== "outgoing") { toast.error("Relações recebidas são gerenciadas na carta de origem."); return; }
    await api.deleteCardRelation(cardForm.id, relation.id);
    setCardRelations((current) => current.filter((item) => item.id !== relation.id));
    toast.success("Relação editorial ocultada.");
  };

  const syncArtState = (arts: ArtVariantForm[], activeArtId?: string, fallbackRarity?: string) => normalizeArtState(arts, activeArtId, fallbackRarity || cardForm.rarity || "C");
  const setArtState = (updater: (current: ArtVariantForm[]) => ArtVariantForm[], preferredActiveId?: string) => {
    setCardForm((current) => {
      const nextArts = updater(current.arts);
      return { ...current, ...normalizeArtState(nextArts, preferredActiveId || current.activeArtId, current.rarity || "C") };
    });
  };
  const updateSelectedArt = (patch: Partial<ArtVariantForm>) => {
    if (!selectedArt) return;
    setArtState((arts) => arts.map((item) => item.id === selectedArt.id ? { ...item, ...patch } : item), selectedArt.id);
  };
  const addArtVariant = () => {
    const next = createArtVariant({ label: `Arte ${cardForm.arts.length + 1}`, rarity: cardForm.rarity || "C", isPrimary: cardForm.arts.length === 0 });
    setArtState((arts) => [...arts, next], next.id);
  };
  const duplicateSelectedArt = () => {
    if (!selectedArt) return;
    const duplicate = createArtVariant({ ...selectedArt, id: undefined, label: `${selectedArt.label || `Arte ${selectedArtIndex + 1}`} (cópia)`, isPrimary: false });
    setArtState((arts) => {
      const next = [...arts];
      next.splice(selectedArtIndex + 1, 0, duplicate);
      return next;
    }, duplicate.id);
  };
  const removeSelectedArt = () => {
    if (!selectedArt) return;
    setCardForm((current) => {
      const remaining = current.arts.filter((item) => item.id !== selectedArt.id);
      const nextState = normalizeArtState(remaining, remaining[0]?.id, current.rarity || "C");
      return { ...current, ...nextState };
    });
  };
  const moveSelectedArt = (direction: -1 | 1) => {
    if (!selectedArt) return;
    setArtState((arts) => {
      const currentIndex = arts.findIndex((item) => item.id === selectedArt.id);
      const targetIndex = currentIndex + direction;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= arts.length) return arts;
      const next = [...arts];
      const [moved] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    }, selectedArt.id);
  };
  const markPrimaryArt = () => {
    if (!selectedArt) return;
    setArtState((arts) => arts.map((item) => ({ ...item, isPrimary: item.id === selectedArt.id })), selectedArt.id);
  };
  const triggerArtUpload = () => artUploadInputRef.current?.click();
  const handleArtUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedArt) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("cardCode", cardForm.code || "uncataloged");
      formData.append("artId", selectedArt.id);
      formData.append("label", selectedArt.label || `Arte ${selectedArtIndex + 1}`);
      const uploaded = await api.uploadCardImage(formData);
      const storageSource = uploaded.storageKey ? `${uploaded.storageDriver || "storage"}:${uploaded.storageKey}` : uploaded.imageSourceUrl || "";
      setArtState((arts) => arts.map((item) => item.id === selectedArt.id ? { ...item, url: uploaded.imageUrl, sourceUrl: item.sourceUrl || storageSource } : item), selectedArt.id);
      toast.success("Arte enviada para a biblioteca da carta.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao subir imagem da arte.");
    } finally {
      if (event.target) event.target.value = "";
      setSaving(false);
    }
  };
 
  const handleSetGalleryUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setSaving(true);
    try {
      const uploadedUrls = await Promise.all(files.map(async (file) => {
        const formData = new FormData();
        formData.append("image", file);
        formData.append("entity", "collections");
        formData.append("referenceCode", setForm.code || "collection");
        formData.append("label", "gallery");
        return (await api.uploadAssetImage(formData)).imageUrl;
      }));
      setSetForm((current) => {
        const galleryImages = [...current.galleryImages, ...uploadedUrls];
        return { ...current, galleryImages, coverImage: current.coverImage || galleryImages[0] || "" };
      });
      toast.success(`${uploadedUrls.length} imagem(ns) adicionada(s) à galeria.`);
    } catch (err: any) { toast.error(err?.message || "Erro ao enviar imagens da coleção."); }
    finally { if (event.target) event.target.value = ""; setSaving(false); }
  };

  const saveSet = async () => {
    if (!setForm.code.trim()) { toast.error("Código da coleção é obrigatório."); return; }
    if (!setForm.nameEn.trim()) { toast.error("Nome em inglês é obrigatório."); return; }
    setSaving(true);
    try {
      const payload = { code: setForm.code.trim(), nameEn: setForm.nameEn.trim(), namePt: setForm.namePt.trim() || null, officialUrl: setForm.officialUrl.trim() || null, coverImage: setForm.coverImage.trim() || setForm.galleryImages[0] || null, metadataJson: { galleryImages: setForm.galleryImages.filter(Boolean) }, releaseDate: setForm.releaseDate ? new Date(`${setForm.releaseDate}T00:00:00.000Z`).toISOString() : null, shortDescription: setForm.shortDescription.trim() || null, setType: setForm.setType, productCodeAlt: setForm.productCodeAlt.trim() || null, msrpUsd: setForm.msrpUsd ? Number(setForm.msrpUsd) : null, contentSummaryPt: setForm.contentSummaryPt.trim() || null, contentSummaryEn: setForm.contentSummaryEn.trim() || null, raritySummary: setForm.raritySummary.trim() || null, productNotes: setForm.productNotes.trim() || null, sourceTitles: csvToArray(setForm.sourceTitles) };
      if (setForm.id) await api.updateSet(setForm.id, payload); else await api.createSet(payload);
      setSetModalOpen(false); setSetForm(emptySetForm); await loadAll(); await loadAdminCards();
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
      const artState = syncArtState(cardForm.arts, cardForm.activeArtId, cardForm.rarity);
      const persistedArts = artState.arts
        .map((art, index) => ({
          id: art.id,
          label: art.label.trim() || `Arte ${index + 1}`,
          url: art.url.trim(),
          thumbUrl: art.thumbUrl.trim(),
          sourceUrl: art.sourceUrl.trim(),
          rarity: art.rarity || cardForm.rarity,
          isPrimary: art.isPrimary,
          position: index,
        }))
        .filter((art) => art.url || art.thumbUrl || art.sourceUrl || art.label);
      const primaryArt = persistedArts.find((art) => art.isPrimary) || persistedArts[0] || null;
      const payload = { code: cardForm.code.trim(), rarity: cardForm.rarity, cost: Number(cardForm.cost), level: Number(cardForm.level), cardType: cardForm.cardType, nameEn: cardForm.nameEn.trim(), namePt: null, effectPt: showEffects ? cardForm.effectText.trim() || null : null, burstEffectPt: showBurst && cardForm.burstEnabled ? cardForm.burstEffect.trim() || null : null, ap: showStats && cardForm.ap !== "-" ? Number(cardForm.ap) : null, hp: showStats && cardForm.hp !== "-" ? Number(cardForm.hp) : null, pilotName: showPilotName ? cardForm.pilotName.trim() || null : null, color: cardForm.color || null, setId: cardForm.setId || null, imageUrl: primaryArt?.url || null, linkText: cardForm.linkText.trim() || null, traits: semicolonToArray(cardForm.traits), trait: semicolonToArray(cardForm.traits).join(" | ") || null, sourceTitle: cardForm.sourceTitle.trim() || null, series: cardForm.sourceTitle.trim() || null, officialUrl: cardForm.officialUrl.trim() || null, thumbUrl: primaryArt?.thumbUrl || null, imageSourceUrl: primaryArt?.sourceUrl || cardForm.officialUrl.trim() || null, metadataJson: { artVariants: persistedArts }, legalityStatus: cardForm.legalityStatus || "legal", triggerKeywords: parsed.triggerKeywords, effectKeywords: parsed.effectKeywords, keywordTags: parsed.keywordTags, hasBurst: parsed.hasBurst, hasMain: parsed.hasMain, hasAction: parsed.hasAction, oncePerTurn: parsed.oncePerTurn, textSectionsJson: parsed.sections, cardSubtypes: [] };
      if (cardForm.id) await api.updateCard(cardForm.id, payload); else await api.createCard(payload);
      setCardModalOpen(false); setCardForm(emptyCardForm); await loadAll(); await loadAdminCards();
      toast.success(cardForm.id ? "Carta atualizada." : "Carta criada.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar carta.");
    } finally { setSaving(false); }
  };
 
  const createQuickPilot = async () => {
    if (!quickPilotForm.code.trim() || !quickPilotForm.nameEn.trim()) { toast.error("Código e nome do piloto são obrigatórios."); return; }
    setSaving(true);
    try {
      await api.createCard({
        code: quickPilotForm.code.trim(),
        rarity: "C",
        cost: 0,
        level: 0,
        cardType: "PILOT",
        nameEn: quickPilotForm.nameEn.trim(),
        namePt: null,
        pilotName: quickPilotForm.nameEn.trim(),
        color: cardForm.color || null,
        setId: cardForm.setId || null,
        traits: semicolonToArray(quickPilotForm.trait),
        trait: semicolonToArray(quickPilotForm.trait).join(" | ") || null,
        sourceTitle: quickPilotForm.sourceTitle || cardForm.sourceTitle || null,
        series: quickPilotForm.sourceTitle || cardForm.sourceTitle || null,
        triggerKeywords: [], effectKeywords: [], keywordTags: [], hasBurst: false, hasMain: false, hasAction: false, oncePerTurn: false, textSectionsJson: [], cardSubtypes: [],
      });
      setCardForm((current) => ({ ...current, linkText: quickPilotForm.nameEn.trim() }));
      setQuickPilotOpen(false);
      setQuickPilotForm({ code: "", nameEn: "", trait: "", sourceTitle: "" });
      await loadAll(); await loadAdminCards();
      toast.success("Piloto criado e vinculado no campo Link.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar piloto rápido.");
    } finally { setSaving(false); }
  };

  const deleteSet = async (set: AdminSet) => {
    if (!window.confirm(`Excluir ${set.code}?`)) return;
    await api.deleteSet(set.id); await loadAll(); await loadAdminCards(); toast.success("Coleção ocultada. O registro foi preservado.");
  };
 
  const deleteCard = async (card: AdminCard) => {
    if (!window.confirm(`Excluir ${card.code}?`)) return;
    await api.deleteCard(card.id); await loadAll(); await loadAdminCards(); toast.success("Carta ocultada. O registro foi preservado.");
  };
  const saveTaxonomy = async () => {
    if (!taxonomyForm.name.trim()) { toast.error("Nome é obrigatório."); return; }
    await api.createTaxonomy({ kind: taxonomyForm.kind, name: taxonomyForm.name.trim(), description: taxonomyForm.description.trim() || null });
    setTaxonomyForm({ kind: taxonomyForm.kind, name: "", description: "" });
    await loadAll(); await loadAdminCards();
    toast.success(taxonomyForm.kind === "TRAIT" ? "Trait cadastrada." : "Mídia cadastrada.");
  };

  const deleteTaxonomy = async (entry: AdminTaxonomy) => {
    if (!window.confirm(`Excluir ${entry.name}?`)) return;
    await api.deleteTaxonomy(entry.id);
    await loadAll(); await loadAdminCards();
    toast.success("Registro ocultado. O dado foi preservado.");
  };

 
  if (user?.role !== "ADMIN") {
    return <PortalShell breadcrumbs={[{ label: "Admin" }]}><Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900"><CardContent className="p-6">Essa área é exclusiva para administradores.</CardContent></Card></PortalShell>;
  }
 
  return (
    <PortalShell breadcrumbs={[{ label: "Admin" }]}>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="space-y-4 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">Gestão administrativa · área independente</p>
            <h2 className="font-heading text-5xl uppercase leading-none">{sectionLabel}</h2>
            <p className="max-w-4xl text-sm leading-7 text-slate-300 dark:text-slate-300 light:text-slate-600">Cada cadastro possui uma rota própria no menu lateral, para permitir operação e testes sem concentrar a gestão inteira em uma única tela.</p>
            {loading ? <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Atualizando dados desta área…</p> : null}
          </CardContent>
        </Card>
 
        <Tabs value={adminSection} className="space-y-6">
 
          <TabsContent value="dashboard">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[["Usuários", users.length], ["Coleções", sets.length], ["Cartas", cardTotal], ["Rulings", rules.length]].map(([label, value]) => <Card key={String(label)} className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900"><CardContent className="p-5"><p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-400 light:text-slate-500">{String(label)}</p><p className="mt-4 font-heading text-5xl leading-none">{String(value)}</p></CardContent></Card>)}</div>
          </TabsContent>
 
          <TabsContent value="cards">
            <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900">
              <CardContent className="space-y-5 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <SectionTitle title="Catálogo de cartas" description="Filtros reais no servidor, ordenação e paginação persistida na URL para operação confiável do catálogo." />
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="outline" className="rounded-none border-white/20 text-slate-400">{cardTotal} cartas · página {cardQuery.page} de {cardTotalPages}</Badge>
                    <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => openCardModal()}><Plus className="mr-2 size-4" />Nova carta</Button>
                  </div>
                </div>

                <div className="space-y-2 border border-amber-400/20 bg-amber-400/[0.04] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300/80">Fila de curadoria · cartas sem relação editorial confirmada</p>
                  <div className="flex flex-wrap gap-2">
                    {([["PILOT", "Pilotos"], ["UNIT", "Unidades"], ["COMMAND", "Commands"]] as const).map(([type, label]) => {
                      const count = availableCardFilters.missingRelationCounts[type];
                      return (
                        <button key={type} type="button" onClick={() => updateCardQuery({ cardType: type, relation: "missing", page: 1 })}
                          className={`flex items-center gap-2 border px-3 py-2 text-left text-sm transition ${count > 0 ? "border-amber-400/40 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20" : "border-white/10 bg-white/5 text-slate-500"}`}>
                          <span className="text-lg font-semibold tabular-nums">{count}</span>
                          <span className="text-xs uppercase tracking-[0.14em]">{label} sem relação</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] leading-4 text-amber-200/60">Conta por code único (não por reimpressão) e cobre os 5 tipos de relação juntos — não é "sem piloto", é "sem nenhum vínculo confirmado a outra carta". Em Unidades, boa parte do número é esperado: unidades com Link Condition por trait (qualquer piloto daquele trait linka) ficam de propósito sem CardRelation, já cobertas pela descoberta automática. Clique num card acima pra filtrar direto a fila. Critério de cada tipo: docs/10-convencoes-relacoes-cartas.md.</p>
                </div>

                <div className="grid gap-3 border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                  <div className="relative sm:col-span-2"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input id="catalog-q" name="catalog-q" autoComplete="off" value={cardQuery.q} onChange={(e) => updateCardQuery({ q: e.target.value, page: 1 })} placeholder="Nome ou código" className="rounded-none pl-9" /></div>
                  <select id="catalog-card-type" name="catalog-card-type" value={cardQuery.cardType} onChange={(e) => updateCardQuery({ cardType: e.target.value, page: 1 })} className="field-shell h-10 px-3 text-sm"><option value="">Todos os tipos</option>{CATALOG_CARD_TYPE_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                  <select id="catalog-color" name="catalog-color" value={cardQuery.color} onChange={(e) => updateCardQuery({ color: e.target.value, page: 1 })} className="field-shell h-10 px-3 text-sm"><option value="">Todas as cores</option>{availableCardFilters.colors.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                  <select id="catalog-set-code" name="catalog-set-code" value={cardQuery.setCode} onChange={(e) => updateCardQuery({ setCode: e.target.value, page: 1 })} className="field-shell h-10 px-3 text-sm"><option value="">Todas as coleções</option>{availableCardFilters.sets.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.namePt || item.nameEn}</option>)}</select>
                  <select id="catalog-rarity" name="catalog-rarity" value={cardQuery.rarity} onChange={(e) => updateCardQuery({ rarity: e.target.value, page: 1 })} className="field-shell h-10 px-3 text-sm"><option value="">Todas as raridades</option>{availableCardFilters.rarities.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                  <select id="catalog-ap" name="catalog-ap" value={cardQuery.ap} onChange={(e) => updateCardQuery({ ap: e.target.value, page: 1 })} className="field-shell h-10 px-3 text-sm"><option value="">AP</option>{AP_HP_OPTIONS.filter((item) => item !== "-").map((item) => <option key={item} value={item}>AP {item}</option>)}</select>
                  <select id="catalog-hp" name="catalog-hp" value={cardQuery.hp} onChange={(e) => updateCardQuery({ hp: e.target.value, page: 1 })} className="field-shell h-10 px-3 text-sm"><option value="">HP</option>{AP_HP_OPTIONS.filter((item) => item !== "-").map((item) => <option key={item} value={item}>HP {item}</option>)}</select>
                  <select id="catalog-cost" name="catalog-cost" value={cardQuery.cost} onChange={(e) => updateCardQuery({ cost: e.target.value, page: 1 })} className="field-shell h-10 px-3 text-sm"><option value="">Custo</option>{COST_LEVEL_OPTIONS.map((item) => <option key={item} value={item}>Custo {item}</option>)}</select>
                  <select id="catalog-level" name="catalog-level" value={cardQuery.level} onChange={(e) => updateCardQuery({ level: e.target.value, page: 1 })} className="field-shell h-10 px-3 text-sm"><option value="">Level</option>{COST_LEVEL_OPTIONS.map((item) => <option key={item} value={item}>Level {item}</option>)}</select>
                  <select id="catalog-trait" name="catalog-trait" value={cardQuery.trait} onChange={(e) => updateCardQuery({ trait: e.target.value, page: 1 })} className="field-shell h-10 px-3 text-sm"><option value="">Todas as traits</option>{availableCardFilters.traits.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                  <select id="catalog-media" name="catalog-media" value={cardQuery.media} onChange={(e) => updateCardQuery({ media: e.target.value, page: 1 })} className="field-shell h-10 px-3 text-sm"><option value="">Todas as mídias</option>{availableCardFilters.media.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                  <select id="catalog-link" name="catalog-link" value={cardQuery.link} onChange={(e) => updateCardQuery({ link: e.target.value, page: 1 })} className="field-shell h-10 px-3 text-sm"><option value="">Link / piloto</option><option value="has">Com Link/requisito</option><option value="pilot-card">Cartas do tipo Piloto</option><option value="pilot-reference">Comandos com referência a piloto</option><option value="none">Sem Link/requisito</option></select>
                  <select id="catalog-relation" name="catalog-relation" value={cardQuery.relation} onChange={(e) => updateCardQuery({ relation: e.target.value, page: 1 })} className="field-shell h-10 px-3 text-sm"><option value="">Relação editorial</option><option value="missing">Sem relação confirmada</option><option value="confirmed">Com relação confirmada</option></select>
                  <select id="catalog-status" name="catalog-status" value={cardQuery.status} onChange={(e) => updateCardQuery({ status: e.target.value, page: 1 })} className="field-shell h-10 px-3 text-sm"><option value="">Todos os status</option>{availableCardFilters.statuses.map((item) => <option key={item} value={item}>{LEGALITY_OPTIONS.find((option) => option.value === item)?.label || item}</option>)}</select>
                  <select id="catalog-sort" name="catalog-sort" value={cardQuery.sort} onChange={(e) => updateCardQuery({ sort: e.target.value, page: 1 })} className="field-shell h-10 px-3 text-sm"><option value="code_asc">Código A–Z</option><option value="code_desc">Código Z–A</option><option value="name_asc">Nome A–Z</option><option value="name_desc">Nome Z–A</option><option value="ap_desc">AP maior</option><option value="ap_asc">AP menor</option><option value="hp_desc">HP maior</option><option value="hp_asc">HP menor</option><option value="cost_asc">Custo menor</option><option value="cost_desc">Custo maior</option><option value="level_asc">Level menor</option><option value="level_desc">Level maior</option><option value="rarity_asc">Raridade A–Z</option><option value="rarity_desc">Raridade Z–A</option><option value="updated_desc">Atualização recente</option><option value="updated_asc">Atualização antiga</option></select>
                  <Button type="button" variant="outline" className="rounded-none" onClick={() => updateCardQuery({ q: "", color: "", cardType: "", setCode: "", rarity: "", ap: "", hp: "", cost: "", level: "", trait: "", media: "", link: "", relation: "", status: "", sort: "code_asc", page: 1, pageSize: 50 })}>Limpar filtros</Button>
                </div>

                {cardFiltersError ? <div className="flex flex-wrap items-center justify-between gap-3 border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200"><span>Opções dinâmicas indisponíveis: {cardFiltersError}. As opções-base continuam disponíveis.</span><Button type="button" variant="outline" className="h-8 rounded-none border-amber-300/40 text-amber-100" onClick={loadCardFilterOptions} disabled={cardFiltersLoading}>{cardFiltersLoading ? "Atualizando…" : "Tentar novamente"}</Button></div> : null}
                {activeCardFilters.length ? <div className="flex flex-wrap items-center gap-2 border border-white/10 bg-slate-950/30 p-3"><span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Filtros ativos</span>{activeCardFilters.map((filter) => <button key={filter.key} type="button" onClick={() => updateCardQuery({ [filter.key]: "", page: 1 } as Partial<CardCatalogQuery>)} className="inline-flex items-center gap-1 border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary transition hover:bg-primary/20"><span>{filter.label}: {filter.value}</span><X className="size-3" /></button>)}<button type="button" onClick={() => updateCardQuery({ q: "", color: "", cardType: "", setCode: "", rarity: "", ap: "", hp: "", cost: "", level: "", trait: "", media: "", link: "", relation: "", status: "", sort: "code_asc", page: 1, pageSize: 50 })} className="ml-1 text-xs text-slate-400 underline-offset-4 hover:text-white hover:underline">Limpar tudo</button></div> : null}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400"><span>{cardTotal ? `Exibindo ${(cardQuery.page - 1) * cardQuery.pageSize + 1}–${Math.min(cardQuery.page * cardQuery.pageSize, cardTotal)} de ${cardTotal}` : "Nenhuma carta encontrada"}</span><label className="flex items-center gap-2">Por página <select id="catalog-page-size" name="catalog-page-size" value={String(cardQuery.pageSize)} onChange={(e) => updateCardQuery({ pageSize: Number(e.target.value), page: 1 })} className="field-shell h-8 px-2 text-xs"><option value="25">25</option><option value="50">50</option><option value="80">80</option><option value="100">100</option></select></label></div>

                <div className="overflow-x-auto border border-white/10"><table className="min-w-full text-sm"><thead className="bg-white/5 text-left uppercase tracking-[0.16em] text-slate-400"><tr><th className="px-4 py-3">Carta</th><th className="px-4 py-3">Tipo / status</th><th className="px-4 py-3">Coleção</th><th className="px-4 py-3">Stats</th><th className="px-4 py-3">Vínculos</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody>{cards.map((card) => <tr key={card.id} className="border-t border-white/10 align-top"><td className="px-4 py-4"><div className="flex items-start gap-3"><div className="h-16 w-12 overflow-hidden border border-white/10 bg-slate-950/60">{card.imageUrl ? <img src={card.imageUrl} alt={card.namePt || card.nameEn} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[9px] uppercase tracking-[0.18em] text-slate-500">Sem arte</div>}</div><div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">{card.code} · {card.rarity || "—"}</p><p className="mt-1 font-medium">{card.namePt || card.nameEn}</p><p className="text-xs text-slate-500">{card.sourceTitle || card.series || "sem mídia"}</p></div></div></td><td className="px-4 py-4"><Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{cardTypeLabel(card.cardType)}</Badge><p className="mt-2 text-xs text-slate-500">{LEGALITY_OPTIONS.find((option) => option.value === card.legalityStatus)?.label || card.legalityStatus || "Legal"}</p></td><td className="px-4 py-4">{card.set?.code || "—"}</td><td className="px-4 py-4 text-xs text-slate-400">Lv {card.level ?? "-"} · Cost {card.cost ?? "-"} · AP {card.ap ?? "-"} · HP {card.hp ?? "-"}</td><td className="px-4 py-4 text-xs text-slate-400"><p>{card.linkText || "sem link"}</p><p className="mt-1">{card.pilotName ? `Piloto: ${card.pilotName}` : (card.traits || []).join(" · ") || "sem trait"}</p></td><td className="px-4 py-4"><div className="flex justify-end gap-2"><Button variant="outline" className="rounded-none" onClick={() => openCardModal(card)}><Pencil className="size-4" /></Button><Button variant="outline" className="rounded-none text-red-400 hover:text-red-300" onClick={() => deleteCard(card)}><Trash2 className="size-4" /></Button></div></td></tr>)}</tbody></table></div>
                <nav aria-label="Paginação do catálogo" className="flex flex-wrap items-center justify-between gap-3"><Button type="button" variant="outline" className="rounded-none" disabled={cardQuery.page <= 1} onClick={() => updateCardQuery({ page: cardQuery.page - 1 })}><ChevronLeft className="mr-1 size-4" />Anterior</Button><div className="flex flex-wrap items-center justify-center gap-1">{cardPageNumbers[0] > 1 ? <><Button type="button" variant="outline" className="h-8 min-w-8 rounded-none px-2 text-xs" onClick={() => updateCardQuery({ page: 1 })}>1</Button>{cardPageNumbers[0] > 2 ? <span className="px-1 text-xs text-slate-500">…</span> : null}</> : null}{cardPageNumbers.map((page) => <Button key={page} type="button" variant={page === cardQuery.page ? "default" : "outline"} aria-current={page === cardQuery.page ? "page" : undefined} className="h-8 min-w-8 rounded-none px-2 text-xs" onClick={() => updateCardQuery({ page })}>{page}</Button>)}{cardPageNumbers[cardPageNumbers.length - 1] < cardTotalPages ? <>{cardPageNumbers[cardPageNumbers.length - 1] < cardTotalPages - 1 ? <span className="px-1 text-xs text-slate-500">…</span> : null}<Button type="button" variant="outline" className="h-8 min-w-8 rounded-none px-2 text-xs" onClick={() => updateCardQuery({ page: cardTotalPages })}>{cardTotalPages}</Button></> : null}</div><Button type="button" variant="outline" className="rounded-none" disabled={cardQuery.page >= cardTotalPages || cardTotal === 0} onClick={() => updateCardQuery({ page: cardQuery.page + 1 })}>Próxima<ChevronRight className="ml-1 size-4" /></Button></nav>
              </CardContent>
            </Card>
          </TabsContent>
 
          <TabsContent value="sets">
            <Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900"><CardContent className="space-y-5 p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><SectionTitle title="Coleções e produtos" description="Produtos cadastrados como booster, starter deck, promo pack ou evento com campos próprios." /><div className="flex flex-wrap items-center gap-3"><div className="relative min-w-[280px]"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input value={setSearch} onChange={(e) => setSetSearch(e.target.value)} placeholder="Buscar por código, nome ou categoria" className="rounded-none pl-9" /></div><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => openSetModal()}><Plus className="mr-2 size-4" />Nova coleção</Button></div></div><div className="overflow-x-auto border border-white/10"><table className="min-w-full text-sm"><thead className="bg-white/5 text-left uppercase tracking-[0.16em] text-slate-400"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Lançamento</th><th className="px-4 py-3">MSRP</th><th className="px-4 py-3">Cartas</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody>{visibleSets.map((set) => <tr key={set.id} className="border-t border-white/10 align-top"><td className="px-4 py-4"><div className="flex items-start gap-3"><div className="h-16 w-24 overflow-hidden border border-white/10 bg-slate-950/60">{set.coverImage ? <img src={set.coverImage} alt={set.namePt || set.nameEn} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[9px] uppercase tracking-[0.18em] text-slate-500">Sem capa</div>}</div><div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">{set.code}{set.productCodeAlt ? ` · ${set.productCodeAlt}` : ""}</p><p className="mt-1 font-medium">{set.namePt || set.nameEn}</p><p className="text-xs text-slate-500">{set.sourceTitles?.join(", ") || "sem obras vinculadas"}</p></div></div></td><td className="px-4 py-4"><Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{set.setType || "OTHER"}</Badge></td><td className="px-4 py-4">{set.releaseDate ? new Date(set.releaseDate).toLocaleDateString("pt-BR") : "—"}</td><td className="px-4 py-4">{set.msrpUsd != null ? `US$ ${set.msrpUsd.toFixed(2)}` : "—"}</td><td className="px-4 py-4">{set._count?.cards ?? 0}</td><td className="px-4 py-4"><div className="flex justify-end gap-2"><Button variant="outline" className="rounded-none" onClick={() => openSetModal(set)}><Pencil className="size-4" /></Button><Button variant="outline" className="rounded-none text-red-400 hover:text-red-300" onClick={() => deleteSet(set)}><Trash2 className="size-4" /></Button></div></td></tr>)}</tbody></table></div></CardContent></Card>
          </TabsContent>
 
          <TabsContent value="users"><Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900"><CardContent className="space-y-4 p-6"><SectionTitle title="Usuários" description="Listagem operacional de contas, função e permissão de acesso. Bloqueios são lógicos: nenhuma conta é apagada." /><div className="overflow-x-auto border border-white/10"><table className="min-w-full text-sm"><thead className="bg-white/5 text-left uppercase tracking-[0.16em] text-slate-400"><tr><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Função</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead><tbody>{users.map((entry) => <tr key={entry.id} className="border-t border-white/10"><td className="px-4 py-4"><p className="font-medium">{entry.displayName}</p><p className="text-xs text-slate-500">{entry.email}</p></td><td className="px-4 py-4"><Badge className="rounded-none border border-primary/40 bg-primary/10 text-primary">{entry.role}</Badge></td><td className="px-4 py-4"><Badge className={`rounded-none ${entry.isActive ? "border border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border border-red-400/40 bg-red-400/10 text-red-300"}`}>{entry.isActive ? "Ativo" : "Bloqueado"}</Badge></td><td className="px-4 py-4 text-right"><Button variant="outline" className="rounded-none" onClick={async () => { await api.updateAdminUser(entry.id, { isActive: !entry.isActive }); await loadAll(); await loadAdminCards(); toast.success(entry.isActive ? "Usuário bloqueado logicamente." : "Usuário reativado."); }}>{entry.isActive ? "Bloquear" : "Reativar"}</Button></td></tr>)}</tbody></table></div></CardContent></Card></TabsContent>

          <TabsContent value="taxonomies"><Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900"><CardContent className="space-y-5 p-6"><SectionTitle title={isMediaManagement ? "Mídias e séries" : "Traits"} description={isMediaManagement ? "Cadastre as séries/fontes usadas pelas cartas. A próxima expansão adiciona sinopse, capa e galeria por mídia." : "Cadastre traits e facções como referência controlada para o catálogo de cartas."} /><div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><Input value={taxonomyForm.name} onChange={(e) => setTaxonomyForm((s) => ({ ...s, kind: isMediaManagement ? "SOURCE_TITLE" : "TRAIT", name: e.target.value }))} placeholder={isMediaManagement ? "Nome da mídia ou série" : "Nome da trait"} className="rounded-none" /><Input value={taxonomyForm.description} onChange={(e) => setTaxonomyForm((s) => ({ ...s, description: e.target.value }))} placeholder="Descrição opcional" className="rounded-none" /><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveTaxonomy}>Adicionar</Button></div><div className="space-y-2"><h3 className="text-xs uppercase tracking-[0.22em] text-slate-500">{isMediaManagement ? "Mídias cadastradas" : "Traits cadastradas"}</h3>{taxonomies.filter((item) => item.kind === (isMediaManagement ? "SOURCE_TITLE" : "TRAIT")).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border border-white/10 bg-white/5 px-4 py-3"><div><p>{item.name}</p>{item.description ? <p className="mt-1 text-xs text-slate-500">{item.description}</p> : null}</div><Button variant="outline" className="h-8 rounded-none text-red-300" onClick={() => deleteTaxonomy(item)}>Ocultar</Button></div>)}</div></CardContent></Card></TabsContent>
 
          <TabsContent value="decks"><Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900"><CardContent className="space-y-5 p-6"><SectionTitle title="Decks registrados" description="Área administrativa para revisar e montar decks destinados ao blog, a eventos e às páginas públicas." /><div className="grid gap-4 md:grid-cols-2"><Card className="rounded-none border border-white/10 bg-slate-950/50"><CardContent className="space-y-4 p-5"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Editor</p><p className="text-sm leading-6 text-slate-400">Use o editor de decks existente para criar e revisar listas antes de promovê-las para conteúdo editorial ou eventos.</p><Button asChild className="rounded-none bg-primary text-primary-foreground"><Link href="/deckbuilder">Abrir editor de decks</Link></Button></CardContent></Card><Card className="rounded-none border border-white/10 bg-slate-950/50"><CardContent className="space-y-4 p-5"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Revisão pública</p><p className="text-sm leading-6 text-slate-400">A listagem pública continua separada do cadastro, evitando que o fluxo de curadoria atrapalhe o uso normal do portal.</p><Button asChild variant="outline" className="rounded-none"><Link href="/decks">Ver decks publicados</Link></Button></CardContent></Card></div></CardContent></Card></TabsContent>

          <TabsContent value="events"><Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900"><CardContent className="space-y-5 p-6"><SectionTitle title="Eventos" description="Cadastros de torneios, estatísticas e listas associadas ficam isolados do catálogo de cartas." /><div className="flex flex-wrap gap-3"><Button asChild className="rounded-none bg-primary text-primary-foreground"><Link href="/eventos">Abrir gestão de eventos</Link></Button><Button asChild variant="outline" className="rounded-none"><Link href="/tournaments">Ver calendário público</Link></Button></div><p className="border border-dashed border-white/10 bg-white/[0.025] p-5 text-sm leading-7 text-slate-400">A API de torneios já está disponível; a próxima iteração desta área adiciona a grade administrativa com participantes, decks, placements e exclusão lógica.</p></CardContent></Card></TabsContent>

          <TabsContent value="rules"><Card className="panel-cut rounded-none surface-panel dark:text-white light:text-slate-900"><CardContent className="space-y-4 p-5"><SectionTitle title="Nova ruling" description="Registro rápido de FAQ oficial e vínculo opcional com carta." /><Input value={ruleForm.title} onChange={(e) => setRuleForm((s) => ({ ...s, title: e.target.value }))} placeholder="Título" className="rounded-none" /><div className="grid gap-4 md:grid-cols-2"><Textarea value={ruleForm.questionPt} onChange={(e) => setRuleForm((s) => ({ ...s, questionPt: e.target.value }))} placeholder="Pergunta PT-BR" className="min-h-24 rounded-none" /><Textarea value={ruleForm.answerPt} onChange={(e) => setRuleForm((s) => ({ ...s, answerPt: e.target.value }))} placeholder="Resposta PT-BR" className="min-h-24 rounded-none" /><Textarea value={ruleForm.questionEn} onChange={(e) => setRuleForm((s) => ({ ...s, questionEn: e.target.value }))} placeholder="Question EN" className="min-h-24 rounded-none" /><Textarea value={ruleForm.answerEn} onChange={(e) => setRuleForm((s) => ({ ...s, answerEn: e.target.value }))} placeholder="Answer EN" className="min-h-24 rounded-none" /></div><div className="grid gap-4 md:grid-cols-2"><Input value={ruleForm.relatedKeyword} onChange={(e) => setRuleForm((s) => ({ ...s, relatedKeyword: e.target.value }))} placeholder="Keyword relacionada" className="rounded-none" /><Input value={ruleForm.originalUrl} onChange={(e) => setRuleForm((s) => ({ ...s, originalUrl: e.target.value }))} placeholder="URL da fonte" className="rounded-none" /></div><div className="grid gap-4 md:grid-cols-2"><select value={ruleForm.sourceType} onChange={(e) => setRuleForm((s) => ({ ...s, sourceType: e.target.value }))} className="field-shell h-10 px-3 text-sm"><option value="OFFICIAL_RULES">Official Rules</option><option value="OFFICIAL_FAQ">Official FAQ</option><option value="COMMUNITY_EXPLAINER">Community</option></select><select value={ruleForm.cardId} onChange={(e) => setRuleForm((s) => ({ ...s, cardId: e.target.value }))} className="field-shell h-10 px-3 text-sm"><option value="">Carta vinculada</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.code} · {card.namePt || card.nameEn}</option>)}</select></div><Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={async () => { await api.createRuling({ ...ruleForm, relatedKeyword: ruleForm.relatedKeyword || null, originalUrl: ruleForm.originalUrl || null, cardId: ruleForm.cardId || null }); setRuleForm(emptyRuleForm); await loadAll(); await loadAdminCards(); toast.success("Ruling criada."); }}>Salvar ruling</Button><div className="grid gap-3">{rules.map((rule) => <div key={rule.id} className="panel-cut border surface-strong p-4 dark:bg-slate-950/60 light:bg-slate-50"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{rule.sourceType} · {rule.relatedKeyword || "sem keyword"}</p><p className="mt-1 text-lg">{rule.title}</p><p className="text-sm text-slate-400 dark:text-slate-400 light:text-slate-600">{rule.originalUrl || "sem fonte externa"}</p></div>)}</div></CardContent></Card></TabsContent>
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
            <Input value={setForm.coverImage} onChange={(e) => setSetForm((s) => ({ ...s, coverImage: e.target.value }))} placeholder="URL da capa principal" className="rounded-none" />
            <Input value={setForm.productCodeAlt} onChange={(e) => setSetForm((s) => ({ ...s, productCodeAlt: e.target.value }))} placeholder="Código variante" className="rounded-none" />
            <Input value={setForm.msrpUsd} onChange={(e) => setSetForm((s) => ({ ...s, msrpUsd: e.target.value }))} placeholder="MSRP USD" className="rounded-none" />
          </div>
          <div className="border border-white/10 bg-white/[0.02] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Galeria visual</p><p className="mt-1 text-sm text-slate-400">Envie uma ou mais imagens. Clique em uma miniatura para defini-la como capa.</p></div><input ref={setGalleryUploadInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleSetGalleryUpload} /><Button type="button" variant="outline" className="rounded-none" disabled={saving} onClick={() => setGalleryUploadInputRef.current?.click()}><Upload className="mr-2 size-4" />Adicionar imagens</Button></div>{setForm.galleryImages.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{setForm.galleryImages.map((url, index) => <div key={`${url}-${index}`} className={`group relative overflow-hidden border ${setForm.coverImage === url ? "border-primary" : "border-white/10"}`}><button type="button" className="block aspect-[4/3] w-full" onClick={() => setSetForm((s) => ({ ...s, coverImage: url }))}><img src={url} alt={`Imagem ${index + 1}`} className="h-full w-full object-cover" /></button><div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-slate-950/85 px-2 py-1.5 text-[10px] uppercase tracking-[0.12em">{setForm.coverImage === url ? <span className="text-primary">Capa</span> : <button type="button" className="text-slate-300" onClick={() => setSetForm((s) => ({ ...s, coverImage: url }))}>Usar como capa</button>}<button type="button" className="text-red-300" onClick={() => setSetForm((s) => { const galleryImages = s.galleryImages.filter((item) => item !== url); return { ...s, galleryImages, coverImage: s.coverImage === url ? galleryImages[0] || "" : s.coverImage }; })}>Remover</button></div></div>)}</div> : <p className="mt-4 text-sm text-slate-500">Nenhuma imagem adicionada ainda.</p>}</div>
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
 
      {/* ── Modal: Piloto rápido ───────────────────────────────────────────── */}
      <Dialog open={quickPilotOpen} onOpenChange={setQuickPilotOpen}>
        <DialogContent className="rounded-none border-white/10 bg-slate-950 text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-3xl uppercase">Piloto rápido</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldBlock label="Código"><Input value={quickPilotForm.code} onChange={(e) => setQuickPilotForm((s) => ({ ...s, code: e.target.value }))} placeholder="GD01-001-P" className="rounded-none" /></FieldBlock>
            <FieldBlock label="Nome do piloto"><Input value={quickPilotForm.nameEn} onChange={(e) => setQuickPilotForm((s) => ({ ...s, nameEn: e.target.value }))} placeholder="Amuro Ray" className="rounded-none" /></FieldBlock>
            <FieldBlock label="Traits"><Input list="trait-suggestions" value={quickPilotForm.trait} onChange={(e) => setQuickPilotForm((s) => ({ ...s, trait: e.target.value }))} placeholder="Earth Federation; White Base Team" className="rounded-none" /></FieldBlock>
            <FieldBlock label="Mídia / anime"><Input list="source-title-suggestions" value={quickPilotForm.sourceTitle} onChange={(e) => setQuickPilotForm((s) => ({ ...s, sourceTitle: e.target.value }))} placeholder="Mobile Suit Gundam" className="rounded-none" /></FieldBlock>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" className="rounded-none" onClick={() => setQuickPilotOpen(false)}>Cancelar</Button>
            <Button className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={createQuickPilot} disabled={saving}>{saving ? "Criando…" : "Criar piloto"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Carta ────────────────────────────────────────────────────── */}
      <Dialog open={cardModalOpen} onOpenChange={setCardModalOpen}>
        <DialogContent className="max-h-[94vh] !w-[calc(100vw-1.5rem)] !max-w-[calc(100vw-1.5rem)] overflow-x-hidden overflow-y-auto rounded-none border-white/10 bg-slate-950 p-4 text-white sm:!w-[calc(100vw-3rem)] sm:!max-w-[calc(100vw-3rem)] sm:p-6 2xl:!max-w-[1720px]">
 
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
 
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] 2xl:grid-cols-[minmax(0,1fr)_440px]">
 
            {/* ── Coluna principal ────────────────────────────── */}
            <div className="min-w-0 space-y-5">
 
              {/* IDENTIDADE */}
              <ModalSection label={`Identidade · ${CARD_TYPE_OPTIONS.find((item) => item.value === cardForm.cardType)?.label || "Carta"}`} />
              <div className="grid gap-4 rounded-none border border-white/10 bg-white/[0.025] p-4 md:grid-cols-12">
                <FieldBlock label="Código" className="md:col-span-3"><Input value={cardForm.code} onChange={(e) => setCardForm((s) => ({ ...s, code: e.target.value }))} placeholder="GD01-001" className="rounded-none" /></FieldBlock>
                <FieldBlock label="Tipo" className="md:col-span-3"><select value={cardForm.cardType} onChange={(e) => setCardForm((s) => ({ ...s, cardType: e.target.value }))} className="field-shell h-10 w-full px-3 text-sm">{CARD_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></FieldBlock>
                <FieldBlock label="Raridade base" hint="A carta fica só C, U, R ou LR. Variações vão na arte." className="md:col-span-2"><select value={cardForm.rarity} onChange={(e) => setCardForm((s) => ({ ...s, rarity: e.target.value, artRarity: e.target.value }))} className="field-shell h-10 w-full px-3 text-sm">{RARITY_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></FieldBlock>
                <FieldBlock label="Custo" className="md:col-span-2"><select value={cardForm.cost} onChange={(e) => setCardForm((s) => ({ ...s, cost: e.target.value }))} className="field-shell h-10 w-full px-3 text-sm">{COST_LEVEL_OPTIONS.map((item) => <option key={item} value={item}>Custo {item}</option>)}</select></FieldBlock>
                <FieldBlock label="Level" className="md:col-span-2"><select value={cardForm.level} onChange={(e) => setCardForm((s) => ({ ...s, level: e.target.value }))} className="field-shell h-10 w-full px-3 text-sm">{COST_LEVEL_OPTIONS.map((item) => <option key={item} value={item}>Level {item}</option>)}</select></FieldBlock>
                <FieldBlock label="Coleção" className="md:col-span-5"><select value={cardForm.setId} onChange={(e) => setCardForm((s) => ({ ...s, setId: e.target.value }))} className="field-shell h-10 w-full px-3 text-sm"><option value="">Coleção</option>{sets.map((set) => <option key={set.id} value={set.id}>{set.code} · {set.namePt || set.nameEn}</option>)}</select></FieldBlock>
                <FieldBlock label="Nome oficial" hint="Nome traduzido foi removido por enquanto." className="md:col-span-7"><Input value={cardForm.nameEn} onChange={(e) => setCardForm((s) => ({ ...s, nameEn: e.target.value }))} placeholder="Gundam" className="rounded-none" /></FieldBlock>
              </div>

              {/* STATS */}
              <ModalSection label="Stats e estado" />
              <div className="grid gap-4 rounded-none border border-white/10 bg-white/[0.025] p-4 md:grid-cols-4">
                {showStats ? <FieldBlock label="AP"><select value={cardForm.ap} onChange={(e) => setCardForm((s) => ({ ...s, ap: e.target.value }))} className="field-shell h-10 w-full px-3 text-sm">{AP_HP_OPTIONS.map((item) => <option key={item} value={item}>AP {item}</option>)}</select></FieldBlock> : null}
                {showStats ? <FieldBlock label="HP"><select value={cardForm.hp} onChange={(e) => setCardForm((s) => ({ ...s, hp: e.target.value }))} className="field-shell h-10 w-full px-3 text-sm">{AP_HP_OPTIONS.map((item) => <option key={item} value={item}>HP {item}</option>)}</select></FieldBlock> : null}
                <FieldBlock label="Cor"><select value={cardForm.color} onChange={(e) => setCardForm((s) => ({ ...s, color: e.target.value }))} className="field-shell h-10 w-full px-3 text-sm"><option value="">Cor</option>{COLOR_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></FieldBlock>
                <FieldBlock label="Legalidade"><select value={cardForm.legalityStatus} onChange={(e) => setCardForm((s) => ({ ...s, legalityStatus: e.target.value }))} className="field-shell h-10 w-full px-3 text-sm">{LEGALITY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></FieldBlock>
                {!showStats ? <p className="md:col-span-2 self-end text-xs leading-5 text-slate-600">Este tipo não usa AP/HP no cadastro principal, então os campos foram ocultados para reduzir ruído visual.</p> : null}
              </div>

              {/* EFEITOS */}
              {showEffects ? <>
                <ModalSection label="Efeitos" />
                <div className="grid gap-4 rounded-none border border-white/10 bg-white/[0.025] p-4 lg:grid-cols-2">
                  {showBurst ? <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Burst</p><div className="flex gap-1.5"><ToggleCard active={cardForm.burstEnabled} label="Sim" onClick={() => setCardForm((s) => ({ ...s, burstEnabled: true }))} /><ToggleCard active={!cardForm.burstEnabled} label="Não" onClick={() => setCardForm((s) => ({ ...s, burstEnabled: false, burstEffect: "" }))} /></div></div>
                    {cardForm.burstEnabled ? <Textarea value={cardForm.burstEffect} onChange={(e) => setCardForm((s) => ({ ...s, burstEffect: e.target.value }))} placeholder="Ex.: <Burst> Draw 1." className="min-h-[150px] rounded-none font-mono text-sm" /> : <div className="flex min-h-[150px] items-center justify-center border border-dashed border-white/10 text-xs uppercase tracking-[0.2em] text-slate-700">Sem efeito burst</div>}
                  </div> : null}
                  <FieldBlock label="Efeito principal" hint="Use o guia de sintaxe à direita para diferenciar nativo, timing e efeito concedido." className={showBurst ? "" : "lg:col-span-2"}><Textarea value={cardForm.effectText} onChange={(e) => setCardForm((s) => ({ ...s, effectText: e.target.value }))} placeholder={"Ex.: [During Link][Attack] ... gains <First Strike>."} className="min-h-[150px] rounded-none font-mono text-sm" /></FieldBlock>
                </div>
              </> : null}

              {/* VÍNCULOS */}
              <ModalSection label="Vínculos e categorias" />
              <div className="grid gap-4 rounded-none border border-white/10 bg-white/[0.025] p-4 md:grid-cols-2">
                {showPilotName ? <FieldBlock label="Nome do piloto"><Input value={cardForm.pilotName} onChange={(e) => setCardForm((s) => ({ ...s, pilotName: e.target.value }))} placeholder="Amuro Ray" className="rounded-none" /></FieldBlock> : null}
                <FieldBlock label="Traits / facções" hint="Escolha no datalist ou separe múltiplas por ;"><Input list="trait-suggestions" value={cardForm.traits} onChange={(e) => setCardForm((s) => ({ ...s, traits: e.target.value }))} placeholder="Earth Federation; White Base Team" className="rounded-none" /></FieldBlock>
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Link / requisito de piloto</span><Button type="button" variant="outline" className="h-7 rounded-none px-2 text-[10px] uppercase tracking-[0.16em]" onClick={() => { setQuickPilotForm({ code: `${cardForm.code || "PILOT"}-P`, nameEn: "", trait: cardForm.traits, sourceTitle: cardForm.sourceTitle }); setQuickPilotOpen(true); }}>+ Piloto rápido</Button></div>
                  <Input list="link-suggestions" value={cardForm.linkText} onChange={(e) => setCardForm((s) => ({ ...s, linkText: e.target.value }))} placeholder="[Amuro Ray] ou White Base Team trait" className="rounded-none" />
                  <p className="text-[11px] leading-5 text-slate-500">O botão cria uma carta Pilot sem sair do cadastro atual e já preenche este vínculo.</p>
                </div>
                <FieldBlock label="Mídia / anime"><Input list="source-title-suggestions" value={cardForm.sourceTitle} onChange={(e) => setCardForm((s) => ({ ...s, sourceTitle: e.target.value }))} placeholder="Mobile Suit Gundam" className="rounded-none" /></FieldBlock>
                <FieldBlock label="URL oficial"><Input value={cardForm.officialUrl} onChange={(e) => setCardForm((s) => ({ ...s, officialUrl: e.target.value }))} placeholder="https://..." className="rounded-none" /></FieldBlock>
              </div>

              <ModalSection label="Relações editoriais" />
              <div className="space-y-4 rounded-none border border-white/10 bg-white/[0.025] p-4">
                {!cardForm.id ? <p className="text-sm text-slate-500">Salve a carta primeiro para vincular relações editoriais a esta impressão específica.</p> : <>
                  <div className="grid gap-3 lg:grid-cols-[1.25fr_0.8fr_0.8fr]">
                    <FieldBlock label="Buscar carta relacionada"><Input id="relation-search" name="relation-search" value={relationSearch} onChange={(e) => { setRelationSearch(e.target.value); setRelationDraft((current) => ({ ...current, targetCardId: "" })); }} placeholder="Nome ou código (mínimo 2 caracteres)" className="rounded-none" /></FieldBlock>
                    <FieldBlock label="Tipo de relação" hint={RELATION_TYPE_HINTS[relationDraft.relationType]}><select id="relation-type" name="relation-type" value={relationDraft.relationType} onChange={(e) => setRelationDraft((current) => ({ ...current, relationType: e.target.value }))} className="field-shell h-10 w-full px-3 text-sm"><option value="PILOT_OF">Piloto de</option><option value="SUPPORTS">Dá suporte a</option><option value="UPGRADE_OF">Upgrade de</option><option value="SAME_ARCHETYPE">Mesmo arquétipo</option><option value="STORY_RELATED">Relacionado na história</option></select></FieldBlock>
                    <div className="self-end"><Button type="button" className="w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90" onClick={saveCardRelation} disabled={saving || !relationDraft.targetCardId}>Salvar relação</Button></div>
                  </div>
                  {relationCandidates.length ? <div className="grid gap-2 md:grid-cols-2">{relationCandidates.map((candidate) => <button key={candidate.id} type="button" onClick={() => { setRelationDraft((current) => ({ ...current, targetCardId: candidate.id })); setRelationSearch(`${candidate.code} · ${candidate.namePt || candidate.nameEn}`); setRelationCandidates([]); }} className={`border p-3 text-left transition ${relationDraft.targetCardId === candidate.id ? "border-primary bg-primary/10" : "border-white/10 hover:border-white/25"}`}><p className="text-xs uppercase tracking-[0.16em] text-slate-500">{candidate.code} · {candidate.cardType}</p><p className="mt-1 text-sm text-slate-100">{candidate.namePt || candidate.nameEn}</p></button>)}</div> : null}
                  <div className="grid gap-3 lg:grid-cols-2"><FieldBlock label="Nota editorial"><Input id="relation-note" name="relation-note" value={relationDraft.notePt} onChange={(e) => setRelationDraft((current) => ({ ...current, notePt: e.target.value }))} placeholder="Justificativa opcional" className="rounded-none" /></FieldBlock><FieldBlock label="Fonte"><Input id="relation-source" name="relation-source" value={relationDraft.sourceUrl} onChange={(e) => setRelationDraft((current) => ({ ...current, sourceUrl: e.target.value }))} placeholder="URL oficial ou editorial (opcional)" className="rounded-none" /></FieldBlock></div>
                  <div className="space-y-2 border-t border-white/10 pt-4"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Relações confirmadas desta impressão</p>{cardRelations.length ? cardRelations.map((relation) => <div key={`${relation.direction}-${relation.id}`} className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-slate-950/30 p-3"><div><p className="text-xs uppercase tracking-[0.16em] text-primary">{relation.relationType} · {relation.direction === "outgoing" ? "origem" : "recebida"}</p><p className="mt-1 text-sm text-slate-100">{relation.relatedCard?.code} · {relation.relatedCard?.namePt || relation.relatedCard?.nameEn}</p>{relation.notePt ? <p className="mt-1 text-xs text-slate-400">{relation.notePt}</p> : null}</div>{relation.direction === "outgoing" ? <Button type="button" variant="outline" className="h-8 rounded-none text-red-300" onClick={() => deleteCardRelation(relation)}>Ocultar</Button> : <span className="text-xs text-slate-500">Edite na carta de origem</span>}</div>) : <p className="text-sm text-slate-500">Nenhuma relação editorial confirmada ainda.</p>}</div>
                </>}
              </div>

              {/* ARTES */}
              <ModalSection label="Biblioteca visual de artes" />
              <div className="grid gap-4 rounded-none border border-white/10 bg-white/[0.025] p-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Biblioteca da carta</p>
                      <p className="text-[11px] leading-5 text-slate-600">Cadastre várias artes, marque a principal e mantenha a raridade específica de cada imagem.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="rounded-none" onClick={addArtVariant}><Plus className="mr-2 size-4" />Nova arte</Button>
                      <Button type="button" variant="outline" className="rounded-none" onClick={duplicateSelectedArt} disabled={!selectedArt}><Copy className="mr-2 size-4" />Duplicar</Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {cardForm.arts.map((art, index) => (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => setCardForm((current) => ({ ...current, activeArtId: art.id }))}
                        className={`group overflow-hidden rounded-none border text-left transition ${selectedArt?.id === art.id ? "border-primary/60 bg-primary/10" : "border-white/10 bg-slate-950/50 hover:border-white/25 hover:bg-white/[0.04]"}`}
                      >
                        <div className="aspect-[63/88] overflow-hidden border-b border-white/10 bg-slate-950/80">
                          {art.url ? <img src={art.thumbUrl || art.url} alt={art.label || `Arte ${index + 1}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center px-4 text-center text-[11px] uppercase tracking-[0.2em] text-slate-600">Sem preview</div>}
                        </div>
                        <div className="space-y-2 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-slate-100">{art.label || `Arte ${index + 1}`}</p>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{art.rarity || cardForm.rarity}</p>
                            </div>
                            {art.isPrimary ? <Badge className="rounded-none border border-amber-400/40 bg-amber-400/10 text-amber-300"><Star className="mr-1 size-3" />Principal</Badge> : null}
                          </div>
                          <p className="line-clamp-2 text-[11px] leading-5 text-slate-500">{art.url || art.sourceUrl || "Sem URL cadastrada"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Editor da arte selecionada</p>
                      <p className="text-[11px] leading-5 text-slate-600">A imagem principal da carta será sempre a arte marcada com estrela.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="h-9 rounded-none px-3" onClick={() => moveSelectedArt(-1)} disabled={!selectedArt || selectedArtIndex === 0}><ChevronLeft className="size-4" /></Button>
                      <Button type="button" variant="outline" className="h-9 rounded-none px-3" onClick={() => moveSelectedArt(1)} disabled={!selectedArt || selectedArtIndex === cardForm.arts.length - 1}><ChevronRight className="size-4" /></Button>
                      <Button type="button" variant="outline" className="rounded-none" onClick={markPrimaryArt} disabled={!selectedArt || selectedArt.isPrimary}><Star className="mr-2 size-4" />Principal</Button>
                      <Button type="button" variant="outline" className="rounded-none text-red-300 hover:text-red-200" onClick={removeSelectedArt} disabled={!selectedArt || cardForm.arts.length <= 1}><Trash2 className="mr-2 size-4" />Remover</Button>
                    </div>
                  </div>

                  <div className="aspect-[63/88] overflow-hidden border border-white/10 bg-slate-950/80">
                    {selectedArt?.url ? <img src={selectedArt.url} alt={selectedArt.label || "Arte selecionada"} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-6 text-center text-xs uppercase tracking-[0.22em] text-slate-600">Selecione ou envie uma arte</div>}
                  </div>

                  <div className="grid gap-4">
                    <FieldBlock label="Rótulo da arte" hint="Ex.: Arte 1, Full Art, Alt Art, Promo Event"><Input value={selectedArt?.label || ""} onChange={(e) => updateSelectedArt({ label: e.target.value })} placeholder="Arte 1" className="rounded-none" /></FieldBlock>
                    <FieldBlock label="Imagem" hint="Aceita URL externa ou caminho local em /uploads/cards"><Input value={selectedArt?.url || ""} onChange={(e) => updateSelectedArt({ url: e.target.value })} placeholder="/uploads/cards/GD01-001.webp ou URL" className="rounded-none" /></FieldBlock>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FieldBlock label="Raridade da arte"><select value={selectedArt?.rarity || cardForm.rarity} onChange={(e) => updateSelectedArt({ rarity: e.target.value })} className="field-shell h-10 w-full px-3 text-sm">{ART_RARITY_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></FieldBlock>
                      <FieldBlock label="Thumb"><Input value={selectedArt?.thumbUrl || ""} onChange={(e) => updateSelectedArt({ thumbUrl: e.target.value })} placeholder="opcional" className="rounded-none" /></FieldBlock>
                    </div>
                    <FieldBlock label="Fonte da imagem"><Input value={selectedArt?.sourceUrl || ""} onChange={(e) => updateSelectedArt({ sourceUrl: e.target.value })} placeholder="URL de origem da arte" className="rounded-none" /></FieldBlock>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="rounded-none" onClick={triggerArtUpload} disabled={!selectedArt || saving}><Upload className="mr-2 size-4" />Upload local</Button>
                      <p className="self-center text-[11px] leading-5 text-slate-500">O upload preenche a URL desta arte sem sair do modal.</p>
                    </div>
                    <input ref={artUploadInputRef} type="file" accept="image/*" className="hidden" onChange={handleArtUpload} />
                  </div>
                </div>
              </div>

              <datalist id="trait-suggestions">{traitOptions.map((item) => <option key={item} value={item} />)}</datalist>
              <datalist id="link-suggestions">{linkSuggestions.map((item) => <option key={item} value={item} />)}</datalist>
              <datalist id="source-title-suggestions">{sourceTitleOptions.map((item) => <option key={item} value={item} />)}</datalist>
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
                        {effectPreview.keywordMeta.filter((item) => item.kind === "trigger").length
                          ? effectPreview.keywordMeta.filter((item) => item.kind === "trigger").map((item) => <Badge key={`${item.keyword}-${item.qualifier || 'q'}`} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] ${getKeywordStyleClass(item)}`}><span className="mr-1 opacity-90">{getKeywordIcon(item)}</span>{item.keyword}{item.qualifier ? ` · ${item.qualifier}` : ""}{item.native ? "" : " *"}</Badge>)
                          : <span className="text-xs text-slate-700">nenhuma</span>}
                      </div>
                    </div>
 
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-slate-600">Effect keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {effectPreview.keywordMeta.filter((item) => item.kind === "effect").length
                          ? effectPreview.keywordMeta.filter((item) => item.kind === "effect").map((item) => <Badge key={`${item.keyword}-${item.qualifier || 'q'}`} variant="outline" className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] ${getKeywordStyleClass(item)}`}><span className="mr-1 opacity-90">{getKeywordIcon(item)}</span>{item.keyword}{item.qualifier ? ` · ${item.qualifier}` : ""}{item.native ? "" : " *"}</Badge>)
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

                  <div className="border-t border-white/8 pt-3">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-slate-600">Leitura mecânica</p>
                    <div className="space-y-2 text-xs text-slate-500">
                      <div>Keywords nativas: <span className="text-slate-300">{effectPreview.nativeKeywordTags.join(", ") || "nenhuma"}</span></div>
                      <div>Keywords condicionais: <span className="text-slate-300">{effectPreview.conditionalKeywordTags.join(", ") || "nenhuma"}</span></div>
                      <div>Pair/Link qualificados: <span className="text-slate-300">{effectPreview.linkRequirements.map((item) => `${item.keyword} · ${item.qualifier}`).join(" | ") || "nenhum"}</span></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
 
              {/* Ajuda de sintaxe */}
              <Card className="panel-cut rounded-none border-white/10 bg-slate-900/60">
                <CardContent className="space-y-3 p-5">
                  <h3 className="font-heading text-xl uppercase">Sintaxe</h3>
                  <ul className="space-y-2 text-xs leading-6 text-slate-500">
                    <li><span className="text-slate-400">Effects nativos em</span> <code className="rounded bg-white/8 px-1 py-0.5 text-primary">&lt; &gt;</code> <span className="text-slate-600">e gatilhos/condições em</span> <code className="rounded bg-white/8 px-1 py-0.5 text-primary">[ ]</code></li>
                    <li><code className="text-slate-300">&lt;High-Maneuver&gt;</code></li>
                    <li><code className="text-slate-300">[Deploy]: Draw 1.</code></li>
                    <li><code className="text-slate-300">[During Link][Attack] ... gains &lt;First Strike&gt;.</code></li>
                    <li><code className="text-slate-300">[When Paired · (Operation Meteor) Pilot]</code></li>
                    <li><span className="text-slate-600">Alias:</span> <code className="text-slate-400">[While Paired]</code> → <code className="text-slate-300">During Pair</code></li>
                    <li><span className="text-slate-600">Valor numérico:</span> <code className="text-slate-300">&lt;Repair 3&gt;</code>, <code className="text-slate-300">[Activate-Action 2]</code>, <code className="text-slate-300">[Once per Turn 1]</code></li>
                    <li><span className="text-slate-600">*</span> Keyword marcada com asterisco no preview = concedida por efeito, não nativa.</li>
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