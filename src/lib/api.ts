import type { CardRecord, RuleEntry, TournamentRecord } from "@/modules/core/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787/api";
const TOKEN_KEY = "portal-gundam-tcg-br:token";
const USER_KEY = "portal-gundam-tcg-br:user";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: "USER" | "EDITOR" | "ADMIN";
};

export type ApiDeck = {
  id: string;
  name: string;
  format: string;
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  notes?: string | null;
  isPrimary: boolean;
  items: Array<{ id: string; cardId: string; quantity: number; section: string }>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
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
  health: () => request<{ ok: boolean; userCount: number; runtime: string }>("/health"),
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<AuthUser>("/auth/me"),
  listCards: () => request<any[]>("/cards"),
  createCard: (payload: any) => request<any>("/cards", { method: "POST", body: JSON.stringify(payload) }),
  updateCard: (id: string, payload: any) => request<any>(`/cards/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCard: (id: string) => request<void>(`/cards/${id}`, { method: "DELETE" }),
  listRulings: () => request<any[]>("/rulings"),
  createRuling: (payload: any) => request<any>("/rulings", { method: "POST", body: JSON.stringify(payload) }),
  updateRuling: (id: string, payload: any) => request<any>(`/rulings/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteRuling: (id: string) => request<void>(`/rulings/${id}`, { method: "DELETE" }),
  listTournaments: () => request<any[]>("/tournaments"),
  createTournament: (payload: any) => request<any>("/tournaments", { method: "POST", body: JSON.stringify(payload) }),
  updateTournament: (id: string, payload: any) => request<any>(`/tournaments/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteTournament: (id: string) => request<void>(`/tournaments/${id}`, { method: "DELETE" }),
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
    source:
      rule.sourceType === "OFFICIAL_FAQ"
        ? "Official FAQ"
        : rule.sourceType === "COMMUNITY_EXPLAINER"
          ? "Community Explainer"
          : "Official Rules",
    summaryPt: rule.answerPt ?? rule.questionPt ?? "",
    originalRef: rule.title,
    relatedCards: [],
    relatedKeyword: rule.relatedKeyword ?? undefined,
  };
}

export function mapApiTournament(event: any): TournamentRecord {
  return {
    id: event.id,
    name: event.name,
    season: event.season ?? "Unknown",
    format: (event.format === "team_battle" ? "Team Battle" : "Constructed") as TournamentRecord["format"],
    date: event.dateStart ? new Date(event.dateStart).toISOString().slice(0, 10) : "",
    players: event.participantCount ?? 0,
    winner: event.winner ?? "TBD",
    decks: [],
  };
}
