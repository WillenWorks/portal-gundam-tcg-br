/* Domain core types — base unificada para cards, decks, rulings, torneios e admin. */
export type AppRoute =
  | "/"
  | "/portal"
  | "/cards"
  | "/rules"
  | "/tournaments"
  | "/deckbuilder"
  | "/admin";

export type CardColor = "Blue" | "Green" | "Red" | "White" | "Black";
export type CardType = "Unit" | "Pilot" | "Command" | "Base" | "Resource";

export interface CardRecord {
  id: string;
  code: string;
  name: string;
  namePt?: string;
  color: CardColor;
  type: CardType;
  cost: number;
  level?: number;
  ap?: number;
  hp?: number;
  series: string;
  trait: string;
  keywords: string[];
  effect: string;
  imageUrl?: string;
}

export interface DeckEntry {
  cardId: string;
  quantity: number;
}

export interface DeckRecord {
  id: string;
  name: string;
  format: "Constructed" | "Sealed";
  visibility: "Private" | "Unlisted" | "Public";
  entries: DeckEntry[];
}

export interface RuleEntry {
  id: string;
  title: string;
  category: "Basic Rules" | "Vocabulary" | "Keywords" | "Detailed Rules";
  source: "Official Rules" | "Official FAQ" | "Community Explainer";
  summaryPt: string;
  originalRef: string;
  relatedCards?: string[];
  relatedKeyword?: string;
}

export interface TournamentDeckUsage {
  archetype: string;
  share: number;
  topCutConversion: number;
  stapleCards: string[];
}

export interface TournamentRecord {
  id: string;
  name: string;
  season: string;
  format: "Constructed" | "Team Battle" | "Battle Royale" | "Sealed";
  date: string;
  players: number;
  winner: string;
  decks: TournamentDeckUsage[];
}

export interface DashboardMetric {
  label: string;
  value: string;
  note: string;
}

export interface AdminQueueItem {
  id: string;
  type: "Carta" | "Ruling" | "Post" | "Evento";
  title: string;
  status: "Rascunho" | "Revisão" | "Publicado" | "Importação";
  owner: string;
  updatedAt: string;
}
