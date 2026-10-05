/**
 * Leitura das linhas da tabela de torneios do deckbuilder da Egman Events
 * (`deckbuilder.egmanevents.com/gundam/tournaments?format=<F>&tab=all`), já renderizada
 * (spec bot-zero-system-meta-temporada). Só o parse — a coleta é do `gundam-meta-scrape.mjs`.
 */

/** colunas que a coleta precisa (cabeçalho da tabela, em maiúsculas) */
export const ROW_HEADERS = ["PLACE", "PLAYER", "DECK", "EVENT", "EVENT TYPE", "DATE"];

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

function parseCards(text) {
  const cards = {};
  for (const part of text.split(",")) {
    const m = /^([A-Z0-9]+-[0-9A-Z]+):(\d+)$/.exec(part.trim());
    if (!m) throw new Error(`lista malformada: "${part}"`);
    cards[m[1]] = (cards[m[1]] ?? 0) + Number(m[2]);
  }
  return cards;
}

/** `?deck=` → principal e side (depois do `|`, melhor de 3) */
export function parseDeckParam(param) {
  const [main, side] = param.split("|");
  return { main: parseCards(main), side: side ? parseCards(side) : null };
}

/** "Jul 31, 2026" → "2026-07-31" */
function isoDate(text) {
  const m = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(text.trim());
  if (!m || !MONTHS[m[1]]) return null;
  return `${m[3]}-${String(MONTHS[m[1]]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

const dash = (v) => (v == null || v === "" || v === "—" ? null : v);

/**
 * linha renderizada `{ headers, cells, href }` → lista normalizada, ou null se a linha não
 * tiver deck. Lança se o cabeçalho não tiver as colunas esperadas (o site mudou).
 */
export function parseDeckbuilderRow(row, format) {
  const headers = row.headers.map((h) => h.trim().toUpperCase());
  const idx = Object.fromEntries(ROW_HEADERS.map((h) => [h, headers.indexOf(h)]));
  const missing = ROW_HEADERS.filter((h) => idx[h] < 0);
  if (missing.length) throw new Error(`tabela de torneios sem as colunas ${missing.join(", ")} — o site mudou?`);
  const m = /[?&]deck=([^&]+)/.exec(row.href ?? "");
  if (!m) return null;
  const { main, side } = parseDeckParam(decodeURIComponent(m[1]));
  const cell = (h) => (row.cells[idx[h]] ?? "").trim();
  // GD05+: "SET\nCarta-chave\n(2ª carta)"; formatos antigos: só o nome livre do arquétipo
  const deckLines = cell("DECK").split("\n").map((s) => s.trim()).filter(Boolean);
  const leaderSet = /^[A-Z]{2}\d{2}$/.test(deckLines[0] ?? "") ? deckLines.shift() : null;
  const [label, second] = deckLines;
  const place = /\d+/.exec(cell("PLACE"));
  const recordIdx = headers.indexOf("RECORD");
  return {
    format,
    event: cell("EVENT"),
    eventType: dash(cell("EVENT TYPE")),
    date: isoDate(cell("DATE")),
    placing: place ? Number(place[0]) : null,
    record: recordIdx >= 0 ? dash((row.cells[recordIdx] ?? "").trim()) : null,
    leaderSet: leaderSet ?? null,
    label: label ?? null,
    secondLabel: second ? second.replace(/^\((.*)\)$/, "$1") : null,
    player: dash(cell("PLAYER")),
    main,
    side,
  };
}

/** lista em texto estável (ordem dos códigos), pra deduplicar */
export function canonicalList(cards) {
  return Object.keys(cards)
    .sort()
    .map((c) => `${c}:${cards[c]}`)
    .join(",");
}
