import type { CardRecord, RuleEntry } from "@/modules/core/types";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787/api";
const TOKEN_KEY = "portal-gundam-tcg-br:token";
const USER_KEY = "portal-gundam-tcg-br:user";
const API_CACHE_PREFIX = "portal-gundam-tcg-br:api-cache:";
const apiMemoryCache = new Map<string, { expiresAt: number; data: unknown }>();

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  username: string;
  role: "USER" | "EDITOR" | "ADMIN";
  bio?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean;
  preferredCardLanguage?: "PT_BR" | "EN";
  preferredTheme?: string | null;
  hasPassword?: boolean;
  stats?: { deckCount: number; publicDeckCount: number; binderCount?: number };
};

export type ApiDeck = {
  id: string;
  shareId: string;
  name: string;
  format: string;
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  notes?: string | null;
  coverImage?: string | null;
  featuredCardIds?: string[];
  isPrimary: boolean;
  createdAt?: string;
  updatedAt?: string;
  user?: AuthUser;
  items: Array<{ id: string; cardId: string; quantity: number; section: string; card?: any }>;
  legality?: { valid: boolean; issues: Array<{ type: string; message: string; cardModelId?: string }> };
  featuredCards?: Array<{ id: string; name: string; imageUrl: string | null }>;
};

export type ApiBinder = {
  id: string;
  shareId: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  createdAt?: string;
  updatedAt?: string;
  user?: AuthUser;
  items: Array<{ id: string; cardId: string; quantity: number; note?: string | null; position?: number; card: any }>;
  _count?: { items: number };
};

export type CardFilters = {
  q?: string;
  color?: string;
  cardType?: string;
  media?: string;
  series?: string;
  trait?: string;
  keyword?: string;
  setCode?: string;
  rarity?: string;
  ap?: string;
  hp?: string;
  cost?: string;
  level?: string;
  link?: string;
  relation?: string;
  status?: string;
  sort?: string;
};

export type RulingFilters = {
  q?: string;
  sourceType?: string;
  relatedKeyword?: string;
  sort?: string;
};

export type PaginationParams = {
  page?: number;
  pageSize?: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type RequestOptions = {
  ttlMs?: number;
  bypassCache?: boolean;
};

function getCacheStorageKey(key: string) {
  return `${API_CACHE_PREFIX}${key}`;
}

function readCachedValue<T>(key: string): T | null {
  const now = Date.now();
  const memoized = apiMemoryCache.get(key);
  if (memoized && memoized.expiresAt > now) return memoized.data as T;
  if (memoized) apiMemoryCache.delete(key);

  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(getCacheStorageKey(key));
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { expiresAt: number; data: T };
    if (parsed.expiresAt <= now) {
      window.sessionStorage.removeItem(getCacheStorageKey(key));
      return null;
    }
    apiMemoryCache.set(key, parsed);
    return parsed.data;
  } catch {
    window.sessionStorage.removeItem(getCacheStorageKey(key));
    return null;
  }
}

function writeCachedValue<T>(key: string, data: T, ttlMs: number) {
  if (ttlMs <= 0) return;
  const payload = { expiresAt: Date.now() + ttlMs, data };
  apiMemoryCache.set(key, payload);
  if (typeof window === "undefined") return;
  // Escrita em sessionStorage é best-effort: se estourar a quota (catálogo grande
  // cacheado ao longo da sessão), NUNCA pode derrubar a resposta da API que já
  // chegou com sucesso — o cache é só uma otimização, não pode virar ponto de
  // falha do app inteiro. Se estourar, limpa o cache antigo e tenta de novo uma
  // vez; se ainda assim falhar, segue sem cachear essa entrada.
  try {
    window.sessionStorage.setItem(getCacheStorageKey(key), JSON.stringify(payload));
  } catch {
    try {
      clearApiCacheStorage();
      window.sessionStorage.setItem(getCacheStorageKey(key), JSON.stringify(payload));
    } catch {
      // Ainda estourando mesmo depois de limpar — provavelmente essa entrada é
      // grande demais pra guardar (ex: catálogo inteiro sem paginação). Segue
      // sem cache pra essa chamada específica; a próxima requisição busca de novo.
    }
  }
}

