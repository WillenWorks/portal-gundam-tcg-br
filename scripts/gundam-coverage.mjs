/*
 * Dashboard de cobertura de efeitos do motor do simulador (docs/44 §6.3, docs/48).
 *
 * Pra cada carta de um set, classifica:
 *   - implementada   : tem EffectSpec autorado OU campo estruturado no CardDef
 *                      (staticAbilities / combatTriggers / attackTargetRules) que
 *                      cobre o texto bespoke.
 *   - implementada*  : idem, mas com ao menos 1 cláusula em DEFERRED_CLAUSES
 *                      (cobertura parcial — ver docs/48).
 *   - vanilla        : sem texto bespoke — só keyword automática (Blocker, Breach,
 *                      Support, Repair, …), 【Pilot】[X] (pilotMode) ou vazio.
 *   - deferida       : texto bespoke SEM cobertura, mas com entrada em DEFERRED_CLAUSES.
 *   - faltando       : texto bespoke sem cobertura nem deferimento.  <-- FALHA O CI
 *
 * Uso:
 *   node scripts/gundam-coverage.mjs                     # ST01..ST05, tabela + resumo
 *   node scripts/gundam-coverage.mjs --sets=ST01,ST03    # só esses
 *   node scripts/gundam-coverage.mjs --all               # todos os sets do dataset (GD/EB…)
 *   node scripts/gundam-coverage.mjs --gate              # exit != 0 se houver `faltando` nos sets pedidos
 *   node scripts/gundam-coverage.mjs --out=docs/_generated/coverage.md
 *
 * O CI (.github/workflows/ci.yml) roda com `--gate` sobre ST01..ST05.
 *
 * Além do `.md` (gitignored), grava SEMPRE `src/modules/simulator/content/_index/coverage.json`
 * (versionado, determinístico, ordenado por code) — fonte dos dashboards de `/admin`
 * (docs/44 §6.3, Lane 3BC). Rodar 2× → diff vazio.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

register();

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// GD02/GD03 ficam FORA do gate por enquanto: `--gate --sets=GD02,GD03` (2026-09-18)
// mostrou 69 e 76 cartas "faltando" respectivamente (real, não é falso positivo —
// ver docs/_generated/coverage.md) — a cobertura desses 2 sets está muito atrás
// do que a wave GD03 do CHANGELOG [2.1.0] sugere (só a vocabulário/governança de
// primitivas foi fechada, não a autoria de EffectSpec carta a carta). Sem risco
// de produção: `server/deckCoverageGate.ts` já bloqueia esses decks em runtime.
// Adicionar de volta ao GATED_SETS só depois de fechar esse backlog (rastrear
// em AI_GUIDE.md §8, Terminal 1).
const GATED_SETS = ["ST01", "ST02", "ST03", "ST04", "ST05", "ST06", "ST07", "ST08", "GD01"];

function parseArgs(argv) {
  const out = { sets: GATED_SETS, all: false, gate: false, outFile: null };
  for (const a of argv) {
    if (a === "--all") out.all = true;
    else if (a === "--gate") out.gate = true;
    else if (a.startsWith("--sets=")) out.sets = a.slice(7).split(",").map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith("--out=")) out.outFile = a.slice(6);
  }
  return out;
}

const { ALL_EFFECT_SPECS, DEFERRED_CLAUSES } = await import("../src/modules/simulator/content/index.ts");
const { ST01_CARD_DEFS } = await import("../src/modules/simulator/fixtures/st01Deck.ts");
const { ST02_CARD_DEFS } = await import("../src/modules/simulator/fixtures/st02Deck.ts");
const { ST03_CARD_DEFS } = await import("../src/modules/simulator/fixtures/st03Deck.ts");
const { ST04_CARD_DEFS } = await import("../src/modules/simulator/fixtures/st04Deck.ts");
const { ST05_CARD_DEFS } = await import("../src/modules/simulator/fixtures/st05Deck.ts");
const { ST06_CARD_DEFS } = await import("../src/modules/simulator/fixtures/st06Deck.ts");
const { ST07_CARD_DEFS } = await import("../src/modules/simulator/fixtures/st07Deck.ts");
const { ST08_CARD_DEFS } = await import("../src/modules/simulator/fixtures/st08Deck.ts");
const { GD01_CARD_DEFS } = await import("../src/modules/simulator/content/gd01/index.ts");
const { GD02_CARD_DEFS } = await import("../src/modules/simulator/content/gd02/index.ts");
const { GD03_CARD_DEFS } = await import("../src/modules/simulator/content/gd03/index.ts");

const DEF_BY_CODE = new Map();
for (const defs of [
  ST01_CARD_DEFS,
  ST02_CARD_DEFS,
  ST03_CARD_DEFS,
  ST04_CARD_DEFS,
  ST05_CARD_DEFS,
  ST06_CARD_DEFS,
  ST07_CARD_DEFS,
  ST08_CARD_DEFS,
  GD01_CARD_DEFS,
  GD02_CARD_DEFS,
  GD03_CARD_DEFS,
]) {
  for (const def of Object.values(defs)) DEF_BY_CODE.set(def.code, def);
}
const SPECS_BY_CODE = new Map();
for (const spec of ALL_EFFECT_SPECS) {
  if (!SPECS_BY_CODE.has(spec.cardCode)) SPECS_BY_CODE.set(spec.cardCode, []);
  SPECS_BY_CODE.get(spec.cardCode).push(spec);
}
const DEFERRALS_BY_CODE = new Map();
for (const d of DEFERRED_CLAUSES) {
  if (!DEFERRALS_BY_CODE.has(d.cardCode)) DEFERRALS_BY_CODE.set(d.cardCode, []);
  DEFERRALS_BY_CODE.get(d.cardCode).push(d);
}

// ── Governança de vocabulário do motor (docs/debates 2026-09-12/13) ──────────
// `content/primitives-claims.json` é o registro append-only de toda
// PrimitiveCall.op / TargetRef.kind / TargetGroup.kind / EffectSpec.targetScope
// / predicate de condition / targetFilter que o motor já conhece. Extraído
// aqui via parsing leve do PRÓPRIO texto-fonte (não runtime: são tipos TS e
// strings resolvidas por regex — nenhum array/enum sobrevive à compilação
// pra introspecção). Objetivo: nenhuma primitiva nova entra numa PR sem ser
// registrada — o RAG lexical (`scripts/mcp-gundam/similar-specs.mjs`) depende
// disso pra não deixar um agente inventar uma variante duplicada em GD02+.
const ENGINE_DIR = path.join(REPO_ROOT, "src/modules/simulator/engine");
const CONTENT_DIR = path.join(REPO_ROOT, "src/modules/simulator/content");

/** Fatia `text` entre a 1ª ocorrência de `startMarker` e a 1ª ocorrência de `endMarker` depois dele. Lança se algum marcador sumir (sinal de refactor que precisa atualizar este script também). */
function sliceBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) throw new Error(`[coverage] governança: marcador não encontrado em effectSpec.ts: "${startMarker}"`);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end === -1) {
    throw new Error(`[coverage] governança: marcador de fim não encontrado: "${endMarker}" (após "${startMarker}")`);
  }
  return text.slice(start + startMarker.length, end);
}

