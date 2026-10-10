/**
 * Converte a coleta da Egman (saída de scripts/gundam-meta-scrape.mjs: { lists: [{ format, event, eventType, date,
 * placing, record, label, player, main }] }) no formato de eventos que o prisma/import-tournaments.mjs importa:
 *
 *   { source: "egman", events: [{ key, name, format, date, tier, sourceUrl, country, city, organizer,
 *       entries: [{ player, placement, wins, losses, draws, archetype, main }] }] }
 *
 * A Egman não informa país/cidade nem número de participantes: esses campos ficam nulos (a regionalidade vem
 * de fontes com loja/região, como a DigiLab).
 *
 *   node scripts/meta-sources/egman.mjs --in=docs/bot/meta-raw-2026-10-10.json --out=events-egman.json
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE = "https://deckbuilder.egmanevents.com/gundam/tournaments";

/** "Large Official Event" → LARGE_OFFICIAL …; null quando a linha não é um evento (ex.: "Total Color Breakdown") */
export function egmanTier(eventType) {
  const t = String(eventType ?? "").toLowerCase();
  if (t.includes("breakdown")) return null;
  if (t.includes("large")) return "LARGE_OFFICIAL";
  if (t.includes("unofficial") || !t) return "UNOFFICIAL";
  if (t.includes("official")) return "SMALL_OFFICIAL";
  return "UNOFFICIAL";
}

/** "3-1" → { wins: 3, losses: 1, draws: null }; "3-1-1" → draws 1 */
export function parseRecord(record) {
  const m = String(record ?? "").match(/^\s*(\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?\s*$/);
  if (!m) return { wins: null, losses: null, draws: null };
  return { wins: Number(m[1]), losses: Number(m[2]), draws: m[3] != null ? Number(m[3]) : null };
}

export function eventKey(list) {
  return `${list.format}|${String(list.event).trim()}|${list.date ?? ""}`;
}

export function egmanToEvents(raw) {
  const events = new Map();
  for (const l of raw.lists ?? []) {
    const tier = egmanTier(l.eventType);
    if (!tier || !l.event || !l.main || !Object.keys(l.main).length) continue;
    const key = eventKey(l);
    if (!events.has(key)) {
      events.set(key, {
        key: `egman:${key}`,
        name: String(l.event).trim(),
        format: l.format,
        date: l.date ?? null,
        tier,
        sourceUrl: `${SOURCE}#${encodeURIComponent(key)}`,
        organizer: null,
        country: null,
        city: null,
        participantCount: null,
        entries: [],
      });
    }
    events.get(key).entries.push({
      player: String(l.player ?? "").trim() || "—",
      placement: Number.isInteger(l.placing) ? l.placing : null,
      ...parseRecord(l.record),
      archetype: l.label ?? null,
      main: l.main,
    });
  }
  return { source: "egman", events: [...events.values()] };
}

function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
  const raw = JSON.parse(fs.readFileSync(path.resolve(String(args.in)), "utf8"));
  const out = egmanToEvents(raw);
  fs.writeFileSync(path.resolve(String(args.out ?? "events-egman.json")), `${JSON.stringify(out)}\n`);
  const lists = out.events.reduce((n, e) => n + e.entries.length, 0);
  console.log(`[egman] ${out.events.length} eventos, ${lists} listas`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
