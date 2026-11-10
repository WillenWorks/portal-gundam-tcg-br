/**
 * Baixa do site as listas de torneio de TODAS as fontes já importadas (Egman, DigiLab, reportes) no formato meta-raw,
 * o mesmo da coleta da Egman, para gerar os núcleos de arquétipo e os pools do bot com tudo o que temos.
 * Usa a rota /api/veda/export/lists, protegida pelo token DADOS_TOKEN (segredo do Actions e .env da VPS).
 *
 *   DADOS_TOKEN=… node scripts/meta-sources/site-export.mjs --site=https://anaheimhub.com --out=meta-raw-site.json
 *   node scripts/gundam-meta-cores.mjs --raw=meta-raw-site.json      # regenera fixtures/metaCores.ts (no runner)
 */
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
const site = String(args.site ?? "https://anaheimhub.com").replace(/\/$/, "");
const out = path.resolve(String(args.out ?? "meta-raw-site.json"));
const token = process.env.DADOS_TOKEN;
if (!token) {
  console.error("[site-export] DADOS_TOKEN ausente");
  process.exit(2);
}

const query = new URLSearchParams();
for (const k of ["format", "since", "source"]) if (args[k]) query.set(k, String(args[k]));
// O runner do Actions às vezes não conecta na VPS de primeira (timeout de 10 s do undici em 10/11/2026, com o site no ar).
// Falha de rede e 5xx tentam de novo com espera crescente; 4xx (token errado, rota) falha na hora.
const TENTATIVAS = 5;
let res;
for (let tentativa = 1; ; tentativa++) {
  try {
    res = await fetch(`${site}/api/veda/export/lists?${query}`, {
      headers: { "X-Dados-Token": token },
      signal: AbortSignal.timeout(120_000),
    });
    if (res.status < 500 || tentativa === TENTATIVAS) break;
    console.warn(`[site-export] HTTP ${res.status} (tentativa ${tentativa}/${TENTATIVAS})`);
  } catch (error) {
    if (tentativa === TENTATIVAS) throw error;
    console.warn(`[site-export] ${error.cause?.code ?? error.name}: ${error.cause?.message ?? error.message} (tentativa ${tentativa}/${TENTATIVAS})`);
  }
  await new Promise((r) => setTimeout(r, 15_000 * tentativa));
}
if (!res.ok) {
  console.error(`[site-export] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const body = await res.json();
const lists = (body.lists ?? []).filter((l) => l.main && Object.keys(l.main).length);
const bySource = {};
const byFormat = {};
for (const l of lists) {
  bySource[l.source] = (bySource[l.source] ?? 0) + 1;
  byFormat[l.format] = (byFormat[l.format] ?? 0) + 1;
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify({ date: body.date, source: `${site} (todas as fontes)`, formats: byFormat, lists })}\n`);
console.log(`[site-export] ${lists.length} listas · por fonte ${JSON.stringify(bySource)} · por temporada ${JSON.stringify(byFormat)} → ${out}`);
