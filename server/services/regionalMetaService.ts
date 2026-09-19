/*
 * Painel de Metagame Regional Geográfico (docs/54 §8.3, "Zero Local Intelligence").
 * Reaproveita a mesma fonte tratada como "resultado real" que o resto do sistema de
 * metagame usa (TournamentEntry / HostedEventParticipant com deckSnapshotId travado,
 * nunca Deck/DeckItem público -- ver comentário no topo de server/metagameTrendsService.ts),
 * mas agrupa por hierarquia geográfica: País -> Estado -> Cidade -> Loja Parceira.
 *
 * O schema (Tournament/HostedEvent) não tem coluna de Estado (só country/city livres) --
 * ver SCHEMA.md "Simplicidade Primeiro" e "No Foreign Keys": em vez de migrar o banco só
 * pra isso, o Estado é DERIVADO do texto da cidade, com suporte a sufixo "Cidade - UF"
 * quando já vem informado assim, em 2 camadas: (1) dicionário manual de capitais/praças
 * competitivas/desambiguações conhecidas (CITY_TO_UF abaixo), com prioridade; (2) fallback
 * pros ~5.050 municípios do IBGE com nome único entre as UFs (data/ibge-municipios-uf.json,
 * gerado por scripts/generate-ibge-city-uf.mjs, Sprint 2 docs/debates 2026-09-18). "Loja
 * Parceira" usa HostedEvent.venueName (evento ao vivo, tem nome de local) com fallback
 * pro Tournament.organizer (report retroativo -- normalmente é o nome de quem organizou).
 */
import { HostedEventStatus, HostedEventMatchResult, type PrismaClient } from "@prisma/client";
import { NON_STATS_SECTIONS, NON_STATS_CARD_TYPES } from "../../src/lib/deck-legality.ts";
import ibgeCityToUfData from "../../data/ibge-municipios-uf.json";

const TOP_CARDS_LIMIT = 8;
const TOP_GROUPS_LIMIT = 20;
const ANOMALY_THRESHOLD_PP = 15; // pontos percentuais de desvio pra virar alerta tático
// Amostra mínima pra virar alerta tático. N=4 (valor anterior) gera falso-positivo trivial:
// com 4 decks, 1 card presente em todos já é 100% de presença sem significar nada sobre a
// praça real. N=30 é o piso convencional pra estimativa de proporção não degenerar num
// ruído puro (regra prática de amostragem estatística) -- abaixo disso, o alerta é suprimido
// mesmo que o desvio pareça grande.
const MIN_SAMPLE_SIZE_FOR_ANOMALY = 30;
const UNKNOWN_LABEL = "Não informado";
const INDEPENDENT_STORE_LABEL = "Independente / Sem loja vinculada";

const VALID_UF = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

const UF_NAME_PT: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
  MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
  PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

/** Cidade normalizada (sem acento/caixa) -> UF. Capitais, praças competitivas comuns e
 *  desambiguações conhecidas (nome de cidade que colide entre UFs no IBGE cru); tem
 *  prioridade sobre IBGE_CITY_TO_UF. Qualquer cidade fora daqui E fora do IBGE cai em
 *  UNKNOWN_LABEL (nunca inventa um estado). */
