import type { CardRecord, RuleEntry } from "@/modules/core/types";
import type { PlayerAction } from "@/modules/simulator/engine/actions";
import type { PlayerId } from "@/modules/simulator/engine/types";
import type { ViewGameState } from "@/modules/simulator/engine/viewState";
import type { DeckListWithSideboard } from "@/modules/simulator/engine/sideboard";

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
  isHoster?: boolean;
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
  viewCount?: number;
  likeCount?: number;
  hasLiked?: boolean;
  createdAt?: string;
  updatedAt?: string;
  user?: AuthUser;
  items: Array<{ id: string; cardId: string; quantity: number; section: string; card?: any }>;
  legality?: { valid: boolean; issues: Array<{ type: string; message: string; cardModelId?: string }> };
  featuredCards?: Array<{ id: string; code?: string; name: string; imageUrl: string | null; color?: string | null }>;
};

export type PopularLrCard = {
  id: string;
  code: string;
  nameEn: string;
  namePt?: string | null;
  imageUrl?: string | null;
  imageMediumUrl?: string | null;
  rarity: string;
  color?: string | null;
  cardType?: string | null;
  cost?: number | null;
  level?: number | null;
  deckCount: number;
};

export type PopularRecentDeck = {
  id: string;
  shareId: string;
  name: string;
  coverImage?: string | null;
  viewCount: number;
  recentViews: number;
  likeCount: number;
  hasLiked?: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string | null;
    level?: number;
  };
  featuredCards: Array<{
    id: string;
    code: string;
    name: string;
    imageUrl: string | null;
    color?: string | null;
  }>;
};

export type MetaQuadrant = "CORE" | "STAPLE" | "FLEX" | "TECH";

export interface ArchetypeSummary {
  key: string;
  name: string;
  colors: string[];
  signatureCard: {
    id: string;
    code: string;
    name: string;
    namePt?: string | null;
    nameEn?: string | null;
    imageUrl?: string | null;
    imageMediumUrl?: string | null;
    color?: string | null;
    rarity?: string | null;
    cost?: number | null;
    level?: number | null;
    cardType?: string | null;
  } | null;
  deckCount: number;
  share: number;
}

export interface ClassifiedMetaCard {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  namePt?: string | null;
  imageUrl?: string | null;
  imageMediumUrl?: string | null;
  color?: string | null;
  cardType?: string | null;
  rarity?: string | null;
  cost?: number | null;
  level?: number | null;
  traits?: string[];
  inclusionRate: number;
  colorInclusionRate: number;
  affinity: number;
  meanCopies: number;
  stdDevCopies: number;
  modeCopies: number;
  slotRigidity: number;
  quadrant: MetaQuadrant;
}

export interface SourceDeckEntry {
  id: string;
  name: string;
  shareId?: string;
  author: string;
  tournament?: string;
  placement: string;
  date?: string;
}

export interface CoreBuildSummary {
  coreCards: Array<ClassifiedMetaCard & { recommendedCopies: number }>;
  coreCardCount: number;
  suggestedCards: Array<ClassifiedMetaCard & { recommendedCopies: number }>;
}

export interface CardUsageInfo {
  deckCount: number;
  totalDecks: number;
  presenceRate: number;
  avgCopies: number;
  tier?: "STAPLE" | "KEY" | "COMMON" | "TECH";
  copyCounts?: Record<1 | 2 | 3 | 4, number>;
}

export interface ArchetypeMetaBreakdown {
  archetype: ArchetypeSummary;
  totalDecksSampled: number;
  sourceDecks?: SourceDeckEntry[];
  coreBuild?: CoreBuildSummary;
  quadrants: {
    core: ClassifiedMetaCard[];
    staples: ClassifiedMetaCard[];
    flex: ClassifiedMetaCard[];
    techs: ClassifiedMetaCard[];
  };
  averages: {
    unitCount: number;
    pilotCount: number;
    baseCount: number;
    commandCount: number;
    avgCost: number;
    avgLevel: number;
    compositeCurveScore: number;
  };
}

export interface MetaRecommendationsResponse {
  synergies: Array<ClassifiedMetaCard & { liftScore: number; sourceMatches: string[] }>;
  staples: ClassifiedMetaCard[];
  techs: ClassifiedMetaCard[];
}

export interface MetagameTopCard {
  cardModelId: string;
  name: string;
  color: string | null;
  appearances: number;
  presenceRate: number | null;
  avgCopies: number | null;
  winRate: number | null;
  recordedMatches: number;
}

export interface MetagameTrendCard {
  cardModelId: string;
  name: string;
  color: string | null;
  priorPresenceRate: number;
  recentPresenceRate: number;
  trendDelta: number;
}

export interface MetagameStatsResponse {
  season: { id: string; code: string; name: string } | null;
  setId: string | null;
  totalDecks: number;
  topCards: MetagameTopCard[];
  colorDistribution: Array<{ color: string; decks: number; presenceRate: number | null }>;
  colorCombos: Array<{ combo: string; decks: number; presenceRate: number | null }>;
  traitDistribution: Array<{ trait: string; decks: number; presenceRate: number | null }>;
  seriesDistribution: Array<{ series: string; decks: number; presenceRate: number | null }>;
  trend: { windowStart: string; windowMid: string; windowEnd: string; priorCount: number; recentCount: number } | null;
  risingCards: MetagameTrendCard[];
  decliningCards: MetagameTrendCard[];
}

// Fase 2 -- Power Rankings semanal (ver PLANO_METAGAME_TORNEIOS_TELEMETRIA.md §2.3).
export interface PowerRankingEntry {
  archetype: string;
  colors: string[];
  signatureCard: { id: string; code: string; name: string; imageUrl: string | null; imageMediumUrl: string | null; color: string | null } | null;
  deckCount: number;
  metaShare: number;
  wins: number;
  losses: number;
  draws: number;
  recordedMatches: number;
  winRate: number | null;
  powerRankingScore: number;
  bestPlacement: number | null;
  sampleTournaments: Array<{ id: string; name: string }>;
}

// Fase 3 -- Matriz de Confrontos (SCAFFOLD, ver §2.4).
export interface MatchupCell {
  archetypeA: string;
  archetypeB: string;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
}

export interface MatchupMatrixResponse {
  season: { id: string; code: string; name: string } | null;
  window: string;
  archetypes: string[];
  cells: MatchupCell[];
  wr1st: Record<string, number | null>;
  wr2nd: Record<string, number | null>;
  diceWinRate: Record<string, number | null>;
  sampleSize: number;
  hasData: boolean;
}

