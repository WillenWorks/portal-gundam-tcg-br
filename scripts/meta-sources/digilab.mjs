/**
 * Coleta dos torneios de Gundam Card Game da DigiLab pela API oficial (https://digilab.cards/docs), no mundo todo:
 * lista de torneios → classificação de cada um → decklists. Grava no formato de eventos do
 * prisma/import-tournaments.mjs (o mesmo da Egman); o Veda separa meta local (Brasil) e global pelo país.
 *
 * Chave em DIGILAB_API_KEY (segredo do Actions; nunca no front nem no git). Limites da API: 60 req/min por IP e
 * 300/min por chave — o script faz ≤ 55/min, respeita Retry-After e repete em erro de rede/5xx.
 * Os dados exibidos levam o crédito "Data provided by DigiLab (digilab.cards)" com link (VedaSourceCredit).
 *
 * Incremental e retomável:
 *   - --cache=<dir> guarda as respostas (decklist já lida não é relida; o Actions persiste a pasta entre execuções);
 *   - --known=<site> pula torneios que o site já tem há mais de 21 dias (decklists chegam dias depois do evento);
 *   - --max-minutes=<n> encerra a coleta no prazo: o que não deu tempo fica para a próxima execução (a carga
 *     inicial, ~1.100 torneios e ~5.700 listas, termina em 2–3 execuções diárias).
 *
 *   DIGILAB_API_KEY=… node scripts/meta-sources/digilab.mjs --out=payload/events-digilab.json \
 *     [--cache=.cache/digilab-api] [--known=https://anaheimhub.com] [--since=2025-07-25] [--max-minutes=100]
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SEASONS, seasonForDate } from "../../src/lib/seasons.ts";
import { digilabTier } from "./digilab-br.mjs";

export const API = "https://gundam.digilab.cards/api";
export const SITE = "https://gundam.digilab.cards";
const MIN_INTERVAL_MS = 1_100;
const PER_PAGE = 100;
const REFRESH_DAYS = 21;
const MAX_ATTEMPTS = 5;
const DAY_MS = 86_400_000;

/** Formatos que não são torneio de construído de temporada (Edition Beta, pré-lançamento do GD01) */
const SKIP_FORMATS = new Set(["GD01_b"]);

/** Temporada do Veda: o próprio formato se for uma temporada (GD01, GD02…); senão (EB01…) a temporada vigente na data */
export function seasonFor(format, date) {
  if (SEASONS.some((s) => s.code === format)) return format;
  return seasonForDate(date);
}

/** "store_championship" → "Store Championship" */
export const eventTypeLabel = (t) =>
  String(t ?? "event")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

/** "GD01-086", "GD01-086_p1" → "GD01-086" (a impressão alternativa conta como a carta) */
export const baseCode = (id) => String(id ?? "").trim().toUpperCase().split("_")[0];

/**
 * Decklist da API → { código: cópias }. A API é a mesma do Digimon: as cartas de Gundam vêm em `groups`
 * (unit/pilot/command/base) e, repetidas, nos baldes eggs/digimon/tamers/options — lê um ou outro, nunca os dois.
 */
export function flattenDecklist(decklist) {
  if (!decklist) return null;
  const cards =
    Array.isArray(decklist.groups) && decklist.groups.length
      ? decklist.groups.flatMap((g) => g.cards ?? [])
      : ["eggs", "digimon", "tamers", "options"].flatMap((k) => decklist[k] ?? []);
  const main = {};
  for (const c of cards) {
    const code = baseCode(c.card_id);
    const qty = Number(c.count);
    if (code && qty > 0) main[code] = (main[code] ?? 0) + qty;
  }
  return Object.keys(main).length ? main : null;
}

/** chave para casar a linha da classificação com a decklist publicada (jogador anônimo: pela colocação) */
export const entryKey = (tournamentId, playerSlug, placement) => `${tournamentId}|${playerSlug ?? `#${placement ?? "?"}`}`;

