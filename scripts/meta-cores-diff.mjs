/**
 * Compara a fixture fixtures/metaCores.ts da árvore de trabalho com a de um commit (padrão HEAD), ignorando a data
 * de geração. Sai 0 se o meta é o mesmo e 1 se mudou; em stdout, um resumo em Markdown por temporada (para o
 * resumo do run do Actions). Usado pelo job zero-system do workflow Dados do site.
 *
 *   node scripts/meta-cores-diff.mjs [--base=HEAD]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FIXTURE = "src/modules/simulator/fixtures/metaCores.ts";

/** o objeto literal depois de `META_CORES: MetaCoreFile =` */
export function parseFixture(source) {
  const m = String(source ?? "").match(/META_CORES:\s*MetaCoreFile\s*=\s*([\s\S]*);\s*$/);
  return m ? JSON.parse(m[1]) : null;
}

/** linhas do resumo e se o meta mudou (generatedAt/source não contam) */
export function diffMetaCores(before, after) {
  const a = before?.formats ?? {};
  const b = after?.formats ?? {};
  const rows = [];
  let changed = false;
  for (const f of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const same = JSON.stringify(a[f]) === JSON.stringify(b[f]);
    if (!same) changed = true;
    const n = (x, k) => (x ? x[k] ?? "—" : "—");
    const arch = (x) => (x ? x.archetypes?.length ?? 0 : "—");
    rows.push(`| ${f} | ${n(a[f], "lists")} → ${n(b[f], "lists")} | ${n(a[f], "events")} → ${n(b[f], "events")} | ${arch(a[f])} → ${arch(b[f])} | ${same ? "igual" : "**mudou**"} |`);
  }
  return { changed, rows };
}

function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
  const base = String(args.base ?? "HEAD");
  const before = parseFixture(execFileSync("git", ["show", `${base}:${FIXTURE}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  const after = parseFixture(fs.readFileSync(path.resolve(FIXTURE), "utf8"));
  const { changed, rows } = diffMetaCores(before, after);
  console.log(`### Zero System — núcleos de arquétipo (${base} → coleta nova)\n`);
  console.log("| Temporada | Listas | Eventos | Arquétipos | |\n|---|---|---|---|---|");
  for (const r of rows) console.log(r);
  process.exit(changed ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
