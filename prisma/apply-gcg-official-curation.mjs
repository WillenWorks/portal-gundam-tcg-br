/*
 * Curadoria oficial de série (Source Title) e relações Piloto -> Unidade, a partir de
 * data/gcg-official-cards.json — um espelho enxuto do site oficial gundam-gcg.com,
 * obtido via https://github.com/yzRobo/gcg-api (scrape semanal, dataset ODbL/CC0).
 *
 * O que este script faz:
 *   1. Série: para cada Card nosso cujo `code` bate com uma carta do dataset oficial,
 *      grava `series` e `sourceTitle` com o Source Title oficial (normalizado).
 *   2. Relações PILOT_OF: só cria relação quando a Unidade tem vínculo DIRETO por nome
 *      oficial (campo `link` = "[Nome do Piloto]"). Unidades com vínculo por trait
 *      (`link` = "(Trait) Trait") são propositalmente IGNORADAS aqui — esse tipo de
 *      vínculo é amplo (qualquer piloto com aquele trait linka) e já é coberto pela
 *      descoberta automática por trait que a página de detalhe da carta já mostra.
 *      Criar CardRelation pra isso misturaria "curadoria confirmada" com "sugestão
 *      automática", que o projeto trata como coisas distintas de propósito.
 *   3. Relações SUPPORTS (Commands): Command não tem campo `link` (0 de 145 usam).
 *      Em vez disso, procura no texto do `effect` por referência entre colchetes que
 *      bata com o nome EXATO de um Piloto ou Unidade oficial (ex: "Overcoming Hardships"
 *      cita "[Guel Jeturk]" no efeito). Só ~10 de 145 Commands têm esse padrão — o
 *      resto do texto de efeito é livre demais pra extrair com segurança, então fica
 *      de fora por enquanto (curadoria manual/híbrida, se for o caso).
 *   3. Broadcast por code: como um `code` pode ter várias impressões (reprint/promo/
 *      variante), a atualização de série e a relação de piloto são aplicadas a TODAS
 *      as impressões que compartilham o mesmo code — mecanicamente correto, já que o
 *      Link Condition do jogo verifica o nome do piloto, não a impressão específica.
 *
 * Modos:
 *   node prisma/apply-gcg-official-curation.mjs              -> dry-run (padrão).
 *      Não conecta no banco. Roda só com os arquivos locais (data/apitcg-gundam.json
 *      + data/gcg-official-cards.json), então funciona em qualquer ambiente, mesmo
 *      sem Postgres rodando. Imprime um relatório do que SERIA feito.
 *   node prisma/apply-gcg-official-curation.mjs --apply       -> aplica de verdade.
 *      Conecta via Prisma e grava no banco. Upsert idempotente — pode rodar quantas
 *      vezes quiser sem duplicar relações nem sujar dado.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const APPLY = process.argv.includes("--apply");

const officialPath = fileURLToPath(new URL("../data/gcg-official-cards.json", import.meta.url));
const ourDatasetPath = fileURLToPath(new URL("../data/apitcg-gundam.json", import.meta.url));

// --- normalização do Source Title (corrige variação de grafia do scrape e alinha com os
//     nomes já usados no projeto em prisma/apitcg-taxonomies.mjs) ---
const TITLE_FIXES = {
  "Mobile Suit Gundam IRON-BLOODED ORPHANS": "Mobile Suit Gundam: Iron-Blooded Orphans",
  "Mobile Suit Gundam SEED DESTINY": "Mobile Suit Gundam SEED Destiny",
  "Mobile Suit Gundam: Char's Counterattack": "Mobile Suit Gundam Char's Counterattack",
  "Mobile Suit V Gundam": "Mobile Suit Victory Gundam",
  "∀ Gundam": "Turn A Gundam",
  "Mobile Suit Z Gundam": "Mobile Suit Zeta Gundam",
};

export function normalizeSourceTitle(raw) {
  if (!raw || raw === "-") return null;
  let clean = raw.replace(/[\u2018\u2019\u201c\u201d]/g, "'").replace(/"/g, "'").trim();
  // linhas com bug de concatenação no scrape (vários títulos grudados numa carta genérica
  // tipo EX Resource/EX Base) — não dá pra confiar num valor ambíguo, melhor deixar nulo
  // e revisar manualmente do que gravar errado.
  if ((clean.match(/Mobile Suit Gundam/g) || []).length > 1 && clean.length > 55) return null;
  if (clean.startsWith("Mobile Suit Gundam Mobile Suit Gundam")) {
    clean = clean.replace("Mobile Suit Gundam Mobile Suit Gundam", "Mobile Suit Gundam").trim();
  }
  return TITLE_FIXES[clean] || clean;
}

async function loadOfficialCards() {
  const raw = JSON.parse(await readFile(officialPath, "utf8"));
  return raw.cards;
}

async function loadOurCodes() {
  const raw = JSON.parse(await readFile(ourDatasetPath, "utf8"));
  const cards = (raw.cards || []).filter((c) => c.attributes?.CardType);
  return new Set(cards.map((c) => c.code));
}

/** Monta as duas listas de trabalho a partir do dataset oficial: atualizações de série
 *  e candidatos a relação PILOT_OF (só vínculo direto por nome). */