const CITY_TO_UF: Record<string, string> = {
  // Sudeste
  "sao paulo": "SP", "campinas": "SP", "santos": "SP", "sorocaba": "SP", "santo andre": "SP",
  "sao bernardo do campo": "SP", "sao jose dos campos": "SP", "ribeirao preto": "SP",
  "guarulhos": "SP", "osasco": "SP", "jundiai": "SP", "bauru": "SP", "piracicaba": "SP",
  "rio de janeiro": "RJ", "niteroi": "RJ", "duque de caxias": "RJ", "nova iguacu": "RJ",
  "petropolis": "RJ", "volta redonda": "RJ", "campos dos goytacazes": "RJ",
  "belo horizonte": "MG", "uberlandia": "MG", "contagem": "MG", "juiz de fora": "MG",
  "betim": "MG", "montes claros": "MG", "uberaba": "MG",
  "vitoria": "ES", "vila velha": "ES", "serra": "ES", "cariacica": "ES",
  // Sul
  "curitiba": "PR", "londrina": "PR", "maringa": "PR", "ponta grossa": "PR",
  "cascavel": "PR", "foz do iguacu": "PR", "sao jose dos pinhais": "PR",
  "porto alegre": "RS", "caxias do sul": "RS", "pelotas": "RS", "canoas": "RS",
  "santa maria": "RS", "gravatai": "RS", "novo hamburgo": "RS",
  "florianopolis": "SC", "joinville": "SC", "blumenau": "SC", "chapeco": "SC",
  "criciuma": "SC", "itajai": "SC", "sao jose": "SC",
  // Centro-Oeste
  "brasilia": "DF",
  "goiania": "GO", "aparecida de goiania": "GO", "anapolis": "GO",
  "campo grande": "MS", "dourados": "MS",
  "cuiaba": "MT", "varzea grande": "MT", "rondonopolis": "MT",
  // Nordeste
  "salvador": "BA", "feira de santana": "BA", "vitoria da conquista": "BA", "ilheus": "BA",
  "recife": "PE", "jaboatao dos guararapes": "PE", "olinda": "PE", "caruaru": "PE",
  "fortaleza": "CE", "caucaia": "CE", "juazeiro do norte": "CE",
  "sao luis": "MA", "imperatriz": "MA",
  "joao pessoa": "PB", "campina grande": "PB",
  "natal": "RN", "mossoro": "RN",
  "maceio": "AL", "arapiraca": "AL",
  "aracaju": "SE",
  "teresina": "PI",
  // Norte
  "manaus": "AM",
  "belem": "PA", "ananindeua": "PA",
  "porto velho": "RO",
  "macapa": "AP",
  "boa vista": "RR",
  "rio branco": "AC",
  "palmas": "TO",
};

/** Municípios brasileiros gerado do IBGE (scripts/generate-ibge-city-uf.mjs, Sprint 2
 *  docs/debates 2026-09-18) -- ~5.050 cidades com nome único entre as UFs. Cidades com
 *  nome ambíguo (existe em 2+ estados, ex. "Rio Branco" em AC e MT) ficam de fora desse
 *  arquivo de propósito; se precisarem de resolução, entram no CITY_TO_UF manual abaixo. */
const IBGE_CITY_TO_UF: Record<string, string> = ibgeCityToUfData.cityToUf;

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalizeCityKey(text: string): string {
  return stripAccents(text.trim().toLowerCase()).replace(/\s+/g, " ");
}

/** Deriva a UF a partir do texto livre de cidade: primeiro tenta um sufixo explícito
 *  ("Curitiba - PR", "Curitiba/PR", "Curitiba, PR"), depois o dicionário de cidades
 *  conhecidas. Nunca adivinha -- sem match, cai em UNKNOWN_LABEL. */
export function deriveStateFromCity(city: string | null | undefined, country: string | null | undefined): { uf: string | null; stateLabel: string; cityLabel: string } {
  const rawCity = (city || "").trim();
  if (!rawCity) return { uf: null, stateLabel: UNKNOWN_LABEL, cityLabel: UNKNOWN_LABEL };

  const countryNormalized = normalizeCityKey(country || "brasil");
  const isBrazil = !country || countryNormalized === "brasil" || countryNormalized === "br" || countryNormalized === "brazil";
  if (!isBrazil) return { uf: null, stateLabel: (country || "").trim() || UNKNOWN_LABEL, cityLabel: rawCity };

  const suffixMatch = rawCity.match(/^(.*?)[\s,\-/]+([A-Za-z]{2})$/);
  if (suffixMatch) {
    const candidateUf = suffixMatch[2].toUpperCase();
    if (VALID_UF.has(candidateUf)) {
      const cityPart = suffixMatch[1].trim() || rawCity;
      return { uf: candidateUf, stateLabel: `${candidateUf} — ${UF_NAME_PT[candidateUf]}`, cityLabel: cityPart };
    }
  }

  const key = normalizeCityKey(rawCity);
  // Dicionário manual (capitais + praças competitivas + desambiguações conhecidas) tem
  // prioridade sobre o gerado do IBGE -- é onde ficam os casos que precisam de reforço
  // explícito (ex. "Rio Branco" -> AC, ambíguo no IBGE cru por colidir com Rio Branco/MT).
  const uf = CITY_TO_UF[key] ?? IBGE_CITY_TO_UF[key];
  if (uf) return { uf, stateLabel: `${uf} — ${UF_NAME_PT[uf]}`, cityLabel: rawCity };

  return { uf: null, stateLabel: UNKNOWN_LABEL, cityLabel: rawCity };
}

