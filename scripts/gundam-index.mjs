/*
 * Índice local de "assinaturas de mecânica" dos EffectSpec autorados
 * (docs/44 §6.1 — RAG de autoria).
 *
 * Pra cada spec de `ALL_EFFECT_SPECS` (content/index.ts) extrai uma assinatura
 * enxuta e determinística e grava o array ORDENADO POR `id` em
 * `src/modules/simulator/content/_index/specs-signatures.json` (versionado).
 * Regenerar não deve produzir diff espúrio — rode `pnpm gundam:index` depois de
 * mexer em qualquer `content/st0X.ts`.
 *
 *   pnpm gundam:index            # grava o arquivo
 *   node scripts/gundam-index.mjs --stdout   # imprime o JSON, não grava
 *
 * O motor é TS: o carregamento de `ALL_EFFECT_SPECS` usa o loader `tsx/esm`
 * (mesmo padrão de `scripts/mcp-gundam/*`), registrado só dentro de `main()`
 * pra que importar `buildSignatures`/`serializeSignatures` daqui (nos testes)
 * não puxe o motor.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
export const INDEX_PATH = path.join(ROOT, "src/modules/simulator/content/_index/specs-signatures.json");

/** `op` de cada PrimitiveCall de uma lista, na ordem. */
function opsOf(calls) {
  return (calls ?? []).map((call) => call.op);
}

/** Assinatura de mecânica de um EffectSpec — só o que o ranking precisa. */
export function signatureOf(spec) {
  return {
    id: spec.id,
    cardCode: spec.cardCode,
    trigger: spec.trigger,
    ops: [
      ...opsOf(spec.cost),
      ...opsOf(spec.condition?.then),
      ...opsOf(spec.condition?.else),
      ...opsOf(spec.actions),
    ],
    targetScope: spec.targetScope ?? null,
    targetFilter: spec.targetFilter ?? null,
    predicate: spec.condition?.predicate ?? null,
    sourceText: spec.sourceText,
  };
}

/** Assinaturas de todos os specs, ordenadas por `id` (determinístico). */
export function buildSignatures(specs) {
  return specs
    .map(signatureOf)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function serializeSignatures(signatures) {
  return `${JSON.stringify(signatures, null, 2)}\n`;
}

async function loadAllEffectSpecs() {
  const { register } = await import("tsx/esm/api");
  register();
  const mod = await import(pathToFileURL(path.join(ROOT, "src/modules/simulator/content/index.ts")).href);
  return mod.ALL_EFFECT_SPECS;
}

export async function main({ stdout = false } = {}) {
  const specs = await loadAllEffectSpecs();
  const signatures = buildSignatures(specs);
  const serialized = serializeSignatures(signatures);

  if (stdout) {
    process.stdout.write(serialized);
    return signatures;
  }

  fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
  fs.writeFileSync(INDEX_PATH, serialized);
  console.log(`gundam:index — ${signatures.length} assinaturas -> ${path.relative(ROOT, INDEX_PATH)}`);
  return signatures;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main({ stdout: process.argv.includes("--stdout") }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
