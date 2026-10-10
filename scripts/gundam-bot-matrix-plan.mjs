/**
 * Divide as matrizes por temporada em fatias para o workflow `bot-matrix.yml`: cada temporada recebe um número de
 * fatias proporcional às suas partidas (pares × partidas por par), com no mínimo 1, até `--max-shards` no total.
 * Imprime o `include` da matriz do GitHub Actions: [{ "format": "GD05", "shard": 0, "of": 12 }, …].
 *
 *   node scripts/gundam-bot-matrix-plan.mjs --dir=pools --formats=GD05,GD05.5 --games=20 --max-shards=60
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function planShards(sizes, maxShards) {
  const total = sizes.reduce((n, s) => n + s.games, 0);
  return sizes.flatMap(({ format, games }) => {
    const of = Math.max(1, Math.round((games / Math.max(1, total)) * maxShards));
    return Array.from({ length: of }, (_, shard) => ({ format, shard, of }));
  });
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? "true"]));
  const dir = path.resolve(String(args.dir ?? "pools"));
  const games = Number(args.games ?? 20);
  const formats = String(args.formats ?? "").split(",").filter(Boolean);
  const sizes = formats.map((format) => {
    const decks = JSON.parse(fs.readFileSync(path.join(dir, `pool-${format}.json`), "utf8")).decks.length;
    return { format, games: ((decks * (decks - 1)) / 2) * games };
  });
  console.log(JSON.stringify(planShards(sizes, Number(args["max-shards"] ?? 60))));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