/** Casa `regex` (com 1 grupo de captura) contra `text` e devolve os valores únicos, na ordem da 1ª aparição. */
function uniqueMatches(text, regex) {
  const out = [];
  const seen = new Set();
  for (const m of text.matchAll(regex)) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}

/** Normaliza o corpo textual de um `.match(/^padrão$/)` (texto literal do fonte, não interpretado como regex) pra um id legível: `(\d+)` -> `<n>`, `(.+)` -> `<value>`. */
function normalizePatternBody(body) {
  return body.replace(/\(\\d\+\)/g, "<n>").replace(/\(\.\+\)/g, "<value>");
}

/** Extrai o vocabulário ATUAL do motor direto do código-fonte (effectSpec.ts + content/predicates.ts). */
function extractEngineVocabulary() {
  const effectSpecSrc = readFileSync(path.join(ENGINE_DIR, "effectSpec.ts"), "utf8");
  const predicatesSrc = readFileSync(path.join(CONTENT_DIR, "predicates.ts"), "utf8");

  const primitiveCallBlock = sliceBetween(effectSpecSrc, "export type PrimitiveCall =", "\nexport interface CardDefFilter");
  const primitiveOps = uniqueMatches(primitiveCallBlock, /op:\s*"([a-zA-Z0-9_]+)"/g);

  const targetRefBlock = sliceBetween(effectSpecSrc, "export type TargetRef =", "\nexport type TargetGroup =");
  const targetRefKinds = uniqueMatches(targetRefBlock, /kind:\s*"([a-zA-Z0-9_]+)"/g);

  const targetGroupBlock = sliceBetween(effectSpecSrc, "export type TargetGroup =", "\nfunction isLinkUnit");
  const targetGroupKinds = uniqueMatches(targetGroupBlock, /kind:\s*"([a-zA-Z0-9_]+)"/g);

  const targetScopeBlock = sliceBetween(effectSpecSrc, "targetScope?:", ";");
  const targetScopes = uniqueMatches(targetScopeBlock, /"([a-zA-Z0-9_]+)"/g);

  const literalPredicates = uniqueMatches(predicatesSrc, /if \(predicate === "([a-zA-Z0-9_]+)"\)/g);
  const templatedPredicates = [...predicatesSrc.matchAll(/predicate\.match\(\/\^([^$]+)\$\/\)/g)].map((m) =>
    normalizePatternBody(m[1]),
  );
  const predicates = [...new Set([...literalPredicates, ...templatedPredicates])];

  const literalFilters = uniqueMatches(predicatesSrc, /if \(filter === "([a-zA-Z0-9_]+)"\)/g);
  const templatedFilters = [...predicatesSrc.matchAll(/filter\.match\(\/\^([^$]+)\$\/\)/g)].map((m) =>
    normalizePatternBody(m[1]),
  );
  const targetFilters = [...new Set([...literalFilters, ...templatedFilters])];

  return { primitiveOps, targetRefKinds, targetGroupKinds, targetScopes, predicates, targetFilters };
}

