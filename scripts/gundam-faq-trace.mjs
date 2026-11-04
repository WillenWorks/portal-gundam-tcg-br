#!/usr/bin/env node
/**
 * Rastreio FAQ → teste: lista os Q&As oficiais de um set sem citação em teste do simulador.
 *   node scripts/gundam-faq-trace.mjs GD06           relatório
 *   node scripts/gundam-faq-trace.mjs GD06 --gate    falha se faltar algum
 *   node scripts/gundam-faq-trace.mjs --all          contagem por set (só relatório)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testRoot = path.join(root, "src/modules/simulator");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/[.]test[.]tsx?$/.test(name)) out.push(full);
  }
  return out;
}

export function citedIds(files) {
  const cited = new Set();
  for (const file of files) for (const match of readFileSync(file, "utf8").matchAll(/[Q][0-9]{3,4}/g)) cited.add(match[0]);
  return cited;
}

export function qasBySet(faq) {
  const bySet = new Map();
  for (const [code, entries] of Object.entries(faq)) {
    const set = code.split("-")[0];
    const list = bySet.get(set) ?? [];
    for (const entry of entries) list.push({ code, id: entry.id, question: entry.question });
    bySet.set(set, list);
  }
  return bySet;
}

const faq = JSON.parse(readFileSync(path.join(root, "data/gcg-official-faq.json"), "utf8"));
const cited = citedIds(walk(testRoot));
const bySet = qasBySet(faq);
const args = process.argv.slice(2);

if (args.includes("--all")) {
  for (const [set, list] of [...bySet].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(set.padEnd(6), String(list.filter((q) => cited.has(q.id)).length).padStart(4), "/", list.length);
  }
} else {
  const set = args.find((arg) => !arg.startsWith("--"));
  const list = bySet.get(set);
  if (!list) {
    console.error("Uso: gundam-faq-trace.mjs <SET> [--gate] | --all");
    process.exit(2);
  }
  const missing = list.filter((q) => !cited.has(q.id));
  console.log(set + ": " + (list.length - missing.length) + "/" + list.length + " Q&As citados em teste");
  for (const q of missing) console.log("  " + q.id + " " + q.code + ": " + q.question);
  if (args.includes("--gate") && missing.length) process.exit(1);
}
