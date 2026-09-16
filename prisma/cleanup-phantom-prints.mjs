/*
 * Remove prints "fantasma" -- Card (impressao) sem nenhuma imagem E com raridade que
 * o pipeline atual (seed-apitcg.mjs + curation) nunca produz. Achado analisando exemplos
 * reais (GD01-001, GD01-090, GD01-099, GD01-129, R-002, T-011): cada um tinha uma
 * impressao extra sem arte, com raridade abreviada ("R", "U") ou literalmente o
 * cardType no lugar da raridade ("RESOURCE", "TOKEN"). Nenhuma das duas fontes de
 * dado atuais (apitcg-gundam.json, gcg-official-cards.json) produz esses valores --
 * rastreei ate scripts/catalog-import.mjs, que existe no package.json (catalog:import,
 * catalog:import:local) mas NAO faz parte da cadeia catalog:bootstrap. Foi rodado
 * manualmente uma vez no passado (antes do pipeline atual existir) e deixou esses
 * residuos no banco -- nao vai acontecer de novo num catalog:bootstrap novo, mas o
 * banco que ja tem esses residuos precisa de limpeza manual.
 *
 * Criterio de deteccao (as DUAS condicoes precisam ser verdade, de proposito
 * conservador -- prefere deixar passar um residuo real a apagar uma carta legitima
 * por engano):
 *   1. Sem NENHUMA imagem (imageUrl E imageMediumUrl nulos)
 *   2. Raridade fora da lista que o pipeline atual realmente produz
 *
 * Alem da deteccao heuristica acima (so reporta), o script agora CORRIGE os 6
 * fantasmas verificados manualmente (TARGET_CODES): pra cada um, acha a impressao
 * REAL do mesmo CardModel (ou mesmo `code`, se `cardModelId` faltar) que TEM
 * imageUrl, migra qualquer DeckItem/CardBinderItem que apontava pro fantasma pra
 * impressao real (mesclando quantidade se a impressao real ja estiver no mesmo
 * deck/binder -- evita violar a unique key), promove a impressao real a
 * `isPrimaryPrint: true` (e rebaixa qualquer outra do mesmo CardModel) e só
 * então apaga o fantasma. Se não achar substituto real, NÃO apaga (ficaria um
 * CardModel sem nenhuma impressão).
 *
 * Modos:
 *   node prisma/cleanup-phantom-prints.mjs           -> dry-run (padrao)
 *   node prisma/cleanup-phantom-prints.mjs --apply   -> aplica de verdade
 */
import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";

const APPLY = process.argv.includes("--apply");

// Toda raridade que o pipeline atual (seed-apitcg.mjs, lendo attributes.Rarity do
// apitcg-gundam.json) realmente produz -- levantado direto do dataset fonte.
const VALID_RARITIES = new Set(["C+", "C++", "Common", "LR+", "LR++", "Legend Rare", "Promo", "R+", "Rare", "U+", "Uncommon"]);

// Os 6 fantasmas verificados manualmente (docs desta limpeza) -- ver cabecalho.
const TARGET_CODES = ["GD01-001", "GD01-090", "GD01-099", "GD01-129", "R-002", "T-011"];

/** Acha a impressao REAL (com imageUrl) do mesmo CardModel do fantasma -- ou,
 *  na falta de cardModelId, do mesmo `code`. `null` se não achar substituto. */
async function findRealPrint(prisma, phantom) {
  const where = phantom.cardModelId
    ? { cardModelId: phantom.cardModelId, id: { not: phantom.id }, imageUrl: { not: null } }
    : { code: phantom.code, id: { not: phantom.id }, imageUrl: { not: null } };
  return prisma.card.findFirst({ where, orderBy: { createdAt: "asc" } });
}

/** Monta o plano de ações (migrar DeckItem/CardBinderItem, promover, apagar) pra
 *  1 fantasma -- puro, não toca o banco. `apply()` executa o plano depois. */