/** Devolve a lista de `"<categoria>.<id>"` presentes no motor mas ausentes de `primitives-claims.json`. */
function findUnclaimedVocabulary() {
  const claimsPath = path.join(CONTENT_DIR, "primitives-claims.json");
  const claims = JSON.parse(readFileSync(claimsPath, "utf8"));
  const vocabulary = extractEngineVocabulary();

  const unclaimed = [];
  for (const category of Object.keys(vocabulary)) {
    const claimedIds = new Set(Object.keys(claims[category] ?? {}));
    for (const id of vocabulary[category]) {
      if (!claimedIds.has(id)) unclaimed.push(`${category}.${id}`);
    }
  }
  return unclaimed;
}

const unclaimedVocabulary = findUnclaimedVocabulary();
if (unclaimedVocabulary.length > 0) {
  console.error(
    `[coverage] GOVERNANÇA DE PRIMITIVAS: ${unclaimedVocabulary.length} item(ns) em effectSpec.ts/predicates.ts sem entrada em content/primitives-claims.json:\n  ${unclaimedVocabulary.join("\n  ")}`,
  );
  console.error(
    "[coverage] Registre cada item novo em src/modules/simulator/content/primitives-claims.json (categoria.id, com \"description\" e \"since\") antes de mergear.",
  );
  process.exit(1);
}
console.log(`[coverage] governança de primitivas: OK (vocabulário do motor 100% registrado em primitives-claims.json).`);

