/**
 * Auditoria de higiene do catálogo (Demanda 11 — parcial).
 *
 * Compara o texto de efeito EN oficial (data/gcg-official-cards.json) com as
 * traduções locais (data/translations-st01-04.json) e procura divergências de
 * FORMATO no campo de efeito:
 *
 *   - gatilho meia-largura `[X]` onde o oficial usa `【X】`
 *   - `<br>` onde o padrão é `\n`
 *   - texto pt-BR vazando no campo EN oficial
 *   - separador de gatilho inconsistente (`･` U+FF65 vs `・` U+30FB)
 *   - keyword fora do padrão `<X>` (ex.: `[Repair]`, `(Blocker)`)
 *   - tradução (effectPt) fora de paridade estrutural com effectEn
 *
 * Saída: docs/_generated/catalog-audit.md (tabela code | campo | problema |
 * valor atual | sugestão).
 *
 * Escopo de correção automática: NENHUMA. O script só relata. Divergências de
 * ST01–ST04 nos arquivos .json locais devem ser corrigidas à mão (estão no
 * escopo da lane); GD/EB e o que só existe no Postgres ficam apenas registrados.
 *
 * Postgres (opcional, NÃO obrigatório): se `DATABASE_URL` estiver setada e o
 * pacote `pg` disponível, lê o texto de efeito do banco e compara também — mas
 * nunca escreve nada no banco.
 *
 * Uso: pnpm catalog:audit
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const officialPath = fileURLToPath(new URL("../data/gcg-official-cards.json", import.meta.url));
const translationsPath = fileURLToPath(new URL("../data/translations-st01-04.json", import.meta.url));
const reportPath = fileURLToPath(new URL("../docs/_generated/catalog-audit.md", import.meta.url));

const KEYWORDS = ["Repair", "Breach", "Support", "Blocker", "First Strike", "High-Maneuver", "Suppression"];
const TRIGGER_WORDS = [
  "Main", "Action", "Burst", "Deploy", "Attack", "Destroyed", "Pilot",
  "Activate", "Once per Turn", "During Pair", "During Link", "When Paired",
  "When Linked", "Rush",
];

const HALF_WIDTH_DOT = "･"; // ･
const FULL_WIDTH_DOT = "・"; // ・

/** `[Main]`, `[Burst]`, `[Deploy]` etc. — gatilho escrito com colchete simples
 *  em vez de `【】`. Ignora `[Nome De Carta]` e `[Nome do Piloto]`, que usam
 *  colchete simples de propósito. */
const halfWidthTriggerRe = new RegExp(`\\[(?:${TRIGGER_WORDS.join("|")})(?:[ /･・][^\\]]*)?\\]`, "g");
const brTestRe = /<br\s*\/?>/i;
const ptLeakRe = /[ãõç]|\b(você|voce|não|nao|Unidade|Unidades|dano|escudo|aliada|inimiga)\b/;

function matchBr(text) {
  return text.match(/<br\s*\/?>/gi) ?? [];
}

/** Marcadores estruturais de um texto de efeito, pra comparar EN x PT. */
function markers(text) {
  return {
    triggers: text.match(/【[^】]+】/g) ?? [],
    keywords: text.match(/<[^>]+>/g) ?? [],
    nameRefs: text.match(/\[[^\]]+\]/g) ?? [],
    newlines: (text.match(/\n/g) ?? []).length,
    hasBr: brTestRe.test(text),
  };
}

const findings = [];
function add(code, field, problem, current, suggestion, scope) {
  findings.push({ code, field, problem, current: trim(current), suggestion: trim(suggestion), scope });
}
function trim(value) {
  const s = String(value ?? "").replace(/\n/g, "\\n");
  return s.length > 120 ? `${s.slice(0, 117)}…` : s;
}
function setOf(code) {
  return String(code || "").split("-")[0].toUpperCase();
}
function isSt01to04(code) {
  return /^ST0[1-4]$/.test(setOf(code));
}

