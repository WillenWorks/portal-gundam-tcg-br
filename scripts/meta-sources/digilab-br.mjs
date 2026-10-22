/**
 * Coleta dos torneios do Brasil publicados na DigiLab (gundam.digilab.cards), enquanto a chave da API não
 * chega. Lê só páginas públicas, respeitando o robots.txt deles (sem /api/, 5 s entre requisições):
 *   1. sitemap → lojas; 2. página de cada loja (endereço em JSON-LD) → só as do Brasil e seus torneios;
 *   3. página de cada torneio (JSON-LD + tabela de classificação); 4. decklists informadas.
 * Grava no formato de eventos do prisma/import-tournaments.mjs. Os dados exibidos levam o crédito
 * "Dados: DigiLab (digilab.cards)" pelo link de origem de cada torneio.
 *
 * Incremental: com --known=<site> pula os torneios já importados há mais de 21 dias, e com --stores-cache=<arquivo>
 * não relê lojas que já se sabe serem de fora do Brasil.
 *
 *   node scripts/meta-sources/digilab-br.mjs --out=payload/events-digilab-br.json [--cache=.cache/digilab]
 *     [--known=https://anaheimhub.com] [--stores-cache=.cache/digilab-lojas.json]
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BASE = "https://gundam.digilab.cards";
const CRAWL_DELAY_MS = 5_000;
const REFRESH_DAYS = 21;
const USER_AGENT = "AnaheimHub/1.0 (+https://anaheimhub.com; copia unica de torneios do Brasil)";

const decode = (s) =>
  String(s ?? "")
    .replace(/&#39;|&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

export function jsonLd(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
    try {
      return [JSON.parse(m[1])];
    } catch {
      return [];
    }
  });
}

export function sitemapStores(xml) {
  return [...new Set([...xml.matchAll(/<loc>https:\/\/gundam\.digilab\.cards\/store\/([^<]+)<\/loc>/g)].map((m) => m[1]))];
}

export function parseStore(html) {
  const biz = jsonLd(html).find((j) => j["@type"] === "LocalBusiness");
  const a = biz?.address ?? {};
  return {
    name: biz?.name ?? null,
    country: a.addressCountry ?? null,
    city: a.addressLocality ?? null,
    region: a.addressRegion ?? null,
    tournamentIds: [...new Set([...html.matchAll(/href="\/tournament\/(\d+)"/g)].map((m) => Number(m[1])))],
  };
}

const TIERS = [
  [/^(regionals?|area finals|nationals|worlds)\b/i, "LARGE_OFFICIAL"],
  [/^(online|casuals?)\b/i, "UNOFFICIAL"],
];
export function digilabTier(eventType) {
  for (const [re, tier] of TIERS) if (re.test(eventType ?? "")) return tier;
  return "SMALL_OFFICIAL"; // locals, store championship, newtype challenge, release event
}

export const placementNumber = (text) => {
  const m = String(text ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
};

export function parseTournament(html, id) {
  const ev = jsonLd(html).find((j) => j["@type"] === "SportsEvent") ?? {};
  const format = (String(ev.description ?? "").match(/\b(GD\d{2}|EB\d{2}|ST\d{2})\b/) ?? [])[1] ?? null;
  const [eventType, venue] = String(ev.name ?? "").split(" @ ");
  const addr = String(ev.location?.address ?? "").split(",").map((s) => s.trim());
  const body = (html.match(/Tournament standings<\/caption>[\s\S]*?<tbody[^>]*>([\s\S]*?)<\/tbody>/) ?? [])[1] ?? "";
  const entries = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) => {
    const record = (row.match(/class="mono-cell"[^>]*>\s*([\d-]+)\s*</) ?? [])[1] ?? null;
    const [wins, losses, draws] = record ? record.split("-").map(Number) : [];
    return {
      player: decode((row.match(/class="player-chip-name"[^>]*title="([^"]*)"/) ?? [])[1] ?? "—"),
      placement: placementNumber((row.match(/class="placement-(?:badge|num)[^"]*"[^>]*>([^<]*)</) ?? [])[1]),
      wins: Number.isFinite(wins) ? wins : null,
      losses: Number.isFinite(losses) ? losses : null,
      draws: Number.isFinite(draws) ? draws : null,
      archetype: decode((row.match(/class="deck-link"[^>]*>[\s\S]*?<\/span>\s*<\/span>([^<]*)<\/a>/) ?? [])[1] ?? "") || null,
      decklistId: Number((row.match(/href="\/decklist\/(\d+)"/) ?? [])[1]) || null,
    };
  });
  return {
    key: `digilab:${id}`,
    name: ev.name ? `${ev.name}${ev.startDate ? ` — ${ev.startDate}` : ""}` : `DigiLab #${id}`,
    format,
    date: ev.startDate ?? null,
    tier: digilabTier(eventType),
    sourceUrl: `${BASE}/tournament/${id}`,
    organizer: ev.location?.name ?? venue ?? null,
    country: addr.at(-1) === "Brazil" ? "Brasil" : addr.at(-1) || null,
    city: addr[0] || null,
    participantCount: Number(ev.numberOfAthletes) || null,
    entries,
  };
}

/** "…?decklist=ST13-006:3,GD01-044:4," → { "ST13-006": 3, "GD01-044": 4 } */
export function parseDecklist(html) {
  const raw = (html.match(/[?&]decklist=([A-Z0-9:,-]+)/) ?? [])[1] ?? "";
  const main = {};
  for (const part of raw.split(",")) {
    const [code, qty] = part.split(":");
    if (code && Number(qty) > 0) main[code] = (main[code] ?? 0) + Number(qty);
  }
  return main;
}