/** Detalhe da API (/tournament/{id}) + decklists já baixadas → evento do importador; null se não for de temporada */
export function toEvent(detail, decklists = new Map()) {
  const t = detail?.tournament;
  if (!t?.id || SKIP_FORMATS.has(t.format)) return null;
  const season = seasonFor(t.format, t.date);
  if (!season) return null;
  const place = t.venue?.name ?? t.store?.name ?? null;
  const label = t.event_name || eventTypeLabel(t.event_type);
  const country = t.store?.country ?? t.scene?.country ?? null;
  const row = (s) => ({
    player: s.player?.name ?? "Anonymous",
    placement: s.placement ?? null,
    wins: s.record?.wins ?? null,
    losses: s.record?.losses ?? null,
    draws: s.record?.ties ?? null,
    archetype: s.deck?.name ?? null,
    main: decklists.get(entryKey(t.id, s.player?.slug, s.placement)) ?? null,
  });
  return {
    key: `digilab:${t.id}`,
    name: `${label}${place ? ` @ ${place}` : ""}${t.format !== season ? ` [${t.format}]` : ""} — ${t.date}`,
    format: season,
    date: t.date ?? null,
    tier: digilabTier(eventTypeLabel(t.event_type)),
    sourceUrl: `${SITE}/tournament/${t.id}`,
    organizer: t.store?.name ?? null,
    country: country === "Brazil" ? "Brasil" : country,
    city: t.store?.city ?? null,
    participantCount: Number(t.player_count) || null,
    entries: [...(detail.standings ?? []).map(row), ...(detail.dnfs ?? []).map((s) => ({ ...row(s), placement: null }))],
  };
}

/** Torneios a (re)montar: os que o site não tem e os recentes (decklists chegam depois do evento) */
export function planTournaments(list, known, today, refreshDays = REFRESH_DAYS) {
  const cutoff = new Date(Date.parse(today) - refreshDays * DAY_MS).toISOString().slice(0, 10);
  return list.filter((t) => {
    if (SKIP_FORMATS.has(t.format)) return false;
    const date = known.get(Number(t.tournament_id));
    return date == null || date.slice(0, 10) >= cutoff || String(t.event_date) >= cutoff;
  });
}

/** Resposta guardada vale se o evento já assentou (> 21 dias) ou se foi lida há menos de um dia */
export function cacheFresh(entry, eventDate, now, refreshDays = REFRESH_DAYS) {
  if (!entry) return false;
  const settled = Boolean(eventDate) && Date.parse(`${eventDate}T00:00:00Z`) < now - refreshDays * DAY_MS;
  return settled || now - Date.parse(entry.fetchedAt) < DAY_MS;
}

export class DigilabClient {
  constructor({ key, cacheDir, deadline = Infinity, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
    Object.assign(this, { key, cacheDir, deadline, fetchImpl, sleep });
    this.requests = 0;
    this.last = 0;
  }

  get outOfTime() {
    return Date.now() > this.deadline;
  }

  async get(pathname) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const wait = this.last + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await this.sleep(wait);
      this.last = Date.now();
      this.requests += 1;
      let res;
      try {
        res = await this.fetchImpl(`${API}${pathname}`, {
          headers: { "X-API-Key": this.key, Accept: "application/json", "User-Agent": "AnaheimHub/1.0 (+https://anaheimhub.com)" },
        });
      } catch (error) {
        if (attempt === MAX_ATTEMPTS) throw error;
        console.log(`[digilab] ${pathname}: ${error.cause?.code ?? error.message} — tentando de novo`);
        await this.sleep(2 ** attempt * 1_000);
        continue;
      }
      if (res.status === 404) return null;
      if (res.status === 401 || res.status === 403) throw new Error(`[digilab] chave recusada (HTTP ${res.status}) — conferir o segredo DIGILAB_API_KEY`);
      if (res.status === 429 || res.status >= 500) {
        const retry = Number(res.headers.get("retry-after"));
        const ms = res.status === 429 && retry > 0 ? retry * 1_000 : 2 ** attempt * 1_000;
        console.log(`[digilab] ${pathname}: HTTP ${res.status}, aguardando ${Math.round(ms / 1000)}s`);
        await this.sleep(ms);
        continue;
      }
      if (!res.ok) throw new Error(`[digilab] ${pathname}: HTTP ${res.status}`);
      return res.json();
    }
    throw new Error(`[digilab] ${pathname}: limite de tentativas`);
  }

  cached(name) {
    const file = path.join(this.cacheDir, `${name}.json`);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  }

  store(name, body) {
    const entry = { fetchedAt: new Date().toISOString(), body };
    fs.writeFileSync(path.join(this.cacheDir, `${name}.json`), JSON.stringify(entry));
    return entry;
  }

  /** todas as páginas de um endpoint paginado (pagination.total_pages) */
  async pages(pathname, params) {
    const items = [];
    for (let page = 1; ; page++) {
      const q = new URLSearchParams({ ...params, page: String(page), per_page: String(PER_PAGE) });
      const body = await this.get(`${pathname}?${q}`);
      items.push(...(body?.data ?? []));
      if (!body?.data?.length || page >= (body.pagination?.total_pages ?? page)) break;
    }
    return items;
  }
}

