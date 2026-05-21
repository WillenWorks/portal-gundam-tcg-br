import type { CardRecord, RuleEntry, TournamentRecord } from "@/modules/core/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787/api";
const TOKEN_KEY = "portal-gundam-tcg-br:token";
const USER_KEY = "portal-gundam-tcg-br:user";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  username: string;
  role: "USER" | "EDITOR" | "ADMIN";
  bio?: string | null;
  avatarUrl?: string | null;
  stats?: { deckCount: number; publicDeckCount: number };
};

export type ApiDeck = {
  id: string;
  shareId: string;
  name: string;
  format: string;
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  notes?: string | null;
  isPrimary: boolean;
  user?: AuthUser;
  items: Array<{ id: string; cardId: string; quantity: number; section: string; card?: any }>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Falha na API.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
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
}

export function clearAuth() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export const api = {
  health: () => request<{ ok: boolean; runtime: string; userCount: number; cardCount: number; deckCount: number }>("/health"),
  register: (payload: { email: string; password: string; displayName: string }) => request<{ token: string; user: AuthUser }>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (email: string, password: string) => request<{ token: string; user: AuthUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<AuthUser>("/auth/me"),
  updateMe: (payload: { displayName?: string; bio?: string; avatarUrl?: string }) => request<AuthUser>("/auth/me", { method: "PUT", body: JSON.stringify(payload) }),
  getPublicProfile: (username: string) => request<{ id: string; username: string; displayName: string; bio?: string | null; avatarUrl?: string | null; decks: ApiDeck[] }>(`/users/${username}`),
  listSets: () => request<any[]>("/sets"),
  createSet: (payload: any) => request<any>("/sets", { method: "POST", body: JSON.stringify(payload) }),
  listCards: (search = "") => request<any[]>(`/cards${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  getCard: (id: string) => request<any>(`/cards/${id}`),
  createCard: (payload: any) => request<any>("/cards", { method: "POST", body: JSON.stringify(payload) }),
  updateCard: (id: string, payload: any) => request<any>(`/cards/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCard: (id: string) => request<void>(`/cards/${id}`, { method: "DELETE" }),
  uploadCardImage: (formData: FormData) => request<{ imageUrl: string; imageSourceUrl: string }>("/cards/upload-image", { method: "POST", body: formData }),
  importCards: (payload: any) => request<{ imported: number; setId: string | null }>("/import/cards", { method: "POST", body: JSON.stringify(payload) }),
  listRulings: () => request<any[]>("/rulings"),
  getRuling: (id: string) => request<any>(`/rulings/${id}`),
  createRuling: (payload: any) => request<any>("/rulings", { method: "POST", body: JSON.stringify(payload) }),
  updateRuling: (id: string, payload: any) => request<any>(`/rulings/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteRuling: (id: string) => request<void>(`/rulings/${id}`, { method: "DELETE" }),
  importRulings: (payload: any) => request<{ imported: number }>("/import/rulings", { method: "POST", body: JSON.stringify(payload) }),
  listTournaments: () => request<any[]>("/tournaments"),
  getTournament: (id: string) => request<any>(`/tournaments/${id}`),
  createTournament: (payload: any) => request<any>("/tournaments", { method: "POST", body: JSON.stringify(payload) }),
  updateTournament: (id: string, payload: any) => request<any>(`/tournaments/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteTournament: (id: string) => request<void>(`/tournaments/${id}`, { method: "DELETE" }),
  listPublicDecks: () => request<ApiDeck[]>("/decks/public"),
  getSharedDeck: (shareId: string) => request<ApiDeck>(`/decks/share/${shareId}`),
  listMyDecks: () => request<ApiDeck[]>("/decks/me"),
  createMyDeck: (payload: any) => request<ApiDeck>("/decks/me", { method: "POST", body: JSON.stringify(payload) }),
  updateMyDeck: (id: string, payload: any) => request<ApiDeck>(`/decks/me/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteMyDeck: (id: string) => request<void>(`/decks/me/${id}`, { method: "DELETE" }),
};

export function mapApiCard(card: any): CardRecord {
  return {
    id: card.id,
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
    effect: card.effectPt ?? card.effectEn ?? "",
    imageUrl: card.imageUrl ?? undefined,
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

export function mapApiTournament(event: any): TournamentRecord {
  return {
    id: event.id,
    name: event.name,
    season: event.season ?? "Unknown",
    format: (event.format === "team_battle" ? "Team Battle" : event.format === "battle_royale" ? "Battle Royale" : "Constructed") as TournamentRecord["format"],
    date: event.dateStart ? new Date(event.dateStart).toISOString().slice(0, 10) : "",
    players: event.participantCount ?? 0,
    winner: event.winner ?? "TBD",
    decks: [],
  };
}