export interface RegionalMetaParams {
  seasonId: string | null;
  setId?: string | null;
  stateUf?: string | null;
  city?: string | null;
  store?: string | null;
}

interface CardFields {
  id: string;
  cardModelId: string | null;
  nameEn: string;
  namePt: string | null;
  color: string | null;
  cardType: string;
}
type ItemRow = { deckSnapshotId: string; quantity: number; card: CardFields | null };
type Outcome = { wins: number; losses: number; draws: number };
type SnapshotGeo = { snapshotId: string; country: string; uf: string | null; stateLabel: string; city: string; store: string };

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
export interface RegionalMetaResult {
  totalDecks: number;
  national: RegionGroupStats;
  states: RegionGroupStats[];
  cities: RegionGroupStats[];
  stores: RegionGroupStats[];
  anomalies: RegionalAnomaly[];
  alerts: string[];
}

function emptyGroupStats(key: string, label: string): RegionGroupStats {
  return { key, label, totalDecks: 0, wins: 0, losses: 0, draws: 0, winRate: null, colorDistribution: [], topCards: [] };
}

/** Mesma agregação (cor + carta) usada em metagameTrendsService.getMetagameStats, mas
 *  isolada por grupo geográfico em vez de pelo recorte global inteiro. */
function aggregateGroup(key: string, label: string, snapshotIds: string[], bySnapshot: Map<string, ItemRow[]>, outcomeBySnapshot: Map<string, Outcome>): RegionGroupStats {
  const totalDecks = snapshotIds.length;
  if (!totalDecks) return emptyGroupStats(key, label);

  let wins = 0, losses = 0, draws = 0;
  const colorCount = new Map<string, number>();
  const cardAgg = new Map<string, { name: string; color: string | null; decks: number; totalCopies: number }>();

  for (const snapshotId of snapshotIds) {
    const outcome = outcomeBySnapshot.get(snapshotId);
    if (outcome) {
      wins += outcome.wins;
      losses += outcome.losses;
      draws += outcome.draws;
    }
    const items = bySnapshot.get(snapshotId) || [];
    const seenColors = new Set<string>();
    const seenCards = new Set<string>();
    for (const item of items) {
      const card = item.card;
      if (!card || NON_STATS_CARD_TYPES.includes(card.cardType)) continue;
      if (card.color && !seenColors.has(card.color)) {
        seenColors.add(card.color);
        colorCount.set(card.color, (colorCount.get(card.color) ?? 0) + 1);
      }
      const cardKey = card.cardModelId || card.id;
      const agg = cardAgg.get(cardKey) || { name: card.namePt || card.nameEn, color: card.color, decks: 0, totalCopies: 0 };
      agg.totalCopies += item.quantity;
      if (!seenCards.has(cardKey)) {
        seenCards.add(cardKey);
        agg.decks += 1;
      }
      cardAgg.set(cardKey, agg);
    }
  }

  const presenceRate = (decks: number) => Number(((decks / totalDecks) * 100).toFixed(1));
  const totalMatches = wins + losses + draws;

  return {
    key,
    label,
    totalDecks,
    wins,
    losses,
    draws,
    winRate: totalMatches > 0 ? Number(((wins / totalMatches) * 100).toFixed(1)) : null,
    colorDistribution: Array.from(colorCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([color, decks]) => ({ color, decks, presenceRate: presenceRate(decks) })),
    topCards: Array.from(cardAgg.entries())
      .sort((a, b) => b[1].decks - a[1].decks)
      .slice(0, TOP_CARDS_LIMIT)
      .map(([cardModelId, agg]) => ({
        cardModelId,
        name: agg.name,
        color: agg.color,
        appearances: agg.decks,
        presenceRate: presenceRate(agg.decks),
        avgCopies: Number((agg.totalCopies / agg.decks).toFixed(2)),
      })),
  };
}