function auditEffectFormat(code, field, effect, scope) {
  if (!effect) return;

  for (const match of effect.match(halfWidthTriggerRe) ?? []) {
    const inner = match.slice(1, -1);
    add(code, field, "gatilho com colchete simples", match, `【${inner}】`, scope);
  }
  for (const match of matchBr(effect)) {
    add(code, field, "quebra de linha com <br>", match, "\\n", scope);
  }
  if (effect.includes(FULL_WIDTH_DOT)) {
    add(code, field, `separador de gatilho ${FULL_WIDTH_DOT} (U+30FB)`, FULL_WIDTH_DOT, `${HALF_WIDTH_DOT} (U+FF65, padrão do restante do dataset)`, scope);
  }
  for (const kw of KEYWORDS) {
    const wrongBracket = new RegExp(`[\\[(]${kw}(?:\\s+\\d+)?[\\])]`);
    const m = effect.match(wrongBracket);
    if (m && !effect.includes(`<${kw}`)) {
      add(code, field, "keyword fora do padrão <X>", m[0], `<${kw}${/\d/.test(m[0]) ? " N" : ""}>`, scope);
    }
  }
}

function auditPtLeak(code, effect, scope) {
  if (effect && ptLeakRe.test(effect)) {
    add(code, "effect (EN oficial)", "texto pt-BR no campo EN", effect, "reverter para o texto EN oficial", scope);
  }
}

async function main() {
  const official = JSON.parse(await readFile(officialPath, "utf8"));
  const translations = JSON.parse(await readFile(translationsPath, "utf8"));
  const officialByCode = new Map(official.cards.map((card) => [card.code, card]));

  // --- 1. Todas as cartas oficiais: formato + vazamento de pt-BR ---
  for (const card of official.cards) {
    const scope = isSt01to04(card.code) ? "ST01-04 (local)" : `${setOf(card.code)} (só relato)`;
    auditEffectFormat(card.code, "effect (EN oficial)", card.effect, scope);
    auditPtLeak(card.code, card.effect, scope);
  }

  // --- 2. Traduções ST01-04 locais: paridade com o oficial + formato ---
  for (const entry of translations) {
    const scope = "ST01-04 (local)";
    const officialCard = officialByCode.get(entry.code);

    if (!officialCard) {
      add(entry.code, "translations-st01-04.json", "código sem correspondente no gcg-official-cards.json", entry.code, "conferir código", scope);
    } else if ((entry.effectEn ?? "").trim() !== (officialCard.effect ?? "").trim()) {
      add(entry.code, "effectEn", "effectEn diverge do efeito EN oficial", entry.effectEn, officialCard.effect, scope);
    }

    auditEffectFormat(entry.code, "effectEn", entry.effectEn, scope);
    auditEffectFormat(entry.code, "effectPt", entry.effectPt, scope);

    const en = markers(entry.effectEn ?? "");
    const pt = markers(entry.effectPt ?? "");
    if (JSON.stringify(en.triggers) !== JSON.stringify(pt.triggers)) {
      add(entry.code, "effectPt", "gatilhos 【】 não batem com effectEn", pt.triggers.join(" "), en.triggers.join(" "), scope);
    }
    if (JSON.stringify(en.keywords) !== JSON.stringify(pt.keywords)) {
      add(entry.code, "effectPt", "keywords <X> não batem com effectEn", pt.keywords.join(" "), en.keywords.join(" "), scope);
    }
    if (JSON.stringify(en.nameRefs) !== JSON.stringify(pt.nameRefs)) {
      add(entry.code, "effectPt", "referências [X] não batem com effectEn", pt.nameRefs.join(" "), en.nameRefs.join(" "), scope);
    }
    if (en.newlines !== pt.newlines) {
      add(entry.code, "effectPt", "número de quebras de linha diferente de effectEn", String(pt.newlines), String(en.newlines), scope);
    }
    const meaningful = (entry.effectEn ?? "").replace(/[【】<>()[\]･・\s\d.,/+-]/g, "").length > 8;
    if (meaningful && (entry.effectPt ?? "").trim() === (entry.effectEn ?? "").trim()) {
      add(entry.code, "effectPt", "effectPt idêntico ao EN (não traduzido)", entry.effectPt, "traduzir para pt-BR", scope);
    }
  }

  // --- 3. Postgres (opcional) ---
  let dbNote = "Postgres não consultado (DATABASE_URL ausente ou pacote `pg` indisponível). Nada foi lido nem escrito no banco.";
  if (process.env.DATABASE_URL) {
    try {
      const { default: pg } = await import("pg");
      const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const { rows } = await client.query(
        `SELECT code, effect FROM "Card" WHERE effect IS NOT NULL`,
      );
      for (const row of rows) {
        const scope = isSt01to04(row.code) ? "ST01-04 (Postgres — só relato, precisa confirmação do Willen)" : `${setOf(row.code)} (Postgres — só relato)`;
        auditEffectFormat(row.code, "Card.effect (Postgres)", row.effect, scope);
        auditPtLeak(row.code, row.effect, scope);
      }
      await client.end();
      dbNote = `Postgres consultado: ${rows.length} cartas com efeito lidas (somente leitura, nada aplicado).`;
    } catch (error) {
      dbNote = `Postgres não consultado: ${error.message}. Nada foi lido nem escrito no banco.`;
    }
  }

  await writeReport(findings, dbNote);

  const stLocal = findings.filter((f) => f.scope === "ST01-04 (local)");
  console.log(`Auditoria: ${findings.length} divergência(s) no total.`);
  console.log(`  ST01-04 (arquivos locais): ${stLocal.length}`);
  console.log(`  Outras (GD/EB/Postgres — só relato): ${findings.length - stLocal.length}`);
  console.log(`Relatório: docs/_generated/catalog-audit.md`);

  if (stLocal.length > 0) {
    console.error("\nFALHA: há divergências de ST01-04 nos arquivos locais que precisam de correção manual.");
    process.exit(1);
  }
}

