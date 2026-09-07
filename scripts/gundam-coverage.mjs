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
 *   node scripts/gundam-coverage.mjs                     # ST01..ST04, tabela + resumo
 *   node scripts/gundam-coverage.mjs --sets=ST01,ST03    # só esses
 *   node scripts/gundam-coverage.mjs --all               # todos os sets do dataset (GD/EB…)
 *   node scripts/gundam-coverage.mjs --gate              # exit != 0 se houver `faltando` nos sets pedidos
 *   node scripts/gundam-coverage.mjs --out=docs/_generated/coverage.md
 *
 * O CI (.github/workflows/ci.yml) roda com `--gate` sobre ST01..ST04.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

register();

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GATED_SETS = ["ST01", "ST02", "ST03", "ST04"];

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

const DEF_BY_CODE = new Map();
for (const defs of [ST01_CARD_DEFS, ST02_CARD_DEFS, ST03_CARD_DEFS, ST04_CARD_DEFS]) {
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
    def && (def.staticAbilities?.length || def.combatTriggers?.length || def.attackTargetRules),
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