function buildAlerts(scopeLabel: string, anomalies: RegionalAnomaly[]): string[] {
  return anomalies.map((a) => {
    if (a.kind === "card") {
      const direction = a.deltaPp >= 0 ? "acima" : "abaixo";
      return `${scopeLabel}: ${a.regionRate.toFixed(0)}% dos decks utilizam ${a.label}, ${Math.abs(a.deltaPp).toFixed(0)}pp ${direction} da média nacional (${a.nationalRate.toFixed(0)}%). Ajuste sua análise de sideboard pra essa praça.`;
    }
    const direction = a.deltaPp >= 0 ? "subiu" : "caiu";
    return `${scopeLabel}: a presença da cor ${a.label} ${direction} ${Math.abs(a.deltaPp).toFixed(0)}pp em relação à média nacional (local ${a.regionRate.toFixed(0)}% vs. nacional ${a.nationalRate.toFixed(0)}%). Reavalie o matchup spread do seu deck pra esse circuito.`;
  });
}

function detectAnomalies(scopeLabel: string, region: RegionGroupStats, national: RegionGroupStats): RegionalAnomaly[] {
  if (region.totalDecks < MIN_SAMPLE_SIZE_FOR_ANOMALY) return [];
  const anomalies: RegionalAnomaly[] = [];

  const nationalColorRate = new Map(national.colorDistribution.map((c) => [c.color, c.presenceRate]));
  for (const c of region.colorDistribution) {
    const nationalRate = nationalColorRate.get(c.color) ?? 0;
    const delta = c.presenceRate - nationalRate;
    if (Math.abs(delta) >= ANOMALY_THRESHOLD_PP) {
      anomalies.push({ scopeLabel, kind: "color", label: c.color, regionRate: c.presenceRate, nationalRate, deltaPp: Number(delta.toFixed(1)) });
    }
  }

  const nationalCardRate = new Map(national.topCards.map((c) => [c.cardModelId, c.presenceRate]));
  for (const c of region.topCards) {
    const nationalRate = nationalCardRate.get(c.cardModelId) ?? 0;
    const delta = c.presenceRate - nationalRate;
    if (Math.abs(delta) >= ANOMALY_THRESHOLD_PP) {
      anomalies.push({ scopeLabel, kind: "card", label: c.name, regionRate: c.presenceRate, nationalRate, deltaPp: Number(delta.toFixed(1)) });
    }
  }

  return anomalies;
}