async function writeReport(rows, dbNote) {
  const bySet = new Map();
  for (const row of rows) {
    const key = setOf(row.code);
    if (!bySet.has(key)) bySet.set(key, []);
    bySet.get(key).push(row);
  }

  const lines = [];
  lines.push("# Auditoria de higiene do catálogo");
  lines.push("");
  lines.push(`> Gerado por \`pnpm catalog:audit\` (scripts/gundam-audit-catalog.mjs) em ${new Date().toISOString()}.`);
  lines.push(">");
  lines.push("> Correção automática: nenhuma. ST01–ST04 nos arquivos `data/*.json` locais devem ser corrigidos à mão.");
  lines.push("> GD/EB e Postgres: apenas registrados — aplicar exige confirmação do Willen.");
  lines.push("");
  lines.push(`**${rows.length}** divergência(s). ${dbNote}`);
  lines.push("");

  const stLocal = rows.filter((r) => r.scope === "ST01-04 (local)");
  lines.push(`## ST01–ST04 (arquivos locais) — ${stLocal.length}`);
  lines.push("");
  if (stLocal.length === 0) {
    lines.push("Nenhuma divergência. `effectEn` bate com o EN oficial e `effectPt` está em paridade estrutural.");
    lines.push("");
  } else {
    lines.push(table(stLocal));
  }

  const others = [...bySet.keys()].filter((k) => !/^ST0[1-4]$/.test(k)).sort();
  lines.push(`## Outros conjuntos (GD/EB/ST05+ — só relato) — ${rows.length - stLocal.length}`);
  lines.push("");
  if (rows.length - stLocal.length === 0) {
    lines.push("Nada a registrar.");
    lines.push("");
  } else {
    for (const key of others) {
      const group = bySet.get(key).filter((r) => r.scope !== "ST01-04 (local)");
      if (!group.length) continue;
      lines.push(`### ${key} — ${group.length}`);
      lines.push("");
      lines.push(table(group));
    }
  }

  await mkdir(fileURLToPath(new URL("../docs/_generated", import.meta.url)), { recursive: true });
  await writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
}

function table(rows) {
  const header = "| code | campo | problema | valor atual | sugestão |\n|---|---|---|---|---|";
  const body = rows
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code) || a.field.localeCompare(b.field))
    .map((r) => `| ${r.code} | ${r.field} | ${r.problem} | \`${r.current}\` | \`${r.suggestion}\` |`)
    .join("\n");
  return `${header}\n${body}\n`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
