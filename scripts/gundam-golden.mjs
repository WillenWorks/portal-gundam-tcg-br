/*
 * Golden-master do motor do simulador (docs/44, Fase 2 — §4.3).
 *
 * Roda uma partida `randomLegal` vs `randomLegal` até o fim para cada um dos
 * 10 pares de decks ST01–ST04 (i <= j, espelhos incluídos), com um seed FIXO
 * por par, normaliza o `GameState` final (tira `engineVersion` e `seed`) e
 * reduz a um hash SHA-256 canônico (chaves ordenadas).
 *
 * Modo default = CHECK: compara com `src/modules/simulator/engine/__golden__/hashes.json`
 * e sai com código != 0 se algum hash divergir, imprimindo par + esperado x obtido.
 *
 * `--update` = regrava `hashes.json` + as partidas canônicas em `__golden__/canonical/`.
 * Use só num PR que MUDA de propósito um resultado de regra, com justificativa.
 *
 * Uso:
 *   node scripts/gundam-golden.mjs            # check (CI)
 *   node scripts/gundam-golden.mjs --update   # regrava o golden
 */

import { register } from "tsx/esm/api";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const unregister = register();

const ROOT = path.resolve(import.meta.dirname, "..");
const GOLDEN_DIR = path.join(ROOT, "src/modules/simulator/engine/__golden__");
const HASHES_FILE = path.join(GOLDEN_DIR, "hashes.json");
const CANONICAL_DIR = path.join(GOLDEN_DIR, "canonical");

const harness = await import(pathToFileURL(path.join(GOLDEN_DIR, "harness.ts")).href);
const { GOLDEN_PAIRS, CANONICAL_PAIR_KEYS, computeGoldenOutcome, canonicalJson } = harness;

const UPDATE = process.argv.slice(2).includes("--update");

function readHashes() {
  if (!fs.existsSync(HASHES_FILE)) return null;
  return JSON.parse(fs.readFileSync(HASHES_FILE, "utf8"));
}

function writeJsonSorted(file, value) {
  fs.writeFileSync(file, `${canonicalJson(value)}\n`, "utf8");
}

console.log(`[gundam:golden] ${GOLDEN_PAIRS.length} pares | modo ${UPDATE ? "UPDATE" : "CHECK"}`);

const started = Date.now();
const outcomes = [];
for (const pair of GOLDEN_PAIRS) {
  const outcome = await computeGoldenOutcome(pair);
  outcomes.push(outcome);
  const s = outcome.summary;
  console.log(
    `[gundam:golden]   ${pair.key}: winner=${s.winner ?? "-"} reason=${s.reason ?? "-"} turns=${s.turns} events=${s.events} sha=${outcome.hash.slice(0, 12)}…`,
  );
}

const freshHashes = {};
for (const o of outcomes) freshHashes[o.pair.key] = o.hash;

if (UPDATE) {
  fs.mkdirSync(CANONICAL_DIR, { recursive: true });
  writeJsonSorted(HASHES_FILE, freshHashes);
  for (const key of CANONICAL_PAIR_KEYS) {
    const o = outcomes.find((x) => x.pair.key === key);
    if (!o) {
      console.error(`[gundam:golden] CANONICAL_PAIR_KEYS aponta pra "${key}", que não é um par golden.`);
      unregister();
      process.exit(2);
    }
    writeJsonSorted(path.join(CANONICAL_DIR, `${key}.json`), o.normalized);
  }
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[gundam:golden] hashes.json (${Object.keys(freshHashes).length}) + ${CANONICAL_PAIR_KEYS.length} canônicas regravadas em ${elapsed}s.`,
  );
  unregister();
  process.exit(0);
}

const stored = readHashes();
if (!stored) {
  console.error(`[gundam:golden] ${HASHES_FILE} não existe. Rode 'pnpm gundam:golden:update' pra criar.`);
  unregister();
  process.exit(1);
}

const diffs = [];
for (const o of outcomes) {
  const expected = stored[o.pair.key];
  if (expected !== o.hash) {
    diffs.push({ key: o.pair.key, expected: expected ?? "(ausente)", got: o.hash });
  }
}
const extraKeys = Object.keys(stored).filter((k) => !freshHashes[k]);
for (const k of extraKeys) {
  diffs.push({ key: k, expected: stored[k], got: "(par não existe mais)" });
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);

if (diffs.length > 0) {
  console.error(`\n[gundam:golden] ${diffs.length} DIVERGÊNCIA(S) — o motor mudou de comportamento:`);
  for (const d of diffs) {
    console.error(`  - ${d.key}`);
    console.error(`      esperado: ${d.expected}`);
    console.error(`      obtido:   ${d.got}`);
  }
  console.error(
    `\n[gundam:golden] Se a mudança é INTENCIONAL: rode 'pnpm gundam:golden:update', confira o diff das canônicas em`,
  );
  console.error(`      src/modules/simulator/engine/__golden__/canonical/ e justifique no PR.`);
  console.error(`[gundam:golden] Se NÃO era esperada: você introduziu uma regressão de regra.`);
  unregister();
  process.exit(1);
}

console.log(`[gundam:golden] ${outcomes.length} pares conferem com hashes.json (${elapsed}s). Motor estável.`);
unregister();