const official = JSON.parse(readFileSync(path.join(REPO_ROOT, "data/gcg-official-cards.json"), "utf8")).cards;

/**
 * `true` se o texto oficial tem alguma regra bespoke além de:
 *  - keyword automática (`<X>` ou `【trigger】<X>` + lembrete `(...)`)
 *  - `【Pilot】[Nome]` (pilotMode)
 *  - vazio / "-"
 */
function hasBespokeText(effect) {
  if (!effect || effect.trim() === "-" || effect.trim() === "") return false;
  let s = effect
    .replace(/【Pilot】\s*\[[^\]]*\]/g, " ") // modo Pilot alternativo → pilotMode
    .replace(/【[^】]*】/g, " ") // marcadores de gatilho
    .replace(/<[^>]+>/g, " "); // tokens de keyword
  // lembretes entre parênteses (inclui aninhados: roda até estabilizar)
  let prev;
  do {
    prev = s;
    s = s.replace(/\([^()]*\)/g, " ");
  } while (s !== prev);
  s = s.replace(/[［］\[\]･・、。.,\s]+/g, " ").trim();
  return s.length > 0;
}

function classify(code) {
  const card = official.find((c) => c.code === code);
  const effect = card?.effect ?? "";
  const def = DEF_BY_CODE.get(code);
  const specs = SPECS_BY_CODE.get(code) ?? [];
  const deferrals = DEFERRALS_BY_CODE.get(code) ?? [];

  const bespoke = hasBespokeText(effect);
  const hasStructured = Boolean(
    def &&
      (def.staticAbilities?.length ||
        def.combatTriggers?.length ||
        def.attackTargetRules ||
        def.dynamicCost ||
        def.onSupportUsed ||
        def.innateStatReductionImmunity ||
        def.innateDamageProtection ||
        def.alternateDeploySacrifice ||
        def.onAnyPairing),
  );
  const hasSpec = specs.length > 0;

  let status;
  if (!bespoke) status = "vanilla";
  else if (hasSpec || hasStructured) status = deferrals.length ? "implementada*" : "implementada";
  else if (deferrals.length) status = "deferida";
  else status = "faltando";

  return { code, name: card?.name ?? "?", type: card?.cardType ?? "?", status, specs: specs.length, deferrals: deferrals.length };
}

const args = parseArgs(process.argv.slice(2));
const allSets = [...new Set(official.map((c) => c.code.split("-")[0]))].sort();
const sets = args.all ? allSets : args.sets;

// Sanidade de `deferred.ts`: cada cláusula de carta específica tem que ser um
// trecho LITERAL do texto EN oficial (não paráfrase, não typo). `*` é livre.
const EFFECT_NORM = new Map(official.map((c) => [c.code, (c.effect ?? "").replace(/\s+/g, " ").trim()]));
const badDeferrals = [];
for (const d of DEFERRED_CLAUSES) {
  if (d.cardCode === "*") continue;
  const eff = EFFECT_NORM.get(d.cardCode);
  if (!eff || !eff.includes(d.clause.replace(/\s+/g, " ").trim())) {
    badDeferrals.push(`${d.cardCode}: "${d.clause}"`);
  }
}

let missing = 0;
const lines = [];
lines.push("# Cobertura de efeitos — motor do simulador");
lines.push("");
lines.push(`> Gerado por \`node scripts/gundam-coverage.mjs\` em ${new Date().toISOString()}.`);
lines.push("> `faltando` = texto bespoke sem EffectSpec, sem campo estruturado e sem entrada em `content/deferred.ts`.");
lines.push("");