export async function getRegionalMetagame(prisma: PrismaClient, params: RegionalMetaParams): Promise<RegionalMetaResult> {
  const { seasonId, setId, stateUf, city, store } = params;

  const [reportEntries, hostedParticipants] = await Promise.all([
    prisma.tournamentEntry.findMany({
      where: { deckSnapshotId: { not: null }, tournament: { isActive: true, ...(seasonId ? { seasonId } : {}) } },
      select: { deckSnapshotId: true, wins: true, losses: true, draws: true, tournament: { select: { country: true, city: true, organizer: true } } },
    }),
    prisma.hostedEventParticipant.findMany({
      where: { deckSnapshotId: { not: null }, event: { status: HostedEventStatus.COMPLETED, isActive: true, ...(seasonId ? { seasonId } : {}) } },
      select: {
        deckSnapshotId: true,
        event: { select: { country: true, city: true, venueName: true } },
        matchesAsA: { select: { result: true } },
        matchesAsB: { select: { result: true } },
      },
    }),
  ]);

  const outcomeBySnapshot = new Map<string, Outcome>();
  const geoBySnapshot = new Map<string, SnapshotGeo>();

  for (const entry of reportEntries) {
    if (!entry.deckSnapshotId || geoBySnapshot.has(entry.deckSnapshotId)) continue;
    outcomeBySnapshot.set(entry.deckSnapshotId, { wins: entry.wins ?? 0, losses: entry.losses ?? 0, draws: entry.draws ?? 0 });
    const derived = deriveStateFromCity(entry.tournament.city, entry.tournament.country);
    geoBySnapshot.set(entry.deckSnapshotId, {
      snapshotId: entry.deckSnapshotId,
      country: (entry.tournament.country || "Brasil").trim() || "Brasil",
      uf: derived.uf,
      stateLabel: derived.stateLabel,
      city: derived.cityLabel,
      store: (entry.tournament.organizer || "").trim() || INDEPENDENT_STORE_LABEL,
    });
  }
  for (const participant of hostedParticipants) {
    if (!participant.deckSnapshotId || geoBySnapshot.has(participant.deckSnapshotId)) continue;
    let wins = 0, losses = 0, draws = 0;
    for (const m of participant.matchesAsA) {
      if (m.result === HostedEventMatchResult.PLAYER_A_WIN || m.result === HostedEventMatchResult.BYE) wins += 1;
      else if (m.result === HostedEventMatchResult.PLAYER_B_WIN) losses += 1;
      else if (m.result === HostedEventMatchResult.DRAW) draws += 1;
    }
    for (const m of participant.matchesAsB) {
      if (m.result === HostedEventMatchResult.PLAYER_B_WIN) wins += 1;
      else if (m.result === HostedEventMatchResult.PLAYER_A_WIN) losses += 1;
      else if (m.result === HostedEventMatchResult.DRAW) draws += 1;
    }
    outcomeBySnapshot.set(participant.deckSnapshotId, { wins, losses, draws });
    const derived = deriveStateFromCity(participant.event.city, participant.event.country);
    geoBySnapshot.set(participant.deckSnapshotId, {
      snapshotId: participant.deckSnapshotId,
      country: (participant.event.country || "Brasil").trim() || "Brasil",
      uf: derived.uf,
      stateLabel: derived.stateLabel,
      city: derived.cityLabel,
      store: (participant.event.venueName || "").trim() || INDEPENDENT_STORE_LABEL,
    });
  }

  const allSnapshotIds = Array.from(geoBySnapshot.keys());
  const emptyNational = emptyGroupStats("national", "Brasil (Nacional)");
  if (!allSnapshotIds.length) {
    return { totalDecks: 0, national: emptyNational, states: [], cities: [], stores: [], anomalies: [], alerts: [] };
  }

  const items: ItemRow[] = await prisma.deckSnapshotItem.findMany({
    where: { deckSnapshotId: { in: allSnapshotIds }, section: { notIn: NON_STATS_SECTIONS } },
    select: {
      deckSnapshotId: true,
      quantity: true,
      card: { select: { id: true, cardModelId: true, nameEn: true, namePt: true, color: true, setId: true, cardType: true } },
    },
  });

  const bySnapshotAll = new Map<string, ItemRow[]>();
  for (const item of items) {
    const list = bySnapshotAll.get(item.deckSnapshotId) || [];
    list.push(item);
    bySnapshotAll.set(item.deckSnapshotId, list);
  }

  // Recorte por coleção (setId): deck elegível = tem >=1 carta da coleção, mesmo
  // critério já usado em metagameTrendsService.
  const eligibleIds = setId
    ? allSnapshotIds.filter((id) => (bySnapshotAll.get(id) || []).some((item) => item.card?.setId === setId))
    : allSnapshotIds;

  if (!eligibleIds.length) {
    return { totalDecks: 0, national: emptyNational, states: [], cities: [], stores: [], anomalies: [], alerts: [] };
  }

  const national = aggregateGroup("national", "Brasil (Nacional)", eligibleIds, bySnapshotAll, outcomeBySnapshot);

  // Estado -> lista de snapshotIds (sempre nacional, é a base do seletor).
  const byState = new Map<string, { label: string; ids: string[] }>();
  for (const id of eligibleIds) {
    const geo = geoBySnapshot.get(id)!;
    const stateKey = geo.uf || UNKNOWN_LABEL;
    const bucket = byState.get(stateKey) || { label: geo.stateLabel, ids: [] };
    bucket.ids.push(id);
    byState.set(stateKey, bucket);
  }
  const states = Array.from(byState.entries())
    .map(([key, bucket]) => aggregateGroup(key, bucket.label, bucket.ids, bySnapshotAll, outcomeBySnapshot))
    .sort((a, b) => b.totalDecks - a.totalDecks);

  // Cidade -> escopo por Estado selecionado (se houver), senão cidades nacionais top N.
  const cityScopeIds = stateUf ? (byState.get(stateUf)?.ids ?? []) : eligibleIds;
  const byCity = new Map<string, { label: string; ids: string[] }>();
  for (const id of cityScopeIds) {
    const geo = geoBySnapshot.get(id)!;
    const cityKey = `${geo.uf || "??"}::${normalizeCityKey(geo.city)}`;
    const bucket = byCity.get(cityKey) || { label: geo.city, ids: [] };
    bucket.ids.push(id);
    byCity.set(cityKey, bucket);
  }
  const cities = Array.from(byCity.entries())
    .map(([key, bucket]) => aggregateGroup(key, bucket.label, bucket.ids, bySnapshotAll, outcomeBySnapshot))
    .sort((a, b) => b.totalDecks - a.totalDecks)
    .slice(0, TOP_GROUPS_LIMIT);

  // Loja Parceira -> escopo pela Cidade selecionada (se houver), senão lojas dentro do
  // Estado selecionado, senão lojas top N nacionais.
  const storeScopeIds = city
    ? (byCity.get(`${stateUf || "??"}::${normalizeCityKey(city)}`)?.ids ?? cityScopeIds.filter((id) => normalizeCityKey(geoBySnapshot.get(id)!.city) === normalizeCityKey(city)))
    : cityScopeIds;
  const byStore = new Map<string, { label: string; ids: string[] }>();
  for (const id of storeScopeIds) {
    const geo = geoBySnapshot.get(id)!;
    const storeKey = normalizeCityKey(geo.store);
    const bucket = byStore.get(storeKey) || { label: geo.store, ids: [] };
    bucket.ids.push(id);
    byStore.set(storeKey, bucket);
  }
  const stores = Array.from(byStore.entries())
    .map(([key, bucket]) => aggregateGroup(key, bucket.label, bucket.ids, bySnapshotAll, outcomeBySnapshot))
    .sort((a, b) => b.totalDecks - a.totalDecks)
    .slice(0, TOP_GROUPS_LIMIT);

  // Alertas Táticos: compara o escopo mais específico selecionado (loja > cidade >
  // estado) contra a média nacional -- essa é a leitura que interessa pro jogador.
  const selectedStore = store ? stores.find((s) => normalizeCityKey(s.label) === normalizeCityKey(store)) : undefined;
  const selectedCity = city ? cities.find((c) => normalizeCityKey(c.label) === normalizeCityKey(city)) : undefined;
  const selectedState = stateUf ? states.find((s) => s.key === stateUf) : undefined;
  const focusRegion = selectedStore || selectedCity || selectedState;
  const focusLabel = selectedStore?.label || selectedCity?.label || selectedState?.label || null;

  const anomalies = focusRegion && focusLabel ? detectAnomalies(focusLabel, focusRegion, national) : [];
  const alerts = focusLabel ? buildAlerts(focusLabel, anomalies) : [];

  return { totalDecks: eligibleIds.length, national, states, cities, stores, anomalies, alerts };
}
