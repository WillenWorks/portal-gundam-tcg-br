#!/usr/bin/env node
/**
 * Gera os CardDefs de um set a partir do texto oficial (`data/gcg-official-cards.json`: nome,
 * tipo, traits, link, efeito) + stats do apitcg (`data/apitcg-gundam.json`: Lv., custo, cor,
 * AP/HP). Plano "simulador até GD05", W3.
 *
 * Só dados impressos: `effectKeywords`/`keywordTags` vêm das cláusulas de keyword pura (a
 * mesma leitura de `content/coverage/clauseAudit.ts`), `triggerKeywords` dos gatilhos de
 * timing, `pilotMode` do 【Pilot】[Nome] e `hasBurst` do 【Burst】. Efeito condicional/estático
 * (staticAbilities, combatTriggers…) é autoria à mão, na wave da carta.
 *
 * Uso:
 *   node scripts/gundam-gen-carddefs.mjs --set=GD04            # escreve content/gd04/*.ts
 *   node scripts/gundam-gen-carddefs.mjs --set=GD04 --check    # só compara (exit 1 se divergir)
 *
 * NÃO sobrescreve um set que já tem arquivos (autoria à mão por cima): use `--force` só em set novo.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "tsx/esm/api";

register();

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { splitClauses } = await import(pathToFileURL(path.join(REPO, "src/modules/simulator/content/coverage/clauseAudit.ts")).href);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const SET = String(args.set ?? "").toUpperCase();
if (!/^[A-Z]{2}\d{2}$/.test(SET)) {
  console.error("uso: node scripts/gundam-gen-carddefs.mjs --set=GD04 [--check] [--force]");
  process.exit(2);
}

const official = JSON.parse(readFileSync(path.join(REPO, "data/gcg-official-cards.json"), "utf8")).cards;
const apitcgRaw = JSON.parse(readFileSync(path.join(REPO, "data/apitcg-gundam.json"), "utf8"));
const apitcg = Array.isArray(apitcgRaw) ? apitcgRaw : (apitcgRaw.cards ?? apitcgRaw.data ?? Object.values(apitcgRaw));
const statsByCode = new Map(apitcg.filter((c) => c.code && c.attributes).map((c) => [c.code, c.attributes]));

const int = (v) => {
  const n = Number(String(v ?? "").replace(/^\+/, ""));
  return Number.isFinite(n) ? n : undefined;
};

export function buildCardDef(card, stats) {
  if (!stats) throw new Error(`${card.code}: sem stats no apitcg`);
  const cardType = card.cardType;
  const def = {
    code: card.code,
    nameEn: card.name,
    cardType,
    color: String(stats.Color ?? "").toLowerCase(),
    level: int(stats.Level),
    cost: int(stats.Cost),
  };
  if (cardType === "UNIT" || cardType === "BASE" || cardType === "PILOT") {
    def.ap = int(stats["Attack Points"]) ?? 0;
    def.hp = int(stats["Hit Points"]) ?? 0;
  }
  if ((card.traits ?? []).length && cardType !== "COMMAND") def.traits = [...card.traits];
  if (cardType === "COMMAND" && (card.traits ?? []).length) def.traits = [...card.traits];

  const link = card.link && card.link !== "-" ? card.link : null;
  if (link) {
    const names = [...link.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
    const traits = [...link.matchAll(/\(([^)]+)\)/g)].map((m) => m[1].trim());
    def.link = names.length ? { kind: "pilotName", values: names } : { kind: "trait", values: traits };
  }

  const clauses = splitClauses(card.effect ?? "");
  const effectKeywords = [];
  const keywordTags = [];
  const triggers = [];
  for (const c of clauses) {
    for (const t of c.triggers) if (!triggers.includes(t)) triggers.push(t);
    if (c.kind === "keyword") {
      for (const m of c.body.matchAll(/<([A-Za-z][A-Za-z -]*?)(?:\s+(\d+))?>/g)) {
        const name = m[1].trim();
        if (!effectKeywords.includes(name)) effectKeywords.push(name);
        if (m[2]) keywordTags.push(`${name} ${m[2]}`);
      }
    }
    if (c.kind === "pilotMode" && c.pilotName) {
      def.pilotMode = { pilotName: c.pilotName, ap: int(stats["Attack Points"]) ?? 0, hp: int(stats["Hit Points"]) ?? 0 };
      // mesma convenção dos Commands de GD01–GD03: AP/HP do modo Piloto também no próprio def
      def.ap = def.pilotMode.ap;
      def.hp = def.pilotMode.hp;
    }
  }
  if (effectKeywords.length) def.effectKeywords = effectKeywords;
  if (keywordTags.length) def.keywordTags = keywordTags;
  if (triggers.length) def.triggerKeywords = triggers;
  if (triggers.includes("Burst")) def.hasBurst = true;
  return def;
}

function fileKey(def) {
  if (def.cardType === "UNIT") return `units${def.color[0].toUpperCase()}${def.color.slice(1)}`;
  return { PILOT: "pilots", COMMAND: "commands", BASE: "bases" }[def.cardType];
}
const EXPORT = (key) => key.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();

const cards = official.filter((c) => c.code.startsWith(`${SET}-`)).sort((a, b) => a.code.localeCompare(b.code));
if (!cards.length) {
  console.error(`nenhuma carta do ${SET} em data/gcg-official-cards.json`);
  process.exit(2);
}
const groups = new Map();
for (const card of cards) {
  const def = buildCardDef(card, statsByCode.get(card.code));
  const key = fileKey(def);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(def);
}

const outDir = args.out ? path.resolve(String(args.out)) : path.join(REPO, "src/modules/simulator/content", SET.toLowerCase());
const files = new Map();
for (const [key, defs] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
  const body = defs.map((d) => `  ${JSON.stringify(d.code)}: ${JSON.stringify(d, null, 2).replace(/\n/g, "\n  ")},`).join("\n");
  files.set(
    `${key}.ts`,
    `import type { CardDef } from "../../engine/types";\n\n// Gerado por scripts/gundam-gen-carddefs.mjs --set=${SET} (texto oficial + stats do apitcg); autoria de efeito à mão por cima.\nexport const ${EXPORT(key)}: Record<string, CardDef> = {\n${body}\n};\n`,
  );
}

if (args.check) {
  let diff = 0;
  for (const [name, content] of files) {
    const p = path.join(outDir, name);
    if (!existsSync(p) || readFileSync(p, "utf8").replace(/\r\n/g, "\n") !== content) {
      console.log(`[gen-carddefs] diverge: ${path.relative(REPO, p)}`);
      diff++;
    }
  }
  console.log(`[gen-carddefs] ${SET}: ${cards.length} cartas, ${diff} arquivo(s) divergente(s)`);
  process.exit(diff ? 1 : 0);
}

if (existsSync(outDir) && !args.force) {
  console.error(`${path.relative(REPO, outDir)} já existe — autoria à mão por cima dos gerados. Use --force só em set novo.`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
for (const [name, content] of files) writeFileSync(path.join(outDir, name), content);
console.log(`[gen-carddefs] ${SET}: ${cards.length} cartas → ${[...files.keys()].join(", ")} em ${path.relative(REPO, outDir)}`);
