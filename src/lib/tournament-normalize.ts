/* Normaliza Tournament (report retroativo) e HostedEvent (ao vivo) num formato comum --
 * as duas fontes têm formatos bem diferentes (ver comentário original em
 * TournamentsPage.tsx), mas a Central de Eventos (abas, busca, chips de cor, visão
 * detalhada) precisa tratar as duas de forma idêntica. */
export type NormalizedDeckSnapshot = {
  id: string;
  name: string;
  items: Array<{ quantity: number; section: string; card: { id: string; code: string; nameEn: string; namePt: string | null } }>;
};

export type NormalizedParticipant = {
  id: string;
  placement: number | null;
  playerName: string;
  username: string | null;
  archetype: string | null;
  colors: string[];
  wins: number | null;
  losses: number | null;
  draws: number | null;
  deckShareId: string | null;
  deckSnapshot: NormalizedDeckSnapshot | null;
};

export type NormalizedEvent = {
  kind: "report" | "sistema";
  id: string;
  name: string;
  tier: string;
  format: string;
  dateStart: string | null;
  organizerLabel: string | null;
  locationLabel: string | null;
  vodUrls: string[];
  topCutSize: number | null;
  participants: NormalizedParticipant[];
};

function colorsFromItems(items?: Array<{ card?: { color?: string | null } | null }> | null): string[] {
  return Array.from(new Set((items || []).map((item) => item.card?.color).filter((c): c is string => Boolean(c)))).sort();
}

function normalizeSnapshot(snapshot: any): NormalizedDeckSnapshot | null {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    name: snapshot.name,
    items: (snapshot.items || []).map((item: any) => ({
      quantity: item.quantity,
      section: item.section,
      card: { id: item.card.id, code: item.card.code, nameEn: item.card.nameEn, namePt: item.card.namePt ?? null },
    })),
  };
}

export function normalizeTournament(tournament: any): NormalizedEvent {
  const entries: any[] = tournament.entries || [];
  return {
    kind: "report",
    id: tournament.id,
    name: tournament.name,
    tier: tournament.tier || "SMALL_OFFICIAL",
    format: tournament.format || "constructed",
    dateStart: tournament.dateStart,
    organizerLabel: tournament.organizer || null,
    locationLabel: tournament.city ? `${tournament.city}${tournament.country ? `, ${tournament.country}` : ""}` : null,
    vodUrls: tournament.vodUrls || [],
    topCutSize: tournament.topCutSize ?? null,
    participants: entries.map((entry) => ({
      id: entry.id,
      placement: entry.placement,
      playerName: entry.playerName,
      username: entry.user?.username ?? null,
      archetype: entry.archetype ?? null,
      colors: colorsFromItems(entry.deckSnapshot?.items),
      wins: entry.wins,
      losses: entry.losses,
      draws: entry.draws,
      deckShareId: entry.deck?.shareId ?? null,
      deckSnapshot: normalizeSnapshot(entry.deckSnapshot),
    })),
  };
}

export function normalizeHostedEvent(event: any): NormalizedEvent {
  const standings: any[] = event.standings || [];
  return {
    kind: "sistema",
    id: event.id,
    name: event.name,
    tier: event.tier || "UNOFFICIAL",
    format: event.format || "constructed",
    dateStart: event.dateStart,
    organizerLabel: event.hoster?.displayName || null,
    locationLabel: event.venueName || event.city ? `${event.venueName || ""}${event.venueName && event.city ? " · " : ""}${event.city || ""}` : null,
    vodUrls: event.vodUrls || [],
    topCutSize: null,
    participants: standings.map((row, index) => ({
      id: row.participantId,
      placement: index + 1,
      playerName: row.user?.displayName || row.user?.username || "Piloto",
      username: row.user?.username ?? null,
      archetype: row.archetype ?? null,
      colors: row.colors || colorsFromItems(row.deckSnapshot?.items),
      wins: row.wins ?? null,
      losses: row.losses ?? null,
      draws: row.draws ?? null,
      deckShareId: null,
      deckSnapshot: normalizeSnapshot(row.deckSnapshot),
    })),
  };
}
