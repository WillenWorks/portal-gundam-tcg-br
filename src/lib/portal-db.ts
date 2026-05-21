/* Browser persistence aligned to Prisma entities — local persistent store for current static runtime. */
import { nanoid } from "nanoid";

import { cardsSeed, dashboardMetricsSeed, rulesSeed, starterDeckSeed, tournamentsSeed } from "@/data/seed-data";
import type { CardRecord, DeckRecord, RuleEntry, TournamentRecord } from "@/modules/core/types";

export interface PortalDbState {
  cards: CardRecord[];
  rules: RuleEntry[];
  tournaments: TournamentRecord[];
  deck: DeckRecord;
}

const STORAGE_KEY = "portal-gundam-tcg-br:db";
const UPDATE_EVENT = "portal-db-updated";

const initialState: PortalDbState = {
  cards: cardsSeed,
  rules: rulesSeed,
  tournaments: tournamentsSeed,
  deck: starterDeckSeed,
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(UPDATE_EVENT));
  }
}

export function subscribePortalDb(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(UPDATE_EVENT, listener);
  return () => window.removeEventListener(UPDATE_EVENT, listener);
}

export function loadPortalDb(): PortalDbState {
  if (!canUseStorage()) return initialState;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    savePortalDb(initialState);
    return initialState;
  }

  try {
    const parsed = JSON.parse(raw) as PortalDbState;
    return {
      cards: parsed.cards ?? initialState.cards,
      rules: parsed.rules ?? initialState.rules,
      tournaments: parsed.tournaments ?? initialState.tournaments,
      deck: parsed.deck ?? initialState.deck,
    };
  } catch {
    savePortalDb(initialState);
    return initialState;
  }
}

export function savePortalDb(state: PortalDbState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  emitUpdate();
}

export function resetPortalDb() {
  savePortalDb(initialState);
}

export function getDashboardMetrics() {
  const state = loadPortalDb();
  return [
    { label: "Cartas mapeadas", value: String(state.cards.length), note: "persistidas no store local da aplicação" },
    { label: "Rulings indexadas", value: String(state.rules.length), note: "com CRUD operacional no admin" },
    { label: "Eventos catalogados", value: String(state.tournaments.length), note: "prontos para análise e evolução" },
    dashboardMetricsSeed[3],
  ];
}

export function listCards() {
  return loadPortalDb().cards;
}

export function createCard(input: Omit<CardRecord, "id">) {
  const state = loadPortalDb();
  const next = { ...input, id: nanoid(8) };
  savePortalDb({ ...state, cards: [next, ...state.cards] });
  return next;
}

export function updateCard(cardId: string, patch: Omit<CardRecord, "id">) {
  const state = loadPortalDb();
  savePortalDb({
    ...state,
    cards: state.cards.map((card) => (card.id === cardId ? { ...patch, id: cardId } : card)),
  });
}

export function deleteCard(cardId: string) {
  const state = loadPortalDb();
  savePortalDb({ ...state, cards: state.cards.filter((card) => card.id !== cardId) });
}

export function listRules() {
  return loadPortalDb().rules;
}

export function createRule(input: Omit<RuleEntry, "id">) {
  const state = loadPortalDb();
  const next = { ...input, id: nanoid(8) };
  savePortalDb({ ...state, rules: [next, ...state.rules] });
  return next;
}

export function updateRule(ruleId: string, patch: Omit<RuleEntry, "id">) {
  const state = loadPortalDb();
  savePortalDb({
    ...state,
    rules: state.rules.map((rule) => (rule.id === ruleId ? { ...patch, id: ruleId } : rule)),
  });
}

export function deleteRule(ruleId: string) {
  const state = loadPortalDb();
  savePortalDb({ ...state, rules: state.rules.filter((rule) => rule.id !== ruleId) });
}

export function listTournaments() {
  return loadPortalDb().tournaments;
}

export function createTournament(input: Omit<TournamentRecord, "id">) {
  const state = loadPortalDb();
  const next = { ...input, id: nanoid(8) };
  savePortalDb({ ...state, tournaments: [next, ...state.tournaments] });
  return next;
}

export function updateTournament(tournamentId: string, patch: Omit<TournamentRecord, "id">) {
  const state = loadPortalDb();
  savePortalDb({
    ...state,
    tournaments: state.tournaments.map((item) => (item.id === tournamentId ? { ...patch, id: tournamentId } : item)),
  });
}

export function deleteTournament(tournamentId: string) {
  const state = loadPortalDb();
  savePortalDb({
    ...state,
    tournaments: state.tournaments.filter((item) => item.id !== tournamentId),
  });
}

export function getDeck() {
  return loadPortalDb().deck;
}

export function saveDeck(deck: DeckRecord) {
  const state = loadPortalDb();
  savePortalDb({ ...state, deck });
}
