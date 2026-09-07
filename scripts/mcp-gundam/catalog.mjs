/*
 * Grupo `catalog` do MCP `gundam` (docs/44, Fase 1 — §3.1).
 *
 * Fontes:
 *   - `data/gcg-official-cards.json` — texto oficial EN + stats de todo o dataset.
 *   - fixtures `src/modules/simulator/fixtures/st0{1..4}Deck.ts` — `CardDef` do motor.
 *   - `ALL_EFFECT_SPECS` — EffectSpecs autorados (cobertura bespoke).
 *   - Postgres via Prisma — OPCIONAL: se o client não estiver gerado / sem DB,
 *     degrada com `{ available: false }` em vez de quebrar.
 *   - `docs/17-glossario-traducao.md` — glossário de tradução.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { rankSimilarSpecs } from "./similar-specs.mjs";
import { buildSignatures, INDEX_PATH } from "../gundam-index.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const sim = (p) => pathToFileURL(path.join(ROOT, "src/modules/simulator", p)).href;

const [{ ALL_EFFECT_SPECS }, st01, st02, st03, st04] = await Promise.all([
  import(sim("content/index.ts")),
  import(sim("fixtures/st01Deck.ts")),
  import(sim("fixtures/st02Deck.ts")),
  import(sim("fixtures/st03Deck.ts")),
  import(sim("fixtures/st04Deck.ts")),
]);

const OFFICIAL = JSON.parse(fs.readFileSync(path.join(ROOT, "data/gcg-official-cards.json"), "utf-8"));
const OFFICIAL_ARR = Array.isArray(OFFICIAL) ? OFFICIAL : OFFICIAL.cards ?? OFFICIAL.data ?? [];
const OFFICIAL_BY_CODE = new Map(OFFICIAL_ARR.map((c) => [c.code, c]));

/** `Map<code, CardDef>` das 4 fixtures ST01-04 (deck principal + tokens exportados). */
const FIXTURE_BY_CODE = new Map();
for (const [mod, buildList] of [
  [st01, st01.buildSt01DeckList],
  [st02, st02.buildSt02DeckList],
  [st03, st03.buildSt03DeckList],
  [st04, st04.buildSt04DeckList],
]) {
  for (const def of buildList().main) if (!FIXTURE_BY_CODE.has(def.code)) FIXTURE_BY_CODE.set(def.code, def);
  for (const v of Object.values(mod)) {
    if (v && typeof v === "object" && typeof v.code === "string" && typeof v.cardType === "string" && !FIXTURE_BY_CODE.has(v.code)) {
      FIXTURE_BY_CODE.set(v.code, v);
    }
  }
}

const SPECS_BY_CODE = new Map();
for (const spec of ALL_EFFECT_SPECS) {
  if (!SPECS_BY_CODE.has(spec.cardCode)) SPECS_BY_CODE.set(spec.cardCode, []);
  SPECS_BY_CODE.get(spec.cardCode).push(spec);
}

function coverageStatus(code) {
  const official = OFFICIAL_BY_CODE.get(code);
  const specs = SPECS_BY_CODE.get(code) ?? [];
  const def = FIXTURE_BY_CODE.get(code);
  const hasEffectText = !!(official?.effect && official.effect.trim());
  // cobertura bespoke: EffectSpec autorado OU campo estruturado do motor no
  // CardDef (staticAbilities / combatTriggers / attackTargetRules / link).
  const structured = !!def && (def.staticAbilities?.length || def.combatTriggers?.length || def.attackTargetRules);
  if (specs.length > 0 || structured) return "effectSpec";
  if (!hasEffectText) return "vanilla";
  const bespoke = /【(Deploy|Burst|Attack|Destroyed|When Paired|When Linked|Activate|Main|Action|During)/.test(official.effect);
  return bespoke ? "faltando" : "vanilla";
}

export function getCard(code) {
  const norm = String(code).trim().toUpperCase();
  const official = OFFICIAL_BY_CODE.get(norm) ?? null;
  const fixtureDef = FIXTURE_BY_CODE.get(norm) ?? null;
  const specs = SPECS_BY_CODE.get(norm) ?? [];
  if (!official && !fixtureDef && specs.length === 0) {
    return { code: norm, found: false, hint: "código não está no dataset oficial nem nas fixtures ST01-04" };
  }
  return {
    code: norm,
    found: true,
    coverage: coverageStatus(norm),
    official,
    cardDef: fixtureDef,
    effectSpecs: specs,
    inSimulatorFixtures: !!fixtureDef,
  };
}

