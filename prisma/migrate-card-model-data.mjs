/*
 * Fase "expand" da migração CardModel/Card (ver docs/13-migracao-cardmodel.md).
 *
 * Pré-requisito: já ter rodado a migration de schema que ADICIONA CardModel e as
 * colunas novas (cardModelId em Card e Ruling, isPrimaryPrint/printLabel em Card,
 * sourceModelId/targetModelId em CardRelation) — nada é removido nessa fase.
 *
 * O que este script faz, em ordem, tudo idempotente (pode rodar de novo sem duplicar):
 *   1. Agrupa todas as impressões (Card) ativas por `code`. Cria 1 CardModel por code,
 *      copiando os campos de identidade de jogo (nome, efeito, stats, traits...) da
 *      impressão "regular" do grupo (heurística: raridade sem +/++/Promo/Winner/Judge/SP —
 *      mesma lógica já usada em CardDetailPage.tsx). Se um code não tiver nenhuma
 *      impressão "regular", usa a mais antiga (createdAt) como fallback.
 *   2. Marca essa impressão escolhida como isPrimaryPrint = true.
 *   3. Preenche Card.cardModelId em toda impressão do grupo.
 *   4. Preenche Ruling.cardModelId a partir do Ruling.cardId existente (preserva
 *      qualquer associação de ruling já cadastrada manualmente).
 *   5. AVISA sobre CardRelation: essa tabela não é migrada aqui — o schema novo já
 *      exige sourceModelId/targetModelId (não existiam antes), então a tabela fica
 *      vazia após a migration de schema. Isso é esperado e seguro: CardRelation é
 *      100% dado derivado do dataset oficial (prisma/apply-gcg-official-curation.mjs),
 *      não dado de usuário — repopula rodando esse script depois que o back-end for
 *      atualizado pra usar as colunas novas (fase 2, ainda não feita).
 *
 * Uso:
 *   node prisma/migrate-card-model-data.mjs             # dry-run (padrão), não grava nada
 *   node prisma/migrate-card-model-data.mjs --apply      # aplica de verdade
 */
import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";

const APPLY = process.argv.includes("--apply");
const ALT_ART_RARITY_PATTERN = /\+|Promo|Winner|Judge|SP/i;
const isAltArtRarity = (rarity) => ALT_ART_RARITY_PATTERN.test(rarity || "");

const MODEL_FIELDS = [
  "nameEn", "namePt", "cardType", "cardSubtypes", "color", "level", "cost", "ap", "hp",
  "trait", "traits", "series", "sourceTitle", "zone", "linkText", "pilotName",
  "effectEn", "effectPt", "triggerKeywords", "keywordTags", "effectKeywords",
  "textSectionsJson", "hasBurst", "hasMain", "hasAction", "oncePerTurn", "legalityStatus",
];

export function pickRepresentativePrint(prints) {
  // Sinal principal: o nome BRUTO de uma impressão alternativa/promocional sempre carrega
  // um sufixo entre parênteses (ex: "A Show of Resolve (U+)", "Ball (Judge Pack 02)",
  // "Cagalli Yula Athha (Championship Participation Pack 01)") — a impressão regular nunca
  // tem parênteses no nome. Isso resolve 100% dos 477 codes multi-impressão testados,
  // diferente de olhar só a raridade (que não sinaliza promo quando o texto da raridade em
  // si não muda, ex: "Ball (Judge Pack 02)" tem raridade "Common", igual à regular).
  const semParenteses = prints.filter((p) => !p.nameEn.includes("("));
  if (semParenteses.length === 1) return semParenteses[0];
  if (semParenteses.length > 1) {
    // Mais de uma "sem parênteses" (ex: mesma carta reimpressa em produto diferente,
    // tipo Deathscythe saindo em booster e também no Deck Build Box) — usa raridade
    // como desempate secundário, e por fim a mais antiga entre as candidatas restantes.
    const regulares = semParenteses.filter((p) => !isAltArtRarity(p.rarity));
    const candidatas = regulares.length ? regulares : semParenteses;
    return candidatas.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  }
  // Nenhuma impressão sem parênteses no nome — cai pro critério antigo de raridade,
  // e por fim a mais antiga.
  const regular = prints.find((p) => !isAltArtRarity(p.rarity));
  if (regular) return regular;
  return [...prints].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
}

/** Checa se os campos de identidade de jogo realmente batem entre as impressões do
 *  mesmo code — se não baterem, é sinal de problema de dado que merece revisão manual,
 *  não deveria ser resolvido silenciosamente pegando qualquer valor. */