// Terminal 3 (docs/54 §8.3) -- Painel de Metagame Regional Geográfico.
export interface RegionCardStat {
  cardModelId: string;
  name: string;
  color: string | null;
  appearances: number;
  presenceRate: number;
  avgCopies: number;
}
export interface RegionColorStat {
  color: string;
  decks: number;
  presenceRate: number;
}
export interface RegionGroupStats {
  key: string;
  label: string;
  totalDecks: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
  colorDistribution: RegionColorStat[];
  topCards: RegionCardStat[];
}
export interface RegionalAnomaly {
  scopeLabel: string;
  kind: "card" | "color";
  label: string;
  regionRate: number;
  nationalRate: number;
  deltaPp: number;
}
export interface RegionalMetaResponse {
  season: { id: string; code: string; name: string } | null;
  setId: string | null;
  totalDecks: number;
  national: RegionGroupStats;
  states: RegionGroupStats[];
  cities: RegionGroupStats[];
  stores: RegionGroupStats[];
  anomalies: RegionalAnomaly[];
  alerts: string[];
}

// Terminal 3 (docs/54 §4) -- Zero Foresight, simulador Monte Carlo de Tier Shift.
export interface ForesightArchetypeResult {
  archetype: string;
  metaShare: number;
  appearances: number;
  projectedWinRate: number | null;
  top8ConversionRate: number;
  top16ConversionRate: number;
  fusionScore: number | null;
  tier: string | null;
}
export interface ForesightInsight {
  type: "presence_impact" | "tier_shift";
  message: string;
}
export interface ZeroForesightResponse {
  season: { id: string; code: string; name: string } | null;
  generatedAt: string;
  seasonId: string | null;
  setId: string | null;
  iterations: number;
  sampleSize: number;
  hasMatchupData: boolean;
  baseline: ForesightArchetypeResult[];
  scenario: ForesightArchetypeResult[] | null;
  insights: ForesightInsight[];
}

// Pastas de Coleção Públicas -- tag opcional por item de binder (dono marca antes de
// compartilhar), exibida como badge no grid/fichário do PublicBinderPage.
export type BinderItemTag = "FOR_TRADE" | "WISHLIST";

export type ApiBinder = {
  id: string;
  shareId: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  createdAt?: string;
  updatedAt?: string;
  user?: AuthUser;
  items: Array<{ id: string; cardId: string; quantity: number; note?: string | null; position?: number; tag?: BinderItemTag | null; card: any }>;
  _count?: { items: number };
};

// Universe Hub — conteúdo rico de série (kind=SOURCE_TITLE) guardado em TaxonomyEntry.metadataJson.
// Formato livre no schema (Json?) — este type documenta o contrato que o admin/seed preenche e
// que SeriesDetailPage consome. Todo campo é opcional pra não quebrar séries só com capa/descrição.
export type SeriesMobileSuit = { name: string; pilot?: string; faction?: string; description?: string; image?: string };
export type SeriesPilot = { name: string; affiliation?: string; description?: string; image?: string };
export type SeriesMetadata = {
  alias?: string;
  era?: string;
  synopsis?: string;
  mobileSuits?: SeriesMobileSuit[];
  pilots?: SeriesPilot[];
  trivia?: string[];
  galleryImages?: string[];
};

// Módulo Editorial — artigos públicos (model Post no schema). postType/status batem 1:1
// com os enums PostType/PostStatus do Prisma (NEWS/PREVIEW/REVIEW/GUIDE, DRAFT/REVIEW/PUBLISHED).
export type PostType = "NEWS" | "PREVIEW" | "REVIEW" | "GUIDE";
export type PostStatus = "DRAFT" | "REVIEW" | "PUBLISHED";
export type ApiPost = {
  id: string;
  authorId: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  contentMd: string;
  coverImage?: string | null;
  galleryJson?: string[] | null;
  youtubeUrl?: string | null;
  postType: PostType;
  status: PostStatus;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  author?: AuthUser;
};