function buildPlan(officialCards) {
  const seriesUpdates = []; // { code, sourceTitle }
  const seriesSkipped = []; // { code, name, rawSourceTitle } - ambíguo, precisa revisão manual

  const pilotNameToCodes = new Map(); // nome oficial do piloto -> [codes]
  const unitNameToCodes = new Map(); // nome oficial da unidade -> [codes]
  for (const c of officialCards) {
    if (c.cardType === "PILOT") {
      const list = pilotNameToCodes.get(c.name) || [];
      list.push(c.code);
      pilotNameToCodes.set(c.name, list);
    } else if (c.cardType === "UNIT") {
      const list = unitNameToCodes.get(c.name) || [];
      list.push(c.code);
      unitNameToCodes.set(c.name, list);
    }
  }

  const pilotUnitRelations = []; // { pilotCode, unitCode, unitName, pilotName, sourceUrl }
  const traitLinkedSkipped = []; // { unitCode, unitName, traitName } - deixado pra descoberta automática
  const commandSupportRelations = []; // { commandCode, targetCode, commandName, targetName, sourceUrl }

  for (const c of officialCards) {
    if (c.cardType === "COMMAND" && c.effect) {
      const refs = Array.from(c.effect.matchAll(/\[([^\]]+)\]/g), (m) => m[1].trim());
      for (const ref of refs) {
        const pilotCodes = pilotNameToCodes.get(ref);
        const unitCodes = unitNameToCodes.get(ref);
        for (const targetCode of pilotCodes || []) {
          commandSupportRelations.push({ commandCode: c.code, targetCode, commandName: c.name, targetName: ref, sourceUrl: c.detailUrl || null });
        }
        for (const targetCode of unitCodes || []) {
          commandSupportRelations.push({ commandCode: c.code, targetCode, commandName: c.name, targetName: ref, sourceUrl: c.detailUrl || null });
        }
      }
    }
  }

  for (const c of officialCards) {
    const normalized = normalizeSourceTitle(c.sourceTitle);
    if (normalized) {
      seriesUpdates.push({ code: c.code, sourceTitle: normalized });
    } else if (c.sourceTitle && c.sourceTitle !== "-") {
      seriesSkipped.push({ code: c.code, name: c.name, rawSourceTitle: c.sourceTitle });
    }

    if (c.cardType !== "UNIT" || !c.link || c.link === "-") continue;

    if (c.link.startsWith("[")) {
      const pilotName = c.linkRefs?.[0];
      if (!pilotName) continue;
      const pilotCodes = pilotNameToCodes.get(pilotName);
      if (!pilotCodes || !pilotCodes.length) {
        traitLinkedSkipped.push({ unitCode: c.code, unitName: c.name, traitName: `[nome não encontrado: ${pilotName}]` });
        continue;
      }
      for (const pilotCode of pilotCodes) {
        pilotUnitRelations.push({ pilotCode, unitCode: c.code, unitName: c.name, pilotName, sourceUrl: c.detailUrl || null });
      }
    } else if (c.link.startsWith("(")) {
      traitLinkedSkipped.push({ unitCode: c.code, unitName: c.name, traitName: c.linkRefs?.[0] || c.link });
    }
  }

  return { seriesUpdates, seriesSkipped, pilotUnitRelations, traitLinkedSkipped, commandSupportRelations };
}