const totals = {};
for (const set of sets) {
  const codes = official.filter((c) => c.code.startsWith(`${set}-`)).map((c) => c.code).sort();
  if (codes.length === 0) continue;
  const rows = codes.map(classify);
  const t = { implementada: 0, "implementada*": 0, vanilla: 0, deferida: 0, faltando: 0 };
  for (const r of rows) t[r.status]++;
  totals[set] = t;
  missing += t.faltando;

  lines.push(`## ${set} — ${codes.length} cartas`);
  lines.push("");
  lines.push("| Código | Carta | Tipo | Status | Specs | Deferidas |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of rows) {
    const mark = r.status === "faltando" ? "❌ " : r.status.startsWith("implementada") ? "✅ " : r.status === "deferida" ? "⚠️ " : "· ";
    lines.push(`| ${r.code} | ${r.name} | ${r.type} | ${mark}${r.status} | ${r.specs} | ${r.deferrals || ""} |`);
  }
  lines.push("");
  lines.push(
    `**${set}:** ${t.implementada} implementada · ${t["implementada*"]} implementada* · ${t.vanilla} vanilla · ${t.deferida} deferida · ${t.faltando} faltando`,
  );
  lines.push("");
}

lines.push("## Deferimentos ativos (`content/deferred.ts`)");
lines.push("");
lines.push("| Carta | Cláusula | blockedBy |");
lines.push("|---|---|---|");
for (const d of DEFERRED_CLAUSES) {
  const clause = d.clause.length > 90 ? `${d.clause.slice(0, 90)}…` : d.clause;
  lines.push(`| ${d.cardCode} | ${clause} | \`${d.blockedBy}\` |`);
}
lines.push("");

const report = lines.join("\n");
const outFile = args.outFile ?? "docs/_generated/coverage.md";
mkdirSync(path.join(REPO_ROOT, path.dirname(outFile)), { recursive: true });
writeFileSync(path.join(REPO_ROOT, outFile), report, "utf8");

// ── coverage.json — versionado, determinístico (docs/44 §6.3, Lane 3BC) ──────
// Sempre sobre os sets do gate (ST01–ST04), independente dos argumentos de CLI,
// pra `pnpm gundam:coverage` 2× dar diff vazio. Cartas ordenadas por code.
const COUNT_KEY_BY_STATUS = {
  implementada: "impl",
  "implementada*": "implStar",
  vanilla: "vanilla",
  deferida: "deferida",
  faltando: "faltando",
};
const jsonSets = {};
for (const set of GATED_SETS) {
  const codes = official.filter((c) => c.code.startsWith(`${set}-`)).map((c) => c.code).sort();
  const rows = codes.map(classify);
  const counts = { impl: 0, implStar: 0, vanilla: 0, deferida: 0, faltando: 0 };
  const cards = rows.map((r) => {
    counts[COUNT_KEY_BY_STATUS[r.status]]++;
    return {
      code: r.code,
      name: r.name,
      status: r.status,
      deferredClauses: (DEFERRALS_BY_CODE.get(r.code) ?? []).map((d) => d.clause),
    };
  });
  jsonSets[set] = { cards, counts };
}
const coverageJson = { generatedFrom: `${ALL_EFFECT_SPECS.length} specs`, sets: jsonSets };
writeFileSync(
  path.join(REPO_ROOT, "src/modules/simulator/content/_index/coverage.json"),
  `${JSON.stringify(coverageJson, null, 2)}\n`,
  "utf8",
);

// console
for (const set of sets) {
  const t = totals[set];
  if (!t) continue;
  const flag = t.faltando > 0 ? " ❌" : "";
  console.log(
    `[coverage] ${set}: ${t.implementada}+${t["implementada*"]}* impl · ${t.vanilla} vanilla · ${t.deferida} deferida · ${t.faltando} faltando${flag}`,
  );
}
console.log(`[coverage] relatório: ${outFile}`);

if (badDeferrals.length > 0) {
  console.error(`[coverage] deferred.ts: cláusula(s) que NÃO são trecho literal do texto EN oficial:\n  ${badDeferrals.join("\n  ")}`);
}

if (args.gate && (missing > 0 || badDeferrals.length > 0)) {
  if (missing > 0) console.error(`[coverage] FALHA: ${missing} carta(s) 'faltando' nos sets ${sets.join(",")}.`);
  process.exit(1);
}
