#!/usr/bin/env node
/**
 * Compara duas matrizes de confrontos (base × versão nova) jogadas com as MESMAS seeds e decks.
 * Por deck: taxa média contra os oponentes em comum, nos dois lados. Falha (código 1) se algum
 * deck cair mais que `--maxDrop` pontos — critério "o bot não cai mais de 3 pontos" da wave.
 *
 *   node scripts/gundam-bot-compare.mjs base.json nova.json [--maxDrop=3] [--md=resumo.md]
 */
import fs from "node:fs";
import process from "node:process";

const argv = process.argv.slice(2);
const opt = (name, fallback) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const [baseFile, headFile] = argv.filter((a) => !a.startsWith("--"));
if (!baseFile || !headFile) {
  console.error("uso: gundam-bot-compare.mjs base.json nova.json [--maxDrop=3] [--md=resumo.md]");
  process.exit(2);
}
const maxDrop = Number(opt("maxDrop", "3"));
const base = JSON.parse(fs.readFileSync(baseFile, "utf8"));
const head = JSON.parse(fs.readFileSync(headFile, "utf8"));
for (const k of ["level", "gamesPerPair", "seed", "maxTurns"]) {
  if (base.params[k] !== head.params[k]) throw new Error(`parâmetro "${k}" diferente: ${base.params[k]} × ${head.params[k]}`);
}

const common = base.decks.filter((id) => head.decks.includes(id));
const rateOf = (m, a, b) => m.rate[m.decks.indexOf(a)]?.[m.decks.indexOf(b)] ?? null;
const pct = (x) => (x === null ? "–" : `${(x * 100).toFixed(1)}%`);
const rows = [];
let changedPairs = 0;
let totalPairs = 0;
for (const id of common) {
  const b = [];
  const h = [];
  for (const other of common) {
    if (other === id) continue;
    const rb = rateOf(base, id, other);
    const rh = rateOf(head, id, other);
    if (rb === null || rh === null) continue;
    b.push(rb);
    h.push(rh);
  }
  const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  const ab = avg(b);
  const ah = avg(h);
  rows.push({ id, base: ab, head: ah, delta: ab === null || ah === null ? null : (ah - ab) * 100 });
}
for (let i = 0; i < common.length; i++) {
  for (let j = i + 1; j < common.length; j++) {
    const rb = rateOf(base, common[i], common[j]);
    const rh = rateOf(head, common[i], common[j]);
    if (rb === null || rh === null) continue;
    totalPairs++;
    if (rb !== rh) changedPairs++;
  }
}
rows.sort((x, y) => (x.delta ?? 0) - (y.delta ?? 0));
const worst = rows.find((r) => r.delta !== null && r.delta < -maxDrop);

const lines = [
  `### Bot: ${base.commit} → ${head.commit}`,
  "",
  `nível \`${head.params.level}\` · ${head.params.gamesPerPair} partidas/par · seed ${head.params.seed}` +
    (head.params.focus?.length ? ` · foco ${head.params.focus.join(", ")}` : "") +
    ` · confrontos com resultado diferente: ${changedPairs}/${totalPairs}`,
  "",
  "| Deck | base | nova | Δ (pts) |",
  "|---|---|---|---|",
  ...rows.map((r) => `| ${r.id} | ${pct(r.base)} | ${pct(r.head)} | ${r.delta === null ? "–" : r.delta.toFixed(1)} |`),
  "",
  worst ? `❌ **${worst.id}** caiu ${(-worst.delta).toFixed(1)} pts (limite ${maxDrop}).` : `✅ nenhum deck caiu mais de ${maxDrop} pts.`,
];
const excludedHead = head.excluded?.length ?? 0;
if (excludedHead) lines.push("", `⚠️ ${excludedHead} partida(s) excluída(s) na versão nova (crash/estado ilegal) — ver \`excluded\` no relatório.`);
const md = lines.join("\n");
console.log(md);
const mdFile = opt("md");
if (mdFile) fs.writeFileSync(mdFile, `${md}\n`);
process.exit(worst || excludedHead ? 1 : 0);
