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
import { pathToFileURL } from "node:url";

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

// Keywords de GATILHO (quando o efeito ativa, nao o que ele faz) -- lista oficial tem
// tambem "Attack" e "Destroyed" soltos, mas essas duas palavras aparecem demais em
// texto de efeito comum fora do papel de keyword ("when this Unit attacks",
// "if this Unit is destroyed" como condicao, nao como marcador formal) -- risco de
// falso positivo alto demais pra regex simples sem mais exemplo real pra calibrar.
// "Attack" so entra quando vem logo depois de "During Link"/"During Pair" (padrao
// visto nos cards reais dessa sessao: badges concatenados sem separador no inicio do
// texto). "Destroyed" fica de fora por enquanto -- fica documentado, nao e esquecimento.
const TRIGGER_KEYWORD_PATTERNS = [
  { name: "Deploy", regex: /\bDeploy\b/i },
  { name: "Burst", regex: /\[Burst\]|\bBurst\b/i },
  { name: "Once per Turn", regex: /\bOnce per Turn\b/i },
  { name: "During Link", regex: /\bDuring Link\b/i },
  { name: "During Pair", regex: /\bDuring Pair\b/i },
  { name: "When Paired", regex: /\bWhen Paired\b/i },
  { name: "Attack", regex: /\bDuring (?:Link|Pair)\s+Attack\b/i },
  { name: "Activate", regex: /\bActivate[·:]/i },
];

export function extractTriggerKeywords(effectText) {
  if (!effectText) return [];
  const found = [];
  for (const { name, regex } of TRIGGER_KEYWORD_PATTERNS) {
    if (regex.test(effectText)) found.push(name);
  }
  return found;
}

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
    const models = await prisma.cardModel.findMany({ where: { effectEn: { not: null } }, select: { id: true, code: true, effectEn: true } });
    const modelUpdates = models
      .map((m) => ({ id: m.id, code: m.code, keywordTags: extractKeywords(m.effectEn), triggerKeywords: extractTriggerKeywords(m.effectEn) }))
      .filter((m) => m.keywordTags.length > 0 || m.triggerKeywords.length > 0);

    const prints = await prisma.card.findMany({ where: { effectEn: { not: null } }, select: { id: true, code: true, effectEn: true } });
    const printUpdates = prints
      .map((p) => ({ id: p.id, code: p.code, keywordTags: extractKeywords(p.effectEn), triggerKeywords: extractTriggerKeywords(p.effectEn) }))
      .filter((p) => p.keywordTags.length > 0 || p.triggerKeywords.length > 0);

    console.log(`CardModel com keyword de efeito e/ou gatilho detectada: ${modelUpdates.length} de ${models.length}`);
    console.log(`Card (print) com keyword de efeito e/ou gatilho detectada: ${printUpdates.length} de ${prints.length}`);
    console.log("\nAmostra (10 primeiras):");
    for (const m of modelUpdates.slice(0, 10)) console.log(`  ${m.code}: efeito=[${m.keywordTags.join(", ")}] gatilho=[${m.triggerKeywords.join(", ")}]`);

    const tallyEffect = {};
    const tallyTrigger = {};
    for (const m of modelUpdates) {
      for (const k of m.keywordTags) tallyEffect[k] = (tallyEffect[k] || 0) + 1;
      for (const k of m.triggerKeywords) tallyTrigger[k] = (tallyTrigger[k] || 0) + 1;
    }
    console.log("\nContagem por keyword de EFEITO (nível modelo):");
    for (const [k, count] of Object.entries(tallyEffect).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${count}`);
    console.log("\nContagem por keyword de GATILHO (nível modelo):");
    for (const [k, count] of Object.entries(tallyTrigger).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${count}`);

    if (APPLY) {
      console.log("\nAplicando...");
      for (const m of modelUpdates) await prisma.cardModel.update({ where: { id: m.id }, data: { keywordTags: m.keywordTags, triggerKeywords: m.triggerKeywords } });
      for (const p of printUpdates) await prisma.card.update({ where: { id: p.id }, data: { keywordTags: p.keywordTags, triggerKeywords: p.triggerKeywords } });
      console.log(`Aplicado: ${modelUpdates.length} CardModel + ${printUpdates.length} Card atualizados.`);
    } else {
      console.log("\nDry-run (padrão) -- nada foi gravado. Rode com --apply pra aplicar de verdade.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

// process.argv[1] === import.meta.url direto quebra no Windows: import.meta.url vem
// como "file:///C:/..." e process.argv[1] como "C:\\..." (barra invertida, sem
// file://, sem a barra extra antes da letra do drive) -- as duas strings nunca batem,
// entao main() nunca era chamado, sem erro nenhum, sem log nenhum (exatamente o
// sintoma reportado: script "roda" e nao faz nada). Mesmo problema ja resolvido antes
// em apply-gcg-official-curation.mjs -- devia ter reaproveitado o padrao de la desde
// o inicio em vez de escrever um novo (com bug).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