async function planFix(prisma, phantom) {
  const realPrint = await findRealPrint(prisma, phantom);
  if (!realPrint) {
    return { phantom, realPrint: null, actions: [] };
  }

  const actions = [];
  const [deckItems, binderItems] = await Promise.all([
    prisma.deckItem.findMany({ where: { cardId: phantom.id } }),
    prisma.cardBinderItem.findMany({ where: { cardId: phantom.id } }),
  ]);

  for (const di of deckItems) {
    const clash = await prisma.deckItem.findUnique({
      where: { deckId_cardId_section: { deckId: di.deckId, cardId: realPrint.id, section: di.section } },
    });
    if (clash) {
      actions.push({ type: "merge-deckItem", from: di.id, into: clash.id, addQty: di.quantity, deckId: di.deckId });
    } else {
      actions.push({ type: "repoint-deckItem", id: di.id, cardId: realPrint.id, deckId: di.deckId });
    }
  }

  for (const bi of binderItems) {
    const clash = await prisma.cardBinderItem.findUnique({
      where: { binderId_cardId: { binderId: bi.binderId, cardId: realPrint.id } },
    });
    if (clash) {
      actions.push({ type: "merge-binderItem", from: bi.id, into: clash.id, addQty: bi.quantity, binderId: bi.binderId });
    } else {
      actions.push({ type: "repoint-binderItem", id: bi.id, cardId: realPrint.id, binderId: bi.binderId });
    }
  }

  actions.push({ type: "promote", cardId: realPrint.id, cardModelId: realPrint.cardModelId });
  actions.push({ type: "delete-phantom", cardId: phantom.id });
  return { phantom, realPrint, actions };
}

function describeAction(a) {
  switch (a.type) {
    case "merge-deckItem":
      return `  DeckItem ${a.from} (deck ${a.deckId}) -- ja existe pra impressao real, soma +${a.addQty} e apaga o duplicado`;
    case "repoint-deckItem":
      return `  DeckItem ${a.id} (deck ${a.deckId}) -- aponta pra impressao real ${a.cardId}`;
    case "merge-binderItem":
      return `  CardBinderItem ${a.from} (binder ${a.binderId}) -- ja existe pra impressao real, soma +${a.addQty} e apaga o duplicado`;
    case "repoint-binderItem":
      return `  CardBinderItem ${a.id} (binder ${a.binderId}) -- aponta pra impressao real ${a.cardId}`;
    case "promote":
      return `  Impressao real ${a.cardId} -- isPrimaryPrint = true (demais impressoes do mesmo CardModel viram false)`;
    case "delete-phantom":
      return `  Card fantasma ${a.cardId} -- APAGADO`;
    default:
      return `  ${JSON.stringify(a)}`;
  }
}

/** Executa o plano dentro de 1 transacao por fantasma -- tudo ou nada. */
async function applyPlan(prisma, { realPrint, actions }) {
  await prisma.$transaction(async (tx) => {
    for (const a of actions) {
      switch (a.type) {
        case "merge-deckItem":
          await tx.deckItem.update({ where: { id: a.into }, data: { quantity: { increment: a.addQty } } });
          await tx.deckItem.delete({ where: { id: a.from } });
          break;
        case "repoint-deckItem":
          await tx.deckItem.update({ where: { id: a.id }, data: { cardId: a.cardId } });
          break;
        case "merge-binderItem":
          await tx.cardBinderItem.update({ where: { id: a.into }, data: { quantity: { increment: a.addQty } } });
          await tx.cardBinderItem.delete({ where: { id: a.from } });
          break;
        case "repoint-binderItem":
          await tx.cardBinderItem.update({ where: { id: a.id }, data: { cardId: a.cardId } });
          break;
        case "promote":
          if (a.cardModelId) {
            await tx.card.updateMany({
              where: { cardModelId: a.cardModelId, id: { not: a.cardId }, isPrimaryPrint: true },
              data: { isPrimaryPrint: false },
            });
          }
          await tx.card.update({ where: { id: a.cardId }, data: { isPrimaryPrint: true } });
          break;
        case "delete-phantom":
          await tx.card.delete({ where: { id: a.cardId } });
          break;
      }
    }
  });
}

/** Tarefa 4 — todo CardModel numerado de GD01 (`code` começa com "GD01-" --
 *  as 130 cartas do booster, SEM contar os R-xxx/T-xxx genéricos de
 *  Resource/Token que compartilham o mesmo CardSet físico mas têm code
 *  próprio) precisa de 1 print ativo, primario, com imagem. So reporta --
 *  nunca corrige sozinho. */