/** Torneios a (re)ler: os novos e os já importados há menos de `refreshDays` (decklists chegam depois do evento). */
export function planTournamentFetch(ids, known, today, refreshDays = REFRESH_DAYS) {
  const cutoff = new Date(Date.parse(today) - refreshDays * 86_400_000).toISOString().slice(0, 10);
  return ids.filter((id) => {
    const date = known.get(id);
    return date === undefined || date === null || date.slice(0, 10) >= cutoff;
  });
}

/** Torneios da DigiLab que o site já tem (id → data), pela rota pública /api/veda/tournaments */
async function knownTournaments(siteUrl) {
  const known = new Map();
  if (!siteUrl) return known;
  for (let offset = 0; offset < 20_000; offset += 100) {
    const res = await fetch(`${siteUrl}/api/veda/tournaments?source=digilab&limit=100&offset=${offset}`).catch(() => null);
    if (!res?.ok) {
      if (offset === 0) console.log(`[digilab-br] não consegui ler os torneios já importados (${res?.status ?? "sem resposta"}) — coleta completa`);
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
  const out = path.resolve(String(args.out ?? "payload/events-digilab-br.json"));
  const cacheDir = path.resolve(String(args.cache ?? ".cache/digilab"));
  // país de cada loja, guardado entre execuções (cache do Actions): loja de fora do Brasil não é relida
  const storesFile = args["stores-cache"] ? path.resolve(String(args["stores-cache"])) : null;
  const storeCountry = storesFile && fs.existsSync(storesFile) ? JSON.parse(fs.readFileSync(storesFile, "utf8")) : {};
  const known = await knownTournaments(args.known === "true" ? null : args.known);
  fs.mkdirSync(cacheDir, { recursive: true });
  let requests = 0;
  const get = async (pathname) => {
    const file = path.join(cacheDir, `${pathname.replace(/[^a-z0-9]+/gi, "_")}.html`);
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
    if (requests > 0) await new Promise((r) => setTimeout(r, CRAWL_DELAY_MS));
    requests += 1;
    const res = await fetch(`${BASE}${pathname}`, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`${pathname}: HTTP ${res.status}`);
    const text = await res.text();
    fs.writeFileSync(file, text);
    return text;
  };

  const stores = sitemapStores(await get("/sitemap-entities.xml"));
  const toRead = stores.filter((slug) => !storeCountry[slug] || storeCountry[slug] === "Brazil");
  console.log(`[digilab-br] ${stores.length} lojas no sitemap · ${toRead.length} a ler (${stores.length - toRead.length} já sabidas de fora do Brasil) · ${known.size} torneios já no site`);
  const tournamentIds = new Set();
  const brStores = [];
  for (const slug of toRead) {
    const store = parseStore(await get(`/store/${slug}`));
    storeCountry[slug] = store.country ?? "?";
    if (store.country !== "Brazil") continue;
    brStores.push(`${store.name} (${store.city})`);
    for (const id of store.tournamentIds) tournamentIds.add(id);
  }
  if (storesFile) {
    fs.mkdirSync(path.dirname(storesFile), { recursive: true });
    fs.writeFileSync(storesFile, JSON.stringify(storeCountry));
  }
  const ids = planTournamentFetch([...tournamentIds].sort((a, b) => a - b), known, new Date().toISOString());
  console.log(`[digilab-br] ${brStores.length} lojas no Brasil: ${brStores.join("; ")}`);
  console.log(`[digilab-br] ${tournamentIds.size} torneios nas lojas · ${ids.length} novos ou recentes a ler`);

  const events = [];
  for (const id of ids) {
    const ev = parseTournament(await get(`/tournament/${id}`), id);
    if (ev.country !== "Brasil") continue;
    for (const e of ev.entries) {
      e.main = e.decklistId ? parseDecklist(await get(`/decklist/${e.decklistId}`)) : null;
      delete e.decklistId;
    }
    events.push(ev);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify({ source: "digilab-br", events })}\n`);
  const lists = events.reduce((n, e) => n + e.entries.filter((x) => x.main && Object.keys(x.main).length).length, 0);
  console.log(`[digilab-br] ${events.length} torneios, ${events.reduce((n, e) => n + e.entries.length, 0)} inscrições, ${lists} com decklist (${requests} requisições) → ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