function clearApiCacheStorage() {
  if (typeof window === "undefined") return;
  const storageKeys: string[] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith(API_CACHE_PREFIX)) storageKeys.push(key);
  }
  storageKeys.forEach((storageKey) => window.sessionStorage.removeItem(storageKey));
}

export function invalidateApiCache(prefixes: string[]) {
  const absolutePrefixes = prefixes.map((prefix) => `${API_BASE_URL}${prefix}`);
  Array.from(apiMemoryCache.keys()).forEach((key) => {
    if (absolutePrefixes.some((prefix) => key.startsWith(prefix))) apiMemoryCache.delete(key);
  });

  if (typeof window === "undefined") return;
  const storageKeys: string[] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith(API_CACHE_PREFIX)) storageKeys.push(key);
  }
  storageKeys.forEach((storageKey) => {
    const rawKey = storageKey.slice(API_CACHE_PREFIX.length);
    if (absolutePrefixes.some((prefix) => rawKey.startsWith(prefix))) {
      window.sessionStorage.removeItem(storageKey);
    }
  });
}

async function request<T>(path: string, init?: RequestInit, options?: RequestOptions): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
  const headers = new Headers(init?.headers);
  const method = (init?.method || "GET").toUpperCase();
  if (!(init?.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const cacheKey = `${API_BASE_URL}${path}`;
  const ttlMs = method === "GET" ? options?.ttlMs ?? 0 : 0;
  if (ttlMs > 0 && !options?.bypassCache) {
    const cached = readCachedValue<T>(cacheKey);
    if (cached !== null) return cached;
  }

  // O cache HTTP nativo do navegador (governado pelo Cache-Control que o backend manda)
  // fica ATIVO independente do cache da aplicação aqui — mesmo com o cache interno já
  // invalidado corretamente, um fetch() normal pode voltar servido direto do cache do
  // navegador sem nem chegar no servidor, porque o "max-age" da resposta anterior ainda
  // não expirou. Isso já causou dois bugs (excluir deck que reaparece depois de recarregar
  // a página, mesmo já tendo sido excluído de verdade no banco). Como o app já tem seu
  // próprio cache com invalidação correta (ttlMs + invalidateApiCache), o cache HTTP do
  // navegador é só redundante e vira fonte de inconsistência — desligado sempre, não só
  // quando bypassCache está ligado.
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Falha na API.");
  }
  if (response.status === 204) return undefined as T;
  const data = (await response.json()) as T;
  if (ttlMs > 0) writeCachedValue(cacheKey, data, ttlMs);
  return data;
}

async function mutate<T>(path: string, init: RequestInit, invalidatePrefixes: string[]): Promise<T> {
  const result = await request<T>(path, init);
  invalidateApiCache(invalidatePrefixes);
  return result;
}

function toQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function getStoredAuth() {
  if (typeof window === "undefined") return { token: null, user: null as AuthUser | null };
  const token = window.localStorage.getItem(TOKEN_KEY);
  const rawUser = window.localStorage.getItem(USER_KEY);
  return { token, user: rawUser ? (JSON.parse(rawUser) as AuthUser) : null };
}

export function storeAuth(token: string, user: AuthUser) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  invalidateApiCache(["/auth/me", "/decks/me"]);
}

export function clearAuth() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  invalidateApiCache(["/auth/me", "/decks/me"]);
}