async function validateGd01Primaries(prisma) {
  console.log("\n=== Validacao: CardModels de GD01 (code GD01-*) com print primario ===");
  const models = await prisma.cardModel.findMany({
    where: { code: { startsWith: "GD01-" } },
    select: { id: true, code: true },
  });

  let missing = 0;
  for (const model of models) {
    const primary = await prisma.card.findFirst({
      where: {
        cardModelId: model.id,
        isPrimaryPrint: true,
        isActive: true,
        OR: [{ imageUrl: { not: null } }, { imageMediumUrl: { not: null } }],
      },
    });
    if (!primary) {
      missing += 1;
      console.log(`  [SEM PRINT PRIMARIO VALIDO] ${model.code}`);
    }
  }

  console.log(`CardModels de GD01: ${models.length} | sem print primario ativo com imagem: ${missing}`);
  if (models.length === 0) {
    console.log("Nenhum CardModel com code GD01-* encontrado -- confira se o import esta correto.");
  } else if (missing === 0) {
    console.log("OK -- todos os CardModels de GD01 tem print primario ativo com imagem.");
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const candidates = await prisma.card.findMany({
      where: {
        imageUrl: null,
        imageMediumUrl: null,
      },
      select: { id: true, code: true, nameEn: true, rarity: true, cardModelId: true, isActive: true },
    });

    const phantoms = candidates.filter((c) => !c.rarity || !VALID_RARITIES.has(c.rarity));

    console.log(`Impressoes sem imagem: ${candidates.length} | com raridade suspeita entre essas: ${phantoms.length}`);
    if (phantoms.length) {
      console.log("\nCandidatos a remocao (heuristica geral):");
      for (const p of phantoms) console.log(`  ${p.code} · ${p.nameEn} · raridade="${p.rarity}" · id=${p.id}`);
    }

    const phantomIds = phantoms.map((p) => p.id);
    const [deckRefs, binderRefs] = await Promise.all([
      prisma.deckItem.findMany({ where: { cardId: { in: phantomIds } }, select: { cardId: true, deckId: true } }),
      prisma.cardBinderItem.findMany({ where: { cardId: { in: phantomIds } }, select: { cardId: true, binderId: true } }),
    ]);

    const referencedIds = new Set([...deckRefs.map((r) => r.cardId), ...binderRefs.map((r) => r.cardId)]);
    const explicitCodes = new Set(TARGET_CODES);
    const safeToDelete = phantoms.filter((p) => !referencedIds.has(p.id) && !explicitCodes.has(p.code));
    const blocked = phantoms.filter((p) => referencedIds.has(p.id) && !explicitCodes.has(p.code));

    if (blocked.length) {
      console.log(`\n${blocked.length} candidato(s) EM USO (deck ou binder de algum usuario) -- NAO vao ser apagados automaticamente:`);
      for (const b of blocked) console.log(`  ${b.code} · id=${b.id} -- referenciado em ${deckRefs.filter((r) => r.cardId === b.id).length} deck(s) e ${binderRefs.filter((r) => r.cardId === b.id).length} binder(s)`);
      console.log("Decisao manual necessaria pra esses -- provavelmente precisam de troca de print antes de remover.");
    }

    // ------------------------------------------------------------------
    // Correcao dos 6 fantasmas verificados manualmente (TARGET_CODES):
    // migra DeckItem/CardBinderItem pra impressao real, promove a real a
    // isPrimaryPrint e so entao apaga o fantasma.
    // ------------------------------------------------------------------
    console.log(`\n=== Correcao dos ${TARGET_CODES.length} fantasmas verificados (${TARGET_CODES.join(", ")}) ===`);
    const targetPhantoms = await prisma.card.findMany({
      where: { code: { in: TARGET_CODES }, imageUrl: null, imageMediumUrl: null },
      select: { id: true, code: true, nameEn: true, rarity: true, cardModelId: true, isActive: true },
    });

    const foundCodes = new Set(targetPhantoms.map((p) => p.code));
    for (const code of TARGET_CODES) {
      if (!foundCodes.has(code)) {
        console.log(`  ${code} -- nenhum fantasma encontrado (ja foi limpo antes, ou nunca existiu com esse criterio).`);
      }
    }

    for (const phantom of targetPhantoms) {
      const plan = await planFix(prisma, phantom);
      console.log(`\n${phantom.code} · ${phantom.nameEn} · fantasma id=${phantom.id}`);
      if (!plan.realPrint) {
        console.log(`  [SEM SUBSTITUTO] Nenhuma impressao real (mesmo ${phantom.cardModelId ? "cardModelId" : "code"}, com imageUrl) encontrada -- NAO apagado, decisao manual necessaria.`);
        continue;
      }
      console.log(`  Impressao real encontrada: id=${plan.realPrint.id} · imageUrl=${plan.realPrint.imageUrl}`);
      for (const a of plan.actions) console.log(describeAction(a));

      if (APPLY) {
        await applyPlan(prisma, plan);
        console.log("  -> aplicado.");
      }
    }

    console.log(`\n${safeToDelete.length} candidato(s) fora da lista verificada, sem nenhuma referencia (heuristica geral, nao mexido automaticamente alem do log).`);

    if (APPLY) {
      if (safeToDelete.length) {
        await prisma.card.deleteMany({ where: { id: { in: safeToDelete.map((c) => c.id) } } });
        console.log(`Removido(s) (heuristica geral, sem referencia): ${safeToDelete.length} print(s) fantasma.`);
      }
    } else {
      console.log("\nDry-run (padrao) -- nada foi apagado. Rode com --apply pra aplicar de verdade.");
    }

    await validateGd01Primaries(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