export type TaxonomyEntry = {
  id: string;
  kind: "TRAIT" | "SOURCE_TITLE";
  name: string;
  slug: string;
  description?: string | null;
  coverImage?: string | null;
  officialUrl?: string | null;
  metadataJson?: SeriesMetadata | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  title?: string;
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
  hasMore?: boolean;
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

/** Erro de API com o status HTTP preservado (o `request` genérico jogava só a
 *  mensagem — o simulador precisa distinguir 401 pra tratar sessão expirada). */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
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
    throw new ApiError(data.error || "Falha na API.", response.status);
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

// Simulador — "Simulador Beta" (docs/18, passo 4 + expansão 2026-08-30: fila de
// matchmaking, timer de turno, W.O. por abandono, aberto a qualquer usuário
// logado). O tabuleiro em si sincroniza via SSE (ver buildSimulatorStreamUrl),
// então essas chamadas HTTP são só pra ações pontuais (fila/ping/agir/W.O.) --
// todas sem cache (o estado de uma partida em memória muda a cada ação de
// qualquer um dos 2 jogadores, cachear aqui só causaria tela desatualizada).
export type SimulatorMatchSummary = {
  id: string;
  seats: Record<PlayerId, { userId: string; displayName: string } | null>;
  deckKeys: Partial<Record<PlayerId, string>>;
  turnNumber: number;
  activePlayer: PlayerId;
  phase: "start" | "draw" | "resource" | "main" | "end";
  gameOver: { winner: PlayerId; reason: "deckOut" | "noShieldsBattleDamage" | "abandonment" | "resignation" } | null;
  createdAt: number;
  updatedAt: number;
  version: number;
};

/** Espelha `MatchView` do servidor (matchStore.ts) — visão redigida do motor + metadados de partida (timer, presença) que não são regra de jogo. */
export type SimulatorMatchView = {
  view: ViewGameState;
  matchId: string;
  seat: PlayerId;
  deckKeys: Partial<Record<PlayerId, string>>;
  /** epoch ms até quando a decisão atual pode ser tomada antes do servidor agir sozinho (90s) — null quando não há decisão pendente. */
  turnDeadlineAt: number | null;
  /** último sinal de vida (ping OU ação real) de cada assento — epoch ms — base do W.O. por abandono (3min). */
  lastSeenAt: Partial<Record<PlayerId, number>>;
  version: number;
  /** `Date.now()` do servidor quando esta visão foi montada — pro cliente corrigir skew de relógio. */
  serverNow: number;
  /** valor de `autoPassActionStep` do assento deste viewer (docs/19, Sessão 2). */
  autoPassActionStep: boolean;
  format?: "bo1" | "bo3";
  matchStatus?: "WAITING_PLAYERS" | "READY_TO_START" | "PLAYING" | "SIDEBOARDING" | "FINISHED";
  bo3Score?: { A: number; B: number };
  currentGameIndex?: number;
  sideboardConfirmed?: Partial<Record<PlayerId, boolean>>;
  sideboardDeadlineAt?: number | null;
  sideboardDeck?: DeckListWithSideboard;
};

export type SimulatorMatchState = ({ seated: false } & SimulatorMatchSummary) | ({ seated: true } & SimulatorMatchView);

/** Espelha `QueueStatus` do servidor (matchStore.ts). */
export type SimulatorQueueStatus = { queued: boolean; matched: boolean; matchId?: string; seat?: PlayerId };

/** Dificuldade do bot no modo treino solo (docs/44 Fase 2 §4.2). */
export type SimulatorTrainingLevel = "facil" | "normal" | "dificil";

// --- ZERO SYSTEM — Telemetria, Copilot & Terminal Tático (docs/54, docs/55) ---
export type PilotPersonaId = "amuro" | "char" | "heero" | "analyst" | "adaptive";
export type ZeroThreatLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ZeroTacticalLine {
  priority: number; // 1 (baixa) a 5 (urgente/ótima)
  strategy: "aggressive" | "control" | "tempo" | "defensive";
  actionRecommendation: string;
  targetInstanceId?: string;
  rationale: string;
  winProbabilityDelta: number; // e.g. +0.12 (+12%)
}

export interface ZeroTerminalAnalysis {
  provider: "gemini" | "claude" | "deterministic";
  persona: PilotPersonaId;
  resolvedPersona: "amuro" | "char" | "heero" | "analyst";
  timestamp: string;
  threatLevel: ZeroThreatLevel;
  lethalClockTurns: number;
  winProbabilityEstimate: number; // 0.00 a 1.00
  burstProbabilityEstimate: number; // 0.00 a 1.00 (Matriz de Burst no próximo escudo)
  keyThreats: string[];
  recommendedLines: ZeroTacticalLine[];
  tacticalAdvice: string;
  boardSummary?: any;
}

export interface ZeroDeckConsistencyResult {
  score: number; // 0 a 100
  turn1UnitChance: number; // 0.00 a 1.00
  turn2UnitChance: number; // 0.00 a 1.00
  turn3UnitChance: number; // 0.00 a 1.00
  pilotMatchChance: number; // 0.00 a 1.00
  curveWarning?: string | null;
  diagnostics: string[];
  archetypeSynergies: Array<{ name: string; score: number; description: string }>;
  techCardRecommendations: Array<{
    cardCode: string;
    name: string;
    reason: string;
    role: "Removal" | "Blocker" | "Resource" | "Finisher" | "Tech";
  }>;
}

export interface ZeroChatMessageResponse {
  reply: string;
  persona: PilotPersonaId;
  provider: "gemini" | "claude" | "deterministic";
  timestamp: string;
  references?: string[];
}

/**
 * Deck salvo do usuário já com o veredito de cobertura do simulador
 * (docs/debates 2026-09-14) — `simulatorValid: false` = tem carta sem
 * cobertura no motor (`unplayableCards` lista os códigos), a UI pinta a
 * linha de vermelho e bloqueia com `reason`/`unplayableCards` se o usuário
 * insistir em usar esse deck.
 */
export type SimulatorDeckOption = {
  id: string;
  name: string;
  format: string;
  simulatorValid: boolean;
  unplayableCards: string[];
  reason: string | null;
};

/** URL do stream SSE, já com `?token=` -- EventSource não manda header Authorization (ver server/index.ts, authFromQueryOrHeader). null se não há sessão logada. */
export function buildSimulatorStreamUrl(matchId: string): string | null {
  const token = getStoredAuth().token;
  if (!token) return null;
  return `${API_BASE_URL}/simulator/matches/${matchId}/stream?token=${encodeURIComponent(token)}`;
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

function computeClientSideDeckConsistency(cards: any[]): ZeroDeckConsistencyResult {
  let totalCards = 0;
  let unitT1Count = 0;
  let unitT2Count = 0;
  let unitT3Count = 0;
  let pilotCount = 0;
  let blockerCount = 0;
  let removalCount = 0;
  const colors = new Set<string>();

  for (const c of cards || []) {
    const qty = Number(c.quantity) || 1;
    totalCards += qty;
    const type = String(c.cardType || c.type || "").toUpperCase();
    const isPilot = Boolean(c.isPilot) || type === "PILOT" || type.includes("PILOT");
    const isUnit = type === "UNIT" || (!isPilot && type !== "BASE" && type !== "COMMAND");
    const cost = Number(c.cost) || 0;
    const level = Number(c.level) || 0;
    const turn = Math.max(cost, level);

    if (c.color) colors.add(String(c.color).toLowerCase());
    if (isPilot) pilotCount += qty;
    if (isUnit) {
      if (turn <= 1) unitT1Count += qty;
      if (turn <= 2) unitT2Count += qty;
      if (turn <= 3) unitT3Count += qty;
    }
    const nameLower = String(c.name || c.nameEn || "").toLowerCase();
    const effectLower = String(c.effect || "").toLowerCase();
    if (nameLower.includes("blocker") || effectLower.includes("blocker") || effectLower.includes("bloqueador")) blockerCount += qty;
    if (effectLower.includes("destrua") || effectLower.includes("destroy") || effectLower.includes("dano") || effectLower.includes("damage")) removalCount += qty;
  }

  const N = Math.max(50, totalCards || 50);
  const hyperChance = (kCount: number, handSize = 5) => {
    if (kCount <= 0) return 0;
    let probMiss = 1;
    for (let i = 0; i < handSize; i++) {
      probMiss *= Math.max(0, (N - kCount - i) / (N - i));
    }
    return Math.min(0.99, Math.max(0.01, 1 - probMiss));
  };

  const t1Chance = hyperChance(unitT1Count, 5);
  const t2Chance = hyperChance(unitT2Count, 5);
  const t3Chance = hyperChance(unitT3Count, 5);
  const pilotChance = hyperChance(pilotCount, 5);

  let score = Math.round((t1Chance * 0.25 + t2Chance * 0.35 + t3Chance * 0.25 + pilotChance * 0.15) * 100);
  score = Math.min(98, Math.max(25, score));

  const diagnostics: string[] = [];
  if (unitT1Count < 4) diagnostics.push("Baixa densidade de unidades de Turno 1 (recomendado: 4-8).");
  if (unitT2Count < 8) diagnostics.push("Risco de curva vazia no Turno 2 (recomendado: 8-12 unidades Lv.1-2).");
  if (pilotCount < 6) diagnostics.push("Poucos pilotos na lista para ativação consistente de habilidades Link.");
  if (pilotCount > 14) diagnostics.push("Excesso de pilotos pode poluir a mão inicial sem unidades para parear.");
  if (blockerCount < 4) diagnostics.push("Poucos Blockers defensivos para conter estratégias Rush.");

  const techCardRecommendations: ZeroDeckConsistencyResult["techCardRecommendations"] = [];
  if (colors.has("blue") || colors.has("azul") || colors.size === 0) {
    techCardRecommendations.push({
      cardCode: "ST01-001",
      name: "RX-78-2 Gundam",
      reason: "Estabilizador essencial de meio de jogo com Blocker e combate reativo.",
      role: "Blocker",
    });
    techCardRecommendations.push({
      cardCode: "GD01-015",
      name: "Beam Saber Slash",
      reason: "Remoção rápida de baixo custo para conter investidas Zeon.",
      role: "Removal",
    });
  }
  if (colors.has("red") || colors.has("vermelho")) {
    techCardRecommendations.push({
      cardCode: "ST01-011",
      name: "Char's Zaku II",
      reason: "Pressão agressiva imediata no Turno 2 com ganho de AP por iniciativa.",
      role: "Finisher",
    });
  }
  if (colors.has("green") || colors.has("verde")) {
    techCardRecommendations.push({
      cardCode: "ST02-001",
      name: "Wing Gundam",
      reason: "Poder massivo de fogo e destruição de unidades exauridas.",
      role: "Finisher",
    });
  }

  return {
    score,
    turn1UnitChance: Math.round(t1Chance * 100) / 100,
    turn2UnitChance: Math.round(t2Chance * 100) / 100,
    turn3UnitChance: Math.round(t3Chance * 100) / 100,
    pilotMatchChance: Math.round(pilotChance * 100) / 100,
    curveWarning: diagnostics[0] || null,
    diagnostics,
    archetypeSynergies: [
      { name: "Sinergia de Curva", score: Math.round(t2Chance * 100), description: "Capacidade de desdobramento contínuo de unidades nos 3 primeiros turnos." },
      { name: "Potencial de Link", score: Math.round(pilotChance * 100), description: "Taxa de pareamento ótimo de pilotos em unidades compatíveis." },
    ],
    techCardRecommendations,
  };
}

function computeClientSideZeroChat(message: string, persona: PilotPersonaId = "adaptive"): ZeroChatMessageResponse {
  const m = message.toLowerCase();
  const resolved: "amuro" | "char" | "heero" | "analyst" = persona === "adaptive" ? "amuro" : persona;
  let reply = "";

  if (resolved === "amuro") {
    if (m.includes("zeon") || m.includes("aggro") || m.includes("rush")) {
      reply = "Contra investidas rápidas de Zeon, a chave é não entrar em pânico. Posicione blockers de Turno 2 como o Guncannon ou Guntank e guarde comandos de remoção para o momento em que eles exaurirem recursos. Preservar seus escudos nos primeiros 3 turnos garante a vitória no late game!";
    } else if (m.includes("burst") || m.includes("escudo") || m.includes("shield")) {
      reply = "O efeito Burst é a salvação defensiva. Quando um escudo é quebrado, o efeito ativa imediatamente sem custo de energia. Mantenha pelo menos 6-8 cartas com Burst no deck para punir ataques imprudentes!";
    } else {
      reply = "Entendido. A telemetria mostra que o controle de recursos e posicionamento tático superam a força bruta. Mantenha suas unidades em modo defensivo até que a abertura ideal se revele. Nós podemos vencer isso!";
    }
  } else if (resolved === "char") {
    if (m.includes("zeon") || m.includes("aggro") || m.includes("rush")) {
      reply = "Três vezes mais rápido! Um ataque bem-sucedido não espera o inimigo se preparar. Exaure a base adversária antes do Turno 4 e use unidades de baixo custo com Breach para atravessar blockers frágeis!";
    } else if (m.includes("letal") || m.includes("clock") || m.includes("lethal")) {
      reply = "O cálculo de letal é implacável: se o poder combinado de suas unidades prontas superar a vida restante da base inimiga mais os escudos, declare o ataque total imediatamente. Hesitação é a verdadeira derrota.";
    } else {
      reply = "A velocidade é a essência do combate Mobile Suit. Não permita que o oponente dite o ritmo da partida. Pressione cada ponto vulnerável do tabuleiro!";
    }
  } else if (resolved === "heero") {
    if (m.includes("wing") || m.includes("alvo") || m.includes("troca")) {
      reply = "Missão aceita. Priorize a eliminação das unidades de nível alto do inimigo antes de mirar na base. Trocas de recursos 1 por 1 são aceitáveis se reduzirem a capacidade ofensiva do oponente a zero.";
    } else {
      reply = "Calculando probabilidades de combate... Taxa de sobrevivência do alvo é nula se executarmos a sequência ótima. Sem desvios emocionais: execute o plano tático.";
    }
  } else {
    // Analyst (OZ)
    if (m.includes("burst") || m.includes("timing") || m.includes("regra") || m.includes("rule")) {
      reply = "Diretriz oficial de regras: O efeito Burst é revelado durante a etapa de verificação de dano de combate. Se for um comando com 【Burst】, ele é executado imediatamente como efeito de gatilho prioritário antes que qualquer outro dano seja resolvido.";
    } else if (m.includes("link") || m.includes("piloto")) {
      reply = "Mecânica de Link: Um piloto pareado a uma unidade com mesmo trait ou nome confere bônus de AP/HP e ativa habilidades específicas de pareamento. O piloto não ocupa slot de unidade na Battle Area.";
    } else {
      reply = "Banco de dados Anaheim Electronics sincronizado. O metagame atual registra alta densidade de decks de controle e midrange. Recomenda-se balancear a proporção de 28-32 Unidades, 10-14 Pilotos e 6-10 Comandos.";
    }
  }

  return {
    reply,
    persona,
    provider: "deterministic",
    timestamp: new Date().toISOString(),
    references: ["Manual Oficial Bandai GCG", "Glossário Tático Anaheim", "Docs 17 / 54"],
  };
}

export const api = {
  health: () =>
    request<{ ok: boolean; runtime: string; userCount: number; cardCount: number; deckCount: number; binderCount?: number; setCount?: number; productCount?: number }>("/health", undefined, { ttlMs: 15_000 }),
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
  listPosts: (status?: PostStatus) => request<ApiPost[]>(`/posts${status ? `?status=${encodeURIComponent(status)}` : ""}`, undefined, { ttlMs: 20_000 }),
  listPostsPage: (status?: PostStatus, pagination: PaginationParams = {}) =>
    request<PaginatedResponse<ApiPost>>(`/posts${toQuery({ status, page: String(pagination.page ?? 1), pageSize: String(pagination.pageSize ?? 12) })}`, undefined, { ttlMs: 20_000 }),
  getPostBySlug: (slug: string) => request<ApiPost>(`/posts/slug/${encodeURIComponent(slug)}`, undefined, { ttlMs: 20_000 }),
  createPost: (payload: Partial<ApiPost>) => mutate<ApiPost>("/posts", { method: "POST", body: JSON.stringify(payload) }, ["/posts"]),
  updatePost: (id: string, payload: Partial<ApiPost>) => mutate<ApiPost>(`/posts/${id}`, { method: "PUT", body: JSON.stringify(payload) }, ["/posts"]),
  deletePost: (id: string) => mutate<void>(`/posts/${id}`, { method: "DELETE" }, ["/posts"]),
  listSets: () => request<Array<{ id: string; code: string; namePt?: string | null; nameEn: string; releaseDate?: string | null; _count?: { cards: number } }>>("/sets", undefined, { ttlMs: 60_000 }),
  // Versão de gestão: traz também coleções ocultadas (isActive=false), pro admin poder
  // ver e reativar. GET /sets normal (acima) nunca devolve isso -- é a listagem pública.
  listAdminSets: () => request<any[]>("/sets/admin", undefined, { ttlMs: 5_000 }),
  getSet: (code: string) => request<any>(`/sets/${code}`, undefined, { ttlMs: 30_000 }),
  createSet: (payload: any) => mutate<any>("/sets", { method: "POST", body: JSON.stringify(payload) }, ["/sets"]),
  updateSet: (id: string, payload: any) => mutate<any>(`/sets/${id}`, { method: "PUT", body: JSON.stringify(payload) }, ["/sets", "/cards", "/cards/filters"]),
  deleteSet: (id: string) => mutate<void>(`/sets/${id}`, { method: "DELETE" }, ["/sets", "/cards", "/cards/filters"]),
  // Season -- temporada de metagame de verdade (código/nome/datas + flag "atual").
  listSeasons: () => request<Array<{ id: string; code: string; name: string; startDate?: string | null; endDate?: string | null; isCurrent: boolean; notes?: string | null }>>("/seasons", undefined, { ttlMs: 30_000 }),
  createSeason: (payload: any) => mutate<any>("/seasons", { method: "POST", body: JSON.stringify(payload) }, ["/seasons"]),
  updateSeason: (id: string, payload: any) => mutate<any>(`/seasons/${id}`, { method: "PUT", body: JSON.stringify(payload) }, ["/seasons"]),
  setCurrentSeason: (id: string) => mutate<any>(`/seasons/${id}/set-current`, { method: "PUT" }, ["/seasons", "/stats", "/tournaments", "/hosted-events"]),
  deleteSeason: (id: string) => mutate<void>(`/seasons/${id}`, { method: "DELETE" }, ["/seasons", "/sets", "/tournaments", "/hosted-events"]),
  listTaxonomies: (kind?: "TRAIT" | "SOURCE_TITLE") => request<TaxonomyEntry[]>(`/taxonomies${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`, undefined, { ttlMs: 60_000 }),
  // Mesma lógica de listAdminSets, mas pra Traits/Séries.
  listAdminTaxonomies: (kind?: "TRAIT" | "SOURCE_TITLE") => request<TaxonomyEntry[]>(`/taxonomies/admin${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`, undefined, { ttlMs: 5_000 }),
  createTaxonomy: (payload: any) => mutate<any>("/taxonomies", { method: "POST", body: JSON.stringify(payload) }, ["/taxonomies"]),
  updateTaxonomy: (id: string, payload: any) => mutate<any>(`/taxonomies/${id}`, { method: "PUT", body: JSON.stringify(payload) }, ["/taxonomies"]),
  deleteTaxonomy: (id: string) => mutate<void>(`/taxonomies/${id}`, { method: "DELETE" }, ["/taxonomies"]),
  listCards: (filters: CardFilters = {}) => request<any[]>(`/cards${toQuery(filters)}`, undefined, { ttlMs: 20_000 }),
  listCardsPage: (filters: CardFilters = {}, pagination: PaginationParams = {}) =>
    request<PaginatedResponse<any>>(`/cards${toQuery({ ...filters, page: String(pagination.page ?? 1), pageSize: String(pagination.pageSize ?? 24) })}`, undefined, { ttlMs: 20_000 }),
  getCardFilters: () => request<{ colors: string[]; cardTypes: string[]; rarities: string[]; statuses: string[]; media: string[]; series: string[]; traits: string[]; keywords: string[]; sets: Array<{ code: string; namePt?: string | null; nameEn: string; releaseDate?: string | null }>; missingRelationCounts: { PILOT: number; UNIT: number; COMMAND: number } }>("/cards/filters", undefined, { ttlMs: 5 * 60_000 }),
  getCard: (id: string) => request<any>(`/cards/${id}`, undefined, { ttlMs: 30_000 }),
  getCardRelations: (id: string) => request<{ outgoing: any[]; incoming: any[] }>(`/cards/${id}/relations`, undefined, { ttlMs: 20_000 }),
  getCardStats: (id: string) =>
    request<{ cardModelId: string; hasEnoughData: boolean; deckAppearances: number; totalDecks: number; usageRate: number | null; wins: number; losses: number; draws: number; totalMatches: number; winRate: number | null }>(`/cards/${id}/stats`, undefined, { ttlMs: 60_000 }),
  // Metagame sourced só de decks travados em evento (DeckSnapshot) -- nunca de decks
  // públicos. seasonId: "current" (default), "all", ou o id de uma season específica.
  // color/trait/series: deck elegível = tem >=1 carta batendo o filtro (mesmo critério
  // de setId). startDate/endDate (ISO): recorta pela data real do evento.
  getMetagameStats: (params: { seasonId?: string; setId?: string; color?: string; trait?: string; series?: string; startDate?: string; endDate?: string } = {}) =>
    request<MetagameStatsResponse>(`/stats/metagame${toQuery(params)}`, undefined, { ttlMs: 60_000 }),
  // Fase 2 -- Power Rankings semanal (só resultado real de torneio reportado, ver
  // PLANO_METAGAME_TORNEIOS_TELEMETRIA.md §2.3).
  getPowerRankings: (params: { seasonId?: string; setId?: string } = {}) =>
    request<{ season: { id: string; code: string; name: string } | null; setId: string | null; rankings: PowerRankingEntry[] }>(`/stats/power-rankings${toQuery(params)}`, undefined, { ttlMs: 60_000 }),
  // Fase 3 -- Matriz de Confrontos (SCAFFOLD, ver §2.4). hasData normalmente vem false
  // até existir captura de arquétipo/iniciativa por partida em evento ao vivo.
  getMatchupMatrix: (params: { seasonId?: string; window?: "30d" | "90d" | "all" } = {}) =>
    request<MatchupMatrixResponse>(`/stats/matchup-matrix${toQuery(params)}`, undefined, { ttlMs: 60_000 }),
  // Terminal 3 -- Painel de Metagame Regional Geográfico (docs/54 §8.3). Drill-down
  // País -> Estado -> Cidade -> Loja Parceira; state/city/store filtram o escopo dos
  // "Alertas Táticos Regionais" (comparação contra a média nacional).
  getRegionalMeta: (params: { seasonId?: string; setId?: string; state?: string; city?: string; store?: string } = {}) =>
    request<RegionalMetaResponse>(`/metagame/regional${toQuery(params)}`, undefined, { ttlMs: 60_000 }),
  // Terminal 3 -- Zero Foresight (docs/54 §4). Monte Carlo de 10.000 iterações;
  // scenario.presenceDeltas testa "e se a presença de X mudar Y%?" (fração, ex: 0.10).
  simulateZeroForesight: (payload: { seasonId?: string; setId?: string; scenario?: { presenceDeltas: Record<string, number> }; iterations?: number }) =>
    request<ZeroForesightResponse>("/simulator/zero/foresight/simulate", { method: "POST", body: JSON.stringify(payload) }),
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
  getRulingFilters: () => request<{ sourceTypes: string[]; relatedKeywords: string[]; titles: string[]; relatedPhases: string[] }>("/rulings/filters", undefined, { ttlMs: 60_000 }),
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
  // Auditoria de troca de deck vinculado a um TournamentEntry -- só admin/editor.
  getTournamentEntryDeckChangeLog: (tournamentId: string, entryId: string) =>
    request<Array<{ id: string; previousDeckId: string | null; previousDeckSnapshotId: string | null; nextDeckId: string | null; nextDeckSnapshotId: string | null; createdAt: string; changedByUser: { id: string; username: string; displayName: string } | null }>>(`/tournaments/${tournamentId}/entries/${entryId}/deck-change-log`, undefined, { ttlMs: 5_000 }),
  // Pública -- eventos "ao vivo" (via /organizador) já finalizados, pra exibir junto
  // com os Tournament report na tela pública de Eventos.
  listCompletedHostedEvents: () => request<any[]>("/hosted-events/public", undefined, { ttlMs: 20_000 }),
  listHostedEventsMine: () => request<any[]>("/hosted-events/mine", undefined, { ttlMs: 5_000 }),
  listHostedEventsAdmin: () => request<any[]>("/hosted-events/admin", undefined, { ttlMs: 5_000 }),
  getHostedEvent: (id: string) => request<any>(`/hosted-events/${id}`, undefined, { ttlMs: 5_000 }),
  createHostedEvent: (payload: any) => mutate<any>("/hosted-events", { method: "POST", body: JSON.stringify(payload) }, ["/hosted-events"]),
  updateHostedEvent: (id: string, payload: any) => mutate<any>(`/hosted-events/${id}`, { method: "PUT", body: JSON.stringify(payload) }, ["/hosted-events"]),
  deleteHostedEvent: (id: string) => mutate<void>(`/hosted-events/${id}`, { method: "DELETE" }, ["/hosted-events"]),
  // Fase B: busca de usuários pro Hoster montar a lista de participantes -- sem cache
  // (bypassCache) porque é uma busca incremental enquanto o organizador digita.
  searchUsers: (q: string) =>
    request<Array<{ id: string; username: string; displayName: string; avatarUrl?: string | null }>>(`/users/search${toQuery({ q })}`, undefined, { bypassCache: true }),
  addHostedEventParticipant: (eventId: string, userId: string) =>
    mutate<any>(`/hosted-events/${eventId}/participants`, { method: "POST", body: JSON.stringify({ userId }) }, ["/hosted-events"]),
  removeHostedEventParticipant: (eventId: string, participantId: string) =>
    mutate<void>(`/hosted-events/${eventId}/participants/${participantId}`, { method: "DELETE" }, ["/hosted-events"]),
  // Trava o deck do participante -- ação de mão única no backend (uma vez travado,
  // o servidor recusa qualquer nova tentativa com 409).
  lockHostedEventParticipantDeck: (eventId: string, participantId: string, deckId: string) =>
    mutate<any>(`/hosted-events/${eventId}/participants/${participantId}/deck`, { method: "POST", body: JSON.stringify({ deckId }) }, ["/hosted-events"]),
  // Fase C: rodadas, confrontos e classificação. Pareamento e resultado são lançados
  // manualmente pelo Hoster -- toda mutação invalida o cache de /hosted-events pra
  // refletir na tela do organizador imediatamente.
  getHostedEventStandings: (eventId: string) => request<any[]>(`/hosted-events/${eventId}/standings`, undefined, { ttlMs: 5_000 }),
  createHostedEventRound: (eventId: string) =>
    mutate<any>(`/hosted-events/${eventId}/rounds`, { method: "POST" }, ["/hosted-events"]),
  updateHostedEventRound: (eventId: string, roundId: string, status: string) =>
    mutate<any>(`/hosted-events/${eventId}/rounds/${roundId}`, { method: "PUT", body: JSON.stringify({ status }) }, ["/hosted-events"]),
  deleteHostedEventRound: (eventId: string, roundId: string) =>
    mutate<void>(`/hosted-events/${eventId}/rounds/${roundId}`, { method: "DELETE" }, ["/hosted-events"]),
  createHostedEventMatch: (eventId: string, roundId: string, payload: { participantAId: string; participantBId?: string | null; tableNumber?: number | null }) =>
    mutate<any>(`/hosted-events/${eventId}/rounds/${roundId}/matches`, { method: "POST", body: JSON.stringify(payload) }, ["/hosted-events"]),
  reportHostedEventMatchResult: (eventId: string, roundId: string, matchId: string, result: string) =>
    mutate<any>(`/hosted-events/${eventId}/rounds/${roundId}/matches/${matchId}`, { method: "PUT", body: JSON.stringify({ result }) }, ["/hosted-events"]),
  deleteHostedEventMatch: (eventId: string, roundId: string, matchId: string) =>
    mutate<void>(`/hosted-events/${eventId}/rounds/${roundId}/matches/${matchId}`, { method: "DELETE" }, ["/hosted-events"]),
  generateHostedEventSwissRound: (eventId: string) =>
    mutate<any>(`/hosted-events/${eventId}/rounds/generate-swiss`, { method: "POST" }, ["/hosted-events"]),
  generateHostedEventTopCut: (eventId: string, cutSize?: 4 | 8 | 16) =>
    mutate<any>(`/hosted-events/${eventId}/top-cut/generate`, { method: "POST", body: JSON.stringify({ cutSize }) }, ["/hosted-events"]),
  getHostedEventTvData: (eventId: string) =>
    request<any>(`/hosted-events/${eventId}/tv`, undefined, { ttlMs: 3_000, bypassCache: true }),
  getHostedEventCheckinStatus: (eventId: string) =>
    request<any>(`/hosted-events/${eventId}/checkin-status`, undefined, { bypassCache: true }),
  checkinHostedEvent: (eventId: string, deckId: string) =>
    mutate<any>(`/hosted-events/${eventId}/checkin`, { method: "POST", body: JSON.stringify({ deckId }) }, ["/hosted-events"]),
  listPublicDecks: () => request<ApiDeck[]>("/decks/public", undefined, { ttlMs: 15_000 }),
  getDeckLegalityData: () => request<{ rules: { mainSize: number; resourceSize: number; maxColors: number; maxCopiesDefault: number }; banned: any[]; restricted: any[]; banGroups: any[] }>("/decks/legality", undefined, { ttlMs: 60_000 }),
  listPublicDecksPage: (
    pagination: PaginationParams = {},
    filters?: {
      q?: string;
      sort?: string;
      author?: string;
      color?: string;
      unit?: string;
      mainUnit?: string;
      exactColor?: boolean;
      starterDecksOnly?: boolean;
      dateRange?: string;
      startDate?: string;
      endDate?: string;
    }
  ) =>
    request<PaginatedResponse<ApiDeck>>(
      `/decks/public${toQuery({
        page: String(pagination.page ?? 1),
        pageSize: String(pagination.pageSize ?? 12),
        q: filters?.q,
        sort: filters?.sort,
        author: filters?.author,
        color: filters?.color,
        unit: filters?.unit,
        mainUnit: filters?.mainUnit,
        exactColor: filters?.exactColor ? "true" : undefined,
        starterDecksOnly: filters?.starterDecksOnly ? "true" : undefined,
        dateRange: filters?.dateRange,
        startDate: filters?.startDate,
        endDate: filters?.endDate,
      })}`,
      undefined,
      { ttlMs: 15_000 }
    ),
  listMainLRUnits: () => request<PopularLrCard[]>("/cards/main-lr-units", undefined, { ttlMs: 60_000 }),
  listTokens: () => request<any[]>("/tokens", undefined, { ttlMs: 300_000 }),
  getSharedDeck: (shareId: string) => request<ApiDeck>(`/decks/share/${shareId}`, undefined, { ttlMs: 20_000 }),
  getPopularLRCards: () => request<PopularLrCard[]>("/stats/popular-lr-cards", undefined, { ttlMs: 30_000 }),
  getRecentPopularDecks: (days = 15) => request<PopularRecentDeck[]>(`/decks/popular-recent?days=${days}`, undefined, { ttlMs: 15_000 }),
  getMetaArchetypes: () => request<ArchetypeSummary[]>("/stats/meta/archetypes", undefined, { ttlMs: 60_000 }),
  getArchetypeBreakdown: (key: string) => request<ArchetypeMetaBreakdown>(`/stats/meta/archetypes/${encodeURIComponent(key)}`, undefined, { ttlMs: 60_000 }),
  getMetaRecommendations: (payload: { cardCodes: string[]; colors?: string[] }) =>
    request<MetaRecommendationsResponse>("/stats/meta/recommendations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getCardUsageStats: (cardCodes: string[]) =>
    request<Record<string, CardUsageInfo>>("/cards/usage-stats", {
      method: "POST",
      body: JSON.stringify({ cardCodes }),
    }, { ttlMs: 60_000 }),
  recordDeckView: (deckId: string) => mutate<{ recorded: boolean; viewCount: number }>(`/decks/${deckId}/view`, { method: "POST" }, []),
  toggleDeckLike: (deckId: string) => mutate<{ liked: boolean; likeCount: number }>(`/decks/${deckId}/like`, { method: "POST" }, ["/decks/"]),
  getDeckLikeStatus: (deckId: string) => request<{ liked: boolean; likeCount: number }>(`/decks/${deckId}/like-status`, undefined, { ttlMs: 5_000 }),
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
  // Simulador Beta — fila de matchmaking (docs/18, expansão 2026-08-30): 1 botão só,
  // sem escolher assento/adversário manualmente; cada lado escolhe o próprio deck.
  joinSimulatorQueue: (deck: string) => request<SimulatorQueueStatus>("/simulator/queue/join", { method: "POST", body: JSON.stringify({ deck }) }),
  leaveSimulatorQueue: () => request<{ ok: true }>("/simulator/queue/leave", { method: "POST" }),
  getSimulatorQueueStatus: () => request<SimulatorQueueStatus>("/simulator/queue/status", undefined, { bypassCache: true }),
  /** Decks salvos do usuário + veredito de cobertura do simulador (verde/vermelho na UI de escolha de deck). */
  listMySimulatorDecks: () => request<SimulatorDeckOption[]>("/simulator/my-decks", undefined, { bypassCache: true }),
  getSimulatorMatch: (id: string) => request<SimulatorMatchState>(`/simulator/matches/${id}`, undefined, { bypassCache: true }),
  sendSimulatorAction: (id: string, action: PlayerAction) =>
    request<SimulatorMatchView>(`/simulator/matches/${id}/actions`, { method: "POST", body: JSON.stringify(action) }),
  // Modo treino solo contra o bot heurístico (docs/44 Fase 2 §4.2). Cria uma
  // partida com o jogador no assento A e o bot no B; a UI de partida é a mesma
  // (`/simulador/partida/:matchId`), o bot joga sozinho via worker `sim-bot`.
  startSimulatorTraining: (payload: { deckId?: string; playerDeckId?: string; botDeckId?: string; level: SimulatorTrainingLevel }) =>
    request<{ matchId: string }>("/simulator/training/new", { method: "POST", body: JSON.stringify(payload) }),
  getSimulatorTraining: (id: string) =>
    request<{ seated: true } & SimulatorMatchView>(`/simulator/training/${id}`, undefined, { bypassCache: true }),
  /** Heartbeat de presença -- chamar periodicamente enquanto a aba está visível (alimenta o W.O. por abandono). */
  pingSimulatorMatch: (id: string) => request<SimulatorMatchView>(`/simulator/matches/${id}/ping`, { method: "POST" }),
  /** Liga/desliga o auto-pass de Action Step do assento (docs/19, Sessão 2). */
  setSimulatorAutoPass: (id: string, value: boolean) =>
    request<SimulatorMatchView>(`/simulator/matches/${id}/auto-pass`, { method: "POST", body: JSON.stringify({ value }) }),
  /** Bug report in-game (docs/44 Fase 3 §5.1) — o servidor congela o GameState + battleLog + cartas em jogo e devolve o `shortCode` ("BUG-XXXXXX") pra acompanhar. */
  reportSimulatorSituation: (id: string, note?: string) =>
    request<{ shortCode: string }>(`/simulator/matches/${id}/report`, { method: "POST", body: JSON.stringify({ note }) }),
  /** Só funciona depois de 3min sem nenhum sinal de vida do oponente -- o servidor rejeita antes disso (ver matchStore.claimAbandonWin). */
  claimSimulatorAbandonWin: (id: string) => request<SimulatorMatchView>(`/simulator/matches/${id}/claim-abandon-win`, { method: "POST" }),
  /** "Sair da partida" = desistência imediata (concede a vitória ao oponente). Ver matchStore.resignMatch. */
  resignSimulatorMatch: (id: string) => request<SimulatorMatchView>(`/simulator/matches/${id}/resign`, { method: "POST" }),
  /** Submete trocas de Sideboard entre jogos Bo3. */
  submitSimulatorSideboard: (id: string, swaps?: { mainOut: string[]; sideIn: string[] }) =>
    request<SimulatorMatchView>(`/simulator/matches/${id}/sideboard`, {
      method: "POST",
      body: JSON.stringify({ swaps }),
    }),
  // Depuração/admin -- fora do fluxo normal (agora hosterRequired no servidor), mantidas
  // só como fallback pra criar/entrar numa partida específica manualmente.
  listSimulatorMatches: () => request<SimulatorMatchSummary[]>("/simulator/matches", undefined, { bypassCache: true }),
  createSimulatorMatch: (payload: { deckA?: string; deckB?: string; firstPlayer?: PlayerId; seed?: number }) =>
    request<SimulatorMatchSummary>("/simulator/matches", { method: "POST", body: JSON.stringify(payload) }),
  // Zero System — Telemetria Tática, Copilot de Deck e Chatbot de Regras (docs/54, docs/55)
  getSimulatorZeroTerminal: async (id: string, persona?: PilotPersonaId): Promise<ZeroTerminalAnalysis> => {
    try {
      const data = await request<any>(`/simulator/matches/${id}/zero-terminal${persona ? `?persona=${encodeURIComponent(persona)}` : ""}`, undefined, { bypassCache: true });
      if (data && typeof data === "object") {
        return {
          provider: data.provider || "deterministic",
          persona: persona || data.persona || "adaptive",
          resolvedPersona: data.resolvedPersona || (persona === "char" ? "char" : persona === "heero" ? "heero" : persona === "analyst" ? "analyst" : "amuro"),
          timestamp: data.timestamp || new Date().toISOString(),
          threatLevel: data.threatLevel || "LOW",
          lethalClockTurns: typeof data.lethalClockTurns === "number" ? data.lethalClockTurns : 99,
          winProbabilityEstimate: typeof data.winProbabilityEstimate === "number" ? data.winProbabilityEstimate : 0.5,
          burstProbabilityEstimate: typeof data.burstProbabilityEstimate === "number" ? data.burstProbabilityEstimate : 0.28,
          keyThreats: Array.isArray(data.keyThreats) ? data.keyThreats : [],
          recommendedLines: Array.isArray(data.recommendedLines) ? data.recommendedLines : [],
          tacticalAdvice: data.tacticalAdvice || "Mantenha a formação defensiva e monitore a área de recursos.",
          boardSummary: data.boardSummary,
        };
      }
    } catch {
      /* fallback determinístico caso o backend esteja em atualização */
    }

    const resolved: "amuro" | "char" | "heero" | "analyst" = persona === "char" ? "char" : persona === "heero" ? "heero" : persona === "analyst" ? "analyst" : "amuro";
    return {
      provider: "deterministic",
      persona: persona || "adaptive",
      resolvedPersona: resolved,
      timestamp: new Date().toISOString(),
      threatLevel: "MEDIUM",
      lethalClockTurns: 4,
      winProbabilityEstimate: 0.55,
      burstProbabilityEstimate: 0.32,
      keyThreats: ["Unidade inimiga com Blocker pronta para interceptação"],
      recommendedLines: [
        {
          priority: 5,
          strategy: "control",
          actionRecommendation: "Desenvolver recurso de base antes de declarar combate.",
          rationale: "Garante energia para respostas no turno do oponente.",
          winProbabilityDelta: 0.08,
        },
        {
          priority: 4,
          strategy: "tempo",
          actionRecommendation: "Parear Piloto na unidade principal da Battle Area.",
          rationale: "Ativa bônus de Link e eleva AP acima do limiar de sobrevivência adversário.",
          winProbabilityDelta: 0.12,
        },
      ],
      tacticalAdvice:
        resolved === "char"
          ? "Velocidade total! Force o oponente a gastar escudos prematuramente."
          : resolved === "heero"
            ? "Calculando rota de destruição. Alvo prioritário identificado na vanguarda."
            : resolved === "analyst"
              ? "Telemetria Anaheim: Risco moderado de burst no próximo escudo. Proceda com cautela."
              : "Preserve suas posições e não desperdice unidades sem suporte de pilotos.",
    };
  },
  analyzeSimulatorZeroTerminal: (payload: { matchId: string; persona?: PilotPersonaId; forceDeterministic?: boolean }) =>
    request<ZeroTerminalAnalysis>("/simulator/zero-terminal/analyze", { method: "POST", body: JSON.stringify(payload) }),
  analyzeZeroDeckConsistency: async (cards: any[]): Promise<ZeroDeckConsistencyResult> => {
    try {
      const res = await request<any>("/simulator/zero/deck/analyze", { method: "POST", body: JSON.stringify({ cards }) });
      if (res && typeof res.score === "number") return res;
    } catch {
      /* fallback determinístico com cálculo hipergeométrico local */
    }
    return computeClientSideDeckConsistency(cards);
  },
  sendZeroChatMessage: async (
    messageOrPayload: string | { message: string; persona?: PilotPersonaId; matchId?: string; forceDeterministic?: boolean },
    personaParam?: PilotPersonaId,
    _context?: { matchId?: string; deckCodes?: string[] },
  ): Promise<ZeroChatMessageResponse> => {
    const message = typeof messageOrPayload === "string" ? messageOrPayload : messageOrPayload.message;
    const persona = typeof messageOrPayload === "string" ? personaParam || "adaptive" : messageOrPayload.persona || "adaptive";
    const payload = typeof messageOrPayload === "object" ? messageOrPayload : { message, persona, matchId: _context?.matchId };

    try {
      const res = await request<any>("/simulator/zero/chat", { method: "POST", body: JSON.stringify(payload) });
      if (res && res.reply) return res;
    } catch {
      /* fallback determinístico caso o endpoint do chatbot esteja em atualização */
    }
    return computeClientSideZeroChat(message, persona);
  },
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
    linkText: card.linkText ?? null,
    pilotName: card.pilotName ?? null,
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
    summaryPt: rule.answerPt ?? rule.answerEn ?? "",
    questionPt: rule.questionPt ?? rule.questionEn ?? "",
    examplePlayPt: rule.examplePlayPt ?? undefined,
    originalRef: rule.originalUrl ?? rule.title,
    relatedCards: rule.card ? [rule.card.id] : [],
    relatedKeyword: rule.relatedKeyword ?? undefined,
    relatedPhase: rule.relatedPhase ?? undefined,
  };
}