async function dryRun() {
  const [officialCards, ourCodes] = await Promise.all([loadOfficialCards(), loadOurCodes()]);
  const { seriesUpdates, seriesSkipped, pilotUnitRelations, traitLinkedSkipped, commandSupportRelations } = buildPlan(officialCards);

  const matchedSeries = seriesUpdates.filter((u) => ourCodes.has(u.code));
  const matchedRelations = pilotUnitRelations.filter((r) => ourCodes.has(r.pilotCode) && ourCodes.has(r.unitCode));
  const unmatchedRelations = pilotUnitRelations.filter((r) => !(ourCodes.has(r.pilotCode) && ourCodes.has(r.unitCode)));
  const matchedCommandRelations = commandSupportRelations.filter((r) => ourCodes.has(r.commandCode) && ourCodes.has(r.targetCode));

  console.log("=== DRY-RUN — nada foi gravado no banco ===\n");
  console.log(`Cartas no dataset oficial: ${officialCards.length}`);
  console.log(`Codes conhecidos no nosso dataset: ${ourCodes.size}\n`);

  console.log(`Série: ${matchedSeries.length} codes seriam atualizados (de ${seriesUpdates.length} no oficial).`);
  if (seriesSkipped.length) {
    console.log(`Série: ${seriesSkipped.length} carta(s) com Source Title ambíguo no scrape, ficaram sem valor — revisar manualmente:`);
    for (const s of seriesSkipped) console.log(`   - ${s.code} ${s.name} | valor bruto: "${s.rawSourceTitle}"`);
  }

  console.log(`\nRelações PILOT_OF: ${matchedRelations.length} linhas de CardRelation seriam criadas (uma por par de CardModel — sem broadcast, já que a relação agora é por carta, não por impressão).`);
  if (unmatchedRelations.length) {
    console.log(`Relações PILOT_OF: ${unmatchedRelations.length} candidatas não bateram com nosso dataset (code de piloto ou unidade não encontrado) — amostra:`);
    for (const r of unmatchedRelations.slice(0, 10)) console.log(`   - ${r.pilotCode} (${r.pilotName}) -> ${r.unitCode} (${r.unitName})`);
  }

  console.log(`\nVínculos por trait (não viram CardRelation, ficam pra descoberta automática): ${traitLinkedSkipped.length}`);

  console.log(`\nRelações SUPPORTS (Command -> Piloto/Unidade citado no efeito): ${matchedCommandRelations.length} linhas de CardRelation seriam criadas.`);
  for (const r of matchedCommandRelations) {
    console.log(`   ${r.commandCode} (${r.commandName}) -> SUPPORTS -> ${r.targetCode} (${r.targetName})`);
  }

  console.log("\nAmostra de relações Piloto->Unidade que seriam aplicadas:");
  for (const r of matchedRelations.slice(0, 15)) {
    console.log(`   ${r.pilotCode} (${r.pilotName}) -> PILOT_OF -> ${r.unitCode} (${r.unitName})`);
  }
  if (matchedRelations.length > 15) console.log(`   ... e mais ${matchedRelations.length - 15}`);

  console.log("\nPra aplicar de verdade: node prisma/apply-gcg-official-curation.mjs --apply");
}

