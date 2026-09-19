/*
 * Gera `data/ibge-municipios-uf.json` a partir da API oficial do IBGE (Instituto
 * Brasileiro de Geografia e Estatística) — lista completa dos ~5.570 municípios
 * brasileiros com sua UF (docs/debates 2026-09-18, Sprint 2 "seed geográfico IBGE").
 *
 * Substitui o antigo dicionário manual de ~90 cidades (capitais + praças competitivas
 * comuns) em server/services/regionalMetaService.ts, que ficava sem cobertura pra
 * qualquer cidade fora dessa lista curta. O dicionário manual continua existindo e
 * tem PRIORIDADE sobre este arquivo (ver `deriveStateFromCity`) -- é onde ficam os
 * casos que precisam de desambiguação explícita.
 *
 * Nomes de município que existem em 2+ UFs (ex. "Rio Branco" em AC e MT, "Bom Jesus"
 * em 6 estados diferentes) são EXCLUÍDOS deste arquivo de propósito -- nunca adivinha
 * (mesmo princípio de `deriveStateFromCity`: sem match seguro, cai em "Não informado").
 * Ambiguidades conhecidas e resolvíveis (como capitais) ficam no dicionário manual.
 *
 * Uso:
 *   node scripts/generate-ibge-city-uf.mjs              # busca da API do IBGE ao vivo
 *   node scripts/generate-ibge-city-uf.mjs --from=<path> # usa um JSON já baixado (offline/CI)
 *
 * Fonte: https://servicodados.ibge.gov.br/api/v1/localidades/municipios
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = path.join(REPO_ROOT, "data/ibge-municipios-uf.json");
const IBGE_API_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios";

function parseArgs(argv) {
  const out = { from: null };
  for (const a of argv) {
    if (a.startsWith("--from=")) out.from = a.slice(7);
  }
  return out;
}

function stripAccents(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalizeCityKey(text) {
  return stripAccents(text.trim().toLowerCase()).replace(/\s+/g, " ");
}

async function loadMunicipios(fromPath) {
  if (fromPath) {
    return JSON.parse(readFileSync(fromPath, "utf8"));
  }
  const res = await fetch(IBGE_API_URL);
  if (!res.ok) throw new Error(`IBGE API respondeu ${res.status} ${res.statusText}`);
  return res.json();
}

const args = parseArgs(process.argv.slice(2));
const municipios = await loadMunicipios(args.from);

const ufByName = new Map();
for (const m of municipios) {
  const uf = m.microrregiao?.mesorregiao?.UF?.sigla ?? m["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla;
  if (!uf) throw new Error(`Município sem UF resolvida: ${JSON.stringify(m)}`);
  const key = normalizeCityKey(m.nome);
  if (!ufByName.has(key)) ufByName.set(key, new Set());
  ufByName.get(key).add(uf);
}

const result = {};
let ambiguousCount = 0;
for (const [key, ufs] of ufByName) {
  if (ufs.size > 1) {
    ambiguousCount++;
    continue; // nome existe em 2+ UFs -- nunca adivinha, fica de fora
  }
  result[key] = [...ufs][0];
}

const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));

writeFileSync(
  OUT_FILE,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: IBGE_API_URL,
      totalMunicipios: municipios.length,
      unambiguousEntries: Object.keys(sorted).length,
      ambiguousExcluded: ambiguousCount,
      cityToUf: sorted,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

console.log(
  `[ibge-city-uf] ${municipios.length} municípios do IBGE -> ${Object.keys(sorted).length} entradas únicas (${ambiguousCount} ambíguas excluídas) -> ${path.relative(REPO_ROOT, OUT_FILE)}`,
);
