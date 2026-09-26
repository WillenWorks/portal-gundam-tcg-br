#!/usr/bin/env node
/**
 * Reescreve o `sourceText` dos EffectSpecs "órfãos" (texto que não bate com nenhuma cláusula
 * oficial — ex.: estilo `[Deploy]` do apitcg, "1 or 2" no lugar de "1 to 2") pela cláusula
 * oficial mais parecida (plano "simulador até GD05", W0.2). Só troca com similaridade alta e
 * o mesmo gatilho; o resto sai listado pra revisão manual.
 *
 *   node scripts/gundam-fix-sourcetext.mjs            # dry-run: lista o que trocaria
 *   node scripts/gundam-fix-sourcetext.mjs --write    # grava nos arquivos de content/
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

register();

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");
const MIN_SIMILARITY = 0.75;

const { ALL_EFFECT_SPECS } = await import("../src/modules/simulator/content/index.ts");
const { ALL_CARD_DEFS } = await import("../src/modules/simulator/content/allCardDefs.ts");
const { auditCard, splitClauses, normalizeClause } = await import("../src/modules/simulator/content/coverage/clauseAudit.ts");
const official = new Map(JSON.parse(readFileSync(path.join(REPO_ROOT, "data/gcg-official-cards.json"), "utf8")).cards.map((c) => [c.code, c.effect ?? ""]));
const defs = new Map(Object.values(ALL_CARD_DEFS).map((d) => [d.code, d]));

/** normalização agressiva só pra comparar: colchetes do apitcg, caixa, pontuação */
const loose = (s) =>
  normalizeClause(s)
    .replace(/\[(Deploy|Attack|Burst|Main|Action|Destroyed|When Paired|When Linked|During Pair|During Link|Once per Turn|Activate[^\]]*)\]/g, "【$1】")
    .toLowerCase()
    .replace(/[^a-z0-9+()【】]+/g, " ")
    .trim();
const tokens = (s) => new Set(loose(s).split(" ").filter(Boolean));
function similarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.max(1, A.size + B.size - inter);
}

const orphanIds = new Set();
for (const code of new Set(ALL_EFFECT_SPECS.map((s) => s.cardCode))) {
  const a = auditCard({ code, effect: official.get(code) ?? "", def: defs.get(code), specs: ALL_EFFECT_SPECS.filter((s) => s.cardCode === code) });
  for (const e of a.errors) if (e.startsWith("orphanSpec: ")) orphanIds.add(e.slice("orphanSpec: ".length));
}

const planned = [];
const manual = [];
for (const spec of ALL_EFFECT_SPECS.filter((s) => orphanIds.has(s.id))) {
  const clauses = splitClauses(official.get(spec.cardCode) ?? "").filter((c) => c.kind === "bespoke");
  let best = null;
  for (const c of clauses) {
    const score = similarity(spec.sourceText ?? "", c.text);
    if (!best || score > best.score) best = { clause: c, score };
  }
  const trigger = normalizeClause(spec.trigger).replace(/^Activate\s*[:·]\s*/, "Activate·");
  const triggerOk = best && (best.clause.triggers.length === 0 || best.clause.triggers.includes(trigger));
  if (best && best.score >= MIN_SIMILARITY && triggerOk) planned.push({ spec, to: best.clause.text, score: best.score });
  else manual.push({ spec, best });
}

function contentFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...contentFiles(p));
    else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}
const files = [...contentFiles(path.join(REPO_ROOT, "src/modules/simulator/content")), ...contentFiles(path.join(REPO_ROOT, "src/modules/simulator/fixtures"))];
const sources = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

let applied = 0;
for (const p of planned) {
  const literal = JSON.stringify(p.spec.sourceText);
  const file = [...sources.keys()].find((f) => sources.get(f).includes(`id: ${JSON.stringify(p.spec.id)}`) && sources.get(f).includes(literal));
  if (!file) {
    manual.push({ spec: p.spec, best: { clause: { text: p.to }, score: p.score }, why: "literal não encontrado no fonte" });
    continue;
  }
  // `replace` troca só a 1ª ocorrência: com o mesmo sourceText em 2+ specs do arquivo, gravaria no spec errado
  if (sources.get(file).split(literal).length - 1 > 1) {
    manual.push({ spec: p.spec, best: { clause: { text: p.to }, score: p.score }, why: "sourceText repetido no arquivo (ambíguo)" });
    continue;
  }
  console.log(`${p.spec.id} (${p.score.toFixed(2)}) ${path.relative(REPO_ROOT, file)}\n   - ${p.spec.sourceText.replace(/\n/g, "⏎").slice(0, 150)}\n   + ${p.to.slice(0, 150)}`);
  if (write) {
    sources.set(file, sources.get(file).replace(literal, JSON.stringify(p.to)));
    applied++;
  }
}
if (write) for (const [f, s] of sources) writeFileSync(f, s);
console.log(`\n[fix-sourcetext] órfãos: ${orphanIds.size} · troca automática: ${planned.length}${write ? ` (gravadas ${applied})` : " (dry-run)"} · revisão manual: ${manual.length}`);
for (const m of manual) {
  console.log(`  MANUAL ${m.spec.id} [${m.spec.trigger}]${m.why ? ` (${m.why})` : ""}\n     spec: ${(m.spec.sourceText ?? "").replace(/\n/g, "⏎").slice(0, 150)}\n     mais parecida (${m.best ? m.best.score.toFixed(2) : "-"}): ${m.best ? m.best.clause.text.slice(0, 150) : "-"}`);
}
