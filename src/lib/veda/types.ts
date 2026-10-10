// Contrato das rotas /api/veda/* (resultados de torneio do Veda System). Usado pelo servidor e pelas páginas.
// Mudança aqui é mudança de contrato: as páginas dependem destes nomes.

export type GameColor = "Blue" | "Green" | "Red" | "White" | "Purple";
export type VedaTier = "LARGE_OFFICIAL" | "SMALL_OFFICIAL" | "UNOFFICIAL" | "RANKED" | "TEAM";
export type VedaSourceId = "egman" | "digilab" | "manual";

export interface Paginated<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface VedaSource {
  id: VedaSourceId;
  name: string;
  /** texto de crédito a exibir junto do dado (ex.: "Dados: DigiLab (digilab.cards)") */
  attribution: string;
  url: string | null;
}

/** "N listas de M torneios (de … a …)"; small = menos de 10 listas */
export interface VedaSample {
  lists: number;
  tournaments: number;
  from: string | null;
  to: string | null;
  small: boolean;
}

export interface VedaArchetypeRef {
  name: string;
  slug: string;
  colors: GameColor[];
}

export interface VedaPlayerRef {
  name: string;
  slug: string;
}

export interface VedaPlace {
  city: string | null;
  uf: string | null;
  country: string | null;
  store: string | null;
}

export interface VedaTournamentCard {
  id: string;
  name: string;
  date: string | null;
  tier: VedaTier;
  season: string | null;
  place: VedaPlace;
  participantCount: number | null;
  entriesCount: number;
  decklistsCount: number;
  winner: { player: VedaPlayerRef; archetype: VedaArchetypeRef | null; entryId: string } | null;
  source: VedaSource;
  sourceUrl: string | null;
}

export interface VedaStanding {
  entryId: string;
  placement: number | null;
  placementLabel: string;
  player: VedaPlayerRef;
  archetype: VedaArchetypeRef | null;
  record: string | null;
  hasDecklist: boolean;
}

export interface VedaMetaSlice {
  archetype: VedaArchetypeRef;
  count: number;
  share: number; // 0..1 das inscrições do evento
  bestPlacement: number | null;
}

export interface VedaTournamentDetail extends VedaTournamentCard {
  roundCount: number | null;
  standings: VedaStanding[];
  meta: VedaMetaSlice[];
}

export interface VedaDeckCard {
  cardModelId: string | null;
  code: string;
  name: string;
  namePt: string | null;
  cardType: string;
  color: string | null;
  level: number | null;
  cost: number | null;
  quantity: number;
  imageUrl: string | null;
}

export interface VedaDecklist {
  entryId: string;
  tournament: { id: string; name: string; date: string | null; season: string | null; place: VedaPlace };
  player: VedaPlayerRef;
  placement: number | null;
  placementLabel: string;
  record: string | null;
  archetype: VedaArchetypeRef | null;
  colors: GameColor[];
  totalCards: number;
  /** cartas agrupadas por tipo (UNIT, PILOT, COMMAND, BASE, …), ordenadas por nível e custo */
  groups: Array<{ cardType: string; count: number; cards: VedaDeckCard[] }>;
  /** custo → número de cartas */
  curve: Record<string, number>;
  /** "GD01-001:4,ST01-010:3" para /deckbuilder/novo?lista= */
  deckCode: string;
  source: VedaSource;
  sourceUrl: string | null;
}

export interface VedaPlayerResult {
  tournamentId: string;
  tournamentName: string;
  date: string | null;
  season: string | null;
  place: VedaPlace;
  entryId: string;
  placement: number | null;
  placementLabel: string;
  archetype: VedaArchetypeRef | null;
  record: string | null;
  hasDecklist: boolean;
}

export interface VedaPlayer {
  player: VedaPlayerRef;
  tournaments: number;
  wins: number; // títulos (1º lugar)
  top8: number;
  archetypes: Array<{ archetype: VedaArchetypeRef; count: number }>;
  results: VedaPlayerResult[];
  /** homônimos são fundidos pelo slug do nome */
  nameMayBeShared: true;
}

export interface VedaArchetypeRow {
  archetype: VedaArchetypeRef;
  lists: number;
  share: number; // presença no período (0..1)
  top8Share: number; // fração das listas que ficaram no top 8
  wins: number; // títulos
  winShare: number; // fração dos títulos do período
  bestPlacement: number | null;
}

export interface VedaCardInclusion {
  card: VedaDeckCard; // quantity = cópias mais comuns
  inclusion: number; // fração das listas do arquétipo que usam a carta
  avgCopies: number;
  tier: "core" | "flex" | "tech";
}

export interface VedaArchetypeDetail {
  row: VedaArchetypeRow;
  sample: VedaSample;
  cards: VedaCardInclusion[];
  recentResults: Array<VedaPlayerResult & { player: VedaPlayerRef }>;
  sampleDecklists: Array<{ entryId: string; player: VedaPlayerRef; placementLabel: string; tournamentName: string; date: string | null }>;
}

export interface VedaCardUsage {
  cardModelId: string;
  code: string;
  sample: VedaSample;
  lists: number; // listas que usam a carta
  inclusion: number; // fração das listas do período
  avgCopies: number;
  archetypes: Array<{ archetype: VedaArchetypeRef; lists: number; inclusion: number }>;
  recentDecklists: Array<{ entryId: string; player: VedaPlayerRef; placementLabel: string; tournamentId: string; tournamentName: string; date: string | null; quantity: number }>;
}

export interface VedaSummary {
  sample: VedaSample;
  players: number;
  seasons: Array<{ code: string; name: string; isCurrent: boolean; tournaments: number }>;
  sources: Array<VedaSource & { tournaments: number }>;
  lastTournamentDate: string | null;
  updatedAt: string | null;
}

export interface VedaFilters {
  seasons: Array<{ code: string; name: string; isCurrent: boolean }>;
  tiers: VedaTier[];
  sources: VedaSource[];
  countries: string[];
  ufs: Array<{ uf: string; cities: string[] }>;
  stores: Array<{ name: string; city: string | null; uf: string | null }>;
}

/** formato das listas exportadas para o bot (mesmo do meta-raw da Egman) */
export interface VedaExportList {
  format: string;
  event: string;
  eventType: string;
  date: string | null;
  placing: number | null;
  record: string | null;
  label: string | null;
  player: string;
  main: Record<string, number>;
  source: VedaSourceId;
  country: string | null;
  uf: string | null;
}
