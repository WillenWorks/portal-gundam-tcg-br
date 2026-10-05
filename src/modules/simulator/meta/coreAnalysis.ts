/**
 * Núcleo dos arquétipos de uma temporada a partir de listas de torneio (spec
 * bot-zero-system-meta-temporada, fase 1). Puro e determinístico: a coleta é do
 * `gundam-meta-scrape.mjs` e a fixture gerada é do `gundam-meta-cores.mjs`.
 *
 * Dois níveis:
 * - **variante**: listas agrupadas por sobreposição de cópias (`listOverlap ≥ VARIANT_OVERLAP`);
 * - **arquétipo**: variantes com as mesmas 2 cores e a mesma carta-chave (a Unit de maior nível do
 *   núcleo da variante). O rótulo dado pelo jogador muda de evento pra evento; as cartas não.
 */

/** lista normalizada da coleta (o `player` pode vir, mas nunca sai daqui) */
export interface RawMetaList {
  format: string;
  event: string;
  eventType?: string | null;
  date?: string | null;
  placing: number | null;
  label?: string | null;
  main: Record<string, number>;
}

export type CatalogLookup = (code: string) => { type: string; level: number; color: string } | undefined;

export type CardTier = "core" | "flex" | "tech";

export interface MetaCard {
  code: string;
  tier: CardTier;
  /** fração das listas do arquétipo que usam a carta */
  rate: number;
  /** quantidade mais comum entre as listas que usam */
  mode: number;
  /** média de cópias considerando todas as listas (0 onde não usa) */
  avg: number;
}

export interface MetaVariant {
  id: string;
  lists: number;
  /** média ponderada de `placementPoints` — quem mais vence */
  points: number;
  /** a lista real mais próxima do centro da variante */
  median: Record<string, number>;
  simulavel: boolean;
}

export interface MetaArchetype {
  id: string;
  name: string;
  colors: string[];
  keyCard: string;
  lists: number;
  /** presença no torneio, ponderada pelo peso do evento (soma 1 no formato) */
  share: number;
  /** fatia ponderada dos tops 8 do formato */
  top8Share: number;
  /** fatia ponderada dos 1º lugares do formato */
  winShare: number;
  points: number;
  simulavel: boolean;
  cartasFora: string[];
  cards: MetaCard[];
  variants: MetaVariant[];
  /** variante que mais vence entre as com ≥ MIN_LISTS listas (a do nível difícil) */
  bestVariantId: string;
  /** a lista real mais próxima do centro do arquétipo (a do nível normal) */
  median: Record<string, number>;
}

export interface MetaCoreFile {
  generatedAt: string;
  source: string;
  formats: Record<string, MetaFormatResult>;
}

export interface MetaFormatResult {
  lists: number;
  events: number;
  archetypes: MetaArchetype[];
}

export const VARIANT_OVERLAP = 0.55;
export const CORE_RATE = 0.8;
export const FLEX_RATE = 0.3;
/** cartas abaixo disso não entram na saída (ruído de 1 lista) */
export const MIN_CARD_RATE = 0.05;
export const MIN_LISTS = 3;
const DECK_SIZE = 50;

const round = (n: number) => Math.round(n * 1000) / 1000;
const sumValues = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

/** cópias em comum / 50 */
export function listOverlap(a: Record<string, number>, b: Record<string, number>): number {
  let common = 0;
  for (const [code, q] of Object.entries(a)) common += Math.min(q, b[code] ?? 0);
  return common / DECK_SIZE;
}

/**
 * Peso do evento: regional/grande = 3; torneio de loja japonês (Newtype Challenge, Shop Battle —
 * muitos, pequenos, quase sempre só o campeão listado) = 0,5; o resto = 1.
 */
export function eventWeight(l: Pick<RawMetaList, "event" | "eventType">): number {
  if (/newtype chall|shop battle/i.test(l.event)) return 0.5;
  if (/large/i.test(l.eventType ?? "") || /regional|finals|qualifier|first combat|expo|national|world/i.test(l.event)) return 3;
  return 1;
}

/** 1º = 4 · 2º = 3 · top 4 = 2 · top 8 = 1 · resto/desconhecida = 0,5 */
export function placementPoints(placing: number | null): number {
  if (placing === 1) return 4;
  if (placing === 2) return 3;
  if (placing !== null && placing <= 4) return 2;
  if (placing !== null && placing <= 8) return 1;
  return 0.5;
}

function canonical(m: Record<string, number>): string {
  return Object.keys(m)
    .sort()
    .map((c) => `${c}:${m[c]}`)
    .join(",");
}