function findFieldMismatches(prints, representative) {
  const mismatches = [];
  for (const field of MODEL_FIELDS) {
    const repValue = JSON.stringify(representative[field]);
    for (const print of prints) {
      if (print.id === representative.id) continue;
      if (JSON.stringify(print[field]) !== repValue) {
        mismatches.push({ code: representative.code, field, printId: print.id });
      }
    }
  }
  return mismatches;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const cards = await prisma.card.findMany({ where: { isActive: true } });
    const byCode = new Map();
    for (const card of cards) {
      const list = byCode.get(card.code) || [];
      list.push(card);
      byCode.set(card.code, list);
    }

    console.log(`${APPLY ? "APLICANDO" : "DRY-RUN"} — ${byCode.size} codes únicos, ${cards.length} impressões ativas.\n`);

    let mismatchCount = 0;
    let modelsToCreate = 0;
    let modelsExisting = 0;
    const allMismatches = [];

    const existingModels = await prisma.cardModel.findMany({ select: { code: true, id: true } });
    const existingByCode = new Map(existingModels.map((m) => [m.code, m.id]));

    for (const [code, prints] of byCode) {
      const representative = pickRepresentativePrint(prints);
      const mismatches = findFieldMismatches(prints, representative);
      if (mismatches.length) {
        mismatchCount += 1;
        allMismatches.push(...mismatches);
      }

      let cardModelId = existingByCode.get(code);
      if (cardModelId) {
        modelsExisting += 1;
      } else {
        modelsToCreate += 1;
        if (APPLY) {
          const data = Object.fromEntries(MODEL_FIELDS.map((field) => [field, representative[field]]));
          const created = await prisma.cardModel.create({ data: { code, ...data } });
          cardModelId = created.id;
        }
      }

      if (APPLY && cardModelId) {
        await prisma.card.updateMany({ where: { code }, data: { cardModelId, isPrimaryPrint: false } });
        await prisma.card.update({ where: { id: representative.id }, data: { isPrimaryPrint: true } });
      }
    }

    console.log(`CardModel: ${modelsToCreate} seriam criados, ${modelsExisting} já existentes.`);
    console.log(`Codes com divergência de campo entre impressões (revisar manualmente): ${mismatchCount}`);
    if (allMismatches.length) {
      console.log("Amostra de divergências:");
      for (const m of allMismatches.slice(0, 15)) console.log(`   - ${m.code} | campo "${m.field}" diverge na impressão ${m.printId}`);
      if (allMismatches.length > 15) console.log(`   ... e mais ${allMismatches.length - 15}`);
    }

    // Rulings
    const rulingsToMigrate = await prisma.ruling.findMany({ where: { cardId: { not: null }, cardModelId: null } });
    console.log(`\nRulings com cardId preenchido e cardModelId ainda vazio: ${rulingsToMigrate.length}`);
    let rulingsMigrated = 0;
    let rulingsSkipped = 0;
    for (const ruling of rulingsToMigrate) {
      const card = cards.find((c) => c.id === ruling.cardId);
      if (!card) { rulingsSkipped += 1; continue; }
      const cardModelId = existingByCode.get(card.code);
      if (!cardModelId && !APPLY) { rulingsSkipped += 1; continue; }
      if (APPLY) {
        const modelId = cardModelId || (await prisma.cardModel.findUnique({ where: { code: card.code }, select: { id: true } }))?.id;
        if (!modelId) { rulingsSkipped += 1; continue; }
        await prisma.ruling.update({ where: { id: ruling.id }, data: { cardModelId: modelId } });
      }
      rulingsMigrated += 1;
    }
    console.log(`Rulings migradas: ${rulingsMigrated}. Sem CardModel correspondente (revisar): ${rulingsSkipped}`);

    console.log("\nCardRelation: não migrada aqui — é dado derivado, repopule com prisma/apply-gcg-official-curation.mjs --apply depois que o back-end for atualizado pra usar sourceModelId/targetModelId (fase 2).");

    if (!APPLY) console.log("\nNada foi gravado (dry-run). Rode com --apply pra aplicar de verdade.");
  } finally {
    await prisma.$disconnect();
  }
}

// Só roda main() quando o arquivo é executado direto — não quando um teste importa
// pickRepresentativePrint (mesmo padrão de prisma/apply-gcg-official-curation.mjs).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