// ---------------------------------------------------------------------------
// Glossário
// ---------------------------------------------------------------------------

const GLOSSARY_PATH = path.join(ROOT, "docs/17-glossario-traducao.md");
const GLOSSARY_TEXT = fs.existsSync(GLOSSARY_PATH) ? fs.readFileSync(GLOSSARY_PATH, "utf-8") : "";

export function searchGlossary(term) {
  const needle = String(term).trim().toLowerCase();
  if (!needle) return { term, matches: [] };
  const lines = GLOSSARY_TEXT.split("\n");
  const matches = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(needle)) {
      matches.push({ line: i + 1, text: lines[i].trim(), context: lines.slice(Math.max(0, i - 1), i + 2).map((l) => l.trim()) });
    }
  }
  return { term, count: matches.length, matches: matches.slice(0, 25) };
}

// ---------------------------------------------------------------------------
// Cobertura
// ---------------------------------------------------------------------------

export function coverage(set) {
  const wanted = set ? String(set).trim().toUpperCase() : null;
  const rows = [];
  const bySet = new Map();
  for (const card of OFFICIAL_ARR) {
    const setCode = card.setCode ?? card.code.split("-")[0];
    if (wanted && setCode !== wanted) continue;
    const status = coverageStatus(card.code);
    rows.push({ code: card.code, name: card.name, cardType: card.cardType, set: setCode, status, inFixtures: FIXTURE_BY_CODE.has(card.code) });
    if (!bySet.has(setCode)) bySet.set(setCode, { set: setCode, total: 0, effectSpec: 0, vanilla: 0, faltando: 0 });
    const agg = bySet.get(setCode);
    agg.total++;
    agg[status]++;
  }
  return {
    set: wanted,
    summary: [...bySet.values()].sort((a, b) => a.set.localeCompare(b.set)),
    cards: wanted ? rows.sort((a, b) => a.code.localeCompare(b.code)) : undefined,
    note: "status: effectSpec = tem EffectSpec autorado; vanilla = sem texto bespoke (motor cobre); faltando = texto bespoke sem EffectSpec",
  };
}

// ---------------------------------------------------------------------------
// RAG de autoria — specs parecidos por mecânica (docs/44 §6.1)
// ---------------------------------------------------------------------------

/**
 * Assinaturas do índice local `content/_index/specs-signatures.json` (gerado por
 * `pnpm gundam:index`, versionado). Se o arquivo não existir / estiver ilegível,
 * regenera na hora a partir de `ALL_EFFECT_SPECS` — o ranking nunca depende do
 * artefato estar em dia.
 */
function loadSignatures() {
  try {
    const raw = fs.readFileSync(INDEX_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // cai no fallback abaixo
  }
  return buildSignatures(ALL_EFFECT_SPECS);
}

export function similarSpecs(effectEn, limit = 3) {
  const text = String(effectEn ?? "").trim();
  if (!text) {
    return { query: text, count: 0, results: [], hint: "passe o texto EN do efeito da carta nova" };
  }
  const { query, queryTokens, count, results } = rankSimilarSpecs(loadSignatures(), text, limit);
  return {
    query,
    queryTokens,
    count,
    results: results.map(({ id, cardCode, trigger, sourceText, score, ops }) => ({
      id,
      cardCode,
      trigger,
      sourceText,
      score,
      ops,
    })),
    note: "score = peso dos n-gramas de mecânica em comum + 0.5 por trigrama literal; reaproveite op/targetScope/predicate do resultado #1",
  };
}

// ---------------------------------------------------------------------------
// Prisma (opcional)
// ---------------------------------------------------------------------------

let prismaClientPromise;
export async function getCardFromPostgres(code) {
  if (!prismaClientPromise) {
    prismaClientPromise = (async () => {
      try {
        const { PrismaClient } = await import("@prisma/client");
        return new PrismaClient();
      } catch (err) {
        return { __unavailable: err instanceof Error ? err.message : String(err) };
      }
    })();
  }
  const client = await prismaClientPromise;
  if (client.__unavailable) return { available: false, reason: `Prisma client indisponível: ${client.__unavailable}` };
  try {
    const model = await client.cardModel.findUnique({ where: { code: String(code).trim().toUpperCase() } });
    return { available: true, model };
  } catch (err) {
    return { available: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