interface Entry {
  list: RawMetaList;
  weight: number;
  points: number;
  key: string;
}

interface Cluster {
  entries: Entry[];
  sum: Record<string, number>;
  centroid: Record<string, number>;
}

function addToCluster(cl: Cluster, e: Entry) {
  cl.entries.push(e);
  for (const [c, q] of Object.entries(e.list.main)) cl.sum[c] = (cl.sum[c] ?? 0) + q;
  const n = cl.entries.length;
  cl.centroid = Object.fromEntries(Object.entries(cl.sum).map(([c, q]) => [c, q / n]));
}

/** lista real mais próxima do centro; empate → a de melhor colocação (ordem de entrada) */
function medianList(entries: Entry[], centroid: Record<string, number>): Record<string, number> {
  let best = entries[0];
  let score = -1;
  for (const e of entries) {
    const s = listOverlap(e.list.main, centroid);
    if (s > score + 1e-9) {
      best = e;
      score = s;
    }
  }
  return Object.fromEntries(Object.keys(best.list.main).sort().map((c) => [c, best.list.main[c]]));
}

function cardRows(entries: Entry[]): MetaCard[] {
  const n = entries.length;
  const copies = new Map<string, number[]>();
  for (const e of entries) for (const [c, q] of Object.entries(e.list.main)) copies.set(c, [...(copies.get(c) ?? []), q]);
  const rows: MetaCard[] = [];
  for (const [code, qs] of copies) {
    const rate = qs.length / n;
    if (rate < MIN_CARD_RATE) continue;
    const freq = new Map<number, number>();
    for (const q of qs) freq.set(q, (freq.get(q) ?? 0) + 1);
    // quantidade mais comum; empate → a maior
    const mode = [...freq].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
    rows.push({
      code,
      tier: rate >= CORE_RATE ? "core" : rate >= FLEX_RATE ? "flex" : "tech",
      rate: round(rate),
      mode,
      avg: round(qs.reduce((a, b) => a + b, 0) / n),
    });
  }
  return rows.sort((a, b) => b.rate - a.rate || b.avg - a.avg || a.code.localeCompare(b.code));
}

function topColors(centroid: Record<string, number>, catalog: CatalogLookup): string[] {
  const byColor = new Map<string, number>();
  for (const [code, q] of Object.entries(centroid)) {
    const def = catalog(code);
    if (def?.color) byColor.set(def.color, (byColor.get(def.color) ?? 0) + q);
  }
  return [...byColor]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([c]) => c)
    .sort();
}

/** Unit de maior nível do núcleo (empate: mais usada, depois código); sem Unit, a carta mais usada */
function keyCard(rows: MetaCard[], catalog: CatalogLookup): string {
  const core = rows.filter((r) => r.tier === "core");
  const units = core.filter((r) => catalog(r.code)?.type === "UNIT");
  const pool = units.length ? units : core.length ? core : rows;
  return [...pool].sort(
    (a, b) => (catalog(b.code)?.level ?? 0) - (catalog(a.code)?.level ?? 0) || b.rate - a.rate || a.code.localeCompare(b.code),
  )[0].code;
}

/** nomes repetidos no formato (ex.: 2 "Char's Zaku Ⅱ" de cores diferentes) ganham as cores; se ainda repetir, a carta-chave */
function disambiguateNames(archetypes: MetaArchetype[]) {
  const count = (key: (a: MetaArchetype) => string) => {
    const m = new Map<string, number>();
    for (const a of archetypes) m.set(key(a), (m.get(key(a)) ?? 0) + 1);
    return m;
  };
  const byName = count((a) => a.name);
  for (const a of archetypes) if ((byName.get(a.name) ?? 0) > 1) a.name = `${a.name} (${a.colors.join("/")})`;
  const again = count((a) => a.name);
  for (const a of archetypes) if ((again.get(a.name) ?? 0) > 1) a.name = `${a.name} [${a.keyCard}]`;
}

const weightOf = (es: Entry[]) => es.reduce((s, e) => s + e.weight, 0);
const avgPoints = (es: Entry[]) => es.reduce((s, e) => s + e.points * e.weight, 0) / weightOf(es);

