/*
 * Extrai as keywords de efeito oficiais (as 7 do Comprehensive Rules — Repair, Breach,
 * Support, Blocker, First Strike, High-Maneuver, Suppression) do texto de `effectEn`,
 * gravando em `keywordTags`. Hoje esse campo está fixo em `[]` desde o import original
 * (seed-apitcg.mjs nunca extraiu nada) — por isso "Cobertura por keywords" sempre
 * mostrava 0, mesmo pra cartas com keyword visível na própria arte.
 *
 * Fonte da lista de keywords: Comprehensive Rules oficial, seção 13 (Keyword Effects),
 * confirmado via busca em gundam-gcg.com em ago/2026 (7 keywords, sem mais nenhuma
 * documentada como "keyword effect" formal na versão vigente das regras).
 *
 * Guardamos só o NOME da keyword (ex: "Repair"), não o valor numérico (ex: não "Repair 2")
 * -- pra fins de sinergia/estatística o que importa é "esse card tem Repair", o valor
 * específico já está no texto do efeito pra quem quiser ler.
 *
 * Atualiza CardModel E Card (print) -- mesmo padrão do bug de series/sourceTitle que já
 * corrigimos antes nessa sessão: escrever só no model e esquecer do print (ou vice-versa)
 * quebra buscas/filtros que consultam o outro nível.
 *
 * Modos:
 *   node prisma/extract-keyword-effects.mjs              -> dry-run (padrão), imprime
 *      quantas cartas seriam afetadas e uma amostra, sem tocar no banco.
 *   node prisma/extract-keyword-effects.mjs --apply       -> aplica de verdade.
 */
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

// Ordem importa pouco aqui (cada keyword tem padrão proprio), mas manter a mesma ordem
// da secao 13 do Comprehensive Rules pra facilitar auditoria futura.
const KEYWORD_PATTERNS = [
  { name: "Repair", regex: /\bRepair\s+\d+\b/i },
  { name: "Breach", regex: /\bBreach\s+\d+\b/i },
  { name: "Support", regex: /\bSupport\s+\d+\b/i },
  { name: "Blocker", regex: /\bBlocker\b/i },
  { name: "First Strike", regex: /\bFirst Strike\b/i },
  { name: "High-Maneuver", regex: /\bHigh-Maneuver\b/i },
  { name: "Suppression", regex: /\bSuppression\b/i },
];

export function extractKeywords(effectText) {
  if (!effectText) return [];
  const found = [];
  for (const { name, regex } of KEYWORD_PATTERNS) {
    if (regex.test(effectText)) found.push(name);
  }
  return found;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const models = await prisma.cardModel.findMany({ where: { effectEn: { not: null } }, select: { id: true, code: true, effectEn: true, keywordTags: true } });
    const modelUpdates = models
      .map((m) => ({ id: m.id, code: m.code, next: extractKeywords(m.effectEn) }))
      .filter((m) => m.next.length > 0 && JSON.stringify(m.next) !== JSON.stringify([]));

    const prints = await prisma.card.findMany({ where: { effectEn: { not: null } }, select: { id: true, code: true, effectEn: true } });
    const printUpdates = prints
      .map((p) => ({ id: p.id, code: p.code, next: extractKeywords(p.effectEn) }))
      .filter((p) => p.next.length > 0);

    console.log(`CardModel com keyword detectada: ${modelUpdates.length} de ${models.length}`);
    console.log(`Card (print) com keyword detectada: ${printUpdates.length} de ${prints.length}`);
    console.log("\nAmostra (10 primeiras):");
    for (const m of modelUpdates.slice(0, 10)) console.log(`  ${m.code}: ${m.next.join(", ")}`);

    const tally = {};
    for (const m of modelUpdates) for (const k of m.next) tally[k] = (tally[k] || 0) + 1;
    console.log("\nContagem por keyword (nível modelo):");
    for (const [k, count] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${count}`);

    if (APPLY) {
      console.log("\nAplicando...");
      for (const m of modelUpdates) await prisma.cardModel.update({ where: { id: m.id }, data: { keywordTags: m.next } });
      for (const p of printUpdates) await prisma.card.update({ where: { id: p.id }, data: { keywordTags: p.next } });
      console.log(`Aplicado: ${modelUpdates.length} CardModel + ${printUpdates.length} Card atualizados.`);
    } else {
      console.log("\nDry-run (padrão) -- nada foi gravado. Rode com --apply pra aplicar de verdade.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] === fileURLToPathSafe(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

function fileURLToPathSafe(url) {
  try { return new URL(url).pathname; } catch { return url; }
}