async function apply() {
  const { PrismaClient, CardRelationType } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const officialCards = await loadOfficialCards();
    const { seriesUpdates, seriesSkipped, pilotUnitRelations, traitLinkedSkipped, commandSupportRelations } = buildPlan(officialCards);

    console.log(`Cartas no dataset oficial: ${officialCards.length}`);

    // --- 1. série ---
    // Atualiza tanto a impressão (Card, mantido por compatibilidade/histórico) quanto o
    // CardModel — que é quem a busca e a exibição pública usam de verdade desde a
    // migração de Fase 1/2 (ver docs/13-migracao-cardmodel.md). Esse script nunca tinha
    // sido atualizado depois daquela migração — só gravava na impressão, então o
    // CardModel ficava com series/sourceTitle nulo pra sempre (o seed sempre zera os
    // dois como null, e nada mais os preenchia no nível certo).
    let seriesUpdated = 0;
    let seriesModelUpdated = 0;
    for (const u of seriesUpdates) {
      const [printResult, modelResult] = await Promise.all([
        prisma.card.updateMany({ where: { code: u.code, isActive: true }, data: { series: u.sourceTitle, sourceTitle: u.sourceTitle } }),
        prisma.cardModel.updateMany({ where: { code: u.code, isActive: true }, data: { series: u.sourceTitle, sourceTitle: u.sourceTitle } }),
      ]);
      seriesUpdated += printResult.count;
      seriesModelUpdated += modelResult.count;
    }
    console.log(`Série: ${seriesUpdated} impressões e ${seriesModelUpdated} cartas (CardModel) atualizadas (${seriesUpdates.length} codes oficiais processados).`);
    if (seriesSkipped.length) {
      console.log(`Série: ${seriesSkipped.length} carta(s) com Source Title ambíguo, não gravadas — revisar manualmente:`);
      for (const s of seriesSkipped) console.log(`   - ${s.code} ${s.name} | valor bruto: "${s.rawSourceTitle}"`);
    }

    // --- 2. relações PILOT_OF (agora por CardModel — uma linha por par, sem broadcast) ---
    let relationsCreated = 0;
    let relationsFailed = 0;
    for (const r of pilotUnitRelations) {
      const [sourceModel, targetModel] = await Promise.all([
        prisma.cardModel.findUnique({ where: { code: r.pilotCode }, select: { id: true } }),
        prisma.cardModel.findUnique({ where: { code: r.unitCode }, select: { id: true } }),
      ]);
      if (!sourceModel || !targetModel) { relationsFailed += 1; continue; }
      await prisma.cardRelation.upsert({
        where: { sourceModelId_targetModelId_relationType: { sourceModelId: sourceModel.id, targetModelId: targetModel.id, relationType: CardRelationType.PILOT_OF } },
        update: { isActive: true, deletedAt: null, sourceUrl: r.sourceUrl },
        create: {
          sourceModelId: sourceModel.id,
          targetModelId: targetModel.id,
          relationType: CardRelationType.PILOT_OF,
          notePt: "Vínculo oficial (Link Condition do jogo — gundam-gcg.com)",
          sourceUrl: r.sourceUrl,
        },
      });
      relationsCreated += 1;
    }
    console.log(`Relações PILOT_OF: ${relationsCreated} criadas/atualizadas. ${relationsFailed} candidatas sem CardModel correspondente (rode a migração de dado — prisma/migrate-card-model-data.mjs — antes de aplicar).`);
    console.log(`Vínculos por trait (deixados pra descoberta automática, não viraram relação): ${traitLinkedSkipped.length}`);

    // --- 3. relações SUPPORTS (Command -> Piloto/Unidade citado no efeito) ---
    let supportsCreated = 0;
    let supportsFailed = 0;
    for (const r of commandSupportRelations) {
      const [sourceModel, targetModel] = await Promise.all([
        prisma.cardModel.findUnique({ where: { code: r.commandCode }, select: { id: true } }),
        prisma.cardModel.findUnique({ where: { code: r.targetCode }, select: { id: true } }),
      ]);
      if (!sourceModel || !targetModel) { supportsFailed += 1; continue; }
      await prisma.cardRelation.upsert({
        where: { sourceModelId_targetModelId_relationType: { sourceModelId: sourceModel.id, targetModelId: targetModel.id, relationType: CardRelationType.SUPPORTS } },
        update: { isActive: true, deletedAt: null, sourceUrl: r.sourceUrl },
        create: {
          sourceModelId: sourceModel.id,
          targetModelId: targetModel.id,
          relationType: CardRelationType.SUPPORTS,
          notePt: "Vínculo oficial (carta citada no texto do efeito — gundam-gcg.com)",
          sourceUrl: r.sourceUrl,
        },
      });
      supportsCreated += 1;
    }
    console.log(`Relações SUPPORTS (Command): ${supportsCreated} criadas/atualizadas. ${supportsFailed} candidatas sem CardModel correspondente.`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (APPLY) {
    await apply();
  } else {
    await dryRun();
  }
}

// Só roda main() quando o arquivo é executado direto (node prisma/apply-...mjs),
// não quando é importado por outro módulo — como os testes, que só querem
// normalizeSourceTitle/buildPlan sem disparar o dry-run inteiro como efeito colateral.
// Usa pathToFileURL (não comparação de string manual) pra funcionar igual no Windows,
// onde import.meta.url vem como "file:///C:/..." e process.argv[1] como "C:\\...".
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