/** Torneios da DigiLab que o site já tem (id → data), pela rota pública /api/veda/tournaments */
async function knownTournaments(siteUrl) {
  const known = new Map();
  if (!siteUrl) return known;
  for (let offset = 0; offset < 50_000; offset += 100) {
    const res = await fetch(`${siteUrl}/api/veda/tournaments?source=digilab&limit=100&offset=${offset}`).catch(() => null);
    if (!res?.ok) {
      if (offset === 0) console.log(`[digilab] não consegui ler os torneios já importados (${res?.status ?? "sem resposta"}) — coleta completa`);
      break;
    }
    const page = await res.json();
    for (const t of page.items ?? []) {
      const id = Number(String(t.sourceUrl ?? "").match(/\/tournament\/(\d+)/)?.[1]);
      if (id) known.set(id, t.date ?? null);
    }
    if (!page.hasMore) break;
  }
  return known;
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
  const key = process.env.DIGILAB_API_KEY;
  if (!key) {
    console.log("[digilab] DIGILAB_API_KEY ausente — coleta pulada");
    return;
  }
  const out = path.resolve(String(args.out ?? "payload/events-digilab.json"));
  const cacheDir = path.resolve(String(args.cache ?? ".cache/digilab-api"));
  const since = String(args.since ?? SEASONS[0].startDate);
  const maxMinutes = Number(args["max-minutes"] ?? 100);
  fs.mkdirSync(cacheDir, { recursive: true });
  const api = new DigilabClient({ key, cacheDir, deadline: Date.now() + maxMinutes * 60_000 });
  const now = Date.now();
  const write = (events) => {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify({ source: "digilab", events })}\n`);
  };

  const known = await knownTournaments(args.known === "true" ? null : args.known);
  const list = await api.pages("/tournaments", { date_from: since, sort: "date", sort_dir: "desc" });
  const todo = planTournaments(list, known, new Date(now).toISOString());
  console.log(`[digilab] ${list.length} torneios desde ${since} · ${known.size} já no site · ${todo.length} novos ou recentes`);
  if (!todo.length) return write([]);

  // decklists publicadas desde o torneio mais antigo a montar: uma listagem, depois o detalhe de cada uma
  const oldest = todo.reduce((d, t) => (t.event_date < d ? t.event_date : d), todo[0].event_date);
  const todoIds = new Set(todo.map((t) => Number(t.tournament_id)));
  const listed = (await api.pages("/decklists", { date_from: oldest, sort: "date", sort_dir: "desc" })).filter((d) => todoIds.has(Number(d.tournament_id)));
  const decklists = new Map();
  const incomplete = new Set(); // torneios com lista que não deu tempo de baixar: ficam inteiros para a próxima
  for (const d of listed) {
    const name = `decklist-${d.result_id}`;
    let entry = api.cached(name);
    if (!entry?.body?.decklist && !cacheFresh(entry, d.event_date, now)) {
      if (api.outOfTime) {
        incomplete.add(Number(d.tournament_id));
        continue;
      }
      entry = api.store(name, await api.get(`/decklist/${d.result_id}`));
    }
    const main = flattenDecklist(entry?.body?.decklist);
    if (main) decklists.set(entryKey(d.tournament_id, d.player_slug, d.placement), main);
  }

  const events = [];
  let deferred = 0;
  for (const t of todo) {
    const id = Number(t.tournament_id);
    const name = `tournament-${id}`;
    let entry = api.cached(name);
    if (!incomplete.has(id) && !cacheFresh(entry, t.event_date, now) && !api.outOfTime) entry = api.store(name, await api.get(`/tournament/${id}`));
    if (incomplete.has(id) || !cacheFresh(entry, t.event_date, now)) {
      deferred += 1;
      continue;
    }
    const ev = toEvent(entry.body, decklists);
    if (ev) events.push(ev);
  }

  write(events);
  const entries = events.reduce((n, e) => n + e.entries.length, 0);
  const lists = events.reduce((n, e) => n + e.entries.filter((x) => x.main).length, 0);
  const br = events.filter((e) => e.country === "Brasil").length;
  console.log(
    `[digilab] ${events.length} torneios (${br} no Brasil), ${entries} inscrições, ${lists} com decklist · ${api.requests} requisições` +
      (deferred ? ` · ${deferred} torneios ficam para a próxima execução (prazo de ${maxMinutes} min)` : "") +
      ` → ${out}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