/** analisa as listas de UM formato */
export function analyzeFormat(lists: RawMetaList[], catalog: CatalogLookup): MetaFormatResult {
  const entries: Entry[] = lists
    .filter((l) => sumValues(l.main) === DECK_SIZE)
    .map((list) => ({ list, weight: eventWeight(list), points: placementPoints(list.placing), key: canonical(list.main) }))
    // ordem estável: melhor colocação e evento maior primeiro — elas fundam os grupos
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.weight - a.weight ||
        (b.list.date ?? "").localeCompare(a.list.date ?? "") ||
        a.list.event.localeCompare(b.list.event) ||
        a.key.localeCompare(b.key),
    );

  const clusters: Cluster[] = [];
  for (const e of entries) {
    let best: Cluster | null = null;
    let score = 0;
    for (const cl of clusters) {
      const s = listOverlap(e.list.main, cl.centroid);
      if (s > score + 1e-9) {
        best = cl;
        score = s;
      }
    }
    if (best && score >= VARIANT_OVERLAP) addToCluster(best, e);
    else {
      const cl: Cluster = { entries: [], sum: {}, centroid: {} };
      addToCluster(cl, e);
      clusters.push(cl);
    }
  }

  // arquétipo = cores + carta-chave da variante
  const groups = new Map<string, { colors: string[]; key: string; clusters: Cluster[] }>();
  for (const cl of clusters) {
    const colors = topColors(cl.centroid, catalog);
    const key = keyCard(cardRows(cl.entries), catalog);
    const id = `${lists[0]?.format ?? "?"}-${colors.join("-")}-${key}`;
    const g = groups.get(id) ?? { colors, key, clusters: [] };
    g.clusters.push(cl);
    groups.set(id, g);
  }

  const totalW = weightOf(entries);
  const top8W = weightOf(entries.filter((e) => e.list.placing !== null && e.list.placing <= 8));
  const winW = weightOf(entries.filter((e) => e.list.placing === 1));
  const inCatalog = (m: Record<string, number>) => Object.keys(m).every((c) => catalog(c));

  const archetypes: MetaArchetype[] = [];
  for (const [id, g] of groups) {
    const es = g.clusters.flatMap((c) => c.entries);
    if (es.length < MIN_LISTS) continue;
    const sum: Record<string, number> = {};
    for (const e of es) for (const [c, q] of Object.entries(e.list.main)) sum[c] = (sum[c] ?? 0) + q;
    const centroid = Object.fromEntries(Object.entries(sum).map(([c, q]) => [c, q / es.length]));
    const cards = cardRows(es);
    const bySize = [...g.clusters].sort((a, b) => b.entries.length - a.entries.length || avgPoints(b.entries) - avgPoints(a.entries));
    // variantes com ≥ MIN_LISTS; se nenhuma chega lá (arquétipo espalhado), a maior vale como única
    const variants = (bySize.some((c) => c.entries.length >= MIN_LISTS) ? bySize.filter((c) => c.entries.length >= MIN_LISTS) : bySize.slice(0, 1))
      .map((c, i) => {
        const median = medianList(c.entries, c.centroid);
        return { id: `${id}-v${i + 1}`, lists: c.entries.length, points: round(avgPoints(c.entries)), median, simulavel: inCatalog(median) };
      });
    const archMedian = medianList(es, centroid);
    const labels = new Map<string, number>();
    for (const e of es) if (e.list.label) labels.set(e.list.label, (labels.get(e.list.label) ?? 0) + 1);
    const name = [...labels].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? g.key;
    const cartasFora = [...new Set(es.flatMap((e) => Object.keys(e.list.main)))].filter((c) => !catalog(c)).sort();
    const best = [...variants].sort((a, b) => b.points - a.points || b.lists - a.lists)[0];
    archetypes.push({
      id,
      name,
      colors: g.colors,
      keyCard: g.key,
      lists: es.length,
      share: round(weightOf(es) / totalW),
      top8Share: top8W ? round(weightOf(es.filter((e) => e.list.placing !== null && e.list.placing <= 8)) / top8W) : 0,
      winShare: winW ? round(weightOf(es.filter((e) => e.list.placing === 1)) / winW) : 0,
      points: round(avgPoints(es)),
      // núcleo e ajuste precisam estar no catálogo; tech pode ser trocada pelo montador
      simulavel: cards.filter((c) => c.tier !== "tech").every((c) => catalog(c.code)),
      cartasFora,
      cards,
      variants,
      bestVariantId: best.id,
      median: archMedian,
    });
  }
  archetypes.sort((a, b) => b.share - a.share || b.lists - a.lists || a.id.localeCompare(b.id));
  disambiguateNames(archetypes);
  return { lists: entries.length, events: new Set(entries.map((e) => `${e.list.event}|${e.list.date}`)).size, archetypes };
}
