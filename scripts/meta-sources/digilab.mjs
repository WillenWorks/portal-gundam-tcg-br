/**
 * Coleta bruta da API pública da DigiLab (https://digilab.cards/docs) para o Gundam Card Game:
 * regiões ("scenes"), lista de torneios e o detalhe de cada um (classificação, arquétipos, decklists).
 * Grava os JSONs como vieram em `--out` — a conversão para o formato do prisma/import-tournaments.mjs é escrita
 * depois de conferir a primeira coleta real (a documentação não traz o esquema dos campos).
 *
 * Requer a chave em DIGILAB_API_KEY (pedida no canal #api do Discord da DigiLab; uso não comercial).
 * Limite da API: 60 req/min por IP — o script faz ~50/min. Exibir os dados exige o crédito
 * "Data provided by DigiLab (digilab.cards)" com link.
 *
 *   DIGILAB_API_KEY=… node scripts/meta-sources/digilab.mjs --out=payload/digilab --since=2025-07-01
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://gundam.digilab.cards/api";
const DELAY_MS = 1_250;
const MAX_TOURNAMENTS = 2_000;

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
const key = process.env.DIGILAB_API_KEY;
const outDir = path.resolve(String(args.out ?? "payload/digilab"));
const since = String(args.since ?? "2025-07-01");

if (!key) {
  console.log("[digilab] DIGILAB_API_KEY ausente — coleta pulada");
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(pathname) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(DELAY_MS);
    const res = await fetch(`${BASE}${pathname}`, { headers: { "X-API-Key": key, Accept: "application/json" } });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") ?? 60) * 1000;
      console.log(`[digilab] 429, aguardando ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`${pathname}: HTTP ${res.status}`);
    return res.json();
  }
  throw new Error(`${pathname}: limite de tentativas`);
}

const listOf = (body) => (Array.isArray(body) ? body : body?.data ?? body?.tournaments ?? body?.scenes ?? body?.items ?? []);

fs.mkdirSync(path.join(outDir, "tournament"), { recursive: true });
const scenes = await get("/scenes");
fs.writeFileSync(path.join(outDir, "scenes.json"), JSON.stringify(scenes));

const all = [];
for (let page = 1; all.length < MAX_TOURNAMENTS; page++) {
  const body = await get(`/tournaments?start_date=${since}&page=${page}&limit=100`);
  const items = listOf(body);
  all.push(...items);
  const more = body?.pagination?.has_more ?? body?.has_more ?? body?.next ?? (items.length === 100);
  if (!items.length || !more) break;
}
fs.writeFileSync(path.join(outDir, "tournaments.json"), JSON.stringify(all));

let details = 0;
for (const t of all) {
  const id = t.id ?? t.tournament_id;
  if (id == null) continue;
  const file = path.join(outDir, "tournament", `${id}.json`);
  if (fs.existsSync(file)) continue;
  fs.writeFileSync(file, JSON.stringify(await get(`/tournament/${id}`)));
  details += 1;
}
console.log(`[digilab] ${listOf(scenes).length} regiões, ${all.length} torneios (${details} detalhes baixados) → ${outDir}`);
