/**
 * Monta o pool de decks de uma temporada para a matriz de confrontos (`gundam:bot:matchups --pool=<arquivo>`), a partir
 * dos arquétipos de torneio em `fixtures/metaCores.ts` (Egman): cada VERSÃO (variante) de cada arquétipo vira um deck,
 * pela lista real mais próxima do centro da variante. Na temporada atual entram também as receitas oficiais dos
 * starters lançados nela. Antes de entrar, cada deck é validado (50 cartas, até 4 cópias, todas jogáveis no motor);
 * o que falhar sai do pool e vai pro relatório de validação.
 *
 *   node scripts/gundam-bot-season-pool.mjs --format=GD05.5 --out=pool.json [--min-lists=2]
 *   node scripts/gundam-bot-season-pool.mjs --list-formats
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "tsx/esm/api";

register();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sim = (p) => pathToFileURL(path.join(ROOT, "src/modules/simulator", p)).href;

/** receitas oficiais que pertencem a uma temporada (lançadas nela) */
const SEASON_RECIPES = { "GD05.5": ["ST11-MARINE", "ST12-CLOSE-COMBAT", "ST13-BIT-FUNNEL", "ST14-HEAVY-ARMED"] };

export async function buildSeasonPool(format, { minLists = 2 } = {}) {
  const { META_CORES } = await import(sim("fixtures/metaCores.ts"));
  const { buildDeckListFromUserDeck } = await import(sim("content/userDeckBuilder.ts"));
  const { isCardPlayable } = await import(pathToFileURL(path.join(ROOT, "server/deckCoverageGate.ts")).href);
  const { ST11_TO_14_DECKS } = await import(sim("fixtures/st11to14Decks.ts"));
  const fmt = META_CORES.formats[format];
  if (!fmt) throw new Error(`formato "${format}" não está em metaCores (${Object.keys(META_CORES.formats).join(", ")})`);

  const decks = [];
  const rejected = [];
  const accept = (id, label, archetype, entries) => {
    const total = entries.reduce((n, e) => n + e.quantity, 0);
    const overLimit = entries.filter((e) => e.quantity > 4).map((e) => e.code);
    let list;
    try {
      list = buildDeckListFromUserDeck({ id, name: label, items: entries.map((e) => ({ quantity: e.quantity, card: { code: e.code } })) });
    } catch (err) {
      rejected.push({ id, label, motivo: `não monta: ${err instanceof Error ? err.message : err}` });
      return;
    }
    const unplayable = [...new Set([...list.main, ...list.resources].filter((c) => !isCardPlayable(c)).map((c) => c.code))];
    const motivo =
      total !== 50 ? `${total} cartas no deck principal` : overLimit.length ? `mais de 4 cópias: ${overLimit.join(", ")}` : unplayable.length ? `fora do motor: ${unplayable.join(", ")}` : null;
    if (motivo) {
      rejected.push({ id, label, motivo });
      return;
    }
    decks.push({ id, label, source: archetype ? "tournament" : "fixed", archetype, list: { main: list.main.map((c) => c.code), resources: list.resources.map((c) => c.code) } });
  };

  for (const a of fmt.archetypes) {
    for (const v of a.variants) {
      if (v.lists < minLists && v.id !== a.bestVariantId) continue;
      const entries = Object.entries(v.median).map(([code, quantity]) => ({ code, quantity }));
      accept(`${format}:${v.id}`, `${a.name} · ${v.id.split("-").pop()} (${v.lists} listas)`, a.id, entries);
    }
  }
  for (const id of SEASON_RECIPES[format] ?? []) {
    const recipe = ST11_TO_14_DECKS[id];
    const entries = recipe.list.split("\n").map((l) => /^(\d+)x\s+(\S+)/.exec(l.trim())).filter(Boolean).map((m) => ({ code: m[2], quantity: Number(m[1]) }));
    accept(`${format}:${id}`, `${recipe.label} (receita oficial)`, null, entries);
  }
  return { pool: { date: new Date().toISOString().slice(0, 10), format, decks }, rejected };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
  if (args["list-formats"] === "true") {
    const { META_CORES } = await import(sim("fixtures/metaCores.ts"));
    console.log(JSON.stringify(Object.keys(META_CORES.formats)));
    return;
  }
  const format = String(args.format ?? "");
  const { pool, rejected } = await buildSeasonPool(format, { minLists: Number(args["min-lists"] ?? 2) });
  const out = path.resolve(ROOT, String(args.out ?? `docs/bot/pool-${format}.json`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(pool, null, 1)}\n`);
  fs.writeFileSync(out.replace(/\.json$/, ".validacao.json"), `${JSON.stringify({ format, aceitos: pool.decks.length, rejeitados: rejected }, null, 1)}\n`);
  console.log(`[season-pool] ${format}: ${pool.decks.length} decks válidos, ${rejected.length} rejeitados → ${path.relative(ROOT, out)}`);
  for (const r of rejected) console.log(`  rejeitado ${r.id}: ${r.motivo}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