export const api = {
  health: () => request<{ ok: boolean; runtime: string; userCount: number; cardCount: number; deckCount: number }>("/health", undefined, { ttlMs: 15_000 }),
  register: (payload: { email: string; password: string; displayName: string }) => request<{ token: string; user: AuthUser }>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (email: string, password: string) => request<{ token: string; user: AuthUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  loginWithGoogle: (credential: string) => request<{ token: string; user: AuthUser }>("/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  me: () => request<AuthUser>("/auth/me", undefined, { ttlMs: 10_000 }),
  updateMe: (payload: { displayName?: string; bio?: string; avatarUrl?: string; preferredCardLanguage?: "PT_BR" | "EN"; preferredTheme?: string }) => mutate<AuthUser>("/auth/me", { method: "PUT", body: JSON.stringify(payload) }, ["/auth/me", "/users/", "/decks/me", "/binders/me"]),
  updatePassword: (payload: { currentPassword?: string; newPassword: string }) => mutate<{ ok: true }>("/auth/password", { method: "PUT", body: JSON.stringify(payload) }, ["/auth/me"]),
  uploadAvatar: (formData: FormData) => mutate<AuthUser>("/auth/me/avatar", { method: "POST", body: formData }, ["/auth/me"]),
  getPublicProfile: (username: string) => request<{ id: string; username: string; displayName: string; bio?: string | null; avatarUrl?: string | null; decks: ApiDeck[]; binders: ApiBinder[] }>(`/users/${username}`, undefined, { ttlMs: 30_000 }),
  listAdminUsers: () => request<any[]>("/users/admin", undefined, { ttlMs: 5_000 }),
  updateAdminUser: (id: string, payload: any) => mutate<AuthUser>(`/users/admin/${id}`, { method: "PUT", body: JSON.stringify(payload) }, ["/users/admin", "/auth/me", "/users/"]),
  listPosts: (status?: string) => request<any[]>(`/posts${status ? `?status=${encodeURIComponent(status)}` : ""}`, undefined, { ttlMs: 20_000 }),
  listPostsPage: (status?: string, pagination: PaginationParams = {}) =>
    request<PaginatedResponse<any>>(`/posts${toQuery({ status, page: String(pagination.page ?? 1), pageSize: String(pagination.pageSize ?? 12) })}`, undefined, { ttlMs: 20_000 }),
  createPost: (payload: any) => mutate<any>("/posts", { method: "POST", body: JSON.stringify(payload) }, ["/posts"]),
  updatePost: (id: string, payload: any) => mutate<any>(`/posts/${id}`, { method: "PUT", body: JSON.stringify(payload) }, ["/posts"]),
  deletePost: (id: string) => mutate<void>(`/posts/${id}`, { method: "DELETE" }, ["/posts"]),
  listSets: () => request<Array<{ id: string; code: string; namePt?: string | null; nameEn: string; releaseDate?: string | null; _count?: { cards: number } }>>("/sets", undefined, { ttlMs: 60_000 }),
  getSet: (code: string) => request<any>(`/sets/${code}`, undefined, { ttlMs: 30_000 }),
  createSet: (payload: any) => mutate<any>("/sets", { method: "POST", body: JSON.stringify(payload) }, ["/sets"]),
  updateSet: (id: string, payload: any) => mutate<any>(`/sets/${id}`, { method: "PUT", body: JSON.stringify(payload) }, ["/sets", "/cards", "/cards/filters"]),
  deleteSet: (id: string) => mutate<void>(`/sets/${id}`, { method: "DELETE" }, ["/sets", "/cards", "/cards/filters"]),
  listTaxonomies: (kind?: "TRAIT" | "SOURCE_TITLE") => request<any[]>(`/taxonomies${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`, undefined, { ttlMs: 60_000 }),
  createTaxonomy: (payload: any) => mutate<any>("/taxonomies", { method: "POST", body: JSON.stringify(payload) }, ["/taxonomies"]),
  updateTaxonomy: (id: string, payload: any) => mutate<any>(`/taxonomies/${id}`, { method: "PUT", body: JSON.stringify(payload) }, ["/taxonomies"]),
  deleteTaxonomy: (id: string) => mutate<void>(`/taxonomies/${id}`, { method: "DELETE" }, ["/taxonomies"]),
  listCards: (filters: CardFilters = {}) => request<any[]>(`/cards${toQuery(filters)}`, undefined, { ttlMs: 20_000 }),
  listCardsPage: (filters: CardFilters = {}, pagination: PaginationParams = {}) =>
    request<PaginatedResponse<any>>(`/cards${toQuery({ ...filters, page: String(pagination.page ?? 1), pageSize: String(pagination.pageSize ?? 24) })}`, undefined, { ttlMs: 20_000 }),
  getCardFilters: () => request<{ colors: string[]; cardTypes: string[]; rarities: string[]; statuses: string[]; media: string[]; series: string[]; traits: string[]; keywords: string[]; sets: Array<{ code: string; namePt?: string | null; nameEn: string; releaseDate?: string | null }>; missingRelationCounts: { PILOT: number; UNIT: number; COMMAND: number } }>("/cards/filters", undefined, { ttlMs: 5 * 60_000 }),
  getCard: (id: string) => request<any>(`/cards/${id}`, undefined, { ttlMs: 30_000 }),
  getCardRelations: (id: string) => request<{ outgoing: any[]; incoming: any[] }>(`/cards/${id}/relations`, undefined, { ttlMs: 20_000 }),
  createCardRelation: (id: string, payload: { targetCardId: string; relationType: string; notePt?: string | null; sourceUrl?: string | null }) => mutate<any>(`/cards/${id}/relations`, { method: "POST", body: JSON.stringify(payload) }, ["/cards"]),
  deleteCardRelation: (id: string, relationId: string) => mutate<void>(`/cards/${id}/relations/${relationId}`, { method: "DELETE" }, ["/cards"]),
  createCard: (payload: any) => mutate<any>("/cards", { method: "POST", body: JSON.stringify(payload) }, ["/cards", "/cards/filters", "/sets", "/stats"]),
  updateCard: (id: string, payload: any) => mutate<any>(`/cards/${id}`, { method: "PUT", body: JSON.stringify(payload) }, ["/cards", "/cards/filters", "/sets", "/stats"]),
  deleteCard: (id: string) => mutate<void>(`/cards/${id}`, { method: "DELETE" }, ["/cards", "/cards/filters", "/sets", "/stats"]),
  addCardPrint: (modelId: string, payload: any) => mutate<any>(`/cards/${modelId}/prints`, { method: "POST", body: JSON.stringify(payload) }, ["/cards", "/cards/filters"]),
  updateCardPrint: (printId: string, payload: any) => mutate<any>(`/cards/prints/${printId}`, { method: "PUT", body: JSON.stringify(payload) }, ["/cards", "/cards/filters"]),
  deleteCardPrint: (printId: string) => mutate<void>(`/cards/prints/${printId}`, { method: "DELETE" }, ["/cards", "/cards/filters"]),
  uploadCardImage: (formData: FormData) => request<{ imageUrl: string; publicUrl?: string; imageSourceUrl: string; storageDriver?: string; storageBucket?: string; storageKey?: string; originalName?: string; mimeType?: string; size?: number }>("/cards/upload-image", { method: "POST", body: formData }),
  uploadAssetImage: (formData: FormData) => request<{ imageUrl: string; publicUrl?: string; imageSourceUrl: string; storageDriver?: string; storageBucket?: string; storageKey?: string; originalName?: string; mimeType?: string; size?: number }>("/uploads/image", { method: "POST", body: formData }),
  importCards: (payload: any) => mutate<{ imported: number; setId: string | null }>("/import/cards", { method: "POST", body: JSON.stringify(payload) }, ["/cards", "/cards/filters", "/sets", "/stats"]),
  importCatalog: (payload: any) => mutate<{ imported: { sets: number; cards: number; rulings: number; tournaments: number; images: number }; clearedExisting: boolean }>("/import/catalog", { method: "POST", body: JSON.stringify(payload) }, ["/cards", "/cards/filters", "/sets", "/rulings", "/rulings/filters", "/tournaments", "/stats", "/decks/public", "/decks/me"]),
  importImageManifest: (payload: { items: any[] }) => mutate<{ imported: number }>("/import/images-manifest", { method: "POST", body: JSON.stringify(payload) }, ["/cards", "/sets", "/decks/public"]),
  listRulings: (filters: RulingFilters = {}) => request<any[]>(`/rulings${toQuery(filters)}`, undefined, { ttlMs: 20_000 }),
  getRulingFilters: () => request<{ sourceTypes: string[]; relatedKeywords: string[] }>("/rulings/filters", undefined, { ttlMs: 60_000 }),
  getRuling: (id: string) => request<any>(`/rulings/${id}`, undefined, { ttlMs: 30_000 }),
  createRuling: (payload: any) => mutate<any>("/rulings", { method: "POST", body: JSON.stringify(payload) }, ["/rulings", "/rulings/filters"]),
  updateRuling: (id: string, payload: any) => mutate<any>(`/rulings/${id}`, { method: "PUT", body: JSON.stringify(payload) }, ["/rulings", "/rulings/filters"]),
  deleteRuling: (id: string) => mutate<void>(`/rulings/${id}`, { method: "DELETE" }, ["/rulings", "/rulings/filters"]),
  importRulings: (payload: any) => mutate<{ imported: number }>("/import/rulings", { method: "POST", body: JSON.stringify(payload) }, ["/rulings", "/rulings/filters"]),
  listTournaments: () => request<any[]>("/tournaments", undefined, { ttlMs: 20_000 }),
  getTournament: (id: string) => request<any>(`/tournaments/${id}`, undefined, { ttlMs: 20_000 }),
  createTournament: (payload: any) => mutate<any>("/tournaments", { method: "POST", body: JSON.stringify(payload) }, ["/tournaments", "/stats"]),
  updateTournament: (id: string, payload: any) => mutate<any>(`/tournaments/${id}`, { method: "PUT", body: JSON.stringify(payload) }, ["/tournaments", "/stats"]),
  deleteTournament: (id: string) => mutate<void>(`/tournaments/${id}`, { method: "DELETE" }, ["/tournaments", "/stats"]),
  createTournamentEntry: (tournamentId: string, payload: any) => mutate<any>(`/tournaments/${tournamentId}/entries`, { method: "POST", body: JSON.stringify(payload) }, ["/tournaments", "/stats"]),
  updateTournamentEntry: (tournamentId: string, entryId: string, payload: any) => mutate<any>(`/tournaments/${tournamentId}/entries/${entryId}`, { method: "PUT", body: JSON.stringify(payload) }, ["/tournaments", "/stats"]),
  deleteTournamentEntry: (tournamentId: string, entryId: string) => mutate<void>(`/tournaments/${tournamentId}/entries/${entryId}`, { method: "DELETE" }, ["/tournaments", "/stats"]),
  listPublicDecks: () => request<ApiDeck[]>("/decks/public", undefined, { ttlMs: 15_000 }),
  getDeckLegalityData: () => request<{ rules: { mainSize: number; resourceSize: number; maxColors: number; maxCopiesDefault: number }; banned: any[]; restricted: any[]; banGroups: any[] }>("/decks/legality", undefined, { ttlMs: 60_000 }),
  listPublicDecksPage: (pagination: PaginationParams = {}) =>
    request<PaginatedResponse<ApiDeck>>(`/decks/public${toQuery({ page: String(pagination.page ?? 1), pageSize: String(pagination.pageSize ?? 12) })}`, undefined, { ttlMs: 15_000 }),
  getSharedDeck: (shareId: string) => request<ApiDeck>(`/decks/share/${shareId}`, undefined, { ttlMs: 20_000 }),
  listMyDecks: (options?: { bypassCache?: boolean }) => request<ApiDeck[]>("/decks/me", undefined, { ttlMs: 10_000, bypassCache: options?.bypassCache }),
  getMyDeck: (id: string) => request<ApiDeck>(`/decks/me/${id}`, undefined, { ttlMs: 5_000 }),
  listMyDecksPage: (pagination: PaginationParams = {}) =>
    request<PaginatedResponse<ApiDeck>>(`/decks/me${toQuery({ page: String(pagination.page ?? 1), pageSize: String(pagination.pageSize ?? 12) })}`, undefined, { ttlMs: 10_000 }),
  createMyDeck: (payload: any) => mutate<ApiDeck>("/decks/me", { method: "POST", body: JSON.stringify(payload) }, ["/decks/me", "/decks/public", "/users/"]),
  updateMyDeck: (id: string, payload: any) => mutate<ApiDeck>(`/decks/me/${id}`, { method: "PUT", body: JSON.stringify(payload) }, ["/decks/me", "/decks/public", "/decks/share", "/users/"]),
  deleteMyDeck: (id: string) => mutate<void>(`/decks/me/${id}`, { method: "DELETE" }, ["/decks/me", "/decks/public", "/users/"]),
  listMyBinders: (options?: { bypassCache?: boolean }) => request<ApiBinder[]>("/binders/me", undefined, { ttlMs: 10_000, bypassCache: options?.bypassCache }),
  getMyBinder: (id: string) => request<ApiBinder>(`/binders/me/${id}`, undefined, { ttlMs: 5_000 }),
  createBinder: (payload: { name: string; description?: string; isPublic?: boolean }) => mutate<ApiBinder>("/binders/me", { method: "POST", body: JSON.stringify(payload) }, ["/binders/me", "/users/"]),
  updateMyBinder: (id: string, payload: any) => mutate<ApiBinder>(`/binders/me/${id}`, { method: "PUT", body: JSON.stringify(payload) }, ["/binders/me", "/users/", "/binders/share"]),
  deleteBinder: (id: string) => mutate<void>(`/binders/me/${id}`, { method: "DELETE" }, ["/binders/me", "/users/"]),
  getSharedBinder: (shareId: string) => request<ApiBinder>(`/binders/share/${shareId}`, undefined, { ttlMs: 20_000 }),
};

export function mapApiCard(card: any): CardRecord {
  // Duas formas possíveis de entrada: uma "linha de pool" (GET /api/cards, achatada
  // por CardModel — .id é o modelo, .printId é a impressão exibida) ou uma "impressão
  // crua" (ex: deck.items[].card, direto da tabela Card — .id já É a impressão, e
  // .cardModelId é o campo próprio dela apontando pro modelo). Os dois casos precisam
  // resolver printId/cardModelId de forma consistente pro deckbuilder poder usar sem
  // se importar de onde veio.
  const printId: string = card.printId ?? card.id;
  const cardModelId: string = card.cardModelId ?? card.id;
  return {
    id: card.id,
    printId,
    cardModelId,
    code: card.code,
    name: card.nameEn,
    namePt: card.namePt ?? card.nameEn,
    color: (card.color ?? "Blue") as CardRecord["color"],
    type: (card.cardType ?? "Unit") as CardRecord["type"],
    cost: card.cost ?? 0,
    level: card.level ?? undefined,
    ap: card.ap ?? undefined,
    hp: card.hp ?? undefined,
    series: card.series ?? "",
    trait: card.trait ?? "",
    keywords: card.keywordTags ?? [],
    triggerKeywords: card.triggerKeywords ?? [],
    effect: card.effectPt ?? card.effectEn ?? "",
    rarity: card.rarity ?? undefined,
    setCode: card.set?.code ?? card.setCode ?? undefined,
    setName: card.set?.namePt ?? card.set?.nameEn ?? undefined,
    imageUrl: card.imageMediumUrl ?? card.imageUrl ?? undefined,
    imageSmallUrl: card.imageSmallUrl ?? card.thumbUrl ?? undefined,
    imageMediumUrl: card.imageMediumUrl ?? card.imageUrl ?? undefined,
    imageLargeUrl: card.imageLargeUrl ?? card.imageUrl ?? undefined,
  };
}

export function mapApiRule(rule: any): RuleEntry {
  return {
    id: rule.id,
    title: rule.title,
    category: (rule.relatedKeyword ? "Keywords" : "Detailed Rules") as RuleEntry["category"],
    source: rule.sourceType === "OFFICIAL_FAQ" ? "Official FAQ" : rule.sourceType === "COMMUNITY_EXPLAINER" ? "Community Explainer" : "Official Rules",
    summaryPt: rule.answerPt ?? rule.questionPt ?? "",
    originalRef: rule.originalUrl ?? rule.title,
    relatedCards: rule.card ? [rule.card.id] : [],
    relatedKeyword: rule.relatedKeyword ?? undefined,
  };
}
